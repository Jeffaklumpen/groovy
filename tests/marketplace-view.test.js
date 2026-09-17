const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const View=require('../js/marketplace-view.js');

function classListMock(){
  const values=new Set();
  return {
    add(...names){names.forEach(name=>values.add(name));},
    remove(...names){names.forEach(name=>values.delete(name));},
    contains(name){return values.has(name);},
    values
  };
}

function priceElements(){
  return {
    summary:{classList:classListMock()},
    link:{hidden:false,href:'https://example.com/old'},
    price:{textContent:'old price'},
    meta:{textContent:'old meta'},
    status:{hidden:true,textContent:'old status'},
    note:{textContent:'old note'}
  };
}

test('syncCurrencyControl labels auto and keeps only supported preferences',()=>{
  const auto={value:'auto',textContent:'Auto'};
  const eur={value:'EUR',textContent:'EUR'};
  const select={
    value:'',
    options:[auto,eur],
    querySelector:selector=>selector==='option[value="auto"]'?auto:null
  };
  View.syncCurrencyControl(select,'EUR','SEK');
  assert.equal(auto.textContent,'Auto · SEK');
  assert.equal(select.value,'EUR');
  View.syncCurrencyControl(select,'USD','SEK');
  assert.equal(select.value,'auto');
});

test('price summary clear and loading states preserve legacy UI behavior',()=>{
  const clear=priceElements();
  clear.summary.classList.add('ready');
  View.applyPriceSummaryState(clear,'clear');
  assert.equal(clear.summary.classList.values.size,0);
  assert.equal(clear.link.hidden,true);
  assert.equal(clear.link.href,'#');
  assert.equal(clear.price.textContent,'');
  assert.equal(clear.meta.textContent,'');
  assert.equal(clear.status.hidden,false);
  assert.equal(clear.status.textContent,'Checking fixed prices…');
  assert.equal(clear.note.textContent,'Excl. shipping');

  const loading=priceElements();
  View.applyPriceSummaryState(loading,'loading');
  assert.equal(loading.summary.classList.contains('loading'),true);
  assert.equal(loading.link.hidden,true);
  assert.equal(loading.link.href,'https://example.com/old');
  assert.equal(loading.price.textContent,'old price');
  assert.equal(loading.meta.textContent,'old meta');
  assert.equal(loading.status.textContent,'Checking fixed prices…');
});

test('price summary empty partial and ready states preserve marketplace copy',()=>{
  const empty=priceElements();
  View.applyPriceSummaryState(empty,'empty');
  assert.equal(empty.summary.classList.contains('empty'),true);
  assert.equal(empty.link.hidden,true);
  assert.equal(empty.status.hidden,false);
  assert.equal(empty.status.textContent,'No Buy Now prices found');
  assert.equal(empty.note.textContent,'Auctions are not included');

  const partial=priceElements();
  View.applyPriceSummaryState(partial,'partial',{label:'Tradera 100 kr · eBay $20'});
  assert.equal(partial.summary.classList.contains('partial'),true);
  assert.equal(partial.link.hidden,true);
  assert.equal(partial.status.textContent,'Tradera 100 kr · eBay $20');
  assert.equal(partial.note.textContent,'Currency conversion unavailable');

  const ready=priceElements();
  View.applyPriceSummaryState(ready,'ready',{
    priceLabel:'149 kr',
    metaLabel:'Tradera',
    url:'https://example.com/best'
  });
  assert.equal(ready.summary.classList.contains('ready'),true);
  assert.equal(ready.status.hidden,true);
  assert.equal(ready.price.textContent,'149 kr');
  assert.equal(ready.meta.textContent,'Tradera');
  assert.equal(ready.link.href,'https://example.com/best');
  assert.equal(ready.link.hidden,false);
  assert.equal(ready.note.textContent,'Excl. shipping');
});

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

test('marketplace view stays behind controller and app delegates marketplace orchestration',()=>{
  const root=path.resolve(__dirname,'..');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const controllerSource=fs.readFileSync(path.join(root,'js','marketplace-controller.js'),'utf8');
  const coreIndex=index.indexOf('/js/marketplace-core.js');
  const viewIndex=index.indexOf('/js/marketplace-view.js');
  const controllerIndex=index.indexOf('/js/marketplace-controller.js');
  const appIndex=index.indexOf('/js/app.js');
  assert.ok(coreIndex>=0&&viewIndex>coreIndex&&controllerIndex>viewIndex&&appIndex>controllerIndex);
  assert.match(controllerSource,/View\.openListingsModal/);
  assert.match(controllerSource,/View\.applyButtonState/);
  assert.match(app,/var MarketplaceController=window\.GroovyMarketplaceController;/);
  assert.match(app,/MarketplaceController\.create\(\{/);
  assert.doesNotMatch(app,/MarketplaceView\./);
  assert.doesNotMatch(app,/MarketplaceCore\./);
  assert.doesNotMatch(app,/function loadTraderaListings|function loadEbayListings/);
});
