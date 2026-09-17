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
