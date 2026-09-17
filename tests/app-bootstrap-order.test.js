const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('notification core is initialized before first use in app.js',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var NotificationCore=window.GroovyNotificationCore;');
  const firstUse=source.indexOf('NotificationCore.escapeHtml');
  assert.ok(declaration>=0,'NotificationCore bootstrap declaration is missing');
  assert.ok(firstUse>=0,'NotificationCore first use is missing');
  assert.ok(declaration<firstUse,'NotificationCore must be initialized before it is used');
});

test('dependency scripts load before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(app>=0,'app.js script is missing');
  ['/js/notification-core.js?v=','/js/notification-controller.js?v=','/js/social-controller.js?v=','/js/user-search-controller.js?v=','/js/detail-social-controller.js?v=','/js/pressing-core.js?v=','/js/detail-tracklist-controller.js?v=','/js/rating-core.js?v=','/js/marketplace-core.js?v=','/js/marketplace-view.js?v=','/js/marketplace-controller.js?v=','/js/shelf-core.js?v=','/js/shelf-view.js?v=','/js/shelf-controller.js?v=','/js/library-core.js?v=','/js/apple-search-core.js?v=','/js/album-search.js?v=','/js/wikipedia-about-controller.js?v='].forEach((script)=>{
    const pos=html.indexOf(script);assert.ok(pos>=0,script+' script is missing');assert.ok(pos<app,script+' must load before app.js');
  });
  assert.match(html,/\/js\/app\.js\?v=\d+/);
});

test('notification scripts load core then controller before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/notification-core.js?v=');
  const controller=html.indexOf('/js/notification-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&controller>core&&app>controller);
});

test('notification controller initializes before app integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var NotificationController=window.GroovyNotificationController;');
  const create=source.indexOf('NotificationController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyNotificationController must load before app\.js/);
  assert.doesNotMatch(source,/function renderNotifications|function loadNotifications|notificationChannel|notificationsCache|syncNotificationSubscription/);
});

test('social controller loads before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const social=html.indexOf('/js/social-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(social>=0&&app>social);
});

test('social controller initializes before app integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var SocialController=window.GroovySocialController;');
  const create=source.indexOf('SocialController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovySocialController must load before app\.js/);
  assert.doesNotMatch(source,/async function groovyFollowingIds|function ensureFollowingPage|function renderFollowingPage|supabaseClient\.rpc\('get_following_overview'\)/);
});

test('user search controller loads after social controller and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const social=html.indexOf('/js/social-controller.js?v=');
  const userSearch=html.indexOf('/js/user-search-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(social>=0&&userSearch>social&&app>userSearch);
});

test('user search controller initializes before app integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var UserSearchController=window.GroovyUserSearchController;');
  const create=source.indexOf('UserSearchController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyUserSearchController must load before app\.js/);
  assert.match(source,/userSearchController\.syncUser\(user\)/);
  assert.doesNotMatch(source,/let userSearchTimer|var userPresenceChannel|function syncUserPresence|function performUserPresenceSync|function loadTopUsers|async function searchUsers|groovy-online-users/);
});

test('detail social controller loads after user search controller and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const userSearch=html.indexOf('/js/user-search-controller.js?v=');
  const detailSocial=html.indexOf('/js/detail-social-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(userSearch>=0&&detailSocial>userSearch&&app>detailSocial);
});

test('detail social controller initializes before app integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var DetailSocialController=window.GroovyDetailSocialController;');
  const create=source.indexOf('DetailSocialController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyDetailSocialController must load before app\.js/);
  assert.match(source,/detailSocialController\.openForRecord\(record,index\)/);
  assert.match(source,/detailSocialController\.close\(\)/);
  assert.doesNotMatch(source,/detailSocialRequestVersion|detailSocialCache|function detailSocialEscape|function loadDetailSocialContext|function renderFollowedCollectorsForAlbum|function renderOwnCollectionMatch|function positionDetailSocialMenu/);
});

test('detail tracklist controller loads after pressing core and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const pressing=html.indexOf('/js/pressing-core.js?v=');
  const tracklist=html.indexOf('/js/detail-tracklist-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(pressing>=0&&tracklist>pressing&&app>tracklist);
});

test('detail tracklist controller owns duration hydration before app integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var DetailTracklistController=window.GroovyDetailTracklistController;');
  const create=source.indexOf('DetailTracklistController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyDetailTracklistController must load before app\.js/);
  assert.match(source,/detailTracklistController\.openForRecord\(record,index\)/);
  assert.doesNotMatch(source,/function loadCachedTrackDurations|function persistTrackDurations|function renderDetailTracklist|function ensureDetailTrackDurations|\bdiscogsTrackRows\(/);
});

test('Wikipedia about controller loads after its service and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const service=html.indexOf('/js/wikipedia-service.js?v=');
  const controller=html.indexOf('/js/wikipedia-about-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(service>=0&&controller>service&&app>controller);
});

test('Wikipedia about controller initializes before app integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var WikipediaAboutController=window.GroovyWikipediaAboutController;');
  const create=source.indexOf('WikipediaAboutController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyWikipediaAboutController must load before app\.js/);
  assert.match(source,/wikipediaAboutController\.openForRecord\(record\)/);
  assert.match(source,/wikipediaAboutController\.close\(\)/);
  assert.doesNotMatch(source,/wikipediaAboutRequestVersion|wikipediaAlbumCache|WIKIPEDIA_CACHE_TTL|function wikipediaAboutLineHeight|function renderWikipediaParagraphs|function setWikipediaAboutExpanded|function syncWikipediaAboutToggle|function readWikipediaCache|function saveWikipediaCache|function renderWikipediaAbout|function loadWikipediaAlbumAbout/);
});

test('marketplace scripts load core, view and controller in order before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/marketplace-core.js?v=');
  const view=html.indexOf('/js/marketplace-view.js?v=');
  const controller=html.indexOf('/js/marketplace-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&view>core&&controller>view&&app>controller);
});

test('marketplace controller initializes before app integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var MarketplaceController=window.GroovyMarketplaceController;');
  const create=source.indexOf('MarketplaceController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyMarketplaceController must load before app\.js/);
  assert.doesNotMatch(source,/function loadTraderaListings|function loadEbayListings|MARKETPLACE_CURRENCY_STORAGE_KEY/);
});

test('Apple search core is passed into the album search feature',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const feature=fs.readFileSync('js/album-search.js','utf8');
  assert.match(app,/var AppleSearchCore=window\.GroovyAppleSearchCore;/);
  assert.match(app,/appleSearchCore:AppleSearchCore/);
  assert.match(feature,/var AppleSearchCore=options\.appleSearchCore;/);
  assert.match(feature,/AppleSearchCore\.normalizeAppleSearchText/);
});

test('album search module initializes before controller integration in app.js',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var AlbumSearch=window.GroovyAlbumSearch;');
  const create=source.indexOf('AlbumSearch.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyAlbumSearch must load before app\.js/);
});

test('shelf modules initialize before controller integration in app.js',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const core=source.indexOf('var ShelfCore=window.GroovyShelfCore;');
  const view=source.indexOf('var ShelfView=window.GroovyShelfView;');
  const controller=source.indexOf('var ShelfController=window.GroovyShelfController;');
  const create=source.indexOf('ShelfController.create({');
  assert.ok(core>=0&&view>core&&controller>view&&create>controller);
  assert.match(source,/GroovyShelfController must load before app\.js/);
});

test('library core is initialized before library filtering in app.js',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var LibraryCore=window.GroovyLibraryCore;');
  const firstUse=source.indexOf('LibraryCore.filterRecords');
  assert.ok(declaration>=0,'LibraryCore bootstrap declaration is missing');assert.ok(firstUse>=0,'LibraryCore first use is missing');assert.ok(declaration<firstUse,'LibraryCore must be initialized before library helpers are used');
});
