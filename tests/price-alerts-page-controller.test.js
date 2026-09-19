const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/price-alerts-page-controller.js');

function classListMock(){
  const values=new Set();
  return {
    add(...names){names.forEach(name=>values.add(name));},
    remove(...names){names.forEach(name=>values.delete(name));},
    contains(name){return values.has(name);}
  };
}

function element(){
  const listeners={};
  return {
    hidden:true,innerHTML:'',textContent:'',checked:false,attributes:{},listeners,
    classList:classListMock(),
    addEventListener(type,fn){listeners[type]=fn;},
    setAttribute(name,value){this.attributes[name]=String(value);}
  };
}

test('renders active alerts with marketplace state and streaming badges',async()=>{
  const page=element();const grid=element();const count=element();const menu=element();const back=element();const traderaToggle=element();const ebayToggle=element();const currencySelect=element();
  currencySelect.value='auto';
  currencySelect.querySelector=()=>null;
  const body={classList:classListMock()};
  const rows=[{
    id:1,album_id:99,max_price:1000,currency:'SEK',
    tradera_enabled:true,ebay_enabled:true,fixed_price:true,auction:true,
    albums:{id:99,title:'Abbey Road',cover_url:'https://example.com/cover.jpg',apple_collection_url:'https://music.apple.com/album/1',artists:{name:'The Beatles'}},
    marketplace_alert_market_state:[
      {marketplace:'Tradera',listing_count:8,listing_count_capped:false,lowest_price:349,lowest_listing_url:'https://tradera.example/lowest',currency:'SEK',checked_at:new Date().toISOString()},
      {marketplace:'eBay',listing_count:60,listing_count_capped:true,lowest_price:412,lowest_listing_url:'https://ebay.example/lowest',currency:'SEK',checked_at:new Date().toISOString()}
    ]
  }];
  const query={
    select(){return this;},eq(){return this;},
    async order(){return {data:rows,error:null};}
  };
  const controller=Controller.create({
    api:{from(){return query;}},
    elements:{page,grid,count,menuButton:menu,backButton:back,traderaToggle,ebayToggle,currencySelect,profileMenu:{classList:classListMock()}},
    document:{body},
    navigator:{languages:['sv-SE']},
    getCurrentUser:async()=>({id:'user-1'})
  });

  await controller.renderPage();
  assert.equal(page.hidden,false);
  assert.equal(body.classList.contains('price-alerts-page-open'),true);
  assert.match(grid.innerHTML,/Abbey Road/);
  assert.match(grid.innerHTML,/The Beatles/);
  assert.match(grid.innerHTML,/8 listings/);
  assert.match(grid.innerHTML,/60\+ listings/);
  assert.match(grid.innerHTML,/https:\/\/tradera\.example\/lowest/);
  assert.match(grid.innerHTML,/data-price-alert-market="Tradera"/);
  assert.equal(traderaToggle.checked,true);
  assert.equal(ebayToggle.checked,true);
  assert.match(grid.innerHTML,/apple-music-badge-small\.svg/);
  assert.match(grid.innerHTML,/spotify-full-logo-green\.svg/);
  assert.equal(count.textContent,'1 ACTIVE ALERT');
});


test('persists marketplace visibility and never hides both marketplaces',async()=>{
  const page=element();const grid=element();const count=element();const traderaToggle=element();const ebayToggle=element();
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value))};
  const query={select(){return this;},eq(){return this;},async order(){return {data:[],error:null};}};
  const controller=Controller.create({
    api:{from(){return query;}},
    elements:{page,grid,count,traderaToggle,ebayToggle,profileMenu:{classList:classListMock()}},
    document:{body:{classList:classListMock()}},
    navigator:{languages:['en-US'],language:'en-US'},
    storage,
    getCurrentUser:async()=>({id:'user-1'})
  });
  await controller.renderPage();
  assert.equal(traderaToggle.checked,false);
  assert.equal(ebayToggle.checked,true);

  ebayToggle.checked=false;
  ebayToggle.listeners.change.call(ebayToggle);
  assert.equal(ebayToggle.checked,true);
  assert.equal(controller.state().marketVisibility.eBay,true);

  traderaToggle.checked=true;
  traderaToggle.listeners.change.call(traderaToggle);
  assert.equal(controller.state().marketVisibility.Tradera,true);
  assert.match(data.get('groovy-price-alert-marketplace-visibility-v1'),/"Tradera":true/);
});


test('converts every displayed price with one Price Alerts currency selector',async()=>{
  const page=element();const grid=element();const count=element();const currencySelect=element();
  currencySelect.value='auto';currencySelect.querySelector=()=>null;
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value))};
  const rows=[{
    id:2,album_id:88,max_price:1000,currency:'SEK',
    tradera_enabled:true,ebay_enabled:true,fixed_price:true,auction:true,
    albums:{id:88,title:'Nevermind',cover_url:'',apple_collection_url:'',artists:{name:'Nirvana'}},
    marketplace_alert_market_state:[
      {marketplace:'eBay',listing_count:2,listing_count_capped:false,lowest_price:500,lowest_listing_url:'https://example.com/ebay',currency:'SEK',checked_at:new Date().toISOString()},
      {marketplace:'Tradera',listing_count:1,listing_count_capped:false,lowest_price:750,lowest_listing_url:'https://example.com/tradera',currency:'SEK',checked_at:new Date().toISOString()}
    ]
  }];
  const query={select(){return this;},eq(){return this;},async order(){return {data:rows,error:null};}};
  const controller=Controller.create({
    api:{from(){return query;}},
    elements:{page,grid,count,currencySelect,profileMenu:{classList:classListMock()}},
    document:{body:{classList:classListMock()}},
    navigator:{languages:['sv-SE'],language:'sv-SE'},
    storage,
    request:async()=>({ok:true,json:async()=>({rate:0.1})}),
    getCurrentUser:async()=>({id:'user-1'})
  });
  await controller.renderPage();
  assert.match(grid.innerHTML,/1[\s\u00a0]?000/);

  currencySelect.value='EUR';
  await currencySelect.listeners.change.call(currencySelect);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(controller.state().currencyPreference,'EUR');
  assert.match(data.get('groovy-price-alert-currency-v1'),/EUR/);
  assert.match(grid.innerHTML,/100/);
  assert.match(grid.innerHTML,/50/);
  assert.match(grid.innerHTML,/75/);
});

test('renders eBay before Tradera and makes the whole marketplace card interactive',async()=>{
  const source=require('fs').readFileSync(require('path').join(__dirname,'..','js','price-alerts-page-controller.js'),'utf8');
  assert.ok(source.indexOf("serviceMarkup('eBay'")<source.indexOf("serviceMarkup('Tradera'"));
  assert.match(source,/role="button" tabindex="0" data-price-alert-market/);
  assert.match(source,/closest\('\.price-alert-lowest-link'\)/);
});


test('opens album previews and supports bulk selection controls',()=>{
  const fs=require('fs'),path=require('path');
  const source=fs.readFileSync(path.join(__dirname,'..','js','price-alerts-page-controller.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
  assert.match(source,/data-price-alert-album/);
  assert.match(source,/onOpenAlbum\(albumAlert,albumOf\(albumAlert\)\)/);
  assert.match(source,/selectedAlertIds=new Set\(\)/);
  assert.match(source,/data-price-alert-select/);
  assert.match(source,/async function deleteSelected/);
  assert.match(html,/id="priceAlertsSelectButton"/);
  assert.match(html,/id="priceAlertsDeleteSelectedButton"/);
  assert.match(app,/communityAlbumPreviewHandler\(album\.id\)/);
});

test('active alert count sits before currency and Select sits before Back to My Shelf',()=>{
  const fs=require('fs'),path=require('path');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const start=html.indexOf('class="price-alerts-heading-actions"');
  const end=html.indexOf('</div>',start);
  const block=html.slice(start,end);
  assert.ok(block.indexOf('id="priceAlertsCount"')<block.indexOf('id="priceAlertsCurrencySelect"'));
  assert.ok(block.indexOf('id="priceAlertsSelectButton"')<block.indexOf('id="priceAlertsBackButton"'));
});
