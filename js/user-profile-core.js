(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyUserProfileCore=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function validUsername(value){
  var username=String(value==null?'':value).trim();
  return username.length>=3&&username.length<=30&&/^[\p{L}\p{N}._-]+$/u.test(username);
}

return Object.freeze({validUsername:validUsername});
});
