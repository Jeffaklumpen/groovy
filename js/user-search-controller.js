(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./user-profile-core.js'));
  }else{
    root.GroovyUserSearchController=factory(root.GroovyUserProfileCore);
  }
})(typeof window!=='undefined'?window:null,function(UserProfileCore){
  function create(options){
    options=options||{};

    var api=options.api;
    var win=options.window||((typeof window!=='undefined')?window:null);
    var doc=options.document||(win&&win.document)||null;
    var elements=options.elements||{};
    var social=options.socialController||{};
    var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
    var onNavigate=typeof options.onNavigate==='function'?options.onNavigate:function(){};
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};
    var persistLastSeen=typeof options.persistLastSeen==='function'?options.persistLastSeen:async function(){};
    var setTimer=options.setTimeout||((win&&win.setTimeout)?win.setTimeout.bind(win):setTimeout);
    var clearTimer=options.clearTimeout||((win&&win.clearTimeout)?win.clearTimeout.bind(win):clearTimeout);
    var now=typeof options.now==='function'?options.now:Date.now;
    var random=typeof options.random==='function'?options.random:Math.random;
    var setRepeating=options.setInterval||((win&&win.setInterval)?win.setInterval.bind(win):null);
    var clearRepeating=options.clearInterval||((win&&win.clearInterval)?win.clearInterval.bind(win):null);
    var lastSeenHeartbeatMs=Math.max(30000,Number(options.lastSeenHeartbeatMs)||60000);

    var searchTimer=null;
    var presenceChannel=null;
    var presenceIdentity='';
    var presenceSyncPromise=Promise.resolve();
    var onlineUserIds=new Set();
    var lastSeenHeartbeat=null;
    var lastSeenUserId='';
    var anonymousPresenceKey='viewer-'+random().toString(36).slice(2)+'-'+now().toString(36);
    var bound=false;

    if(!api)throw new Error('User search controller requires an API client');
    if(!doc)throw new Error('User search controller requires a document');
    if(!UserProfileCore)throw new Error('User search controller requires user profile core');

    function log(level,message,error){onLog(level,message,error);}

    function refreshOnlineUserCount(){
      var count=onlineUserIds.size;
      if(!elements.onlineUsersStatus||!elements.onlineUsersCount)return;
      elements.onlineUsersCount.textContent=String(count);
      if(elements.onlineUsersDesktopLabel)elements.onlineUsersDesktopLabel.textContent=count===1?'user online':'users online';
      elements.onlineUsersStatus.classList.toggle('has-users',count>0);
      elements.onlineUsersStatus.setAttribute('aria-label',count+' '+(count===1?'user online':'users online'));
    }

    function refreshPresenceDots(){
      doc.querySelectorAll('.user-presence-dot[data-user-id]').forEach(function(dot){
        var isOnline=onlineUserIds.has(dot.dataset.userId);
        dot.classList.toggle('online',isOnline);
        dot.setAttribute('aria-label',isOnline?'Online':'Offline');
        dot.title=isOnline?'Online now':'';
      });
      refreshOnlineUserCount();
    }

    function stopLastSeenHeartbeat(){
      if(lastSeenHeartbeat&&clearRepeating)clearRepeating(lastSeenHeartbeat);
      lastSeenHeartbeat=null;
      lastSeenUserId='';
    }

    async function touchLastSeen(userId){
      if(!userId)return;
      try{
        await persistLastSeen(userId,new Date(now()).toISOString());
      }catch(error){
        log('warn','Could not persist last seen status:',error);
      }
    }

    function startLastSeenHeartbeat(userId){
      stopLastSeenHeartbeat();
      if(!userId)return;
      lastSeenUserId=userId;
      touchLastSeen(userId);
      if(setRepeating){
        lastSeenHeartbeat=setRepeating(function(){
          if(lastSeenUserId===userId)touchLastSeen(userId);
        },lastSeenHeartbeatMs);
      }
    }

    function addPresenceDot(avatar,userId){
      var dot=doc.createElement('span');
      dot.className='user-presence-dot';
      dot.dataset.userId=String(userId||'');
      avatar.appendChild(dot);
      refreshPresenceDots();
      return dot;
    }

    async function performPresenceSync(user){
      var nextUserId=user&&user.id?String(user.id):'';
      var nextIdentity=nextUserId||'__viewer__';
      if(nextIdentity===presenceIdentity&&presenceChannel)return;

      var previousChannel=presenceChannel;
      stopLastSeenHeartbeat();
      presenceChannel=null;
      presenceIdentity=nextIdentity;
      onlineUserIds=new Set();
      refreshPresenceDots();

      if(previousChannel){
        try{await previousChannel.untrack();}catch(error){}
        try{await api.removeChannel(previousChannel);}catch(error){}
      }

      var channel=api.channel('groovy-online-users',{
        config:{presence:{key:nextUserId||anonymousPresenceKey}}
      });
      presenceChannel=channel;

      channel.on('presence',{event:'sync'},function(){
        if(channel!==presenceChannel)return;
        var state=channel.presenceState();
        onlineUserIds=new Set(
          Object.keys(state||{}).filter(function(key){return key.indexOf('viewer-')!==0;})
        );
        refreshPresenceDots();
      });

      channel.subscribe(async function(status){
        if(channel!==presenceChannel)return;
        if(status==='SUBSCRIBED'&&nextUserId){
          try{
            await channel.track({user_id:nextUserId,online_at:new Date(now()).toISOString()});
            startLastSeenHeartbeat(nextUserId);
          }catch(error){
            log('warn','Could not update online status:',error);
          }
          return;
        }
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
          stopLastSeenHeartbeat();
          onlineUserIds=new Set();
          refreshPresenceDots();
        }
      });
    }

    function syncUser(user){
      presenceSyncPromise=presenceSyncPromise.then(function(){
        return performPresenceSync(user);
      }).catch(function(error){
        log('warn','Could not sync online status:',error);
      });
      return presenceSyncPromise;
    }

    function appendFollowButton(container,user,sessionUser,followingSet){
      if(!container||!user||!sessionUser||user.id===sessionUser.id)return null;
      var button=doc.createElement('button');
      button.type='button';
      button.className='user-search-follow-button';
      button.dataset.username=user.username||'collector';
      social.setFollowButtonState(button,user.id,followingSet&&followingSet.has(user.id));
      button.addEventListener('click',async function(event){
        event.preventDefault();
        event.stopPropagation();
        var wasFollowing=button.dataset.following==='true';
        button.disabled=true;
        button.textContent=wasFollowing?'Unfollowing...':'Following...';
        try{
          if(wasFollowing)await social.unfollowUser(user.id);
          else await social.followUser(user.id);
          social.setFollowButtonState(button,user.id,!wasFollowing);
        }catch(error){
          log('error','Could not change follow status:',error);
          social.setFollowButtonState(button,user.id,wasFollowing);
        }
        button.disabled=false;
      });
      container.appendChild(button);
      return button;
    }

    async function collectionCounts(users){
      return Promise.all((users||[]).map(async function(user){
        var result=await api.from('collections')
          .select('id',{count:'exact',head:true})
          .eq('user_id',user.id);
        return {id:user.id,count:result.error?0:(result.count||0)};
      }));
    }

    function renderUser(user,count,sessionUser,followingSet){
      var div=doc.createElement('div');
      div.className='user-search-result';
      div.dataset.userId=user.id;
      div.style.cursor='pointer';

      var avatar=doc.createElement('div');
      avatar.className='user-search-avatar';
      UserProfileCore.applyAvatar(avatar,user.avatar_url,user.username);
      addPresenceDot(avatar,user.id);

      var info=doc.createElement('div');
      info.className='user-search-info';
      var username=doc.createElement('span');
      username.className='user-search-username';
      username.textContent=user.username;
      var collectionCount=doc.createElement('span');
      collectionCount.className='user-search-count';
      collectionCount.textContent=Number(count||0)+' collected records';
      info.appendChild(username);
      info.appendChild(collectionCount);

      div.appendChild(avatar);
      div.appendChild(info);
      appendFollowButton(div,user,sessionUser,followingSet);
      elements.results.appendChild(div);

      div.addEventListener('click',function(){
        close();
        onNavigate(user.username);
      });
      return div;
    }

    async function loadTopUsers(){
      var result=await api.from('profiles').select('id,username,avatar_url');
      if(result.error){
        log('error','Top users error:',result.error);
        elements.results.innerHTML='<p>Could not load users.</p>';
        return [];
      }
      var users=result.data||[];
      if(!users.length){
        elements.results.innerHTML='<p>No users found.</p>';
        return [];
      }

      var sessionUser=await getCurrentUser();
      var followingSet=sessionUser&&social.followingIds?await social.followingIds(users.map(function(user){return user.id;})):new Set();
      var counts=await collectionCounts(users);
      counts.sort(function(a,b){return b.count-a.count;});
      var top=counts.slice(0,10);
      elements.results.innerHTML='';
      top.forEach(function(item){
        var user=users.find(function(candidate){return candidate.id===item.id;});
        if(user)renderUser(user,item.count,sessionUser,followingSet);
      });
      return top;
    }

    async function searchUsers(query){
      var result=await api.from('profiles')
        .select('id,username,avatar_url')
        .ilike('username','%'+query+'%')
        .limit(10);
      if(result.error){
        log('error','User search error:',result.error);
        elements.results.innerHTML='<p>Could not search users.</p>';
        return [];
      }
      var users=result.data||[];
      elements.results.innerHTML='';
      if(!users.length){
        elements.results.innerHTML='<p>No users found.</p>';
        return [];
      }

      var sessionUser=await getCurrentUser();
      var followingSet=sessionUser&&social.followingIds?await social.followingIds(users.map(function(user){return user.id;})):new Set();
      var counts=await collectionCounts(users);
      var countMap={};
      counts.forEach(function(item){countMap[item.id]=item.count;});
      users.forEach(function(user){renderUser(user,countMap[user.id]||0,sessionUser,followingSet);});
      return users;
    }

    async function open(){
      var user=await getCurrentUser();
      if(!user)return false;
      elements.modal.style.display='flex';
      elements.input.value='';
      loadTopUsers();
      elements.input.focus();
      return true;
    }

    function close(){
      elements.modal.style.display='none';
    }

    function handleInput(){
      var query=elements.input.value.trim();
      clearTimer(searchTimer);
      if(query.length<2){
        loadTopUsers();
        return;
      }
      elements.results.innerHTML='<p>Searching...</p>';
      searchTimer=setTimer(function(){searchUsers(query);},250);
    }

    function bind(){
      if(bound)return;
      bound=true;
      elements.input.addEventListener('input',handleInput);
      elements.searchButton.addEventListener('click',async function(event){
        event.preventDefault();
        event.stopPropagation();
        await open();
      });
      elements.closeButton.addEventListener('click',close);
      elements.modal.addEventListener('click',function(event){
        if(event.target===elements.modal)close();
      });
    }

    bind();

    return Object.freeze({
      syncUser:syncUser,
      loadTopUsers:loadTopUsers,
      searchUsers:searchUsers,
      open:open,
      close:close,
      refreshPresenceDots:refreshPresenceDots,
      state:function(){return {presenceIdentity:presenceIdentity,onlineUserIds:new Set(onlineUserIds)};}
    });
  }

  return Object.freeze({create:create});
});
