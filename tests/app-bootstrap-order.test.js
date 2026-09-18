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
  ['/js/user-profile-core.js?v=','/js/notification-core.js?v=','/js/notification-controller.js?v=','/js/social-controller.js?v=','/js/user-search-controller.js?v=','/js/detail-social-controller.js?v=','/js/pressing-core.js?v=','/js/pressing-view.js?v=','/js/pressing-picker.js?v=','/js/pressing-controller.js?v=','/js/detail-tracklist-controller.js?v=','/js/detail-layout-controller.js?v=','/js/rating-core.js?v=','/js/album-rating-controller.js?v=','/js/marketplace-core.js?v=','/js/marketplace-view.js?v=','/js/marketplace-controller.js?v=','/js/shelf-core.js?v=','/js/shelf-view.js?v=','/js/shelf-controller.js?v=','/js/library-core.js?v=','/js/library-data.js?v=','/js/library-style-refresh.js?v=','/js/library-actions-controller.js?v=','/js/grid-sort-controller.js?v=','/js/library-render-controller.js?v=','/js/apple-search-core.js?v=','/js/album-search.js?v=','/js/wikipedia-about-controller.js?v='].forEach((script)=>{
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

test('library core is initialized before the library render controller consumes it',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const render=fs.readFileSync('js/library-render-controller.js','utf8');
  const declaration=app.indexOf('var LibraryCore=window.GroovyLibraryCore;');
  const create=app.indexOf('libraryCore:LibraryCore');
  assert.ok(declaration>=0,'LibraryCore bootstrap declaration is missing');
  assert.ok(create>declaration,'LibraryCore must be initialized before it is injected into the renderer');
  assert.match(render,/core\.filterRecords\(/);
  assert.match(render,/core\.sortRecords\(/);
});


test('album rating controller loads after rating core and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/rating-core.js?v=');
  const controller=html.indexOf('/js/album-rating-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&controller>core&&app>controller);
});

test('album rating controller owns rating data, detail rendering and save flow',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var AlbumRatingController=window.GroovyAlbumRatingController;');
  const create=source.indexOf('AlbumRatingController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyAlbumRatingController must load before app\.js/);
  assert.match(source,/ratingController\.loadData\(albumIds,user\.id\)/);
  assert.match(source,/ratingController\.renderDetail\(index\)/);
  assert.doesNotMatch(source,/function clampGroovyRating|function renderDetailRatingPanels|async function saveAlbumRating|function renderStaticStarMeter/);
});


test('detail layout controller loads before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const controller=html.indexOf('/js/detail-layout-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(controller>=0&&app>controller);
});

test('detail layout controller owns detail sizing and responsive column movement',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var DetailLayoutController=window.GroovyDetailLayoutController;');
  const create=source.indexOf('DetailLayoutController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyDetailLayoutController must load before app\.js/);
  assert.match(source,/detailLayoutController\.syncOpen\(\)/);
  assert.doesNotMatch(source,/function syncAlbumDesktopColumns|function syncDesktopAlbumMiddleHeight|function syncMobileDetailPairHeight|albumDesktopRightColumn/);
});


test('pressing scripts load core, view, picker and controller before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/pressing-core.js?v=');
  const view=html.indexOf('/js/pressing-view.js?v=');
  const picker=html.indexOf('/js/pressing-picker.js?v=');
  const controller=html.indexOf('/js/pressing-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&view>core&&picker>view&&controller>picker&&app>controller);
});

test('pressing controller owns copy-details persistence and picker integration',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var PressingController=window.GroovyPressingController;');
  const create=source.indexOf('PressingController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyPressingController must load before app\.js/);
  assert.match(source,/pressingController\.render\(index\)/);
  assert.match(source,/pressingController\.closeDetails\(\)/);
  assert.doesNotMatch(source,/copyDetailsExpanded|copyDetailsRecordKey|function renderCopyDetails|function saveConditionDetails|function fetchPressingVersions|function fetchPressingRelease|function savePressingSelection|function openPressingPicker|function closePressingPicker|GroovyPressingPicker/);
});


test('library actions controller loads after library core and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/library-core.js?v=');
  const controller=html.indexOf('/js/library-actions-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&controller>core&&app>controller);
});

test('library actions controller owns collection and wishlist mutations',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var LibraryActionsController=window.GroovyLibraryActionsController;');
  const create=source.indexOf('LibraryActionsController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyLibraryActionsController must load before app\.js/);
  assert.match(source,/libraryActionsController\.moveWishlistToCollection\(moveIndex,moveButton\)/);
  assert.match(source,/libraryActionsController\.deleteWishlist\(index\)/);
  assert.match(source,/libraryActionsController\.deleteCollection\(index\)/);
  assert.doesNotMatch(source,/function deleteCollectionAlbum|function deleteWishlistAlbum|function moveWishlistAlbumToCollection/);
});


test('selection toolbar keeps Select before desktop sort and exposes contextual bulk actions',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const css=fs.readFileSync('css/library-shell.css','utf8');
  const app=fs.readFileSync('js/app.js','utf8');
  const select=html.indexOf('id="librarySelectButton"');
  const sort=html.indexOf('class="menu-dropdown library-sort-field"');
  const filter=html.indexOf('class="menu-dropdown library-rating-filter"');
  assert.ok(select>=0&&select<sort&&sort<filter);
  assert.match(css,/\.library-sort-field\{order:1;/);
  assert.match(css,/\.library-rating-filter\{order:2\}/);
  assert.match(css,/\.library-select-button\{order:3;/);
  assert.match(html,/id="selectionRemoveShelfButton"/);
  assert.match(html,/id="selectionAddCollectionButton"/);
  assert.match(app,/moveCollectionRecordsToShelf\(entryIds,null\)/);
  assert.match(app,/moveWishlistRecordsToCollection\(entryIds\)/);
});

test('library render controller loads after library core/actions and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/library-core.js?v=');
  const actions=html.indexOf('/js/library-actions-controller.js?v=');
  const render=html.indexOf('/js/library-render-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&actions>core&&render>actions&&app>render);
});

test('library render controller owns card markup pagination and grid presentation',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var LibraryRenderController=window.GroovyLibraryRenderController;');
  const create=source.indexOf('LibraryRenderController.create({');
  assert.ok(declaration>=0&&create>declaration);
  assert.match(source,/GroovyLibraryRenderController must load before app\.js/);
  assert.match(source,/function buildGrid\(\)\{\s*return libraryRenderController\.render\(\);\s*\}/);
  assert.match(source,/onRendered:function\(\)\{if\(selectionController\)selectionController\.syncCards\(\);\}/);
  assert.match(source,/window\.onscroll=libraryRenderController\.scheduleImageLoad/);
  assert.match(source,/loginToViewCollection:document\.getElementById\('loginToViewCollection'\)/);
  assert.match(source,/emptyViewedCollection:document\.getElementById\('emptyViewedCollection'\)/);
  assert.doesNotMatch(source,/loginToViewCollection:loginToViewCollection|emptyViewedCollection:emptyViewedCollection/);
  assert.doesNotMatch(source,/function recordDisplayNumber|function recordArrayIndex|function recordHTML|function loadVisibleImages|function paginationItems|function renderLibraryPagination/);
});


test('grid sort controller loads before library renderer and app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const actions=html.indexOf('/js/library-actions-controller.js?v=');
  const gridSort=html.indexOf('/js/grid-sort-controller.js?v=');
  const render=html.indexOf('/js/library-render-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(actions>=0&&gridSort>actions&&render>gridSort&&app>render);
});

test('grid sort controller owns drag interactions reorder state and save queue',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const controller=fs.readFileSync('js/grid-sort-controller.js','utf8');
  assert.match(source,/var GridSortController=window\.GroovyGridSortController;/);
  assert.match(source,/GridSortController\.create\(\{/);
  assert.match(source,/enableGridSorting:gridSortController\.enable/);
  assert.match(controller,/function commitDomOrder\(\)/);
  assert.match(controller,/set_collection_display_order/);
  assert.match(controller,/set_wishlist_display_order/);
  assert.doesNotMatch(source,/function enableGridSorting|pendingGridOrderSaves|function queueGridOrderSave|function flushGridOrderSaveQueue/);
});


test('library data loads after record model/core and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const record=html.indexOf('/js/record-model.js?v=');
  const core=html.indexOf('/js/library-core.js?v=');
  const data=html.indexOf('/js/library-data.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(record>=0&&core>record&&data>core&&app>data);
});

test('own and viewed collection loaders share library data mapping',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  assert.match(source,/var LibraryData=window\.GroovyLibraryData;/);
  assert.match(source,/libraryData\.fetchCollection\(user\.id\)/);
  assert.match(source,/libraryData\.fetchCollection\(userId\)/);
  assert.ok((source.match(/libraryData\.mapCollectionRows\(/g)||[]).length>=2);
  assert.doesNotMatch(source,/function copyDetailsFromRow/);
  assert.doesNotMatch(source,/window\.applyAlbumRatingMeta\(\[/);
});


test('library style refresh loads after library data and before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const data=html.indexOf('/js/library-data.js?v=');
  const style=html.indexOf('/js/library-style-refresh.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(data>=0&&style>data&&app>style);
});

test('app delegates Discogs style refresh to library style module',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const style=fs.readFileSync('js/library-style-refresh.js','utf8');
  assert.match(source,/var LibraryStyleRefresh=window\.GroovyLibraryStyleRefresh;/);
  assert.match(source,/LibraryStyleRefresh\.create\(\{/);
  assert.match(source,/libraryStyleRefresh\.refresh\(rows,loadVersion\)/);
  assert.doesNotMatch(source,/async function refreshNext\(\)/);
  assert.doesNotMatch(source,/functions\.invoke\('discogs-search'/);
  assert.match(style,/functions\.invoke\('discogs-search'/);
  assert.match(style,/30\*24\*60\*60\*1000/);
});


test('username validation core loads before both app and profile integrations',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/user-profile-core.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  const profile=html.indexOf('/js/profile.js?v=');
  assert.ok(core>=0&&core<app&&core<profile);
  assert.match(fs.readFileSync('js/app.js','utf8'),/UserProfileCore\.validUsername\(username\)/);
  assert.match(fs.readFileSync('js/profile.js','utf8'),/UserProfileCore\.validUsername\(username\)/);
});


test('community feature modules load before app.js and app only composes them',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const app=fs.readFileSync('js/app.js','utf8');
  const core=html.indexOf('/js/community-core.js?v=');
  const view=html.indexOf('/js/community-view.js?v=');
  const controller=html.indexOf('/js/community-controller.js?v=');
  const appScript=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&view>core&&controller>view&&appScript>controller);
  assert.match(app,/var CommunityView=window\.GroovyCommunityView;/);
  assert.match(app,/var CommunityController=window\.GroovyCommunityController;/);
  assert.match(app,/CommunityController\.create\(\{/);
  assert.doesNotMatch(app,/function similarCollectors|function activityFeed|function topCollectors|function wishlistedAlbums/);
});


test('artist page modules load before app.js in dependency order',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const core=html.indexOf('/js/artist-core.js?v=');
  const wikipedia=html.indexOf('/js/artist-wikipedia-service.js?v=');
  const view=html.indexOf('/js/artist-view.js?v=');
  const controller=html.indexOf('/js/artist-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(core>=0&&wikipedia>core&&view>wikipedia&&controller>view&&app>controller);
});
