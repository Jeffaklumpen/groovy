(function(root,factory){
  var api=factory();

  if(typeof module==='object'&&module.exports){
    module.exports=api;
  }

  if(root){
    root.GroovyRouteState=api;
    installRuntimeFixes(root);
  }

  function installRuntimeFixes(windowObject){
    if(!windowObject||!windowObject.document)return;

    /*
     * app.js guards public shelf routes inside loadCollection(), but its old
     * implementation increments collectionLoadVersion before that guard.
     * A stray own-library reload can therefore invalidate an in-flight
     * loadOtherUserCollection() and leave the previous user's records visible.
     * Intercept the app.js assignment so public shelf routes never enter the
     * own-library loader in the first place.
     */
    try{
      var guardedLoadCollection;
      Object.defineProperty(windowObject,'loadCollection',{
        configurable:true,
        enumerable:true,
        get:function(){return guardedLoadCollection;},
        set:function(loader){
          if(typeof loader!=='function'){
            guardedLoadCollection=loader;
            return;
          }

          if(loader.__groovyPublicShelfGuard){
            guardedLoadCollection=loader;
            return;
          }

          var wrapped=function(){
            var pathname=String(windowObject.location&&windowObject.location.pathname||'');
            if(/^\/(?:user|shelf)\/[^\/]+\/?$/.test(pathname)){
              return Promise.resolve();
            }
            return loader.apply(this,arguments);
          };

          wrapped.__groovyPublicShelfGuard=true;
          wrapped.__groovyOriginal=loader;
          guardedLoadCollection=wrapped;
        }
      });
    }catch(error){}

    /* Final cascade fixes for album detail rules that are intentionally kept
       here so they load after the main stylesheet without touching mobile. */
    try{
      var style=windowObject.document.createElement('style');
      style.id='groovy-route-runtime-fixes';
      style.textContent=
        '.detail-social-context[hidden]{display:none!important;}'+
        '@media screen and (min-width:761px){'+
          '.detail-shelf-actions:not([hidden]) + .detail-streaming-row:after{top:-5px!important;}'+
        '}';
      (windowObject.document.head||windowObject.document.documentElement).appendChild(style);
    }catch(error){}
  }
})(typeof window!=='undefined'?window:null,function(){
  function profileUsernameFromPath(pathname){
    var match=String(pathname||'').match(/^\/(?:user|shelf)\/([^\/]+)\/?$/);

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

  function statisticsFromSearch(search){
    try{
      return new URLSearchParams(String(search||'')).get('stats')==='1';
    }catch(error){
      return false;
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
    statisticsFromSearch:statisticsFromSearch,
    albumIdentityKey:albumIdentityKey
  };
});
