(function(){
'use strict';

var Record=window.GroovyRecord;
if(!Record)return;

var overlay=document.getElementById('albumOverlay');
var ratingRoot=document.getElementById('detailRating');
var profileCache=new Map();
var viewedToken=0;
var queued=false;

function clamp(value){
  var n=Number(value);
  return isFinite(n)?Math.max(0,Math.min(5,n)):0;
}

function scoreText(value){
  var n=Math.round(clamp(value)*10)/10;
  if(!n)return '—';
  return Math.round(n)===n?String(n):n.toFixed(1);
}

function scoreMarkup(value){
  return '<span class="groovy-score-main">'+scoreText(value)+'</span><span class="groovy-score-max">/5</span>';
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
    if(!record||String(Record.title(record)||'').trim()!==album)continue;
    if(artist&&String(Record.artist(record)||'').trim()!==artist)continue;
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

function fill(value){
  return (clamp(value)/5*100).toFixed(1)+'%';
}

function staticStars(value){
  return '<span class="groovy-rating-stars" style="--rating-fill:'+fill(value)+'" aria-hidden="true">'+
    '<span class="groovy-rating-stars-base">★★★★★</span>'+
    '<span class="groovy-rating-stars-fill">★★★★★</span>'+
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
  if(heading.textContent!=='Album Ratings')heading.innerHTML='<strong>Album Ratings</strong>';
}

function trashIcon(){
  return '<svg class="groovy-remove-rating-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path></svg>';
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
    }else if(!button.querySelector('.groovy-remove-rating-icon')){
      button.innerHTML=trashIcon()+'<span>Remove Rating</span>';
    }
  }else if(footer.firstChild){
    footer.innerHTML='';
  }
}

function ensureScore(row,value){
  if(!row)return;
  var score=row.querySelector('.groovy-rating-score');
  if(!score){
    score=document.createElement('strong');
    score.className='groovy-rating-score';
    row.appendChild(score);
  }
  var marker=scoreText(value);
  if(score.dataset.score!==marker){
    score.dataset.score=marker;
    score.innerHTML=scoreMarkup(value);
  }
}

function decorateYour(record){
  var panel=ratingRoot&&ratingRoot.querySelector('.rating-panel-your');
  if(!panel)return;

  panel.querySelectorAll('.groovy-rating-helper').forEach(function(node){node.remove();});
  var label=panel.querySelector('.rating-panel-label span:last-child');
  if(label&&label.textContent!=='Your Rating')label.textContent='Your Rating';

  var own=clamp(record&&Record.ownRating(record));
  var stars=panel.querySelector('.rating-panel-stars');
  if(stars){
    stars.querySelectorAll('.album-rating-star').forEach(function(star){
      var rating=parseInt(star.getAttribute('data-rating'),10)||0;
      star.classList.toggle('filled',own>0&&rating<=own);
      star.classList.toggle('empty',!own||rating>own);
    });

    var row=panel.querySelector('.groovy-rating-value-row');
    if(!row){
      row=document.createElement('div');
      row.className='groovy-rating-value-row';
      stars.parentNode.insertBefore(row,stars);
      row.appendChild(stars);
    }else if(stars.parentNode!==row){
      row.insertBefore(stars,row.firstChild);
    }
    ensureScore(row,own);
  }

  ensureOwnFooter(panel,own);
}

function decorateCommunity(record){
  var panel=ratingRoot&&ratingRoot.querySelector('.rating-panel-community');
  if(!panel)return;

  panel.querySelectorAll('.groovy-rating-helper').forEach(function(node){node.remove();});
  var label=panel.querySelector('.rating-panel-label span:last-child');
  if(label&&label.textContent!=='Community Rating')label.textContent='Community Rating';

  var average=clamp(record&&Record.communityRating(record));
  var count=parseInt(record&&Record.communityCount(record),10)||0;
  var main=panel.querySelector('.rating-panel-community-main');
  var marker=average+'|'+count;
  if(main&&panel.dataset.groovyCommunityV4!==marker){
    panel.dataset.groovyCommunityV4=marker;
    main.innerHTML=staticStars(average)+'<strong class="groovy-rating-score" data-score="'+esc(scoreText(average))+'">'+scoreMarkup(average)+'</strong>';
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

  var result=await supabaseClient.from('profiles').select('id,username,avatar_url').eq('id',userId).maybeSingle();
  var profile=result&&!result.error&&result.data?result.data:{id:userId,username:'User',avatar_url:''};
  profileCache.set(key,profile);
  return profile;
}

function avatarMarkup(profile){
  var username=profile&&profile.username?profile.username:'User';
  var url=String(profile&&profile.avatar_url||'').trim();
  if(url)return '<span class="groovy-rating-avatar has-image" style="background-image:url(&quot;'+esc(url)+'&quot;)" aria-hidden="true"></span>';
  return '<span class="groovy-rating-avatar groovy-initial-avatar" aria-hidden="true"><span class="groovy-initial-avatar-letter">'+esc(firstLetter(username))+'</span></span>';
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
}

function queueDecorate(){
  if(queued)return;
  queued=true;
  setTimeout(function(){
    queued=false;
    decorateBase();
    scanAvatars(document);
  },25);
}

function install(){
  if(!overlay||!ratingRoot)return;
  decorateBase();
  scanAvatars(document);

  new MutationObserver(function(){
    queueDecorate();
  }).observe(ratingRoot,{childList:true,subtree:true});

  new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      mutation.addedNodes.forEach(function(node){if(node&&node.nodeType===1)scanAvatars(node);});
    });
  }).observe(document.body,{childList:true,subtree:true});

  new MutationObserver(function(){
    if(overlay.classList.contains('visible')){
      setTimeout(function(){decorateBase();syncViewed();},40);
    }else{
      viewedToken++;
    }
  }).observe(overlay,{attributes:true,attributeFilter:['class']});

  window.addEventListener('groovy-rating-updated',function(event){
    if(!overlay.classList.contains('visible'))return;
    var record=currentRecord();
    var albumId=event&&event.detail&&event.detail.albumId;
    if(albumId&&record&&String(Record.albumId(record))!==String(albumId))return;
    setTimeout(decorateBase,0);
  });

  window.addEventListener('groovy-route-change',function(){
    if(overlay.classList.contains('visible'))setTimeout(function(){decorateBase();syncViewed();},0);
  });

  if(overlay.classList.contains('visible'))setTimeout(function(){decorateBase();syncViewed();},35);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();

})();