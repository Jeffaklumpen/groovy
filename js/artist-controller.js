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
    var currentOverview=null;
    var currentWikipedia=null;
    var currentNavigation={};
    var overviewCache=new Map();
    var identityCache=new Map();

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
      currentOverview=null;
      currentWikipedia=null;
      currentNavigation={};
      setTabState(false);
      view.hide();
    }

    function emptyProfile(id,name){
      return {
        id:Number(id)||null,
        name:String(name||''),
        current_members:[],
        past_members:[],
        genres:[],
        official_url:''
      };
    }

    function cachedProfile(row,id,name){
      if(!row)return null;
      return {
        id:Number(row.discogs_artist_id)||Number(id)||null,
        name:String(row.artist_name||name||''),
        current_members:Array.isArray(row.current_members)?row.current_members:[],
        past_members:Array.isArray(row.past_members)?row.past_members:[],
        genres:Array.isArray(row.genres)?row.genres:[],
        official_url:String(row.official_url||''),
        fetched_at:row.fetched_at||null
      };
    }

    async function loadCachedProfile(id){
      if(!id)return null;
      var result=await api
        .from('artist_profile_cache')
        .select('discogs_artist_id,artist_name,current_members,past_members,genres,official_url,fetched_at')
        .eq('discogs_artist_id',Number(id))
        .maybeSingle();
      if(result.error){
        log('warn','Could not load cached artist profile:',result.error);
        return null;
      }
      return result.data||null;
    }

    function artistCacheKey(name){
      return String(name||'').trim().toLowerCase();
    }

    async function localArtistByName(name){
      if(!name)return null;
      var key=artistCacheKey(name);
      if(identityCache.has(key))return identityCache.get(key);

      var promise=api
        .from('artists')
        .select('name,discogs_artist_id')
        .ilike('name',String(name))
        .maybeSingle()
        .then(function(result){
          if(result.error)throw result.error;
          return result.data||null;
        })
        .catch(function(error){
          identityCache.delete(key);
          log('warn','Could not resolve local artist:',error);
          return null;
        });

      identityCache.set(key,promise);
      return promise;
    }

    function loadOverview(name,force){
      var key=artistCacheKey(name);
      if(!key)return Promise.resolve(null);
      if(!force&&overviewCache.has(key))return overviewCache.get(key);

      var promise=api.rpc('get_artist_overview',{p_artist_name:String(name)})
        .then(function(result){
          if(result.error)throw result.error;
          return result.data||{};
        })
        .catch(function(error){
          overviewCache.delete(key);
          throw error;
        });

      overviewCache.set(key,promise);
      return promise;
    }

    function setOverviewCache(name,value){
      var key=artistCacheKey(name);
      if(key)overviewCache.set(key,Promise.resolve(value||{}));
    }

    function prefetch(input){
      input=input||{};
      var name=String(input.name||'').trim();
      if(!name)return Promise.resolve(false);

      var jobs=[loadOverview(name,false)];
      if(!Number(input.id))jobs.push(localArtistByName(name));
      else jobs.push(loadCachedProfile(Number(input.id)));

      return Promise.all(jobs).then(function(){return true;}).catch(function(){return false;});
    }

    async function localArtistByDiscogsId(id){
      if(!id)return null;
      var result=await api
        .from('artists')
        .select('name,discogs_artist_id')
        .eq('discogs_artist_id',Number(id))
        .maybeSingle();
      if(result.error){
        log('warn','Could not resolve local Discogs artist:',result.error);
        return null;
      }
      return result.data||null;
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

    function stateWithArtistName(state,name){
      return Object.assign({},state||{},{artistName:String(name||'')});
    }

    async function navigateResolved(input,state){
      input=input||{};
      var id=Number(input.id)||0;
      var name=String(input.name||'').trim();

      if(id&&name){
        return onNavigate(Core.route(id,name),stateWithArtistName(state,name));
      }

      if(name){
        var local=await localArtistByName(name);
        if(local&&local.discogs_artist_id){
          return onNavigate(
            Core.route(local.discogs_artist_id,local.name||name),
            stateWithArtistName(state,local.name||name)
          );
        }
      }

      if(id&&!name){
        var cached=await loadCachedProfile(id);
        if(cached&&cached.artist_name){
          return onNavigate(Core.route(id,cached.artist_name),stateWithArtistName(state,cached.artist_name));
        }
        var linked=await localArtistByDiscogsId(id);
        if(linked&&linked.name){
          return onNavigate(Core.route(id,linked.name),stateWithArtistName(state,linked.name));
        }
      }

      var profile=await fetchProfile({id:id||null,name:name||''});
      if(!profile||!profile.id||!profile.name)throw new Error('Artist could not be resolved');
      return onNavigate(
        Core.route(profile.id,profile.name),
        stateWithArtistName(state,profile.name)
      );
    }

    function renderCurrent(version){
      if(version!==requestVersion||!active||!currentProfile||!currentOverview)return;
      view.render({
        profile:currentProfile,
        overview:currentOverview,
        wikipedia:currentWikipedia,
        navigation:currentNavigation
      });
    }

    function loadProfileInBackground(id,name,version){
      loadCachedProfile(id).then(function(row){
        if(version!==requestVersion||!active)return null;

        var profile=cachedProfile(row,id,name);
        if(profile){
          currentProfile=profile;
          renderCurrent(version);

          var fetchedAt=profile.fetched_at?Date.parse(String(profile.fetched_at)):0;
          if(fetchedAt&&Date.now()-fetchedAt<30*24*60*60*1000)return null;
        }

        return fetchProfile({id:id,name:name}).then(function(freshProfile){
          if(version!==requestVersion||!active||!freshProfile)return;
          currentProfile=freshProfile;
          renderCurrent(version);
        });
      }).catch(function(error){
        log('warn','Could not refresh artist profile:',error);
      });
    }

    function verifyDiscographyInBackground(id,name,wikidataId,version){
      if(!id||!name||!/^Q\d+$/.test(String(wikidataId||'')))return;

      api.functions.invoke('discogs-search',{
        body:{
          action:'verifyArtistDiscography',
          artistId:Number(id),
          artistName:String(name),
          wikidataId:String(wikidataId)
        }
      }).then(async function(result){
        if(version!==requestVersion||!active||result.error||!result.data)return;
        if(!result.data.verified||!result.data.changed)return;

        var refreshed=await loadOverview(name,true);
        if(version!==requestVersion||!active||!refreshed)return;
        currentOverview=refreshed;
        renderCurrent(version);
        warmArtworkInBackground(id,name,currentOverview,version);
      }).catch(function(error){
        log('warn','Could not verify artist discography:',error);
      });
    }

    function loadWikipediaInBackground(id,name,version){
      wikipedia.load(name).then(function(result){
        if(version!==requestVersion||!active)return;
        currentWikipedia=result||null;
        renderCurrent(version);
        if(result&&result.wikidata_id){
          verifyDiscographyInBackground(id,name,result.wikidata_id,version);
        }
      }).catch(function(error){
        log('warn','Could not load Wikipedia artist information:',error);
      });
    }

    function warmArtworkInBackground(id,name,overview,version){
      var cache=overview&&overview.artwork_cache?overview.artwork_cache:{};
      if(!id||!name||cache.complete||!Core.number(cache.eligible))return;

      api.functions.invoke('discogs-search',{
        body:{
          action:'cacheArtistArtwork',
          artistId:Number(id),
          artistName:String(name)
        }
      }).then(async function(result){
        if(version!==requestVersion||!active)return;
        if(result.error||!result.data||!Core.number(result.data.cached_added))return;

        var refreshed=await api.rpc('get_artist_overview',{p_artist_name:String(name)});
        if(version!==requestVersion||!active||refreshed.error)return;
        currentOverview=refreshed.data||currentOverview;
        setOverviewCache(name,currentOverview);
        renderCurrent(version);
      }).catch(function(error){
        log('warn','Could not warm artist artwork cache:',error);
      });
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

      var id=Number(routeInfo&&routeInfo.id)||0;
      var name=String(state&&state.artistName||'').trim();

      try{
        if(!name){
          var identityResults=await Promise.all([
            loadCachedProfile(id),
            localArtistByDiscogsId(id)
          ]);
          if(version!==requestVersion||!active)return false;

          var cachedRow=identityResults[0];
          var linkedArtist=identityResults[1];
          if(cachedRow&&cachedRow.artist_name)name=String(cachedRow.artist_name);
          if(!name&&linkedArtist&&linkedArtist.name)name=String(linkedArtist.name);

          if(!name){
            var resolvedProfile=await fetchProfile({id:id});
            if(version!==requestVersion||!active)return false;
            if(!resolvedProfile||!resolvedProfile.name)throw new Error('Artist not found');
            name=String(resolvedProfile.name);
            currentProfile=resolvedProfile;
          }else{
            currentProfile=cachedProfile(cachedRow,id,name)||emptyProfile(id,name);
          }
        }else{
          // Normal in-app navigation already knows the artist name. Do not wait for
          // Discogs or even the profile cache before starting the local page read model.
          currentProfile=emptyProfile(id,name);
        }

        currentNavigation={
          backToAlbum:!!(state&&state.artistSource==='album'),
          backLabel:state&&state.artistBackLabel?String(state.artistBackLabel):'album'
        };

        var overviewResult=await loadOverview(name,false);
        if(version!==requestVersion||!active)return false;

        currentOverview=overviewResult||{};
        currentWikipedia=null;
        renderCurrent(version);

        // External/cached profile data enriches an already-visible page.
        loadProfileInBackground(id,name,version);
        loadWikipediaInBackground(id,name,version);
        warmArtworkInBackground(id,name,currentOverview,version);

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
      currentProfile:function(){return currentProfile;},
      prefetch:prefetch
    });
  }

  return Object.freeze({create:create});
});
