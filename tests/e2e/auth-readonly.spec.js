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

  test('authenticated read-only controls, sorting and filtering stay responsive',async({page})=>{
    const pageErrors=watchPageErrors(page);

    await loginWithTestAccount(page);

    await page.locator('#addAlbumButton').click();
    await expect(page.locator('#addAlbumModal')).toBeVisible();
    await expect(page.locator('#albumSearchInput')).toBeFocused();
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
