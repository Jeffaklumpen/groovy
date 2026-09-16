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

    var publicShelfLoadToken=0;
    var publicShelfSyncTimer=null;

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

    function publicShelfUsername(){
      if(!windowObject.GroovyRouteState)return null;
      return windowObject.GroovyRouteState.profileUsernameFromPath(
        windowObject.location&&windowObject.location.pathname
      );
    }

    function publicShelfStillCurrent(username){
      var current=publicShelfUsername();
      return !!current&&String(current).toLocaleLowerCase()===String(username||'').toLocaleLowerCase();
    }

    function emptySides(){
      if(typeof windowObject.emptyRecordSides==='function')return windowObject.emptyRecordSides();
      return {A:[],B:[],C:[],D:[],E:[],F:[],G:[],H:[]};
    }

    function copyDetailsFromCollectionRow(item){
      return {
        discogsReleaseId:item.discogs_release_id||null,
        mediaCondition:item.media_condition||'',
        sleeveCondition:item.sleeve_condition||'',
        country:item.pressing_country||'',
        year:item.pressing_year||'',
        label:item.pressing_label||'',
        catalogNumber:item.catalog_number||'',
        matrixA:item.matrix_runout_a||'',
        matrixB:item.matrix_runout_b||'',
        matrixC:item.matrix_runout_c||'',
        matrixD:item.matrix_runout_d||'',
        matrixE:item.matrix_runout_e||'',
        matrixF:item.matrix_runout_f||'',
        matrixG:item.matrix_runout_g||'',
        matrixH:item.matrix_runout_h||'',
        matchStatus:item.pressing_match_status||''
      };
    }

    async function syncPublicShelfRecords(){
      var username=publicShelfUsername();
      if(!username)return;
      if(windowObject.GroovyRouteState.libraryViewFromSearch(windowObject.location.search)==='wishlist')return;
      if(typeof supabaseClient==='undefined')return;

      var token=++publicShelfLoadToken;

      try{
        var sessionResult=await supabaseClient.auth.getSession();
        var sessionUser=sessionResult&&sessionResult.data&&sessionResult.data.session&&sessionResult.data.session.user;
        if(!sessionUser||token!==publicShelfLoadToken||!publicShelfStillCurrent(username))return;

        var profileResult=await supabaseClient
          .from('profiles')
          .select('id,username')
          .ilike('username',username)
          .maybeSingle();

        if(profileResult.error)throw profileResult.error;
        var profile=profileResult.data;
        if(!profile||profile.id===sessionUser.id)return;
        if(token!==publicShelfLoadToken||!publicShelfStillCurrent(username))return;

        var collectionResult=await supabaseClient
          .from('collections')
          .select(`
            id,
            collection_number,
            sort_order,
            shelf_id,
            shelf_sort_order,
            cover_url,
            discogs_style,
            discogs_release_id,
            media_condition,
            sleeve_condition,
            pressing_country,
            pressing_year,
            pressing_label,
            catalog_number,
            matrix_runout_a,
            matrix_runout_b,
            matrix_runout_c,
            matrix_runout_d,
            matrix_runout_e,
            matrix_runout_f,
            matrix_runout_g,
            matrix_runout_h,
            pressing_match_status,
            albums(
              id,
              title,
              release_year,
              genre,
              cover_url,
              apple_collection_url,
              discogs_master_id,
              artists(id,name),
              tracks(id,disc_side,track_number,title)
            )
          `)
          .eq('user_id',profile.id)
          .order('sort_order',{ascending:true});

        if(collectionResult.error)throw collectionResult.error;
        if(token!==publicShelfLoadToken||!publicShelfStillCurrent(username))return;

        var rows=collectionResult.data||[];
        var albumIds=rows.map(function(item){return item.albums&&item.albums.id;}).filter(Boolean);
        var ratingMap={};

        if(albumIds.length){
          var ratingResult=await supabaseClient
            .from('album_ratings')
            .select('album_id,user_id,rating')
            .in('album_id',albumIds);

          if(!ratingResult.error){
            (ratingResult.data||[]).forEach(function(row){
              var id=String(row.album_id);
              var entry=ratingMap[id]||(ratingMap[id]={own:0,total:0,count:0});
              var rating=Math.max(0,Math.min(5,Number(row.rating)||0));
              if(!rating)return;
              entry.total+=rating;
              entry.count++;
              if(row.user_id===sessionUser.id)entry.own=rating;
            });
          }
        }

        if(token!==publicShelfLoadToken||!publicShelfStillCurrent(username))return;

        windowObject.collectionLoadVersion=(Number(windowObject.collectionLoadVersion)||0)+1;
        windowObject.viewedUserId=profile.id;

        windowObject.records=rows
          .filter(function(item){return item.albums;})
          .map(function(item,index){
            var album=item.albums;
            var sides=emptySides();
            var artist=album.artists&&album.artists.name
              ?String(album.artists.name).replace(/\s*\(\d+\)$/,'')
              :'Okänd artist';

            (Array.isArray(album.tracks)?album.tracks:[])
              .slice()
              .sort(function(a,b){
                var sideCompare=String(a.disc_side||'').localeCompare(String(b.disc_side||''));
                return sideCompare||((a.track_number||0)-(b.track_number||0))||((a.id||0)-(b.id||0));
              })
              .forEach(function(track){
                var side=String(track.disc_side||'').toUpperCase();
                if(!sides[side])return;
                sides[side].push({
                  id:track.id,
                  title:track.title||'Okänd låt',
                  trackNumber:track.track_number==null?null:track.track_number,
                  duration:''
                });
              });

            var ratings=ratingMap[String(album.id)]||{own:0,total:0,count:0};
            var average=ratings.count?Math.round((ratings.total/ratings.count)*10)/10:0;

            return [
              index+1,
              artist,
              album.title||'Okänd titel',
              album.release_year||'',
              item.discogs_style||album.genre||'',
              ratings.own||0,
              item.cover_url||album.cover_url||'',
              sides,
              album.id,
              item.id,
              album.discogs_master_id||'',
              copyDetailsFromCollectionRow(item),
              album.apple_collection_url||'',
              item.shelf_id||'',
              item.shelf_sort_order==null?null:item.shelf_sort_order,
              average,
              ratings.count||0
            ];
          });

        var countElement=windowObject.document.getElementById('collectionCount');
        if(countElement)countElement.textContent=windowObject.records.length+' RECORDS IN COLLECTION';
        if(typeof windowObject.buildGrid==='function')windowObject.buildGrid();
      }catch(error){
        console.error('Could not synchronize public shelf records:',error);
        if(token!==publicShelfLoadToken||!publicShelfStillCurrent(username))return;
        windowObject.collectionLoadVersion=(Number(windowObject.collectionLoadVersion)||0)+1;
        windowObject.records=[];
        if(typeof windowObject.buildGrid==='function')windowObject.buildGrid();
      }
    }

    function queuePublicShelfSync(delay){
      clearTimeout(publicShelfSyncTimer);
      publicShelfSyncTimer=setTimeout(function(){syncPublicShelfRecords();},delay==null?80:delay);
    }

    windowObject.groovySyncPublicShelfRecords=syncPublicShelfRecords;

    try{
      ['pushState','replaceState'].forEach(function(method){
        var original=windowObject.history&&windowObject.history[method];
        if(typeof original!=='function'||original.__groovyShelfSync)return;
        var wrapped=function(){
          var result=original.apply(this,arguments);
          queuePublicShelfSync(100);
          return result;
        };
        wrapped.__groovyShelfSync=true;
        windowObject.history[method]=wrapped;
      });
    }catch(error){}

    windowObject.addEventListener('popstate',function(){queuePublicShelfSync(100);});
    windowObject.addEventListener('load',function(){
      queuePublicShelfSync(120);
      setTimeout(function(){syncPublicShelfRecords();},700);
    });

    try{
      var style=windowObject.document.createElement('style');
      style.id='groovy-route-runtime-fixes';
      style.textContent=
        '.detail-social-context[hidden]{display:none!important;}'+
        '@media screen and (min-width:761px){'+
          '.detail-streaming-row{margin-top:28px!important;}'+
          '.detail-streaming-row:after{content:""!important;position:absolute!important;left:4px!important;right:4px!important;top:-14px!important;height:1px!important;background:rgba(255,255,255,.09)!important;pointer-events:none!important;}'+
          '.detail-shelf-actions:not([hidden]) + .detail-streaming-row:after{top:-14px!important;}'+
        '}';
      (windowObject.document.head||windowObject.document.documentElement).appendChild(style);
    }catch(error){}

    function loadDetailEnhancements(){
      if(!windowObject.document.querySelector('link[data-groovy-detail-enhancements]')){
        var link=windowObject.document.createElement('link');
        link.rel='stylesheet';
        link.href='/css/detail-enhancements.css?v=5';
        link.setAttribute('data-groovy-detail-enhancements','true');
        (windowObject.document.head||windowObject.document.documentElement).appendChild(link);
      }

      if(!windowObject.document.querySelector('script[data-groovy-detail-enhancements]')){
        var script=windowObject.document.createElement('script');
        script.src='/js/detail-enhancements-v2.js?v=5';
        script.async=false;
        script.setAttribute('data-groovy-detail-enhancements','true');
        (windowObject.document.body||windowObject.document.documentElement).appendChild(script);
      }
    }

    if(windowObject.document.readyState==='complete'){
      setTimeout(loadDetailEnhancements,0);
    }else{
      windowObject.addEventListener('load',loadDetailEnhancements,{once:true});
    }
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
