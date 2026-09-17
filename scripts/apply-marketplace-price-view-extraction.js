const fs=require('node:fs');

const file='js/app.js';
let source=fs.readFileSync(file,'utf8');

const oldCurrency=String.raw`function syncMarketplaceCurrencyControl(){
  if(!marketplaceCurrencySelect)return;
  var preference=marketplaceCurrencyPreference();
  var autoOption=marketplaceCurrencySelect.querySelector('option[value="auto"]');
  if(autoOption)autoOption.textContent='Auto · '+marketplaceRegionCurrency();
  marketplaceCurrencySelect.value=Array.from(marketplaceCurrencySelect.options).some(function(option){return option.value===preference;})?preference:'auto';
}`;

const newCurrency=String.raw`function syncMarketplaceCurrencyControl(){
  MarketplaceView.syncCurrencyControl(marketplaceCurrencySelect,marketplaceCurrencyPreference(),marketplaceRegionCurrency());
}`;

const oldPrice=String.raw`function clearMarketplacePriceSummary(){
  marketplacePriceAlbumIndex=-1;
  marketplacePriceFinished={tradera:false,ebay:!ebayEnabled};
  marketplacePriceRenderVersion++;
  traderaListings=[];
  ebayListings=[];
  if(!marketplacePriceSummary)return;
  marketplacePriceSummary.classList.remove('loading','empty','partial','ready');
  if(marketplaceLowestPriceLink){marketplaceLowestPriceLink.hidden=true;marketplaceLowestPriceLink.href='#';}
  if(marketplaceLowestPrice)marketplaceLowestPrice.textContent='';
  if(marketplaceLowestMeta)marketplaceLowestMeta.textContent='';
  if(marketplacePriceStatus){marketplacePriceStatus.hidden=false;marketplacePriceStatus.textContent='Checking fixed prices…';}
  if(marketplacePriceNote)marketplacePriceNote.textContent='Excl. shipping';
}

function resetMarketplacePriceSummary(index){
  marketplacePriceAlbumIndex=index;
  marketplacePriceFinished={tradera:false,ebay:!ebayEnabled};
  marketplacePriceRenderVersion++;
  if(!marketplacePriceSummary)return;
  marketplacePriceSummary.classList.add('loading');
  marketplacePriceSummary.classList.remove('empty','partial','ready');
  marketplaceLowestPriceLink.hidden=true;
  marketplacePriceStatus.hidden=false;
  marketplacePriceStatus.textContent='Checking fixed prices…';
  marketplacePriceNote.textContent='Excl. shipping';
}

async function refreshMarketplaceBestPrice(index){
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

const newPrice=String.raw`function marketplacePriceElements(){
  return {
    summary:marketplacePriceSummary,
    link:marketplaceLowestPriceLink,
    price:marketplaceLowestPrice,
    meta:marketplaceLowestMeta,
    status:marketplacePriceStatus,
    note:marketplacePriceNote
  };
}

function applyMarketplacePriceSummaryState(state,result){
  MarketplaceView.applyPriceSummaryState(marketplacePriceElements(),state,result);
}

function clearMarketplacePriceSummary(){
  marketplacePriceAlbumIndex=-1;
  marketplacePriceFinished={tradera:false,ebay:!ebayEnabled};
  marketplacePriceRenderVersion++;
  traderaListings=[];
  ebayListings=[];
  applyMarketplacePriceSummaryState('clear');
}

function resetMarketplacePriceSummary(index){
  marketplacePriceAlbumIndex=index;
  marketplacePriceFinished={tradera:false,ebay:!ebayEnabled};
  marketplacePriceRenderVersion++;
  applyMarketplacePriceSummaryState('loading');
}

async function refreshMarketplaceBestPrice(index){
  if(index!==marketplacePriceAlbumIndex||!marketplacePriceSummary)return;
  if(!marketplacePriceFinished.tradera||!marketplacePriceFinished.ebay)return;
  var renderVersion=++marketplacePriceRenderVersion;
  var candidates=marketplaceBuyNowCandidates(traderaListings,'Tradera');
  if(ebayEnabled)candidates=candidates.concat(marketplaceBuyNowCandidates(ebayListings,'eBay'));
  applyMarketplacePriceSummaryState('resolving');

  var locale=(navigator.languages&&navigator.languages[0])||navigator.language||undefined;
  var result=await MarketplaceCore.resolveBestPrice(
    candidates,
    marketplaceDisplayCurrency(),
    marketplaceFxRate,
    locale,
    function(){return renderVersion!==marketplacePriceRenderVersion||index!==marketplacePriceAlbumIndex;}
  );
  if(result.state==='cancelled')return;
  applyMarketplacePriceSummaryState(result.state,result);
}`;

if(!source.includes(oldCurrency))throw new Error('Expected marketplace currency control block was not found; refusing to transform app.js');
if(!source.includes(oldPrice))throw new Error('Expected marketplace price summary block was not found; refusing to transform app.js');

source=source.replace(oldCurrency,newCurrency).replace(oldPrice,newPrice);

if(source.includes(oldCurrency)||source.includes(oldPrice))throw new Error('Legacy marketplace price view code remains after transformation');
if(!source.includes('MarketplaceView.syncCurrencyControl(')||!source.includes('MarketplaceView.applyPriceSummaryState('))throw new Error('Marketplace view delegation was not installed');

fs.writeFileSync(file,source);
console.log('Marketplace price view extraction applied. app.js is now '+Buffer.byteLength(source)+' bytes.');
