const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/marketplace-controller.js');

function classListMock(initial){
  const values=new Set(initial||[]);
  return {
    add(...names){names.forEach(name=>values.add(name));},
    remove(...names){names.forEach(name=>values.delete(name));},
    contains(name){return values.has(name);},
    values
  };
}

function elementMock(attrs){
  attrs=attrs||{};
  const listeners={};
  return {
    hidden:false,
    href:'#',
    textContent:'',
    innerHTML:'',
    value:'auto',
    options:[],
    classList:classListMock(),
    attributes:Object.assign({},attrs),
    addEventListener(type,handler){listeners[type]=handler;},
    dispatch(type,event){if(listeners[type])return listeners[type].call(this,event||{target:this,preventDefault(){},stopPropagation(){}});},
    getAttribute(name){return this.attributes[name]||null;},
    setAttribute(name,value){this.attributes[name]=String(value);},
    querySelector(){return null;},
    focus(){this.focused=true;}
  };
}

function currencySelectMock(){
  const select=elementMock();
  const auto={value:'auto',textContent:'Auto'};
  const sek={value:'SEK',textContent:'SEK'};
  const eur={value:'EUR',textContent:'EUR'};
  select.options=[auto,sek,eur];
  select.querySelector=selector=>selector==='option[value="auto"]'?auto:null;
  return select;
}

function fixture(options){
  options=options||{};
  const traderaButton=elementMock();
  const ebayButton=elementMock({'data-enabled':options.ebayEnabled?'true':'false'});
  const elements={
    currencySelect:currencySelectMock(),
    priceSummary:elementMock(),
    lowestPriceLink:elementMock(),
    lowestPrice:elementMock(),
    lowestMeta:elementMock(),
    priceStatus:elementMock(),
    priceNote:elementMock(),
    traderaButton,
    traderaButtonLabel:elementMock(),
    traderaModal:elementMock(),
    closeTraderaModalButton:elementMock(),
    traderaModalSubtitle:elementMock(),
    traderaListingsStatus:elementMock(),
    traderaListingsGrid:elementMock(),
    ebayButton,
    ebayButtonLabel:elementMock(),
    ebayModal:elementMock(),
    closeEbayModalButton:elementMock(),
    ebayModalSubtitle:elementMock(),
    ebayListingsStatus:elementMock(),
    ebayListingsGrid:elementMock()
  };
  const records=options.records||[{artist:'Pink Floyd',title:'Animals'}];
  const calls=[];
  const storageData=new Map();
  const storage={
    getItem:key=>storageData.has(key)?storageData.get(key):null,
    setItem:(key,value)=>storageData.set(key,String(value))
  };
  const api={functions:{invoke:async(name,payload)=>{
    calls.push({name,payload});
    if(options.invoke)return options.invoke(name,payload);
    return {data:{listings:[{title:'Pink Floyd Animals LP',buyNowPrice:name==='tradera-search'?100:20,currency:'SEK',url:'https://example.com/'+name}]}};
  }}};
  const controller=Controller.create({
    api,
    elements,
    getRecord:index=>records[index]||null,
    recordModel:{artist:record=>record&&record.artist||'',title:record=>record&&record.title||''},
    storage,
    navigator:options.navigator||{languages:['sv-SE'],language:'sv-SE'},
    Intl,
    request:async()=>({ok:true,json:async()=>({rate:1})}),
    onLog:()=>{}
  });
  return {controller,elements,calls,storageData};
}

test('openForRecord loads Tradera only when eBay is disabled',async()=>{
  const {controller,elements,calls}=fixture({ebayEnabled:false});
  await controller.openForRecord(0);
  assert.deepEqual(calls.map(call=>call.name),['tradera-search']);
  assert.equal(elements.ebayButton.hidden,true);
  const state=controller.state();
  assert.equal(state.traderaFinished,true);
  assert.equal(state.ebayFinished,true);
  assert.equal(state.traderaListings.length,1);
  assert.equal(state.ebayListings.length,0);
});

test('openForRecord orchestrates both marketplaces when eBay is enabled',async()=>{
  const {controller,elements,calls}=fixture({ebayEnabled:true});
  await controller.openForRecord(0);
  assert.deepEqual(calls.map(call=>call.name).sort(),['ebay-search','tradera-search']);
  assert.equal(elements.ebayButton.hidden,false);
  const state=controller.state();
  assert.equal(state.traderaFinished,true);
  assert.equal(state.ebayFinished,true);
  assert.equal(state.traderaListings.length,1);
  assert.equal(state.ebayListings.length,1);
});

test('close cancels late listing responses and clears controller state',async()=>{
  let resolveRequest;
  const pendingResponse=new Promise(resolve=>{resolveRequest=resolve;});
  const {controller}=fixture({ebayEnabled:false,invoke:()=>pendingResponse});
  const pending=controller.openForRecord(0);
  controller.close();
  resolveRequest({data:{listings:[{title:'Late result',buyNowPrice:10,currency:'SEK'}]}});
  await pending;
  const state=controller.state();
  assert.equal(state.priceAlbumIndex,-1);
  assert.deepEqual(state.traderaListings,[]);
  assert.equal(state.traderaFinished,false);
});

test('currency changes persist the preference through the controller',()=>{
  const {elements,storageData}=fixture({ebayEnabled:false});
  elements.currencySelect.value='EUR';
  elements.currencySelect.dispatch('change',{target:elements.currencySelect});
  assert.equal(storageData.get('groovy-marketplace-currency-v1'),'EUR');
  assert.equal(elements.currencySelect.value,'EUR');
});

test('handleEscape closes eBay before Tradera and reports whether it handled the key',()=>{
  const {controller,elements}=fixture({ebayEnabled:true});
  elements.traderaModal.classList.add('visible');
  elements.ebayModal.classList.add('visible');
  assert.equal(controller.handleEscape(),true);
  assert.equal(elements.ebayModal.classList.contains('visible'),false);
  assert.equal(elements.traderaModal.classList.contains('visible'),true);
  assert.equal(controller.handleEscape(),true);
  assert.equal(elements.traderaModal.classList.contains('visible'),false);
  assert.equal(controller.handleEscape(),false);
});


test('eBay request targets the browser marketplace instead of a fixed German site',async()=>{
  const swedish=fixture({ebayEnabled:true});
  await swedish.controller.openForRecord(0);
  const seCall=swedish.calls.find(call=>call.name==='ebay-search');
  assert.equal(seCall.payload.body.marketplaceId,'EBAY_US');

  const german=fixture({ebayEnabled:true,navigator:{languages:['de-DE'],language:'de-DE'}});
  await german.controller.openForRecord(0);
  const deCall=german.calls.find(call=>call.name==='ebay-search');
  assert.equal(deCall.payload.body.marketplaceId,'EBAY_DE');

  const british=fixture({ebayEnabled:true,navigator:{languages:['en-GB'],language:'en-GB'}});
  await british.controller.openForRecord(0);
  const gbCall=british.calls.find(call=>call.name==='ebay-search');
  assert.equal(gbCall.payload.body.marketplaceId,'EBAY_GB');
});


test('opens marketplace listings for an arbitrary record from the Price Alerts page',async()=>{
  const {controller,elements,calls}=fixture({ebayEnabled:true,records:[]});
  const record={artist:'Nirvana',title:'Nevermind'};

  assert.equal(await controller.openMarketplaceForRecord(record,'Tradera'),true);
  assert.equal(elements.traderaModal.classList.contains('visible'),true);
  assert.equal(calls.at(-1).name,'tradera-search');
  assert.equal(calls.at(-1).payload.body.artist,'Nirvana');

  controller.closeTradera();
  assert.equal(await controller.openMarketplaceForRecord(record,'eBay'),true);
  assert.equal(elements.ebayModal.classList.contains('visible'),true);
  assert.equal(calls.at(-1).name,'ebay-search');
});


test('opens the Price Alerts marketplace modal immediately while listings load',async()=>{
  let resolveRequest;
  const pendingResponse=new Promise(resolve=>{resolveRequest=resolve;});
  const {controller,elements}=fixture({
    ebayEnabled:true,
    records:[],
    invoke:(name)=>name==='ebay-search'?pendingResponse:{data:{listings:[]}}
  });
  const record={artist:'Nirvana',title:'Nevermind'};
  const pending=controller.openMarketplaceForRecord(record,'eBay');
  assert.equal(elements.ebayModal.classList.contains('visible'),true);
  assert.equal(elements.ebayListingsStatus.classList.contains('loading'),false);
  assert.equal(elements.ebayListingsStatus.className,'tradera-listings-status loading');
  assert.match(elements.ebayListingsStatus.textContent,/Finding active listings/);
  assert.equal(elements.ebayListingsGrid.innerHTML,'');
  resolveRequest({data:{listings:[{title:'Nirvana Nevermind vinyl LP',buyNowPrice:250,currency:'SEK',url:'https://example.com/ebay'}]}});
  assert.equal(await pending,true);
  assert.match(elements.ebayListingsGrid.innerHTML,/Nirvana Nevermind vinyl LP/);
});
