const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/notification-controller.js');

function makeElement(){
  const classes=new Set();
  const listeners={};
  const attrs={};
  return {
    hidden:false,
    disabled:false,
    textContent:'',
    innerHTML:'',
    listeners:listeners,
    classList:{
      add:function(name){classes.add(name);},
      remove:function(name){classes.delete(name);},
      contains:function(name){return classes.has(name);},
      toggle:function(name,value){
        if(value===undefined){
          if(classes.has(name)){classes.delete(name);return false;}
          classes.add(name);return true;
        }
        if(value)classes.add(name);else classes.delete(name);
        return !!value;
      }
    },
    setAttribute:function(name,value){attrs[name]=String(value);},
    getAttribute:function(name){return attrs[name]||null;},
    addEventListener:function(name,handler){listeners[name]=handler;}
  };
}

function makeElements(){
  return {
    box:makeElement(),
    bellButton:makeElement(),
    badge:makeElement(),
    panel:makeElement(),
    list:makeElement(),
    markAllButton:makeElement(),
    clearButton:makeElement()
  };
}

function makeApi(notifications,events){
  function builder(){
    return {
      select:function(){return this;},
      eq:function(){return this;},
      order:function(){return this;},
      limit:function(){events.push('load');return {data:notifications,error:null};},
      update:function(){return this;},
      is:function(){return {error:null};},
      delete:function(){return this;}
    };
  }
  return {
    from:function(){return builder();},
    channel:function(){
      return {
        on:function(){return this;},
        subscribe:function(){events.push('subscribe');return this;}
      };
    },
    removeChannel:async function(){events.push('remove');}
  };
}

test('subscribes before the first awaited notification load and renders unread state',async function(){
  const events=[];
  const elements=makeElements();
  const user={id:'user-1'};
  const api=makeApi([
    {id:1,notification_type:'new_follower',read_at:null,created_at:new Date().toISOString(),actor:{username:'<Anna>',avatar_url:''}}
  ],events);
  const controller=Controller.create({
    elements:elements,
    api:api,
    getCurrentUser:async function(){return user;}
  });

  await controller.syncUser(user);

  assert.deepEqual(events.slice(0,2),['subscribe','load']);
  assert.equal(controller.state().userId,'user-1');
  assert.equal(controller.state().hasChannel,true);
  assert.equal(elements.box.hidden,false);
  assert.equal(elements.badge.textContent,'1');
  assert.equal(elements.badge.hidden,false);
  assert.match(elements.list.innerHTML,/&lt;Anna&gt;/);
});

test('mark all read updates the local badge immediately',async function(){
  const events=[];
  const elements=makeElements();
  const user={id:'user-1'};
  const api=makeApi([
    {id:1,notification_type:'new_follower',read_at:null,created_at:new Date().toISOString(),actor:{username:'Anna'}}
  ],events);
  const controller=Controller.create({elements:elements,api:api,getCurrentUser:async function(){return user;}});

  await controller.syncUser(user);
  await controller.markAllRead();

  assert.equal(controller.state().notifications[0].read_at?true:false,true);
  assert.equal(elements.badge.textContent,'0');
  assert.equal(elements.badge.hidden,true);
});

test('syncing a signed-out user clears notifications and removes realtime channel',async function(){
  const events=[];
  const elements=makeElements();
  let currentUser={id:'user-1'};
  const api=makeApi([
    {id:1,notification_type:'new_follower',read_at:null,created_at:new Date().toISOString(),actor:{username:'Anna'}}
  ],events);
  const controller=Controller.create({elements:elements,api:api,getCurrentUser:async function(){return currentUser;}});

  await controller.syncUser(currentUser);
  currentUser=null;
  await controller.syncUser(null);

  assert.equal(elements.box.hidden,true);
  assert.deepEqual(controller.state().notifications,[]);
  assert.equal(controller.state().hasChannel,false);
  assert.equal(events.includes('remove'),true);
});

test('notification click marks read, closes the panel and delegates navigation',async function(){
  const events=[];
  const elements=makeElements();
  const user={id:'user-1'};
  const navigations=[];
  const api=makeApi([
    {id:7,notification_type:'wishlist_match',read_at:null,created_at:new Date().toISOString(),actor:{username:'Anna'}}
  ],events);
  const controller=Controller.create({
    elements:elements,
    api:api,
    getCurrentUser:async function(){return user;},
    onNavigate:function(username,view){navigations.push([username,view]);}
  });
  await controller.syncUser(user);
  elements.panel.classList.add('open');
  const button={
    getAttribute:function(name){
      return {'data-notification-id':'7','data-username':'Anna','data-type':'wishlist_match'}[name]||null;
    }
  };
  await elements.list.listeners.click({
    target:{closest:function(){return button;}},
    preventDefault:function(){},
    stopPropagation:function(){}
  });

  assert.deepEqual(navigations,[['Anna','wishlist']]);
  assert.equal(elements.panel.classList.contains('open'),false);
  assert.equal(controller.state().notifications[0].read_at?true:false,true);
});


test('price alert notification opens the marketplace URL without collector navigation',async function(){
  const events=[];
  const elements=makeElements();
  const user={id:'user-1'};
  const external=[];
  const navigations=[];
  const api=makeApi([
    {id:8,notification_type:'price_alert',read_at:null,created_at:new Date().toISOString(),actor:null,payload:{album_title:'Animals',listing_url:'https://example.com/listing',matched_price:249,alert_currency:'SEK',marketplace:'Tradera',sale_type:'fixed'}}
  ],events);
  const controller=Controller.create({
    elements:elements,
    api:api,
    getCurrentUser:async function(){return user;},
    onNavigate:function(username,view){navigations.push([username,view]);},
    onOpenExternal:function(url){external.push(url);}
  });
  await controller.syncUser(user);
  assert.match(elements.list.innerHTML,/notification-system-icon/);
  const button={
    getAttribute:function(name){
      return {
        'data-notification-id':'8',
        'data-username':'',
        'data-type':'price_alert',
        'data-url':'https://example.com/listing'
      }[name]||null;
    }
  };
  await elements.list.listeners.click({
    target:{closest:function(){return button;}},
    preventDefault:function(){},
    stopPropagation:function(){}
  });

  assert.deepEqual(external,['https://example.com/listing']);
  assert.deepEqual(navigations,[]);
  assert.equal(controller.state().notifications[0].read_at?true:false,true);
});
