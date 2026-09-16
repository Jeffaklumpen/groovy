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
  return n?n.toFixed(1):'—';
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

function ratingScaleHtml(value){
  return '<strong class="groovy-rating-number">'+displayRating(value)+'</strong><span class="groovy-rating-scale">/ 5</span>';
}

function panelHelper(panel,text){
  if(!panel)return;
  var label=panel.querySelector('.rating-panel-label');
  if(!label)return;
  var helper=panel.querySelector('.groovy-rating-helper');
  if(!helper){
    helper=document.createElement('div');
    helper.className='groovy-rating-helper';
    label.insertAdjacentElement('afterend',helper);
  }
  if(helper.textContent!==text)helper.textContent=text;
}

function normalizePanelLabels(){
  if(!ratingRoot)return;
  var yourLabel=ratingRoot.querySelector('.rating-panel-your .rating-panel-label span:last-child');
  var communityLabel=ratingRoot.querySelector('.rating-panel-community .rating-panel-label span:last-child');
  if(yourLabel&&yourLabel.textContent!=='Your Rating')yourLabel.textContent='Your Rating';
  if(communityLabel&&communityLabel.textContent!=='Community Rating')communityLabel.textContent='Community Rating';
}

function ensureSectionHeading(){
  if(!ratingRoot)return;
  var panels=ratingRoot.querySelector('.rating-panels');
  if(!panels)return;
  var heading=ratingRoot.querySelector('.groovy-rating-section-heading');
  if(!heading){
    heading=document.createElement('div');
    heading.className='groovy-rating-section-heading';
    heading.innerHTML=
      '<span class="groovy-rating-section-icon" aria-hidden="true"><i></i><i></i><i></i></span>'+
      '<span class="groovy-rating-section-copy"><strong>Album Ratings</strong><small></small></span>';
    ratingRoot.insertBefore(heading,panels);
  }
  var helper=heading.querySelector('small');
  var viewingOther=window.viewedUserId!==null&&window.viewedUserId!==undefined;
  var text=viewingOther
    ?"See this collector's rating, add your own, and compare with the community."
    :'Rate this album and see the community average.';
  if(helper&&helper.textContent!==text)helper.textContent=text;
}

function ensureYourPanelLayout(record){
  if(!ratingRoot)return;
  var panel=ratingRoot.querySelector('.rating-panel-your');
  if(!panel)return;
  panelHelper(panel,'Your rating for this album');

  var stars=panel.querySelector('.rating-panel-stars');
  if(!stars)return;
  var row=panel.querySelector('.groovy-rating-value-row');
  if(!row){
    row=document.createElement('div');
    row.className='groovy-rating-value-row groovy-your-rating-value';
    stars.parentNode.insertBefore(row,stars);
    row.appendChild(stars);
  }

  var own=record?clamp(record[5]):0;
  var number=row.querySelector('.groovy-rating-number-wrap');
  if(!number){
    number=document.createElement('span');
    number.className='groovy-rating-number-wrap';
    row.appendChild(number);
  }
  var markup=ratingScaleHtml(own);
  if(number.innerHTML!==markup)number.innerHTML=markup;
}

function ensureCommunityPanelLayout(){
  if(!ratingRoot)return;
  var panel=ratingRoot.querySelector('.rating-panel-community');
  if(!panel)return;
  panelHelper(panel,'Average from all users');
  var main=panel.querySelector('.rating-panel-community-main');
  if(!main)return;

  var strong=main.querySelector('strong');
  if(strong)strong.classList.add('groovy-rating-number');
  var scale=main.querySelector('.groovy-rating-scale');
  if(!scale){
    scale=document.createElement('span');
    scale.className='groovy-rating-scale';
    if(strong)strong.insertAdjacentElement('afterend',scale);
    else main.appendChild(scale);
  }
  scale.textContent='/ 5';
}

function ensureBaseLayout(){
  normalizePanelLabels();
  ensureSectionHeading();
  var record=currentRecord();
  ensureYourPanelLayout(record);
  ensureCommunityPanelLayout();
}

function removeViewedPanel(){
  if(!ratingRoot)return;
  var panels=ratingRoot.querySelector('.rating-panels');
  var panel=ratingRoot.querySelector('.rating-panel-viewed-user');
  if(panel)panel.remove();
  if(panels)panels.classList.remove('has-viewed-user');
  ensureSectionHeading();
}

function renderViewedPanel(viewedUserId,albumId,rating){
  if(!ratingRoot)return;
  var panels=ratingRoot.querySelector('.rating-panels');
  if(!panels)return;

  ensureBaseLayout();

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
    '<div class="groovy-rating-helper">This collector\'s rating for the album</div>'+
    '<div class="groovy-rating-value-row groovy-viewed-rating-main">'+starHtml(rating)+'<span class="groovy-rating-number-wrap">'+ratingScaleHtml(rating)+'</span></div>'+
    (!rating?'<div class="rating-panel-footer"><span class="rating-panel-empty-note">Not rated yet</span></div>':'');

  panels.insertBefore(panel,panels.firstChild);
  panels.classList.add('has-viewed-user');
}

async function syncViewedRating(){
  clearTimeout(syncTimer);
  if(!overlay||!ratingRoot||!overlay.classList.contains('visible'))return;

  ensureBaseLayout();

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
    /* A rating belongs to the shared album, never to a collection row. */
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
    '.groovy-rating-section-heading{display:flex;align-items:center;gap:11px;margin:0 0 12px;padding:0 2px}'+
    '.groovy-rating-section-icon{display:inline-flex;align-items:flex-end;gap:3px;width:25px;height:25px;flex:0 0 25px}'+
    '.groovy-rating-section-icon i{display:block;width:5px;border-radius:2px 2px 0 0;background:#ff6500}'+
    '.groovy-rating-section-icon i:nth-child(1){height:12px}.groovy-rating-section-icon i:nth-child(2){height:21px}.groovy-rating-section-icon i:nth-child(3){height:16px}'+
    '.groovy-rating-section-copy{display:flex;flex-direction:column;min-width:0;gap:2px}'+
    '.groovy-rating-section-copy strong{font-size:17px;line-height:1.1;color:#f7f7f8;font-weight:760}'+
    '.groovy-rating-section-copy small{font-size:10px;line-height:1.25;color:rgba(255,255,255,.48)}'+
    '.detail-rating .rating-panels{gap:10px!important}'+
    '.detail-rating .rating-panel{background:linear-gradient(180deg,rgba(22,22,25,.96),rgba(14,14,17,.96))!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:10px!important;box-shadow:0 8px 24px rgba(0,0,0,.14)!important;padding:14px 15px!important;min-width:0}'+
    '.detail-rating .rating-panel-label{display:flex!important;align-items:center!important;gap:7px!important;color:#f5f5f5!important;font-size:12px!important;font-weight:700!important;line-height:1.1!important}'+
    '.detail-rating .rating-panel-icon{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:21px!important;height:21px!important;flex:0 0 21px!important;color:#f4f4f4!important}'+
    '.detail-rating .rating-panel-icon svg{width:100%!important;height:100%!important}'+
    '.groovy-rating-helper{margin:4px 0 0 28px;color:rgba(255,255,255,.42);font-size:9px;line-height:1.2;min-height:11px}'+
    '.groovy-rating-value-row,.rating-panel-community-main{display:flex!important;align-items:center!important;gap:8px!important;margin-top:13px!important;min-height:28px!important;white-space:nowrap!important}'+
    '.rating-panel-your .rating-panel-stars{margin:0!important;min-height:0!important;display:flex!important;align-items:center!important;gap:1px!important;white-space:nowrap!important}'+
    '.rating-panel-your .rating-panel-stars:after{display:none!important;content:none!important}'+
    '.detail-rating .album-rating-star{font-size:23px!important;line-height:1!important;padding:0 1px!important}'+
    '.groovy-rating-number-wrap{display:inline-flex;align-items:baseline;gap:4px;flex:0 0 auto}'+
    '.groovy-rating-number,.rating-panel-community-main strong{font-size:22px!important;line-height:1!important;color:#f7f7f8!important;font-weight:800!important}'+
    '.groovy-rating-scale{font-size:11px;line-height:1;color:rgba(255,255,255,.45);font-weight:600}'+
    '.groovy-viewed-stars{display:inline-flex;align-items:center;gap:1px;white-space:nowrap}'+
    '.groovy-viewed-stars span{font-size:23px;line-height:1;color:rgba(255,255,255,.2)}'+
    '.groovy-viewed-stars span.filled{color:#ff6500}'+
    '.groovy-viewed-user-icon svg{fill:none;stroke:currentColor;stroke-width:1.7}'+
    '.detail-rating .groovy-star-meter.is-community{font-size:22px!important;letter-spacing:.06em!important}'+
    '.detail-rating .rating-panel-footer{display:flex!important;align-items:center!important;min-height:25px!important;margin-top:8px!important}'+
    '.detail-rating .rating-panel-meta,.detail-rating .rating-panel-empty-note{font-size:9px!important;color:rgba(255,255,255,.43)!important}'+
    '.detail-rating .groovy-remove-rating{min-height:23px!important;color:#d77a48!important;font-size:9px!important;font-weight:700!important}'+
    '@media screen and (min-width:761px){'+
      'html body .detail-rating .rating-panels{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}'+
      'html body .detail-rating .rating-panels.has-viewed-user{grid-template-columns:repeat(3,minmax(0,1fr))!important}'+
      'html body .detail-rating .rating-panel-viewed-user{grid-column:auto!important}'+
    '}'+
    '@media screen and (max-width:760px){'+
      'html body .album-detail>.detail-rating{margin-top:13px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-section-heading{margin-bottom:9px!important;padding:0 1px!important;gap:8px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-section-icon{width:21px!important;height:21px!important;flex-basis:21px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-section-icon i{width:4px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-section-icon i:nth-child(1){height:10px}html body .album-detail>.detail-rating .groovy-rating-section-icon i:nth-child(2){height:18px}html body .album-detail>.detail-rating .groovy-rating-section-icon i:nth-child(3){height:14px}'+
      'html body .album-detail>.detail-rating .groovy-rating-section-copy strong{font-size:14px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-section-copy small{font-size:8px!important}'+
      'html body .album-detail>.detail-rating .rating-panels{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:7px!important}'+
      'html body .album-detail>.detail-rating .rating-panel{padding:10px!important;border-radius:9px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-label{font-size:9px!important;gap:5px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-icon{display:inline-flex!important;width:16px!important;height:16px!important;flex-basis:16px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-helper{margin:3px 0 0 21px!important;font-size:7px!important;min-height:9px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-value-row,html body .album-detail>.detail-rating .rating-panel-community-main{gap:5px!important;margin-top:8px!important;min-height:22px!important}'+
      'html body .album-detail>.detail-rating .album-rating-star{font-size:17px!important;padding:0!important}'+
      'html body .album-detail>.detail-rating .groovy-viewed-stars span{font-size:17px!important}'+
      'html body .album-detail>.detail-rating .groovy-star-meter.is-community{font-size:16px!important;letter-spacing:.035em!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-number,html body .album-detail>.detail-rating .rating-panel-community-main strong{font-size:18px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-scale{font-size:8px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-footer{min-height:21px!important;margin-top:5px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-meta,html body .album-detail>.detail-rating .rating-panel-empty-note,html body .album-detail>.detail-rating .groovy-remove-rating{font-size:7px!important}'+
      'html body .album-detail>.detail-rating .rating-panels.has-viewed-user{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user{grid-column:1/-1!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto auto!important;column-gap:10px!important;align-items:center!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .rating-panel-label{grid-column:1!important;grid-row:1!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .groovy-rating-helper{grid-column:1!important;grid-row:2!important;margin-left:21px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .groovy-viewed-rating-main{grid-column:2!important;grid-row:1/3!important;justify-content:flex-end!important;margin:0!important}'+
      'html body .album-detail>.detail-rating .rating-panel-viewed-user .rating-panel-footer{grid-column:1/-1!important;grid-row:3!important;margin-top:5px!important}'+
      'html body .album-overlay .detail-info-card .detail-meta{gap:0!important}'+
      'html body .album-overlay .detail-info-card .detail-meta>span{flex:0 0 auto!important;width:auto!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailYear{flex:none!important;overflow:visible!important;text-overflow:clip!important;max-width:none!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailGenre{flex:0 1 auto!important;width:auto!important;max-width:calc(100% - 42px)!important;margin-left:2px!important;padding-left:4px!important}'+
      'html body .album-overlay .detail-info-card .detail-meta #detailGenre:before{left:0!important}'+
    '}'+
    '@media screen and (max-width:380px){'+
      'html body .album-detail>.detail-rating .rating-panel{padding:8px!important}'+
      'html body .album-detail>.detail-rating .rating-panel-label{font-size:8px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-helper{font-size:6.5px!important;margin-left:19px!important}'+
      'html body .album-detail>.detail-rating .album-rating-star,html body .album-detail>.detail-rating .groovy-viewed-stars span{font-size:15px!important}'+
      'html body .album-detail>.detail-rating .groovy-star-meter.is-community{font-size:14px!important}'+
      'html body .album-detail>.detail-rating .groovy-rating-number,html body .album-detail>.detail-rating .rating-panel-community-main strong{font-size:16px!important}'+
    '}';
  document.head.appendChild(style);
}

function install(){
  if(!overlay||!ratingRoot)return;
  installStyles();
  ensureBaseLayout();

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
    if(event.target.closest&&event.target.closest('.groovy-remove-rating'))scheduleSync(350);
  },false);

  if(overlay.classList.contains('visible'))scheduleSync(30);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

})();