(function(){
'use strict';

var Record=window.GroovyRecord;
if(!Record)return;

var currentDetailIndex=-1;
var wishlistRatingTimer=null;
var socialToken=0;
var ratingHome=null;

function clamp(value){
  var n=Number(value);
  return isFinite(n)?Math.max(0,Math.min(5,n)):0;
}

function ratingText(value){
  var n=Math.round(clamp(value)*10)/10;
  return n?(Number.isInteger(n)?n.toFixed(0):n.toFixed(1)):'—';
}

function fill(value){return (clamp(value)/5*100).toFixed(1)+'%';}

function starMeter(value,extra){
  return '<span class="groovy-star-meter'+(extra?' '+extra:'')+'" style="--rating-fill:'+fill(value)+'">'+
    '<span class="groovy-star-meter-base" aria-hidden="true">★★★★★</span>'+
    '<span class="groovy-star-meter-fill" aria-hidden="true">★★★★★</span>'+
  '</span>';
}

function esc(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}

async function sessionUser(){
  var result=await supabaseClient.auth.getSession();
  return result&&result.data&&result.data.session&&result.data.session.user
    ?result.data.session.user
    :null;
}

function recordAt(index){
  return Array.isArray(window.records)&&index>=0?window.records[index]:null;
}

function detailIndex(){
  if(typeof window.groovyGetOpenRecordIndex==='function'){
    var index=parseInt(window.groovyGetOpenRecordIndex(),10);
    if(!isNaN(index)&&recordAt(index))return index;
  }
  return currentDetailIndex>=0&&recordAt(currentDetailIndex)?currentDetailIndex:-1;
}

function ratingMap(rows,userId){
  var map={};
  (rows||[]).forEach(function(row){
    var key=String(row.album_id);
    var rating=clamp(row.rating);
    var entry=map[key]||(map[key]={own:0,total:0,count:0,average:0});
    if(!rating)return;
    entry.total+=rating;
    entry.count++;
    if(String(row.user_id)===String(userId))entry.own=rating;
  });
  Object.keys(map).forEach(function(key){
    var entry=map[key];
    entry.average=entry.count?Math.round(entry.total/entry.count*10)/10:0;
  });
  return map;
}

function patchCard(card,record){
  if(!card||!record)return;
  var target=card.querySelector('.cover-rating');
  if(!target)return;
  var average=clamp(Record.communityRating(record));
  var marker=average+'|'+(Record.communityCount(record)||0);
  if(target.dataset.communityMarker===marker&&target.querySelector('.cover-rating-inner'))return;
  target.dataset.communityMarker=marker;
  target.innerHTML='<span class="cover-rating-inner">'+starMeter(average,'is-compact')+'<span class="cover-rating-number">'+ratingText(average)+'</span></span>';
}

function patchCardsForAlbum(albumId){
  var collection=document.getElementById('collection');
  if(!collection)return;
  collection.querySelectorAll('.record[data-index]').forEach(function(card){
    var index=parseInt(card.getAttribute('data-index'),10);
    var record=recordAt(index);
    if(!record||String(Record.albumId(record))!==String(albumId))return;
    patchCard(card,record);
  });
}

function patchAllWishlistCards(){
  if(window.libraryView!=='wishlist')return;
  var collection=document.getElementById('collection');
  if(!collection)return;
  collection.querySelectorAll('.record[data-index]').forEach(function(card){
    var index=parseInt(card.getAttribute('data-index'),10);
    if(!isNaN(index))patchCard(card,recordAt(index));
  });
}

/* Wishlist records do not receive rating metadata from app.js. Hydrate only the
   wishlist here. Normal collections keep app.js as their single source of truth. */
async function refreshWishlistRatings(){
  if(window.libraryView!=='wishlist')return;
  var records=Array.isArray(window.records)?window.records:[];
  if(!records.length)return;
  var user=await sessionUser();
  if(!user)return;

  var albumIds=Array.from(new Set(records.map(function(record){return record&&Record.albumId(record);}).filter(Boolean)));
  if(!albumIds.length)return;

  var result=await supabaseClient.from('album_ratings')
    .select('album_id,user_id,rating')
    .in('album_id',albumIds);
  if(result.error){
    console.warn('Could not load wishlist ratings:',result.error);
    return;
  }

  var map=ratingMap(result.data||[],user.id);
  records.forEach(function(record){
    if(!record)return;
    var entry=map[String(Record.albumId(record))]||{own:0,average:0,count:0};
    Record.setRatings(record,entry.own||0,entry.average||0,entry.count||0);
  });

  patchAllWishlistCards();
  var index=detailIndex();
  var overlay=document.getElementById('albumOverlay');
  if(index>=0&&overlay&&overlay.classList.contains('visible')&&typeof window.groovyRenderAlbumRating==='function')window.groovyRenderAlbumRating(index);

  window.dispatchEvent(new CustomEvent('groovy-rating-updated',{detail:{source:'wishlist-hydrate'}}));
}

function scheduleWishlistRatings(delay){
  if(window.libraryView!=='wishlist')return;
  clearTimeout(wishlistRatingTimer);
  wishlistRatingTimer=setTimeout(refreshWishlistRatings,delay==null?100:delay);
}

async function removeRating(index,button){
  var record=recordAt(index);
  var user=await sessionUser();
  if(!record||!user)return;

  var albumId=Record.albumId(record);
  var oldOwn=clamp(Record.ownRating(record));
  var oldAverage=clamp(Record.communityRating(record));
  var oldCount=parseInt(Record.communityCount(record),10)||0;

  button.disabled=true;
  button.textContent='Removing…';

  var result=await supabaseClient.from('album_ratings')
    .delete()
    .eq('user_id',user.id)
    .eq('album_id',albumId);

  if(result.error){
    button.disabled=false;
    button.textContent='Remove Rating';
    alert('Could not remove the rating.\n\n'+(result.error.message||result.error));
    return;
  }

  var nextCount=oldOwn>0?Math.max(0,oldCount-1):oldCount;
  var nextAverage=oldAverage;
  if(oldOwn>0){
    nextAverage=nextCount>0?((oldAverage*oldCount)-oldOwn)/nextCount:0;
    nextAverage=Math.round(clamp(nextAverage)*10)/10;
  }

  (window.records||[]).forEach(function(item){
    if(!item||String(Record.albumId(item))!==String(albumId))return;
    Record.setRatings(item,0,nextAverage,nextCount);
  });

  if(typeof window.groovyRenderAlbumRating==='function')window.groovyRenderAlbumRating(index);
  patchCardsForAlbum(albumId);
  if(window.libraryView==='wishlist')scheduleWishlistRatings(150);

  window.dispatchEvent(new CustomEvent('groovy-rating-updated',{detail:{albumId:albumId,index:index,source:'remove'}}));
}

function placeRating(){
  var rating=document.getElementById('detailRating');
  var info=document.querySelector('.detail-info-card');
  var main=document.querySelector('.album-detail-main');
  if(!rating||!info||!main)return;
  if(!ratingHome)ratingHome=info;

  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
  if(mobile){
    if(rating.parentNode!==main.parentNode)main.parentNode.insertBefore(rating,main.nextSibling);
  }else if(rating.parentNode!==ratingHome){
    ratingHome.appendChild(rating);
  }
}

function syncMobileStreaming(){
  var info=document.querySelector('.detail-info-card');
  var apple=document.getElementById('detailAppleMusicLink');
  var spotify=document.getElementById('detailSpotifyLink');
  if(!info||!apple||!spotify)return;

  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
  var box=info.querySelector('.groovy-mobile-streaming');

  if(!mobile){
    if(box)box.remove();
    return;
  }

  if(!box){
    box=document.createElement('div');
    box.className='groovy-mobile-streaming';
    info.appendChild(box);
  }

  box.innerHTML=
    '<a class="groovy-mobile-streaming-link groovy-mobile-apple" href="'+esc(apple.href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(apple.getAttribute('aria-label')||'Listen on Apple Music')+'">'+
      '<img src="/assets/brands/apple-music-badge-small.svg" alt="Listen on Apple Music">'+
    '</a>'+ 
    '<a class="groovy-mobile-streaming-link groovy-mobile-spotify" href="'+esc(spotify.href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(spotify.getAttribute('aria-label')||'Listen on Spotify')+'">'+
      '<img src="/assets/brands/spotify-full-logo-green.svg" alt="Spotify">'+
    '</a>';
}

function renderCollectedBy(profiles){
  var social=document.getElementById('detailSocialContext');
  if(!social)return;

  if(!profiles||!profiles.length){
    social.hidden=true;
    social.innerHTML='';
    social.classList.remove('own-match','wishlist-collected');
    return;
  }

  social.classList.remove('own-match');
  social.classList.add('wishlist-collected');
  social.hidden=false;

  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
  var limit=mobile?4:10;
  var hasMore=profiles.length>limit;
  var visible=profiles.slice(0,hasMore?limit-1:limit);
  var extra=profiles.slice(hasMore?limit-1:limit);

  function person(profile,extraClass){
    var username=esc(profile.username||'Collector');
    var avatar=esc(profile.avatar_url||'/assets/images/avatar-placeholder.png');
    return '<button class="detail-social-person'+(extraClass?' '+extraClass:'')+'" type="button" data-detail-social-username="'+username+'" data-tooltip="'+username+'" aria-label="View '+username+'">'+
      '<span class="detail-social-avatar" style="background-image:url(&quot;'+avatar+'&quot;)"></span>'+
      '<span class="detail-social-person-name">'+username+'</span>'+
    '</button>';
  }

  social.innerHTML=
    '<div class="detail-social-heading"><strong>Collected by</strong><small>Collectors you follow</small></div>'+
    '<div class="detail-social-people">'+visible.map(function(profile){return person(profile,'');}).join('')+
      (hasMore?'<button class="detail-social-more" type="button" data-detail-social-more aria-expanded="false">…</button>':'')+
    '</div>'+
    (hasMore?'<div class="detail-social-menu" data-detail-social-menu hidden><div class="detail-social-menu-title">More collectors</div><div class="detail-social-menu-list">'+extra.map(function(profile){return person(profile,'detail-social-menu-person');}).join('')+'</div></div>':'');
}

async function refreshWishlistCollectedBy(index){
  var record=recordAt(index);
  var token=++socialToken;
  if(!record||window.libraryView!=='wishlist'||window.viewedUserId!==null)return;

  var user=await sessionUser();
  if(!user||token!==socialToken)return;

  var follows=await supabaseClient.from('user_follows')
    .select('followed_id')
    .eq('follower_id',user.id);
  if(follows.error)return;

  var followedIds=(follows.data||[]).map(function(row){return row.followed_id;}).filter(Boolean);
  if(!followedIds.length){renderCollectedBy([]);return;}

  var masterId=String(Record.discogsMasterId(record)||'').trim();
  var query=supabaseClient.from('collections')
    .select(masterId?'user_id,albums!inner(discogs_master_id)':'user_id')
    .in('user_id',followedIds);
  query=masterId?query.eq('albums.discogs_master_id',masterId):query.eq('album_id',Record.albumId(record));

  var matches=await query;
  if(matches.error||token!==socialToken)return;

  var matchingIds=Array.from(new Set((matches.data||[]).map(function(row){return row.user_id;}).filter(Boolean)));
  if(!matchingIds.length){renderCollectedBy([]);return;}

  var profiles=await supabaseClient.from('profiles')
    .select('id,username,avatar_url')
    .in('id',matchingIds);
  if(profiles.error||token!==socialToken)return;

  var order=new Map(matchingIds.map(function(id,pos){return [String(id),pos];}));
  var sorted=(profiles.data||[]).slice().sort(function(a,b){
    return (order.get(String(a.id))||0)-(order.get(String(b.id))||0);
  });
  renderCollectedBy(sorted);
}

function ensureWishlistAction(){
  var actions=document.getElementById('detailShelfActions');
  if(!actions)return;

  if(window.libraryView!=='wishlist'||window.viewedUserId!==null){
    actions.classList.remove('wishlist-detail-actions');
    return;
  }

  actions.hidden=false;
  actions.classList.add('wishlist-detail-actions');
  if(!actions.querySelector('.groovy-detail-add-collection')){
    actions.innerHTML='<button class="detail-move-to-collection groovy-detail-add-collection" type="button">Add to collection</button>';
  }
}

function onDetailOpen(){
  placeRating();
  syncMobileStreaming();

  var index=detailIndex();
  if(index<0)return;
  currentDetailIndex=index;
  ensureWishlistAction();

  if(window.libraryView==='wishlist'){
    refreshWishlistRatings();
    if(window.viewedUserId===null)setTimeout(function(){refreshWishlistCollectedBy(index);},80);
  }
}

function install(){
  var collection=document.getElementById('collection');
  var overlay=document.getElementById('albumOverlay');
  if(!collection||!overlay)return;

  ratingHome=document.querySelector('.detail-info-card');
  placeRating();

  document.addEventListener('click',function(event){
    var card=event.target.closest&&event.target.closest('#collection .record[data-index]');
    if(card){
      var cardIndex=parseInt(card.getAttribute('data-index'),10);
      if(!isNaN(cardIndex))currentDetailIndex=cardIndex;
    }

    var remove=event.target.closest&&event.target.closest('.groovy-remove-rating');
    if(remove){
      event.preventDefault();
      event.stopPropagation();
      var removeIndex=detailIndex();
      if(removeIndex>=0)removeRating(removeIndex,remove);
      return;
    }

    var add=event.target.closest&&event.target.closest('.groovy-detail-add-collection');
    if(add){
      event.preventDefault();
      event.stopPropagation();
      var addIndex=detailIndex();
      if(addIndex>=0&&typeof window.groovyMoveWishlistToCollection==='function')window.groovyMoveWishlistToCollection(addIndex,add);
      return;
    }

  },false);

  new MutationObserver(function(){
    if(window.libraryView==='wishlist')scheduleWishlistRatings(100);
  }).observe(collection,{childList:true,subtree:true});

  new MutationObserver(function(){
    if(overlay.classList.contains('visible'))setTimeout(onDetailOpen,0);
    else socialToken++;
  }).observe(overlay,{attributes:true,attributeFilter:['class']});

  window.addEventListener('resize',function(){
    placeRating();
    syncMobileStreaming();
    if(overlay.classList.contains('visible'))setTimeout(onDetailOpen,0);
  },{passive:true});

  if(window.libraryView==='wishlist')scheduleWishlistRatings(60);
  if(overlay.classList.contains('visible'))onDetailOpen();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

})();
