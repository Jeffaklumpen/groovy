const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/detail-layout-controller.js');

function makeNode(className){
  const node={
    className:className||'',
    parentNode:null,
    children:[],
    style:{},
    _height:0,
    _queries:{},
    appendChild(child){
      if(child.parentNode)child.parentNode.removeChild(child);
      this.children.push(child);
      child.parentNode=this;
      return child;
    },
    insertBefore(child,reference){
      if(child.parentNode)child.parentNode.removeChild(child);
      const index=this.children.indexOf(reference);
      if(index<0)this.children.push(child);
      else this.children.splice(index,0,child);
      child.parentNode=this;
      return child;
    },
    removeChild(child){
      const index=this.children.indexOf(child);
      if(index>=0)this.children.splice(index,1);
      child.parentNode=null;
      return child;
    },
    querySelector(selector){return this._queries[selector]||null;},
    getBoundingClientRect(){return {height:this._height};}
  };
  Object.defineProperty(node,'nextSibling',{
    get(){
      if(!node.parentNode)return null;
      const siblings=node.parentNode.children;
      const index=siblings.indexOf(node);
      return index>=0?siblings[index+1]||null:null;
    }
  });
  return node;
}

function fixture(width){
  const detail=makeNode('album-detail');
  const main=makeNode('album-detail-main');
  const cover=makeNode('album-detail-cover');
  const tracks=makeNode('album-tracks');
  const about=makeNode('detail-about');
  const marketplace=makeNode('marketplace-panel');
  const info=makeNode('detail-info-card');
  detail._queries['.album-detail-main']=main;
  detail._queries['.album-detail-cover']=cover;
  detail.appendChild(main);
  detail.appendChild(cover);
  detail.appendChild(tracks);
  detail.appendChild(about);
  detail.appendChild(marketplace);

  const listeners={};
  const viewportListeners={};
  const frames=[];
  const win={
    innerWidth:width,
    addEventListener(name,fn){(listeners[name]||(listeners[name]=[])).push(fn);},
    removeEventListener(name,fn){listeners[name]=(listeners[name]||[]).filter(item=>item!==fn);},
    requestAnimationFrame(fn){frames.push(fn);return frames.length;},
    matchMedia(query){return {matches:this.innerWidth<=760,media:query};},
    visualViewport:{
      addEventListener(name,fn){(viewportListeners[name]||(viewportListeners[name]=[])).push(fn);},
      removeEventListener(name,fn){viewportListeners[name]=(viewportListeners[name]||[]).filter(item=>item!==fn);}
    }
  };
  const doc={createElement:()=>makeNode()};
  const controller=Controller.create({
    window:win,
    document:doc,
    elements:{detail,tracksPanel:tracks,marketplacePanel:marketplace,about,infoCard:info}
  });
  return {controller,win,detail,main,cover,tracks,about,marketplace,info,listeners,viewportListeners,frames};
}

test('moves tracks and marketplace into a desktop right column and restores mobile order',()=>{
  const f=fixture(1400);
  assert.equal(f.tracks.parentNode.className,'album-desktop-right');
  assert.equal(f.marketplace.parentNode,f.tracks.parentNode);

  f.win.innerWidth=900;
  f.controller.syncColumns();

  assert.equal(f.tracks.parentNode,f.detail);
  assert.equal(f.marketplace.parentNode,f.detail);
  assert.deepEqual(
    f.detail.children.filter(node=>[f.tracks,f.about,f.marketplace].includes(node)),
    [f.tracks,f.about,f.marketplace]
  );
});

test('matches desktop middle height to the cover and clears it below desktop breakpoint',()=>{
  const f=fixture(1400);
  f.cover._height=487.9;
  f.controller.syncDesktopHeight();
  assert.equal(f.main.style.height,'487px');
  assert.equal(f.main.style.maxHeight,'487px');

  f.win.innerWidth=1000;
  f.controller.syncDesktopHeight();
  assert.equal(f.main.style.height,'');
  assert.equal(f.main.style.maxHeight,'');
});

test('matches mobile info-card height to the cover and clears it off mobile',()=>{
  const f=fixture(700);
  f.cover._height=321.6;
  f.controller.syncMobilePairHeight();
  assert.equal(f.info.style.height,'322px');

  f.win.innerWidth=900;
  f.controller.syncMobilePairHeight();
  assert.equal(f.info.style.height,'');
});

test('installs responsive listeners and preserves the two-frame open sync',()=>{
  const f=fixture(1400);
  assert.equal(f.listeners.resize.length,2);
  assert.equal(f.viewportListeners.resize.length,1);

  f.controller.syncOpen();
  assert.equal(f.frames.length,1);
  f.frames.shift()();
  assert.equal(f.frames.length,1);
  f.frames.shift()();
  assert.equal(f.frames.length,0);

  f.controller.destroy();
  assert.equal(f.listeners.resize.length,0);
  assert.equal(f.viewportListeners.resize.length,0);
});
