(function(windowObject){
  'use strict';

  if(!windowObject||!windowObject.document)return;

  // Temporary presentation bridge. These rules belong to the detail stylesheet
  // and can disappear when the enhancement assets are loaded directly.
  try{
    var style=windowObject.document.createElement('style');
    style.id='groovy-route-runtime-fixes';
    style.textContent=
      '.detail-social-context[hidden]{display:none!important;}'+
      '@media screen and (min-width:761px){'+
        '.detail-streaming-row{margin-top:28px!important;}'+
        '.detail-streaming-row:after{content:""!important;position:absolute!important;left:4px!important;right:4px!important;top:-14px!important;height:1px!important;background:rgba(255,255,255,.09)!important;pointer-events:none!important;}'+
        '.detail-shelf-actions:not([hidden]) + .detail-streaming-row:after{top:-14px!important;}'+
      '}';
    (windowObject.document.head||windowObject.document.documentElement).appendChild(style);
  }catch(error){}

  function loadDetailEnhancements(){
    if(!windowObject.document.querySelector('link[data-groovy-detail-enhancements]')){
      var link=windowObject.document.createElement('link');
      link.rel='stylesheet';
      link.href='/css/detail-enhancements.css?v=6';
      link.setAttribute('data-groovy-detail-enhancements','true');
      (windowObject.document.head||windowObject.document.documentElement).appendChild(link);
    }

    if(!windowObject.document.querySelector('script[data-groovy-detail-enhancements]')){
      var script=windowObject.document.createElement('script');
      script.src='/js/detail-enhancements-v2.js?v=6';
      script.async=false;
      script.setAttribute('data-groovy-detail-enhancements','true');
      (windowObject.document.body||windowObject.document.documentElement).appendChild(script);
    }
  }

  if(windowObject.document.readyState==='complete'){
    setTimeout(loadDetailEnhancements,0);
  }else{
    windowObject.addEventListener('load',loadDetailEnhancements,{once:true});
  }
})(typeof window!=='undefined'?window:null);
