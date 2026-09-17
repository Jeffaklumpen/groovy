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
  ['/js/notification-core.js?v=','/js/notification-controller.js?v=','/js/pressing-core.js?v=','/js/rating-core.js?v=','/js/marketplace-core.js?v=','/js/marketplace-view.js?v=','/js/marketplace-controller.js?v=','/js/shelf-core.js?v=','/js/shelf-view.js?v=','/js/shelf-controller.js?v=','/js/library-core.js?v=','/js/apple-search-core.js?v=','/js/album-search.js?v='].forEach((script)=>{
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
