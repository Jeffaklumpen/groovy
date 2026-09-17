(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyMarketplaceCore=api;
})(typeof window!=='undefined'?window:null,function(){
  function safeExternalUrl(value){
    try{
      var url=new URL(String(value||''));
      return url.protocol==='https:'||url.protocol==='http:'?url.href:'';
    }catch(error){
      return '';
    }
  }

  function buyNowCandidates(listings,marketplace){
    return (listings||[]).map(function(listing){
      var amount=Number(listing&&listing.buyNowPrice||0);
      if(!isFinite(amount)||amount<=0)return null;
      return {amount:amount,currency:String(listing.currency||'EUR').toUpperCase(),marketplace:marketplace,url:safeExternalUrl(listing.url),listing:listing};
    }).filter(Boolean);
  }

  function cacheKey(artist,title){
    return String(artist||'').trim().toLowerCase()+'|'+String(title||'').trim().toLowerCase();
  }

  function normalizeIdentity(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  }

  function isRelevantListing(listing,artistValue,albumValue){
    var artist=normalizeIdentity(artistValue);
    var album=normalizeIdentity(albumValue);
    if(!artist||artist!==album)return true;

    var title=normalizeIdentity(listing&&listing.title);
    var escaped=artist.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
    var remainder=title
      .replace(new RegExp('\\b'+escaped+'\\b'),' ')
      .replace(new RegExp('\\b'+escaped+'\\b'),' ')
      .replace(/\b(?:self titled|debut|album|vinyl|skiva|gatefold|lp|\d+x?lp|(?:180|200)g)\b/g,' ')
      .replace(/\b(?:19|20)\d{2}\b/g,' ')
      .replace(/\b(?:sweden|swedish|sverige|germany|german|canada|canadian|uk|us|usa|eu|press|pressing|first|1st|original|mono|stereo|sealed|new|ny)\b/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    return !remainder;
  }

  function regionCurrency(locale,timezone){
    var region='';
    try{
      if(typeof Intl!=='undefined'&&typeof Intl.Locale==='function')region=(new Intl.Locale(locale||'')).region||'';
      if(!region){var match=String(locale||'').match(/[-_]([A-Z]{2})\b/i);region=match?match[1].toUpperCase():'';}
    }catch(error){}

    var byRegion={SE:'SEK',NO:'NOK',DK:'DKK',GB:'GBP',US:'USD',CA:'CAD',AU:'AUD',NZ:'NZD',CH:'CHF',JP:'JPY',PL:'PLN',CZ:'CZK',AT:'EUR',BE:'EUR',CY:'EUR',DE:'EUR',EE:'EUR',ES:'EUR',FI:'EUR',FR:'EUR',GR:'EUR',HR:'EUR',IE:'EUR',IT:'EUR',LT:'EUR',LU:'EUR',LV:'EUR',MT:'EUR',NL:'EUR',PT:'EUR',SI:'EUR',SK:'EUR'};
    if(byRegion[region])return byRegion[region];

    timezone=String(timezone||'');
    if(timezone==='Europe/Stockholm')return 'SEK';
    if(timezone==='Europe/Oslo')return 'NOK';
    if(timezone==='Europe/Copenhagen')return 'DKK';
    if(timezone==='Europe/London')return 'GBP';
    if(timezone==='Europe/Zurich')return 'CHF';
    if(timezone==='Europe/Warsaw')return 'PLN';
    if(timezone==='Europe/Prague')return 'CZK';
    if(/^Europe\//.test(timezone))return 'EUR';
    return 'EUR';
  }

  function formatMoney(amount,currency,locale){
    if(!isFinite(amount)||amount<=0)return '';
    var code=String(currency||'EUR').toUpperCase();
    try{
      return new Intl.NumberFormat(locale||undefined,{style:'currency',currency:code,currencyDisplay:'narrowSymbol',minimumFractionDigits:0,maximumFractionDigits:code==='JPY'?0:2}).format(amount);
    }catch(error){
      return Math.round(amount*100)/100+' '+code;
    }
  }

  function listingPrice(listing,locale){
    var amount=Number(listing&&(listing.buyNowPrice||listing.nextBid||listing.currentBid||listing.openingBid)||0);
    if(!isFinite(amount)||amount<=0)return '';
    try{
      return new Intl.NumberFormat(locale||'sv-SE',{
        style:'currency',
        currency:String(listing&&listing.currency||'SEK'),
        maximumFractionDigits:0
      }).format(amount);
    }catch(error){
      return Math.round(amount)+' kr';
    }
  }

  function listingEndsText(value,locale){
    var date=new Date(value);
    if(!value||isNaN(date.getTime()))return '';
    var resolvedLocale=locale||'sv-SE';
    return 'Ends '+date.toLocaleDateString(resolvedLocale,{
      day:'numeric',
      month:'short'
    })+' · '+date.toLocaleTimeString(resolvedLocale,{
      hour:'2-digit',
      minute:'2-digit'
    });
  }

  return Object.freeze({
    safeExternalUrl:safeExternalUrl,
    buyNowCandidates:buyNowCandidates,
    cacheKey:cacheKey,
    normalizeIdentity:normalizeIdentity,
    isRelevantListing:isRelevantListing,
    regionCurrency:regionCurrency,
    formatMoney:formatMoney,
    listingPrice:listingPrice,
    listingEndsText:listingEndsText
  });
});
