(function(){
'use strict';

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
  var album=(document.getElementById('detailAlbum')||{}).textContent||'';
  var artist=(document.getElementById('detailArtist')||{}).textContent||'';
  album=album.trim();
  artist=artist.trim();

  var current=recordAt(currentDetailIndex);
  if(current&&String(current[2]||'').trim()===album&&(!artist||String(current[1]||'').trim()===artist)){
    return currentDetailIndex;
  }

  if(!album||!Array.isArray(window.records))return -1;
  for(var i=0;i<window.records.length;i++){
    var record=window.records[i];
    if(!record)continue;
    if(String(record[2]||'').trim()!==album)continue;
    if(artist&&String(record[1]||'').trim()!==artist)continue;
    currentDetailIndex=i;
    return i;
  }
  return -1;
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

function ensureRatingFooter(panel,own){
  if(!panel)return;
  var footer=panel.querySelector('.rating-panel-footer');
  if(!footer){
    footer=document.createElement('div');
    footer.className='rating-panel-footer';
    panel.appendChild(footer);
  }

  if(own>0){
    if(!footer.querySelector('.groovy-remove-rating')){
      footer.innerHTML='<button class="groovy-remove-rating" type="button">Remove Rating</button>';
    }
  }else if(!footer.querySelector('.rating-panel-empty-note')){
    footer.innerHTML='<span class="rating-panel-empty-note">Not rated yet</span>';
  }
}

function updateDetailRating(index){
  var record=recordAt(index);
  var root=document.getElementById('detailRating');
  if(!record||!root)return;

  var own=clamp(record[5]);
  var community=clamp(record[15]);
  var count=parseInt(record[16],10)||0;
  var yours=root.querySelector('.rating-panel-your');
  var communityPanel=root.querySelector('.rating-panel-community');

  if(yours){
    yours.querySelectorAll('.album-rating-star').forEach(function(star){
      var value=parseInt(star.getAttribute('data-rating'),10)||0;
      star.classList.toggle('filled',value<=own);
      star.classList.toggle('empty',value>own);
    });
    ensureRatingFooter(yours,own);
  }

  if(communityPanel){
    var meter=communityPanel.querySelector('.groovy-star-meter');
    if(meter)meter.style.setProperty('--rating-fill',fill(community));
    var number=communityPanel.querySelector('.rating-panel-community-main strong');
    if(number)number.textContent=ratingText(community);
    var meta=communityPanel.querySelector('.rating-panel-meta');
    if(meta)meta.textContent=count+' rating'+(count===1?'':'s');
  }
}

function patchCard(card,record){
  if(!card||!record)return;
  var target=card.querySelector('.cover-rating');
  if(!target)return;
  var average=clamp(record[15]);
  var marker=average+'|'+(record[16]||0);
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
    if(!record||String(record[8])!==String(albumId))return;
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

  var albumIds=Array.from(new Set(records.map(function(record){return record&&record[8];}).filter(Boolean)));
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
    var entry=map[String(record[8])]||{own:0,average:0,count:0};
    record[5]=entry.own||0;
    record[15]=entry.average||0;
    record[16]=entry.count||0;
  });

  patchAllWishlistCards();
  var index=detailIndex();
  var overlay=document.getElementById('albumOverlay');
  if(index>=0&&overlay&&overlay.classList.contains('visible'))updateDetailRating(index);

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

  var albumId=record[8];
  var oldOwn=clamp(record[5]);
  var oldAverage=clamp(record[15]);
  var oldCount=parseInt(record[16],10)||0;

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
    if(!item||String(item[8])!==String(albumId))return;
    item[5]=0;
    item[15]=nextAverage;
    item[16]=nextCount;
  });

  updateDetailRating(index);
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
      '<img src="/Apple_Music_Listen_on_Badge_Small.svg" alt="Listen on Apple Music">'+
    '</a>'+ 
    '<a class="groovy-mobile-streaming-link groovy-mobile-spotify" href="'+esc(spotify.href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(spotify.getAttribute('aria-label')||'Listen on Spotify')+'">'+
      '<img src="/Full_Logo_Green_RGB.svg" alt="Spotify">'+
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
    var avatar=esc(profile.avatar_url||'/avatar_placeholder.png');
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

  var masterId=String(record[10]||'').trim();
  var query=supabaseClient.from('collections')
    .select(masterId?'user_id,albums!inner(discogs_master_id)':'user_id')
    .in('user_id',followedIds);
  query=masterId?query.eq('albums.discogs_master_id',masterId):query.eq('album_id',record[8]);

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

async function addWishlistToCollection(index,button){
  var record=recordAt(index);
  var user=await sessionUser();
  if(!record||!user||window.libraryView!=='wishlist'||window.viewedUserId!==null)return;

  button.disabled=true;
  button.textContent='Adding…';

  try{
    var existing=await supabaseClient.from('collections')
      .select('id')
      .eq('user_id',user.id)
      .eq('album_id',record[8])
      .limit(1);
    if(existing.error)throw existing.error;

    if(!existing.data||!existing.data.length){
      var last=await supabaseClient.from('collections')
        .select('sort_order')
        .eq('user_id',user.id)
        .order('sort_order',{ascending:false})
        .limit(1);
      if(last.error)throw last.error;

      var nextOrder=last.data&&last.data.length?(parseInt(last.data[0].sort_order,10)||0)+1:1;
      var inserted=await supabaseClient.from('collections').insert({
        user_id:user.id,
        album_id:record[8],
        cover_url:record[6]||null,
        discogs_style:record[4]||null,
        sort_order:nextOrder
      });
      if(inserted.error)throw inserted.error;
    }

    var removed=await supabaseClient.from('wishlists')
      .delete()
      .eq('id',record[9])
      .eq('user_id',user.id);
    if(removed.error)throw removed.error;

    var close=document.getElementById('albumClose');
    if(close)close.click();
    if(typeof window.loadCollection==='function')await window.loadCollection();
  }catch(error){
    button.disabled=false;
    button.textContent='Add to collection';
    alert('Could not add the album to your collection.\n\n'+(error.message||error));
  }
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
  updateDetailRating(index);

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
      if(addIndex>=0)addWishlistToCollection(addIndex,add);
      return;
    }

  },false);

  window.addEventListener('groovy-rating-updated',function(event){
    if(!overlay.classList.contains('visible'))return;
    var index=detailIndex();
    if(index<0)return;
    var albumId=event&&event.detail&&event.detail.albumId;
    var record=recordAt(index);
    if(albumId&&record&&String(record[8])!==String(albumId))return;
    updateDetailRating(index);
  });

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
