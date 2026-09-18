(function(windowObject){
'use strict';

if(!windowObject)return;

var routeHandler=null;

function runRouteHandler(){
  if(typeof routeHandler==='function'){
    return routeHandler();
  }
  windowObject.dispatchEvent(new Event('groovy-route-change'));
}

function setHandler(handler){
  routeHandler=typeof handler==='function'?handler:null;
}

function navigate(url,state,options){
  windowObject.history.pushState(state||{},'',url);
  if(options&&options.render===false)return;
  return runRouteHandler();
}

function replace(url,state,options){
  windowObject.history.replaceState(state||{},'',url);
  if(options&&options.render===false)return;
  return runRouteHandler();
}

function back(){
  windowObject.history.back();
}

function current(){
  return windowObject.location.pathname+
    windowObject.location.search+
    windowObject.location.hash;
}

windowObject.addEventListener('popstate',function(){
  runRouteHandler();
});

windowObject.GroovyRouter=Object.freeze({
  setHandler:setHandler,
  navigate:navigate,
  replace:replace,
  back:back,
  current:current
});
})(typeof window!=='undefined'?window:null);
