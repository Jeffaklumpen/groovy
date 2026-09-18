const test=require('node:test');
const assert=require('node:assert/strict');
const DetailSocialController=require('../js/detail-social-controller.js');

const recordModel={
  albumId(record){return record&&record.albumId;},
  discogsMasterId(record){return record&&record.masterId;}
};

function classList(){
  const values=new Set();
  return {
    add(name){values.add(name);},
    remove(name){values.delete(name);},
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    contains(name){return values.has(name);}
  };
}

function element(){
  const listeners={};
  const selectors={};
  return {
    hidden:true,
    innerHTML:'',
    classList:classList(),
    style:{},
    addEventListener(type,fn){listeners[type]=fn;},
    emit(type,event){return listeners[type]&&listeners[type](event);},
    querySelector(selector){return selectors[selector]||null;},
    setQuery(selector,value){selectors[selector]=value;},
    contains(target){return target&&target.inside===true;},
    getBoundingClientRect(){return {top:100,bottom:150};}
  };
}

function makeWindow(){
  const listeners={};
  return {
    listeners,
    addEventListener(type,fn){listeners[type]=fn;},
    dispatch(type,detail){if(listeners[type])listeners[type]({type,detail});},
    matchMedia(query){return {matches:query.indexOf('min-width')>=0};},
    requestAnimationFrame(fn){fn();}
  };
}

function makeDocument(){
  const listeners={};
  return {
    addEventListener(type,fn){listeners[type]=fn;},
    emit(type,event){return listeners[type]&&listeners[type](event);},
    querySelector(selector){
      if(selector==='.album-detail-cover')return {getBoundingClientRect(){return {top:20,bottom:520};}};
      return null;
    }
  };
}

function query(result,trace,table){
  const q={
    select(value){trace.push([table,'select',value]);return q;},
    eq(field,value){trace.push([table,'eq',field,value]);return q;},
    in(field,value){trace.push([table,'in',field,value]);return q;},
    limit(value){trace.push([table,'limit',value]);return q;},
    then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}
  };
  return q;
}

test('own shelf renders followed collectors and reuses cache until follow state changes',async()=>{
  const el=element();
  const win=makeWindow();
  const doc=makeDocument();
  const trace=[];
  let followCalls=0;
  const results={
    user_follows:{data:[{followed_id:'u2'},{followed_id:'u3'}],error:null},
    collections:{data:[{user_id:'u3'},{user_id:'u2'}],error:null},
    profiles:{data:[
      {id:'u2',username:'alice',avatar_url:'alice.jpg'},
      {id:'u3',username:'bob',avatar_url:''}
    ],error:null}
  };
  const api={from(table){if(table==='user_follows')followCalls++;return query(results[table],trace,table);}};
  let openIndex=4;
  const controller=DetailSocialController.create({
    api,recordModel,window:win,document:doc,element:el,
    getCurrentUser:async()=>({id:'me'}),
    getViewedUserId:()=>null,
    getLibraryView:()=> 'collection',
    getOpenRecordIndex:()=>openIndex,
    escapeHtml:(value)=>String(value)
  });
  const record={albumId:'album-1',masterId:'master-9'};

  await controller.openForRecord(record,4);
  assert.equal(el.hidden,false);
  assert.match(el.innerHTML,/Also collected by/);
  assert.match(el.innerHTML,/alice/);
  assert.match(el.innerHTML,/bob/);
  assert.equal(followCalls,1);
  assert.ok(trace.some(call=>call[0]==='collections'&&call[1]==='eq'&&call[2]==='albums.discogs_master_id'&&call[3]==='master-9'));

  await controller.openForRecord(record,4);
  assert.equal(followCalls,1,'cached collector result should avoid another follow query');

  win.dispatch('groovy-follow-changed',{userId:'u2',following:false});
  assert.equal(controller.state().cacheSize,0);
  await controller.openForRecord(record,4);
  assert.equal(followCalls,2,'follow change should clear the album-social cache');
});

test('viewing another collector renders collection match from own collection',async()=>{
  const el=element();
  const trace=[];
  const api={from(table){
    assert.equal(table,'collections');
    return query({data:[{id:'own-row'}],error:null},trace,table);
  }};
  const controller=DetailSocialController.create({
    api,recordModel,window:makeWindow(),document:makeDocument(),element:el,
    getCurrentUser:async()=>({id:'me'}),
    getViewedUserId:()=> 'other-user',
    getLibraryView:()=> 'collection',
    getOpenRecordIndex:()=>2
  });
  const record={albumId:'album-22'};

  await controller.openForRecord(record,2);
  assert.equal(el.hidden,false);
  assert.equal(el.classList.contains('own-match'),true);
  assert.match(el.innerHTML,/COLLECTION MATCH/);
  assert.match(el.innerHTML,/This record is also in your collection/);
  assert.ok(trace.some(call=>call[1]==='eq'&&call[2]==='album_id'&&call[3]==='album-22'));
});

test('own wishlist keeps album social context hidden and skips social queries',async()=>{
  const el=element();
  let fromCalls=0;
  const controller=DetailSocialController.create({
    api:{from(){fromCalls++;throw new Error('should not query');}},
    recordModel,window:makeWindow(),document:makeDocument(),element:el,
    getCurrentUser:async()=>({id:'me'}),
    getViewedUserId:()=>null,
    getLibraryView:()=> 'wishlist',
    getOpenRecordIndex:()=>1
  });
  const record={albumId:'album-1'};

  await controller.openForRecord(record,1);
  assert.equal(el.hidden,true);
  assert.equal(el.innerHTML,'');
  assert.equal(fromCalls,0);
});

test('close invalidates a pending request so stale results cannot render',async()=>{
  const el=element();
  let resolveUser;
  const userPromise=new Promise(resolve=>{resolveUser=resolve;});
  const controller=DetailSocialController.create({
    api:{from(){throw new Error('stale request should stop before querying');}},
    recordModel,window:makeWindow(),document:makeDocument(),element:el,
    getCurrentUser:()=>userPromise,
    getViewedUserId:()=>null,
    getLibraryView:()=> 'collection',
    getOpenRecordIndex:()=>7
  });
  const record={albumId:'album-1'};

  const pending=controller.openForRecord(record,7);
  controller.close();
  resolveUser({id:'me'});
  await pending;
  assert.equal(el.hidden,true);
  assert.equal(el.innerHTML,'');
});

test('collector click delegates navigation while more-menu click stays inside the controller',()=>{
  const el=element();
  const win=makeWindow();
  const doc=makeDocument();
  const navigated=[];
  const menu={hidden:true,style:{}};
  const more={attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
  el.setQuery('[data-detail-social-menu]',menu);
  el.setQuery('[data-detail-social-more]',more);
  DetailSocialController.create({
    api:{},recordModel,window:win,document:doc,element:el,
    onNavigate:(username)=>navigated.push(username)
  });

  let prevented=0,stopped=0;
  el.emit('click',{
    target:{closest(selector){return selector==='[data-detail-social-more]'?more:null;}},
    preventDefault(){prevented++;},stopPropagation(){stopped++;}
  });
  assert.equal(menu.hidden,false);
  assert.equal(more.attributes['aria-expanded'],'true');
  assert.equal(el.classList.contains('menu-open'),true);
  assert.equal(prevented,1);
  assert.equal(stopped,1);

  const person={getAttribute(name){return name==='data-detail-social-username'?'alice':'';}};
  el.emit('click',{
    target:{closest(selector){return selector==='[data-detail-social-username]'?person:null;}},
    preventDefault(){},stopPropagation(){}
  });
  assert.deepEqual(navigated,['alice']);
});
