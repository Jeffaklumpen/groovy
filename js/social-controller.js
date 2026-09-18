(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./user-profile-core.js'));
  }else{
    root.GroovySocialController=factory(root.GroovyUserProfileCore);
  }
})(typeof window!=='undefined'?window:null,function(UserProfileCore){
  function create(options){
    options=options||{};

    var api=options.api;
    var win=options.window||((typeof window!=='undefined')?window:null);
    var doc=options.document||(win&&win.document)||null;
    var elements=options.elements||{};
    var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
    var escapeHtml=typeof options.escapeHtml==='function'?options.escapeHtml:function(value){
      return String(value==null?'':value).replace(/[&<>"']/g,function(char){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
      });
    };
    var onNavigate=typeof options.onNavigate==='function'?options.onNavigate:function(){};
    var onOpenFollowingRoute=typeof options.onOpenFollowingRoute==='function'?options.onOpenFollowingRoute:function(){};
    var onBackHome=typeof options.onBackHome==='function'?options.onBackHome:function(){};
    var onRequireAuth=typeof options.onRequireAuth==='function'?options.onRequireAuth:function(){};
    var onBeforeFollowingOpen=typeof options.onBeforeFollowingOpen==='function'?options.onBeforeFollowingOpen:function(){};
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};
    var bound=false;

    if(!api)throw new Error('Social controller requires an API client');
    if(!UserProfileCore)throw new Error('Social controller requires user profile core');

    function log(level,message,error){onLog(level,message,error);}

    async function followingIds(userIds){
      var user=await getCurrentUser();
      if(!user||!Array.isArray(userIds)||!userIds.length)return new Set();
      var ids=userIds.filter(function(id){return id&&id!==user.id;});
      if(!ids.length)return new Set();
      var result=await api.from('user_follows')
        .select('followed_id')
        .eq('follower_id',user.id)
        .in('followed_id',ids);
      if(result.error){
        log('warn','Could not load follow status:',result.error);
        return new Set();
      }
      return new Set((result.data||[]).map(function(row){return row.followed_id;}));
    }

    async function lastSeenMap(userIds){
      var ids=(userIds||[]).filter(Boolean);
      var map={};
      if(!ids.length||!api.from)return map;
      var result=await api.from('user_presence_status')
        .select('user_id,last_seen_at')
        .in('user_id',ids);
      if(result.error){
        log('warn','Could not load last seen status:',result.error);
        return map;
      }
      (result.data||[]).forEach(function(row){map[row.user_id]=row.last_seen_at||'';});
      return map;
    }

    async function isFollowing(targetUserId){
      if(!targetUserId)return false;
      var set=await followingIds([targetUserId]);
      return set.has(targetUserId);
    }

    function followEvent(targetUserId,following){
      var detail={userId:targetUserId,following:following};
      if(!win||typeof win.dispatchEvent!=='function')return;
      var event;
      if(typeof options.createFollowEvent==='function')event=options.createFollowEvent(detail);
      else if(typeof win.CustomEvent==='function')event=new win.CustomEvent('groovy-follow-changed',{detail:detail});
      else event={type:'groovy-follow-changed',detail:detail};
      win.dispatchEvent(event);
    }

    async function followUser(targetUserId){
      var user=await getCurrentUser();
      if(!user)throw new Error('You need to be logged in to follow collectors.');
      if(!targetUserId||targetUserId===user.id)return false;
      var result=await api.from('user_follows').insert({follower_id:user.id,followed_id:targetUserId});
      if(result.error&&result.error.code!=='23505')throw result.error;
      followEvent(targetUserId,true);
      return true;
    }

    async function unfollowUser(targetUserId){
      var user=await getCurrentUser();
      if(!user)throw new Error('You need to be logged in.');
      if(!targetUserId)return false;
      var result=await api.from('user_follows').delete()
        .eq('follower_id',user.id)
        .eq('followed_id',targetUserId);
      if(result.error)throw result.error;
      followEvent(targetUserId,false);
      return true;
    }

    function setFollowButtonState(button,targetUserId,following){
      if(!button)return;
      button.dataset.following=following?'true':'false';
      button.classList.toggle('following',!!following);
      button.textContent=following?'Following':'Follow';
      button.setAttribute('aria-label',(following?'Unfollow ':'Follow ')+(button.dataset.username||'collector'));
      button.dataset.userId=targetUserId||'';
    }

    function setViewedUserFollowState(targetUserId,username,following){
      var button=elements.viewedUserFollowButton;
      if(!button)return;
      button.dataset.userId=targetUserId||'';
      button.dataset.username=username||'collector';
      button.dataset.following=following?'true':'false';
      button.classList.toggle('following',!!following);
      button.setAttribute('aria-label',(following?'Unfollow ':'Follow ')+(username||'collector'));
      var label=button.querySelector('.viewed-action-label');
      var icon=button.querySelector('.viewed-follow-icon');
      if(label)label.textContent=following?'Following':'Follow';
      if(icon)icon.textContent=following?'✓':'+';
    }

    function ensureFollowingPage(){
      if(!doc)return null;
      var page=doc.getElementById('followingPage');
      if(page)return page;
      page=doc.createElement('section');
      page.id='followingPage';
      page.className='following-page';
      page.hidden=true;
      page.innerHTML='<div class="following-shell">'+
        '<div class="following-heading"><div><span class="following-kicker">YOUR COMMUNITY</span><h1>Following</h1><p>Collectors you follow, their libraries and the records you have in common.</p></div><button id="followingBackButton" type="button">Back to My Shelf</button></div>'+
        '<div id="followingGrid" class="following-grid"></div>'+
      '</div>';
      doc.body.appendChild(page);
      page.querySelector('#followingBackButton').addEventListener('click',function(){onBackHome();});
      page.querySelector('#followingGrid').addEventListener('click',async function(event){
        var unfollow=event.target.closest('[data-unfollow-user]');
        if(unfollow){
          event.preventDefault();
          event.stopPropagation();
          var id=unfollow.getAttribute('data-unfollow-user');
          unfollow.disabled=true;
          unfollow.textContent='Unfollowing...';
          try{
            await unfollowUser(id);
            await renderFollowingPage();
          }catch(error){
            log('error','Could not unfollow:',error);
            unfollow.disabled=false;
            unfollow.textContent='Unfollow';
          }
          return;
        }
        var shelf=event.target.closest('[data-shelf-username]');
        if(shelf){
          event.preventDefault();
          onNavigate(shelf.getAttribute('data-shelf-username'),'collection');
          return;
        }
        var profile=event.target.closest('[data-profile-username]');
        if(profile){
          event.preventDefault();
          onNavigate(profile.getAttribute('data-profile-username'),'profile');
        }
      });
      return page;
    }

    function hideFollowingPage(){
      if(!doc)return;
      var page=doc.getElementById('followingPage');
      if(page)page.hidden=true;
      if(doc.body&&doc.body.classList)doc.body.classList.remove('following-page-open');
    }

    async function renderFollowingPage(){
      var page=ensureFollowingPage();
      if(!page)return;
      var grid=page.querySelector('#followingGrid');
      var user=await getCurrentUser();
      if(!user){
        hideFollowingPage();
        onRequireAuth();
        return;
      }
      page.hidden=false;
      if(doc.body&&doc.body.classList)doc.body.classList.add('following-page-open');
      grid.innerHTML='<div class="following-loading"><span></span><strong>Loading collectors...</strong></div>';
      var result=await api.rpc('get_following_overview');
      if(result.error){
        log('error','Could not load following:',result.error);
        grid.innerHTML='<div class="following-empty"><strong>Could not load following.</strong><span>Make sure the social migration has been run in Supabase.</span></div>';
        return;
      }
      var data=result.data||[];
      if(!data.length){
        grid.innerHTML='<div class="following-empty"><strong>You are not following anyone yet.</strong><span>Use Search User or visit a collector profile to follow someone.</span></div>';
        return;
      }
      var lastSeen=await lastSeenMap(data.map(function(item){return item.user_id;}));
      grid.innerHTML=data.map(function(item){
        var lastSeenText=UserProfileCore.formatLastSeen(lastSeen[item.user_id]||'');
        return '<article class="following-card">'+
          '<button class="following-identity" type="button" data-profile-username="'+escapeHtml(item.username||'')+'">'+
            UserProfileCore.avatarMarkup('following-avatar',item.avatar_url,item.username||'Collector')+
            '<span><strong>'+escapeHtml(item.username||'Collector')+'</strong><small>Following since '+escapeHtml(new Date(item.followed_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))+'</small><small class="following-last-seen">'+escapeHtml(lastSeenText)+'</small></span>'+
          '</button>'+
          '<div class="following-stats">'+
            '<div><strong>'+Number(item.collection_count||0)+'</strong><span>Records</span></div>'+
            '<div><strong>'+Number(item.wishlist_count||0)+'</strong><span>Wishlist</span></div>'+
            '<div><strong>'+Number(item.common_count||0)+'</strong><span>In common</span></div>'+
          '</div>'+
          '<div class="following-actions"><button type="button" data-profile-username="'+escapeHtml(item.username||'')+'">View Profile</button><button type="button" data-shelf-username="'+escapeHtml(item.username||'')+'">View Shelf</button><button class="following-unfollow" type="button" data-unfollow-user="'+escapeHtml(item.user_id||'')+'">Unfollow</button></div>'+
        '</article>';
      }).join('');
    }

    async function toggleViewedUserFollow(){
      var button=elements.viewedUserFollowButton;
      if(!button)return;
      var targetUserId=button.dataset.userId;
      if(!targetUserId)return;
      var wasFollowing=button.dataset.following==='true';
      button.disabled=true;
      var label=button.querySelector('.viewed-action-label');
      if(label)label.textContent=wasFollowing?'Unfollowing...':'Following...';
      try{
        if(wasFollowing)await unfollowUser(targetUserId);
        else await followUser(targetUserId);
        setViewedUserFollowState(targetUserId,button.dataset.username,!wasFollowing);
      }catch(error){
        log('error','Could not change follow status:',error);
        setViewedUserFollowState(targetUserId,button.dataset.username,wasFollowing);
      }
      button.disabled=false;
    }

    function handleFollowChanged(event){
      var detail=event&&event.detail||{};
      if(doc&&typeof doc.querySelectorAll==='function'){
        doc.querySelectorAll('.user-search-follow-button[data-user-id="'+String(detail.userId||'')+'"]')
          .forEach(function(button){setFollowButtonState(button,detail.userId,!!detail.following);});
      }
      var viewed=elements.viewedUserFollowButton;
      if(viewed&&String(viewed.dataset.userId||'')===String(detail.userId||'')){
        setViewedUserFollowState(detail.userId,viewed.dataset.username,!!detail.following);
      }
    }

    function bind(){
      if(bound)return;
      bound=true;
      if(win){
        win.groovyIsFollowing=isFollowing;
        win.groovyFollowUser=followUser;
        win.groovyUnfollowUser=unfollowUser;
        if(typeof win.addEventListener==='function')win.addEventListener('groovy-follow-changed',handleFollowChanged);
      }
      if(elements.followingButton)elements.followingButton.addEventListener('click',function(event){
        event.preventDefault();
        event.stopPropagation();
        onBeforeFollowingOpen();
        onOpenFollowingRoute();
      });
      if(elements.viewedUserFollowButton)elements.viewedUserFollowButton.addEventListener('click',async function(event){
        event.preventDefault();
        event.stopPropagation();
        await toggleViewedUserFollow();
      });
    }

    bind();

    return Object.freeze({
      followingIds:followingIds,
      isFollowing:isFollowing,
      followUser:followUser,
      unfollowUser:unfollowUser,
      setFollowButtonState:setFollowButtonState,
      setViewedUserFollowState:setViewedUserFollowState,
      ensureFollowingPage:ensureFollowingPage,
      hideFollowingPage:hideFollowingPage,
      renderFollowingPage:renderFollowingPage,
      toggleViewedUserFollow:toggleViewedUserFollow
    });
  }

  return Object.freeze({create:create});
});
