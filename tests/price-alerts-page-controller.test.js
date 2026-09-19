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
    hidden:true,innerHTML:'',textContent:'',attributes:{},listeners,
    classList:classListMock(),
    addEventListener(type,fn){listeners[type]=fn;},
    setAttribute(name,value){this.attributes[name]=String(value);}
  };
}

test('renders active alerts with marketplace state and streaming badges',async()=>{
  const page=element();const grid=element();const count=element();const menu=element();const back=element();
  const body={classList:classListMock()};
  const rows=[{
    id:1,album_id:99,max_price:1000,currency:'SEK',
    tradera_enabled:true,ebay_enabled:true,fixed_price:true,auction:true,
    albums:{id:99,title:'Abbey Road',cover_url:'https://example.com/cover.jpg',apple_collection_url:'https://music.apple.com/album/1',artists:{name:'The Beatles'}},
    marketplace_alert_market_state:[
      {marketplace:'Tradera',listing_count:8,listing_count_capped:false,lowest_price:349,currency:'SEK',checked_at:new Date().toISOString()},
      {marketplace:'eBay',listing_count:60,listing_count_capped:true,lowest_price:412,currency:'SEK',checked_at:new Date().toISOString()}
    ]
  }];
  const query={
    select(){return this;},eq(){return this;},
    async order(){return {data:rows,error:null};}
  };
  const controller=Controller.create({
    api:{from(){return query;}},
    elements:{page,grid,count,menuButton:menu,backButton:back,profileMenu:{classList:classListMock()}},
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
  assert.match(grid.innerHTML,/apple-music-badge-small\.svg/);
  assert.match(grid.innerHTML,/spotify-full-logo-green\.svg/);
  assert.equal(count.textContent,'1 ACTIVE ALERT');
});
