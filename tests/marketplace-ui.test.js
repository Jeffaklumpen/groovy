const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync('js/marketplace-ui.js','utf8');

test('marketplace UI module is valid JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'js/marketplace-ui.js'}));
});

test('marketplace UI module declares its required core dependencies',()=>{
  assert.match(source,/var MarketplaceCore=window\.GroovyMarketplaceCore;/);
  assert.match(source,/var Record=window\.GroovyRecord;/);
  assert.match(source,/GroovyMarketplaceCore must load before marketplace-ui\.js/);
  assert.match(source,/GroovyRecord must load before marketplace-ui\.js/);
});

test('marketplace UI exposes only the controller entry points app.js will need',()=>{
  assert.match(source,/window\.GroovyMarketplaceUI=\{/);
  assert.match(source,/prepareAlbum:prepareAlbum/);
  assert.match(source,/reset:reset/);
  assert.match(source,/closeVisibleModal:closeVisibleModal/);
});
