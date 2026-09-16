(function(){
'use strict';

var currentDetailIndex=-1;
var libraryRatingTimer=null;
var socialRequestToken=0;
var ratingMoveHome=null;
var lastRatingTouchAt=0;

function clampRating(value){
  var number=Number(value);
  if(!isFinite(number))number=0;
  return Math.max(0,Math.min(5,number));
}

function formatRating(value){
  var rating=clampRating(value);
  if(!rating)return '—';
  var rounded=Math.round(rating*10)/10;
  return Number.isInteger(rounded)?String(rounded.toFixed(0)):String(rounded.toFixed(1));
}

function ratingFill(value){
  return (clampRating(value)/5*100).toFixed(1)+'%';
}

function starMeter(value,extraClass){
  return '<span class="groovy-star-meter'+(extraClass?' '+extraClass:'')+'" style="--rating-fill:'+ratingFill(value)+';" aria-label="'+clampRating(value).toFixed(1)+' out of 5">'+
    '<span class="groovy-star-meter-base" aria-hidden="true">★★★★★</span>'+ 
    '<span class="groovy-star-meter-fill" aria-hidden="true">★★★★★</span>'+ 
  '</span>';
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

function resolveDetailIndex(){
  var album=document.getElementById('detailAlbum');
  var artist=document.getElementById('detailArtist');
  var albumText=album?album.textContent.trim():'';
  var artistText=artist?artist.textContent.trim():'';

  var current=recordAt(currentDetailIndex);
  if(current&&String(current[2]||'').trim()===albumText&&(!artistText||String(current[1]||'').trim()===artistText)){
    return currentDetailIndex;
  }

  if(!albumText||!Array.isArray(window.records))return -1;
  for(var i=0;i<window.records.length;i++){
    var record=window.records[i];
    if(!record)continue;
    if(String(record[2]||'').trim()!==albumText)continue;
    if(artistText&&String(record[1]||'').trim()!==artistText)continue;
    currentDetailIndex=i;
    return i;
  }
  return -1;
}

function calculateRatingMeta(rows,userId){
  var map={};
  (rows||[]).forEach(function(row){
    var albumId=String(row.album_id);
    var entry=map[albumId]||(map[albumId]={own:0,total:0,count:0,average:0});
    var rating=clampRating(row.rating);
    if(!rating)return;
    if(String(row.user_id)===String(userId)){
      entry.own=rating;
      return;
    }
    entry.total+=rating;
    entry.count++;
  });
  Object.keys(map).forEach(function(albumId){
    var entry=map[albumId];
    entry.average=entry.count?Math.round((entry.total/entry.count)*10)/10:0;
  });
  return map;
}

function updateRecordRatingMeta(albumId,entry){
  if(!Array.isArray(window.records))return;
  window.records.forEach(function(record){
    if(!record||String(record[8])!==String(albumId))return;
    record[5]=entry.own||0;
    record[15]=entry.average||0;
    record[16]=entry.count||0;
  });
}

function updateOwnRatingOnly(albumId,rating){
  if(!Array.isArray(window.records))return;
  window.records.forEach(function(record){
    if(record&&String(record[8])===String(albumId))record[5]=rating||0;
  });
}

function patchCardRating(card,record){
  if(!card||!record)return;
  var rating=card.querySelector('.cover-rating');
  if(!rating)return;
  var average=clampRating(record[15]);
  var marker=String(average)+'|'+String(record[16]||0);
  if(rating.dataset.communityMarker===marker&&rating.querySelector('.cover-rating-inner'))return;
  rating.dataset.communityMarker=marker;
  rating.innerHTML='<span class="cover-rating-inner">'+starMeter(average,'is-compact')+'<span class="cover-rating-number">'+formatRating(average)+'</span></span>';
}

function patchVisibleCardRatings(){
  var collection=document.getElementById('collection');
  if(!collection||!Array.isArray(window.records))return;
  collection.querySelectorAll('.record[data-index]').forEach(function(card){
    var index=parseInt(card.getAttribute('data-index'),10);
    if(!isNaN(index))patchCardRating(card,window.records[index]);
  });
}

function ensureRatingFooter(panel,ownRating){
  if(!panel)return;
  var footer=panel.querySelector('.rating-panel-footer');
  if(!footer){
    footer=document.createElement('div');
    footer.className='rating-panel-footer';
    panel.appendChild(footer);
  }

  var hasRemove=!!footer.querySelector('.groovy-remove-rating');
  var hasEmpty=!!footer.querySelector('.rating-panel-empty-note');
  if(ownRating>0){
    if(!hasRemove)footer.innerHTML='<button class="groovy-remove-rating" type="button">Remove Rating</button>';
  }else if(!hasEmpty){
    footer.innerHTML='<span class="rating-panel-empty-note">Not rated yet</span>';
  }
}

function updateDetailRatingDom(index){
  var record=recordAt(index);
  var detailRating=document.getElementById('detailRating');
  if(!record||!detailRating)return;

  var own=clampRating(record[5]);
  var community=clampRating(record[15]);
  var count=parseInt(record[16],10)||0;
  var yourPanel=detailRating.querySelector('.rating-panel-your');
  var communityPanel=detailRating.querySelector('.rating-panel-community');

  if(yourPanel){
    yourPanel.querySelectorAll('.album-rating-star').forEach(function(button){
      var value=parseInt(button.getAttribute('data-rating'),10)||0;
      button.classList.toggle('filled',value<=own);
      button.classList.toggle('empty',value>own);
    });
    ensureRatingFooter(yourPanel,own);
  }

  if(communityPanel){
    var meter=communityPanel.querySelector('.groovy-star-meter');
    if(meter)meter.style.setProperty('--rating-fill',ratingFill(community));
    var value=communityPanel.querySelector('.rating-panel-community-main strong');
    if(value&&value.textContent!==formatRating(community))value.textContent=formatRating(community);
    var meta=communityPanel.querySelector('.rating-panel-meta');
    var metaText=String(count)+' rating'+(count===1?'':'s');
    if(meta&&meta.textContent!==metaText)meta.textContent=metaText;
  }
}

async function refreshLibraryRatingMeta(){
  var records=Array.isArray(window.records)?window.records:[];
  if(!records.length)return;
  var user=await sessionUser();
  if(!user)return;
  var albumIds=Array.from(new Set(records.map(function(record){return record&&record[8];}).filter(Boolean)));
  if(!albumIds.length)return;

  var result=await supabaseClient.from('album_ratings')
    .select('album_id,user_id,rating')
    .in('album_id',albumIds);
  if(result.error){console.warn('Could not refresh community ratings:',result.error);return;}

  var map=calculateRatingMeta(result.data||[],user.id);
  records.forEach(function(record){
    if(!record)return;
    var entry=map[String(record[8])]||{own:0,average:0,count:0};
    record[5]=entry.own||0;
    record[15]=entry.average||0;
    record[16]=entry.count||0;
  });
  patchVisibleCardRatings();

  var index=resolveDetailIndex();
  var overlay=document.getElementById('albumOverlay');
  if(index>=0&&overlay&&overlay.classList.contains('visible'))updateDetailRatingDom(index);
}

function scheduleLibraryRatingRefresh(delay){
  clearTimeout(libraryRatingTimer);
  libraryRatingTimer=setTimeout(function(){refreshLibraryRatingMeta();},delay==null?80:delay);
}

async function refreshCurrentAlbumRatings(index){
  var record=recordAt(index);
  if(!record||!record[8])return;
  var user=await sessionUser();
  if(!user)return;

  var result=await supabaseClient.from('album_ratings')
    .select('album_id,user_id,rating')
    .eq('album_id',record[8]);
  if(result.error){console.warn('Could not refresh album rating:',result.error);return;}

  var map=calculateRatingMeta(result.data||[],user.id);
  var entry=map[String(record[8])]||{own:0,average:0,count:0};
  updateRecordRatingMeta(record[8],entry);
  updateDetailRatingDom(index);
  patchVisibleCardRatings();
}

async function saveCurrentRating(index,rating){
  var record=recordAt(index);
  if(!record||!record[8])return;
  var user=await sessionUser();
  if(!user){alert('Du måste vara inloggad.');return;}

  var albumId=record[8];
  updateOwnRatingOnly(albumId,rating);
  updateDetailRatingDom(index);

  var result=await supabaseClient.from('album_ratings')
    .upsert({user_id:user.id,album_id:albumId,rating:rating},{onConflict:'user_id,album_id'});

  if(result.error){
    console.error('Could not save album rating:',result.error);
    alert('Kunde inte spara ratingen.\n\n'+(result.error.message||result.error));
  }

  await refreshCurrentAlbumRatings(index);
  scheduleLibraryRatingRefresh(80);
}

async function removeCurrentRating(index,button){
  var record=recordAt(index);
  if(!record||!record[8])return;
  var user=await sessionUser();
  if(!user)return;

  button.disabled=true;
  button.textContent='Removing…';
  var result=await supabaseClient.from('album_ratings')
    .delete()
    .eq('user_id',user.id)
    .eq('album_id',record[8]);

  if(result.error){
    console.error('Could not remove rating:',result.error);
    button.disabled=false;
    button.textContent='Remove Rating';
    alert('Could not remove the rating.\n\n'+(result.error.message||result.error));
    return;
  }

  await refreshCurrentAlbumRatings(index);
  scheduleLibraryRatingRefresh(80);
}

function placeRatingSection(){
  var detailRating=document.getElementById('detailRating');
  var infoCard=document.querySelector('.detail-info-card');
  var main=document.querySelector('.album-detail-main');
  if(!detailRating||!infoCard||!main)return;
  if(!ratingMoveHome)ratingMoveHome=infoCard;
  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;

  if(mobile){
    if(detailRating.parentNode!==main.parentNode)main.parentNode.insertBefore(detailRating,main.nextSibling);
  }else if(detailRating.parentNode!==ratingMoveHome){
    ratingMoveHome.appendChild(detailRating);
  }
}

function syncMobileStreamingPlacement(){
  var infoCard=document.querySelector('.detail-info-card');
  var apple=document.getElementById('detailAppleMusicLink');
  var spotify=document.getElementById('detailSpotifyLink');
  if(!infoCard||!apple||!spotify)return;

  var mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
  var existing=infoCard.querySelector('.groovy-mobile-streaming');
  if(!mobile){
    if(existing)existing.remove();
    return;
  }

  if(!existing){
    existing=document.createElement('div');
    existing.className='groovy-mobile-streaming';
    infoCard.appendChild(existing);
  }

  existing.innerHTML=
    '<a class="groovy-mobile-streaming-link groovy-mobile-apple" href="'+escapeHtml(apple.href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+escapeHtml(apple.getAttribute('aria-label')||'Listen on Apple Music')+'">'+
      '<img src="/Apple_Music_Listen_on_Badge_Small.svg" alt="Listen on Apple Music">'+
    '</a>'+ 
    '<a class="groovy-mobile-streaming-link groovy-mobile-spotify" href="'+escapeHtml(spotify.href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+escapeHtml(spotify.getAttribute('aria-label')||'Listen on Spotify')+'">'+
      '<img src="/Full_Logo_Green_RGB.svg" alt="Spotify">'+
    '</a>';
}

function cleanupLoggedOutPublicUi(){
  window.viewedUserId=null;
  window.groovyViewedStatisticsProfile=null;

  var header=document.getElementById('viewedUserHeader');
  if(header){
    header.style.display='none';
    header.dataset.own='false';
  }

  var shelfStrip=document.getElementById('shelfStrip');
  if(shelfStrip)shelfStrip.hidden=true;

  var search=document.getElementById('librarySearchInput');
  if(search)search.value='';

  var social=document.getElementById('detailSocialContext');
  if(social){
    social.hidden=true;
    social.innerHTML='';
  }
}

function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}

function renderCollectedProfiles(profiles){
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
  var compact=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
  var slotLimit=compact?4:10;
  var hasMore=profiles.length>slotLimit;
  var visibleLimit=hasMore?slotLimit-1:slotLimit;
  var visible=profiles.slice(0,visibleLimit);
  var extra=profiles.slice(visibleLimit);

  function person(profile,extraClass){
    var username=escapeHtml(profile.username||'Collector');
    var avatar=escapeHtml(profile.avatar_url||'/avatar_placeholder.png');
    return '<button class="detail-social-person'+(extraClass?' '+extraClass:'')+'" type="button" data-detail-social-username="'+username+'" data-tooltip="'+username+'" aria-label="View '+username+'">'+
      '<span class="detail-social-avatar" style="background-image:url(&quot;'+avatar+'&quot;)"></span>'+ 
      '<span class="detail-social-person-name">'+username+'</span>'+ 
    '</button>';
  }

  social.innerHTML='<div class="detail-social-heading"><strong>Collected by</strong><small>Collectors you follow</small></div>'+ 
    '<div class="detail-social-people">'+visible.map(function(profile){return person(profile,'');}).join('')+
    (hasMore?'<button class="detail-social-more" type="button" data-detail-social-more aria-expanded="false" aria-label="Show more collectors">…</button>':'')+'</div>'+ 
    (hasMore?'<div class="detail-social-menu" data-detail-social-menu hidden><div class="detail-social-menu-title">More collectors</div><div class="detail-social-menu-list">'+extra.map(function(profile){return person(profile,'detail-social-menu-person');}).join('')+'</div></div>':'');
}

async function refreshWishlistCollectedBy(index){
  var record=recordAt(index);
  var token=++socialRequestToken;
  if(!record||window.libraryView!=='wishlist'||window.viewedUserId!==null)return;
  var user=await sessionUser();
  if(!user||token!==socialRequestToken)return;

  var followResult=await supabaseClient.from('user_follows')
    .select('followed_id')
    .eq('follower_id',user.id);
  if(followResult.error){console.warn('Could not load followed collectors:',followResult.error);return;}
  var followedIds=(followResult.data||[]).map(function(row){return row.followed_id;}).filter(Boolean);
  if(!followedIds.length){if(token===socialRequestToken)renderCollectedProfiles([]);return;}

  var masterId=String(record[10]||'').trim();
  var query=supabaseClient.from('collections')
    .select(masterId?'user_id,albums!inner(discogs_master_id)':'user_id')
    .in('user_id',followedIds);
  query=masterId?query.eq('albums.discogs_master_id',masterId):query.eq('album_id',record[8]);
  var collectionResult=await query;
  if(collectionResult.error){console.warn('Could not load wishlist collection matches:',collectionResult.error);return;}
  if(token!==socialRequestToken)return;

  var matchingIds=Array.from(new Set((collectionResult.data||[]).map(function(row){return row.user_id;}).filter(Boolean)));
  if(!matchingIds.length){renderCollectedProfiles([]);return;}

  var profileResult=await supabaseClient.from('profiles')
    .select('id,username,avatar_url')
    .in('id',matchingIds);
  if(profileResult.error){console.warn('Could not load matching collector profiles:',profileResult.error);return;}
  if(token!==socialRequestToken)return;

  var order=new Map(matchingIds.map(function(id,pos){return [String(id),pos];}));
  var profiles=(profileResult.data||[]).slice().sort(function(a,b){
    return (order.get(String(a.id))||0)-(order.get(String(b.id))||0);
  });
  renderCollectedProfiles(profiles);
}

async function addWishlistRecordToCollection(index,button){
  var record=recordAt(index);
  if(!record||window.libraryView!=='wishlist'||window.viewedUserId!==null)return;
  var user=await sessionUser();
  if(!user)return;

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

    button.textContent='Added';
    var close=document.getElementById('albumClose');
    if(close)close.click();
    if(typeof window.loadCollection==='function')await window.loadCollection();
  }catch(error){
    console.error('Could not add wishlist album to collection:',error);
    button.disabled=false;
    button.textContent='Add to collection';
    alert('Could not add the album to your collection.\n\n'+(error.message||error));
  }
}

function ensureWishlistDetailAction(){
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

function onDetailOpened(){
  placeRatingSection();
  syncMobileStreamingPlacement();
  var index=resolveDetailIndex();
  if(index<0)return;
  currentDetailIndex=index;
  ensureWishlistDetailAction();
  updateDetailRatingDom(index);
  refreshCurrentAlbumRatings(index);
  if(window.libraryView==='wishlist'&&window.viewedUserId===null){
    setTimeout(function(){refreshWishlistCollectedBy(index);},80);
  }
}

function interceptRatingStar(event,isTouch){
  var star=event.target.closest&&event.target.closest('.album-rating-star');
  if(!star)return false;

  event.preventDefault();
  event.stopPropagation();
  if(event.stopImmediatePropagation)event.stopImmediatePropagation();

  if(isTouch)lastRatingTouchAt=Date.now();
  else if(Date.now()-lastRatingTouchAt<700)return true;

  var index=resolveDetailIndex();
  var rating=parseInt(star.getAttribute('data-rating'),10);
  if(index>=0&&rating>=1&&rating<=5)saveCurrentRating(index,rating);
  return true;
}

function install(){
  var collection=document.getElementById('collection');
  var overlay=document.getElementById('albumOverlay');
  if(!collection||!overlay)return;
  ratingMoveHome=document.querySelector('.detail-info-card');
  placeRatingSection();

  document.addEventListener('touchend',function(event){
    interceptRatingStar(event,true);
  },true);

  document.addEventListener('click',function(event){
    if(interceptRatingStar(event,false))return;

    var card=event.target.closest&&event.target.closest('#collection .record[data-index]');
    if(card){
      var index=parseInt(card.getAttribute('data-index'),10);
      if(!isNaN(index))currentDetailIndex=index;
    }

    var remove=event.target.closest&&event.target.closest('.groovy-remove-rating');
    if(remove){
      event.preventDefault();
      event.stopPropagation();
      var removeIndex=resolveDetailIndex();
      if(removeIndex>=0)removeCurrentRating(removeIndex,remove);
      return;
    }

    var add=event.target.closest&&event.target.closest('.groovy-detail-add-collection');
    if(add){
      event.preventDefault();
      event.stopPropagation();
      var addIndex=resolveDetailIndex();
      if(addIndex>=0)addWishlistRecordToCollection(addIndex,add);
      return;
    }
  },true);

  new MutationObserver(function(){scheduleLibraryRatingRefresh(80);})
    .observe(collection,{childList:true,subtree:true});

  new MutationObserver(function(){
    if(overlay.classList.contains('visible'))setTimeout(onDetailOpened,0);
    else socialRequestToken++;
  }).observe(overlay,{attributes:true,attributeFilter:['class']});

  window.addEventListener('resize',function(){
    placeRatingSection();
    syncMobileStreamingPlacement();
    if(overlay.classList.contains('visible'))setTimeout(onDetailOpened,0);
  },{passive:true});

  supabaseClient.auth.onAuthStateChange(function(event,session){
    if(!session){
      cleanupLoggedOutPublicUi();
      setTimeout(cleanupLoggedOutPublicUi,120);
    }
  });

  scheduleLibraryRatingRefresh(40);
  if(overlay.classList.contains('visible'))onDetailOpened();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

})();