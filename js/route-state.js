(function(root,factory){
  var api=factory();

  if(typeof module==='object'&&module.exports){
    module.exports=api;
  }

  if(root){
    root.GroovyRouteState=api;
  }
})(typeof window!=='undefined'?window:null,function(){
  function profileUsernameFromPath(pathname){
    var match=String(pathname||'').match(/^\/groovy\/user\/([^\/]+)\/?$/);

    if(!match)return null;

    try{
      return decodeURIComponent(match[1]);
    }catch(error){
      return null;
    }
  }

  function resolveProfileView(sessionUser,profile){
    if(!sessionUser)return 'login-required';
    if(!profile)return 'not-found';
    if(profile.id===sessionUser.id)return 'own';
    return 'other';
  }

  function libraryViewFromSearch(search){
    try{
      return new URLSearchParams(String(search||'')).get('view')==='wishlist'
        ?'wishlist'
        :'collection';
    }catch(error){
      return 'collection';
    }
  }

  function albumIdentityKey(artist,title){
    function normalize(value){
      var text=String(value||'').toLowerCase();
      if(text.normalize)text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return text.replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
    }

    return normalize(artist)+'|'+normalize(title);
  }

  return {
    profileUsernameFromPath:profileUsernameFromPath,
    resolveProfileView:resolveProfileView,
    libraryViewFromSearch:libraryViewFromSearch,
    albumIdentityKey:albumIdentityKey
  };
});
