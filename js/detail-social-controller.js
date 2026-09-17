(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory();
  }else{
    root.GroovyDetailSocialController=factory();
  }
})(typeof window!=='undefined'?window:null,function(){
  function create(options){
    options=options||{};

    var api=options.api;
    var win=options.window||((typeof window!=='undefined')?window:null);
    var doc=options.document||(win&&win.document)||null;
    var element=options.element||null;
    var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
    var getViewedUserId=typeof options.getViewedUserId==='function'?options.getViewedUserId:function(){return null;};
    var getLibraryView=typeof options.getLibraryView==='function'?options.getLibraryView:function(){return win&&win.libraryView;};
    var getOpenRecordIndex=typeof options.getOpenRecordIndex==='function'?options.getOpenRecordIndex:function(){return -1;};
    var onNavigate=typeof options.onNavigate==='function'?options.onNavigate:function(){};
    var escapeHtml=typeof options.escapeHtml==='function'?options.escapeHtml:function(value){
      return String(value==null?'':value).replace(/[&<>"']/g,function(char){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
      });
    };
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};
    var now=typeof options.now==='function'?options.now:Date.now;
    var requestVersion=0;
    var cache=new Map();
    var bound=false;

    if(!api)throw new Error('Detail social controller requires an API client');

    function log(level,message,error){onLog(level,message,error);}

    function cacheGet(key){
      var item=cache.get(key);
      if(!item)return null;
      if(now()-item.time>120000){cache.delete(key);return null;}
      return item.value;
    }

    function cacheSet(key,value){
      cache.set(key,{time:now(),value:value});
      if(cache.size>120){
        var first=cache.keys().next();
        if(!first.done)cache.delete(first.value);
      }
    }

    function clearCache(){cache.clear();}

    function hide(){
      if(!element)return;
      element.hidden=true;
      element.innerHTML='';
      element.classList.remove('own-match');
    }

    function renderFollowedCollectors(profiles){
      if(!element||!profiles||!profiles.length){hide();return;}
      element.classList.remove('own-match');
      element.hidden=false;

      var compact=win&&win.matchMedia&&win.matchMedia('(max-width:760px)').matches;
      var slotLimit=compact?4:10;
      var hasMore=profiles.length>slotLimit;
      var visibleLimit=hasMore?slotLimit-1:slotLimit;
      var visibleProfiles=profiles.slice(0,visibleLimit);
      var extraProfiles=profiles.slice(visibleLimit);

      function personButton(profile,extraClass){
        var username=profile.username||'Collector';
        return '<button class="detail-social-person'+(extraClass?' '+extraClass:'')+'" type="button" data-detail-social-username="'+escapeHtml(username)+'" data-tooltip="'+escapeHtml(username)+'" aria-label="View '+escapeHtml(username)+'">'+
          '<span class="detail-social-avatar" style="background-image:url(&quot;'+escapeHtml(profile.avatar_url||'/assets/images/avatar-placeholder.png')+'&quot;)"></span>'+
          '<span class="detail-social-person-name">'+escapeHtml(username)+'</span>'+
        '</button>';
      }

      element.innerHTML=
        '<div class="detail-social-heading"><strong>Also collected by</strong><small>Collectors you follow</small></div>'+
        '<div class="detail-social-people">'+
          visibleProfiles.map(function(profile){return personButton(profile,'');}).join('')+
          (hasMore?'<button class="detail-social-more" type="button" data-detail-social-more aria-expanded="false" aria-label="Show more collectors">…</button>':'')+
        '</div>'+
        (hasMore?'<div class="detail-social-menu" data-detail-social-menu hidden><div class="detail-social-menu-title">More collectors</div><div class="detail-social-menu-list">'+extraProfiles.map(function(profile){return personButton(profile,'detail-social-menu-person');}).join('')+'</div></div>':'');
    }

    function renderOwnCollectionMatch(){
      if(!element)return;
      element.classList.add('own-match');
      element.hidden=false;
      element.innerHTML=
        '<span class="detail-social-check" aria-hidden="true">✓</span>'+
        '<div class="detail-own-match-copy"><span>COLLECTION MATCH</span><strong>This record is also in your collection</strong></div>';
    }

    function isCurrent(request,index){
      return request===requestVersion&&getOpenRecordIndex()===index;
    }

    async function openForRecord(record,index){
      var request=++requestVersion;
      hide();
      if(!record||!record[8])return;

      var sessionUser=await getCurrentUser();
      if(!isCurrent(request,index))return;
      if(!sessionUser)return;

      var albumId=record[8];
      var masterId=String(record[10]||'').trim();
      var matchKey=masterId?'master:'+masterId:'album:'+albumId;

      try{
        if(getViewedUserId()!==null){
          var ownKey='own:'+sessionUser.id+':'+matchKey;
          var ownMatch=cacheGet(ownKey);
          if(ownMatch===null){
            var ownQuery=api.from('collections')
              .select(masterId?'id,albums!inner(discogs_master_id)':'id')
              .eq('user_id',sessionUser.id)
              .limit(1);
            ownQuery=masterId
              ?ownQuery.eq('albums.discogs_master_id',masterId)
              :ownQuery.eq('album_id',albumId);
            var ownResult=await ownQuery;
            if(ownResult.error)throw ownResult.error;
            ownMatch=!!(ownResult.data&&ownResult.data.length);
            cacheSet(ownKey,ownMatch);
          }
          if(!isCurrent(request,index))return;
          if(ownMatch)renderOwnCollectionMatch();
          return;
        }

        if(getLibraryView()==='wishlist')return;

        var followedKey='followed:'+sessionUser.id+':'+matchKey;
        var cachedProfiles=cacheGet(followedKey);
        if(cachedProfiles!==null){
          if(isCurrent(request,index))renderFollowedCollectors(cachedProfiles);
          return;
        }

        var followResult=await api.from('user_follows')
          .select('followed_id')
          .eq('follower_id',sessionUser.id);
        if(followResult.error)throw followResult.error;
        var followedIds=(followResult.data||[]).map(function(row){return row.followed_id;}).filter(Boolean);
        if(!followedIds.length){cacheSet(followedKey,[]);return;}

        var collectionQuery=api.from('collections')
          .select(masterId?'user_id,albums!inner(discogs_master_id)':'user_id')
          .in('user_id',followedIds);
        collectionQuery=masterId
          ?collectionQuery.eq('albums.discogs_master_id',masterId)
          :collectionQuery.eq('album_id',albumId);
        var collectionResult=await collectionQuery;
        if(collectionResult.error)throw collectionResult.error;
        var matchingIds=Array.from(new Set((collectionResult.data||[]).map(function(row){return row.user_id;}).filter(Boolean)));
        if(!matchingIds.length){cacheSet(followedKey,[]);return;}

        var profileResult=await api.from('profiles')
          .select('id,username,avatar_url')
          .in('id',matchingIds);
        if(profileResult.error)throw profileResult.error;

        var order=new Map(matchingIds.map(function(id,pos){return [id,pos];}));
        var profiles=(profileResult.data||[]).slice().sort(function(a,b){
          return (order.get(a.id)||0)-(order.get(b.id)||0);
        });
        cacheSet(followedKey,profiles);
        if(!isCurrent(request,index))return;
        renderFollowedCollectors(profiles);
      }catch(error){
        log('warn','Could not load album collection matches:',error);
        if(isCurrent(request,index))hide();
      }
    }

    function positionMenu(menu){
      if(!menu)return;
      menu.style.top='';
      menu.style.bottom='';
      menu.style.maxHeight='';
      if(!win||!win.matchMedia||!win.matchMedia('(min-width:761px)').matches)return;
      var cover=doc&&doc.querySelector?doc.querySelector('.album-detail-cover'):null;
      if(!cover||!element)return;
      var coverRect=cover.getBoundingClientRect();
      var contextRect=element.getBoundingClientRect();
      var gap=6;
      var below=Math.floor(coverRect.bottom-contextRect.bottom-gap);
      var above=Math.floor(contextRect.top-coverRect.top-gap);
      if(below>=96||below>=above){
        menu.style.top='calc(100% + '+gap+'px)';
        menu.style.bottom='auto';
        menu.style.maxHeight=Math.max(72,Math.min(260,below))+'px';
      }else{
        menu.style.top='auto';
        menu.style.bottom='calc(100% + '+gap+'px)';
        menu.style.maxHeight=Math.max(72,Math.min(260,above))+'px';
      }
    }

    function handleContextClick(event){
      var moreButton=event.target.closest('[data-detail-social-more]');
      if(moreButton){
        event.preventDefault();
        event.stopPropagation();
        var menu=element.querySelector('[data-detail-social-menu]');
        if(!menu)return;
        var opening=menu.hidden;
        menu.hidden=!opening;
        moreButton.setAttribute('aria-expanded',opening?'true':'false');
        element.classList.toggle('menu-open',opening);
        if(opening&&win&&typeof win.requestAnimationFrame==='function')win.requestAnimationFrame(function(){positionMenu(menu);});
        return;
      }

      var button=event.target.closest('[data-detail-social-username]');
      if(!button)return;
      var username=button.getAttribute('data-detail-social-username');
      if(!username)return;
      onNavigate(username);
    }

    function handleDocumentClick(event){
      if(!element||element.hidden||element.contains(event.target))return;
      var menu=element.querySelector('[data-detail-social-menu]');
      var moreButton=element.querySelector('[data-detail-social-more]');
      if(menu)menu.hidden=true;
      if(moreButton)moreButton.setAttribute('aria-expanded','false');
      element.classList.remove('menu-open');
    }

    function close(){
      requestVersion++;
      hide();
    }

    function bind(){
      if(bound)return;
      bound=true;
      if(win&&typeof win.addEventListener==='function')win.addEventListener('groovy-follow-changed',clearCache);
      if(element&&typeof element.addEventListener==='function')element.addEventListener('click',handleContextClick);
      if(doc&&typeof doc.addEventListener==='function')doc.addEventListener('click',handleDocumentClick);
    }

    bind();

    return Object.freeze({
      openForRecord:openForRecord,
      close:close,
      clearCache:clearCache,
      hide:hide,
      state:function(){return {requestVersion:requestVersion,cacheSize:cache.size};}
    });
  }

  return Object.freeze({create:create});
});
