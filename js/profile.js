(function(){
  'use strict';

  if(typeof supabaseClient==='undefined')return;

  var profileMenu=document.getElementById('profileMenu');
  var myCollectionButton=document.getElementById('myCollectionButton');
  if(!profileMenu||!myCollectionButton)return;

  function decodeUsername(value){
    try{return decodeURIComponent(value);}catch(error){return null;}
  }

  function publicProfileUsernameFromPath(pathname){
    var match=String(pathname||'').match(/^\/profile\/([^\/]+)\/?$/);
    return match?decodeUsername(match[1]):null;
  }

  var state={user:null,profile:null,counts:{collection:0,wishlist:0,shelves:0},loading:false,publicProfile:null,grail:null};
  var grailSearchTimer=null;
  var grailSearchVersion=0;
  var publicProfileOpenedWithHistory=false;

  var menuButton=document.createElement('button');
  menuButton.id='profileSettingsMenuButton';
  menuButton.className='menu-button';
  menuButton.type='button';
  menuButton.textContent='Profile';
  profileMenu.insertBefore(menuButton,myCollectionButton);

  var viewedUserActions=document.querySelector('.viewed-user-actions');
  var viewedProfileButton=document.getElementById('viewedUserProfileButton');
  if(viewedUserActions&&!viewedProfileButton){
    viewedProfileButton=document.createElement('button');
    viewedProfileButton.id='viewedUserProfileButton';
    viewedProfileButton.className='viewed-user-nav viewed-user-profile-button';
    viewedProfileButton.type='button';
    viewedProfileButton.setAttribute('aria-label','View profile');
    viewedProfileButton.innerHTML='<span class="viewed-profile-icon" aria-hidden="true"></span><span class="viewed-action-label">View Profile</span>';
    viewedUserActions.appendChild(viewedProfileButton);
  }

  function syncViewedProfileButtonLabel(isOwn){
    if(!viewedProfileButton)return;
    if(typeof isOwn!=='boolean'){
      var header=document.getElementById('viewedUserHeader');
      isOwn=!!(header&&header.dataset.own==='true');
    }
    var label=viewedProfileButton.querySelector('.viewed-action-label');
    if(label)label.textContent=isOwn?'Your Profile':'View Profile';
    viewedProfileButton.setAttribute('aria-label',isOwn?'View your profile':'View profile');
  }
  window.groovySyncViewedProfileButtonLabel=syncViewedProfileButtonLabel;
  syncViewedProfileButtonLabel();

  var publicPage=document.createElement('div');
  publicPage.id='collectorProfilePage';
  publicPage.className='collector-profile-page';
  publicPage.setAttribute('aria-hidden','true');
  publicPage.innerHTML=
    '<div class="collector-profile-shell">'+
      '<div class="collector-profile-toolbar">'+
        '<span class="collector-profile-toolbar-label">COLLECTOR PROFILE</span>'+
        '<nav class="collector-profile-toolbar-nav" aria-label="Collector links">'+
          '<button id="collectorProfileShelf" type="button"><span class="collector-profile-record" aria-hidden="true"></span>View Shelf</button>'+
          '<button id="collectorProfileWishlist" type="button"><span class="collector-profile-bookmark" aria-hidden="true"></span>View Wishlist</button>'+
          '<button id="collectorProfileStats" type="button"><span class="collector-profile-bars" aria-hidden="true"></span>Statistics</button>'+
        '</nav>'+
      '</div>'+
      '<main id="collectorProfileContent" class="collector-profile-content"></main>'+
    '</div>';
  document.body.appendChild(publicPage);

  var settingsPage=document.createElement('div');
  settingsPage.id='profileSettingsPage';
  settingsPage.className='profile-settings-page';
  settingsPage.setAttribute('role','dialog');
  settingsPage.setAttribute('aria-modal','true');
  settingsPage.setAttribute('aria-labelledby','profileSettingsTitle');
  settingsPage.setAttribute('aria-hidden','true');
  settingsPage.innerHTML=
    '<div class="profile-settings-shell">'+
      '<div class="profile-settings-toolbar">'+
        '<div class="profile-settings-toolbar-brand"><img class="profile-settings-toolbar-logo" src="/assets/images/logo.png" alt="GroovyShelves"><strong id="profileSettingsTitle">Edit profile</strong></div>'+
        '<button id="closeProfileSettings" type="button" aria-label="Close profile settings">×</button>'+
      '</div>'+
      '<div class="profile-settings-body">'+
        '<section class="profile-settings-hero">'+
          '<div class="profile-settings-avatar-wrap">'+
            '<button id="profileSettingsAvatarButton" class="profile-settings-avatar" type="button" aria-label="Change profile picture"></button>'+
            '<button id="profileSettingsChangePhoto" class="profile-settings-photo-action" type="button">Change photo</button>'+
            '<button id="profileSettingsRemovePhoto" class="profile-settings-photo-remove" type="button">Remove</button>'+
            '<input id="profileSettingsImageInput" type="file" accept="image/*" hidden>'+
          '</div>'+
          '<div class="profile-settings-hero-copy">'+
            '<span class="profile-settings-kicker">YOUR COLLECTOR PROFILE</span>'+
            '<h1 id="profileSettingsHeroName">Profile</h1>'+
            '<p id="profileSettingsHeroMeta"></p>'+
            '<div class="profile-settings-stats">'+
              '<div><strong id="profileSettingsCollectionCount">—</strong><span>Records</span></div>'+
              '<div><strong id="profileSettingsWishlistCount">—</strong><span>Wishlist</span></div>'+
              '<div><strong id="profileSettingsShelfCount">—</strong><span>Shelves</span></div>'+
            '</div>'+
          '</div>'+
        '</section>'+
        '<div id="profileSettingsStatus" class="profile-settings-status" role="status" aria-live="polite"></div>'+
        '<div class="profile-settings-layout">'+
          '<section class="profile-settings-card profile-settings-public">'+
            '<div class="profile-settings-card-heading"><div><span>PUBLIC PROFILE</span><h2>About you</h2></div><p>This information appears on your public collector profile.</p></div>'+
            '<label class="profile-settings-field"><span>Username</span><input id="profileSettingsUsername" type="text" maxlength="30" autocomplete="username"><small>3–30 characters. Letters, numbers, dots, dashes and underscores.</small></label>'+
            '<label class="profile-settings-field"><span>About</span><textarea id="profileSettingsBio" maxlength="500" rows="5" placeholder="Tell other collectors a little about yourself and your taste in music."></textarea><small id="profileSettingsBioCount">0 / 500</small></label>'+
            '<div class="profile-settings-two-col">'+
              '<label class="profile-settings-field"><span>Favorite artist</span><input id="profileSettingsFavoriteArtist" type="text" maxlength="100" placeholder="e.g. Pink Floyd"></label>'+
              '<label class="profile-settings-field"><span>Favorite genre</span><input id="profileSettingsFavoriteGenre" type="text" maxlength="80" placeholder="e.g. Progressive Rock"></label>'+
            '</div>'+
            '<label class="profile-settings-field profile-settings-year-field"><span>Collecting since</span><input id="profileSettingsCollectingSince" type="number" min="1900" max="2100" inputmode="numeric" placeholder="e.g. 2018"></label>'+
            '<section class="profile-settings-grail">'+
              '<div class="profile-settings-grail-heading"><div><span>GRAIL RECORD</span><strong>The one you are hunting for</strong></div><small>Search the same album catalogue used by Groovy.</small></div>'+
              '<label class="profile-settings-grail-search"><span class="profile-settings-grail-search-icon" aria-hidden="true"></span><input id="profileSettingsGrailSearch" type="search" placeholder="Search artist or album..." autocomplete="off"></label>'+
              '<div id="profileSettingsGrailResults" class="profile-settings-grail-results" hidden></div>'+
              '<div id="profileSettingsGrailSelected" class="profile-settings-grail-selected"></div>'+
            '</section>'+
            '<div class="profile-settings-url-block"><span>Public profile URL</span><a id="profileSettingsPublicUrl" href="/" target="_blank" rel="noopener noreferrer"></a><small>This is the URL you can send to other people. No copy button is needed.</small></div>'+
            '<div class="profile-settings-actions"><button id="profileSettingsSave" class="profile-settings-primary" type="button">Save profile</button></div>'+
          '</section>'+
          '<div class="profile-settings-side">'+
            '<section class="profile-settings-card">'+
              '<div class="profile-settings-card-heading"><div><span>ACCOUNT</span><h2>Login & security</h2></div></div>'+
              '<label class="profile-settings-field"><span>Email</span><input id="profileSettingsEmail" type="email" disabled><small>Your login email is managed by your account.</small></label>'+
              '<label class="profile-settings-field"><span>New password</span><input id="profileSettingsPassword" type="password" minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></label>'+
              '<label class="profile-settings-field"><span>Confirm new password</span><input id="profileSettingsPasswordConfirm" type="password" minlength="6" autocomplete="new-password"></label>'+
              '<button id="profileSettingsPasswordSave" class="profile-settings-secondary" type="button">Change password</button>'+
            '</section>'+
            '<section class="profile-settings-card profile-settings-danger">'+
              '<div class="profile-settings-card-heading"><div><span>DANGER ZONE</span><h2>Delete account</h2></div></div>'+
              '<p>This permanently deletes your profile, collection, wishlist, ratings, shelves and account. This cannot be undone.</p>'+
              '<label class="profile-settings-field"><span>Type your username to confirm</span><input id="profileSettingsDeleteConfirm" type="text" autocomplete="off"></label>'+
              '<button id="profileSettingsDelete" class="profile-settings-delete" type="button" disabled>Delete my account</button>'+
            '</section>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(settingsPage);

  var publicContent=document.getElementById('collectorProfileContent');
  var publicShelfButton=document.getElementById('collectorProfileShelf');
  var publicWishlistButton=document.getElementById('collectorProfileWishlist');
  var publicStatsButton=document.getElementById('collectorProfileStats');
  var mainHeader=document.querySelector('.header');
  if(mainHeader&&mainHeader.parentNode)mainHeader.parentNode.insertBefore(publicPage,mainHeader.nextSibling);
  var closeButton=document.getElementById('closeProfileSettings');
  var avatarButton=document.getElementById('profileSettingsAvatarButton');
  var changePhotoButton=document.getElementById('profileSettingsChangePhoto');
  var removePhotoButton=document.getElementById('profileSettingsRemovePhoto');
  var imageInput=document.getElementById('profileSettingsImageInput');
  var usernameInput=document.getElementById('profileSettingsUsername');
  var bioInput=document.getElementById('profileSettingsBio');
  var bioCount=document.getElementById('profileSettingsBioCount');
  var favoriteArtistInput=document.getElementById('profileSettingsFavoriteArtist');
  var favoriteGenreInput=document.getElementById('profileSettingsFavoriteGenre');
  var collectingSinceInput=document.getElementById('profileSettingsCollectingSince');
  var grailSearchInput=document.getElementById('profileSettingsGrailSearch');
  var grailResults=document.getElementById('profileSettingsGrailResults');
  var grailSelected=document.getElementById('profileSettingsGrailSelected');
  var publicUrl=document.getElementById('profileSettingsPublicUrl');
  var saveButton=document.getElementById('profileSettingsSave');
  var emailInput=document.getElementById('profileSettingsEmail');
  var passwordInput=document.getElementById('profileSettingsPassword');
  var passwordConfirmInput=document.getElementById('profileSettingsPasswordConfirm');
  var passwordSaveButton=document.getElementById('profileSettingsPasswordSave');
  var deleteConfirmInput=document.getElementById('profileSettingsDeleteConfirm');
  var deleteButton=document.getElementById('profileSettingsDelete');
  var statusBox=document.getElementById('profileSettingsStatus');

  function safeText(value){return String(value==null?'':value);}

  function escapeHtml(value){
    return safeText(value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});
  }

  function publicProfileUrl(username){return window.location.origin+'/profile/'+encodeURIComponent(username||'');}
  function shelfUrl(username,view){return '/shelf/'+encodeURIComponent(username||'')+(view==='wishlist'?'?view=wishlist':'');}
  function statisticsUrl(username){return '/shelf/'+encodeURIComponent(username||'')+'?stats=1';}

  function spotifyAlbumUrl(artist,title){return 'https://open.spotify.com/search/'+encodeURIComponent([artist,title].filter(Boolean).join(' '));}
  function appleFallbackUrl(artist,title){return 'https://music.apple.com/us/search?term='+encodeURIComponent([artist,title].filter(Boolean).join(' '));}

  function normalizeAlbumText(value){
    var text=safeText(value).toLowerCase();
    if(text.normalize)text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return text.replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function splitDiscogsTitle(value){
    var text=safeText(value);
    var parts=text.split(' - ');
    if(parts.length<2)return {artist:'',title:text.trim()};
    return {artist:parts.shift().replace(/\s*\(\d+\)$/,'').trim(),title:parts.join(' - ').trim()};
  }

  function grailFromProfile(profile){
    if(!profile||!profile.grail_title)return null;
    return {
      masterId:profile.grail_discogs_master_id||'',
      title:profile.grail_title||'',
      artist:profile.grail_artist||'',
      year:profile.grail_year||'',
      coverUrl:profile.grail_cover_url||'',
      appleUrl:profile.grail_apple_url||''
    };
  }

  function profileStreamingButtons(item,classPrefix){
    if(!item)return '';
    var apple=item.appleUrl||appleFallbackUrl(item.artist,item.title);
    var spotify=spotifyAlbumUrl(item.artist,item.title);
    return '<div class="'+classPrefix+'-streaming-row">'+
      '<a class="'+classPrefix+'-streaming-service '+classPrefix+'-apple-service" href="'+escapeHtml(apple)+'" target="_blank" rel="noopener noreferrer" aria-label="Listen to '+escapeHtml(item.title)+' on Apple Music"><img src="/assets/brands/apple-music-listen.svg" alt="Listen on Apple Music"></a>'+
      '<a class="'+classPrefix+'-streaming-service '+classPrefix+'-spotify-service" href="'+escapeHtml(spotify)+'" target="_blank" rel="noopener noreferrer" aria-label="Find '+escapeHtml(item.title)+' on Spotify"><img src="/assets/brands/spotify-logo.svg" alt="Spotify"></a>'+
    '</div>';
  }

  function renderSelectedGrail(){
    var item=state.grail;
    if(!item){
      grailSelected.innerHTML='<div class="profile-grail-empty"><span class="profile-grail-empty-record" aria-hidden="true"></span><div><strong>No grail selected</strong><small>Search above and choose the record you are still chasing.</small></div></div>';
      return;
    }

    grailSelected.innerHTML=
      '<article class="profile-grail-card">'+
        '<img class="profile-grail-cover" src="'+escapeHtml(item.coverUrl||'/assets/images/avatar-placeholder.png')+'" alt="" onerror="this.src=\'/assets/images/avatar-placeholder.png\'">'+
        '<div class="profile-grail-copy">'+
          '<span class="profile-grail-label">GRAIL RECORD</span>'+
          '<strong>'+escapeHtml(item.title)+'</strong>'+
          '<small>'+escapeHtml(item.artist)+(item.year?' · '+escapeHtml(item.year):'')+'</small>'+
          profileStreamingButtons(item,'profile-grail')+
        '</div>'+
        '<div class="profile-grail-actions"><button id="profileGrailChange" type="button">Change</button><button id="profileGrailRemove" type="button">Remove</button></div>'+
      '</article>';

    document.getElementById('profileGrailChange').addEventListener('click',function(){
      grailSearchInput.focus();
      grailSearchInput.select();
    });
    document.getElementById('profileGrailRemove').addEventListener('click',function(){
      state.grail=null;
      grailSearchInput.value='';
      grailResults.hidden=true;
      grailResults.innerHTML='';
      renderSelectedGrail();
    });
  }

  async function lookupAppleGrail(artist,title,year){
    try{
      var term=[artist,title].filter(Boolean).join(' ');
      var url='https://itunes.apple.com/search?entity=album&limit=25&country=SE&term='+encodeURIComponent(term);
      var response=await fetch(url,{method:'GET'});
      if(!response.ok)throw new Error('Apple lookup failed');
      var payload=await response.json();
      var wantedArtist=normalizeAlbumText(artist);
      var wantedTitle=normalizeAlbumText(title);
      var wantedYear=parseInt(year,10)||0;
      var candidates=Array.isArray(payload.results)?payload.results:[];

      function score(item){
        var candidateArtist=normalizeAlbumText(item.artistName);
        var candidateTitle=normalizeAlbumText(item.collectionName);
        var candidateYear=parseInt(String(item.releaseDate||'').slice(0,4),10)||0;
        var points=0;
        if(candidateArtist===wantedArtist)points+=8;
        else if(candidateArtist&&wantedArtist&&(candidateArtist.indexOf(wantedArtist)!==-1||wantedArtist.indexOf(candidateArtist)!==-1))points+=4;
        if(candidateTitle===wantedTitle)points+=10;
        else if(candidateTitle&&wantedTitle&&(candidateTitle.indexOf(wantedTitle)!==-1||wantedTitle.indexOf(candidateTitle)!==-1))points+=5;
        if(wantedYear&&candidateYear===wantedYear)points+=2;
        return points;
      }

      var scored=candidates.map(function(item){return {item:item,score:score(item)};}).sort(function(a,b){return b.score-a.score;});
      var best=scored[0]&&scored[0].score>=10?scored[0].item:null;
      if(!best)return null;
      var artwork=best.artworkUrl100||'';
      if(artwork)artwork=artwork.replace(/100x100bb(?:-\d+)?/,'1200x1200bb').replace(/100x100bb/,'1200x1200bb');
      return {
        coverUrl:artwork||'',
        appleUrl:best.collectionViewUrl||'',
        year:String(best.releaseDate||'').slice(0,4)||''
      };
    }catch(error){
      console.warn('Could not enrich grail with Apple Music:',error);
      return null;
    }
  }

  function normalizeGrailSearchResult(result){
    var parts=splitDiscogsTitle(result&&result.title);
    var masterId=result&&(
      result.master_id||
      (String(result.type||'').toLowerCase()==='master'?result.id:'')||
      result.id
    );
    return {
      masterId:masterId||'',
      title:parts.title||safeText(result&&result.title)||'Untitled',
      artist:parts.artist||safeText(result&&result.artist)||'Unknown artist',
      year:result&&result.year?String(result.year):'',
      coverUrl:safeText(result&&(result.cover_image||result.thumb)),
      appleUrl:''
    };
  }

  function renderGrailSearchResults(items){
    if(!items.length){
      grailResults.innerHTML='<div class="profile-grail-search-empty">No albums found. Try another artist or album title.</div>';
      grailResults.hidden=false;
      return;
    }

    grailResults.innerHTML=items.slice(0,8).map(function(item,index){
      return '<button class="profile-grail-result" type="button" data-grail-index="'+index+'">'+
        '<img src="'+escapeHtml(item.coverUrl||'/assets/images/avatar-placeholder.png')+'" alt="" onerror="this.src=\'/assets/images/avatar-placeholder.png\'">'+
        '<span><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.artist)+(item.year?' · '+escapeHtml(item.year):'')+'</small></span>'+
        '<i aria-hidden="true">›</i>'+
      '</button>';
    }).join('');
    grailResults.hidden=false;

    grailResults.querySelectorAll('.profile-grail-result').forEach(function(button){
      button.addEventListener('click',async function(){
        var item=items[parseInt(button.getAttribute('data-grail-index'),10)];
        if(!item)return;
        state.grail=Object.assign({},item);
        grailResults.hidden=true;
        grailResults.innerHTML='';
        grailSearchInput.value=[item.artist,item.title].filter(Boolean).join(' — ');
        renderSelectedGrail();

        var apple=await lookupAppleGrail(item.artist,item.title,item.year);
        if(!state.grail||String(state.grail.masterId)!==String(item.masterId))return;
        if(apple){
          if(apple.coverUrl)state.grail.coverUrl=apple.coverUrl;
          if(apple.appleUrl)state.grail.appleUrl=apple.appleUrl;
          if(!state.grail.year&&apple.year)state.grail.year=apple.year;
          renderSelectedGrail();
        }
      });
    });
  }

  async function searchGrailAlbums(query){
    var version=++grailSearchVersion;
    grailResults.hidden=false;
    grailResults.innerHTML='<div class="profile-grail-search-loading"><span></span>Searching albums…</div>';
    try{
      var response=await supabaseClient.functions.invoke('discogs-search',{body:{query:query}});
      if(version!==grailSearchVersion)return;
      if(response.error)throw response.error;
      var raw=response.data&&Array.isArray(response.data.results)?response.data.results:[];
      var seen={};
      var items=raw.map(normalizeGrailSearchResult).filter(function(item){
        var key=normalizeAlbumText(item.artist)+'|'+normalizeAlbumText(item.title)+'|'+item.year;
        if(!item.title||seen[key])return false;
        seen[key]=true;
        return true;
      });
      renderGrailSearchResults(items);
    }catch(error){
      console.error('Could not search grail albums:',error);
      if(version!==grailSearchVersion)return;
      grailResults.innerHTML='<div class="profile-grail-search-empty">Could not search albums right now. Try again in a moment.</div>';
      grailResults.hidden=false;
    }
  }

  function validUsername(value){return value.length>=3&&value.length<=30&&/^[\p{L}\p{N}._-]+$/u.test(value);}

  function formatDate(value){
    if(!value)return '';
    try{return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'long'}).format(new Date(value));}catch(error){return '';}
  }

  function setStatus(message,type){
    statusBox.textContent=message||'';
    statusBox.className='profile-settings-status'+(type?' '+type:'');
  }

  function setAvatar(url){avatarButton.style.backgroundImage='url("'+(url||'/assets/images/avatar-placeholder.png').replace(/"/g,'%22')+'")';}
  function updateBioCount(){bioCount.textContent=bioInput.value.length+' / 500';}
  function updateDeleteState(){deleteButton.disabled=!state.profile||deleteConfirmInput.value.trim()!==safeText(state.profile.username);}

  async function currentUser(){
    var result=await supabaseClient.auth.getSession();
    return result.data&&result.data.session?result.data.session.user:null;
  }

  async function publicCounts(userId){
    try{
      var rpc=await supabaseClient.rpc('profile_public_counts',{target_profile_id:userId});
      if(!rpc.error&&rpc.data){
        var row=Array.isArray(rpc.data)?rpc.data[0]:rpc.data;
        if(row)return {collection:Number(row.collection_count)||0,wishlist:Number(row.wishlist_count)||0,shelves:Number(row.shelf_count)||0};
      }
    }catch(error){}

    var results=await Promise.all([
      supabaseClient.from('collections').select('id',{count:'exact',head:true}).eq('user_id',userId),
      supabaseClient.from('wishlists').select('id',{count:'exact',head:true}).eq('user_id',userId),
      supabaseClient.from('shelves').select('id',{count:'exact',head:true}).eq('user_id',userId)
    ]);
    return {
      collection:results[0].error?null:(results[0].count||0),
      wishlist:results[1].error?null:(results[1].count||0),
      shelves:results[2].error?null:(results[2].count||0)
    };
  }

  function countText(value){return value===null||value===undefined?'—':String(value);}

  function publicGrailMarkup(profile){
    var item=grailFromProfile(profile);
    if(!item){
      return '<section class="collector-profile-card collector-profile-grail"><span class="collector-profile-section-kicker">GRAIL RECORD</span><h2>The one still missing</h2><p class="collector-profile-muted">No grail record has been selected yet.</p></section>';
    }
    return '<section class="collector-profile-card collector-profile-grail">'+
      '<span class="collector-profile-section-kicker">GRAIL RECORD</span>'+
      '<div class="collector-grail-layout">'+
        '<img class="collector-grail-cover" src="'+escapeHtml(item.coverUrl||'/assets/images/avatar-placeholder.png')+'" alt="" onerror="this.src=\'/assets/images/avatar-placeholder.png\'">'+
        '<div class="collector-grail-copy"><h2>'+escapeHtml(item.title)+'</h2><p>'+escapeHtml(item.artist)+(item.year?' · '+escapeHtml(item.year):'')+'</p>'+profileStreamingButtons(item,'collector-grail')+'</div>'+
      '</div>'+
    '</section>';
  }

  function dispatchRouteChange(){
    try{window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}));}
    catch(error){window.dispatchEvent(new Event('popstate'));}
  }

  function navigate(url){
    settingsPage.classList.remove('visible');
    settingsPage.setAttribute('aria-hidden','true');
    document.body.classList.remove('profile-settings-open');
    publicPage.classList.remove('visible');
    publicPage.setAttribute('aria-hidden','true');
    document.body.classList.remove('collector-profile-open');
    history.pushState({},'',url);
    dispatchRouteChange();
  }

  async function renderPublicProfile(username){
    if(!publicPage.classList.contains('visible'))window.scrollTo(0,0);
    publicPage.classList.add('visible');
    publicPage.setAttribute('aria-hidden','false');
    document.body.classList.add('collector-profile-open');
    publicContent.innerHTML='<div class="collector-profile-loading"><span></span><strong>Loading profile...</strong></div>';

    try{
      var profileResult=await supabaseClient.from('profiles')
        .select('id,username,avatar_url,bio,favorite_artist,favorite_genre,collecting_since,grail_discogs_master_id,grail_title,grail_artist,grail_year,grail_cover_url,grail_apple_url')
        .ilike('username',username)
        .maybeSingle();
      if(profileResult.error)throw profileResult.error;
      if(!profileResult.data){
        publicContent.innerHTML='<div class="collector-profile-empty"><span>PROFILE</span><h1>User not found</h1><p>This collector profile does not exist.</p><button id="collectorProfileEmptyHome" type="button">Back to GroovyShelves</button></div>';
        document.getElementById('collectorProfileEmptyHome').addEventListener('click',function(){navigate('/');});
        return;
      }

      var profile=profileResult.data;
      state.publicProfile=profile;
      var sessionUser=await currentUser();
      var isOwner=!!(sessionUser&&sessionUser.id===profile.id);
      var isFollowing=false;
      if(sessionUser&&!isOwner&&typeof window.groovyIsFollowing==='function'){
        try{isFollowing=await window.groovyIsFollowing(profile.id);}catch(error){isFollowing=false;}
      }
      var counts=await publicCounts(profile.id);
      var facts=[];
      if(profile.favorite_artist)facts.push('<article><span>Favorite artist</span><strong>'+escapeHtml(profile.favorite_artist)+'</strong></article>');
      if(profile.favorite_genre)facts.push('<article><span>Favorite genre</span><strong>'+escapeHtml(profile.favorite_genre)+'</strong></article>');
      if(profile.collecting_since)facts.push('<article><span>Collecting since</span><strong>'+escapeHtml(profile.collecting_since)+'</strong></article>');

      publicContent.innerHTML=
        '<section class="collector-profile-hero">'+
          '<div class="collector-profile-avatar" style="background-image:url(&quot;'+escapeHtml(profile.avatar_url||'/assets/images/avatar-placeholder.png')+'&quot;)"></div>'+
          '<div class="collector-profile-hero-copy">'+
            '<span class="collector-profile-kicker">VINYL COLLECTOR</span>'+
            '<h1>'+escapeHtml(profile.username)+'</h1>'+
            '<p class="collector-profile-handle">groovyshelves.com/profile/'+escapeHtml(profile.username)+'</p>'+
            '<div class="collector-profile-stats">'+
              '<div><strong>'+countText(counts.collection)+'</strong><span>Records</span></div>'+
              '<div><strong>'+countText(counts.wishlist)+'</strong><span>Wishlist</span></div>'+
              '<div><strong>'+countText(counts.shelves)+'</strong><span>Shelves</span></div>'+
            '</div>'+
          '</div>'+
          '<div class="collector-profile-owner-actions">'+(isOwner?'<button id="collectorProfileEdit" type="button">Edit profile</button>':(sessionUser?'<button id="collectorProfileFollow" class="collector-profile-follow'+(isFollowing?' following':'')+'" type="button" data-following="'+(isFollowing?'true':'false')+'">'+(isFollowing?'Following':'Follow')+'</button>':''))+'</div>'+
        '</section>'+
        '<div class="collector-profile-grid">'+
          '<section class="collector-profile-card collector-profile-about"><span class="collector-profile-section-kicker">ABOUT</span><h2>About '+escapeHtml(profile.username)+'</h2>'+
            (profile.bio?'<p>'+escapeHtml(profile.bio).replace(/\n/g,'<br>')+'</p>':'<p class="collector-profile-muted">No about information has been added yet.</p>')+
          '</section>'+
          '<section class="collector-profile-card"><span class="collector-profile-section-kicker">COLLECTOR NOTES</span><h2>In the grooves</h2>'+
            (facts.length?'<div class="collector-profile-facts">'+facts.join('')+'</div>':'<p class="collector-profile-muted">No collector details have been added yet.</p>')+
          '</section>'+
          publicGrailMarkup(profile)+
        '</div>';

      var edit=document.getElementById('collectorProfileEdit');
      if(edit)edit.addEventListener('click',openSettings);
      var follow=document.getElementById('collectorProfileFollow');
      if(follow)follow.addEventListener('click',async function(){
        var currentlyFollowing=follow.dataset.following==='true';
        follow.disabled=true;
        follow.textContent=currentlyFollowing?'Unfollowing...':'Following...';
        try{
          if(currentlyFollowing&&typeof window.groovyUnfollowUser==='function')await window.groovyUnfollowUser(profile.id);
          else if(!currentlyFollowing&&typeof window.groovyFollowUser==='function')await window.groovyFollowUser(profile.id);
          currentlyFollowing=!currentlyFollowing;
          follow.dataset.following=currentlyFollowing?'true':'false';
          follow.classList.toggle('following',currentlyFollowing);
          follow.textContent=currentlyFollowing?'Following':'Follow';
        }catch(error){
          console.error('Could not change follow status:',error);
          follow.textContent=currentlyFollowing?'Following':'Follow';
        }
        follow.disabled=false;
      });
    }catch(error){
      console.error('Could not load public profile:',error);
      publicContent.innerHTML='<div class="collector-profile-empty"><span>PROFILE</span><h1>Profile unavailable</h1><p>Could not load this collector profile right now.</p></div>';
    }
  }

  async function loadSettings(){
    if(state.loading)return;
    state.loading=true;
    setStatus('');
    try{
      var user=await currentUser();
      if(!user)throw new Error('You need to be logged in to edit your profile.');
      state.user=user;
      var result=await supabaseClient.from('profiles')
        .select('id,username,avatar_url,bio,favorite_artist,favorite_genre,collecting_since,grail_discogs_master_id,grail_title,grail_artist,grail_year,grail_cover_url,grail_apple_url')
        .eq('id',user.id)
        .maybeSingle();
      if(result.error)throw result.error;
      var profile=result.data||{id:user.id,username:(user.user_metadata&&user.user_metadata.username)||''};
      state.profile=profile;

      usernameInput.value=safeText(profile.username);
      bioInput.value=safeText(profile.bio);
      favoriteArtistInput.value=safeText(profile.favorite_artist);
      favoriteGenreInput.value=safeText(profile.favorite_genre);
      collectingSinceInput.value=profile.collecting_since||'';
      state.grail=grailFromProfile(profile);
      grailSearchInput.value=state.grail?[state.grail.artist,state.grail.title].filter(Boolean).join(' — '):'';
      grailResults.hidden=true;
      grailResults.innerHTML='';
      renderSelectedGrail();
      emailInput.value=safeText(user.email);
      passwordInput.value='';
      passwordConfirmInput.value='';
      deleteConfirmInput.value='';
      updateDeleteState();
      updateBioCount();
      setAvatar(profile.avatar_url);

      document.getElementById('profileSettingsHeroName').textContent=profile.username||'Your profile';
      var joined=formatDate(user.created_at);
      document.getElementById('profileSettingsHeroMeta').textContent=joined?'Member since '+joined:'Your GroovyShelves account';
      publicUrl.textContent=publicProfileUrl(profile.username);
      publicUrl.href=publicProfileUrl(profile.username);

      var counts=await publicCounts(user.id);
      state.counts=counts;
      document.getElementById('profileSettingsCollectionCount').textContent=countText(counts.collection);
      document.getElementById('profileSettingsWishlistCount').textContent=countText(counts.wishlist);
      document.getElementById('profileSettingsShelfCount').textContent=countText(counts.shelves);
    }catch(error){
      console.error('Could not load profile settings:',error);
      var message=(error&&error.message)||'Could not load your profile.';
      if(message.indexOf('column')!==-1||message.indexOf('bio')!==-1)message='Run the included profile SQL migration in Supabase first, then reload this page.';
      setStatus(message,'error');
    }finally{
      state.loading=false;
    }
  }

  async function openSettings(){
    var user=await currentUser();
    if(!user)return;
    if(state.publicProfile&&state.publicProfile.id!==user.id)return;
    settingsPage.classList.add('visible');
    settingsPage.setAttribute('aria-hidden','false');
    document.body.classList.add('profile-settings-open');
    await loadSettings();
    setTimeout(function(){closeButton.focus();},0);
  }

  function closeSettings(){
    settingsPage.classList.remove('visible');
    settingsPage.setAttribute('aria-hidden','true');
    document.body.classList.remove('profile-settings-open');
  }

  async function saveProfile(){
    if(!state.user)return;
    var username=usernameInput.value.trim();
    if(!validUsername(username)){
      setStatus('Username must be 3–30 characters and may only contain letters, numbers, dots, dashes and underscores.','error');
      usernameInput.focus();
      return;
    }

    var year=collectingSinceInput.value.trim();
    if(year){
      var numericYear=parseInt(year,10);
      var maxYear=new Date().getFullYear();
      if(!Number.isInteger(numericYear)||numericYear<1900||numericYear>maxYear){
        setStatus('Collecting since must be a year between 1900 and '+maxYear+'.','error');
        collectingSinceInput.focus();
        return;
      }
    }

    saveButton.disabled=true;
    saveButton.textContent='Saving...';
    setStatus('');
    var oldUsername=state.profile&&state.profile.username;
    var payload={
      id:state.user.id,
      username:username,
      bio:bioInput.value.trim(),
      favorite_artist:favoriteArtistInput.value.trim(),
      favorite_genre:favoriteGenreInput.value.trim(),
      collecting_since:year?parseInt(year,10):null,
      grail_discogs_master_id:state.grail&&state.grail.masterId?String(state.grail.masterId):null,
      grail_title:state.grail?state.grail.title:'',
      grail_artist:state.grail?state.grail.artist:'',
      grail_year:state.grail&&state.grail.year?parseInt(state.grail.year,10)||null:null,
      grail_cover_url:state.grail?state.grail.coverUrl:'',
      grail_apple_url:state.grail?state.grail.appleUrl:'',
      updated_at:new Date().toISOString()
    };

    try{
      var result=await supabaseClient.from('profiles').upsert(payload,{onConflict:'id'}).select('id,username,avatar_url,bio,favorite_artist,favorite_genre,collecting_since,grail_discogs_master_id,grail_title,grail_artist,grail_year,grail_cover_url,grail_apple_url').single();
      if(result.error)throw result.error;
      var metadataResult=await supabaseClient.auth.updateUser({data:{username:username}});
      if(metadataResult.error)console.warn('Could not update auth username metadata:',metadataResult.error);

      state.profile=result.data;
      state.publicProfile=result.data;
      state.grail=grailFromProfile(result.data);
      document.getElementById('profileSettingsHeroName').textContent=username;
      publicUrl.textContent=publicProfileUrl(username);
      publicUrl.href=publicProfileUrl(username);
      deleteConfirmInput.value='';
      updateDeleteState();
      setStatus('Profile saved.','success');

      var menuName=document.getElementById('profileUsername');
      if(menuName)menuName.textContent=username;
      if(typeof window.updateAuthUI==='function')window.updateAuthUI();

      if(oldUsername!==username&&publicProfileUsernameFromPath(window.location.pathname)){
        history.replaceState({},'', '/profile/'+encodeURIComponent(username));
      }
      renderPublicProfile(username);
    }catch(error){
      console.error('Could not save profile:',error);
      if(error&&error.code==='23505')setStatus('That username is already taken. Choose another one.','error');
      else setStatus((error&&error.message)||'Could not save your profile.','error');
    }finally{
      saveButton.disabled=false;
      saveButton.textContent='Save profile';
    }
  }

  async function changePassword(){
    var password=passwordInput.value;
    var confirmation=passwordConfirmInput.value;
    if(password.length<6){setStatus('Your new password must be at least 6 characters.','error');passwordInput.focus();return;}
    if(password!==confirmation){setStatus('The two password fields do not match.','error');passwordConfirmInput.focus();return;}

    passwordSaveButton.disabled=true;
    passwordSaveButton.textContent='Changing...';
    setStatus('');
    try{
      var result=await supabaseClient.auth.updateUser({password:password});
      if(result.error)throw result.error;
      passwordInput.value='';
      passwordConfirmInput.value='';
      setStatus('Password changed successfully.','success');
    }catch(error){
      console.error('Could not change password:',error);
      setStatus((error&&error.message)||'Could not change your password.','error');
    }finally{
      passwordSaveButton.disabled=false;
      passwordSaveButton.textContent='Change password';
    }
  }

  async function uploadAvatar(file){
    if(!file||!state.user)return;
    if(!file.type||file.type.indexOf('image/')!==0){setStatus('Choose an image file.','error');return;}
    if(file.size>5*1024*1024){setStatus('Profile pictures can be at most 5 MB.','error');return;}

    changePhotoButton.disabled=true;
    setStatus('');
    try{
      var extension=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      var path=state.user.id+'/avatar.'+extension;
      var upload=await supabaseClient.storage.from('profile-images').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
      if(upload.error)throw upload.error;
      var publicData=supabaseClient.storage.from('profile-images').getPublicUrl(path);
      var avatarUrl=publicData.data.publicUrl+'?t='+Date.now();
      var update=await supabaseClient.from('profiles').update({avatar_url:avatarUrl,updated_at:new Date().toISOString()}).eq('id',state.user.id).select('avatar_url').single();
      if(update.error)throw update.error;
      state.profile.avatar_url=avatarUrl;
      if(state.publicProfile&&state.publicProfile.id===state.user.id)state.publicProfile.avatar_url=avatarUrl;
      setAvatar(avatarUrl);
      setStatus('Profile picture updated.','success');
      if(typeof window.updateAuthUI==='function')window.updateAuthUI();
      var routeName=publicProfileUsernameFromPath(window.location.pathname);
      if(routeName)renderPublicProfile(routeName);
    }catch(error){
      console.error('Could not upload profile picture:',error);
      setStatus((error&&error.message)||'Could not upload the profile picture.','error');
    }finally{
      changePhotoButton.disabled=false;
      imageInput.value='';
    }
  }

  async function removeAvatar(){
    if(!state.user||!state.profile)return;
    removePhotoButton.disabled=true;
    setStatus('');
    try{
      var update=await supabaseClient.from('profiles').update({avatar_url:null,updated_at:new Date().toISOString()}).eq('id',state.user.id);
      if(update.error)throw update.error;
      try{
        var list=await supabaseClient.storage.from('profile-images').list(state.user.id,{limit:100});
        if(!list.error&&list.data&&list.data.length)await supabaseClient.storage.from('profile-images').remove(list.data.map(function(item){return state.user.id+'/'+item.name;}));
      }catch(storageError){console.warn('Could not clean old avatar files:',storageError);}
      state.profile.avatar_url=null;
      if(state.publicProfile&&state.publicProfile.id===state.user.id)state.publicProfile.avatar_url=null;
      setAvatar('');
      setStatus('Profile picture removed.','success');
      if(typeof window.updateAuthUI==='function')window.updateAuthUI();
      var routeName=publicProfileUsernameFromPath(window.location.pathname);
      if(routeName)renderPublicProfile(routeName);
    }catch(error){
      console.error('Could not remove profile picture:',error);
      setStatus((error&&error.message)||'Could not remove the profile picture.','error');
    }finally{removePhotoButton.disabled=false;}
  }

  async function deleteAccount(){
    if(!state.profile||deleteConfirmInput.value.trim()!==safeText(state.profile.username))return;
    if(!window.confirm('Delete your GroovyShelves account permanently? This cannot be undone.'))return;
    deleteButton.disabled=true;
    deleteButton.textContent='Deleting...';
    setStatus('');
    try{
      var response=await supabaseClient.functions.invoke('delete-account',{body:{confirm:true}});
      if(response.error)throw response.error;
      if(response.data&&response.data.error)throw new Error(response.data.error);
      try{await supabaseClient.auth.signOut({scope:'local'});}catch(error){}
      window.location.href='/';
    }catch(error){
      console.error('Could not delete account:',error);
      setStatus('Could not delete the account. Make sure the delete-account Edge Function is deployed, then try again.','error');
      deleteButton.disabled=false;
      deleteButton.textContent='Delete my account';
    }
  }

  async function openOwnProfile(){
    profileMenu.classList.remove('open');
    var user=await currentUser();
    if(!user)return;
    var result=await supabaseClient.from('profiles').select('username').eq('id',user.id).maybeSingle();
    var username=result.data&&result.data.username?result.data.username:(user.user_metadata&&user.user_metadata.username)||'';
    if(!username)return;
    publicProfileOpenedWithHistory=true;
    history.pushState({},'', '/profile/'+encodeURIComponent(username));
    syncRoute();
  }

  function closePublicProfile(){
    if(publicProfileOpenedWithHistory){
      publicProfileOpenedWithHistory=false;
      history.back();
      return;
    }
    var username=state.publicProfile&&state.publicProfile.username?state.publicProfile.username:publicProfileUsernameFromPath(window.location.pathname);
    navigate(username?shelfUrl(username):'/');
  }

  function syncRoute(){
    var username=publicProfileUsernameFromPath(window.location.pathname);
    if(username){renderPublicProfile(username);return;}
    publicPage.classList.remove('visible');
    publicPage.setAttribute('aria-hidden','true');
    document.body.classList.remove('collector-profile-open');
    state.publicProfile=null;
  }

  menuButton.addEventListener('click',openOwnProfile);
  if(viewedProfileButton)viewedProfileButton.addEventListener('click',function(){
    var profile=window.groovyViewedStatisticsProfile;
    if(!profile||!profile.username||profile.username==='Unknown user')return;
    publicProfileOpenedWithHistory=true;
    navigate('/profile/'+encodeURIComponent(profile.username));
  });
  if(publicShelfButton)publicShelfButton.addEventListener('click',function(){
    var profile=state.publicProfile;
    if(profile&&profile.username)navigate(shelfUrl(profile.username));
  });
  if(publicWishlistButton)publicWishlistButton.addEventListener('click',function(){
    var profile=state.publicProfile;
    if(profile&&profile.username)navigate(shelfUrl(profile.username,'wishlist'));
  });
  if(publicStatsButton)publicStatsButton.addEventListener('click',function(){
    var profile=state.publicProfile;
    if(profile&&profile.username)navigate(statisticsUrl(profile.username));
  });
  closeButton.addEventListener('click',closeSettings);
  settingsPage.addEventListener('click',function(event){if(event.target===settingsPage)closeSettings();});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&settingsPage.classList.contains('visible'))closeSettings();});
  bioInput.addEventListener('input',updateBioCount);
  grailSearchInput.addEventListener('input',function(){
    clearTimeout(grailSearchTimer);
    var query=grailSearchInput.value.trim();
    if(query.length<2){
      grailSearchVersion++;
      grailResults.hidden=true;
      grailResults.innerHTML='';
      return;
    }
    grailSearchTimer=setTimeout(function(){searchGrailAlbums(query);},350);
  });
  grailSearchInput.addEventListener('keydown',function(event){
    if(event.key==='Escape'){
      grailResults.hidden=true;
      grailResults.innerHTML='';
      grailSearchInput.blur();
    }
  });
  usernameInput.addEventListener('input',function(){var value=usernameInput.value.trim();publicUrl.textContent=publicProfileUrl(value);publicUrl.href=publicProfileUrl(value);});
  deleteConfirmInput.addEventListener('input',updateDeleteState);
  saveButton.addEventListener('click',saveProfile);
  passwordSaveButton.addEventListener('click',changePassword);
  avatarButton.addEventListener('click',function(){imageInput.click();});
  changePhotoButton.addEventListener('click',function(){imageInput.click();});
  imageInput.addEventListener('change',function(){uploadAvatar(imageInput.files&&imageInput.files[0]);});
  removePhotoButton.addEventListener('click',removeAvatar);
  deleteButton.addEventListener('click',deleteAccount);

  window.addEventListener('popstate',syncRoute);
  window.addEventListener('groovy-route-change',syncRoute);
  supabaseClient.auth.onAuthStateChange(function(){setTimeout(syncRoute,0);});

  syncRoute();
})();
