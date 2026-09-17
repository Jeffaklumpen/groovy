const fs=require('node:fs');

const appPath='js/app.js';
const corePath='js/marketplace-core.js';
const testPath='tests/marketplace-core.test.js';
let app=fs.readFileSync(appPath,'utf8');
let core=fs.readFileSync(corePath,'utf8');
let tests=fs.readFileSync(testPath,'utf8');

const coreAnchor=`  async function resolveBestPrice(candidates,target,getRate,locale,shouldCancel){`;
if(!core.includes(coreAnchor))throw new Error('Marketplace core insertion anchor not found');
if(core.includes('function createListingLoader(options)'))throw new Error('Listing loader already extracted');

const loader=`  function createListingLoader(options){
    options=options||{};
    var cache=options.cache&&typeof options.cache.get==='function'&&typeof options.cache.set==='function'?options.cache:new Map();
    var request=typeof options.request==='function'?options.request:null;
    var filter=typeof options.filter==='function'?options.filter:function(){return true;};
    var now=typeof options.now==='function'?options.now:Date.now;
    var ttl=Number(options.ttlMs)||5*60*1000;

    return function(input){
      input=input||{};
      var key=String(input.key||'');
      var cached=cache.get(key);
      var currentTime=now();
      if(cached&&currentTime-Number(cached.savedAt)<ttl){
        var cachedListings=Array.isArray(cached.listings)?cached.listings:[];
        return {state:cachedListings.length?'ready':'empty',listings:cachedListings,cached:true};
      }

      if(typeof input.onLoading==='function')input.onLoading();
      var pending;
      try{
        if(!request)throw new Error('Marketplace request unavailable');
        pending=request(input.record);
      }catch(error){
        if(input.isCancelled&&input.isCancelled())return {state:'cancelled',listings:[]};
        return {state:'unavailable',listings:[],cached:false,error:error};
      }

      return Promise.resolve(pending).then(function(response){
        if(input.isCancelled&&input.isCancelled())return {state:'cancelled',listings:[]};
        if(response&&response.error)throw response.error;
        var rows=response&&response.data&&Array.isArray(response.data.listings)?response.data.listings:[];
        var listings=rows.filter(function(listing){return filter(listing,input.record);});
        cache.set(key,{savedAt:now(),listings:listings});
        return {state:listings.length?'ready':'empty',listings:listings,cached:false};
      }).catch(function(error){
        if(input.isCancelled&&input.isCancelled())return {state:'cancelled',listings:[]};
        return {state:'unavailable',listings:[],cached:false,error:error};
      });
    };
  }

`;
core=core.replace(coreAnchor,loader+coreAnchor);
const exportAnchor=`    createFxRateLoader:createFxRateLoader,\n    resolveBestPrice:resolveBestPrice,`;
if(!core.includes(exportAnchor))throw new Error('Marketplace core export anchor not found');
core=core.replace(exportAnchor,`    createFxRateLoader:createFxRateLoader,\n    createListingLoader:createListingLoader,\n    resolveBestPrice:resolveBestPrice,`);

const fxAnchor=`var marketplaceFxRate=MarketplaceCore.createFxRateLoader({
  cache:marketplaceFxCache,
  getStored:function(key){try{return localStorage.getItem(key);}catch(error){return null;}},
  setStored:function(key,value){try{localStorage.setItem(key,value);}catch(error){}},
  request:function(url,options){return fetch(url,options);}
});

`;
if(!app.includes(fxAnchor))throw new Error('Marketplace FX anchor not found in app.js');
const listingLoaders=`var loadTraderaListingData=MarketplaceCore.createListingLoader({
  cache:traderaListingCache,
  request:function(record){
    return supabaseClient.functions.invoke('tradera-search',{body:{artist:record[1],album:record[2]}});
  },
  filter:function(listing,record){return isRelevantTraderaListing(listing,record);}
});

var loadEbayListingData=MarketplaceCore.createListingLoader({
  cache:ebayListingCache,
  request:function(record){
    return supabaseClient.functions.invoke('ebay-search',{body:{artist:record[1],album:record[2]}});
  },
  filter:function(listing,record){return isRelevantTraderaListing(listing,record);}
});

`;
app=app.replace(fxAnchor,fxAnchor+listingLoaders);

const oldTradera=`async function loadTraderaListings(record,index){
  traderaAlbumIndex=index;
  traderaListings=[];
  var requestVersion=++traderaRequestVersion;
  var key=traderaCacheKey(record);
  var cached=traderaListingCache.get(key);

  if(cached&&Date.now()-cached.savedAt<5*60*1000){
    traderaListings=cached.listings;
    setTraderaButtonState(traderaListings.length?'ready':'empty',traderaListings.length);
    marketplacePriceFinished.tradera=true;
    refreshMarketplaceBestPrice(index);
    return;
  }

  setTraderaButtonState('loading',0);

  try{
    var response=await supabaseClient.functions.invoke('tradera-search',{
      body:{artist:record[1],album:record[2]}
    });

    if(requestVersion!==traderaRequestVersion)return;
    if(response.error)throw response.error;

    traderaListings=response.data&&Array.isArray(response.data.listings)
      ?response.data.listings.filter(function(listing){return isRelevantTraderaListing(listing,record);})
      :[];
    traderaListingCache.set(key,{savedAt:Date.now(),listings:traderaListings});
    setTraderaButtonState(traderaListings.length?'ready':'empty',traderaListings.length);
  }catch(error){
    if(requestVersion!==traderaRequestVersion)return;
    console.error('Could not load Tradera listings:',error);
    traderaListings=[];
    setTraderaButtonState('unavailable',0);
  }

  marketplacePriceFinished.tradera=true;
  refreshMarketplaceBestPrice(index);

  if(traderaModal.classList.contains('visible')&&traderaAlbumIndex===index){
    openTraderaModal();
  }
}`;
const newTradera=`async function loadTraderaListings(record,index){
  traderaAlbumIndex=index;
  traderaListings=[];
  var requestVersion=++traderaRequestVersion;
  var result=loadTraderaListingData({
    key:traderaCacheKey(record),
    record:record,
    isCancelled:function(){return requestVersion!==traderaRequestVersion;},
    onLoading:function(){setTraderaButtonState('loading',0);}
  });
  if(result&&typeof result.then==='function')result=await result;
  if(!result||result.state==='cancelled')return;

  traderaListings=result.listings||[];
  if(result.state==='unavailable')console.error('Could not load Tradera listings:',result.error);
  setTraderaButtonState(result.state,traderaListings.length);
  marketplacePriceFinished.tradera=true;
  refreshMarketplaceBestPrice(index);

  if(traderaModal.classList.contains('visible')&&traderaAlbumIndex===index)openTraderaModal();
}`;
if(!app.includes(oldTradera))throw new Error('Exact Tradera loader block not found');
app=app.replace(oldTradera,newTradera);

const oldEbay=`async function loadEbayListings(record,index){
  ebayAlbumIndex=index;
  ebayListings=[];
  var requestVersion=++ebayRequestVersion;
  var key=traderaCacheKey(record);
  var cached=ebayListingCache.get(key);

  if(cached&&Date.now()-cached.savedAt<5*60*1000){
    ebayListings=cached.listings;
    setEbayButtonState(ebayListings.length?'ready':'empty',ebayListings.length);
    marketplacePriceFinished.ebay=true;
    refreshMarketplaceBestPrice(index);
    return;
  }

  setEbayButtonState('loading',0);

  try{
    var response=await supabaseClient.functions.invoke('ebay-search',{
      body:{artist:record[1],album:record[2]}
    });

    if(requestVersion!==ebayRequestVersion)return;
    if(response.error)throw response.error;

    ebayListings=response.data&&Array.isArray(response.data.listings)
      ?response.data.listings.filter(function(listing){return isRelevantTraderaListing(listing,record);})
      :[];
    ebayListingCache.set(key,{savedAt:Date.now(),listings:ebayListings});
    setEbayButtonState(ebayListings.length?'ready':'empty',ebayListings.length);
  }catch(error){
    if(requestVersion!==ebayRequestVersion)return;
    console.error('Could not load eBay listings:',error);
    ebayListings=[];
    setEbayButtonState('unavailable',0);
  }

  marketplacePriceFinished.ebay=true;
  refreshMarketplaceBestPrice(index);

  if(ebayModal.classList.contains('visible')&&ebayAlbumIndex===index){
    openEbayModal();
  }
}`;
const newEbay=`async function loadEbayListings(record,index){
  ebayAlbumIndex=index;
  ebayListings=[];
  var requestVersion=++ebayRequestVersion;
  var result=loadEbayListingData({
    key:traderaCacheKey(record),
    record:record,
    isCancelled:function(){return requestVersion!==ebayRequestVersion;},
    onLoading:function(){setEbayButtonState('loading',0);}
  });
  if(result&&typeof result.then==='function')result=await result;
  if(!result||result.state==='cancelled')return;

  ebayListings=result.listings||[];
  if(result.state==='unavailable')console.error('Could not load eBay listings:',result.error);
  setEbayButtonState(result.state,ebayListings.length);
  marketplacePriceFinished.ebay=true;
  refreshMarketplaceBestPrice(index);

  if(ebayModal.classList.contains('visible')&&ebayAlbumIndex===index)openEbayModal();
}`;
if(!app.includes(oldEbay))throw new Error('Exact eBay loader block not found');
app=app.replace(oldEbay,newEbay);

if(!tests.includes("test('createListingLoader keeps fresh cache results synchronous'")){
  tests+=`\n\ntest('createListingLoader keeps fresh cache results synchronous',async()=>{\n  const cache=new Map([['album',{savedAt:900,listings:[{title:'Cached'}]}]]);\n  let calls=0;\n  const load=Marketplace.createListingLoader({cache,now:()=>1000,request:async()=>{calls++;return {data:{listings:[]}};}});\n  const result=load({key:'album',record:{}});\n  assert.equal(typeof result.then,'undefined');\n  assert.equal(result.state,'ready');\n  assert.equal(result.cached,true);\n  assert.equal(result.listings[0].title,'Cached');\n  assert.equal(calls,0);\n});\n\ntest('createListingLoader requests filters and caches marketplace listings',async()=>{\n  const cache=new Map();\n  let loading=0;\n  let calls=0;\n  const record={artist:'Pink Floyd'};\n  const load=Marketplace.createListingLoader({\n    cache,\n    now:()=>5000,\n    request:async input=>{calls++;assert.equal(input,record);return {data:{listings:[{title:'Keep'},{title:'Skip'}]}};},\n    filter:listing=>listing.title!=='Skip'\n  });\n  const pending=load({key:'pink floyd|animals',record,onLoading:()=>loading++});\n  assert.equal(typeof pending.then,'function');\n  const result=await pending;\n  assert.equal(result.state,'ready');\n  assert.deepEqual(result.listings,[{title:'Keep'}]);\n  assert.equal(result.cached,false);\n  assert.equal(loading,1);\n  assert.equal(calls,1);\n  assert.deepEqual(cache.get('pink floyd|animals').listings,[{title:'Keep'}]);\n});\n\ntest('createListingLoader preserves unavailable and cancelled states',async()=>{\n  const failed=Marketplace.createListingLoader({request:async()=>({error:new Error('offline')})});\n  const failedResult=await failed({key:'x',record:{}});\n  assert.equal(failedResult.state,'unavailable');\n  assert.match(failedResult.error.message,/offline/);\n\n  const cancelled=Marketplace.createListingLoader({request:async()=>({data:{listings:[{title:'Late'}]}})});\n  const cancelledResult=await cancelled({key:'y',record:{},isCancelled:()=>true});\n  assert.equal(cancelledResult.state,'cancelled');\n  assert.deepEqual(cancelledResult.listings,[]);\n});\n`;
}

fs.writeFileSync(appPath,app);
fs.writeFileSync(corePath,core);
fs.writeFileSync(testPath,tests);
console.log('Marketplace listing loader extraction applied. app.js is now '+Buffer.byteLength(app)+' bytes.');
