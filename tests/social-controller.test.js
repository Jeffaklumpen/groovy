const test=require('node:test');
const assert=require('node:assert/strict');
const SocialController=require('../js/social-controller.js');

function classList(){
  const values=new Set();
  return {
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    add(name){values.add(name);},
    remove(name){values.delete(name);},
    contains(name){return values.has(name);}
  };
}

function button(){
  const listeners={};
  const label={textContent:''};
  const icon={textContent:''};
  return {
    dataset:{},classList:classList(),textContent:'',disabled:false,attributes:{},
    setAttribute(name,value){this.attributes[name]=value;},
    querySelector(selector){if(selector==='.viewed-action-label')return label;if(selector==='.viewed-follow-icon')return icon;return null;},
    addEventListener(type,fn){listeners[type]=fn;},
    listeners,label,icon
  };
}

function fakeWindow(){
  const listeners={};
  const events=[];
  function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail;}
  return {
    CustomEvent,
    events,
    addEventListener(type,fn){listeners[type]=fn;},
    dispatchEvent(event){events.push(event);if(listeners[event.type])listeners[event.type](event);return true;},
    listeners
  };
}

test('followingIds excludes the current user and returns followed ids',async()=>{
  let receivedIds=null;
  const api={
    from(table){
      assert.equal(table,'user_follows');
      return {
        select(){return this;},
        eq(){return this;},
        in(column,ids){assert.equal(column,'followed_id');receivedIds=ids;return Promise.resolve({data:[{followed_id:'b'}],error:null});}
      };
    }
  };
  const controller=SocialController.create({api,getCurrentUser:async()=>({id:'me'})});
  const result=await controller.followingIds(['me','b','c']);
  assert.deepEqual(receivedIds,['b','c']);
  assert.equal(result.has('b'),true);
  assert.equal(result.has('c'),false);
});

test('controller installs compatible global follow helpers and emits follow changes',async()=>{
  const win=fakeWindow();
  const inserts=[];
  const deletes=[];
  const api={
    from(){
      return {
        insert(row){inserts.push(row);return Promise.resolve({error:null});},
        delete(){return {
          eq(column,value){deletes.push([column,value]);return {
            eq(column2,value2){deletes.push([column2,value2]);return Promise.resolve({error:null});}
          };}
        };}
      };
    }
  };
  SocialController.create({api,window:win,getCurrentUser:async()=>({id:'me'})});
  assert.equal(typeof win.groovyFollowUser,'function');
  assert.equal(typeof win.groovyUnfollowUser,'function');
  assert.equal(typeof win.groovyIsFollowing,'function');

  await win.groovyFollowUser('other');
  await win.groovyUnfollowUser('other');

  assert.deepEqual(inserts,[{follower_id:'me',followed_id:'other'}]);
  assert.deepEqual(deletes,[['follower_id','me'],['followed_id','other']]);
  assert.deepEqual(win.events.map(event=>event.detail),[
    {userId:'other',following:true},
    {userId:'other',following:false}
  ]);
});

test('duplicate follow insert remains successful',async()=>{
  const api={from(){return {insert(){return Promise.resolve({error:{code:'23505'}});}};}};
  const controller=SocialController.create({api,getCurrentUser:async()=>({id:'me'})});
  assert.equal(await controller.followUser('other'),true);
});

test('follow button helpers preserve current UI semantics',()=>{
  const viewed=button();
  const controller=SocialController.create({
    api:{},
    elements:{viewedUserFollowButton:viewed}
  });
  controller.setViewedUserFollowState('u1','Anna',true);
  assert.equal(viewed.dataset.userId,'u1');
  assert.equal(viewed.dataset.username,'Anna');
  assert.equal(viewed.dataset.following,'true');
  assert.equal(viewed.classList.contains('following'),true);
  assert.equal(viewed.label.textContent,'Following');
  assert.equal(viewed.icon.textContent,'✓');
  assert.equal(viewed.attributes['aria-label'],'Unfollow Anna');

  const search=button();
  search.dataset.username='Anna';
  controller.setFollowButtonState(search,'u1',false);
  assert.equal(search.dataset.userId,'u1');
  assert.equal(search.dataset.following,'false');
  assert.equal(search.textContent,'Follow');
  assert.equal(search.attributes['aria-label'],'Follow Anna');
});

test('following menu delegates route orchestration instead of owning app routing',()=>{
  const following=button();
  let before=0;
  let open=0;
  SocialController.create({
    api:{},
    elements:{followingButton:following},
    onBeforeFollowingOpen(){before++;},
    onOpenFollowingRoute(){open++;}
  });
  const event={preventDefault(){},stopPropagation(){}};
  following.listeners.click(event);
  assert.equal(before,1);
  assert.equal(open,1);
});
