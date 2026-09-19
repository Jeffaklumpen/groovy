(function(){
  var TRUSTED_ORIGINS={
    'android://com.groovyshelves.twa':true,
    'https://groovyshelves.com':true
  };
  var STORAGE_KEY='groovy-native-push-device-v1';
  var nativePort=null;
  var registering=false;

  function parsePayload(value){
    if(!value)return null;
    if(typeof value==='object')return value;
    try{return JSON.parse(String(value));}catch(error){return null;}
  }

  function validPayload(payload){
    return !!(
      payload&&
      payload.type==='groovy:native-push-token'&&
      payload.platform==='android'&&
      payload.provider==='fcm'&&
      payload.appId==='com.groovyshelves.twa'&&
      typeof payload.token==='string'&&
      payload.token.length>=20&&
      payload.token.length<=4096
    );
  }

  function remember(payload){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));}catch(error){}
  }

  function pending(){
    try{return parsePayload(localStorage.getItem(STORAGE_KEY));}catch(error){return null;}
  }

  function clearPending(){
    try{localStorage.removeItem(STORAGE_KEY);}catch(error){}
  }

  function acknowledge(type){
    if(!nativePort||typeof nativePort.postMessage!=='function')return;
    try{nativePort.postMessage(JSON.stringify({type:type}));}catch(error){}
  }

  async function register(payload){
    if(registering||!validPayload(payload)||!window.supabaseClient)return false;
    registering=true;
    remember(payload);
    try{
      var userResult=await window.supabaseClient.auth.getUser();
      var user=userResult&&userResult.data?userResult.data.user:null;
      if(!user)return false;

      var result=await window.supabaseClient.rpc('register_native_push_device',{
        p_platform:'android',
        p_provider:'fcm',
        p_device_token:payload.token,
        p_app_id:payload.appId,
        p_app_version:String(payload.appVersion||'')
      });
      if(result.error)throw result.error;
      clearPending();
      acknowledge('groovy:native-push-registered');
      return true;
    }catch(error){
      console.warn('Could not register Groovy Android notifications:',error);
      return false;
    }finally{
      registering=false;
    }
  }

  function handlePayload(value){
    var payload=parsePayload(value);
    if(!validPayload(payload))return;
    register(payload);
  }

  window.addEventListener('message',function(event){
    if(!TRUSTED_ORIGINS[event.origin])return;
    if(!event.ports||!event.ports[0])return;
    nativePort=event.ports[0];
    nativePort.onmessage=function(portEvent){handlePayload(portEvent.data);};
    if(typeof nativePort.start==='function')nativePort.start();
    handlePayload(event.data);
  });

  if(window.supabaseClient&&window.supabaseClient.auth){
    window.supabaseClient.auth.onAuthStateChange(function(_event,session){
      if(session&&session.user){
        var saved=pending();
        if(saved)register(saved);
      }
    });
    var saved=pending();
    if(saved)register(saved);
  }
})();
