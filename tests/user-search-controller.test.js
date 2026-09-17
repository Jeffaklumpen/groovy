const test=require('node:test');
const assert=require('node:assert/strict');
const UserSearchController=require('../js/user-search-controller.js');

function classList(){
  const values=new Set();
  return {
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    add(name){values.add(name);},
    remove(name){values.delete(name);},
    contains(name){return values.has(name);}
  };
}

function element(tag='div'){
  const listeners={};
  return {
    tagName:tag.toUpperCase(),
    dataset:{},
    style:{},
    className:'',
    classList:classList(),
    textContent:'',
    innerHTML:'',
    value:'',
    disabled:false,
    children:[],
    attributes:{},
    focused:false,
    appendChild(child){this.children.push(child);child.parentNode=this;return child;},
    addEventListener(type,fn){(listeners[type]||(listeners[type]=[])).push(fn);},
    async emit(type,event={}){for(const fn of listeners[type]||[])await fn(Object.assign({target:this,preventDefault(){},stopPropagation(){}},event));},
    setAttribute(name,value){this.attributes[name]=String(value);},
    focus(){this.focused=true;},
    closest(){return null;}
  };
}

function makeDocument(){
  const created=[];
  const dots=[];
  return {
    created,
    dots,
    createElement(tag){const el=element(tag);created.push(el);if(tag==='span'){const original=el.appendChild;el.appendChild=original;}return el;},
    querySelectorAll(selector){return selector==='.user-presence-dot[data-user-id]'?dots:[];}
  };
}

function makeElements(){
  return {
    searchButton:element('button'),
    modal:element(),
    closeButton:element('button'),
    input:element('input'),
    results:element(),
    onlineUsersStatus:element(),
    onlineUsersCount:element(),
    onlineUsersDesktopLabel:element()
  };
}

test('presence sync tracks logged-in user and excludes anonymous viewers from count',async()=>{
  const doc=makeDocument();
  const elements=makeElements();
  const channels=[];
  const removed=[];

  function makeChannel(){
    const handlers={};
    const channel={
      tracked:[],untracked:0,
      on(type,filter,fn){handlers[type+':'+filter.event]=fn;return channel;},
      subscribe(fn){channel.subscription=fn;return channel;},
      presenceState(){return channel.state||{};},
      async track(payload){channel.tracked.push(payload);},
      async untrack(){channel.untracked++;},
      sync(){handlers['presence:sync']();}
    };
    channels.push(channel);
    return channel;
  }

  const api={
    channel(name,options){const channel=makeChannel();channel.name=name;channel.options=options;return channel;},
    async removeChannel(channel){removed.push(channel);},
    from(){throw new Error('not used');}
  };
  const controller=UserSearchController.create({
    api,document:doc,elements,socialController:{},
    getCurrentUser:async()=>null,
    random:()=>0.5,now:()=>1000
  });

  await controller.syncUser({id:'u1'});
  assert.equal(channels.length,1);
  assert.equal(channels[0].name,'groovy-online-users');
  assert.equal(channels[0].options.config.presence.key,'u1');
  await channels[0].subscription('SUBSCRIBED');
  assert.equal(channels[0].tracked.length,1);
  assert.equal(channels[0].tracked[0].user_id,'u1');

  channels[0].state={u1:[{}],u2:[{}],'viewer-abc':[{}]};
  channels[0].sync();
  assert.equal(elements.onlineUsersCount.textContent,'2');
  assert.equal(elements.onlineUsersDesktopLabel.textContent,'users online');
  assert.equal(elements.onlineUsersStatus.attributes['aria-label'],'2 users online');

  await controller.syncUser(null);
  assert.equal(channels[0].untracked,1);
  assert.deepEqual(removed,[channels[0]]);
  assert.equal(channels.length,2);
  assert.match(channels[1].options.config.presence.key,/^viewer-/);
});

test('user search renders counts and delegates follow state to social controller',async()=>{
  const doc=makeDocument();
  const elements=makeElements();
  const followed=[];
  const navigated=[];
  const users=[
    {id:'u2',username:'alice',avatar_url:''},
    {id:'u3',username:'alina',avatar_url:'avatar.jpg'}
  ];
  const counts={u2:12,u3:4};

  const api={
    channel(){return {on(){return this;},subscribe(){return this;},presenceState(){return {};}};},
    removeChannel:async()=>{},
    from(table){
      if(table==='profiles')return {
        select(){return this;},
        ilike(){return this;},
        async limit(){return {data:users,error:null};}
      };
      if(table==='collections')return {
        select(){return this;},
        async eq(field,id){return {count:counts[id],error:null};}
      };
      throw new Error('unexpected table '+table);
    }
  };
  const social={
    async followingIds(ids){assert.deepEqual(ids,['u2','u3']);return new Set(['u2']);},
    setFollowButtonState(button,id,isFollowing){button.dataset.userId=id;button.dataset.following=isFollowing?'true':'false';button.textContent=isFollowing?'Following':'Follow';},
    async followUser(id){followed.push(['follow',id]);},
    async unfollowUser(id){followed.push(['unfollow',id]);}
  };
  const controller=UserSearchController.create({
    api,document:doc,elements,socialController:social,
    getCurrentUser:async()=>({id:'me'}),
    onNavigate:(username)=>navigated.push(username)
  });

  const result=await controller.searchUsers('ali');
  assert.equal(result.length,2);
  assert.equal(elements.results.children.length,2);
  assert.equal(elements.results.children[0].dataset.userId,'u2');
  assert.equal(elements.results.children[0].children[1].children[1].textContent,'12 collected records');
  const followButton=elements.results.children[0].children[2];
  assert.equal(followButton.dataset.following,'true');
  await followButton.emit('click');
  assert.deepEqual(followed,[['unfollow','u2']]);
  assert.equal(followButton.dataset.following,'false');

  elements.modal.style.display='flex';
  await elements.results.children[1].emit('click');
  assert.equal(elements.modal.style.display,'none');
  assert.deepEqual(navigated,['alina']);
});

test('open requires authentication and opens populated search for logged-in user',async()=>{
  const doc=makeDocument();
  const elements=makeElements();
  let currentUser=null;
  let profileLoads=0;
  const api={
    channel(){return {on(){return this;},subscribe(){return this;},presenceState(){return {};}};},
    removeChannel:async()=>{},
    from(table){
      if(table==='profiles')return {async select(){profileLoads++;return {data:[],error:null};}};
      throw new Error('unexpected table '+table);
    }
  };
  const controller=UserSearchController.create({
    api,document:doc,elements,socialController:{},
    getCurrentUser:async()=>currentUser
  });

  assert.equal(await controller.open(),false);
  assert.notEqual(elements.modal.style.display,'flex');

  currentUser={id:'me'};
  assert.equal(await controller.open(),true);
  assert.equal(elements.modal.style.display,'flex');
  assert.equal(elements.input.value,'');
  assert.equal(elements.input.focused,true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(profileLoads,1);
});
