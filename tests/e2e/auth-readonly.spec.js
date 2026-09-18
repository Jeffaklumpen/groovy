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


  test('community overview renders on desktop and mobile',async({page})=>{
    const pageErrors=watchPageErrors(page);

    await loginWithTestAccount(page);

    await expect(page.locator('#communityTabButton')).toBeVisible();
    await page.locator('#communityTabButton').click();

    await expect(page).toHaveURL('http://127.0.0.1:4173/community');
    await expect(page.locator('body')).toHaveClass(/community-page-open/);
    await expect(page.locator('#communityPage')).toBeVisible();
    await expect(page.locator('#communityTabButton')).toHaveClass(/active/);
    await expect(page.locator('.community-heading')).toHaveCount(0);
    await expect(page.locator('.community-summary-card')).toHaveCount(3);
    await expect(page.locator('.community-summary-card')).toContainText(['Collectors','Collected Records','Wishlisted Records']);
    await expect(page.locator('.community-panel-heading h2')).toContainText([
      'Collectors with similar taste',
      'Activity Feed',
      'Top Collectors',
      'Community Statistics',
      'Top rated albums'
    ]);

    const albumCovers=page.locator('.community-cover[data-community-album-id]');
    if(await albumCovers.count()>0){
      await expect(albumCovers.first().locator('.community-streaming-row')).toHaveCount(0);
      await expect(page.locator('.community-streaming-row .apple-music-small-badge').first()).toBeAttached();
      await expect(page.locator('.community-streaming-row .spotify-service-logo').first()).toBeAttached();
      await expect(page.locator('.community-streaming-row .spotify-service-logo').first()).toHaveAttribute('src','/assets/brands/spotify-full-logo-green.svg');

      await albumCovers.first().click();
      await expect(page.locator('#albumOverlay')).toHaveClass(/visible/);
      await expect(page.locator('#albumOverlay')).toHaveClass(/search-preview/);
      await expect(page.locator('#detailShelfActions')).toBeVisible();
      await expect(page.locator('#detailShelfActions .detail-shelf-button.primary')).toContainText(/Add Record|In collection|On wishlist/);
      await expect(page.locator('#detailShelfActions .detail-shelf-button.secondary')).toContainText(/Wishlist|In collection|Wishlisted/);
      await page.locator('#albumClose').click();
      await expect(page.locator('#albumOverlay')).not.toHaveClass(/visible/);
    }

    await page.setViewportSize({width:390,height:844});
    await expect(page.locator('#communityPage')).toBeVisible();

    const topRatedCard=page.locator('.community-featured-panel .community-album-card').first();
    if(await topRatedCard.count()>0){
      const spotify=topRatedCard.locator('.community-streaming-spotify');
      await expect(spotify).toBeVisible();
      const bounds=await page.evaluate(()=>{
        const card=document.querySelector('.community-featured-panel .community-album-card');
        const spotifyLink=card&&card.querySelector('.community-streaming-spotify');
        if(!card||!spotifyLink)return null;
        const cardBox=card.getBoundingClientRect();
        const spotifyBox=spotifyLink.getBoundingClientRect();
        return {
          cardLeft:cardBox.left,
          cardRight:cardBox.right,
          spotifyLeft:spotifyBox.left,
          spotifyRight:spotifyBox.right
        };
      });
      expect(bounds).not.toBeNull();
      expect(bounds.spotifyLeft).toBeGreaterThanOrEqual(bounds.cardLeft-1);
      expect(bounds.spotifyRight).toBeLessThanOrEqual(bounds.cardRight+1);
    }



    const mobileGeometry=await page.evaluate(()=>({
      viewport:document.documentElement.clientWidth,
      pageWidth:document.getElementById('communityPage').getBoundingClientRect().width,
      bodyScrollWidth:document.body.scrollWidth
    }));

    expect(mobileGeometry.pageWidth).toBeLessThanOrEqual(mobileGeometry.viewport+1);
    expect(mobileGeometry.bodyScrollWidth).toBeLessThanOrEqual(mobileGeometry.viewport+1);

    await page.locator('.header-brand .logo').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
    await expect(page.locator('body')).not.toHaveClass(/community-page-open/);
    await expect(page.locator('#collectionTabButton')).toHaveClass(/active/);

    expectNoPageErrors(pageErrors);
  });

  test('artist profile supports contextual album navigation',async({page})=>{
    const pageErrors=watchPageErrors(page);

    await page.route('**/functions/v1/discogs-search',async route=>{
      if(route.request().method()!=='POST')return route.continue();
      let body={};
      try{body=route.request().postDataJSON()||{};}catch(error){}
      if(body.action==='artistProfile'){
        return route.fulfill({
          status:200,
          contentType:'application/json',
          body:JSON.stringify({
            id:123,
            name:'Pink Floyd',
            current_members:[{id:1,name:'David Gilmour'},{id:2,name:'Nick Mason'}],
            past_members:[{id:3,name:'Richard Wright'}],
            genres:['Progressive Rock','Psychedelic Rock'],
            official_url:'https://www.pinkfloyd.com/'
          })
        });
      }
      if(body.action==='cacheArtistArtwork'){
        return route.fulfill({
          status:200,
          contentType:'application/json',
          body:JSON.stringify({eligible:14,cached_total:14,cached_added:0,complete:true})
        });
      }
      if(body.action==='master'){
        return route.fulfill({
          status:200,
          contentType:'application/json',
          body:JSON.stringify({
            id:Number(body.masterId)||10362,
            title:'The Dark Side of the Moon',
            year:1973,
            artists:[{id:123,name:'Pink Floyd'}],
            styles:['Prog Rock'],
            genres:['Rock'],
            images:[]
          })
        });
      }
      return route.continue();
    });

    await page.route('https://en.wikipedia.org/w/api.php**',async route=>{
      const url=new URL(route.request().url());
      const prop=url.searchParams.get('prop')||'';
      if(url.searchParams.get('generator')==='search'){
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
          query:{pages:[{pageid:1,title:'Pink Floyd',extract:'Pink Floyd are an English rock band formed in London.',fullurl:'https://en.wikipedia.org/wiki/Pink_Floyd',pageimage:'Pink_Floyd_test.jpg'}]}
        })});
      }
      if(prop==='sections'){
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
          parse:{sections:[
            {index:'1',line:'History',level:'2',toclevel:1},
            {index:'2',line:'Musical style',level:'2',toclevel:1},
            {index:'3',line:'References',level:'2',toclevel:1}
          ]}
        })});
      }
      if(prop==='text'){
        const section=url.searchParams.get('section');
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
          parse:{text:'<p>'+(section==='1'?'History paragraph.':'Musical style paragraph.')+'</p>'}
        })});
      }
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });

    await page.route('https://commons.wikimedia.org/w/api.php**',route=>route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({query:{pages:[{imageinfo:[{
        thumburl:'https://example.com/pink-floyd.jpg',
        url:'https://example.com/pink-floyd.jpg',
        descriptionurl:'https://commons.wikimedia.org/wiki/File:Pink_Floyd_test.jpg',
        extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},Artist:{value:'Test Photographer'}}
      }]}]}})
    }));
    await page.route('https://example.com/pink-floyd.jpg',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'}));
    await page.route('https://itunes.apple.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({resultCount:0,results:[]})}));

    await loginWithTestAccount(page);

    await page.evaluate(()=>window.groovyOpenSearchAlbumPreview({
      master:{id:10362},
      artist:'Pink Floyd',
      albumTitle:'The Dark Side of the Moon',
      year:1973,
      genre:'Prog Rock',
      coverState:{url:'',appleCollectionUrl:''},
      isAdded:false,
      isWishlisted:false,
      save:async()=>false,
      artistDiscogsId:123
    }));
    await expect(page.locator('#albumOverlay')).toHaveClass(/visible/);
    await page.locator('#detailArtist').click();

    await expect(page).toHaveURL(/\/artist\/123-pink-floyd$/);
    await expect(page.locator('#artistPage')).toBeVisible();
    await expect(page.locator('.artist-hero h1')).toHaveText('Pink Floyd');
    await expect(page.locator('.artist-genres')).toContainText('Progressive Rock');
    await expect(page.getByRole('heading',{name:'Current members'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Past members'})).toBeVisible();
    await expect(page.locator('.artist-discography-panel')).toBeVisible();
    await expect(page.locator('.artist-about-panel')).toContainText('History');
    await expect(page.locator('.artist-about-panel')).toContainText('Musical style');
    await expect(page.locator('.artist-context-back')).toContainText('The Dark Side of the Moon');

    await page.evaluate(()=>{
      window.__groovyAlbumBackFlash=false;
      var collection=document.getElementById('collection');
      var overlay=document.getElementById('albumOverlay');
      var observer=new MutationObserver(function(){
        var collectionVisible=collection&&getComputedStyle(collection).display!=='none';
        var overlayVisible=overlay&&overlay.classList.contains('visible');
        if(!location.pathname.startsWith('/artist/')&&collectionVisible&&!overlayVisible){
          window.__groovyAlbumBackFlash=true;
        }
      });
      observer.observe(document.documentElement,{subtree:true,attributes:true,childList:true});
      window.__groovyAlbumBackObserver=observer;
    });

    await page.locator('.artist-context-back').click();
    await expect(page).toHaveURL('http://127.0.0.1:4173/');
    await expect(page.locator('#albumOverlay')).toHaveClass(/visible/);
    await expect(page.locator('#detailAlbum')).toHaveText('The Dark Side of the Moon');
    expect(await page.evaluate(()=>window.__groovyAlbumBackFlash)).toBe(false);
    await page.evaluate(()=>{
      if(window.__groovyAlbumBackObserver)window.__groovyAlbumBackObserver.disconnect();
      delete window.__groovyAlbumBackObserver;
    });
    await page.locator('#albumClose').click();

    await page.evaluate(()=>window.GroovyRouter.navigate('/artist/123-pink-floyd',{artistSource:'search',artistName:'Pink Floyd'}));
    await expect(page.locator('#artistPage')).toBeVisible();
    await expect(page.locator('.artist-context-back')).toHaveCount(0);

    const existingAlbum=page.locator('.artist-discography-card[data-artist-album-id]').first();
    if(await existingAlbum.count()>0){
      await existingAlbum.click();
      await expect(page.locator('#albumOverlay')).toHaveClass(/visible/);
      await expect(page.locator('#detailContextBack')).toHaveCount(0);
      await page.locator('#albumClose').click();
      await expect(page.locator('#albumOverlay')).not.toHaveClass(/visible/);
      await expect(page).toHaveURL(/\/artist\/123-pink-floyd$/);
      await expect(page.locator('#artistPage')).toBeVisible();
    }

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
          }],
          artists:[{id:123456,name:'Playwright Artist'}]
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
    await expect(page.locator('#albumSearchResults .artist-search-result').first()).toContainText('Playwright Artist');

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
