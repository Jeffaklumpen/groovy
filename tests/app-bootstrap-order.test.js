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

test('pure dependency scripts load before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(app>=0,'app.js script is missing');
  ['/js/notification-core.js?v=','/js/pressing-core.js?v=','/js/rating-core.js?v=','/js/marketplace-core.js?v=','/js/shelf-core.js?v=','/js/library-core.js?v=','/js/apple-search-core.js?v='].forEach((script)=>{
    const pos=html.indexOf(script);
    assert.ok(pos>=0,script+' script is missing');
    assert.ok(pos<app,script+' must load before app.js');
  });
  assert.match(html,/\/js\/app\.js\?v=\d+/);
});

test('Apple search core is initialized before first use in app.js',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var AppleSearchCore=window.GroovyAppleSearchCore;');
  const firstUse=source.indexOf('AppleSearchCore.');
  assert.ok(declaration>=0,'AppleSearchCore bootstrap declaration is missing');
  assert.ok(firstUse>=0,'AppleSearchCore first use is missing');
  assert.ok(declaration<firstUse,'AppleSearchCore must be initialized before it is used');
});

test('shelf core is initialized before first shelf helper use in app.js',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var ShelfCore=window.GroovyShelfCore;');
  const firstUse=source.indexOf('ShelfCore.ICON_OPTIONS');
  assert.ok(declaration>=0,'ShelfCore bootstrap declaration is missing');
  assert.ok(firstUse>=0,'ShelfCore first icon use is missing');
  assert.ok(declaration<firstUse,'ShelfCore must be initialized before icon helpers are used');
});

test('library core is initialized before library filtering in app.js',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const declaration=source.indexOf('var LibraryCore=window.GroovyLibraryCore;');
  const firstUse=source.indexOf('LibraryCore.filterRecords');
  assert.ok(declaration>=0,'LibraryCore bootstrap declaration is missing');
  assert.ok(firstUse>=0,'LibraryCore first use is missing');
  assert.ok(declaration<firstUse,'LibraryCore must be initialized before library helpers are used');
});

