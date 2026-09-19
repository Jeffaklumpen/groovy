const PWA_CACHE_PREFIX='groovy-pwa-';

self.addEventListener('install',function(){
  self.skipWaiting();
});

self.addEventListener('activate',function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(key){
        return key.indexOf(PWA_CACHE_PREFIX)===0;
      }).map(function(key){
        return caches.delete(key);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// Groovy is network-only. For navigations and frontend code, explicitly bypass
// the browser HTTP cache as well so mobile/PWA sessions cannot stay on stale
// HTML, CSS or JavaScript after a deploy.
self.addEventListener('fetch',function(event){
  if(event.request.method!=='GET')return;

  var destination=event.request.destination||'';
  var mustBeFresh=event.request.mode==='navigate'||destination==='document'||destination==='script'||destination==='style';

  if(mustBeFresh){
    event.respondWith(fetch(new Request(event.request,{cache:'no-store'})));
    return;
  }

  event.respondWith(fetch(event.request));
});


self.addEventListener('push',function(event){
  var payload={};
  try{
    payload=event.data?event.data.json():{};
  }catch(error){
    payload={body:event.data?event.data.text():''};
  }

  var title=String(payload.title||'Groovy');
  var options={
    body:String(payload.body||''),
    icon:String(payload.icon||'/assets/icons/app-icon-192.png'),
    badge:String(payload.badge||'/assets/icons/app-icon-192.png'),
    tag:String(payload.tag||'groovy-notification'),
    renotify:true,
    data:{
      url:String(payload.url||'/price-alerts'),
      listingUrl:String(payload.listingUrl||'')
    }
  };

  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',function(event){
  event.notification.close();
  var targetUrl='/price-alerts';
  try{
    targetUrl=new URL(event.notification&&event.notification.data&&event.notification.data.url||'/price-alerts',self.location.origin).href;
  }catch(error){
    targetUrl=self.location.origin+'/price-alerts';
  }

  event.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(clientList){
      for(var i=0;i<clientList.length;i++){
        var client=clientList[i];
        if(!client||typeof client.focus!=='function')continue;
        try{
          if(new URL(client.url).origin!==self.location.origin)continue;
        }catch(error){continue;}
        if(typeof client.navigate==='function'){
          return client.navigate(targetUrl).then(function(navigated){
            return navigated&&typeof navigated.focus==='function'?navigated.focus():client.focus();
          }).catch(function(){return client.focus();});
        }
        return client.focus();
      }
      return self.clients.openWindow?self.clients.openWindow(targetUrl):Promise.resolve();
    })
  );
});
