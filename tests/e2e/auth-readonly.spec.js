const { test, expect } = require('@playwright/test');

const testEmail=process.env.GROOVY_E2E_EMAIL;
const testPassword=process.env.GROOVY_E2E_PASSWORD;

test.use({trace:'off'});

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

async function loginWithTestAccount(page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.landing-secondary')).toBeVisible();

  await page.locator('.landing-secondary').click();
  await expect(page.locator('#loginPanel')).toHaveClass(/open/);

  await page.locator('#loginEmail').fill(testEmail);
  await page.locator('#loginPassword').fill(testPassword);
  await page.locator('#loginButton').click();

  await expect.poll(
    ()=>page.evaluate(()=>Boolean(window.hasAuthenticatedUser)),
    {timeout:15_000}
  ).toBe(true);

  await expect(page.locator('body')).not.toHaveClass(/logged-out-home/);
  await expect(page.locator('#loginPanel')).not.toHaveClass(/open/);
}

test.describe('authenticated read-only smoke flows',()=>{
  test.skip(!testEmail||!testPassword,'GROOVY_E2E_EMAIL and GROOVY_E2E_PASSWORD are required');

  test('test account navigation and routes stay connected to its own shelf',async({page})=>{
    const pageErrors=watchPageErrors(page);

    await loginWithTestAccount(page);

    await expect(page).toHaveURL('http://127.0.0.1:4173/');
    await expect(page.locator('#collectionTabButton')).toContainText('My Shelf');
    await expect(page.locator('#collectionTabButton')).toHaveClass(/active/);
    await expect(page.locator('#libraryTitle')).toHaveText('All Records');
    await expect(page.locator('#profileUsername')).not.toHaveText('');

    await page.locator('#wishlistTabButton').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/?view=wishlist');
    await expect(page.locator('#wishlistTabButton')).toHaveClass(/active/);
    await expect(page.locator('#libraryTitle')).toHaveText('My Wishlist');

    await page.goBack();
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
    await expect(page.locator('#collectionTabButton')).toHaveClass(/active/);
    await expect(page.locator('#libraryTitle')).toHaveText('All Records');

    await page.goForward();
    await expect(page).toHaveURL('http://127.0.0.1:4173/?view=wishlist');
    await expect(page.locator('#wishlistTabButton')).toHaveClass(/active/);
    await expect(page.locator('#libraryTitle')).toHaveText('My Wishlist');

    await page.locator('.header-brand .logo').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
    await expect(page.locator('#collectionTabButton')).toHaveClass(/active/);
    await expect(page.locator('#libraryTitle')).toHaveText('All Records');

    await page.locator('#profileButton').click();
    await expect(page.locator('#profileMenu')).toBeVisible();
    await page.locator('#followingButton').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/following');
    await expect(page.locator('#followingPage')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/following-page-open/);
    await expect(page.locator('#followingPage h1')).toHaveText('Following');
    await expect(page.locator('#followingGrid')).toBeVisible();

    await page.locator('#followingBackButton').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
    await expect(page.locator('#followingPage')).not.toBeVisible();
    await expect(page.locator('#collectionTabButton')).toHaveClass(/active/);

    await page.locator('#profileButton').click();
    await expect(page.locator('#profileMenu')).toBeVisible();
    await page.locator('#statisticsButton').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/?stats=1');
    await expect(page.locator('#statisticsPage')).toHaveClass(/visible/);
    await expect(page.locator('#statisticsPage')).toHaveAttribute('aria-hidden','false');
    await expect(page.locator('#statisticsContent')).toBeVisible();

    await page.locator('#closeStatisticsPage').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
    await expect(page.locator('#statisticsPage')).not.toHaveClass(/visible/);
    await expect(page.locator('#statisticsPage')).toHaveAttribute('aria-hidden','true');

    expectNoPageErrors(pageErrors);
  });

  test('authenticated read-only controls, search, sorting and shelving stay responsive',async({page})=>{
    const pageErrors=watchPageErrors(page);

    await page.route('**/functions/v1/discogs-search',async route=>{
      if(route.request().method()!=='POST')return route.continue();
      await route.fulfill({
        status:200,
        contentType:'application/json',
        body:JSON.stringify({
          results:[{
            id:987654321,
            title:'Playwright Artist - Browser Album',
            year:2026,
            thumb:'',
            cover_image:''
          }]
        })
      });
    });
    await page.route('https://itunes.apple.com/**',route=>route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({resultCount:0,results:[]})
    }));

    await loginWithTestAccount(page);

    await expect.poll(async()=>{
      if(await page.locator('#collection .record').count()>0)return 'records';
      if(await page.locator('#emptyCollection').isVisible())return 'empty';
      return 'loading';
    },{timeout:10_000}).not.toBe('loading');

    await page.locator('#addAlbumButton').click();
    await expect(page.locator('#addAlbumModal')).toBeVisible();
    await expect(page.locator('#albumSearchInput')).toBeFocused();
    await page.locator('#albumSearchInput').fill('Playwright Browser Album');

    const searchResult=page.locator('#albumSearchResults .mb-result').first();
    await expect(searchResult).toBeVisible({timeout:10_000});
    await expect(searchResult.locator('.mb-title')).toHaveText('Browser Album');
    await expect(searchResult.locator('.mb-artist')).toHaveText('Playwright Artist');
    await expect(searchResult.locator('.mb-year')).toHaveText('2026');
    await expect(searchResult.locator('.mb-add-button')).toHaveText('Add Record');
    await expect(searchResult.locator('.mb-wishlist-button')).toContainText('Wishlist');

    await page.locator('#closeAddAlbum').click();
    await expect(page.locator('#addAlbumModal')).not.toBeVisible();

    await page.locator('#profileButton').click();
    await expect(page.locator('#profileMenu')).toBeVisible();
    await page.locator('#searchUserButton').click();
    await expect(page.locator('#searchUserModal')).toBeVisible();
    await expect(page.locator('#userSearchInput')).toBeFocused();
    await page.locator('#closeSearchUser').click();
    await expect(page.locator('#searchUserModal')).not.toBeVisible();

    await expect(page.locator('#notificationBox')).toBeVisible();
    await page.locator('#notificationBellButton').click();
    await expect(page.locator('#notificationBellButton')).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#notificationPanel')).toHaveAttribute('aria-hidden','false');
    await page.locator('#notificationBellButton').click();
    await expect(page.locator('#notificationPanel')).toHaveAttribute('aria-hidden','true');

    await page.locator('#librarySortButton').click();
    await expect(page.locator('#librarySortButton')).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#librarySortMenu')).toHaveClass(/open/);
    await page.locator('#librarySortMenu [data-sort="artist-asc"]').click();
    await expect(page.locator('#librarySortButton')).toContainText('Artist A–Z');
    await expect(page.locator('#librarySortButton')).toHaveAttribute('aria-expanded','false');

    await page.locator('#filterButton').click();
    await expect(page.locator('#filterButton')).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#filterMenu')).toHaveClass(/open/);
    await page.locator('#filterMenu [data-rating="all"]').click();
    await expect(page.locator('#filterButton')).toContainText('All ratings');
    await expect(page.locator('#filterButton')).toHaveAttribute('aria-expanded','false');

    await expect(page.locator('#shelfStrip')).toBeVisible();
    const customShelves=page.locator('#shelfStripScroll .shelf-chip-custom');
    const shelfCountBefore=await customShelves.count();
    await page.locator('#shelfStripScroll .shelf-new-button').click();
    await expect(page.locator('#createShelfModal')).toBeVisible();
    await expect(page.locator('#createShelfTitle')).toHaveText('Create New Shelf');
    await expect(page.locator('#shelfNameInput')).toBeFocused();
    await page.locator('#shelfNameInput').fill('Playwright Temporary Shelf');
    await page.locator('#shelfColorChoices [aria-label="Blue"]').click();
    await expect(page.locator('#shelfColorChoices [aria-label="Blue"]')).toHaveAttribute('aria-checked','true');
    await page.locator('#cancelCreateShelf').click();
    await expect(page.locator('#createShelfModal')).not.toBeVisible();
    await expect(customShelves).toHaveCount(shelfCountBefore);

    expectNoPageErrors(pageErrors);
  });

  test('a real collected record opens its authenticated album detail view',async({page})=>{
    const pageErrors=watchPageErrors(page);

    await loginWithTestAccount(page);

    const records=page.locator('#collection .record');
    await expect.poll(async()=>{
      if(await records.count()>0)return 'records';
      if(await page.locator('#emptyCollection').isVisible())return 'empty';
      return 'loading';
    },{timeout:10_000}).not.toBe('loading');

    if(await records.count()===0){
      test.skip(true,'Dedicated test account has no collected records for a real detail-view check');
    }

    await records.first().click();

    await expect(page.locator('#albumOverlay')).toHaveClass(/visible/);
    await expect(page.locator('#detailArtist')).not.toHaveText('');
    await expect(page.locator('#detailAlbum')).not.toHaveText('');
    await expect(page.locator('#detailRating')).toBeVisible();
    await expect(page.locator('#detailTracks')).toBeVisible();

    const firstTrack=page.locator('#detailTracks li').first();
    if(await firstTrack.count()>0){
      await expect(firstTrack.locator('.track-title')).not.toHaveText('');
      await expect(firstTrack.locator('.track-duration')).toBeVisible();
      await expect(firstTrack.locator('button')).toHaveCount(0);
      await expect(firstTrack.locator('input')).toHaveCount(0);
    }

    await page.locator('#albumClose').click();
    await expect(page.locator('#albumOverlay')).not.toHaveClass(/visible/);

    expectNoPageErrors(pageErrors);
  });
});
