(function(windowObject){
'use strict';

if(!windowObject)return;

var routeHandler=null;
var routeScrollPositions=Object.create(null);
var scrollCapturePending=false;
var suspendScrollCapture=false;
var restoreVersion=0;

if(windowObject.history&&'scrollRestoration' in windowObject.history){
  windowObject.history.scrollRestoration='manual';
}

function current(){
  return windowObject.location.pathname+
    windowObject.location.search+
    windowObject.location.hash;
}

function currentScrollY(){
  return Math.max(
    0,
    Number(windowObject.scrollY)||
    Number(windowObject.document&&windowObject.document.documentElement&&windowObject.document.documentElement.scrollTop)||
    0
  );
}

function rememberScroll(key){
  routeScrollPositions[key||current()]=currentScrollY();
}

function captureScroll(){
  scrollCapturePending=false;
  if(suspendScrollCapture)return;
  rememberScroll(current());
}

function scheduleScrollCapture(){
  if(suspendScrollCapture||scrollCapturePending)return;
  scrollCapturePending=true;
  windowObject.requestAnimationFrame(captureScroll);
}

function runRouteHandler(){
  if(typeof routeHandler==='function'){
    return routeHandler();
  }
  windowObject.dispatchEvent(new Event('groovy-route-change'));
}

function requestedScrollTop(key,options){
  if(options&&options.scroll==='top')return 0;
  if(Object.prototype.hasOwnProperty.call(routeScrollPositions,key)){
    return routeScrollPositions[key];
  }
  return 0;
}

async function renderAndRestore(options){
  var key=current();
  var version=++restoreVersion;
  suspendScrollCapture=true;

  try{
    await Promise.resolve(runRouteHandler());
  }finally{
    if(version!==restoreVersion)return;
    var top=requestedScrollTop(key,options);
    await new Promise(function(resolve){
      windowObject.requestAnimationFrame(function(){
        if(version===restoreVersion){
          windowObject.scrollTo({top:top,left:0,behavior:'auto'});
          routeScrollPositions[key]=top;
        }
        suspendScrollCapture=false;
        resolve();
      });
    });
  }
}

function setHandler(handler){
  routeHandler=typeof handler==='function'?handler:null;
}

function navigate(url,state,options){
  rememberScroll(current());
  windowObject.history.pushState(state||{},'',url);
  if(options&&options.render===false)return;
  return renderAndRestore(options);
}

function replace(url,state,options){
  rememberScroll(current());
  windowObject.history.replaceState(state||{},'',url);
  if(options&&options.render===false)return;
  return renderAndRestore(options);
}

function back(){
  rememberScroll(current());
  windowObject.history.back();
}

windowObject.addEventListener('scroll',scheduleScrollCapture,{passive:true});

windowObject.addEventListener('popstate',function(){
  renderAndRestore();
});

windowObject.GroovyRouter=Object.freeze({
  setHandler:setHandler,
  navigate:navigate,
  replace:replace,
  back:back,
  current:current
});
})(typeof window!=='undefined'?window:null);
