(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyPushNotifications=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function urlBase64ToUint8Array(value){
  var padding='='.repeat((4-value.length%4)%4);
  var base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  var raw=typeof atob==='function'?atob(base64):Buffer.from(base64,'base64').toString('binary');
  var output=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)output[i]=raw.charCodeAt(i);
  return output;
}

function create(options){
  options=options||{};
  var api=options.api;
  var win=options.window||(typeof window!=='undefined'?window:null);
  var nav=options.navigator||(win&&win.navigator)||{};
  var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};
  var pending=null;
  var publicKeyPromise=null;

  function userAgent(){return String(nav.userAgent||'');}

  function isIos(){
    return /iPad|iPhone|iPod/i.test(userAgent())||
      (nav.platform==='MacIntel'&&Number(nav.maxTouchPoints)>1);
  }

  function isAndroid(){return /Android/i.test(userAgent());}

  function isMobile(){
    if(isIos()||isAndroid())return true;
    if(nav.userAgentData&&typeof nav.userAgentData.mobile==='boolean')return nav.userAgentData.mobile;
    return /Mobile|Windows Phone|IEMobile/i.test(userAgent());
  }

  function isStandalone(){
    try{
      return !!(
        (win&&win.matchMedia&&win.matchMedia('(display-mode: standalone)').matches)||
        (nav&&nav.standalone===true)||
        (win&&win.document&&win.document.referrer&&win.document.referrer.indexOf('android-app://')===0)
      );
    }catch(error){return false;}
  }

  function notificationApi(){
    return win&&win.Notification?win.Notification:(typeof Notification!=='undefined'?Notification:null);
  }

  function supported(){
    var NotificationApi=notificationApi();
    return !!(
      isMobile()&&
      nav&&nav.serviceWorker&&
      NotificationApi
    );
  }

  function loadPublicKey(){
    if(publicKeyPromise)return publicKeyPromise;
    publicKeyPromise=(async function(){
      if(!api||!api.functions||typeof api.functions.invoke!=='function')throw new Error('Push config is unavailable');
      var result=await api.functions.invoke('push-config',{body:{}});
      if(result&&result.error)throw result.error;
      var key=String(result&&result.data&&result.data.publicKey||'');
      if(!key)throw new Error('Missing Web Push public key');
      return key;
    })().catch(function(error){
      publicKeyPromise=null;
      throw error;
    });
    return publicKeyPromise;
  }

  function prepare(){
    if(!isMobile()||!supported())return Promise.resolve(false);
    return loadPublicKey().then(function(){return true;}).catch(function(error){
      onLog('warn','Could not prepare mobile notifications:',error);
      return false;
    });
  }

  async function registerSubscription(subscription){
    if(!subscription||!api||typeof api.rpc!=='function')return false;
    var user=await getCurrentUser();
    if(!user)return false;

    var json=typeof subscription.toJSON==='function'?subscription.toJSON():subscription;
    var keys=json&&json.keys?json.keys:{};
    var endpoint=String(json&&json.endpoint||subscription.endpoint||'');
    var p256dh=String(keys.p256dh||'');
    var auth=String(keys.auth||'');
    if(!endpoint||!p256dh||!auth)return false;

    var result=await api.rpc('save_push_subscription',{
      p_endpoint:endpoint,
      p_p256dh:p256dh,
      p_auth:auth,
      p_user_agent:userAgent(),
      p_platform:String(nav.platform||'')
    });
    if(result&&result.error)throw result.error;
    return true;
  }

  async function ensure(){
    if(!isMobile())return {enabled:false,reason:'desktop'};
    if(!supported())return {enabled:false,reason:'unsupported'};
    if(isIos()&&!isStandalone())return {enabled:false,reason:'ios-home-screen-required'};

    var NotificationApi=notificationApi();
    var permission=NotificationApi.permission;
    if(permission==='default'){
      try{permission=await NotificationApi.requestPermission();}
      catch(error){
        onLog('warn','Could not request notification permission:',error);
        return {enabled:false,reason:'permission-error'};
      }
    }
    if(permission!=='granted')return {enabled:false,reason:permission||'denied'};

    try{
      var registration=await nav.serviceWorker.ready;
      if(!registration||!registration.pushManager)return {enabled:false,reason:'push-manager-unavailable'};
      var subscription=await registration.pushManager.getSubscription();
      if(!subscription){
        var publicKey=await loadPublicKey();
        subscription=await registration.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:urlBase64ToUint8Array(publicKey)
        });
      }
      var registered=await registerSubscription(subscription);
      return {enabled:!!registered,reason:registered?'enabled':'not-authenticated',subscription:subscription};
    }catch(error){
      onLog('warn','Could not enable mobile push notifications:',error);
      return {enabled:false,reason:'subscription-error',error:error};
    }
  }

  function ensureForPriceAlerts(){
    if(pending)return pending;
    pending=ensure().finally(function(){pending=null;});
    return pending;
  }

  async function status(){
    var NotificationApi=notificationApi();
    if(!isMobile())return {mobile:false,supported:false,permission:'unavailable',subscribed:false};
    if(!supported())return {mobile:true,supported:false,permission:'unavailable',subscribed:false};
    var permission=NotificationApi.permission||'default';
    if(permission!=='granted')return {mobile:true,supported:true,permission:permission,subscribed:false,standalone:isStandalone()};
    try{
      var registration=await nav.serviceWorker.ready;
      var subscription=registration&&registration.pushManager
        ?await registration.pushManager.getSubscription()
        :null;
      return {
        mobile:true,
        supported:true,
        permission:permission,
        subscribed:!!subscription,
        standalone:isStandalone()
      };
    }catch(error){
      return {mobile:true,supported:true,permission:permission,subscribed:false,standalone:isStandalone()};
    }
  }

  return Object.freeze({
    prepare:prepare,
    ensureForPriceAlerts:ensureForPriceAlerts,
    status:status,
    isMobile:isMobile,
    isIos:isIos,
    isStandalone:isStandalone
  });
}

return Object.freeze({
  create:create,
  urlBase64ToUint8Array:urlBase64ToUint8Array
});
});
