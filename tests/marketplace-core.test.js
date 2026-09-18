const test=require('node:test');
const assert=require('node:assert/strict');
const Marketplace=require('../js/marketplace-core.js');

test('safeExternalUrl allows only http and https URLs',()=>{
  assert.equal(Marketplace.safeExternalUrl('https://example.com/item?id=1'),'https://example.com/item?id=1');
  assert.equal(Marketplace.safeExternalUrl('http://example.com/test'),'http://example.com/test');
  assert.equal(Marketplace.safeExternalUrl('javascript:alert(1)'),'');
  assert.equal(Marketplace.safeExternalUrl('/relative/path'),'');
  assert.equal(Marketplace.safeExternalUrl(''),'');
});

test('buyNowCandidates filters invalid prices and normalizes fields',()=>{
  const good={buyNowPrice:'149.50',currency:'sek',url:'https://example.com/listing/1',title:'Record'};
  const rows=Marketplace.buyNowCandidates([
    good,
    {buyNowPrice:0,currency:'EUR',url:'https://example.com/zero'},
    {buyNowPrice:'nope',currency:'USD',url:'https://example.com/bad'},
    null
  ],'Tradera');
  assert.equal(rows.length,1);
  assert.equal(rows[0].amount,149.5);
  assert.equal(rows[0].currency,'SEK');
  assert.equal(rows[0].marketplace,'Tradera');
  assert.equal(rows[0].url,'https://example.com/listing/1');
  assert.equal(rows[0].listing,good);
});

test('buyNowCandidates defaults missing currency and strips unsafe URL',()=>{
  const rows=Marketplace.buyNowCandidates([{buyNowPrice:10,url:'javascript:alert(1)'}],'eBay');
  assert.equal(rows.length,1);
  assert.equal(rows[0].currency,'EUR');
  assert.equal(rows[0].url,'');
});

test('cacheKey normalizes surrounding whitespace and case',()=>{
  assert.equal(Marketplace.cacheKey('  Pink Floyd ',' The Dark Side Of The Moon  '),'pink floyd|the dark side of the moon');
});

test('normalizeIdentity removes accents punctuation and expands ampersands',()=>{
  assert.equal(Marketplace.normalizeIdentity('Beyoncé & JAY-Z'),'beyonce and jay z');
});

test('isRelevantListing keeps ordinary artist album combinations',()=>{
  assert.equal(Marketplace.isRelevantListing({title:'Pink Floyd Animals LP'},'Pink Floyd','Animals'),true);
});

test('isRelevantListing filters unrelated self-titled listings',()=>{
  assert.equal(Marketplace.isRelevantListing({title:'ABBA LP 1975 Swedish pressing'},'ABBA','ABBA'),true);
  assert.equal(Marketplace.isRelevantListing({title:'ABBA Arrival LP'},'ABBA','ABBA'),false);
});

test('regionCurrency preserves locale mapping and timezone fallback',()=>{
  assert.equal(Marketplace.regionCurrency('sv-SE','Europe/London'),'SEK');
  assert.equal(Marketplace.regionCurrency('en-GB','Europe/Stockholm'),'GBP');
  assert.equal(Marketplace.regionCurrency('en','Europe/Stockholm'),'SEK');
  assert.equal(Marketplace.regionCurrency('en','Europe/Berlin'),'EUR');
  assert.equal(Marketplace.regionCurrency('en','America/Chicago'),'EUR');
});

test('displayCurrency resolves auto and preserves explicit choices',()=>{
  assert.equal(Marketplace.displayCurrency('auto','SEK'),'SEK');
  assert.equal(Marketplace.displayCurrency('EUR','SEK'),'EUR');
  assert.equal(Marketplace.displayCurrency('USD','SEK'),'USD');
});

test('formatMoney keeps marketplace formatting behavior',()=>{
  assert.equal(Marketplace.formatMoney(0,'SEK','sv-SE'),'');
  assert.equal(Marketplace.formatMoney(-1,'SEK','sv-SE'),'');
  assert.match(Marketplace.formatMoney(149.5,'USD','en-US'),/149\.5/);
  assert.doesNotMatch(Marketplace.formatMoney(1234.56,'JPY','en-US'),/\.56/);
});

test('createFxRateLoader caches fetched rates and persists them',async()=>{
  const cache=new Map();
  const writes=new Map();
  let calls=0;
  let now=1000;
  const getRate=Marketplace.createFxRateLoader({
    cache,
    now:()=>now,
    getStored:key=>writes.get(key)||null,
    setStored:(key,value)=>writes.set(key,value),
    request:async(url,options)=>{
      calls++;
      assert.match(url,/\/sek\/eur$/);
      assert.equal(options.headers.Accept,'application/json');
      return {ok:true,json:async()=>({rate:0.087})};
    }
  });

  assert.equal(await getRate('sek','eur'),0.087);
  assert.equal(calls,1);
  assert.ok(writes.has('groovy-fx-v1-SEK-EUR'));
  now+=1000;
  assert.equal(await getRate('SEK','EUR'),0.087);
  assert.equal(calls,1);
  assert.equal(await getRate('EUR','EUR'),1);
});

test('createFxRateLoader restores a fresh persisted rate without a request',async()=>{
  let calls=0;
  const getRate=Marketplace.createFxRateLoader({
    now:()=>5000,
    getStored:key=>key==='groovy-fx-v1-USD-SEK'?JSON.stringify({rate:10.4,savedAt:4500}):null,
    request:async()=>{calls++;return {ok:true,json:async()=>({rate:99})};}
  });
  assert.equal(await getRate('USD','SEK'),10.4);
  assert.equal(calls,0);
});

test('resolveBestPrice converts candidates and picks the cheapest Buy Now offer',async()=>{
  const result=await Marketplace.resolveBestPrice([
    {amount:100,currency:'SEK',marketplace:'Tradera',url:'https://example.com/tradera'},
    {amount:20,currency:'EUR',marketplace:'eBay',url:'https://example.com/ebay'}
  ],'EUR',async(from,to)=>from===to?1:0.08,'en-US');

  assert.equal(result.state,'ready');
  assert.equal(result.best.marketplace,'Tradera');
  assert.equal(result.shownAmount,8);
  assert.equal(result.shownCurrency,'EUR');
  assert.equal(result.url,'https://example.com/tradera');
  assert.match(result.metaLabel,/Tradera/);
});

test('resolveBestPrice reports partial data when one of several conversions fails',async()=>{
  const result=await Marketplace.resolveBestPrice([
    {amount:100,currency:'SEK',marketplace:'Tradera',url:'https://example.com/tradera'},
    {amount:20,currency:'USD',marketplace:'eBay',url:'https://example.com/ebay'}
  ],'EUR',async from=>{
    if(from==='USD')throw new Error('no rate');
    return 0.08;
  },'en-US');

  assert.equal(result.state,'partial');
  assert.match(result.label,/Tradera/);
  assert.match(result.label,/eBay/);
});

test('resolveBestPrice preserves the legacy single-conversion failure behavior',async()=>{
  const result=await Marketplace.resolveBestPrice([
    {amount:149,currency:'SEK',marketplace:'Tradera',url:'https://example.com/tradera'}
  ],'EUR',async()=>{throw new Error('no rate');},'sv-SE');

  assert.equal(result.state,'ready');
  assert.equal(result.shownAmount,null);
  assert.equal(result.shownCurrency,'EUR');
  assert.equal(result.priceLabel,'');
  assert.match(result.metaLabel,/Tradera/);
  assert.match(result.metaLabel,/149/);
});

test('resolveBestPrice supports cancellation between asynchronous conversions',async()=>{
  let cancelled=false;
  const result=await Marketplace.resolveBestPrice([
    {amount:100,currency:'SEK',marketplace:'Tradera',url:'https://example.com/tradera'},
    {amount:20,currency:'EUR',marketplace:'eBay',url:'https://example.com/ebay'}
  ],'EUR',async()=>{cancelled=true;return 0.08;},'en-US',()=>cancelled);
  assert.equal(result.state,'cancelled');
});

test('resolveBestPrice returns an empty state with no candidates',async()=>{
  const result=await Marketplace.resolveBestPrice([], 'SEK', async()=>1, 'sv-SE');
  assert.deepEqual(result,{state:'empty'});
});

test('listingPrice preserves marketplace listing price precedence and formatting',()=>{
  assert.equal(Marketplace.listingPrice({buyNowPrice:0,nextBid:0,currentBid:0,openingBid:0,currency:'SEK'},'sv-SE'),'');
  assert.match(Marketplace.listingPrice({buyNowPrice:149.5,currency:'SEK'},'sv-SE'),/150/);
  assert.match(Marketplace.listingPrice({nextBid:99,currency:'SEK'},'sv-SE'),/99/);
});

test('listingEndsText handles invalid and valid dates',()=>{
  assert.equal(Marketplace.listingEndsText('', 'sv-SE'),'');
  assert.equal(Marketplace.listingEndsText('not-a-date','sv-SE'),'');
  assert.match(Marketplace.listingEndsText('2026-09-17T12:34:00Z','sv-SE'),/^Ends /);
  assert.match(Marketplace.listingEndsText('2026-09-17T12:34:00Z','sv-SE'),/ · /);
});


test('createListingLoader keeps fresh cache results synchronous',async()=>{
  const cache=new Map([['album',{savedAt:900,listings:[{title:'Cached'}]}]]);
  let calls=0;
  const load=Marketplace.createListingLoader({cache,now:()=>1000,request:async()=>{calls++;return {data:{listings:[]}};}});
  const result=load({key:'album',record:{}});
  assert.equal(typeof result.then,'undefined');
  assert.equal(result.state,'ready');
  assert.equal(result.cached,true);
  assert.equal(result.listings[0].title,'Cached');
  assert.equal(calls,0);
});

test('createListingLoader requests filters and caches marketplace listings',async()=>{
  const cache=new Map();
  let loading=0;
  let calls=0;
  const record={artist:'Pink Floyd'};
  const load=Marketplace.createListingLoader({
    cache,
    now:()=>5000,
    request:async input=>{calls++;assert.equal(input,record);return {data:{listings:[{title:'Keep'},{title:'Skip'}]}};},
    filter:listing=>listing.title!=='Skip'
  });
  const pending=load({key:'pink floyd|animals',record,onLoading:()=>loading++});
  assert.equal(typeof pending.then,'function');
  const result=await pending;
  assert.equal(result.state,'ready');
  assert.deepEqual(result.listings,[{title:'Keep'}]);
  assert.equal(result.cached,false);
  assert.equal(loading,1);
  assert.equal(calls,1);
  assert.deepEqual(cache.get('pink floyd|animals').listings,[{title:'Keep'}]);
});

test('createListingLoader preserves unavailable and cancelled states',async()=>{
  const failed=Marketplace.createListingLoader({request:async()=>({error:new Error('offline')})});
  const failedResult=await failed({key:'x',record:{}});
  assert.equal(failedResult.state,'unavailable');
  assert.match(failedResult.error.message,/offline/);

  const cancelled=Marketplace.createListingLoader({request:async()=>({data:{listings:[{title:'Late'}]}})});
  const cancelledResult=await cancelled({key:'y',record:{},isCancelled:()=>true});
  assert.equal(cancelledResult.state,'cancelled');
  assert.deepEqual(cancelledResult.listings,[]);
});


test('ebayMarketplaceId uses a local eBay site when supported and ebay.com otherwise',()=>{
  assert.equal(Marketplace.ebayMarketplaceId('de-DE'),'EBAY_DE');
  assert.equal(Marketplace.ebayMarketplaceId('en-GB'),'EBAY_GB');
  assert.equal(Marketplace.ebayMarketplaceId('fr-FR'),'EBAY_FR');
  assert.equal(Marketplace.ebayMarketplaceId('sv-SE'),'EBAY_US');
  assert.equal(Marketplace.ebayMarketplaceId('sv'),'EBAY_US');
});
