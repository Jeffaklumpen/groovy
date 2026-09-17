const fs=require('fs');
const file='js/app.js';
let source=fs.readFileSync(file,'utf8');

const beforeFx=`async function marketplaceFxRate(from,to){
  from=String(from||'').toUpperCase();to=String(to||'').toUpperCase();
  if(!from||!to)throw new Error('Missing currency');
  if(from===to)return 1;
  var key=from+'-'+to;
  var memory=marketplaceFxCache.get(key);
  if(memory&&Date.now()-memory.savedAt<12*60*60*1000)return memory.rate;
  var storageKey='groovy-fx-v1-'+key;
  try{
    var stored=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(stored&&Number(stored.rate)>0&&Date.now()-Number(stored.savedAt)<12*60*60*1000){marketplaceFxCache.set(key,stored);return Number(stored.rate);}
  }catch(error){}

  var response=await fetch('https://api.frankfurter.dev/v2/rate/'+encodeURIComponent(from.toLowerCase())+'/'+encodeURIComponent(to.toLowerCase()),{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('FX rate unavailable');
  var data=await response.json();
  var rate=Number(data&&data.rate);
  if(!isFinite(rate)||rate<=0)throw new Error('Invalid FX rate');
  var cached={rate:rate,savedAt:Date.now()};
  marketplaceFxCache.set(key,cached);
  try{localStorage.setItem(storageKey,JSON.stringify(cached));}catch(error){}
  return rate;
}`;

const afterFx=`var marketplaceFxRate=MarketplaceCore.createFxRateLoader({
  cache:marketplaceFxCache,
  getStored:function(key){try{return localStorage.getItem(key);}catch(error){return null;}},
  setStored:function(key,value){try{localStorage.setItem(key,value);}catch(error){}},
  request:function(url,options){return fetch(url,options);}
});`;

const beforeBest=`async function refreshMarketplaceBestPrice(index){
  if(index!==marketplacePriceAlbumIndex||!marketplacePriceSummary)return;
  if(!marketplacePriceFinished.tradera||!marketplacePriceFinished.ebay)return;
  var renderVersion=++marketplacePriceRenderVersion;
  var candidates=marketplaceBuyNowCandidates(traderaListings,'Tradera');
  if(ebayEnabled)candidates=candidates.concat(marketplaceBuyNowCandidates(ebayListings,'eBay'));
  marketplacePriceSummary.classList.remove('loading','empty','partial','ready');

  if(!candidates.length){
    marketplacePriceSummary.classList.add('empty');
    marketplaceLowestPriceLink.hidden=true;
    marketplacePriceStatus.hidden=false;
    marketplacePriceStatus.textContent='No Buy Now prices found';
    marketplacePriceNote.textContent='Auctions are not included';
    return;
  }

  var target=marketplaceDisplayCurrency();
  var converted=[];
  for(var i=0;i<candidates.length;i++){
    try{
      var rate=await marketplaceFxRate(candidates[i].currency,target);
      if(renderVersion!==marketplacePriceRenderVersion||index!==marketplacePriceAlbumIndex)return;
      converted.push(Object.assign({},candidates[i],{converted:candidates[i].amount*rate}));
    }catch(error){converted.push(Object.assign({},candidates[i],{converted:null}));}
  }
  if(renderVersion!==marketplacePriceRenderVersion||index!==marketplacePriceAlbumIndex)return;

  var comparable=converted.filter(function(item){return isFinite(item.converted)&&item.converted>0;});
  if(candidates.length>1&&comparable.length!==candidates.length){
    marketplacePriceSummary.classList.add('partial');
    marketplaceLowestPriceLink.hidden=true;
    marketplacePriceStatus.hidden=false;
    marketplacePriceStatus.textContent=converted.map(function(item){return item.marketplace+' '+marketplaceFormatMoney(item.amount,item.currency);}).join(' · ');
    marketplacePriceNote.textContent='Currency conversion unavailable';
    return;
  }

  var best=(comparable.length?comparable:converted).slice().sort(function(a,b){
    var av=isFinite(a.converted)?a.converted:a.amount;
    var bv=isFinite(b.converted)?b.converted:b.amount;
    return av-bv;
  })[0];
  var shownAmount=isFinite(best.converted)?best.converted:best.amount;
  var shownCurrency=isFinite(best.converted)?target:best.currency;
  var original=marketplaceFormatMoney(best.amount,best.currency);
  var convertedLabel=marketplaceFormatMoney(shownAmount,shownCurrency);
  marketplacePriceSummary.classList.add('ready');
  marketplacePriceStatus.hidden=true;
  marketplaceLowestPrice.textContent=convertedLabel;
  marketplaceLowestMeta.textContent=best.marketplace+(best.currency!==shownCurrency?' · '+original:'');
  marketplaceLowestPriceLink.href=best.url||'#';
  marketplaceLowestPriceLink.hidden=false;
  marketplacePriceNote.textContent='Excl. shipping';
}`;

const afterBest=`async function refreshMarketplaceBestPrice(index){
  if(index!==marketplacePriceAlbumIndex||!marketplacePriceSummary)return;
  if(!marketplacePriceFinished.tradera||!marketplacePriceFinished.ebay)return;
  var renderVersion=++marketplacePriceRenderVersion;
  var candidates=marketplaceBuyNowCandidates(traderaListings,'Tradera');
  if(ebayEnabled)candidates=candidates.concat(marketplaceBuyNowCandidates(ebayListings,'eBay'));
  marketplacePriceSummary.classList.remove('loading','empty','partial','ready');

  var locale=(navigator.languages&&navigator.languages[0])||navigator.language||undefined;
  var result=await MarketplaceCore.resolveBestPrice(
    candidates,
    marketplaceDisplayCurrency(),
    marketplaceFxRate,
    locale,
    function(){return renderVersion!==marketplacePriceRenderVersion||index!==marketplacePriceAlbumIndex;}
  );
  if(result.state==='cancelled')return;

  if(result.state==='empty'){
    marketplacePriceSummary.classList.add('empty');
    marketplaceLowestPriceLink.hidden=true;
    marketplacePriceStatus.hidden=false;
    marketplacePriceStatus.textContent='No Buy Now prices found';
    marketplacePriceNote.textContent='Auctions are not included';
    return;
  }

  if(result.state==='partial'){
    marketplacePriceSummary.classList.add('partial');
    marketplaceLowestPriceLink.hidden=true;
    marketplacePriceStatus.hidden=false;
    marketplacePriceStatus.textContent=result.label;
    marketplacePriceNote.textContent='Currency conversion unavailable';
    return;
  }

  marketplacePriceSummary.classList.add('ready');
  marketplacePriceStatus.hidden=true;
  marketplaceLowestPrice.textContent=result.priceLabel;
  marketplaceLowestMeta.textContent=result.metaLabel;
  marketplaceLowestPriceLink.href=result.url;
  marketplaceLowestPriceLink.hidden=false;
  marketplacePriceNote.textContent='Excl. shipping';
}`;

for(const [before,after,name] of [[beforeFx,afterFx,'FX loader'],[beforeBest,afterBest,'best-price resolver']]){
  const first=source.indexOf(before);
  if(first===-1)throw new Error('Expected '+name+' block was not found; refusing to modify app.js');
  if(source.indexOf(before,first+before.length)!==-1)throw new Error(name+' block appeared more than once; refusing to modify app.js');
  source=source.slice(0,first)+after+source.slice(first+before.length);
}

fs.writeFileSync(file,source);
console.log('Marketplace pricing extraction applied. app.js is now '+Buffer.byteLength(source)+' bytes.');
