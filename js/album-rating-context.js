(function(){
'use strict';

var overlay=document.getElementById('albumOverlay');
var ratingRoot=document.getElementById('detailRating');
var syncTimer=null;
var requestToken=0;

function clamp(value){
  var n=Number(value);
  return isFinite(n)?Math.max(0,Math.min(5,n)):0;
}

function displayRating(value){
  var n=Math.round(clamp(value)*10)/10;
  return n?(Number.isInteger(n)?n.toFixed(0):n.toFixed(1)):'—';
}

function currentRecord(){
  var album=(document.getElementById('detailAlbum')||{}).textContent||'';
  var artist=(document.getElementById('detailArtist')||{}).textContent||'';
  album=String(album).trim();
  artist=String(artist).trim();
  if(!album||!Array.isArray(window.records))return null;

  for(var i=0;i<window.records.length;i++){
    var record=window.records[i];
    if(!record)continue;
    if(String(record[2]||'').trim()!==album)continue;
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

function starHtml(value){
  var rounded=Math.round(clamp(value));
  var html='<span class="groovy-viewed-stars" aria-hidden="true">';
  for(var i=1;i<=5;i++)html+='<span class="'+(i<=rounded?'filled':'')+'">★</span>';
  return html+'</span>';
}

function normalizePanelLabels(){
  if(!ratingRoot)return;
  var yourLabel=ratingRoot.querySelector('.rating-panel-your .rating-panel-label span:last-child');
  var communityLabel=ratingRoot.querySelector('.rating-panel-community .rating-panel-label span:last-child');
  if(yourLabel&&yourLabel.textContent!=='Your Rating')yourLabel.textContent='Your Rating';
  if(communityLabel&&communityLabel.textContent!=='Community Rating')communityLabel.textContent='Community Rating';
}

function removeViewedPanel(){
  if(!ratingRoot)return;
  var panels=ratingRoot.querySelector('.rating-panels');
  var panel=ratingRoot.querySelector('.rating-panel-viewed-user');
  if(panel)panel.remove();
  if(panels)panels.classList.remove('has-viewed-user');
}

function renderViewedPanel(viewedUserId,albumId,rating){
  if(!ratingRoot)return;
  var panels=ratingRoot.querySelector('.rating-panels');
  if(!panels)return;

  normalizePanelLabels();

  var marker=String(viewedUserId)+'|'+String(albumId)+'|'+String(rating||0);
  var existing=panels.querySelector('.rating-panel-viewed-user');
  if(existing&&existing.dataset.ratingMarker===marker){
    panels.classList.add('has-viewed-user');
    return;
  }
  if(existing)existing.remove();

  var panel=document.createElement('section');
  panel.className='rating-panel rating-panel-viewed-user';
  panel.dataset.ratingMarker=marker;
  panel.innerHTML=
    '<div class="rating-panel-label"><span class="rating-panel-icon groovy-viewed-user-icon" aria-hidden="true">'+
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3.2"></circle><path d="M5.8 19.3c.4-4 2.8-6.2 6.2-6.2s5.8 2.2 6.2 6.2"></path></svg>'+
    '</span><span>User\'s Rating</span></div>'+
    '<div class="groovy-viewed-rating-main">'+starHtml(rating)+'<strong>'+displayRating(rating)+'</strong></div>'+
    '<div class="rating-panel-footer"><span class="rating-panel-meta">'+(rating?'Rated by this user':'Not rated yet')+'</span></div>';

  panels.insertBefore(panel,panels.firstChild);
  panels.classList.add('has-viewed-user');
}

async function syncViewedRating(){
  clearTimeout(syncTimer);
  if(!overlay||!ratingRoot||!overlay.classList.contains('visible'))return;

  normalizePanelLabels();

  var viewedUserId=window.viewedUserId;
  var user=await currentUser();
  if(!viewedUserId||!user||String(viewedUserId)===String(user.id)){
    removeViewedPanel();
    return;
  }

  var record=currentRecord();
  if(!record||!record[8])return;
  var albumId=record[8];
  var token=++requestToken;

  try{
    var result=await supabaseClient.from('album_ratings')
      .select('rating')
      .eq('album_id',albumId)
      .eq('user_id',viewedUserId)
      .maybeSingle();

    if(token!==requestToken||!overlay.classList.contains('visible'))return;
    if(String(window.viewedUserId||'')!==String(viewedUserId))return;
    if(result.error){
      console.warn('Could not load viewed user album rating:',result.error);
      renderViewedPanel(viewedUserId,albumId,0);
      return;
    }
    renderViewedPanel(viewedUserId,albumId,result.data?clamp(result.data.rating):0);
  }catch(error){
    if(token!==requestToken)return;
    console.warn('Could not load viewed user album rating:',error);
  }
}

function scheduleSync(delay){
  clearTimeout(syncTimer);
  syncTimer=setTimeout(syncViewedRating,delay==null?40:delay);
}

function installStyles(){
  if(document.getElementById('groovyAlbumRatingContextStyles'))return;
  var style=document.createElement('style');
  style.id='groovyAlbumRatingContextStyles';
  style.textContent=
    '.groovy-viewed-rating-main{display:flex;align-items:center;gap:8px;margin-top:8px;min-height:26px}'+
    '.groovy-viewed-rating-main strong{font-size:22px;line-height:1;color:#f5f5f5}'+
    '.groovy-viewed-stars{display:inline-flex;align-items:center;gap:1px;white-space:nowrap}'+
    '.groovy-viewed-stars span{font-size:21px;line-height:1;color:rgba(255,255,255,.2)}'+
    '.groovy-viewed-stars span.filled{color:#ff6600}'+
    '.groovy-viewed-user-icon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.7}'+
    '@media screen and (min-width:761px){'+
      'html body .detail-rating .rating-panels.has-viewed-user{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}'+
      'html body .detail-rating .rating-panel-viewed-user{grid-column:auto!important}'+
    '}'+
    '@media screen and (max-width:760px){'+
      'html body .album-detail>.detail-rating .rating-panels.has-viewed-user{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:8px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user{grid-column:1/-1!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto!important;align-items:center!important;column-gap:10px!important;padding:9px 11px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .rating-panel-label{grid-column:1!important;grid-row:1/3!important;margin:0!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .groovy-viewed-rating-main{grid-column:2!important;grid-row:1!important;justify-content:flex-end!important;margin:0!important;min-height:20px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .rating-panel-footer{grid-column:2!important;grid-row:2!important;justify-content:flex-end!important;min-height:14px!important;margin:2px 0 0!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .groovy-viewed-stars span{font-size:16px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .groovy-viewed-rating-main strong{font-size:18px!important}'+

      'html body .album-overlay .detail-info-card .detail-meta>span{flex:0 0 auto!important;width:auto!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailYear{flex:none!important;overflow:visible!important;text-overflow:clip!important;max-width:none!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailGenre{flex:0 1 auto!important;width:auto!important;max-width:calc(100% - 42px)!important;margin-left:3px!important;padding-left:4px!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailGenre:before{left:0!important}'+
    '}';
  document.head.appendChild(style);
}

function install(){
  if(!overlay||!ratingRoot)return;
  installStyles();

  new MutationObserver(function(){
    if(overlay.classList.contains('visible'))scheduleSync(25);
  }).observe(ratingRoot,{childList:true,subtree:true});

  new MutationObserver(function(){
    if(overlay.classList.contains('visible'))scheduleSync(20);
    else{requestToken++;removeViewedPanel();}
  }).observe(overlay,{attributes:true,attributeFilter:['class']});

  window.addEventListener('popstate',function(){scheduleSync(80);});
  window.addEventListener('resize',function(){scheduleSync(60);},{passive:true});
  document.addEventListener('click',function(event){
    if(event.target.closest&&event.target.closest('.album-rating-star'))scheduleSync(350);
  },false);

  if(overlay.classList.contains('visible'))scheduleSync(30);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

})();
