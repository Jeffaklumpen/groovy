(function(root,factory){
  var api=factory(root&&root.GroovyArtistCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyArtistController=api;
})(typeof window!=='undefined'?window:null,function(Core){
  'use strict';

  function create(options){
    options=options||{};
    var api=options.api;
    var view=options.view;
    var wikipedia=options.wikipedia;
    var elements=options.elements||{};
    var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
    var onNavigate=typeof options.onNavigate==='function'?options.onNavigate:function(){};
    var onBack=typeof options.onBack==='function'?options.onBack:function(){};
    var onOpenAlbum=typeof options.onOpenAlbum==='function'?options.onOpenAlbum:function(){};
    var onRequireAuth=typeof options.onRequireAuth==='function'?options.onRequireAuth:function(){};
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};
    var active=false;
    var requestVersion=0;
    var currentProfile=null;

    if(!Core)throw new Error('Artist controller requires GroovyArtistCore');
    if(!api||!api.functions||typeof api.rpc!=='function')throw new Error('Artist controller requires Supabase');
    if(!view)throw new Error('Artist controller requires a view');
    if(!wikipedia)throw new Error('Artist controller requires Wikipedia service');

    function log(level,message,error){onLog(level,message,error);}

    function setTabState(open){
      var buttons=[elements.collectionTab,elements.wishlistTab,elements.communityTab];
      buttons.forEach(function(button){
        if(!button)return;
        if(open)button.classList.remove('active');
        if(open)button.setAttribute('aria-current','false');
      });
    }

    function hidePage(){
      requestVersion++;
      active=false;
      currentProfile=null;
      setTabState(false);
      view.hide();
    }

    async function fetchProfile(input){
      var body={action:'artistProfile'};
      if(input&&input.id)body.artistId=Number(input.id);
      else if(input&&input.name)body.artistName=String(input.name);
      var result=await api.functions.invoke('discogs-search',{body:body});
      if(result.error)throw result.error;
      if(result.data&&result.data.error)throw new Error(result.data.error);
      return result.data||null;
    }

    async function navigateResolved(input,state){
      var profile=input&&input.id?input:await fetchProfile(input||{});
      if(!profile||!profile.id)throw new Error('Artist could not be resolved');
      return onNavigate(Core.route(profile.id,profile.name),state||{});
    }

    async function renderPage(routeInfo,state){
      var user=await getCurrentUser();
      if(!user){
        hidePage();
        onRequireAuth();
        return false;
      }

      var version=++requestVersion;
      active=true;
      setTabState(true);
      view.show();
      view.loading();

      try{
        var profile=await fetchProfile({id:routeInfo&&routeInfo.id});
        if(version!==requestVersion||!active)return false;
        if(!profile)throw new Error('Artist not found');
        currentProfile=profile;

        var results=await Promise.all([
          api.rpc('get_artist_overview',{p_artist_name:profile.name}),
          wikipedia.load(profile.name).catch(function(error){
            log('warn','Could not load Wikipedia artist information:',error);
            return null;
          })
        ]);
        if(version!==requestVersion||!active)return false;
        if(results[0].error)throw results[0].error;

        var navigation={
          backToAlbum:!!(state&&state.artistSource==='album'),
          backLabel:state&&state.artistBackLabel?String(state.artistBackLabel):'album'
        };
        view.render({profile:profile,overview:results[0].data||{},wikipedia:results[1],navigation:navigation});
        return true;
      }catch(error){
        if(version!==requestVersion)return false;
        log('error','Could not load artist page:',error);
        view.error(error&&error.message?error.message:'Try again in a moment.');
        return false;
      }
    }

    async function handleClick(event){
      var back=event.target&&event.target.closest?event.target.closest('[data-artist-back-album]'):null;
      if(back){
        event.preventDefault();
        onBack();
        return;
      }
      var album=event.target&&event.target.closest?event.target.closest('[data-artist-master-id],[data-artist-album-id]'):null;
      if(album){
        event.preventDefault();
        onOpenAlbum({
          albumId:album.getAttribute('data-artist-album-id'),
          masterId:album.getAttribute('data-artist-master-id'),
          artistName:currentProfile&&currentProfile.name?currentProfile.name:'Artist'
        });
      }
    }

    if(elements.page)elements.page.addEventListener('click',handleClick);

    return Object.freeze({
      renderPage:renderPage,
      hidePage:hidePage,
      navigateByName:function(name,state){return navigateResolved({name:name},state);},
      navigateResolved:navigateResolved,
      isActive:function(){return active;},
      currentProfile:function(){return currentProfile;}
    });
  }

  return Object.freeze({create:create});
});
