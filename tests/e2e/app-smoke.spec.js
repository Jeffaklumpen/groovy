const { test, expect } = require('@playwright/test');

function watchPageErrors(page){
  const pageErrors=[];
  page.on('pageerror',error=>{
    pageErrors.push(`${error.name}: ${error.message}`);
  });
  return pageErrors;
}

function expectNoPageErrors(pageErrors){
  expect(pageErrors,`Fatal browser errors:\n${pageErrors.join('\n')}`).toEqual([]);
}

test('Groovy boots without fatal browser errors',async({page})=>{
  const pageErrors=watchPageErrors(page);

  await page.goto('/',{waitUntil:'domcontentloaded'});

  await expect(page).toHaveTitle(/GroovyShelves/);
  await expect(page.locator('header.header')).toBeVisible();
  await expect(page.locator('.header-brand .logo')).toHaveAttribute('alt','Groovy');
  await expect(page.locator('#collection')).toBeAttached();
  await expect(page.locator('#addAlbumButton')).toBeAttached();

  await page.waitForLoadState('load');
  await page.waitForTimeout(500);

  expectNoPageErrors(pageErrors);
});

test('logged-out visitors see the public landing instead of a library',async({page})=>{
  const pageErrors=watchPageErrors(page);

  await page.goto('/',{waitUntil:'domcontentloaded'});

  await expect(page.locator('body')).toHaveClass(/logged-out-home/);
  await expect(page.locator('.landing-title')).toHaveText('Track every record you own');
  await expect(page.locator('.landing-primary')).toHaveText('Create account');
  await expect(page.locator('.landing-secondary')).toHaveText('Log in');
  await expect(page.locator('#collectionTabButton')).toContainText('My Collection');
  await expect(page.locator('#wishlistTabButton')).toContainText('My Wishlist');
  await expect(page.locator('#collection')).toBeHidden();

  expectNoPageErrors(pageErrors);
});

test('landing login and registration buttons open the correct auth mode',async({page})=>{
  const pageErrors=watchPageErrors(page);

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.landing-title')).toBeVisible();

  await page.locator('.landing-primary').click();
  await expect(page.locator('#loginPanel')).toHaveClass(/open/);
  await expect(page.locator('#authTitle')).toHaveText('Create your account');
  await expect(page.locator('#registerUsername')).toBeVisible();
  await expect(page.locator('#registerButton')).toBeVisible();

  await page.locator('#loginClose').click();
  await expect(page.locator('#loginPanel')).not.toHaveClass(/open/);

  await page.locator('.landing-secondary').click();
  await expect(page.locator('#loginPanel')).toHaveClass(/open/);
  await expect(page.locator('#authTitle')).toHaveText('Welcome back');
  await expect(page.locator('#loginEmail')).toBeVisible();
  await expect(page.locator('#loginButton')).toBeVisible();

  expectNoPageErrors(pageErrors);
});

test('logged-out library tabs require login without changing the route',async({page})=>{
  const pageErrors=watchPageErrors(page);

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/logged-out-home/);

  await page.locator('#wishlistTabButton').click();
  await expect(page.locator('#loginPanel')).toHaveClass(/open/);
  await expect(page.locator('#authTitle')).toHaveText('Welcome back');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');

  expectNoPageErrors(pageErrors);
});

test('logged-out visitors are returned to the public landing from protected routes',async({page})=>{
  const pageErrors=watchPageErrors(page);

  await page.goto('/shelf/playwright-protected-route',{waitUntil:'domcontentloaded'});

  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await expect(page.locator('body')).toHaveClass(/logged-out-home/);
  await expect(page.locator('.landing-title')).toHaveText('Track every record you own');
  await expect(page.locator('#collection')).toBeHidden();

  expectNoPageErrors(pageErrors);
});

test('Add Record requires login for logged-out visitors',async({page})=>{
  const pageErrors=watchPageErrors(page);

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveClass(/logged-out-home/);
  await expect(page.locator('#addAlbumButton')).toBeVisible();

  await page.locator('#addAlbumButton').click();

  await expect(page.locator('#loginPanel')).toHaveClass(/open/);
  await expect(page.locator('#authTitle')).toHaveText('Welcome back');
  await expect(page.locator('#addAlbumModal')).toBeHidden();

  expectNoPageErrors(pageErrors);
});

test('a rendered record card opens the album detail view',async({page})=>{
  const pageErrors=watchPageErrors(page);

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.landing-title')).toBeVisible();

  await page.route(/^https:\/\//,route=>route.abort());

  await page.evaluate(()=>{
    window.hasAuthenticatedUser=true;
    window.loginRequiredForViewedCollection=false;
    window.profileNotFound=false;
    window.viewedUserId=null;
    window.libraryView='collection';
    document.body.classList.remove('logged-out-home');

    window.records=[[
      1,
      'Playwright Artist',
      'Playwright Album',
      '2026',
      'Rock',
      0,
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      {
        A:[{id:'playwright-track',title:'Browser Test Track',trackNumber:1,duration:'3:21'}],
        B:[],C:[],D:[],E:[],F:[],G:[],H:[]
      },
      'playwright-album',
      'playwright-entry',
      '',
      {},
      '',
      '',
      null,
      0,
      0
    ]];

    window.buildGrid();
  });

  const card=page.locator('#collection .record').first();
  await expect(card).toBeVisible();
  await expect(card).toContainText('Playwright Album');

  await card.click();

  await expect(page.locator('#albumOverlay')).toHaveClass(/visible/);
  await expect(page.locator('#detailArtist')).toHaveText('Playwright Artist');
  await expect(page.locator('#detailAlbum')).toHaveText('Playwright Album');
  await expect(page.locator('#detailRating')).toContainText('Your rating');
  await expect(page.locator('#detailRating .album-rating-star')).toHaveCount(5);

  const track=page.locator('#detailTracks li').first();
  await expect(track.locator('.track-title')).toHaveText('Browser Test Track');
  await expect(track.locator('.track-duration')).toHaveText('3:21');
  await expect(track.locator('button')).toHaveCount(0);
  await expect(track.locator('input')).toHaveCount(0);

  await page.locator('#albumClose').click();
  await expect(page.locator('#albumOverlay')).not.toHaveClass(/visible/);

  expectNoPageErrors(pageErrors);
});
