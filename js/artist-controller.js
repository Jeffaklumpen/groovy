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
    var identityResolutionCache=new Map();
    var discographyJobs=new Map();
    var artworkJobs=new Map();

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

    function resolveArtistIdentity(input){
      input=input||{};
      var id=Number(input.id)||0;
      var name=String(input.name||'').trim();
      if(id)return Promise.resolve({id:id,name:name||''});
      if(!name)return Promise.resolve(null);

      var key=artistCacheKey(name);
      return localArtistByName(name).then(function(local){
        if(local&&local.discogs_artist_id){
          return {
            id:Number(local.discogs_artist_id)||0,
            name:String(local.name||name)
          };
        }

        if(identityResolutionCache.has(key))return identityResolutionCache.get(key);

        var request=api.functions.invoke('discogs-search',{
          body:{action:'resolveArtist',artistName:name}
        }).then(function(result){
          if(result.error)throw result.error;
          if(result.data&&result.data.error)throw new Error(result.data.error);
          var resolved=result.data||null;
          if(!resolved||!Number(resolved.id))return null;

          var identity={
            name:String(resolved.name||name),
            discogs_artist_id:Number(resolved.id)
          };
          identityCache.set(key,Promise.resolve(identity));
          return {id:identity.discogs_artist_id,name:identity.name};
        }).catch(function(error){
          log('warn','Could not resolve lightweight artist identity:',error);
          return null;
        });

        identityResolutionCache.set(key,request);
        request.then(
          function(){identityResolutionCache.delete(key);},
          function(){identityResolutionCache.delete(key);}
        );
        return request;
      });
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

      return Promise.all([
        loadOverview(name,false),
        resolveArtistIdentity(input)
      ]).then(async function(results){
        var overview=results[0]||{};
        var identity=results[1]||null;
        var resolvedId=Number(input.id)||
          Number(identity&&identity.id)||
          Number(overview&&overview.summary&&overview.summary.discogs_artist_id)||
          0;

        if(!resolvedId)return true;

        if(Number(overview&&overview.summary&&overview.summary.discogs_artist_id)!==resolvedId){
          overview=await loadOverview(name,true);
        }

        if(!overview||!overview.discography_verified){
          var verified=await ensureDiscographyCached(resolvedId,name);
          if(verified&&verified.overview)overview=verified.overview;
        }

        if(overview&&overview.discography_verified){
          await ensureArtworkCached(resolvedId,name,overview);
        }

        return true;
      }).catch(function(error){
        log('warn','Could not prefetch artist page:',error);
        return false;
      });
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
        var resolved=await resolveArtistIdentity({id:id,name:name});
        if(resolved&&resolved.id){
          return onNavigate(
            Core.route(resolved.id,resolved.name||name),
            stateWithArtistName(state,resolved.name||name)
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

    function ensureDiscographyCached(id,name){
      var numericId=Number(id)||0;
      var cleanName=String(name||'').trim();
      if(!numericId||!cleanName)return Promise.resolve(null);

      var key=String(numericId);
      if(discographyJobs.has(key))return discographyJobs.get(key);

      var job=api.functions.invoke('discogs-search',{
        body:{
          action:'verifyArtistDiscography',
          artistId:numericId,
          artistName:cleanName
        }
      }).then(async function(result){
        if(result.error||!result.data)return null;
        var refreshed=await loadOverview(cleanName,true);
        return {result:result.data,overview:refreshed||{}};
      }).catch(function(error){
        log('warn','Could not verify artist discography:',error);
        return null;
      });

      discographyJobs.set(key,job);
      job.then(
        function(){discographyJobs.delete(key);},
        function(){discographyJobs.delete(key);}
      );
      return job;
    }

    function ensureArtworkCached(id,name,overview){
      var numericId=Number(id)||0;
      var cleanName=String(name||'').trim();
      var cache=overview&&overview.artwork_cache?overview.artwork_cache:{};
      if(!numericId||!cleanName||cache.complete||!Core.number(cache.eligible)){
        return Promise.resolve(null);
      }

      var key=String(numericId);
      if(artworkJobs.has(key))return artworkJobs.get(key);

      var job=api.functions.invoke('discogs-search',{
        body:{
          action:'cacheArtistArtwork',
          artistId:numericId,
          artistName:cleanName
        }
      }).then(async function(result){
        if(result.error||!result.data)return null;
        if(!Core.number(result.data.cached_added))return {result:result.data,overview:null};

        var refreshed=await loadOverview(cleanName,true);
        return {result:result.data,overview:refreshed||{}};
      }).catch(function(error){
        log('warn','Could not warm artist artwork cache:',error);
        return null;
      });

      artworkJobs.set(key,job);
      job.then(
        function(){artworkJobs.delete(key);},
        function(){artworkJobs.delete(key);}
      );
      return job;
    }

    function verifyDiscographyInBackground(id,name,version){
      ensureDiscographyCached(id,name).then(function(payload){
        if(version!==requestVersion||!active)return;

        if(!payload||!payload.overview){
          currentOverview=Object.assign({},currentOverview||{},{
            discography_source:'error'
          });
          renderCurrent(version);
          return;
        }

        currentOverview=payload.overview;
        renderCurrent(version);

        if(currentOverview.discography_verified){
          warmArtworkInBackground(id,name,currentOverview,version);
        }
      }).catch(function(error){
        if(version!==requestVersion||!active)return;
        log('warn','Could not finish artist discography verification:',error);
        currentOverview=Object.assign({},currentOverview||{},{
          discography_source:'error'
        });
        renderCurrent(version);
      });
    }

    function loadWikipediaInBackground(id,name,version){
      wikipedia.load(name).then(function(result){
        if(version!==requestVersion||!active)return;
        currentWikipedia=result||null;
        renderCurrent(version);
      }).catch(function(error){
        log('warn','Could not load Wikipedia artist information:',error);
      });
    }

    function warmArtworkInBackground(id,name,overview,version){
      ensureArtworkCached(id,name,overview).then(function(payload){
        if(version!==requestVersion||!active||!payload||!payload.overview)return;
        currentOverview=payload.overview;
        setOverviewCache(name,currentOverview);
        renderCurrent(version);
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

        // A verified shared discography is rendered immediately from Postgres.
        // Only uncached artists need verification; artwork warming starts after
        // membership is known so Apple work is limited to the albums we display.
        if(currentOverview.discography_verified){
          warmArtworkInBackground(id,name,currentOverview,version);
        }else{
          verifyDiscographyInBackground(id,name,version);
        }

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
