(function(){
'use strict';

var MarketplaceCore=window.GroovyMarketplaceCore;
var Record=window.GroovyRecord;
if(!MarketplaceCore)throw new Error('GroovyMarketplaceCore must load before marketplace-ui.js');
if(!Record)throw new Error('GroovyRecord must load before marketplace-ui.js');

var traderaButton=document.getElementById('traderaButton');
var traderaButtonLabel=document.getElementById('traderaButtonLabel');
var traderaModal=document.getElementById('traderaModal');
var closeTraderaModalButton=document.getElementById('closeTraderaModal');
var traderaModalSubtitle=document.getElementById('traderaModalSubtitle');
var traderaListingsStatus=document.getElementById('traderaListingsStatus');
var traderaListingsGrid=document.getElementById('traderaListingsGrid');
var ebayButton=document.getElementById('ebayButton');
var ebayButtonLabel=document.getElementById('ebayButtonLabel');
var ebayEnabled=ebayButton&&ebayButton.getAttribute('data-enabled')==='true';
var ebayModal=document.getElementById('ebayModal');
var closeEbayModalButton=document.getElementById('closeEbayModal');
var ebayModalSubtitle=document.getElementById('ebayModalSubtitle');
var ebayListingsStatus=document.getElementById('ebayListingsStatus');
var ebayListingsGrid=document.getElementById('ebayListingsGrid');
var marketplaceCurrencySelect=document.getElementById('marketplaceCurrencySelect');
var marketplacePriceSummary=document.getElementById('marketplacePriceSummary');
var marketplaceLowestPriceLink=document.getElementById('marketplaceLowestPriceLink');
var marketplaceLowestPrice=document.getElementById('marketplaceLowestPrice');
var marketplaceLowestMeta=document.getElementById('marketplaceLowestMeta');
var marketplacePriceStatus=document.getElementById('marketplacePriceStatus');
var marketplacePriceNote=document.getElementById('marketplacePriceNote');

var traderaAlbumIndex=-1;
var traderaRequestVersion=0;
var traderaListings=[];
var traderaListingCache=new Map();
var ebayAlbumIndex=-1;
var ebayRequestVersion=0;
var ebayListings=[];
var ebayListingCache=new Map();
var marketplacePriceAlbumIndex=-1;
var marketplacePriceFinished={tradera:false,ebay:false};
var marketplacePriceRenderVersion=0;
var marketplaceFxCache=new Map();
var MARKETPLACE_CURRENCY_STORAGE_KEY='groovy-marketplace-currency-v1';

function esc(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function safeExternalUrl(value){
  return MarketplaceCore.safeExternalUrl(value);
}

function traderaCacheKey(record){
  return MarketplaceCore.cacheKey(Record.artist(record),Record.title(record));
}

function normalizeTraderaIdentity(value){
  return MarketplaceCore.normalizeIdentity(value);
}

function isRelevantTraderaListing(listing,record){
  return MarketplaceCore.isRelevantListing(listing,record&&record[1],record&&record[2]);
}

function marketplaceRegionCurrency(){
  var region='';
  try{
    var locale=(navigator.languages&&navigator.languages[0])||navigator.language||'';
    if(typeof Intl.Locale==='function')region=(new Intl.Locale(locale)).region||'';
    if(!region){var match=String(locale).match(/[-_]([A-Z]{2})\b/i);region=match?match[1].toUpperCase():'';}
  }catch(error){}

  var byRegion={SE:'SEK',NO:'NOK',DK:'DKK',GB:'GBP',US:'USD',CA:'CAD',AU:'AUD',NZ:'NZD',CH:'CHF',JP:'JPY',PL:'PLN',CZ:'CZK',AT:'EUR',BE:'EUR',CY:'EUR',DE:'EUR',EE:'EUR',ES:'EUR',FI:'EUR',FR:'EUR',GR:'EUR',HR:'EUR',IE:'EUR',IT:'EUR',LT:'EUR',LU:'EUR',LV:'EUR',MT:'EUR',NL:'EUR',PT:'EUR',SI:'EUR',SK:'EUR'};
  if(byRegion[region])return byRegion[region];

  try{
    var timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
    if(timezone==='Europe/Stockholm')return 'SEK';
    if(timezone==='Europe/Oslo')return 'NOK';
    if(timezone==='Europe/Copenhagen')return 'DKK';
    if(timezone==='Europe/London')return 'GBP';
    if(timezone==='Europe/Zurich')return 'CHF';
    if(timezone==='Europe/Warsaw')return 'PLN';
    if(timezone==='Europe/Prague')return 'CZK';
    if(/^Europe\//.test(timezone))return 'EUR';
  }catch(error){}
  return 'EUR';
}

function marketplaceCurrencyPreference(){
  try{return localStorage.getItem(MARKETPLACE_CURRENCY_STORAGE_KEY)||'auto';}catch(error){return 'auto';}
}

function marketplaceDisplayCurrency(){
  var preference=marketplaceCurrencyPreference();
  return preference==='auto'?marketplaceRegionCurrency():preference;
}

function syncMarketplaceCurrencyControl(){
  if(!marketplaceCurrencySelect)return;
  var preference=marketplaceCurrencyPreference();
  var autoOption=marketplaceCurrencySelect.querySelector('option[value="auto"]');
  if(autoOption)autoOption.textContent='Auto · '+marketplaceRegionCurrency();
  marketplaceCurrencySelect.value=Array.from(marketplaceCurrencySelect.options).some(function(option){return option.value===preference;})?preference:'auto';
}

function marketplaceFormatMoney(amount,currency){
  if(!isFinite(amount)||amount<=0)return '';
  try{
    return new Intl.NumberFormat((navigator.languages&&navigator.languages[0])||navigator.language||undefined,{style:'currency',currency:String(currency||'EUR').toUpperCase(),currencyDisplay:'narrowSymbol',minimumFractionDigits:0,maximumFractionDigits:String(currency||'').toUpperCase()==='JPY'?0:2}).format(amount);
  }catch(error){return Math.round(amount*100)/100+' '+String(currency||'').toUpperCase();}
}

function marketplaceBuyNowCandidates(listings,marketplace){
  return MarketplaceCore.buyNowCandidates(listings,marketplace);
}

async function marketplaceFxRate(from,to){
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
}

function clearMarketplacePriceSummary(){
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
}

function setTraderaButtonState(state,count){
  if(!traderaButton||!traderaButtonLabel)return;
  traderaButton.classList.remove('loading','empty','unavailable');
  traderaButton.disabled=false;

  if(state==='loading'){
    traderaButton.classList.add('loading');
    traderaButtonLabel.textContent='Tradera · Checking…';
  }else if(state==='ready'){
    traderaButtonLabel.textContent='Tradera · '+count+' '+(count===1?'listing':'listings');
  }else if(state==='empty'){
    traderaButton.classList.add('empty');
    traderaButtonLabel.textContent='Tradera · No listings';
  }else{
    traderaButton.classList.add('unavailable');
    traderaButtonLabel.textContent='Tradera · Unavailable';
  }
}

function traderaPrice(listing){
  var amount=Number(listing.buyNowPrice||listing.nextBid||listing.currentBid||listing.openingBid||0);
  if(!isFinite(amount)||amount<=0)return '';

  try{
    return new Intl.NumberFormat('sv-SE',{
      style:'currency',
      currency:String(listing.currency||'SEK'),
      maximumFractionDigits:0
    }).format(amount);
  }catch(error){
    return Math.round(amount)+' kr';
  }
}

function traderaEndsText(value){
  var date=new Date(value);
  if(!value||isNaN(date.getTime()))return '';

  return 'Ends '+date.toLocaleDateString('sv-SE',{
    day:'numeric',
    month:'short'
  })+' · '+date.toLocaleTimeString('sv-SE',{
    hour:'2-digit',
    minute:'2-digit'
  });
}

function renderTraderaListings(){
  if(!traderaListingsGrid)return;
  if(!traderaListings.length){
    traderaListingsGrid.innerHTML='';
    return;
  }

  traderaListingsGrid.innerHTML=traderaListings.map(function(listing){
    var href=safeExternalUrl(listing.url);
    var imageUrl=safeExternalUrl(listing.imageUrl);
    var price=traderaPrice(listing);
    var ends=traderaEndsText(listing.endDate);
    var bids=Number(listing.bidCount||0);

    return '<article class="tradera-listing-card">'+
      '<a class="tradera-listing-image" href="'+esc(href||'#')+'" target="_blank" rel="noopener noreferrer" aria-label="View listing on Tradera">'+
        (imageUrl?'<img src="'+esc(imageUrl)+'" alt="" loading="lazy">':'<span class="record-icon" aria-hidden="true"></span>')+
      '</a>'+
      '<div class="tradera-listing-body">'+
        '<h3>'+esc(listing.title||'Vinyl record')+'</h3>'+
        '<div class="tradera-listing-price-row">'+
          '<strong>'+esc(price||'See price')+'</strong>'+
          (bids?'<span>'+bids+' '+(bids===1?'bid':'bids')+'</span>':'')+
        '</div>'+
        (ends?'<div class="tradera-listing-end">'+esc(ends)+'</div>':'')+
        (href?'<a class="tradera-listing-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">View on Tradera <span aria-hidden="true">↗</span></a>':'')+
      '</div>'+
    '</article>';
  }).join('');
}

function openTraderaModal(){
  var record=window.records&&window.records[traderaAlbumIndex];
  if(!record||!traderaModal)return;

  if(traderaModalSubtitle)traderaModalSubtitle.textContent=record[1]+' · '+record[2];
  renderTraderaListings();

  if(traderaListingsStatus&&traderaButton&&traderaButton.classList.contains('loading')){
    traderaListingsStatus.className='tradera-listings-status loading';
    traderaListingsStatus.textContent='Finding active listings…';
  }else if(traderaListingsStatus&&traderaListings.length){
    traderaListingsStatus.className='tradera-listings-status';
    traderaListingsStatus.textContent=traderaListings.length+' active '+(traderaListings.length===1?'listing':'listings');
  }else if(traderaListingsStatus&&traderaButton&&traderaButton.classList.contains('unavailable')){
    traderaListingsStatus.className='tradera-listings-status error';
    traderaListingsStatus.textContent='Tradera is temporarily unavailable. Please try again shortly.';
  }else if(traderaListingsStatus){
    traderaListingsStatus.className='tradera-listings-status empty';
    traderaListingsStatus.textContent='No active listings found for this album right now.';
  }

  traderaModal.classList.add('visible');
  traderaModal.setAttribute('aria-hidden','false');
  if(closeTraderaModalButton)closeTraderaModalButton.focus();
}

function closeTraderaModal(){
  if(!traderaModal)return;
  traderaModal.classList.remove('visible');
  traderaModal.setAttribute('aria-hidden','true');
}

async function loadTraderaListings(record,index){
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

  if(traderaModal&&traderaModal.classList.contains('visible')&&traderaAlbumIndex===index){
    openTraderaModal();
  }
}

function setEbayButtonState(state,count){
  if(!ebayButton||!ebayButtonLabel)return;
  ebayButton.classList.remove('loading','empty','unavailable');
  ebayButton.disabled=false;

  if(state==='loading'){
    ebayButton.classList.add('loading');
    ebayButtonLabel.textContent='eBay · Checking…';
  }else if(state==='ready'){
    ebayButtonLabel.textContent='eBay · '+count+' '+(count===1?'listing':'listings');
  }else if(state==='empty'){
    ebayButton.classList.add('empty');
    ebayButtonLabel.textContent='eBay · No listings';
  }else{
    ebayButton.classList.add('unavailable');
    ebayButtonLabel.textContent='eBay · Unavailable';
  }
}

function renderEbayListings(){
  if(!ebayListingsGrid)return;
  if(!ebayListings.length){
    ebayListingsGrid.innerHTML='';
    return;
  }

  ebayListingsGrid.innerHTML=ebayListings.map(function(listing){
    var href=safeExternalUrl(listing.url);
    var imageUrl=safeExternalUrl(listing.imageUrl);
    var price=traderaPrice(listing);
    var ends=traderaEndsText(listing.endDate);
    var bids=Number(listing.bidCount||0);

    return '<article class="tradera-listing-card">'+
      '<a class="tradera-listing-image" href="'+esc(href||'#')+'" target="_blank" rel="noopener noreferrer" aria-label="View listing on eBay">'+
        (imageUrl?'<img src="'+esc(imageUrl)+'" alt="" loading="lazy">':'<span class="record-icon" aria-hidden="true"></span>')+
      '</a>'+
      '<div class="tradera-listing-body">'+
        '<h3>'+esc(listing.title||'Vinyl record')+'</h3>'+
        '<div class="tradera-listing-price-row">'+
          '<strong>'+esc(price||'See price')+'</strong>'+
          (bids?'<span>'+bids+' '+(bids===1?'bid':'bids')+'</span>':'')+
        '</div>'+
        (ends?'<div class="tradera-listing-end">'+esc(ends)+'</div>':'')+
        (href?'<a class="tradera-listing-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">View on eBay <span aria-hidden="true">↗</span></a>':'')+
      '</div>'+
    '</article>';
  }).join('');
}

function openEbayModal(){
  var record=window.records&&window.records[ebayAlbumIndex];
  if(!record||!ebayModal)return;

  if(ebayModalSubtitle)ebayModalSubtitle.textContent=record[1]+' · '+record[2];
  renderEbayListings();

  if(ebayListingsStatus&&ebayButton&&ebayButton.classList.contains('loading')){
    ebayListingsStatus.className='tradera-listings-status loading';
    ebayListingsStatus.textContent='Finding active listings…';
  }else if(ebayListingsStatus&&ebayListings.length){
    ebayListingsStatus.className='tradera-listings-status';
    ebayListingsStatus.textContent=ebayListings.length+' active '+(ebayListings.length===1?'listing':'listings');
  }else if(ebayListingsStatus&&ebayButton&&ebayButton.classList.contains('unavailable')){
    ebayListingsStatus.className='tradera-listings-status error';
    ebayListingsStatus.textContent='eBay is temporarily unavailable. Please try again shortly.';
  }else if(ebayListingsStatus){
    ebayListingsStatus.className='tradera-listings-status empty';
    ebayListingsStatus.textContent='No active vinyl LP listings found for this album right now.';
  }

  ebayModal.classList.add('visible');
  ebayModal.setAttribute('aria-hidden','false');
  if(closeEbayModalButton)closeEbayModalButton.focus();
}

function closeEbayModal(){
  if(!ebayModal)return;
  ebayModal.classList.remove('visible');
  ebayModal.setAttribute('aria-hidden','true');
}

async function loadEbayListings(record,index){
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

  if(ebayModal&&ebayModal.classList.contains('visible')&&ebayAlbumIndex===index){
    openEbayModal();
  }
}

function prepareAlbum(record,index){
  closeTraderaModal();
  closeEbayModal();
  resetMarketplacePriceSummary(index);
  loadTraderaListings(record,index);
  if(ebayEnabled)loadEbayListings(record,index);
}

function reset(){
  closeTraderaModal();
  closeEbayModal();
  traderaRequestVersion++;
  ebayRequestVersion++;
  clearMarketplacePriceSummary();
}

function closeVisibleModal(){
  if(ebayModal&&ebayModal.classList.contains('visible')){
    closeEbayModal();
    return true;
  }
  if(traderaModal&&traderaModal.classList.contains('visible')){
    closeTraderaModal();
    return true;
  }
  return false;
}

if(ebayButton)ebayButton.hidden=!ebayEnabled;

syncMarketplaceCurrencyControl();
if(marketplaceCurrencySelect)marketplaceCurrencySelect.addEventListener('change',function(){
  try{localStorage.setItem(MARKETPLACE_CURRENCY_STORAGE_KEY,this.value);}catch(error){}
  syncMarketplaceCurrencyControl();
  if(marketplacePriceAlbumIndex>=0)refreshMarketplaceBestPrice(marketplacePriceAlbumIndex);
});

if(traderaButton)traderaButton.addEventListener('click',function(event){
  event.preventDefault();
  event.stopPropagation();
  openTraderaModal();
});
if(closeTraderaModalButton)closeTraderaModalButton.addEventListener('click',closeTraderaModal);
if(traderaModal)traderaModal.addEventListener('click',function(event){
  if(event.target===traderaModal)closeTraderaModal();
});

if(ebayButton)ebayButton.addEventListener('click',function(event){
  event.preventDefault();
  event.stopPropagation();
  openEbayModal();
});
if(closeEbayModalButton)closeEbayModalButton.addEventListener('click',closeEbayModal);
if(ebayModal)ebayModal.addEventListener('click',function(event){
  if(event.target===ebayModal)closeEbayModal();
});

window.GroovyMarketplaceUI={
  prepareAlbum:prepareAlbum,
  reset:reset,
  closeVisibleModal:closeVisibleModal
};
})();
