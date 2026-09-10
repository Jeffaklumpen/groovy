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

  return {
    profileUsernameFromPath:profileUsernameFromPath,
    resolveProfileView:resolveProfileView
  };
});
