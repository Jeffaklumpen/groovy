(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyStreaming=api;
})(typeof window!=='undefined'?window:null,function(){
  function searchQuery(artist,title){
    return [artist,title].filter(Boolean).join(' ');
  }

  function spotifySearchUrl(artist,title){
    return 'https://open.spotify.com/search/'+encodeURIComponent(searchQuery(artist,title));
  }

  function appleMusicSearchUrl(artist,title,savedUrl,storefront){
    if(/^https:\/\/(?:music|itunes)\.apple\.com\//.test(String(savedUrl||'')))return savedUrl;
    return 'https://music.apple.com/'+String(storefront||'us')+'/search?term='+encodeURIComponent(searchQuery(artist,title));
  }

  return Object.freeze({
    searchQuery:searchQuery,
    spotifySearchUrl:spotifySearchUrl,
    appleMusicSearchUrl:appleMusicSearchUrl
  });
});
