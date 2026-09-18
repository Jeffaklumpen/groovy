(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./marketplace-core.js'),require('./marketplace-view.js'));
  }else if(root){
    root.GroovyMarketplaceController=factory(root.GroovyMarketplaceCore,root.GroovyMarketplaceView);
  }
})(typeof window!=='undefined'?window:null,function(Core,View){
'use strict';

function create(options){
  options=options||{};
  if(!Core)throw new Error('GroovyMarketplaceCore is required for marketplace controller');
  if(!View)throw new Error('GroovyMarketplaceView is required for marketplace controller');

  var elements=options.elements||{};
  var api=options.api;
  var storage=options.storage||null;
  var nav=options.navigator||{};
  var IntlApi=options.Intl||(typeof Intl!=='undefined'?Intl:null);
  var request=typeof options.request==='function'?options.request:(typeof fetch==='function'?fetch:null);
  var getRecord=typeof options.getRecord==='function'?options.getRecord:function(){return null;};
  var recordModel=options.recordModel;
  var getArtist=typeof options.getArtist==='function'?options.getArtist:function(record){return recordModel&&recordModel.artist?recordModel.artist(record)||'':'';};
  var getTitle=typeof options.getTitle==='function'?options.getTitle:function(record){return recordModel&&recordModel.title?recordModel.title(record)||'':'';};
  var currencyStorageKey='groovy-marketplace-currency-v1';
  var ebayEnabled=!!(elements.ebayButton&&elements.ebayButton.getAttribute&&elements.ebayButton.getAttribute('data-enabled')==='true');

  var traderaAlbumIndex=-1;
  var traderaRequestVersion=0;
  var traderaListings=[];
  var traderaListingCache=new Map();
  var ebayAlbumIndex=-1;
  var ebayRequestVersion=0;
  var ebayListings=[];
  var ebayListingCache=new Map();
  var priceAlbumIndex=-1;
  var priceFinished={tradera:false,ebay:!ebayEnabled};
  var priceRenderVersion=0;
  var fxCache=new Map();

  function report(level,message,error){
    if(typeof options.onLog==='function')options.onLog(level,message,error);
    else if(typeof console!=='undefined'&&console[level])console[level](message,error||'');
  }
  function locale(){return (nav.languages&&nav.languages[0])||nav.language||undefined;}
  function timezone(){
    try{return IntlApi&&IntlApi.DateTimeFormat?IntlApi.DateTimeFormat().resolvedOptions().timeZone||'':'';}catch(error){return '';}
  }
  function regionCurrency(){return Core.regionCurrency(locale()||'',timezone());}
  function preference(){
    try{return storage&&storage.getItem?storage.getItem(currencyStorageKey)||'auto':'auto';}catch(error){return 'auto';}
  }
  function displayCurrency(){return Core.displayCurrency(preference(),regionCurrency());}
  function syncCurrencyControl(){View.syncCurrencyControl(elements.currencySelect,preference(),regionCurrency());}
  function cacheKey(record){return Core.cacheKey(getArtist(record),getTitle(record));}
  function relevantListing(listing,record){return Core.isRelevantListing(listing,getArtist(record),getTitle(record));}
  function priceElements(){
    return {
      summary:elements.priceSummary,
      link:elements.lowestPriceLink,
      price:elements.lowestPrice,
      meta:elements.lowestMeta,
      status:elements.priceStatus,
      note:elements.priceNote
    };
  }
  function applyPriceState(state,result){View.applyPriceSummaryState(priceElements(),state,result);}

  var fxRate=Core.createFxRateLoader({
    cache:fxCache,
    getStored:function(key){try{return storage&&storage.getItem?storage.getItem(key):null;}catch(error){return null;}},
    setStored:function(key,value){try{if(storage&&storage.setItem)storage.setItem(key,value);}catch(error){}},
    request:function(url,requestOptions){
      if(!request)throw new Error('FX request unavailable');
      return request(url,requestOptions);
    }
  });

  var loadTraderaData=Core.createListingLoader({
    cache:traderaListingCache,
    request:function(record){
      if(!api||!api.functions||!api.functions.invoke)throw new Error('Marketplace data API is unavailable.');
      return api.functions.invoke('tradera-search',{body:{artist:getArtist(record),album:getTitle(record)}});
    },
    filter:relevantListing
  });

  var loadEbayData=Core.createListingLoader({
    cache:ebayListingCache,
    request:function(record){
      if(!api||!api.functions||!api.functions.invoke)throw new Error('Marketplace data API is unavailable.');
      return api.functions.invoke('ebay-search',{body:{artist:getArtist(record),album:getTitle(record)}});
    },
    filter:relevantListing
  });

  function clearPriceSummary(){
    priceAlbumIndex=-1;
    priceFinished={tradera:false,ebay:!ebayEnabled};
    priceRenderVersion++;
    traderaListings=[];
    ebayListings=[];
    applyPriceState('clear');
  }

  function resetPriceSummary(index){
    priceAlbumIndex=index;
    priceFinished={tradera:false,ebay:!ebayEnabled};
    priceRenderVersion++;
    applyPriceState('loading');
  }

  async function refreshBestPrice(index){
    if(index!==priceAlbumIndex||!elements.priceSummary)return;
    if(!priceFinished.tradera||!priceFinished.ebay)return;
    var renderVersion=++priceRenderVersion;
    var candidates=Core.buyNowCandidates(traderaListings,'Tradera');
    if(ebayEnabled)candidates=candidates.concat(Core.buyNowCandidates(ebayListings,'eBay'));
    applyPriceState('resolving');
    var result=await Core.resolveBestPrice(
      candidates,
      displayCurrency(),
      fxRate,
      locale(),
      function(){return renderVersion!==priceRenderVersion||index!==priceAlbumIndex;}
    );
    if(result.state==='cancelled')return;
    applyPriceState(result.state,result);
  }

  function setButtonState(button,label,marketplace,state,count){View.applyButtonState(button,label,marketplace,state,count);}

  function openTradera(){
    var record=getRecord(traderaAlbumIndex);
    if(!record)return false;
    View.openListingsModal({
      modal:elements.traderaModal,
      closeButton:elements.closeTraderaModalButton,
      subtitle:elements.traderaModalSubtitle,
      status:elements.traderaListingsStatus,
      grid:elements.traderaListingsGrid,
      listings:traderaListings,
      button:elements.traderaButton,
      marketplace:'Tradera',
      artist:getArtist(record),
      album:getTitle(record),
      locale:'sv-SE',
      emptyText:'No active listings found for this album right now.'
    });
    return true;
  }

  function closeTradera(){View.closeListingsModal(elements.traderaModal);}

  async function loadTradera(record,index){
    traderaAlbumIndex=index;
    traderaListings=[];
    var requestVersion=++traderaRequestVersion;
    var result=loadTraderaData({
      key:cacheKey(record),
      record:record,
      isCancelled:function(){return requestVersion!==traderaRequestVersion;},
      onLoading:function(){setButtonState(elements.traderaButton,elements.traderaButtonLabel,'Tradera','loading',0);}
    });
    if(result&&typeof result.then==='function')result=await result;
    if(!result||result.state==='cancelled')return result;
    traderaListings=result.listings||[];
    if(result.state==='unavailable')report('error','Could not load Tradera listings:',result.error);
    setButtonState(elements.traderaButton,elements.traderaButtonLabel,'Tradera',result.state,traderaListings.length);
    priceFinished.tradera=true;
    refreshBestPrice(index);
    if(elements.traderaModal&&elements.traderaModal.classList&&elements.traderaModal.classList.contains('visible')&&traderaAlbumIndex===index)openTradera();
    return result;
  }

  function openEbay(){
    var record=getRecord(ebayAlbumIndex);
    if(!record)return false;
    View.openListingsModal({
      modal:elements.ebayModal,
      closeButton:elements.closeEbayModalButton,
      subtitle:elements.ebayModalSubtitle,
      status:elements.ebayListingsStatus,
      grid:elements.ebayListingsGrid,
      listings:ebayListings,
      button:elements.ebayButton,
      marketplace:'eBay',
      artist:getArtist(record),
      album:getTitle(record),
      locale:'sv-SE',
      emptyText:'No active vinyl LP listings found for this album right now.'
    });
    return true;
  }

  function closeEbay(){View.closeListingsModal(elements.ebayModal);}

  async function loadEbay(record,index){
    ebayAlbumIndex=index;
    ebayListings=[];
    var requestVersion=++ebayRequestVersion;
    var result=loadEbayData({
      key:cacheKey(record),
      record:record,
      isCancelled:function(){return requestVersion!==ebayRequestVersion;},
      onLoading:function(){setButtonState(elements.ebayButton,elements.ebayButtonLabel,'eBay','loading',0);}
    });
    if(result&&typeof result.then==='function')result=await result;
    if(!result||result.state==='cancelled')return result;
    ebayListings=result.listings||[];
    if(result.state==='unavailable')report('error','Could not load eBay listings:',result.error);
    setButtonState(elements.ebayButton,elements.ebayButtonLabel,'eBay',result.state,ebayListings.length);
    priceFinished.ebay=true;
    refreshBestPrice(index);
    if(elements.ebayModal&&elements.ebayModal.classList&&elements.ebayModal.classList.contains('visible')&&ebayAlbumIndex===index)openEbay();
    return result;
  }

  function openForRecord(index){
    closeTradera();
    closeEbay();
    resetPriceSummary(index);
    var record=getRecord(index);
    if(!record)return Promise.resolve([]);
    var pending=[loadTradera(record,index)];
    if(ebayEnabled)pending.push(loadEbay(record,index));
    return Promise.all(pending);
  }

  function close(){
    closeTradera();
    closeEbay();
    traderaRequestVersion++;
    ebayRequestVersion++;
    clearPriceSummary();
  }

  function handleEscape(){
    if(elements.ebayModal&&elements.ebayModal.classList&&elements.ebayModal.classList.contains('visible')){
      closeEbay();
      return true;
    }
    if(elements.traderaModal&&elements.traderaModal.classList&&elements.traderaModal.classList.contains('visible')){
      closeTradera();
      return true;
    }
    return false;
  }

  function bind(){
    if(elements.ebayButton)elements.ebayButton.hidden=!ebayEnabled;
    syncCurrencyControl();
    if(elements.currencySelect)elements.currencySelect.addEventListener('change',function(){
      try{if(storage&&storage.setItem)storage.setItem(currencyStorageKey,this.value);}catch(error){}
      syncCurrencyControl();
      if(priceAlbumIndex>=0)refreshBestPrice(priceAlbumIndex);
    });
    if(elements.traderaButton)elements.traderaButton.addEventListener('click',function(event){
      if(event){event.preventDefault();event.stopPropagation();}
      openTradera();
    });
    if(elements.closeTraderaModalButton)elements.closeTraderaModalButton.addEventListener('click',closeTradera);
    if(elements.traderaModal)elements.traderaModal.addEventListener('click',function(event){if(event.target===elements.traderaModal)closeTradera();});
    if(elements.ebayButton)elements.ebayButton.addEventListener('click',function(event){
      if(event){event.preventDefault();event.stopPropagation();}
      openEbay();
    });
    if(elements.closeEbayModalButton)elements.closeEbayModalButton.addEventListener('click',closeEbay);
    if(elements.ebayModal)elements.ebayModal.addEventListener('click',function(event){if(event.target===elements.ebayModal)closeEbay();});
  }

  bind();
  return Object.freeze({
    openForRecord:openForRecord,
    close:close,
    openTradera:openTradera,
    closeTradera:closeTradera,
    openEbay:openEbay,
    closeEbay:closeEbay,
    refreshBestPrice:refreshBestPrice,
    handleEscape:handleEscape,
    state:function(){
      return {
        ebayEnabled:ebayEnabled,
        traderaAlbumIndex:traderaAlbumIndex,
        ebayAlbumIndex:ebayAlbumIndex,
        priceAlbumIndex:priceAlbumIndex,
        traderaListings:traderaListings.slice(),
        ebayListings:ebayListings.slice(),
        traderaFinished:priceFinished.tradera,
        ebayFinished:priceFinished.ebay
      };
    }
  });
}

return Object.freeze({create:create});
});
