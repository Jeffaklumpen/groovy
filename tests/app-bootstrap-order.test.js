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

test('index cache-busts the repaired app bundle',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/\/js\/app\.js\?v=131/);
});
