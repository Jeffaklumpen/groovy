const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const View=require('../js/marketplace-view.js');

test('buttonState preserves marketplace button labels and classes',()=>{
  assert.deepEqual(View.buttonState('Tradera','loading',0),{className:'loading',label:'Tradera · Checking…'});
  assert.deepEqual(View.buttonState('Tradera','ready',1),{className:'',label:'Tradera · 1 listing'});
  assert.deepEqual(View.buttonState('eBay','ready',3),{className:'',label:'eBay · 3 listings'});
  assert.deepEqual(View.buttonState('eBay','empty',0),{className:'empty',label:'eBay · No listings'});
  assert.deepEqual(View.buttonState('eBay','unavailable',0),{className:'unavailable',label:'eBay · Unavailable'});
});

test('listingCardHtml keeps marketplace markup while escaping unsafe content',()=>{
  const html=View.listingCardHtml({
    title:'<b>Rare & loud</b>',
    buyNowPrice:149,
    currency:'SEK',
    url:'javascript:alert(1)',
    imageUrl:'javascript:alert(2)',
    bidCount:2,
    endDate:'2026-09-17T12:34:00Z'
  },'Tradera','sv-SE');
  assert.match(html,/tradera-listing-card/);
  assert.match(html,/&lt;b&gt;Rare &amp; loud&lt;\/b&gt;/);
  assert.match(html,/2 bids/);
  assert.match(html,/href="#"/);
  assert.match(html,/record-icon/);
  assert.doesNotMatch(html,/javascript:/);
});

test('listingStatus preserves loading ready unavailable and empty copy',()=>{
  assert.deepEqual(View.listingStatus([],'loading','Tradera','x'),{
    className:'tradera-listings-status loading',
    text:'Finding active listings…'
  });
  assert.deepEqual(View.listingStatus([{}],'idle','eBay','x'),{
    className:'tradera-listings-status',
    text:'1 active listing'
  });
  assert.deepEqual(View.listingStatus([],'unavailable','eBay','x'),{
    className:'tradera-listings-status error',
    text:'eBay is temporarily unavailable. Please try again shortly.'
  });
  assert.deepEqual(View.listingStatus([],'idle','Tradera','No active listings found.'),{
    className:'tradera-listings-status empty',
    text:'No active listings found.'
  });
});

test('marketplace view loads before app without becoming a bootstrap requirement',()=>{
  const root=path.resolve(__dirname,'..');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const viewIndex=index.indexOf('/js/marketplace-view.js');
  const appIndex=index.indexOf('/js/app.js');
  assert.ok(viewIndex>=0&&appIndex>viewIndex);
  assert.match(app,/var MarketplaceView=window\.GroovyMarketplaceView;/);
  assert.doesNotMatch(app,/if\(!MarketplaceView\)throw/);
  assert.match(app,/MarketplaceView\.openListingsModal/);
  assert.match(app,/MarketplaceView\.applyButtonState/);
});
