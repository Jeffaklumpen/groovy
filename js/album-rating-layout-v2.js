(function(){
'use strict';

var overlay=document.getElementById('albumOverlay');
var ratingRoot=document.getElementById('detailRating');
var profileCache=new Map();
var viewedToken=0;
var ratingToken=0;
var layoutQueued=false;

function clamp(value){
  var n=Number(value);
  return isFinite(n)?Math.max(0,Math.min(5,n)):0;
}
function format(value){
  var n=Math.round(clamp(value)*10)/10;
  return n?n.toFixed(1):'—';
}
function firstLetter(value){
  var text=String(value||'').trim();
  return text?text.charAt(0).toUpperCase():'?';
}
function esc(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
function currentRecord(){
  var album=String((document.getElementById('detailAlbum')||{}).textContent||'').trim();
  var artist=String((document.getElementById('detailArtist')||{}).textContent||'').trim();
  if(!album||!Array.isArray(window.records))return null;
  for(var i=0;i<window.records.length;i++){
    var record=window.records[i];
    if(!record||String(record[2]||'').trim()!==album)continue;
    if(artist&&String(record[1]||'').trim()!==artist)continue;
    return record;
  }
  return null;
}
async function currentUser(){
  try{
    var result=await supabaseClient.auth.getSession();
    return result&&result.data&&result.data.session?result.data.session.user:null;
  }catch(error){return null;}
}
function fill(value){return (clamp(value)/5*100).toFixed(1)+'%';}
function staticStars(value){
  return '<span class="groovy-rating-v2-stars" style="--rating-fill:'+fill(value)+'" aria-hidden="true">'+
    '<span class="groovy-rating-v2-stars-base">★★★★★</span>'+
    '<span class="groovy-rating-v2-stars-fill">★★★★★</span>'+
  '</span>';
}
function placeRating(){
  if(!ratingRoot)return;
  var main=document.querySelector('.album-detail-main');
  var detail=main&&main.parentNode;
  if(!main||!detail)return;
  if(ratingRoot.parentNode!==detail||ratingRoot.previousElementSibling!==main){
    detail.insertBefore(ratingRoot,main.nextSibling);
  }
}
function ensureHeading(){
  if(!ratingRoot)return;
  var panels=ratingRoot.querySelector('.rating-panels');
  if(!panels)return;
  var heading=ratingRoot.querySelector('.groovy-rating-section-heading');
  if(!heading){
    heading=document.createElement('div');
    heading.className='groovy-rating-section-heading';
    ratingRoot.insertBefore(heading,panels);
  }
  if(heading.innerHTML!=='<strong>Album Ratings</strong>')heading.innerHTML='<strong>Album Ratings</strong>';
}
function ensureFooter(panel,own){
  if(!panel)return;
  var footer=panel.querySelector('.rating-panel-footer');
  if(!footer){
    footer=document.createElement('div');
    footer.className='rating-panel-footer';
    panel.appendChild(footer);
  }
  if(clamp(own)>0){
    if(!footer.querySelector('.groovy-remove-rating')){
      footer.innerHTML='<button class="groovy-remove-rating" type="button"><span class="groovy-remove-rating-icon" aria-hidden="true">♲</span><span>Remove Rating</span></button>';
    }
  }else if(footer.firstChild){
    footer.innerHTML='';
  }
}
function decorateYour(record){
  var panel=ratingRoot&&ratingRoot.querySelector('.rating-panel-your');
  if(!panel)return;
  panel.querySelectorAll('.groovy-rating-helper').forEach(function(node){node.remove();});
  var label=panel.querySelector('.rating-panel-label span:last-child');
  if(label)label.textContent='Your Rating';
  var own=clamp(record&&record[5]);
  var stars=panel.querySelector('.rating-panel-stars');
  if(stars){
    stars.querySelectorAll('.album-rating-star').forEach(function(star){
      var rating=parseInt(star.getAttribute('data-rating'),10)||0;
      star.classList.toggle('filled',own>0&&rating<=own);
      star.classList.toggle('empty',!own||rating>own);
    });
    var row=panel.querySelector('.groovy-rating-v2-value-row');
    if(!row){
      row=document.createElement('div');
      row.className='groovy-rating-v2-value-row';
      stars.parentNode.insertBefore(row,stars);
      row.appendChild(stars);
    }else if(stars.parentNode!==row){
      row.insertBefore(stars,row.firstChild);
    }
    var number=row.querySelector('.groovy-rating-v2-number');
    if(!number){
      number=document.createElement('strong');
      number.className='groovy-rating-v2-number';
      row.appendChild(number);
    }
    number.textContent=format(own);
  }
  ensureFooter(panel,own);
}
function decorateCommunity(record){
  var panel=ratingRoot&&ratingRoot.querySelector('.rating-panel-community');
  if(!panel)return;
  panel.querySelectorAll('.groovy-rating-helper').forEach(function(node){node.remove();});
  var label=panel.querySelector('.rating-panel-label span:last-child');
  if(label)label.textContent='Community Rating';
  var average=clamp(record&&record[15]);
  var count=parseInt(record&&record[16],10)||0;
  var main=panel.querySelector('.rating-panel-community-main');
  if(main){
    main.innerHTML=staticStars(average)+'<strong class="groovy-rating-v2-number">'+format(average)+'</strong>';
  }
  var footer=panel.querySelector('.rating-panel-footer');
  if(!footer){
    footer=document.createElement('div');
    footer.className='rating-panel-footer';
    panel.appendChild(footer);
  }
  var text=count+' rating'+(count===1?'':'s');
  if(footer.textContent!==text)footer.innerHTML='<span class="rating-panel-meta">'+text+'</span>';
}
function decorateBase(){
  if(!ratingRoot)return;
  placeRating();
  ensureHeading();
  var record=currentRecord();
  decorateYour(record);
  decorateCommunity(record);
}
async function profileFor(userId){
  var key=String(userId||'');
  if(profileCache.has(key))return profileCache.get(key);
  var result=await supabaseClient.from('profiles').select('id,username,avatar_url').eq('id',userId).maybeSingle();
  var profile=result&&!result.error&&result.data?result.data:{id:userId,username:'User',avatar_url:''};
  profileCache.set(key,profile);
  return profile;
}
function avatarMarkup(profile){
  var username=profile&&profile.username?profile.username:'User';
  var url=String(profile&&profile.avatar_url||'').trim();
  if(url)return '<span class="groovy-rating-v2-avatar has-image" style="background-image:url(&quot;'+esc(url)+'&quot;)" aria-hidden="true"></span>';
  return '<span class="groovy-rating-v2-avatar groovy-initial-avatar" aria-hidden="true"><span class="groovy-initial-avatar-letter">'+esc(firstLetter(username))+'</span></span>';
}
function renderViewed(profile,rating,albumId){
  var panels=ratingRoot&&ratingRoot.querySelector('.rating-panels');
  if(!panels)return;
  var panel=panels.querySelector('.rating-panel-viewed-user');
  if(!panel){
    panel=document.createElement('section');
    panel.className='rating-panel rating-panel-viewed-user';
    panels.insertBefore(panel,panels.firstChild);
  }
  var username=profile&&profile.username?profile.username:'User';
  var marker=[profile&&profile.id||'',albumId,rating,username,profile&&profile.avatar_url||''].join('|');
  if(panel.dataset.v2Marker!==marker){
    panel.dataset.v2Marker=marker;
    panel.innerHTML='<div class="groovy-rating-v2-user">'+avatarMarkup(profile)+'<strong>'+esc(username)+"'s Rating"+'</strong></div>'+
      '<div class="groovy-rating-v2-viewed-value">'+staticStars(rating)+'<strong class="groovy-rating-v2-number">'+format(rating)+'</strong></div>';
  }
  panels.classList.add('has-viewed-user');
}
function removeViewed(){
  var panels=ratingRoot&&ratingRoot.querySelector('.rating-panels');
  if(!panels)return;
  var panel=panels.querySelector('.rating-panel-viewed-user');
  if(panel)panel.remove();
  panels.classList.remove('has-viewed-user');
}
async function syncViewed(){
  if(!overlay||!overlay.classList.contains('visible'))return;
  var viewedId=window.viewedUserId;
  var user=await currentUser();
  if(!viewedId||!user||String(viewedId)===String(user.id)){
    removeViewed();
    return;
  }
  var record=currentRecord();
  if(!record||!record[8])return;
  var albumId=record[8];
  var token=++viewedToken;
  try{
    var responses=await Promise.all([
      supabaseClient.from('album_ratings').select('rating').eq('album_id',albumId).eq('user_id',viewedId).maybeSingle(),
      profileFor(viewedId)
    ]);
    if(token!==viewedToken||!overlay.classList.contains('visible'))return;
    var ratingResult=responses[0];
    var profile=responses[1];
    var value=!ratingResult.error&&ratingResult.data?clamp(ratingResult.data.rating):0;
    renderViewed(profile,value,albumId);
  }catch(error){console.warn('Could not load viewed user rating:',error);}
}
async function refreshGlobal(){
  if(!overlay||!overlay.classList.contains('visible'))return;
  var record=currentRecord();
  var user=await currentUser();
  if(!record||!record[8]||!user)return;
  var albumId=record[8];
  var token=++ratingToken;
  try{
    var result=await supabaseClient.from('album_ratings').select('user_id,rating').eq('album_id',albumId);
    if(result.error)throw result.error;
    if(token!==ratingToken||!overlay.classList.contains('visible'))return;
    var own=0,total=0,count=0;
    (result.data||[]).forEach(function(row){
      var value=clamp(row.rating);
      if(!value)return;
      total+=value;
      count++;
      if(String(row.user_id)===String(user.id))own=value;
    });
    var average=count?Math.round(total/count*10)/10:0;
    (window.records||[]).forEach(function(item){
      if(!item||String(item[8])!==String(albumId))return;
      item[5]=own;
      item[15]=average;
      item[16]=count;
    });
    decorateBase();
    syncViewed();
  }catch(error){console.warn('Could not refresh global album ratings:',error);}
}
function scheduleRefresh(){
  [180,480,950].forEach(function(delay){setTimeout(refreshGlobal,delay);});
}
function applyInitialAvatar(element,username){
  if(!element)return;
  var background=String(element.style.backgroundImage||'');
  if(!background){
    try{background=String(getComputedStyle(element).backgroundImage||'');}catch(error){}
  }
  var hasImage=background&&background!=='none'&&!/avatar_placeholder\.png/i.test(background);
  var letter=element.querySelector('.groovy-initial-avatar-letter');
  if(hasImage){
    element.classList.remove('groovy-initial-avatar');
    if(letter)letter.remove();
    return;
  }
  element.style.backgroundImage='none';
  element.classList.add('groovy-initial-avatar');
  if(!letter){
    letter=document.createElement('span');
    letter.className='groovy-initial-avatar-letter';
    element.insertBefore(letter,element.firstChild);
  }
  letter.textContent=firstLetter(username);
}
function scanAvatars(root){
  root=root&&root.querySelectorAll?root:document;
  root.querySelectorAll('.user-search-result').forEach(function(row){
    var name=row.querySelector('.user-search-username');
    applyInitialAvatar(row.querySelector('.user-search-avatar'),name&&name.textContent);
  });
  var header=document.getElementById('viewedUserHeader');
  if(header){
    var headerName=document.getElementById('viewedUserName');
    applyInitialAvatar(document.getElementById('viewedUserAvatar'),headerName&&headerName.textContent);
  }
  root.querySelectorAll('.detail-social-person').forEach(function(person){
    var name=person.querySelector('.detail-social-person-name');
    applyInitialAvatar(person.querySelector('.detail-social-avatar'),name&&name.textContent);
  });
  var profileName=document.getElementById('profileUsername');
  if(profileName&&profileName.textContent){
    applyInitialAvatar(document.getElementById('profileImage'),profileName.textContent);
    applyInitialAvatar(document.getElementById('profileImageMenu'),profileName.textContent);
  }
}
function installStyle(){
  if(document.getElementById('groovyRatingLayoutV2Styles'))return;
  var style=document.createElement('style');
  style.id='groovyRatingLayoutV2Styles';
  style.textContent=
    'html body .album-detail>.detail-rating{grid-column:1/-1!important;width:100%!important;margin:14px 0 0!important}'+
    'html body .detail-rating .groovy-rating-section-heading{margin:0 0 12px!important;padding:0!important}'+
    'html body .detail-rating .groovy-rating-section-heading>*:not(strong){display:none!important}'+
    'html body .detail-rating .groovy-rating-section-heading strong{font-size:19px!important;line-height:1.1!important;color:#f7f7f8!important;font-weight:800!important}'+
    'html body .detail-rating .rating-panels,html body .detail-rating .rating-panels.has-viewed-user{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:10px!important}'+
    'html body .detail-rating .rating-panel{background:linear-gradient(180deg,rgba(22,22,25,.98),rgba(14,14,17,.98))!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:10px!important;box-shadow:0 8px 24px rgba(0,0,0,.14)!important;padding:14px 15px!important;min-width:0!important}'+
    'html body .detail-rating .rating-panel-viewed-user{grid-column:1/-1!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding:12px 15px!important}'+
    'html body .detail-rating .rating-panel-label{display:flex!important;align-items:center!important;gap:7px!important;font-size:12px!important;font-weight:700!important;color:#f5f5f5!important}'+
    'html body .detail-rating .rating-panel-icon{display:inline-flex!important;width:22px!important;height:22px!important;flex:0 0 22px!important;color:rgba(255,255,255,.7)!important}'+
    'html body .detail-rating .groovy-rating-helper{display:none!important}'+
    'html body .detail-rating .groovy-rating-v2-value-row,html body .detail-rating .rating-panel-community-main{display:flex!important;align-items:center!important;gap:10px!important;margin-top:16px!important;min-height:30px!important;white-space:nowrap!important}'+
    'html body .detail-rating .rating-panel-stars{margin:0!important;min-height:0!important;display:flex!important;align-items:center!important;gap:1px!important;white-space:nowrap!important}'+
    'html body .detail-rating .rating-panel-stars:after{display:none!important;content:none!important}'+
    'html body .detail-rating .album-rating-star{font-size:25px!important;line-height:1!important;padding:0 1px!important}'+
    'html body .detail-rating .groovy-rating-v2-number{font-size:23px!important;line-height:1!important;color:#f7f7f8!important;font-weight:800!important}'+
    'html body .detail-rating .groovy-rating-v2-stars{position:relative;display:inline-block;line-height:1;white-space:nowrap;font-size:24px;letter-spacing:.055em}'+
    'html body .detail-rating .groovy-rating-v2-stars-base{color:rgba(255,255,255,.18)}'+
    'html body .detail-rating .groovy-rating-v2-stars-fill{position:absolute;left:0;top:0;width:var(--rating-fill);overflow:hidden;color:#ff6500;white-space:nowrap}'+
    'html body .detail-rating .rating-panel-footer{display:flex!important;align-items:center!important;min-height:24px!important;margin-top:11px!important}'+
    'html body .detail-rating .rating-panel-meta{font-size:10px!important;color:rgba(255,255,255,.52)!important}'+
    'html body .detail-rating .groovy-remove-rating{display:inline-flex!important;align-items:center!important;gap:5px!important;min-height:24px!important;padding:0!important;border:0!important;background:transparent!important;color:rgba(255,255,255,.62)!important;font-size:10px!important;font-weight:600!important;cursor:pointer!important;text-decoration:none!important}'+
    'html body .detail-rating .groovy-remove-rating:hover{color:#ff720f!important}'+
    'html body .detail-rating .groovy-remove-rating-icon{font-size:13px;line-height:1}'+
    '.groovy-rating-v2-user{display:flex;align-items:center;gap:10px;min-width:0}'+
    '.groovy-rating-v2-user strong{font-size:12px;line-height:1.1;color:#f5f5f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '.groovy-rating-v2-viewed-value{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0;white-space:nowrap}'+
    '.groovy-rating-v2-avatar{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex:0 0 34px;border-radius:50%;background-position:center;background-size:cover;background-repeat:no-repeat}'+
    '.groovy-initial-avatar{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;background-image:none!important;background:#15110f!important;border:1px solid #a84a16!important;color:#f5f5f5!important;font-weight:700!important;overflow:hidden!important}'+
    '.groovy-initial-avatar-letter{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:14px;line-height:1;text-transform:uppercase;pointer-events:none}'+
    '.groovy-rating-v2-avatar .groovy-initial-avatar-letter{font-size:15px}'+
    '#viewedUserAvatar .groovy-initial-avatar-letter{font-size:16px}'+
    '@media screen and (max-width:760px){'+
      'html body .album-detail>.detail-rating{grid-row:2!important;margin-top:12px!important}'+
      'html body .detail-rating .groovy-rating-section-heading{margin-bottom:9px!important}'+
      'html body .detail-rating .groovy-rating-section-heading strong{font-size:14px!important}'+
      'html body .detail-rating .rating-panels,html body .detail-rating .rating-panels.has-viewed-user{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:7px!important}'+
      'html body .detail-rating .rating-panel{padding:10px!important;border-radius:9px!important}'+
      'html body .detail-rating .rating-panel-viewed-user{grid-column:1/-1!important;padding:9px 10px!important;gap:8px!important}'+
      'html body .detail-rating .rating-panel-label{font-size:9px!important;gap:5px!important}'+
      'html body .detail-rating .rating-panel-icon{width:16px!important;height:16px!important;flex-basis:16px!important}'+
      'html body .detail-rating .groovy-rating-v2-value-row,html body .detail-rating .rating-panel-community-main{gap:5px!important;margin-top:9px!important;min-height:22px!important}'+
      'html body .detail-rating .album-rating-star{font-size:17px!important;padding:0!important}'+
      'html body .detail-rating .groovy-rating-v2-stars{font-size:16px!important;letter-spacing:.03em!important}'+
      'html body .detail-rating .groovy-rating-v2-number{font-size:18px!important}'+
      'html body .detail-rating .rating-panel-footer{min-height:19px!important;margin-top:6px!important}'+
      'html body .detail-rating .rating-panel-meta,html body .detail-rating .groovy-remove-rating{font-size:7px!important}'+
      'html body .detail-rating .groovy-rating-v2-user{gap:7px!important}'+
      'html body .detail-rating .groovy-rating-v2-user strong{font-size:9px!important}'+
      'html body .detail-rating .groovy-rating-v2-avatar{width:26px!important;height:26px!important;flex-basis:26px!important}'+
      'html body .detail-rating .groovy-rating-v2-avatar .groovy-initial-avatar-letter{font-size:11px!important}'+
      'html body .detail-rating .groovy-rating-v2-viewed-value{gap:5px!important}'+
      'html body .album-overlay .detail-info-card .detail-meta{gap:0!important}'+
      'html body .album-overlay .detail-info-card .detail-meta>span{flex:0 0 auto!important;width:auto!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailYear{flex:none!important;overflow:visible!important;text-overflow:clip!important;max-width:none!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailGenre{flex:0 1 auto!important;width:auto!important;max-width:calc(100% - 42px)!important;margin-left:7px!important;padding-left:8px!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailGenre:before{left:0!important}'+
    '}'+
    '@media screen and (max-width:380px){'+
      'html body .detail-rating .rating-panel{padding:8px!important}'+
      'html body .detail-rating .album-rating-star{font-size:15px!important}'+
      'html body .detail-rating .groovy-rating-v2-stars{font-size:14px!important}'+
      'html body .detail-rating .groovy-rating-v2-number{font-size:16px!important}'+
    '}';
  document.head.appendChild(style);
}
function decorate(){
  if(!ratingRoot)return;
  placeRating();
  ensureHeading();
  var record=currentRecord();
  decorateYour(record);
  decorateCommunity(record);
}
function queueDecorate(){
  if(layoutQueued)return;
  layoutQueued=true;
  setTimeout(function(){
    layoutQueued=false;
    decorate();
    scanAvatars(document);
  },0);
}
function install(){
  if(!overlay||!ratingRoot)return;
  installStyle();
  decorate();
  scanAvatars(document);
  [100,500,1200].forEach(function(delay){setTimeout(function(){scanAvatars(document);},delay);});

  new MutationObserver(function(){queueDecorate();}).observe(ratingRoot,{childList:true,subtree:true});
  new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      mutation.addedNodes.forEach(function(node){if(node&&node.nodeType===1)scanAvatars(node);});
    });
  }).observe(document.body,{childList:true,subtree:true});
  new MutationObserver(function(){
    if(overlay.classList.contains('visible')){
      setTimeout(function(){decorate();syncViewed();refreshGlobal();},35);
    }else{
      viewedToken++;
      ratingToken++;
    }
  }).observe(overlay,{attributes:true,attributeFilter:['class']});

  document.addEventListener('click',function(event){
    if(event.target.closest&&event.target.closest('.album-rating-star,.groovy-remove-rating'))scheduleRefresh();
  },false);
  window.addEventListener('resize',function(){setTimeout(decorate,40);},{passive:true});
  window.addEventListener('popstate',function(){setTimeout(function(){decorate();syncViewed();},80);});

  if(overlay.classList.contains('visible'))setTimeout(function(){decorate();syncViewed();refreshGlobal();},30);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
