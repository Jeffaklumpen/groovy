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

  return Object.freeze({
    safeExternalUrl:safeExternalUrl,
    buyNowCandidates:buyNowCandidates,
    cacheKey:cacheKey,
    normalizeIdentity:normalizeIdentity,
    isRelevantListing:isRelevantListing
  });
});
