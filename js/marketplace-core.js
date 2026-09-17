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

  return Object.freeze({
    safeExternalUrl:safeExternalUrl,
    buyNowCandidates:buyNowCandidates
  });
});
