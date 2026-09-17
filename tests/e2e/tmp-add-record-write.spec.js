const { test, expect } = require('@playwright/test');

const testEmail=process.env.GROOVY_E2E_EMAIL;
const testPassword=process.env.GROOVY_E2E_PASSWORD;

test.use({trace:'off'});

test.skip(!testEmail||!testPassword,'Authenticated test account is required');

test('temporary: Add Record writes a collection row and opens the saved record',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(`${error.name}: ${error.message}`));

  await page.route('**/functions/v1/discogs-search',async route=>{
    if(route.request().method()!=='POST')return route.continue();
    let body={};
    try{body=route.request().postDataJSON()||{};}catch(error){}

    if(body.action==='master'){
      return route.fulfill({
        status:200,
        contentType:'application/json',
        body:JSON.stringify({
          title:'Ride The Lightning',
          year:1984,
          artists:[{name:'Metallica'}],
          tracklist:[],
          images:[]
        })
      });
    }

    if(body.action==='vinylRelease'){
      return route.fulfill({
        status:200,
        contentType:'application/json',
        body:JSON.stringify({tracklist:[]})
      });
    }

    return route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        results:[{
          id:6440,
          title:'Metallica - Ride The Lightning',
          year:1984,
          thumb:'/record.png',
          cover_image:'/record.png'
        }]
      })
    });
  });

  await page.route('https://itunes.apple.com/**',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({resultCount:0,results:[]})
  }));

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('.landing-secondary').click();
  await page.locator('#loginEmail').fill(testEmail);
  await page.locator('#loginPassword').fill(testPassword);
  await page.locator('#loginButton').click();

  await expect.poll(
    ()=>page.evaluate(()=>Boolean(window.hasAuthenticatedUser)),
    {timeout:15_000}
  ).toBe(true);

  await page.locator('#addAlbumButton').click();
  await expect(page.locator('#addAlbumModal')).toBeVisible();
  await page.locator('#albumSearchInput').fill('Ride The Lightning write smoke');

  const result=page.locator('#albumSearchResults .mb-result').first();
  await expect(result).toBeVisible({timeout:10_000});
  await expect(result.locator('.mb-title')).toHaveText('Ride The Lightning');
  await expect(result.locator('.mb-add-button')).toHaveText('Add Record');

  await result.locator('.mb-add-button').click();
  await expect(result.locator('.mb-add-button')).toHaveText('✓ In collection',{timeout:15_000});

  await page.locator('#closeAddAlbum').click();
  await expect(page.locator('#addAlbumModal')).not.toBeVisible();

  const savedCard=page.locator('#collection .record').filter({hasText:'Ride The Lightning'}).first();
  await expect(savedCard).toBeVisible({timeout:10_000});
  await savedCard.click();

  await expect(page.locator('#albumOverlay')).toHaveClass(/visible/);
  await expect(page.locator('#detailArtist')).toHaveText('Metallica');
  await expect(page.locator('#detailAlbum')).toHaveText('Ride The Lightning');

  expect(pageErrors,`Fatal browser errors:\n${pageErrors.join('\n')}`).toEqual([]);
});
