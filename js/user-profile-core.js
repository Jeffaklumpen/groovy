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

function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(char){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
  });
}

function firstLetter(value){
  var chars=Array.from(String(value==null?'':value).trim());
  return chars.length?chars[0].toLocaleUpperCase():'';
}

function avatarState(url,username){
  var cleanUrl=String(url||'').trim();
  return {hasImage:!!cleanUrl,url:cleanUrl,initial:firstLetter(username)};
}

function avatarMarkup(baseClass,url,username){
  var state=avatarState(url,username);
  var className=String(baseClass||'').trim();
  var classes=(className?className+' ':'')+'groovy-user-avatar'+(state.hasImage?' has-image':' groovy-initial-avatar');
  if(state.hasImage){
    return '<span class="'+escapeHtml(classes)+'" style="background-image:url(&quot;'+escapeHtml(state.url)+'&quot;)" aria-hidden="true"></span>';
  }
  return '<span class="'+escapeHtml(classes)+'" aria-hidden="true">'+
    (state.initial?'<span class="groovy-initial-avatar-letter">'+escapeHtml(state.initial)+'</span>':'')+
  '</span>';
}

function applyAvatar(element,url,username){
  if(!element)return;
  var state=avatarState(url,username);
  var classes=String(element.className||'').split(/\s+/).filter(Boolean).filter(function(name){
    return name!=='groovy-user-avatar'&&name!=='groovy-initial-avatar'&&name!=='has-image';
  });
  classes.push('groovy-user-avatar');
  classes.push(state.hasImage?'has-image':'groovy-initial-avatar');
  element.className=classes.join(' ');
  element.style.backgroundImage=state.hasImage?'url("'+state.url.replace(/"/g,'%22')+'")':'none';
  element.style.backgroundSize='cover';
  element.style.backgroundPosition='center';
  element.innerHTML=state.hasImage||!state.initial?'':'<span class="groovy-initial-avatar-letter">'+escapeHtml(state.initial)+'</span>';
}

return Object.freeze({
  validUsername:validUsername,
  firstLetter:firstLetter,
  avatarState:avatarState,
  avatarMarkup:avatarMarkup,
  applyAvatar:applyAvatar
});
});
