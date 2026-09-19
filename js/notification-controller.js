(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./notification-core.js'),require('./user-profile-core.js'));
  }else{
    root.GroovyNotificationController=factory(root.GroovyNotificationCore,root.GroovyUserProfileCore);
  }
})(typeof window!=='undefined'?window:null,function(Core,UserProfileCore){
  function create(options){
    options=options||{};
    if(!Core)throw new Error('GroovyNotificationCore is required');
    if(!UserProfileCore)throw new Error('GroovyUserProfileCore is required');

    var elements=options.elements||{};
    var api=options.api;
    var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
    var onNavigate=typeof options.onNavigate==='function'?options.onNavigate:function(){};
    var onOpenExternal=typeof options.onOpenExternal==='function'?options.onOpenExternal:function(){};
    var onBeforeOpen=typeof options.onBeforeOpen==='function'?options.onBeforeOpen:function(){};
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};

    var notificationChannel=null;
    var notificationUserId=null;
    var notificationsCache=[];
    var bound=false;

    function log(level,message,error){
      onLog(level,message,error);
    }

    function closePanel(){
      if(!elements.panel||!elements.bellButton)return;
      elements.panel.classList.remove('open');
      elements.panel.setAttribute('aria-hidden','true');
      elements.bellButton.setAttribute('aria-expanded','false');
    }

    function updateBadge(){
      if(!elements.badge)return;
      var unread=notificationsCache.filter(function(item){return !item.read_at;}).length;
      elements.badge.textContent=unread>99?'99+':String(unread);
      elements.badge.hidden=unread===0;
      if(elements.bellButton)elements.bellButton.classList.toggle('has-unread',unread>0);
    }

    function render(){
      if(!elements.list)return;
      updateBadge();
      if(!notificationsCache.length){
        elements.list.innerHTML='<div class="notification-empty"><span>All caught up</span><p>Updates from collectors you follow will appear here.</p></div>';
        return;
      }
      elements.list.innerHTML=notificationsCache.map(function(item){
        var actor=item.actor||{};
        var payload=item.payload||{};
        var system=item.notification_type==='price_alert';
        var visual=system
          ?'<span class="notification-system-icon" aria-hidden="true"><span class="record-icon"></span></span>'
          :UserProfileCore.avatarMarkup('notification-avatar',actor.avatar_url,actor.username||'Collector');
        var externalUrl=system?Core.safeExternalUrl(payload.listing_url):'';
        return '<button class="notification-item'+(system?' system':'')+(item.read_at?'':' unread')+'" type="button" data-notification-id="'+item.id+'" data-username="'+Core.escapeHtml(actor.username||'')+'" data-type="'+Core.escapeHtml(item.notification_type||'')+'" data-url="'+Core.escapeHtml(externalUrl)+'">'+
          visual+
          '<span class="notification-item-copy"><span>'+Core.copy(item)+'</span><small>'+Core.escapeHtml(Core.relativeTime(item.updated_at||item.created_at))+'</small></span>'+
          '<i aria-hidden="true"></i>'+
        '</button>';
      }).join('');
    }

    async function load(){
      var user=await getCurrentUser();
      if(!user){
        notificationsCache=[];
        render();
        return [];
      }
      var result=await api.from('notifications')
        .select('id,notification_type,item_count,payload,created_at,updated_at,read_at,actor:profiles!notifications_actor_id_fkey(id,username,avatar_url)')
        .eq('recipient_id',user.id)
        .order('updated_at',{ascending:false})
        .limit(30);
      if(result.error){
        log('warn','Could not load notifications:',result.error);
        return notificationsCache.slice();
      }
      notificationsCache=result.data||[];
      render();
      return notificationsCache.slice();
    }

    async function markRead(id){
      var item=notificationsCache.find(function(entry){return String(entry.id)===String(id);});
      if(item&&!item.read_at)item.read_at=new Date().toISOString();
      render();
      var user=await getCurrentUser();
      if(!user)return;
      await api.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',user.id).is('read_at',null);
    }

    async function markAllRead(){
      var user=await getCurrentUser();
      if(!user)return;
      var now=new Date().toISOString();
      notificationsCache.forEach(function(item){if(!item.read_at)item.read_at=now;});
      render();
      var result=await api.from('notifications').update({read_at:now}).eq('recipient_id',user.id).is('read_at',null);
      if(result&&result.error)log('warn','Could not mark notifications read:',result.error);
    }

    async function clear(){
      var user=await getCurrentUser();
      if(!user)return;
      if(elements.clearButton)elements.clearButton.disabled=true;
      var previous=notificationsCache.slice();
      notificationsCache=[];
      render();
      var result=await api.from('notifications').delete().eq('recipient_id',user.id);
      if(result&&result.error){
        log('warn','Could not clear notifications:',result.error);
        notificationsCache=previous;
        render();
      }
      if(elements.clearButton)elements.clearButton.disabled=false;
    }

    async function syncUser(user){
      if(!elements.box)return;
      if(!user){
        elements.box.hidden=true;
        notificationUserId=null;
        notificationsCache=[];
        render();
        if(notificationChannel){
          try{await api.removeChannel(notificationChannel);}catch(error){}
          notificationChannel=null;
        }
        return;
      }
      elements.box.hidden=false;
      if(notificationUserId===user.id&&notificationChannel){
        await load();
        return;
      }
      if(notificationChannel){
        try{await api.removeChannel(notificationChannel);}catch(error){}
        notificationChannel=null;
      }
      notificationUserId=user.id;
      notificationChannel=api.channel('groovy-notifications-'+user.id)
        .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'recipient_id=eq.'+user.id},function(){load();})
        .subscribe();
      await load();
    }

    async function togglePanel(){
      if(!elements.panel||!elements.bellButton)return;
      onBeforeOpen();
      var open=!elements.panel.classList.contains('open');
      elements.panel.classList.toggle('open',open);
      elements.panel.setAttribute('aria-hidden',open?'false':'true');
      elements.bellButton.setAttribute('aria-expanded',open?'true':'false');
      if(open)await load();
    }

    function bind(){
      if(bound)return;
      bound=true;
      if(elements.box)elements.box.addEventListener('click',function(event){event.stopPropagation();});
      if(elements.bellButton)elements.bellButton.addEventListener('click',async function(event){
        event.preventDefault();
        event.stopPropagation();
        await togglePanel();
      });
      if(elements.markAllButton)elements.markAllButton.addEventListener('click',async function(event){
        event.preventDefault();
        event.stopPropagation();
        await markAllRead();
      });
      if(elements.clearButton)elements.clearButton.addEventListener('click',async function(event){
        event.preventDefault();
        event.stopPropagation();
        await clear();
      });
      if(elements.list)elements.list.addEventListener('click',async function(event){
        var itemButton=event.target.closest('.notification-item');
        if(!itemButton)return;
        event.preventDefault();
        event.stopPropagation();
        var type=itemButton.getAttribute('data-type');
        var externalUrl=Core.safeExternalUrl(itemButton.getAttribute('data-url'));
        if(type==='price_alert'&&externalUrl)onOpenExternal(externalUrl);
        await markRead(itemButton.getAttribute('data-notification-id'));
        closePanel();
        var username=itemButton.getAttribute('data-username');
        if(type!=='price_alert'&&username){
          onNavigate(username,type==='new_follower'?'profile':(type==='wishlist_match'?'wishlist':'shelf'));
        }
      });
    }

    bind();

    return Object.freeze({
      closePanel:closePanel,
      load:load,
      markRead:markRead,
      markAllRead:markAllRead,
      clear:clear,
      syncUser:syncUser,
      togglePanel:togglePanel,
      state:function(){
        return {
          userId:notificationUserId,
          notifications:notificationsCache.slice(),
          hasChannel:!!notificationChannel
        };
      }
    });
  }

  return Object.freeze({create:create});
});
