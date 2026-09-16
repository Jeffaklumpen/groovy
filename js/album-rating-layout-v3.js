(function(){
'use strict';

var overlay=document.getElementById('albumOverlay');
var ratingRoot=document.getElementById('detailRating');
var profileCache=new Map();
var viewedToken=0;
var ratingToken=0;
var decorateQueued=false;

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
  }catch(error){
    return null;
  }
}

function fill(value){
  return (clamp(value)/5*100).toFixed(1)+'%';
}

function staticStars(value){
  return '<span class="groovy-rating-v3-stars" style="--rating-fill:'+fill(value)+'" aria-hidden="true">'+
    '<span class="groovy-rating-v3-stars-base">★★★★★</span>'+
    '<span class="groovy-rating-v3-stars-fill">★★★★★</span>'+
  '</span>';
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
  heading.innerHTML='<strong>Album Ratings</strong>';
}

function trashIcon(){
  return '<svg class="groovy-remove-rating-v3-icon" viewBox="0 0 24 24" aria-hidden="true">'+
    '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path>'+
  '</svg>';
}

function ensureOwnFooter(panel,own){
  if(!panel)return;
  var footer=panel.querySelector('.rating-panel-footer');
  if(!footer){
    footer=document.createElement('div');
    footer.className='rating-panel-footer';
    panel.appendChild(footer);
  }

  if(clamp(own)>0){
    var button=footer.querySelector('.groovy-remove-rating');
    if(!button){
      footer.innerHTML='<button class="groovy-remove-rating" type="button">'+trashIcon()+'<span>Remove Rating</span></button>';
    }else if(!button.querySelector('.groovy-remove-rating-v3-icon')){
      button.innerHTML=trashIcon()+'<span>Remove Rating</span>';
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

    var row=panel.querySelector('.groovy-rating-v3-value-row');
    if(!row){
      row=document.createElement('div');
      row.className='groovy-rating-v3-value-row';
      stars.parentNode.insertBefore(row,stars);
      row.appendChild(stars);
    }else if(stars.parentNode!==row){
      row.insertBefore(stars,row.firstChild);
    }

    var number=row.querySelector('.groovy-rating-v3-number');
    if(!number){
      number=document.createElement('strong');
      number.className='groovy-rating-v3-number';
      row.appendChild(number);
    }
    number.textContent=format(own);
  }

  ensureOwnFooter(panel,own);
}

function decorateCommunity(record){
  var panel=ratingRoot&&ratingRoot.querySelector('.rating-panel-community');
  if(!panel)return;

  panel.querySelectorAll('.groovy-rating-helper').forEach(function(node){node.remove();});
  var label=panel.querySelector('.rating-panel-label span:last-child');
  if(label)label.textContent='Community Rating';

  var average=clamp(record&&record[15]);
  var count=parseInt(record&&record[16],10)||0;
  var marker=average+'|'+count;
  var main=panel.querySelector('.rating-panel-community-main');
  if(main&&panel.dataset.groovyCommunityV3!==marker){
    panel.dataset.groovyCommunityV3=marker;
    main.innerHTML=staticStars(average)+'<strong class="groovy-rating-v3-number">'+format(average)+'</strong>';
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
  ensureHeading();
  var record=currentRecord();
  decorateYour(record);
  decorateCommunity(record);
}

async function profileFor(userId){
  var key=String(userId||'');
  if(profileCache.has(key))return profileCache.get(key);

  var result=await supabaseClient
    .from('profiles')
    .select('id,username,avatar_url')
    .eq('id',userId)
    .maybeSingle();

  var profile=result&&!result.error&&result.data
    ?result.data
    :{id:userId,username:'User',avatar_url:''};

  profileCache.set(key,profile);
  return profile;
}

function avatarMarkup(profile){
  var username=profile&&profile.username?profile.username:'User';
  var url=String(profile&&profile.avatar_url||'').trim();

  if(url){
    return '<span class="groovy-rating-v3-avatar has-image" style="background-image:url(&quot;'+esc(url)+'&quot;)" aria-hidden="true"></span>';
  }

  return '<span class="groovy-rating-v3-avatar groovy-initial-avatar" aria-hidden="true"><span class="groovy-initial-avatar-letter">'+esc(firstLetter(username))+'</span></span>';
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

  if(panel.dataset.groovyViewedV3!==marker){
    panel.dataset.groovyViewedV3=marker;
    panel.innerHTML=
      '<div class="groovy-rating-v3-user">'+avatarMarkup(profile)+'<strong>'+esc(username)+"'s Rating"+'</strong></div>'+
      '<div class="groovy-rating-v3-viewed-value">'+staticStars(rating)+'<strong class="groovy-rating-v3-number">'+format(rating)+'</strong></div>';
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
  }catch(error){
    console.warn('Could not load viewed user album rating:',error);
  }
}

async function refreshGlobal(){
  if(!overlay||!overlay.classList.contains('visible'))return;

  var record=currentRecord();
  var user=await currentUser();
  if(!record||!record[8]||!user)return;

  var albumId=record[8];
  var token=++ratingToken;

  try{
    var result=await supabaseClient
      .from('album_ratings')
      .select('user_id,rating')
      .eq('album_id',albumId);

    if(result.error)throw result.error;
    if(token!==ratingToken||!overlay.classList.contains('visible'))return;

    var own=0;
    var total=0;
    var count=0;

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
  }catch(error){
    console.warn('Could not refresh global album ratings:',error);
  }
}

function scheduleRefresh(){
  [180,520,1100].forEach(function(delay){
    setTimeout(refreshGlobal,delay);
  });
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

function installStyles(){
  if(document.getElementById('groovyRatingLayoutV3Styles'))return;

  var style=document.createElement('style');
  style.id='groovyRatingLayoutV3Styles';
  style.textContent=
    'html body .detail-rating .groovy-rating-section-heading{margin:0 0 8px!important;padding:0!important}'+
    'html body .detail-rating .groovy-rating-section-heading strong{font-size:15px!important;line-height:1.05!important;color:#f7f7f8!important;font-weight:800!important}'+
    'html body .detail-rating .rating-panels,html body .detail-rating .rating-panels.has-viewed-user{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:7px!important}'+
    'html body .detail-rating .rating-panel{min-width:0!important;padding:9px 10px!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(20,20,23,.98),rgba(13,13,16,.98))!important;box-shadow:0 5px 16px rgba(0,0,0,.12)!important}'+
    'html body .detail-rating .rating-panel-viewed-user{grid-column:1/-1!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:46px!important;padding:7px 10px!important}'+
    'html body .detail-rating .rating-panel-label{display:flex!important;align-items:center!important;gap:7px!important;color:#f5f5f5!important;font-size:10.5px!important;font-weight:750!important;line-height:1.1!important}'+
    'html body .detail-rating .rating-panel-icon{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:26px!important;height:26px!important;flex:0 0 26px!important;padding:5px!important;border:1px solid rgba(255,255,255,.23)!important;border-radius:50%!important;background:#101012!important;color:rgba(255,255,255,.68)!important}'+
    'html body .detail-rating .rating-panel-icon svg{display:block!important;width:100%!important;height:100%!important}'+
    'html body .detail-rating .groovy-rating-helper{display:none!important}'+
    'html body .detail-rating .groovy-rating-v3-value-row,html body .detail-rating .rating-panel-community-main{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:6px!important;width:100%!important;min-height:22px!important;margin-top:7px!important;white-space:nowrap!important}'+
    'html body .detail-rating .rating-panel-stars{display:flex!important;align-items:center!important;gap:0!important;min-height:0!important;margin:0!important;white-space:nowrap!important}'+
    'html body .detail-rating .rating-panel-stars:after{display:none!important;content:none!important}'+
    'html body .detail-rating .album-rating-star{font-size:18px!important;line-height:1!important;padding:0!important}'+
    'html body .detail-rating .groovy-rating-v3-number{flex:0 0 auto;font-size:17px!important;line-height:1!important;color:#f7f7f8!important;font-weight:800!important}'+
    'html body .detail-rating .groovy-rating-v3-stars{position:relative;display:inline-block;line-height:1;white-space:nowrap;font-size:18px;letter-spacing:.025em}'+
    'html body .detail-rating .groovy-rating-v3-stars-base{color:rgba(255,255,255,.18)}'+
    'html body .detail-rating .groovy-rating-v3-stars-fill{position:absolute;left:0;top:0;width:var(--rating-fill);overflow:hidden;color:#ff6500;white-space:nowrap}'+
    'html body .detail-rating .rating-panel-footer{display:flex!important;align-items:center!important;min-height:14px!important;margin-top:6px!important}'+
    'html body .detail-rating .rating-panel-meta{font-size:8.5px!important;color:rgba(255,255,255,.52)!important}'+
    'html body .detail-rating .groovy-remove-rating{display:inline-flex!important;align-items:center!important;gap:5px!important;min-height:15px!important;padding:0!important;border:0!important;background:transparent!important;color:rgba(255,255,255,.58)!important;font:inherit!important;font-size:8.5px!important;font-weight:600!important;cursor:pointer!important}'+
    'html body .detail-rating .groovy-remove-rating:hover{color:#ff720f!important}'+
    'html body .detail-rating .groovy-remove-rating-v3-icon{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}'+
    'html body .detail-rating .groovy-rating-v3-user{display:flex;align-items:center;gap:8px;min-width:0}'+
    'html body .detail-rating .groovy-rating-v3-user strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f5f5f5;font-size:10.5px;line-height:1.1;font-weight:750}'+
    'html body .detail-rating .groovy-rating-v3-viewed-value{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;white-space:nowrap}'+
    'html body .detail-rating .groovy-rating-v3-avatar{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;border:1px solid #d65a16;border-radius:50%;background-position:center;background-size:cover;background-repeat:no-repeat;overflow:hidden}'+
    'html body .groovy-initial-avatar{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;background-image:none!important;background:#15110f!important;border:1px solid #c95716!important;color:#f5f5f5!important;font-weight:700!important;overflow:hidden!important}'+
    'html body .groovy-initial-avatar-letter{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:13px;line-height:1;text-transform:uppercase;pointer-events:none}'+
    '@media screen and (min-width:761px){'+
      'html body .detail-info-card>.detail-rating{width:auto!important;margin-top:10px!important}'+
      'html body .detail-info-card>.detail-rating .rating-panel{min-height:76px!important}'+
      'html body .detail-info-card>.detail-rating .rating-panel-viewed-user{min-height:44px!important}'+
    '}'+
    '@media screen and (max-width:760px){'+
      'html body .album-detail>.detail-rating{grid-column:1/-1!important;grid-row:2!important;width:100%!important;margin:12px 0 0!important}'+
      'html body .detail-rating .groovy-rating-section-heading{margin-bottom:8px!important}'+
      'html body .detail-rating .groovy-rating-section-heading strong{font-size:14px!important}'+
      'html body .detail-rating .rating-panels,html body .detail-rating .rating-panels.has-viewed-user{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:7px!important}'+
      'html body .detail-rating .rating-panel{padding:9px!important;border-radius:9px!important;min-height:84px!important}'+
      'html body .detail-rating .rating-panel-viewed-user{grid-column:1/-1!important;min-height:45px!important;padding:8px 9px!important}'+
      'html body .detail-rating .rating-panel-label{font-size:9px!important;gap:5px!important}'+
      'html body .detail-rating .rating-panel-icon{width:24px!important;height:24px!important;flex-basis:24px!important;padding:4px!important}'+
      'html body .detail-rating .album-rating-star{font-size:17px!important}'+
      'html body .detail-rating .groovy-rating-v3-stars{font-size:17px!important}'+
      'html body .detail-rating .groovy-rating-v3-number{font-size:17px!important}'+
      'html body .detail-rating .groovy-rating-v3-user{gap:7px!important}'+
      'html body .detail-rating .groovy-rating-v3-user strong{font-size:9px!important}'+
      'html body .detail-rating .groovy-rating-v3-avatar{width:26px!important;height:26px!important;flex-basis:26px!important}'+
      'html body .detail-rating .groovy-rating-v3-viewed-value{gap:6px!important}'+
      'html body .detail-rating .rating-panel-meta,html body .detail-rating .groovy-remove-rating{font-size:7px!important}'+
    '}'+
    '@media screen and (max-width:380px){'+
      'html body .detail-rating .rating-panel{padding:8px!important}'+
      'html body .detail-rating .album-rating-star,html body .detail-rating .groovy-rating-v3-stars{font-size:15px!important}'+
      'html body .detail-rating .groovy-rating-v3-number{font-size:15px!important}'+
    '}';

  document.head.appendChild(style);
}

function queueDecorate(){
  if(decorateQueued)return;
  decorateQueued=true;
  setTimeout(function(){
    decorateQueued=false;
    decorateBase();
    scanAvatars(document);
  },0);
}

function install(){
  if(!overlay||!ratingRoot)return;

  installStyles();
  decorateBase();
  scanAvatars(document);

  [100,500,1200].forEach(function(delay){
    setTimeout(function(){scanAvatars(document);},delay);
  });

  new MutationObserver(function(){
    queueDecorate();
  }).observe(ratingRoot,{childList:true,subtree:true});

  new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      mutation.addedNodes.forEach(function(node){
        if(node&&node.nodeType===1)scanAvatars(node);
      });
    });
  }).observe(document.body,{childList:true,subtree:true});

  new MutationObserver(function(){
    if(overlay.classList.contains('visible')){
      setTimeout(function(){decorateBase();syncViewed();refreshGlobal();},45);
    }else{
      viewedToken++;
      ratingToken++;
    }
  }).observe(overlay,{attributes:true,attributeFilter:['class']});

  document.addEventListener('click',function(event){
    if(event.target.closest&&event.target.closest('.album-rating-star,.groovy-remove-rating')){
      scheduleRefresh();
    }
  },false);

  window.addEventListener('resize',function(){
    setTimeout(decorateBase,60);
  },{passive:true});

  window.addEventListener('popstate',function(){
    setTimeout(function(){decorateBase();syncViewed();},80);
  });

  if(overlay.classList.contains('visible')){
    setTimeout(function(){decorateBase();syncViewed();refreshGlobal();},40);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

})();