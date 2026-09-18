(function(){
'use strict';

var Record=window.GroovyRecord;
var RatingCore=window.GroovyRatingCore;
var UserProfileCore=window.GroovyUserProfileCore;
if(!Record||!RatingCore||!UserProfileCore)return;

var overlay=document.getElementById('albumOverlay');
var ratingRoot=document.getElementById('detailRating');
var profileCache=new Map();
var viewedToken=0;

function clamp(value){
  return RatingCore.clamp(value);
}

function scoreText(value){
  return RatingCore.format(value);
}

function scoreMarkup(value){
  var text=scoreText(value);
  return '<span class="groovy-score-main">'+text+'</span>'+(text==='—'?'':'<span class="groovy-score-max">/5</span>');
}

function esc(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}

function currentRecord(){
  if(typeof window.groovyGetOpenRecordIndex!=='function'||!Array.isArray(window.records))return null;
  var index=parseInt(window.groovyGetOpenRecordIndex(),10);
  return !isNaN(index)&&index>=0?window.records[index]||null:null;
}

async function currentUser(){
  try{
    var result=await supabaseClient.auth.getSession();
    return result&&result.data&&result.data.session?result.data.session.user:null;
  }catch(error){return null;}
}

function staticStars(value){
  var numeric=clamp(value);
  var stars='';
  for(var i=1;i<=5;i++){
    var starFill=Math.max(0,Math.min(1,numeric-(i-1)))*100;
    stars+='<span class="groovy-rating-star-cell" style="--star-fill:'+starFill.toFixed(1)+'%;" aria-hidden="true">'+
      '<span class="groovy-rating-star-base"><span class="groovy-rating-star-glyph">★</span></span>'+
      '<span class="groovy-rating-star-fill"><span class="groovy-rating-star-glyph">★</span></span>'+
    '</span>';
  }
  return '<span class="groovy-rating-stars">'+stars+'</span>';
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
  return UserProfileCore.avatarMarkup('groovy-rating-avatar',profile&&profile.avatar_url,username);
}

function renderViewed(profile,rating,albumId){
  var panels=ratingRoot&&ratingRoot.querySelector('.rating-panels');
  if(!panels)return;

  if(clamp(rating)<=0){
    var emptyPanel=panels.querySelector('.rating-panel-viewed-user');
    if(emptyPanel)emptyPanel.remove();
    panels.classList.remove('has-viewed-user');
    return;
  }

  var panel=panels.querySelector('.rating-panel-viewed-user');
  if(!panel){
    panel=document.createElement('section');
    panel.className='rating-panel rating-panel-viewed-user';
    panels.insertBefore(panel,panels.firstChild);
  }

  var username=profile&&profile.username?profile.username:'User';
  var marker=[profile&&profile.id||'',albumId,rating,username,profile&&profile.avatar_url||''].join('|');
  if(panel.dataset.groovyViewedV4!==marker){
    panel.dataset.groovyViewedV4=marker;
    panel.innerHTML=
      '<div class="groovy-rating-user">'+avatarMarkup(profile)+'<strong>'+esc(username)+"'s Rating"+'</strong></div>'+
      '<div class="groovy-rating-viewed-value">'+staticStars(rating)+'<strong class="groovy-rating-score" data-score="'+esc(scoreText(rating))+'">'+scoreMarkup(rating)+'</strong></div>';
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
  if(!viewedId){
    removeViewed();
    return;
  }

  var user=await currentUser();
  if(!user||String(viewedId)===String(user.id)){
    removeViewed();
    return;
  }

  var record=currentRecord();
  if(!record||!Record.albumId(record))return;
  var albumId=Record.albumId(record);
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
  }catch(error){
    console.warn('Could not load viewed user album rating:',error);
  }
}

function install(){
  if(!overlay||!ratingRoot)return;

  new MutationObserver(function(){
    if(overlay.classList.contains('visible')){
      setTimeout(syncViewed,40);
    }else{
      viewedToken++;
    }
  }).observe(overlay,{attributes:true,attributeFilter:['class']});

  window.addEventListener('groovy-rating-updated',function(event){
    if(!overlay.classList.contains('visible'))return;
    var record=currentRecord();
    var albumId=event&&event.detail&&event.detail.albumId;
    if(albumId&&record&&String(Record.albumId(record))!==String(albumId))return;
    setTimeout(syncViewed,0);
  });

  window.addEventListener('groovy-route-change',function(){
    if(overlay.classList.contains('visible'))setTimeout(syncViewed,0);
  });

  if(overlay.classList.contains('visible'))setTimeout(syncViewed,35);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

})();