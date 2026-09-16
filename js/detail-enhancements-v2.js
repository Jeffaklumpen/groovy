(function(){
'use strict';

var currentDetailIndex=-1;
var ratingTimer=null;
var socialToken=0;
var ratingHome=null;
var lastTouchRating=0;
var loggedOutMode=false;

function clamp(value){var n=Number(value);return isFinite(n)?Math.max(0,Math.min(5,n)):0;}
function ratingText(value){var n=Math.round(clamp(value)*10)/10;return n?(Number.isInteger(n)?n.toFixed(0):n.toFixed(1)):'—';}
function fill(value){return (clamp(value)/5*100).toFixed(1)+'%';}
function starMeter(value,extra){return '<span class="groovy-star-meter'+(extra?' '+extra:'')+'" style="--rating-fill:'+fill(value)+'"><span class="groovy-star-meter-base" aria-hidden="true">★★★★★</span><span class="groovy-star-meter-fill" aria-hidden="true">★★★★★</span></span>';}
function recordAt(index){return Array.isArray(window.records)&&index>=0?window.records[index]:null;}

async function sessionUser(){
  var result=await supabaseClient.auth.getSession();
  return result&&result.data&&result.data.session&&result.data.session.user?result.data.session.user:null;
}

function detailIndex(){
  var album=(document.getElementById('detailAlbum')||{}).textContent||'';
  var artist=(document.getElementById('detailArtist')||{}).textContent||'';
  album=album.trim();artist=artist.trim();
  var current=recordAt(currentDetailIndex);
  if(current&&String(current[2]||'').trim()===album&&(!artist||String(current[1]||'').trim()===artist))return currentDetailIndex;
  if(!album||!Array.isArray(window.records))return -1;
  for(var i=0;i<window.records.length;i++){
    var r=window.records[i];
    if(r&&String(r[2]||'').trim()===album&&(!artist||String(r[1]||'').trim()===artist)){currentDetailIndex=i;return i;}
  }
  return -1;
}

/* Community Rating = average of every user's rating, matching app.js. */
function ratingMap(rows,userId){
  var map={};
  (rows||[]).forEach(function(row){
    var key=String(row.album_id),rating=clamp(row.rating);
    var entry=map[key]||(map[key]={own:0,total:0,count:0,average:0});
    if(!rating)return;
    entry.total+=rating;entry.count++;
    if(String(row.user_id)===String(userId))entry.own=rating;
  });
  Object.keys(map).forEach(function(key){var e=map[key];e.average=e.count?Math.round(e.total/e.count*10)/10:0;});
  return map;
}

function applyRatingEntry(albumId,entry){
  (window.records||[]).forEach(function(r){
    if(!r||String(r[8])!==String(albumId))return;
    r[5]=entry.own||0;r[15]=entry.average||0;r[16]=entry.count||0;
  });
}

function setOwnOnly(albumId,rating){
  (window.records||[]).forEach(function(r){if(r&&String(r[8])===String(albumId))r[5]=rating||0;});
}

function ensureRatingFooter(panel,own){
  if(!panel)return;
  var footer=panel.querySelector('.rating-panel-footer');
  if(!footer){footer=document.createElement('div');footer.className='rating-panel-footer';panel.appendChild(footer);}
  if(own>0){if(!footer.querySelector('.groovy-remove-rating'))footer.innerHTML='<button class="groovy-remove-rating" type="button">Remove Rating</button>';}
  else if(!footer.querySelector('.rating-panel-empty-note'))footer.innerHTML='<span class="rating-panel-empty-note">Not rated yet</span>';
}

function updateDetailRating(index){
  var r=recordAt(index),root=document.getElementById('detailRating');
  if(!r||!root)return;
  var own=clamp(r[5]),community=clamp(r[15]),count=parseInt(r[16],10)||0;
  var yours=root.querySelector('.rating-panel-your'),comm=root.querySelector('.rating-panel-community');
  if(yours){
    yours.querySelectorAll('.album-rating-star').forEach(function(star){var n=parseInt(star.getAttribute('data-rating'),10)||0;star.classList.toggle('filled',n<=own);star.classList.toggle('empty',n>own);});
    ensureRatingFooter(yours,own);
  }
  if(comm){
    var meter=comm.querySelector('.groovy-star-meter');if(meter)meter.style.setProperty('--rating-fill',fill(community));
    var number=comm.querySelector('.rating-panel-community-main strong');if(number)number.textContent=ratingText(community);
    var meta=comm.querySelector('.rating-panel-meta');if(meta)meta.textContent=count+' rating'+(count===1?'':'s');
  }
}

function patchCard(card,r){
  if(!card||!r)return;
  var target=card.querySelector('.cover-rating');if(!target)return;
  var avg=clamp(r[15]),marker=avg+'|'+(r[16]||0);
  if(target.dataset.communityMarker===marker&&target.querySelector('.cover-rating-inner'))return;
  target.dataset.communityMarker=marker;
  target.innerHTML='<span class="cover-rating-inner">'+starMeter(avg,'is-compact')+'<span class="cover-rating-number">'+ratingText(avg)+'</span></span>';
}

function patchCards(){
  var collection=document.getElementById('collection');if(!collection)return;
  collection.querySelectorAll('.record[data-index]').forEach(function(card){var i=parseInt(card.getAttribute('data-index'),10);if(!isNaN(i))patchCard(card,recordAt(i));});
}

async function refreshAllRatings(){
  var records=Array.isArray(window.records)?window.records:[];if(!records.length)return;
  var user=await sessionUser();if(!user)return;
  var ids=Array.from(new Set(records.map(function(r){return r&&r[8];}).filter(Boolean)));if(!ids.length)return;
  var result=await supabaseClient.from('album_ratings').select('album_id,user_id,rating').in('album_id',ids);
  if(result.error){console.warn('Could not refresh community ratings:',result.error);return;}
  var map=ratingMap(result.data||[],user.id);
  records.forEach(function(r){if(!r)return;var e=map[String(r[8])]||{own:0,average:0,count:0};r[5]=e.own||0;r[15]=e.average||0;r[16]=e.count||0;});
  patchCards();
  var i=detailIndex(),overlay=document.getElementById('albumOverlay');if(i>=0&&overlay&&overlay.classList.contains('visible'))updateDetailRating(i);
}

function scheduleRatings(delay){clearTimeout(ratingTimer);ratingTimer=setTimeout(refreshAllRatings,delay==null?100:delay);}

async function refreshAlbumRating(index){
  var r=recordAt(index),user=await sessionUser();if(!r||!r[8]||!user)return;
  var result=await supabaseClient.from('album_ratings').select('album_id,user_id,rating').eq('album_id',r[8]);
  if(result.error)return;
  var e=ratingMap(result.data||[],user.id)[String(r[8])]||{own:0,average:0,count:0};
  applyRatingEntry(r[8],e);updateDetailRating(index);patchCards();
}

async function saveRating(index,rating){
  var r=recordAt(index),user=await sessionUser();if(!r||!user)return;
  setOwnOnly(r[8],rating);updateDetailRating(index);
  var result=await supabaseClient.from('album_ratings').upsert({user_id:user.id,album_id:r[8],rating:rating},{onConflict:'user_id,album_id'});
  if(result.error){alert('Kunde inte spara ratingen.\n\n'+(result.error.message||result.error));}
  await refreshAlbumRating(index);scheduleRatings(100);
}

async function removeRating(index,button){
  var r=recordAt(index),user=await sessionUser();if(!r||!user)return;
  button.disabled=true;button.textContent='Removing…';
  var result=await supabaseClient.from('album_ratings').delete().eq('user_id',user.id).eq('album_id',r[8]);
  if(result.error){button.disabled=false;button.textContent='Remove Rating';alert('Could not remove the rating.\n\n'+(result.error.message||result.error));return;}
  await refreshAlbumRating(index);scheduleRatings(100);
}

function placeRating(){
  var rating=document.getElementById('detailRating'),info=document.querySelector('.detail-info-card'),main=document.querySelector('.album-detail-main');
  if(!rating||!info||!main)return;if(!ratingHome)ratingHome=info;
  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
  if(mobile){if(rating.parentNode!==main.parentNode)main.parentNode.insertBefore(rating,main.nextSibling);}
  else if(rating.parentNode!==ratingHome)ratingHome.appendChild(rating);
}

function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}

function syncMobileStreaming(){
  var info=document.querySelector('.detail-info-card'),apple=document.getElementById('detailAppleMusicLink'),spotify=document.getElementById('detailSpotifyLink');
  if(!info||!apple||!spotify)return;
  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches,box=info.querySelector('.groovy-mobile-streaming');
  if(!mobile){if(box)box.remove();return;}
  if(!box){box=document.createElement('div');box.className='groovy-mobile-streaming';info.appendChild(box);}
  box.innerHTML='<a class="groovy-mobile-streaming-link groovy-mobile-apple" href="'+esc(apple.href)+'" target="_blank" rel="noopener noreferrer"><img src="/Apple_Music_Listen_on_Badge_Small.svg" alt="Listen on Apple Music"></a><a class="groovy-mobile-streaming-link groovy-mobile-spotify" href="'+esc(spotify.href)+'" target="_blank" rel="noopener noreferrer"><img src="/Full_Logo_Green_RGB.svg" alt="Spotify"></a>';
}

function renderCollectedBy(profiles){
  var social=document.getElementById('detailSocialContext');if(!social)return;
  if(!profiles||!profiles.length){social.hidden=true;social.innerHTML='';social.classList.remove('own-match','wishlist-collected');return;}
  social.classList.remove('own-match');social.classList.add('wishlist-collected');social.hidden=false;
  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches,limit=mobile?4:10,more=profiles.length>limit,visible=profiles.slice(0,more?limit-1:limit),extra=profiles.slice(more?limit-1:limit);
  function person(p,cls){var u=esc(p.username||'Collector'),a=esc(p.avatar_url||'/avatar_placeholder.png');return '<button class="detail-social-person'+(cls?' '+cls:'')+'" type="button" data-detail-social-username="'+u+'" data-tooltip="'+u+'"><span class="detail-social-avatar" style="background-image:url(&quot;'+a+'&quot;)"></span><span class="detail-social-person-name">'+u+'</span></button>';}
  social.innerHTML='<div class="detail-social-heading"><strong>Collected by</strong><small>Collectors you follow</small></div><div class="detail-social-people">'+visible.map(function(p){return person(p,'');}).join('')+(more?'<button class="detail-social-more" type="button" data-detail-social-more>…</button>':'')+'</div>'+(more?'<div class="detail-social-menu" data-detail-social-menu hidden><div class="detail-social-menu-title">More collectors</div><div class="detail-social-menu-list">'+extra.map(function(p){return person(p,'detail-social-menu-person');}).join('')+'</div></div>':'');
}

async function refreshWishlistCollectedBy(index){
  var r=recordAt(index),token=++socialToken;if(!r||window.libraryView!=='wishlist'||window.viewedUserId!==null)return;
  var user=await sessionUser();if(!user||token!==socialToken)return;
  var follows=await supabaseClient.from('user_follows').select('followed_id').eq('follower_id',user.id);if(follows.error)return;
  var ids=(follows.data||[]).map(function(x){return x.followed_id;}).filter(Boolean);if(!ids.length){renderCollectedBy([]);return;}
  var master=String(r[10]||'').trim();
  var q=supabaseClient.from('collections').select(master?'user_id,albums!inner(discogs_master_id)':'user_id').in('user_id',ids);
  q=master?q.eq('albums.discogs_master_id',master):q.eq('album_id',r[8]);
  var matches=await q;if(matches.error||token!==socialToken)return;
  var matchIds=Array.from(new Set((matches.data||[]).map(function(x){return x.user_id;}).filter(Boolean)));if(!matchIds.length){renderCollectedBy([]);return;}
  var profiles=await supabaseClient.from('profiles').select('id,username,avatar_url').in('id',matchIds);if(profiles.error||token!==socialToken)return;
  renderCollectedBy(profiles.data||[]);
}

async function addWishlistToCollection(index,button){
  var r=recordAt(index),user=await sessionUser();if(!r||!user||window.libraryView!=='wishlist'||window.viewedUserId!==null)return;
  button.disabled=true;button.textContent='Adding…';
  try{
    var existing=await supabaseClient.from('collections').select('id').eq('user_id',user.id).eq('album_id',r[8]).limit(1);if(existing.error)throw existing.error;
    if(!existing.data||!existing.data.length){
      var last=await supabaseClient.from('collections').select('sort_order').eq('user_id',user.id).order('sort_order',{ascending:false}).limit(1);if(last.error)throw last.error;
      var next=last.data&&last.data.length?(parseInt(last.data[0].sort_order,10)||0)+1:1;
      var inserted=await supabaseClient.from('collections').insert({user_id:user.id,album_id:r[8],cover_url:r[6]||null,discogs_style:r[4]||null,sort_order:next});if(inserted.error)throw inserted.error;
    }
    var removed=await supabaseClient.from('wishlists').delete().eq('id',r[9]).eq('user_id',user.id);if(removed.error)throw removed.error;
    var close=document.getElementById('albumClose');if(close)close.click();if(typeof window.loadCollection==='function')await window.loadCollection();
  }catch(error){button.disabled=false;button.textContent='Add to collection';alert('Could not add the album to your collection.\n\n'+(error.message||error));}
}

function wishlistAction(){
  var actions=document.getElementById('detailShelfActions');if(!actions)return;
  if(window.libraryView!=='wishlist'||window.viewedUserId!==null){actions.classList.remove('wishlist-detail-actions');return;}
  actions.hidden=false;actions.classList.add('wishlist-detail-actions');
  if(!actions.querySelector('.groovy-detail-add-collection'))actions.innerHTML='<button class="detail-move-to-collection groovy-detail-add-collection" type="button">Add to collection</button>';
}

function cleanupLoggedOutUi(){
  if(!loggedOutMode||window.location.pathname!=='/')return;
  window.viewedUserId=null;window.groovyViewedStatisticsProfile=null;
  var header=document.getElementById('viewedUserHeader');
  if(header){if(header.style.display!=='none')header.style.display='none';if(header.dataset.own!=='false')header.dataset.own='false';}
  var strip=document.getElementById('shelfStrip');if(strip&&!strip.hidden)strip.hidden=true;
  var search=document.getElementById('librarySearchInput');if(search&&search.value)search.value='';
}

function armLogoutCleanup(){loggedOutMode=true;cleanupLoggedOutUi();[40,120,300,700,1500,3000].forEach(function(ms){setTimeout(cleanupLoggedOutUi,ms);});}

function onDetailOpen(){
  placeRating();syncMobileStreaming();
  var i=detailIndex();if(i<0)return;currentDetailIndex=i;wishlistAction();updateDetailRating(i);refreshAlbumRating(i);
  if(window.libraryView==='wishlist'&&window.viewedUserId===null)setTimeout(function(){refreshWishlistCollectedBy(i);},80);
}

function interceptStar(event,touch){
  var star=event.target.closest&&event.target.closest('.album-rating-star');if(!star)return false;
  event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();
  if(touch)lastTouchRating=Date.now();else if(Date.now()-lastTouchRating<700)return true;
  var i=detailIndex(),n=parseInt(star.getAttribute('data-rating'),10);if(i>=0&&n>=1&&n<=5)saveRating(i,n);return true;
}

function install(){
  var collection=document.getElementById('collection'),overlay=document.getElementById('albumOverlay'),header=document.getElementById('viewedUserHeader'),strip=document.getElementById('shelfStrip');
  if(!collection||!overlay)return;ratingHome=document.querySelector('.detail-info-card');placeRating();

  document.addEventListener('touchend',function(e){interceptStar(e,true);},true);
  document.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('#logoutButton'))armLogoutCleanup();
    if(interceptStar(e,false))return;
    var card=e.target.closest&&e.target.closest('#collection .record[data-index]');if(card){var ci=parseInt(card.getAttribute('data-index'),10);if(!isNaN(ci))currentDetailIndex=ci;}
    var remove=e.target.closest&&e.target.closest('.groovy-remove-rating');if(remove){e.preventDefault();e.stopPropagation();var ri=detailIndex();if(ri>=0)removeRating(ri,remove);return;}
    var add=e.target.closest&&e.target.closest('.groovy-detail-add-collection');if(add){e.preventDefault();e.stopPropagation();var ai=detailIndex();if(ai>=0)addWishlistToCollection(ai,add);return;}
  },true);

  new MutationObserver(function(){scheduleRatings(100);}).observe(collection,{childList:true,subtree:true});
  new MutationObserver(function(){if(overlay.classList.contains('visible'))setTimeout(onDetailOpen,0);else socialToken++;}).observe(overlay,{attributes:true,attributeFilter:['class']});
  if(header)new MutationObserver(cleanupLoggedOutUi).observe(header,{attributes:true,attributeFilter:['style','class']});
  if(strip)new MutationObserver(cleanupLoggedOutUi).observe(strip,{attributes:true,attributeFilter:['hidden','style','class']});

  window.addEventListener('resize',function(){placeRating();syncMobileStreaming();if(overlay.classList.contains('visible'))setTimeout(onDetailOpen,0);},{passive:true});
  supabaseClient.auth.onAuthStateChange(function(event,session){if(session)loggedOutMode=false;else armLogoutCleanup();});
  sessionUser().then(function(user){if(!user)armLogoutCleanup();});
  scheduleRatings(60);if(overlay.classList.contains('visible'))onDetailOpen();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
