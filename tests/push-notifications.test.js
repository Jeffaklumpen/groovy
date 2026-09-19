const test=require('node:test');
const assert=require('node:assert/strict');
const Push=require('../js/push-notifications.js');

function mobileFixture(options){
  options=options||{};
  const calls=[];
  const subscription={
    endpoint:'https://push.example/subscription-1',
    toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'p256dh-key-value-long-enough',auth:'auth-secret-value'}};}
  };
  const pushManager={
    async getSubscription(){return options.existing===false?null:subscription;},
    async subscribe(config){
      calls.push(['subscribe',config]);
      return subscription;
    }
  };
  const NotificationApi={
    permission:options.permission||'default',
    async requestPermission(){
      calls.push(['permission']);
      this.permission=options.permissionResult||'granted';
      return this.permission;
    }
  };
  const nav={
    userAgent:options.userAgent||'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
    platform:options.platform||'Linux armv8l',
    maxTouchPoints:options.maxTouchPoints||5,
    serviceWorker:{ready:Promise.resolve({pushManager})}
  };
  const win={
    Notification:NotificationApi,
    navigator:nav,
    document:{referrer:''},
    matchMedia(){return {matches:!!options.standalone};}
  };
  const api={
    async rpc(name,payload){
      calls.push(['rpc',name,payload]);
      return {data:{id:1},error:null};
    }
  };
  const controller=Push.create({
    api,window:win,navigator:nav,
    getCurrentUser:async()=>({id:'user-1'}),
    onLog:()=>{}
  });
  return {controller,calls,NotificationApi};
}

test('mobile Price Alerts request permission and register one push subscription',async()=>{
  const {controller,calls}=mobileFixture({existing:false});
  const result=await controller.ensureForPriceAlerts();
  assert.equal(result.enabled,true);
  assert.equal(calls.filter(call=>call[0]==='permission').length,1);
  const subscribe=calls.find(call=>call[0]==='subscribe');
  assert.ok(subscribe);
  assert.equal(subscribe[1].userVisibleOnly,true);
  assert.ok(subscribe[1].applicationServerKey instanceof Uint8Array);
  assert.equal(subscribe[1].applicationServerKey.length,65);
  const rpc=calls.find(call=>call[0]==='rpc'&&call[1]==='save_push_subscription');
  assert.ok(rpc);
  assert.equal(rpc[2].p_endpoint,'https://push.example/subscription-1');
});

test('desktop does not request mobile push permission',async()=>{
  const {controller,calls}=mobileFixture({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'});
  const result=await controller.ensureForPriceAlerts();
  assert.equal(result.enabled,false);
  assert.equal(result.reason,'desktop');
  assert.equal(calls.length,0);
});

test('iPhone browser requires Home Screen install before Web Push setup',async()=>{
  const {controller,calls}=mobileFixture({
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile',
    platform:'iPhone',
    standalone:false
  });
  const result=await controller.ensureForPriceAlerts();
  assert.equal(result.enabled,false);
  assert.equal(result.reason,'ios-home-screen-required');
  assert.equal(calls.length,0);
});
