var NotificationCore=window.GroovyNotificationCore;
if(!NotificationCore)throw new Error('GroovyNotificationCore must load before app.js');
var NotificationController=window.GroovyNotificationController;
if(!NotificationController)throw new Error('GroovyNotificationController must load before app.js');
var SocialController=window.GroovySocialController;
if(!SocialController)throw new Error('GroovySocialController must load before app.js');
var UserSearchController=window.GroovyUserSearchController;
if(!UserSearchController)throw new Error('GroovyUserSearchController must load before app.js');
var DetailSocialController=window.GroovyDetailSocialController;
if(!DetailSocialController)throw new Error('GroovyDetailSocialController must load before app.js');
var AppleSearchCore=window.GroovyAppleSearchCore;
if(!AppleSearchCore)throw new Error('GroovyAppleSearchCore must load before app.js');
var AlbumSearch=window.GroovyAlbumSearch;
if(!AlbumSearch)throw new Error('GroovyAlbumSearch must load before app.js');
var PressingCore=window.GroovyPressingCore;
if(!PressingCore)throw new Error('GroovyPressingCore must load before app.js');
var PressingView=window.GroovyPressingView;
var PressingPicker=window.GroovyPressingPicker;

const profileButton=document.getElementById('profileButton');
const profileMenu=document.getElementById('profileMenu');
const profileUsername=document.getElementById('profileUsername');
const profileAvatarButton=document.getElementById('profileAvatarButton');
const profileImageInput=document.getElementById('profileImageInput');
const profileImageMenu=document.getElementById('profileImageMenu');
const profileImage=document.getElementById('profileImage');

function syncVisualViewport(){
    const viewport=window.visualViewport;
    const height=viewport?viewport.height:window.innerHeight;
    const offsetTop=viewport?viewport.offsetTop:0;

    document.documentElement.style.setProperty('--groovy-visual-height',Math.round(height)+'px');
    document.documentElement.style.setProperty('--groovy-visual-top',Math.round(offsetTop)+'px');
}

syncVisualViewport();
window.addEventListener('resize',syncVisualViewport,{passive:true});

if(window.visualViewport){
    window.visualViewport.addEventListener('resize',syncVisualViewport,{passive:true});
    window.visualViewport.addEventListener('scroll',syncVisualViewport,{passive:true});
}
const loginPanel=document.getElementById('loginPanel');
const loginEmail=document.getElementById('loginEmail');
const loginPassword=document.getElementById('loginPassword');
const loginButton=document.getElementById('loginButton');
const logoutButton=document.getElementById('logoutButton');
const loginClose=document.getElementById('loginClose');

const authTitle=document.getElementById('authTitle');
const authKicker=document.getElementById('authKicker');
const authDescription=document.getElementById('authDescription');
const authSwitchPrompt=document.getElementById('authSwitchPrompt');
const registerFields=document.getElementById('registerFields');
const registerUsername=document.getElementById('registerUsername');
const registerButton=document.getElementById('registerButton');
const authSwitchButton=document.getElementById('authSwitchButton');
const viewedUserFollowButton=document.getElementById('viewedUserFollowButton');

// A blurred header becomes a containing block for fixed descendants in mobile
// browsers. Put the dialog at body level after capturing its controls, so it
// remains centered without activating the hidden legacy markup below.
document.body.appendChild(loginPanel);

let registerMode=false;

function setAuthMode(mode){
    registerMode=mode==='register';

    if(registerMode){
        authKicker.textContent='Join the groove';
        authTitle.textContent='Create your account';
        authDescription.textContent='Start building and sharing your vinyl collection.';
        registerFields.style.display='block';
        loginButton.style.display='none';
        registerButton.style.display='block';
        authSwitchPrompt.textContent='Already have an account?';
        authSwitchButton.textContent='Log in';
        loginPassword.setAttribute('autocomplete','new-password');
    }else{
        authKicker.textContent='Your collection awaits';
        authTitle.textContent='Welcome back';
        authDescription.textContent='Sign in and pick up exactly where you left off.';
        registerFields.style.display='none';
        loginButton.style.display='block';
        registerButton.style.display='none';
        authSwitchPrompt.textContent='New to Groovy?';
        authSwitchButton.textContent='Create account';
        loginPassword.setAttribute('autocomplete','current-password');
    }
}

function focusAuthField(){
    if(registerMode){
        registerUsername.focus();
    }else{
        loginEmail.focus();
    }
}

function openAuthPanel(mode){
    profileMenu.classList.remove('open');
    setAuthMode(mode||'login');
    loginPanel.classList.add('open');
    window.requestAnimationFrame(focusAuthField);
}

function shouldShowLoggedOutLanding(){
    return !window.hasAuthenticatedUser&&!window.loginRequiredForViewedCollection&&!window.profileNotFound&&viewedUserId===null;
}

function updateLibraryTabLabels(){
    var loggedOut=shouldShowLoggedOutLanding();
    collectionTabButton.innerHTML='<span class="record-icon" aria-hidden="true"></span>'+(loggedOut?'My Collection':'My Shelf');
    wishlistTabButton.innerHTML='<span class="wishlist-icon" aria-hidden="true"></span>My Wishlist';
}

var escapeSocialHtml=NotificationCore.escapeHtml;

async function currentSessionUser(){
    const {data:{session}}=await supabaseClient.auth.getSession();
    return session&&session.user?session.user:null;
}

function openCollectorRoute(username,view){
    if(!username)return;
    var url=view==='profile'?'/profile/'+encodeURIComponent(username):'/shelf/'+encodeURIComponent(username);
    if(view==='wishlist')url+='?view=wishlist';
    history.pushState({},'',url);
    renderCurrentRoute();
}

var socialController=SocialController.create({
  elements:{
    followingButton:document.getElementById('followingButton'),
    viewedUserFollowButton:viewedUserFollowButton
  },
  api:supabaseClient,
  window:window,
  document:document,
  getCurrentUser:currentSessionUser,
  escapeHtml:escapeSocialHtml,
  onNavigate:function(username,view){openCollectorRoute(username,view);},
  onOpenFollowingRoute:function(){history.pushState({},'','/following');renderCurrentRoute();},
  onBackHome:function(){history.pushState({},'','/');renderCurrentRoute();},
  onRequireAuth:function(){openAuthPanel('login');history.replaceState({},'','/');},
  onBeforeFollowingOpen:function(){profileMenu.classList.remove('open');},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var userSearchController=UserSearchController.create({
  elements:{
    searchButton:document.getElementById('searchUserButton'),
    modal:document.getElementById('searchUserModal'),
    closeButton:document.getElementById('closeSearchUser'),
    input:document.getElementById('userSearchInput'),
    results:document.getElementById('userSearchResults'),
    onlineUsersStatus:document.getElementById('onlineUsersStatus'),
    onlineUsersCount:document.getElementById('onlineUsersCount'),
    onlineUsersDesktopLabel:document.getElementById('onlineUsersDesktopLabel')
  },
  api:supabaseClient,
  window:window,
  document:document,
  getCurrentUser:currentSessionUser,
  socialController:socialController,
  onNavigate:function(username){
    history.pushState({},'','/shelf/'+encodeURIComponent(username));
    renderCurrentRoute();
  },
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var notificationController=NotificationController.create({
  elements:{
    box:document.getElementById('notificationBox'),
    bellButton:document.getElementById('notificationBellButton'),
    badge:document.getElementById('notificationBadge'),
    panel:document.getElementById('notificationPanel'),
    list:document.getElementById('notificationList'),
    markAllButton:document.getElementById('markAllNotificationsRead'),
    clearButton:document.getElementById('clearNotificationsButton')
  },
  api:supabaseClient,
  getCurrentUser:currentSessionUser,
  onNavigate:function(username,view){openCollectorRoute(username,view);},
  onBeforeOpen:function(){profileMenu.classList.remove('open');},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

loginClose.addEventListener('click',function(){
    loginPanel.classList.remove('open');
});

profileButton.addEventListener('click',async function(event){
    event.stopPropagation();
    notificationController.closePanel();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(user){
        loginPanel.classList.remove('open');
        profileMenu.classList.toggle('open');
    }else{
        profileMenu.classList.remove('open');
        if(loginPanel.classList.contains('open')){
            loginPanel.classList.remove('open');
        }else{
            openAuthPanel('login');
        }
    }
});

loginPanel.addEventListener('click',function(event){
    event.stopPropagation();
});

profileMenu.addEventListener('click',function(event){
    event.stopPropagation();
});

document.addEventListener('click',function(){
    profileMenu.classList.remove('open');
    loginPanel.classList.remove('open');
    notificationController.closePanel();
});

authSwitchButton.addEventListener('click',function(){
    setAuthMode(registerMode?'login':'register');
    focusAuthField();
});

[loginEmail,loginPassword,registerUsername].forEach(function(field){
    if(!field)return;
    field.addEventListener('keydown',function(event){
        if(event.key!=='Enter')return;
        event.preventDefault();
        if(registerMode)registerButton.click();
        else loginButton.click();
    });
});

async function updateAuthUI(){
    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;
    userSearchController.syncUser(user);

    if(user){
        profileButton.style.display='flex';
        profileMenu.classList.remove('open');
        loginPanel.classList.remove('open');

        const {data:profile,error:profileError}=await supabaseClient
            .from('profiles')
            .select('username,avatar_url')
            .eq('id',user.id)
            .maybeSingle();

        if(profileError){
            console.error('Kunde inte hämta profil:',profileError);
        }

        const username=
            profile&&profile.username
                ?profile.username
                :user.email
                    ?user.email.split('@')[0]
                    :'användare';

        profileUsername.textContent=username;

        if(profile&&profile.avatar_url){
            profileImage.style.backgroundImage='url("'+profile.avatar_url+'")';
            profileImage.style.backgroundSize='cover';
            profileImage.style.backgroundPosition='center';

            profileImageMenu.style.backgroundImage='url("'+profile.avatar_url+'")';
            profileImageMenu.style.backgroundSize='cover';
            profileImageMenu.style.backgroundPosition='center';
        }else{
            profileImage.style.backgroundImage='url("/assets/images/avatar-placeholder.png")';
            profileImage.style.backgroundSize='cover';
            profileImage.style.backgroundPosition='center';
        
            profileImageMenu.style.backgroundImage='url("/assets/images/avatar-placeholder.png")';
            profileImageMenu.style.backgroundSize='cover';
            profileImageMenu.style.backgroundPosition='center';
        }

        loginEmail.value='';
        loginPassword.value='';
        registerUsername.value='';
        notificationController.syncUser(user);
    }else{
        profileButton.style.display='flex';
        profileMenu.classList.remove('open');
        loginPanel.classList.remove('open');

        profileImage.style.backgroundImage='url("/assets/images/avatar-placeholder.png")';
        profileImage.style.backgroundSize='cover';
        profileImage.style.backgroundPosition='center';
        
        profileImageMenu.style.backgroundImage='url("/assets/images/avatar-placeholder.png")';
        profileImageMenu.style.backgroundSize='cover';
        profileImageMenu.style.backgroundPosition='center';
        notificationController.syncUser(null);
    }
}

profileAvatarButton.addEventListener('click',function(){
    profileImageInput.click();
});

profileImageInput.addEventListener('change',async function(){
    const file=profileImageInput.files[0];

    if(!file)return;

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user){
        alert('Du måste vara inloggad.');
        return;
    }

    if(!file.type.startsWith('image/')){
        alert('Välj en bildfil.');
        profileImageInput.value='';
        return;
    }

    if(file.size>5*1024*1024){
        alert('Bilden får vara högst 5 MB.');
        profileImageInput.value='';
        return;
    }

    profileAvatarButton.disabled=true;

    try{
        const extension=file.name.split('.').pop().toLowerCase();
        const filePath=user.id+'/avatar.'+extension;

        const {error:uploadError}=await supabaseClient
            .storage
            .from('profile-images')
            .upload(filePath,file,{
                upsert:true,
                contentType:file.type,
                cacheControl:'3600'
            });

        if(uploadError)throw uploadError;

        const {data:publicUrlData}=supabaseClient
            .storage
            .from('profile-images')
            .getPublicUrl(filePath);

        const avatarUrl=publicUrlData.publicUrl+'?t='+Date.now();

        const {error:updateError}=await supabaseClient
            .from('profiles')
            .update({
                avatar_url:avatarUrl
            })
            .eq('id',user.id)
            .select('id,avatar_url');
        
        if(updateError)throw updateError;

        profileImage.style.backgroundImage='url("'+avatarUrl+'")';
        profileImage.style.backgroundSize='cover';
        profileImage.style.backgroundPosition='center';
        
        profileImageMenu.style.backgroundImage='url("'+avatarUrl+'")';
        profileImageMenu.style.backgroundSize='cover';
        profileImageMenu.style.backgroundPosition='center';

    }catch(error){
        console.error('Profilbild kunde inte laddas upp:',error);
        alert('Kunde inte ladda upp profilbilden.\n\n'+error.message);
    }

    profileAvatarButton.disabled=false;
    profileImageInput.value='';
});

loginButton.addEventListener('click',async function(){
    const email=loginEmail.value.trim();
    const password=loginPassword.value;

    if(!email||!password){
        alert('Fyll i e-post och lösenord.');
        return;
    }

    loginButton.disabled=true;
    loginButton.textContent='Logging in...';

    const {data,error}=await supabaseClient.auth.signInWithPassword({
        email:email,
        password:password
    });

    if(error){
        console.error('Login error:',error);
        alert(error.message);
        loginButton.disabled=false;
        loginButton.textContent='Log in';
        return;
    }

    loginButton.disabled=false;
    loginButton.textContent='Log in';

    await updateAuthUI();
});

registerButton.addEventListener('click',async function(){
    const username=registerUsername.value.trim();
    const email=loginEmail.value.trim();
    const password=loginPassword.value;

    if(!username||!email||!password){
        alert('Fyll i användarnamn, e-post och lösenord.');
        return;
    }

    if(username.length<3){
        alert('Användarnamnet måste vara minst 3 tecken.');
        return;
    }

    if(password.length<6){
        alert('Lösenordet måste vara minst 6 tecken.');
        return;
    }

    registerButton.disabled=true;
    registerButton.textContent='Creating account...';

    const {data,error}=await supabaseClient.auth.signUp({
        email:email,
        password:password,
        options:{
            data:{
                username:username
            }
        }
    });

    if(error){
        console.error('Registration error:',error);
        alert(error.message);
        registerButton.disabled=false;
        registerButton.textContent='Create account';
        return;
    }

    if(data.session){
        // The auth trigger handle_new_user creates the profile from signup metadata.
        await updateAuthUI();
    }else{
        alert('Kontot är skapat. Kontrollera din e-post för att bekräfta kontot.');
    }

    registerButton.disabled=false;
    registerButton.textContent='Create account';
});

logoutButton.addEventListener('click',async function(){
    const {error}=await supabaseClient.auth.signOut();

    if(error){
        console.error('Logout error:',error);
        alert(error.message);
        return;
    }

    profileMenu.classList.remove('open');
    notificationController.closePanel();
    records=[];
    collection.innerHTML='';
    history.replaceState({},'','/');
    await renderCurrentRoute();
});

supabaseClient.auth.onAuthStateChange(function(){
    setTimeout(function(){
        renderCurrentRoute();
    },0);
});

function copyDetailsFromRow(item){
  return {
    discogsReleaseId:item.discogs_release_id||null,
    mediaCondition:item.media_condition||'',
    sleeveCondition:item.sleeve_condition||'',
    country:item.pressing_country||'',
    year:item.pressing_year||'',
    label:item.pressing_label||'',
    catalogNumber:item.catalog_number||'',
    matrixA:item.matrix_runout_a||'',
    matrixB:item.matrix_runout_b||'',
    matrixC:item.matrix_runout_c||'',
    matrixD:item.matrix_runout_d||'',
    matrixE:item.matrix_runout_e||'',
    matrixF:item.matrix_runout_f||'',
    matrixG:item.matrix_runout_g||'',
    matrixH:item.matrix_runout_h||'',
    matchStatus:item.pressing_match_status||''
  };
}

(function(){

var Record=window.GroovyRecord;
var Wikipedia=window.GroovyWikipedia;
var WikipediaAboutController=window.GroovyWikipediaAboutController;
var DetailTracklistController=window.GroovyDetailTracklistController;
var DetailLayoutController=window.GroovyDetailLayoutController;
var Streaming=window.GroovyStreaming;
var NotificationCore=window.GroovyNotificationCore;
var PressingCore=window.GroovyPressingCore;
var RatingCore=window.GroovyRatingCore;
var AlbumRatingController=window.GroovyAlbumRatingController;
var MarketplaceController=window.GroovyMarketplaceController;
var ShelfCore=window.GroovyShelfCore;
var ShelfView=window.GroovyShelfView;
var ShelfController=window.GroovyShelfController;
var LibraryCore=window.GroovyLibraryCore;
if(!Record)throw new Error('GroovyRecord must load before app.js');
if(!Wikipedia)throw new Error('GroovyWikipedia must load before app.js');
if(!WikipediaAboutController)throw new Error('GroovyWikipediaAboutController must load before app.js');
if(!DetailTracklistController)throw new Error('GroovyDetailTracklistController must load before app.js');
if(!DetailLayoutController)throw new Error('GroovyDetailLayoutController must load before app.js');
if(!Streaming)throw new Error('GroovyStreaming must load before app.js');
if(!NotificationCore)throw new Error('GroovyNotificationCore must load before app.js');
if(!PressingCore)throw new Error('GroovyPressingCore must load before app.js');
if(!RatingCore)throw new Error('GroovyRatingCore must load before app.js');
if(!AlbumRatingController)throw new Error('GroovyAlbumRatingController must load before app.js');
if(!MarketplaceController)throw new Error('GroovyMarketplaceController must load before app.js');
if(!ShelfCore)throw new Error('GroovyShelfCore must load before app.js');
if(!ShelfView)throw new Error('GroovyShelfView must load before app.js');
if(!ShelfController)throw new Error('GroovyShelfController must load before app.js');
if(!LibraryCore)throw new Error('GroovyLibraryCore must load before app.js');

window.records = [];
window.viewedUserId=null;
window.hasAuthenticatedUser=false;
window.loginRequiredForViewedCollection=false;
window.profileNotFound=false;
window.collectionLoadVersion=0;
window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);

window.albumIdentityKey=GroovyRouteState.albumIdentityKey;

window.emptyRecordSides=Record.emptySides;
var wishlistRecord=Record.fromWishlist;

window.loadWishlist=async function(userId){
  var loadVersion=++window.collectionLoadVersion;
  var {data,error}=await supabaseClient
    .from('wishlists')
    .select(`
      id,
      added_at,
      sort_order,
      cover_url,
      discogs_style,
      albums(
        id,
        title,
        release_year,
        genre,
        cover_url,
        apple_collection_url,
        discogs_master_id,
        artists(id,name),
        tracks(id,disc_side,track_number,title)
      )
    `)
    .eq('user_id',userId)
    .order('sort_order',{ascending:true,nullsFirst:false})
    .order('added_at',{ascending:true});

  if(error){
    console.error('Kunde inte hämta önskelistan:',error);
    return;
  }

  if(loadVersion!==window.collectionLoadVersion)return;

  records=(data||[])
    .filter(function(item){return item.albums;})
    .map(wishlistRecord);

  document.getElementById('collectionCount').textContent=records.length+' RECORDS ON WISHLIST';
  buildGrid();
  refreshLibraryStyles(data,loadVersion);
}

async function renderOwnLibraryHeader(user){
  var viewedUserHeader=document.getElementById('viewedUserHeader');
  var viewedUserAvatar=document.getElementById('viewedUserAvatar');
  var viewedUserName=document.getElementById('viewedUserName');
  var viewedUserContext=document.getElementById('viewedUserContext');

  viewedUserHeader.dataset.own='true';
  viewedUserHeader.style.display='flex';
  if(viewedUserFollowButton)viewedUserFollowButton.style.display='none';

  var avatarUrl='/assets/images/avatar-placeholder.png';
  try{
    var profileResult=await supabaseClient
      .from('profiles')
      .select('username,avatar_url')
      .eq('id',user.id)
      .maybeSingle();
    if(!profileResult.error&&profileResult.data&&profileResult.data.avatar_url)avatarUrl=profileResult.data.avatar_url;
  }catch(error){
    console.warn('Kunde inte hämta profilbild för egen hylla:',error);
  }

  viewedUserAvatar.style.backgroundImage='url("'+avatarUrl+'")';
  viewedUserAvatar.style.backgroundSize='cover';
  viewedUserAvatar.style.backgroundPosition='center';
  viewedUserName.textContent='Your Shelf';
  viewedUserContext.textContent=window.libraryView==='wishlist'?'Wishlist':'Collection';
  window.groovyViewedStatisticsProfile={
    id:user.id,
    username:profileResult&&!profileResult.error&&profileResult.data&&profileResult.data.username
      ?profileResult.data.username
      :(user.user_metadata&&user.user_metadata.username?user.user_metadata.username:''),
    avatar_url:avatarUrl
  };
  if(typeof window.groovySyncViewedProfileButtonLabel==='function')window.groovySyncViewedProfileButtonLabel(true);
  viewedUserShelfButton.classList.toggle('active',window.libraryView!=='wishlist');
  viewedUserWishlistButton.classList.toggle('active',window.libraryView==='wishlist');
  viewedUserShelfButton.setAttribute('aria-current',window.libraryView!=='wishlist'?'page':'false');
  viewedUserWishlistButton.setAttribute('aria-current',window.libraryView==='wishlist'?'page':'false');
}


window.loadCollection=async function(){
  var path=window.location.pathname;

  if(/^\/(?:user|shelf)\/[^\/]+\/?$/.test(path)){
    return;
  }

  var loadVersion=++window.collectionLoadVersion;

  viewedUserId=null;
  window.loginRequiredForViewedCollection=false;
  window.profileNotFound=false;
  var ownHeader=document.getElementById('viewedUserHeader');
  ownHeader.style.display='none';
  ownHeader.dataset.own='false';
  if(typeof window.groovySyncViewedProfileButtonLabel==='function')window.groovySyncViewedProfileButtonLabel(false);
  if(viewedUserFollowButton)viewedUserFollowButton.style.display='none';
    
  var {data:{session}}=await supabaseClient.auth.getSession();
  window.hasAuthenticatedUser=!!(session&&session.user);

  if(!session||!session.user){
    records=[];
    buildGrid();
    return;
  }

  var user=session.user;
  await renderOwnLibraryHeader(user);

  if(window.libraryView==='wishlist'){
    await window.loadWishlist(user.id);
    return;
  }

  await window.loadShelvesForUser(user.id);

  var {data:collectionData,error:collectionError}=await supabaseClient
    .from('collections')
    .select(`
      id,
      collection_number,
      sort_order,
      shelf_id,
      shelf_sort_order,
      cover_url,
      discogs_style,
      discogs_release_id,
      media_condition,
      sleeve_condition,
      pressing_country,
      pressing_year,
      pressing_label,
      catalog_number,
      matrix_runout_a,
      matrix_runout_b,
      matrix_runout_c,
      matrix_runout_d,
      matrix_runout_e,
      matrix_runout_f,
      matrix_runout_g,
      matrix_runout_h,
      pressing_match_status,
      albums(
        id,
        title,
        release_year,
        genre,
        cover_url,
        apple_collection_url,
        discogs_master_id,
        artists(
          id,
          name
        ),
        tracks(
          id,
          disc_side,
          track_number,
          title
        )
      )
    `)
    .eq('user_id',user.id)
    .order('sort_order',{ascending:true});

    if(collectionError){
        console.error('Kunde inte hämta samlingen:',collectionError);
        return;
    }


    
  var albumIds=collectionData.map(function(item){
    return item.albums&&item.albums.id;
  }).filter(Boolean);

  var ratingMeta=await ratingController.loadData(albumIds,user.id);

  if(loadVersion!==window.collectionLoadVersion)return;

  records=collectionData
    .filter(function(item){return item.albums;})
    .map(function(item,index){
      return Record.applyRatingMeta(
        Record.fromCollection(item,index,copyDetailsFromRow(item)),
        ratingMeta
      );
    });

  document.getElementById('collectionCount').textContent=records.length+' RECORDS IN COLLECTION';
  buildGrid();
  refreshLibraryStyles(collectionData,loadVersion);
}

var collection=document.getElementById('collection');
var filterButton=document.getElementById('filterButton');
var filterMenu=document.getElementById('filterMenu');
var albumOverlay=document.getElementById('albumOverlay');
var albumClose=document.getElementById('albumClose');
var detailCover=document.getElementById('detailCover');
var detailNumber=document.getElementById('detailNumber');
var detailArtist=document.getElementById('detailArtist');
var detailAlbum=document.getElementById('detailAlbum');
var detailYear=document.getElementById('detailYear');
var detailGenre=document.getElementById('detailGenre');
var detailRating=document.getElementById('detailRating');
var ratingController=AlbumRatingController.create({
  api:supabaseClient,
  ratingCore:RatingCore,
  recordModel:Record,
  detailElement:detailRating,
  collectionElement:collection,
  getRecords:function(){return records;},
  escapeHtml:function(value){return esc(value==null?'':String(value));},
  onAlert:function(message){alert(message);},
  onRatingUpdated:function(detail){
    window.dispatchEvent(new CustomEvent('groovy-rating-updated',{detail:detail}));
  },
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});
window.loadAlbumRatingData=ratingController.loadData;
window.applyAlbumRatingMeta=Record.applyRatingMeta;
var detailTracks=document.getElementById('detailTracks');
var detailAboutAlbum=document.getElementById('detailAboutAlbum');
var detailInfoCard=document.querySelector('.detail-info-card');
var detailLayoutController=DetailLayoutController.create({
  window:window,
  document:document,
  elements:{
    detail:albumOverlay?albumOverlay.querySelector('.album-detail'):null,
    tracksPanel:albumOverlay?albumOverlay.querySelector('.album-tracks'):null,
    marketplacePanel:albumOverlay?albumOverlay.querySelector('.marketplace-panel'):null,
    about:detailAboutAlbum,
    infoCard:detailInfoCard
  }
});
var wikipediaAboutController=WikipediaAboutController.create({
  service:Wikipedia,
  recordModel:Record,
  window:window,
  document:document,
  elements:{
    root:detailAboutAlbum,
    text:document.getElementById('detailAboutAlbumText'),
    body:document.getElementById('detailAboutAlbumBody'),
    toggle:document.getElementById('detailAboutAlbumToggle'),
    link:document.getElementById('detailAboutAlbumLink')
  },
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var traderaButton=document.getElementById('traderaButton');
var traderaButtonLabel=document.getElementById('traderaButtonLabel');
var traderaModal=document.getElementById('traderaModal');
var closeTraderaModalButton=document.getElementById('closeTraderaModal');
var traderaModalSubtitle=document.getElementById('traderaModalSubtitle');
var traderaListingsStatus=document.getElementById('traderaListingsStatus');
var traderaListingsGrid=document.getElementById('traderaListingsGrid');
var ebayButton=document.getElementById('ebayButton');
var ebayButtonLabel=document.getElementById('ebayButtonLabel');
var ebayModal=document.getElementById('ebayModal');
var closeEbayModalButton=document.getElementById('closeEbayModal');
var ebayModalSubtitle=document.getElementById('ebayModalSubtitle');
var ebayListingsStatus=document.getElementById('ebayListingsStatus');
var ebayListingsGrid=document.getElementById('ebayListingsGrid');
var marketplaceCurrencySelect=document.getElementById('marketplaceCurrencySelect');
var marketplacePriceSummary=document.getElementById('marketplacePriceSummary');
var marketplaceLowestPriceLink=document.getElementById('marketplaceLowestPriceLink');
var marketplaceLowestPrice=document.getElementById('marketplaceLowestPrice');
var marketplaceLowestMeta=document.getElementById('marketplaceLowestMeta');
var marketplacePriceStatus=document.getElementById('marketplacePriceStatus');
var marketplacePriceNote=document.getElementById('marketplacePriceNote');
var copyDetails=document.getElementById('copyDetails');
var copyDetailsContent=document.getElementById('copyDetailsContent');
var copyDetailsToggle=document.getElementById('copyDetailsToggle');
var copyDetailsSummary=document.getElementById('copyDetailsSummary');
var copyDetailsSaved=document.getElementById('copyDetailsSaved');
var pressingModal=document.getElementById('pressingModal');
var closePressingModalButton=document.getElementById('closePressingModal');
var pressingLoading=document.getElementById('pressingLoading');
var pressingForm=document.getElementById('pressingForm');
var pressingError=document.getElementById('pressingError');
var pressingCountry=document.getElementById('pressingCountry');
var pressingYear=document.getElementById('pressingYear');
var pressingLabel=document.getElementById('pressingLabel');
var pressingCatalogNumber=document.getElementById('pressingCatalogNumber');
var pressingMatrixSearch=document.getElementById('pressingMatrixSearch');
var pressingMatrixQuery=document.getElementById('pressingMatrixQuery');
var pressingMatrixSearchButton=document.getElementById('pressingMatrixSearchButton');
var pressingMatches=document.getElementById('pressingMatches');

var selectedRating='all';
var suppressAlbumClick=false;
var copyDetailsExpanded=false;
var copyDetailsRecordKey='';
var libraryPage=1;
var RECORDS_PER_PAGE=52;
var libraryPaginationTop=document.getElementById('libraryPaginationTop');
var libraryPaginationBottom=document.getElementById('libraryPaginationBottom');
var librarySearchInput=document.getElementById('librarySearchInput');
var librarySortButton=document.getElementById('librarySortButton');
var librarySortMenu=document.getElementById('librarySortMenu');
var mobileAddRecordButton=document.getElementById('mobileAddRecordButton');
var librarySearchQuery='';
var librarySort='added';
var refreshedStyleMasters=new Set();

var shelves=[];
var activeShelfId='all';
var SHELF_COLORS=['#E85301','#FF3B45','#FF6B4A','#F43F8C','#8B5CF6','#6366F1','#3B82F6','#14B8D4','#10B981','#84CC16','#F5C542','#6B7280','#14B8A6','#F59E0B'];
var MAX_SHELVES=10;

var shelfStrip=document.getElementById('shelfStrip');
var shelfStripViewport=document.getElementById('shelfStripViewport');
var shelfStripScroll=document.getElementById('shelfStripScroll');
var shelfScrollLeft=document.getElementById('shelfScrollLeft');
var shelfScrollRight=document.getElementById('shelfScrollRight');
var editShelfButton=document.getElementById('editShelfButton');
var deleteShelfButton=document.getElementById('deleteShelfButton');
var deleteShelfModal=document.getElementById('deleteShelfModal');
var closeDeleteShelfButton=document.getElementById('closeDeleteShelf');
var cancelDeleteShelfButton=document.getElementById('cancelDeleteShelf');
var confirmDeleteShelfButton=document.getElementById('confirmDeleteShelf');
var deleteShelfMessage=document.getElementById('deleteShelfMessage');
var deleteShelfStatus=document.getElementById('deleteShelfStatus');
var createShelfModal=document.getElementById('createShelfModal');
var createShelfTitle=document.getElementById('createShelfTitle');
var createShelfDescription=document.getElementById('createShelfDescription');
var closeCreateShelfButton=document.getElementById('closeCreateShelf');
var cancelCreateShelfButton=document.getElementById('cancelCreateShelf');
var confirmCreateShelfButton=document.getElementById('confirmCreateShelf');
var shelfNameInput=document.getElementById('shelfNameInput');
var shelfIconChoices=document.getElementById('shelfIconChoices');
var shelfColorChoices=document.getElementById('shelfColorChoices');
var createShelfStatus=document.getElementById('createShelfStatus');
var shelfPickerModal=document.getElementById('shelfPickerModal');
var closeShelfPickerButton=document.getElementById('closeShelfPicker');
var cancelShelfPickerButton=document.getElementById('cancelShelfPicker');
var confirmShelfPickerButton=document.getElementById('confirmShelfPicker');
var createShelfFromPickerButton=document.getElementById('createShelfFromPicker');
var shelfPickerList=document.getElementById('shelfPickerList');
var shelfPickerSubtitle=document.getElementById('shelfPickerSubtitle');
var shelfPickerStatus=document.getElementById('shelfPickerStatus');
var shelfPickerTitle=document.getElementById('shelfPickerTitle');
var detailShelfActions=document.getElementById('detailShelfActions');
var detailShelfStatus=document.getElementById('detailShelfStatus');
var detailSocialContext=document.getElementById('detailSocialContext');
var detailOpenRecordIndex=-1;
var detailTracklistController=DetailTracklistController.create({
  api:supabaseClient,
  recordModel:Record,
  pressingCore:PressingCore,
  element:detailTracks,
  storage:localStorage,
  escapeHtml:function(value){return esc(value==null?'':String(value));},
  getOpenRecordIndex:function(){return detailOpenRecordIndex;},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});
var detailSocialController=DetailSocialController.create({
  api:supabaseClient,
  window:window,
  document:document,
  element:detailSocialContext,
  getCurrentUser:currentSessionUser,
  getViewedUserId:function(){return viewedUserId;},
  getLibraryView:function(){return window.libraryView;},
  getOpenRecordIndex:function(){return detailOpenRecordIndex;},
  escapeHtml:function(value){return esc(value==null?'':String(value));},
  onNavigate:function(username){closeAlbum();openCollectorRoute(username,'profile');},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

function shelfIconSvg(icon){
  return ShelfCore.iconSvg(icon);
}


function shelfById(id){
  return ShelfCore.findById(shelves,id);
}

function shelfRecordCount(id){
  return ShelfCore.recordCount(records,id);
}

var recordMenuBackdrop=document.createElement('div');
recordMenuBackdrop.className='record-menu-backdrop';
recordMenuBackdrop.setAttribute('aria-hidden','true');
document.body.appendChild(recordMenuBackdrop);

function isMobileRecordMenu(){
  return window.matchMedia&&window.matchMedia('(max-width: 760px)').matches;
}

var shelfController=ShelfController.create({
  elements:{
    strip:shelfStrip,stripViewport:shelfStripViewport,stripScroll:shelfStripScroll,scrollLeft:shelfScrollLeft,scrollRight:shelfScrollRight,
    editButton:editShelfButton,deleteButton:deleteShelfButton,deleteModal:deleteShelfModal,closeDelete:closeDeleteShelfButton,cancelDelete:cancelDeleteShelfButton,confirmDelete:confirmDeleteShelfButton,deleteMessage:deleteShelfMessage,deleteStatus:deleteShelfStatus,
    createModal:createShelfModal,createTitle:createShelfTitle,createDescription:createShelfDescription,closeCreate:closeCreateShelfButton,cancelCreate:cancelCreateShelfButton,confirmCreate:confirmCreateShelfButton,nameInput:shelfNameInput,iconChoices:shelfIconChoices,colorChoices:shelfColorChoices,createStatus:createShelfStatus,
    pickerModal:shelfPickerModal,closePicker:closeShelfPickerButton,cancelPicker:cancelShelfPickerButton,confirmPicker:confirmShelfPickerButton,createFromPicker:createShelfFromPickerButton,pickerList:shelfPickerList,pickerSubtitle:shelfPickerSubtitle,pickerStatus:shelfPickerStatus,pickerTitle:shelfPickerTitle,
    detailActions:detailShelfActions,detailStatus:detailShelfStatus
  },
  colors:SHELF_COLORS,maxShelves:MAX_SHELVES,api:supabaseClient,recordModel:Record,
  getShelves:function(){return shelves;},setShelves:function(value){shelves=value;},
  getActiveShelfId:function(){return activeShelfId;},setActiveShelfId:function(value){activeShelfId=value||'all';},
  getRecords:function(){return records;},getViewedUserId:function(){return viewedUserId;},getLibraryView:function(){return window.libraryView;},
  getDetailOpenRecordIndex:function(){return detailOpenRecordIndex;},getSessionUser:currentSessionUser,
  shouldHideStrip:function(){return window.libraryView==='wishlist'||window.loginRequiredForViewedCollection||window.profileNotFound||(!window.hasAuthenticatedUser&&viewedUserId===null);},
  onLibraryPageReset:function(){libraryPage=1;},onGridChange:function(){buildGrid();},isMobile:isMobileRecordMenu,
  requestFrame:function(callback){return requestAnimationFrame(callback);},alert:function(message){alert(message);}
});

function closeRecordActionMenus(){
  document.querySelectorAll('.record-action-menu.open').forEach(function(menu){
    menu.classList.remove('open');
    menu.classList.remove('mobile-record-menu');
    menu.style.left='';
    menu.style.right='';
    menu.style.top='';
    menu.style.bottom='';
    menu.style.width='';
    menu.style.maxHeight='';
    menu.style.overflowY='';
    menu.style.visibility='';

    if(menu._groovyMenuHome){
      menu._groovyMenuHome.appendChild(menu);
      menu._groovyMenuHome=null;
    }
  });
  collection.querySelectorAll('.record-menu-button[aria-expanded="true"]').forEach(function(button){
    button.setAttribute('aria-expanded','false');
  });
  collection.querySelectorAll('.record-card-topbar.record-menu-open').forEach(function(topbar){
    topbar.classList.remove('record-menu-open');
  });
  recordMenuBackdrop.classList.remove('open');
}

function positionMobileRecordMenu(button,menu){
  if(!isMobileRecordMenu())return;

  var viewportWidth=window.innerWidth||document.documentElement.clientWidth;
  var viewportHeight=window.innerHeight||document.documentElement.clientHeight;
  var menuWidth=Math.min(156,viewportWidth-16);
  var buttonRect=button.getBoundingClientRect();
  var availableBelow=Math.max(44,viewportHeight-buttonRect.bottom-13);

  menu.style.width=menuWidth+'px';
  menu.style.right='auto';
  menu.style.bottom='auto';
  menu.style.maxHeight=Math.floor(availableBelow)+'px';
  menu.style.overflowY='auto';
  menu.style.visibility='hidden';

  var left=Math.max(8,Math.min(viewportWidth-menuWidth-8,buttonRect.right-menuWidth));
  menu.style.left=Math.round(left)+'px';
  menu.style.top=Math.round(buttonRect.bottom+5)+'px';
  menu.style.visibility='';
}

recordMenuBackdrop.addEventListener('click',function(event){
  event.preventDefault();
  event.stopPropagation();
  closeRecordActionMenus();
});

recordMenuBackdrop.addEventListener('touchmove',function(){
  closeRecordActionMenus();
},{passive:true});

function updateShelfScrollArrows(){return shelfController.updateScrollArrows();}


function renderShelfStrip(){return shelfController.renderStrip();}
window.renderShelfStrip=renderShelfStrip;
window.loadShelvesForUser=function(userId){return shelfController.loadForUser(userId);};


function openCreateShelfModal(index){return shelfController.openCreate(index);}
function closeCreateShelfModal(){return shelfController.closeCreate();}
function openEditShelfModal(){return shelfController.openEdit();}
function openShelfPicker(index){return shelfController.openPicker(index);}
function closeShelfPicker(){return shelfController.closePicker();}
function renderShelfPicker(index){return shelfController.renderPicker(index);}
function renderDetailShelfStatus(index){return shelfController.renderDetailStatus(index);}
function renderDetailShelfActions(index){return shelfController.renderDetailActions(index);}
function assignRecordToShelf(index,shelfId){return shelfController.assignRecord(index,shelfId);}
function openDeleteShelfModal(){return shelfController.openDelete();}
function closeDeleteShelfModal(){return shelfController.closeDelete();}
function deleteActiveShelf(){return shelfController.deleteActive();}


function attachRecordActionMenus(){
  var menuButtons=collection.querySelectorAll('.record-menu-button');

  menuButtons.forEach(function(button){
    button.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      var topbar=button.parentElement;
      var menu=topbar.querySelector('.record-action-menu');
      var opening=!menu.classList.contains('open');

      closeRecordActionMenus();
      if(!opening)return;

      var recordElement=button.closest('.record');
      if(recordElement)menu.setAttribute('data-record-index',recordElement.getAttribute('data-index')||'');

      menu.classList.add('open');
      button.setAttribute('aria-expanded','true');
      topbar.classList.add('record-menu-open');

      if(isMobileRecordMenu()){
        menu._groovyMenuHome=topbar;
        document.body.appendChild(menu);
        menu.classList.add('mobile-record-menu');
        recordMenuBackdrop.classList.add('open');
        positionMobileRecordMenu(button,menu);
      }
    });
  });

  collection.querySelectorAll('.record-action-item').forEach(function(button){
    button.addEventListener('click',async function(event){
      event.preventDefault();
      event.stopPropagation();
      var menu=button.closest('.record-action-menu');
      var recordElement=button.closest('.record');
      var index=menu?parseInt(menu.getAttribute('data-record-index'),10):NaN;
      if(isNaN(index)&&recordElement)index=parseInt(recordElement.getAttribute('data-index'),10);
      if(isNaN(index)||!records[index])return;

      var action=button.getAttribute('data-action');
      closeRecordActionMenus();

      if(action==='view'){
        openAlbum(index);
      }else if(action==='shelf'){
        openShelfPicker(index);
      }else if(action==='unshelf'){
        try{
          await assignRecordToShelf(index,null);
        }catch(error){
          console.error('Kunde inte ta bort albumet från shelf:',error);
          alert('Could not remove the record from the shelf.\n\n'+(error.message||error));
        }
      }else if(action==='delete'){
        removeAlbumIndex=index;
        document.getElementById('removeAlbumMessage').textContent='Are you sure you want to remove "'+records[index][2]+'" from your collection?';
        document.getElementById('removeAlbumModal').style.display='flex';
      }
    });
  });
}



document.addEventListener('click',function(event){
  if(!event.target.closest('.record-menu-button')&&!event.target.closest('.record-action-menu'))closeRecordActionMenus();
});

window.addEventListener('resize',function(){
  closeRecordActionMenus();
  updateShelfScrollArrows();
},{passive:true});

window.addEventListener('scroll',function(){
  if(recordMenuBackdrop.classList.contains('open'))closeRecordActionMenus();
},{passive:true});

function esc(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

var discogsStyleLabel=PressingCore.discogsStyleLabel;
window.discogsStyleLabel=discogsStyleLabel;

async function refreshLibraryStyles(rows,loadVersion){
  var styleTableAtLoad=window.libraryView==='wishlist'?'wishlists':'collections';
  var canPersistStyles=viewedUserId===null;
  var candidates=(rows||[]).filter(function(item){
    var album=item&&item.albums;
    var masterId=album&&String(album.discogs_master_id||'');
    var refreshKey=styleTableAtLoad+':'+String(item&&item.id||'');
    if(!album||!masterId||!item.id||refreshedStyleMasters.has(refreshKey))return false;

    var storageKey='groovy-style-v2-refresh-'+refreshKey;
    try{
      var refreshedAt=parseInt(localStorage.getItem(storageKey),10)||0;
      if(Date.now()-refreshedAt<30*24*60*60*1000){
        refreshedStyleMasters.add(refreshKey);
        return false;
      }
    }catch(error){}

    refreshedStyleMasters.add(refreshKey);
    return true;
  });

  if(!candidates.length)return;
  var changed=false;
  var nextIndex=0;

  async function refreshNext(){
    while(nextIndex<candidates.length){
      var item=candidates[nextIndex++];
      var album=item.albums;
      var masterId=String(album.discogs_master_id||'');
      var refreshKey=styleTableAtLoad+':'+String(item.id);
      var shouldCache=true;
      try{
        var response=await supabaseClient.functions.invoke('discogs-search',{body:{action:'master',masterId:masterId}});
        if(response.error)throw response.error;
        var style=window.discogsStyleLabel(response.data||{});
        if(style){
          if(style!==item.discogs_style&&canPersistStyles){
            var updateResult=await supabaseClient.from(styleTableAtLoad)
              .update({discogs_style:style})
              .eq('id',item.id);
            if(updateResult.error){
              shouldCache=false;
              console.warn('Could not refresh Discogs styles:',updateResult.error);
            }
            else item.discogs_style=style;
          }
          if(loadVersion===window.collectionLoadVersion){
            records.forEach(function(record){
              if(record[8]===album.id&&record[4]!==style){record[4]=style;changed=true;}
            });
          }
        }
        if(shouldCache){
          try{localStorage.setItem('groovy-style-v2-refresh-'+refreshKey,String(Date.now()));}catch(error){}
        }
      }catch(error){
        console.warn('Could not load updated Discogs styles for '+masterId+':',error);
      }
    }
  }

  await Promise.all([refreshNext(),refreshNext(),refreshNext()]);
  if(changed&&loadVersion===window.collectionLoadVersion)buildGrid();
}
window.refreshLibraryStyles=refreshLibraryStyles;

var marketplaceController=MarketplaceController.create({
  elements:{
    traderaButton:traderaButton,
    traderaButtonLabel:traderaButtonLabel,
    traderaModal:traderaModal,
    closeTraderaModalButton:closeTraderaModalButton,
    traderaModalSubtitle:traderaModalSubtitle,
    traderaListingsStatus:traderaListingsStatus,
    traderaListingsGrid:traderaListingsGrid,
    ebayButton:ebayButton,
    ebayButtonLabel:ebayButtonLabel,
    ebayModal:ebayModal,
    closeEbayModalButton:closeEbayModalButton,
    ebayModalSubtitle:ebayModalSubtitle,
    ebayListingsStatus:ebayListingsStatus,
    ebayListingsGrid:ebayListingsGrid,
    currencySelect:marketplaceCurrencySelect,
    priceSummary:marketplacePriceSummary,
    lowestPriceLink:marketplaceLowestPriceLink,
    lowestPrice:marketplaceLowestPrice,
    lowestMeta:marketplaceLowestMeta,
    priceStatus:marketplacePriceStatus,
    priceNote:marketplacePriceNote
  },
  api:supabaseClient,
  storage:localStorage,
  navigator:navigator,
  Intl:Intl,
  getRecord:function(index){return records[index]||null;},
  getArtist:function(record){return Record.artist(record);},
  getTitle:function(record){return Record.title(record);},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

function hasCopyDetails(details){return PressingView.hasCopyDetails(details);}
function recordConditionMeta(value){return PressingView.conditionMeta(value);}

function setCopyDetailsExpanded(expanded){
  copyDetailsExpanded=!!expanded;
  PressingView.setExpanded({root:copyDetails,toggle:copyDetailsToggle,content:copyDetailsContent},copyDetailsExpanded);
}

copyDetailsToggle.addEventListener('click',function(){
  setCopyDetailsExpanded(!copyDetailsExpanded);
});

function renderCopyDetails(index){
  var record=records[index];
  var result=PressingView.renderCopyDetails({
    hasRecord:!!record,
    isWishlist:window.libraryView==='wishlist',
    isOwner:viewedUserId===null,
    details:record&&record[11]?record[11]:{},
    recordKey:record?String(record[9]||('record-'+index)):'',
    previousRecordKey:copyDetailsRecordKey,
    expanded:copyDetailsExpanded,
    elements:{
      root:copyDetails,
      content:copyDetailsContent,
      toggle:copyDetailsToggle,
      summary:copyDetailsSummary,
      saved:copyDetailsSaved
    },
    onIdentifyPressing:function(){openPressingPicker(index);},
    onConditionChange:function(){saveConditionDetails(index);}
  });
  copyDetailsExpanded=result.expanded;
  copyDetailsRecordKey=result.recordKey;
}

async function saveConditionDetails(index){
  var record=records[index];
  if(!record||viewedUserId!==null)return;

  var mediaSelect=document.getElementById('mediaConditionSelect');
  var sleeveSelect=document.getElementById('sleeveConditionSelect');
  if(!mediaSelect||!sleeveSelect)return;

  var media=mediaSelect.value||null;
  var sleeve=sleeveSelect.value||null;
  mediaSelect.disabled=true;
  sleeveSelect.disabled=true;
  copyDetailsSaved.textContent='Saving…';

  var {data:{user},error:userError}=await supabaseClient.auth.getUser();
  var result=(userError||!user)?{error:userError||new Error('Du måste vara inloggad.')}:await supabaseClient
    .from('collections')
    .update({media_condition:media,sleeve_condition:sleeve})
    .eq('id',record[9])
    .eq('user_id',user.id)
    .select('id');

  if(result.error||!result.data||!result.data.length){
    console.error('Kunde inte spara skicket:',result.error);
    copyDetailsSaved.textContent='Could not save';
    mediaSelect.disabled=false;
    sleeveSelect.disabled=false;
    return;
  }

  record[11]=record[11]||{};
  record[11].mediaCondition=media||'';
  record[11].sleeveCondition=sleeve||'';
  buildGrid();
  renderCopyDetails(index);
  copyDetailsSaved.textContent='Saved';
}

async function fetchPressingVersions(masterId,page){
  var response=await supabaseClient.functions.invoke('discogs-search',{
    body:{action:'versions',masterId:masterId,page:page}
  });
  if(response.error)throw response.error;
  return response.data||{};
}

async function fetchPressingRelease(releaseId){
  var response=await supabaseClient.functions.invoke('discogs-search',{
    body:{action:'release',releaseId:releaseId}
  });
  if(response.error)throw response.error;
  return response.data||{};
}

async function savePressingSelection(context){
  context=context||{};
  var selected=context.selected||{};
  var matrices=context.matrices||{};
  var button=context.button;
  var index=context.albumIndex;
  var record=records[index];
  if(!record)return;

  if(button){button.disabled=true;button.textContent='Saving…';}
  var userResult=await supabaseClient.auth.getUser();
  var user=userResult&&userResult.data&&userResult.data.user;
  var payload={
    discogs_release_id:parseInt(selected.id,10),
    pressing_country:selected.country||null,
    pressing_year:parseInt(selected.year,10)||null,
    pressing_label:selected.label||null,
    catalog_number:selected.catalogNumber||null,
    matrix_runout_a:matrices.A||null,
    matrix_runout_b:matrices.B||null,
    matrix_runout_c:matrices.C||null,
    matrix_runout_d:matrices.D||null,
    matrix_runout_e:matrices.E||null,
    matrix_runout_f:matrices.F||null,
    matrix_runout_g:matrices.G||null,
    matrix_runout_h:matrices.H||null,
    pressing_match_status:'discogs'
  };
  var result=(userResult.error||!user)?{error:userResult.error||new Error('Du måste vara inloggad.')}:await supabaseClient.from('collections').update(payload)
    .eq('id',record[9]).eq('user_id',user.id).select('id');

  if(result.error||!result.data||!result.data.length){
    console.error('Kunde inte spara pressningen:',result.error);
    if(button){button.disabled=false;button.textContent='Try saving again';}
    return;
  }

  record[11]=record[11]||{};
  record[11].discogsReleaseId=payload.discogs_release_id;
  record[11].country=payload.pressing_country||'';
  record[11].year=payload.pressing_year||'';
  record[11].label=payload.pressing_label||'';
  record[11].catalogNumber=payload.catalog_number||'';
  record[11].matrixA=payload.matrix_runout_a||'';
  record[11].matrixB=payload.matrix_runout_b||'';
  record[11].matrixC=payload.matrix_runout_c||'';
  record[11].matrixD=payload.matrix_runout_d||'';
  record[11].matrixE=payload.matrix_runout_e||'';
  record[11].matrixF=payload.matrix_runout_f||'';
  record[11].matrixG=payload.matrix_runout_g||'';
  record[11].matrixH=payload.matrix_runout_h||'';
  record[11].matchStatus='discogs';
  if(pressingPicker)pressingPicker.close();
  buildGrid();
  renderCopyDetails(index);
  copyDetailsSaved.textContent='Saved';
}

var pressingPicker=PressingPicker?PressingPicker.create({
  elements:{
    modal:pressingModal,
    closeButton:closePressingModalButton,
    loading:pressingLoading,
    form:pressingForm,
    error:pressingError,
    country:pressingCountry,
    year:pressingYear,
    label:pressingLabel,
    catalogNumber:pressingCatalogNumber,
    matrixSearch:pressingMatrixSearch,
    matrixQuery:pressingMatrixQuery,
    matrixSearchButton:pressingMatrixSearchButton,
    matches:pressingMatches
  },
  getRecord:function(index){return records[index]||null;},
  getMasterId:function(record){return record&&record[10];},
  fetchVersions:fetchPressingVersions,
  fetchRelease:fetchPressingRelease,
  onSave:savePressingSelection,
  onMissingMaster:function(){copyDetailsSaved.textContent='No Discogs master found';},
  onWarning:function(message,error){console.warn(message+':',error);},
  onError:function(message,error){console.error(message+':',error);},
  lockBody:function(){document.body.style.overflow='hidden';},
  unlockBody:function(){if(albumOverlay.className.indexOf('visible')===-1)document.body.style.overflow='';}
}):null;

function openPressingPicker(index){
  if(!pressingPicker){copyDetailsSaved.textContent='Pressing picker unavailable';return false;}
  return pressingPicker.open(index);
}

function closePressingPicker(){
  if(pressingPicker)pressingPicker.close();
}

function spotifyAlbumLink(record){
  return Streaming.spotifySearchUrl(
    record&&Record.artist(record),
    record&&Record.title(record)
  );
}

function appleMusicAlbumLink(record){
  return Streaming.appleMusicSearchUrl(
    record&&Record.artist(record),
    record&&Record.title(record),
    record&&Record.appleUrl(record),
    'se'
  );
}

function recordDisplayNumber(record){
  if(
    window.libraryView!=='wishlist'&&
    activeShelfId!=='all'&&
    String(record&&Record.shelfId(record)||'')===String(activeShelfId)
  ){
    var shelfNumber=parseInt(record&&Record.shelfSortOrder(record),10);
    if(!isNaN(shelfNumber)&&shelfNumber>0)return shelfNumber;
  }

  var allRecordsNumber=parseInt(record&&Record.order(record),10);
  return !isNaN(allRecordsNumber)&&allRecordsNumber>0?allRecordsNumber:'';
}

function recordArrayIndex(record){
  return records.indexOf(record);
}

function recordHTML(record, className){
  var smallSrc=Record.coverUrl(record);
  var isWishlist=window.libraryView==='wishlist';
  var recordIndex=recordArrayIndex(record);
  var displayNumber=recordDisplayNumber(record);
  var copy=Record.pressing(record)||{};
  var condition=!isWishlist?recordConditionMeta(copy.mediaCondition):null;
  var showPressingPrompt=!isWishlist&&viewedUserId===null&&!condition&&!hasCopyDetails(copy);
  var cardShelf=!isWishlist?shelfById(Record.shelfId(record)):null;
  var cardShelfName=cardShelf&&cardShelf.name?cardShelf.name:'';
  var cardShelfIcon=cardShelf?shelfIconSvg(cardShelf.icon):'';
  var cardShelfStatus=cardShelf
    ?'<span class="record-shelf-status" title="'+esc(cardShelfName)+'">'+
       (cardShelfIcon?'<span class="record-shelf-status-icon" aria-hidden="true">'+cardShelfIcon+'</span>':'')+
       '<strong>'+esc(cardShelfName)+'</strong>'+
     '</span>'
    :'';
  var removeButton=viewedUserId===null
    ?(isWishlist
      ?'<button class="wishlist-remove-button" type="button" aria-label="Remove from wishlist">×</button>'
      :'<button class="record-menu-button" type="button" aria-label="Record menu" aria-expanded="false">•••</button>'+
       '<div class="record-action-menu">'+
         '<button class="record-action-item" type="button" data-action="view">View Record</button>'+
         '<button class="record-action-item" type="button" data-action="shelf">'+(Record.shelfId(record)?'Move to Shelf':'Add to Shelf')+'</button>'+
         (Record.shelfId(record)?'<button class="record-action-item" type="button" data-action="unshelf">Remove from Shelf</button>':'')+
         '<button class="record-action-item danger" type="button" data-action="delete">Delete Record</button>'+
       '</div>')
    :'';

  var html='<article class="record '+(isWishlist?'wishlist-record ':'')+(className||'')+'" draggable="false" data-index="'+recordIndex+'">'+
    '<div class="record-card-topbar"><span class="number">'+displayNumber+'</span>'+cardShelfStatus+removeButton+'</div>'+
    '<div class="cover-wrapper">'+
      '<img class="cover" draggable="false" loading="lazy" decoding="async" src="" data-src="'+esc(smallSrc)+'" alt="'+esc(Record.artist(record)+' - '+Record.title(record))+'">'+
    '</div>'+
    '<div class="info">'+
      '<div class="record-heading-row"><div class="album">'+esc(Record.title(record))+'</div></div>'+
      '<div class="artist">'+esc(Record.artist(record))+'</div>'+
      '<div class="record-meta-row"><span class="year">'+esc(Record.year(record))+'</span>'+
      (condition?'<span class="record-condition-badge condition-'+condition.className+'" title="Record condition: '+esc(condition.label)+'">'+esc(copy.mediaCondition)+'</span>':'')+
      (showPressingPrompt?'<span class="pressing-prompt-badge" title="Add pressing details">Add pressing</span>':'')+
      '<span class="cover-rating">';

  if(isWishlist){
    html+='<span class="wishlist-cover-label"><span class="wishlist-icon" aria-hidden="true"></span>Wishlisted</span>';
  }else{
    html+='<span class="cover-rating-inner">'+ratingController.renderStaticStarMeter(Record.communityRating(record)||0,'is-compact')+'<span class="cover-rating-number">'+esc(ratingController.formatCommunityRating(Record.communityRating(record)||0))+'</span></span>';
  }

  html+='</span></div></div>'+
    (isWishlist&&viewedUserId===null
      ?'<button class="move-to-collection-button" type="button"><span class="record-icon" aria-hidden="true"></span>Add to collection</button>'
      :'')+
    '<div class="record-card-footer">'+
    
        '<a class="streaming-link streaming-service apple-service" '+
            'href="'+esc(appleMusicAlbumLink(record))+'" '+
            'target="_blank" rel="noopener noreferrer" '+
            'aria-label="Listen to '+esc(Record.title(record))+' by '+esc(Record.artist(record))+' on Apple Music">'+
            '<img class="apple-music-small-badge" '+
                'src="/assets/brands/apple-music-badge-small.svg" '+
                'alt="Listen on Apple Music">'+
        '</a>'+
    
        '<a class="streaming-link streaming-service spotify-service" '+
            'href="'+esc(spotifyAlbumLink(record))+'" '+
            'target="_blank" rel="noopener noreferrer" '+
            'aria-label="Listen to '+esc(Record.title(record))+' by '+esc(Record.artist(record))+' on Spotify">'+
            '<img class="spotify-service-logo" '+
                'src="/assets/brands/spotify-full-logo-green.svg" '+
                'alt="Spotify">'+
        '</a>'+
    
    '</div>'+
  '</article>';

  return html;
}

function loadVisibleImages(){
  var images=document.querySelectorAll('.cover');
  var height=window.innerHeight||600;
  var width=window.innerWidth||1024;
  var verticalMargin=450;
  var horizontalMargin=500;

  for(var i=0;i<images.length;i++){
    var img=images[i];
    var dataSrc=img.getAttribute('data-src');
    if(!dataSrc)continue;

    var rect=img.getBoundingClientRect();
    if(rect.top<height+verticalMargin&&rect.bottom>-verticalMargin&&
       rect.left<width+horizontalMargin&&rect.right>-horizontalMargin){
      img.src=dataSrc;
      img.removeAttribute('data-src');
    }
  }
}

function openAlbum(index){
  var record=records[index];
  if(!record)return;

  detailOpenRecordIndex=index;
  marketplaceController.openForRecord(index);
  copyDetailsRecordKey='';
  var isWishlist=window.libraryView==='wishlist';
  detailNumber.hidden=!isWishlist;
  detailNumber.textContent=isWishlist?'Wishlisted':'';
  detailArtist.innerHTML=esc(record[1]);
  detailAlbum.innerHTML=esc(record[2]);
  detailYear.innerHTML=esc(record[3]);
  var genreLabel=record[4]||'Genre saknas';
  detailGenre.textContent=genreLabel;
  detailGenre.setAttribute('data-mobile-genre',genreLabel.split(' · ')[0]||genreLabel);
  renderCopyDetails(index);

  detailCover.src=record[6];
  detailCover.alt=record[1]+' - '+record[2];
  var detailAppleMusicLink=document.getElementById('detailAppleMusicLink');
  var detailSpotifyLink=document.getElementById('detailSpotifyLink');
  if(detailAppleMusicLink){
    detailAppleMusicLink.href=appleMusicAlbumLink(record);
    detailAppleMusicLink.setAttribute('aria-label','Listen to '+record[2]+' by '+record[1]+' on Apple Music');
  }
  detailSpotifyLink.href=spotifyAlbumLink(record);
  detailSpotifyLink.setAttribute('aria-label','Find '+record[2]+' by '+record[1]+' on Spotify');
  wikipediaAboutController.openForRecord(record);

  ratingController.renderDetail(index);
  renderDetailShelfStatus(index);
  renderDetailShelfActions(index);
  detailSocialController.openForRecord(record,index);
  detailTracklistController.openForRecord(record,index);

  albumOverlay.className='album-overlay visible';
  document.body.style.overflow='hidden';
  detailLayoutController.syncOpen();
}

function closeAlbum(){
  wikipediaAboutController.close();
  marketplaceController.close();
  albumOverlay.className='album-overlay';
  document.body.style.overflow='';
  setCopyDetailsExpanded(false);
  copyDetailsRecordKey='';
  detailOpenRecordIndex=-1;
  if(detailShelfActions){detailShelfActions.hidden=true;detailShelfActions.innerHTML='';}
  if(detailShelfStatus){detailShelfStatus.hidden=true;detailShelfStatus.innerHTML='';detailShelfStatus.classList.remove('unshelved');}
  detailSocialController.close();
  if(detailInfoCard)detailInfoCard.style.height='';
  albumOverlay.scrollTop=0;
  var tracksPanel=albumOverlay.querySelector('.album-tracks');
  if(tracksPanel)tracksPanel.scrollTop=0;

  setTimeout(function(){
    if(albumOverlay.className.indexOf('visible')===-1){
      detailCover.src='';
    }
  },350);
}

async function deleteCollectionAlbum(index){
  if(viewedUserId!==null)return;
  var record=records[index];

  if(!record)return;

  var {data:{session}}=await supabaseClient.auth.getSession();
  var user=session&&session.user;

  if(!user){
    alert('Du måste vara inloggad.');
    return;
  }

  var {error}=await supabaseClient.rpc('delete_collection_record',{
    p_collection_id:String(record[9])
  });

  if(error){
    console.error('Kunde inte ta bort albumet:',error);
    alert('Kunde inte ta bort albumet.');
    return;
  }

  invalidateSearchLibraryState();

  var deletedShelfId=record[13]||'';
  records.splice(index,1);
  records
    .slice()
    .sort(function(a,b){return (parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);})
    .forEach(function(item,position){item[0]=position+1;});

  if(deletedShelfId)Record.compactShelfOrder(records,deletedShelfId);

  libraryPage=1;
  renderShelfStrip();
  buildGrid();
}

async function deleteWishlistAlbum(index){
  if(viewedUserId!==null||window.libraryView!=='wishlist')return;
  var record=records[index];
  if(!record)return;

  var {data:{user},error:userError}=await supabaseClient.auth.getUser();
  if(userError||!user){
    alert('Du måste vara inloggad.');
    return;
  }

  var {data:deletedRows,error}=await supabaseClient
    .from('wishlists')
    .delete()
    .eq('id',record[9])
    .eq('user_id',user.id)
    .select('id');

  if(error||!deletedRows||!deletedRows.length){
    console.error('Kunde inte ta bort albumet från önskelistan:',error);
    alert('Kunde inte ta bort albumet från önskelistan.');
    return;
  }

  invalidateSearchLibraryState();
  await window.loadCollection();
}

async function moveWishlistAlbumToCollection(index,button){
  if(viewedUserId!==null||window.libraryView!=='wishlist')return false;
  var record=records[index];
  if(!record)return false;

  var originalText=button.textContent;
  button.textContent='Moving...';
  button.disabled=true;

  try{
    var {data:{user},error:userError}=await supabaseClient.auth.getUser();
    if(userError||!user)throw new Error('Du måste vara inloggad.');

    var {data:existingCollection,error:existingError}=await supabaseClient
      .from('collections')
      .select('id')
      .eq('user_id',user.id)
      .eq('album_id',record[8])
      .limit(1);
    if(existingError)throw existingError;

    var alreadyCollected=!!(existingCollection&&existingCollection.length);

    if(!alreadyCollected){
      var {data:lastCollection,error:lastError}=await supabaseClient
        .from('collections')
        .select('sort_order')
        .eq('user_id',user.id)
        .order('sort_order',{ascending:false})
        .limit(1);
      if(lastError)throw lastError;

      var nextSortOrder=lastCollection&&lastCollection.length
        ?lastCollection[0].sort_order+1
        :1;
      var {error:insertError}=await supabaseClient
        .from('collections')
        .insert({
          user_id:user.id,
          album_id:record[8],
          cover_url:record[6]||null,
          discogs_style:record[4]||null,
          sort_order:nextSortOrder
        });
      if(insertError)throw insertError;
    }

    var {error:deleteError}=await supabaseClient
      .from('wishlists')
      .delete()
      .eq('id',record[9])
      .eq('user_id',user.id);
    if(deleteError)throw deleteError;

    invalidateSearchLibraryState();
    await window.loadCollection();
    return true;
  }catch(error){
    console.error('Kunde inte flytta albumet till samlingen:',error);
    button.textContent=originalText;
    button.disabled=false;
    alert('Kunde inte flytta albumet till samlingen.\n\n'+(error.message||error));
    return false;
  }
}

function attachAlbumClicks(){
  if(collection._albumClickAttached)return;
  collection._albumClickAttached=true;

  collection.addEventListener('click',async function(event){
    var target=event.target||event.srcElement;

    var recordMenuControl=target.closest
      ?target.closest('.record-menu-button,.record-action-menu')
      :null;

    if(recordMenuControl){
      event.stopPropagation();
      return;
    }

    var streamingLink=target.closest
      ?target.closest('.streaming-link')
      :null;
    
    if(streamingLink){
      event.stopPropagation();
      return;
    }

    var wishlistRemoveButton=target.closest
      ?target.closest('.wishlist-remove-button')
      :null;

    if(wishlistRemoveButton){
      if(viewedUserId!==null)return;
      event.preventDefault();
      event.stopPropagation();

      var wishlistRecordElement=wishlistRemoveButton.closest('.record');
      if(!wishlistRecordElement)return;
      var wishlistIndex=parseInt(wishlistRecordElement.getAttribute('data-index'),10);
      if(isNaN(wishlistIndex)||!records[wishlistIndex])return;

      removeAlbumIndex=wishlistIndex;
      document.getElementById('removeAlbumMessage').textContent='Remove "'+records[wishlistIndex][2]+'" from your wishlist?';
      document.getElementById('removeAlbumModal').style.display='flex';
      return;
    }

    var moveButton=target.closest
      ?target.closest('.move-to-collection-button')
      :null;

    if(moveButton){
      event.preventDefault();
      event.stopPropagation();
      var moveRecordElement=moveButton.closest('.record');
      if(!moveRecordElement)return;
      var moveIndex=parseInt(moveRecordElement.getAttribute('data-index'),10);
      if(isNaN(moveIndex))return;
      await moveWishlistAlbumToCollection(moveIndex,moveButton);
      return;
    }

    var deleteButton=target.closest
      ?target.closest('.delete-cover-button')
      :null;

    if(deleteButton){
      if(viewedUserId!==null)return;
        
      event.preventDefault();
      event.stopPropagation();

      var recordElement=deleteButton.closest('.record');

      if(!recordElement)return;

      var index=parseInt(recordElement.getAttribute('data-index'),10);

      if(isNaN(index))return;

        const record=records[index];
        
        if(!record)return;
        
        removeAlbumIndex=index;
        
        const removeAlbumModal=document.getElementById('removeAlbumModal');
        const removeAlbumMessage=document.getElementById('removeAlbumMessage');
        
        removeAlbumMessage.textContent='Are you sure you want to remove "'+record[2]+'" from your collection?';
        
        removeAlbumModal.style.display='flex';
        
        return;
    }
      
    if(suppressAlbumClick)return;
    if(deleteMode)return;

    var recordElement=target.closest
      ?target.closest('.record')
      :null;

    if(!recordElement)return;

    var index=parseInt(recordElement.getAttribute('data-index'),10);

    if(isNaN(index))return;

    openAlbum(index);
  });
}

const removeAlbumModal=document.getElementById('removeAlbumModal');
const cancelRemoveAlbum=document.getElementById('cancelRemoveAlbum');
const confirmRemoveAlbum=document.getElementById('confirmRemoveAlbum');

let removeAlbumIndex=null;

cancelRemoveAlbum.addEventListener('click',function(){
    removeAlbumModal.style.display='none';
    removeAlbumIndex=null;
});

removeAlbumModal.addEventListener('click',function(event){
    if(event.target===removeAlbumModal){
        removeAlbumModal.style.display='none';
        removeAlbumIndex=null;
    }
});

confirmRemoveAlbum.addEventListener('click',async function(){
    if(removeAlbumIndex===null)return;

    const index=removeAlbumIndex;

    removeAlbumModal.style.display='none';
    removeAlbumIndex=null;

    if(window.libraryView==='wishlist'){
      await deleteWishlistAlbum(index);
    }else{
      await deleteCollectionAlbum(index);
    }
});

function enableGridSorting(){
    if(selectedRating!=='all'||librarySearchQuery||librarySort!=='added'){
      collection.classList.remove('grid-sort-enabled');
      return;
    }
    
    if(viewedUserId!==null){
      collection.classList.remove('grid-sort-enabled');
      collection.ondragstart=null;
      collection.ondragover=null;
      collection.ondrop=null;
      collection.ondragend=null;
      collection.oncontextmenu=null;
      return;
    }

  // Mark the editable grid so touch-action can be limited to the sortable cards.
  // This prevents the browser from stealing a long-press as a scroll gesture.
  collection.classList.add('grid-sort-enabled');

  var dragged=null;
  var touchTimer=null;
  var touchDragging=false;
  var touchX=0;
  var touchY=0;
  var autoScrollFrame=null;
  var dragPreview=null;
  var dragPreviewOffsetX=0;
  var dragPreviewOffsetY=0;

  collection.oncontextmenu=function(event){
    event.preventDefault();
    return false;
  };

  function animateCards(moveFunction){
    var cards=collection.querySelectorAll('.record');
    var positions=new Map();

    for(var i=0;i<cards.length;i++){
      if(cards[i]!==dragged){
        positions.set(cards[i],cards[i].getBoundingClientRect());
      }
    }

    moveFunction();

    requestAnimationFrame(function(){
      for(var i=0;i<cards.length;i++){
        var card=cards[i];

        if(card===dragged)continue;

        var oldRect=positions.get(card);

        if(!oldRect)continue;

        var newRect=card.getBoundingClientRect();
        var x=oldRect.left-newRect.left;
        var y=oldRect.top-newRect.top;

        if(x||y){
          card.style.transition='none';
          card.style.transform='translate3d('+x+'px,'+y+'px,0)';

          (function(card){
            requestAnimationFrame(function(){
              card.style.transition='transform .24s cubic-bezier(.2,.8,.2,1)';
              card.style.transform='translate3d(0,0,0)';

              setTimeout(function(){
                card.style.transition='';
                card.style.transform='';
              },260);
            });
          })(card);
        }
      }
    });
  }

  function moveDragged(target,pointerX,pointerY){
    if(!dragged||!target||target===dragged)return;

    var rect=target.getBoundingClientRect();
    var after;

    if(pointerX<rect.left||pointerX>rect.right){
      after=pointerX>rect.left+rect.width/2;
    }else{
      after=pointerY>rect.top+rect.height/2;
    }

    if(after){
      if(target.nextSibling!==dragged){
        animateCards(function(){
          target.parentNode.insertBefore(dragged,target.nextSibling);
        });
      }
    }else{
      if(target!==dragged.nextSibling){
        animateCards(function(){
          target.parentNode.insertBefore(dragged,target);
        });
      }
    }
  }

  function stopAutoScroll(){
    if(autoScrollFrame){
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame=null;
    }
  }

  function createDragPreview(card,pointerX,pointerY){
    removeDragPreview();

    var rect=card.getBoundingClientRect();

    dragPreview=card.cloneNode(true);
    dragPreview.classList.remove('dragging');
    dragPreview.classList.add('drag-preview');
    dragPreview.removeAttribute('draggable');
    dragPreview.style.width=rect.width+'px';
    dragPreview.style.height=rect.height+'px';
    dragPreview.style.left=(pointerX-rect.width/2)+'px';
    dragPreview.style.top=(pointerY-rect.height/2)+'px';

    dragPreviewOffsetX=rect.width/2;
    dragPreviewOffsetY=rect.height/2;

    document.body.appendChild(dragPreview);
  }

  function updateDragPreview(pointerX,pointerY){
    if(!dragPreview)return;

    dragPreview.style.left=(pointerX-dragPreviewOffsetX)+'px';
    dragPreview.style.top=(pointerY-dragPreviewOffsetY)+'px';
  }

  function removeDragPreview(){
    var previews=document.querySelectorAll('.drag-preview');

    for(var i=0;i<previews.length;i++){
      if(previews[i].parentNode){
        previews[i].parentNode.removeChild(previews[i]);
      }
    }

    dragPreview=null;
  }

  function autoScroll(){
    if(!touchDragging||!dragged){
      stopAutoScroll();
      return;
    }

    var edge=100;
    var maxSpeed=14;
    var height=window.innerHeight;
    var speed=0;

    if(touchY<edge){
      speed=-maxSpeed*(1-touchY/edge);
    }else if(touchY>height-edge){
      speed=maxSpeed*(1-(height-touchY)/edge);
    }

    if(speed){
      window.scrollBy(0,speed);

      var target=document.elementFromPoint(touchX,touchY);

      if(target){
        var card=target.closest
          ?target.closest('.record')
          :null;

        if(card&&card!==dragged){
          moveDragged(card,touchX,touchY);
        }
      }
    }

    autoScrollFrame=requestAnimationFrame(autoScroll);
  }

  function finishDrag(){
    var orderedCards=collection.querySelectorAll('.record');
    var reorderedPage=[];

    for(var i=0;i<orderedCards.length;i++){
      var index=parseInt(orderedCards[i].getAttribute('data-index'),10);
      var record=records[index];

      if(!record)continue;
      reorderedPage.push(record);
    }

    var pageStart=(libraryPage-1)*RECORDS_PER_PAGE;

    if(window.libraryView==='wishlist'||activeShelfId==='all'){
      var orderedList=records
        .slice()
        .sort(function(a,b){return (parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);});

      orderedList.splice.apply(
        orderedList,
        [pageStart,reorderedPage.length].concat(reorderedPage)
      );

      records=orderedList;
      records.forEach(function(record,index){record[0]=index+1;});

      var allOrderIds=records
        .filter(function(record){return record&&record[9];})
        .map(function(record){return String(record[9]);});

      buildGrid();
      queueGridOrderSave({
        kind:window.libraryView==='wishlist'?'wishlist':'collection',
        shelfId:null,
        ids:allOrderIds
      });
      return;
    }

    var shelfList=records
      .filter(function(record){return String(record[13]||'')===String(activeShelfId);})
      .sort(function(a,b){
        var aOrder=parseInt(a[14],10);
        var bOrder=parseInt(b[14],10);
        if(isNaN(aOrder))aOrder=2147483647;
        if(isNaN(bOrder))bOrder=2147483647;
        return aOrder-bOrder||(parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);
      });

    shelfList.splice.apply(
      shelfList,
      [pageStart,reorderedPage.length].concat(reorderedPage)
    );
    shelfList.forEach(function(record,index){record[14]=index+1;});

    var shelfOrderIds=shelfList
      .filter(function(record){return record&&record[9];})
      .map(function(record){return String(record[9]);});

    buildGrid();
    queueGridOrderSave({
      kind:'collection',
      shelfId:activeShelfId,
      ids:shelfOrderIds
    });
  }

    collection.ondragstart=function(event){
      if(viewedUserId!==null){
        event.preventDefault();
        return;
      }
    
      var record=event.target.closest('.record');
    
      if(!record)return;

    dragged=record;
    record.classList.add('dragging');
    createDragPreview(record,event.clientX,event.clientY);

    if(event.dataTransfer){
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',record.getAttribute('data-index'));

      if(dragPreview){
        // Dölj webbläsarens halvtransparenta standard-ghost. Vår egen
        // kopia följer musen och förblir helt ogenomskinlig.
        var transparentDragImage=document.createElement('canvas');
        transparentDragImage.width=1;
        transparentDragImage.height=1;
        event.dataTransfer.setDragImage(transparentDragImage,0,0);
      }
    }
  };

  collection.ondragover=function(event){
    if(viewedUserId!==null)return;
    if(!dragged)return;

    event.preventDefault();
    event.dataTransfer.dropEffect='move';

    updateDragPreview(event.clientX,event.clientY);

    var target=event.target.closest('.record');

    if(!target||target===dragged)return;

    moveDragged(target,event.clientX,event.clientY);
  };

  collection.ondragenter=function(event){
    if(viewedUserId===null&&dragged){
      event.preventDefault();
      event.dataTransfer.dropEffect='move';
    }
  };

  collection.ondrop=async function(event){
    if(viewedUserId!==null)return;  
    if(!dragged)return;

    event.preventDefault();

    var releasedDragged=dragged;

    releasedDragged.classList.remove('dragging');
    removeDragPreview();
    dragged=null;

    await finishDrag();
  };

  collection.ondragend=function(){
    if(dragged){
      dragged.classList.remove('dragging');
    }

    removeDragPreview();
    dragged=null;
  };

  window.addEventListener('dragend',removeDragPreview);
  window.addEventListener('blur',function(){
    if(dragged){
      dragged.classList.remove('dragging');
      dragged=null;
    }

    removeDragPreview();
    touchDragging=false;
    resetPointerState();
    resetTouchState();
  });

  collection.ondragstart=null;
  collection.ondragover=null;
  collection.ondragenter=null;
  collection.ondrop=null;
  collection.ondragend=null;

  var cards=collection.querySelectorAll('.record');
  var pointerId=null;
  var pointerCard=null;
  var pointerStartX=0;
  var pointerStartY=0;
  var touchId=null;
  var touchCard=null;
  var touchStartX=0;
  var touchStartY=0;
  var touchLongPressActive=false;

  function resetPointerState(){
    clearTimeout(touchTimer);
    stopAutoScroll();

    if(pointerCard&&pointerCard.releasePointerCapture&&pointerId!==null){
      try{pointerCard.releasePointerCapture(pointerId);}catch(error){}
    }

    pointerId=null;
    pointerCard=null;
  }

  function resetTouchState(){
    clearTimeout(touchTimer);
    touchId=null;
    touchCard=null;
    touchLongPressActive=false;
  }

  function findTouch(touchList,id){
    for(var i=0;i<touchList.length;i++){
      if(touchList[i].identifier===id)return touchList[i];
    }

    return null;
  }

  function startPointerDrag(card,event){
    dragged=card;
    touchDragging=true;
    suppressAlbumClick=true;
    touchX=event.clientX;
    touchY=event.clientY;
    card.classList.add('dragging');
    createDragPreview(card,touchX,touchY);

    if(card.setPointerCapture&&event.pointerId!==undefined){
      try{card.setPointerCapture(event.pointerId);}catch(error){}
    }

    autoScroll();
  }

  function updatePointerDrag(event){
    if(!touchDragging||!dragged)return;

    event.preventDefault();

    touchX=event.clientX;
    touchY=event.clientY;
    updateDragPreview(touchX,touchY);

    var target=document.elementFromPoint(touchX,touchY);
    var card=target&&target.closest
      ?target.closest('.record')
      :null;

    if(card&&card!==dragged){
      moveDragged(card,touchX,touchY);
    }
  }

  async function finishPointerDrag(){
    clearTimeout(touchTimer);
    stopAutoScroll();

    if(!touchDragging||!dragged){
      removeDragPreview();
      resetPointerState();
      resetTouchState();
      touchDragging=false;
      dragged=null;
      suppressAlbumClick=false;
      return;
    }

    var releasedDragged=dragged;

    releasedDragged.classList.remove('dragging');
    removeDragPreview();
    dragged=null;
    touchDragging=false;
    resetPointerState();
    resetTouchState();

    suppressAlbumClick=true;
    await finishDrag();

    setTimeout(function(){
      suppressAlbumClick=false;
    },300);
  }

  function cancelPointerDrag(){
    clearTimeout(touchTimer);
    stopAutoScroll();

    if(dragged){
      dragged.classList.remove('dragging');
    }

    removeDragPreview();
    dragged=null;
    touchDragging=false;
    suppressAlbumClick=false;
    resetPointerState();
    resetTouchState();
  }

  for(var i=0;i<cards.length;i++){
    cards[i].onpointerdown=function(event){
      if(pointerId!==null)return;
      if(event.button!==undefined&&event.button!==0)return;
      if(event.pointerType==='touch')return;
      if(event.target.closest&&event.target.closest('.delete-cover-button,.wishlist-remove-button,.move-to-collection-button,.streaming-link,.record-menu-button,.record-action-menu'))return;

      pointerId=event.pointerId;
      pointerCard=this;
      pointerStartX=event.clientX;
      pointerStartY=event.clientY;
      touchX=event.clientX;
      touchY=event.clientY;

      clearTimeout(touchTimer);

      // Keep receiving pointer events even when the pointer moves off the card.
      if(this.setPointerCapture){
        try{this.setPointerCapture(event.pointerId);}catch(error){}
      }

    };

    cards[i].onpointermove=function(event){
      if(pointerId===null||event.pointerId!==pointerId)return;

      if(!touchDragging){
        var movedX=Math.abs(event.clientX-pointerStartX);
        var movedY=Math.abs(event.clientY-pointerStartY);

        if(movedX>6||movedY>6){
          startPointerDrag(this,event);
          updatePointerDrag(event);
        }

        return;
      }

      updatePointerDrag(event);
    };

    cards[i].onpointerup=function(event){
      if(pointerId===null||event.pointerId!==pointerId)return;
      finishPointerDrag();
    };

    cards[i].onpointercancel=function(event){
      if(pointerId===null||event.pointerId!==pointerId)return;
      cancelPointerDrag();
    };

    cards[i].addEventListener('touchstart',function(event){
      if(touchId!==null||!event.changedTouches.length)return;
      if(event.target.closest&&event.target.closest('.delete-cover-button,.wishlist-remove-button,.move-to-collection-button,.streaming-link,.record-menu-button,.record-action-menu'))return;

      var touch=event.changedTouches[0];
      touchId=touch.identifier;
      touchCard=this;
      touchStartX=touch.clientX;
      touchStartY=touch.clientY;
      touchX=touch.clientX;
      touchY=touch.clientY;

      clearTimeout(touchTimer);
      touchTimer=setTimeout(function(){
        if(touchId===null||touchDragging||!touchCard)return;

        touchLongPressActive=true;
        suppressAlbumClick=true;
        setDeleteMode(true);

        if(navigator.vibrate){
          try{navigator.vibrate(18);}catch(error){}
        }
      },350);
    },{passive:true});

    cards[i].addEventListener('touchmove',function(event){
      if(touchId===null)return;

      var touch=findTouch(event.touches,touchId);

      if(!touch)return;

      touchX=touch.clientX;
      touchY=touch.clientY;

      if(!touchDragging){
        var movedX=Math.abs(touchX-touchStartX);
        var movedY=Math.abs(touchY-touchStartY);

        if(touchLongPressActive&&(movedX>8||movedY>8)){
          startPointerDrag(touchCard,{
            clientX:touchX,
            clientY:touchY
          });
        }else if(!touchLongPressActive&&(movedX>8||movedY>8)){
          clearTimeout(touchTimer);
        }

        if(!touchDragging)return;
      }

      event.preventDefault();
      updateDragPreview(touchX,touchY);

      var target=document.elementFromPoint(touchX,touchY);
      var card=target&&target.closest
        ?target.closest('.record')
        :null;

      if(card&&card!==dragged){
        moveDragged(card,touchX,touchY);
      }
    },{passive:false});

    cards[i].addEventListener('touchend',function(event){
      if(touchId===null)return;

      var touch=findTouch(event.changedTouches,touchId);

      if(!touch)return;

      if(touchDragging){
        event.preventDefault();
        finishPointerDrag();
      }else if(touchLongPressActive){
        event.preventDefault();
        resetTouchState();
        setTimeout(function(){
          suppressAlbumClick=false;
        },300);
      }else{
        resetTouchState();
      }
    },{passive:false});

    cards[i].addEventListener('touchcancel',function(){
      if(touchId===null)return;
      cancelPointerDrag();
    },{passive:true});
  }
}

function attachWishlistRemoveControls(){
  var buttons=collection.querySelectorAll('.wishlist-remove-button');

  function stopCardInteraction(event){
    event.stopPropagation();
  }

  for(var i=0;i<buttons.length;i++){
    var button=buttons[i];

    button.addEventListener('pointerdown',stopCardInteraction);
    button.addEventListener('mousedown',stopCardInteraction);
    button.addEventListener('touchstart',stopCardInteraction,{passive:true});
    button.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if(viewedUserId!==null)return;

      var recordElement=this.closest('.record');
      if(!recordElement)return;

      var index=parseInt(recordElement.getAttribute('data-index'),10);
      if(isNaN(index)||!records[index])return;

      removeAlbumIndex=index;
      document.getElementById('removeAlbumMessage').textContent='Remove "'+records[index][2]+'" from your wishlist?';
      document.getElementById('removeAlbumModal').style.display='flex';
    });
  }
}

var pendingGridOrderSaves=new Map();
var gridOrderSaveRunning=false;
var gridOrderSaveErrorShown=false;

function gridOrderSaveKey(job){
  if(job.kind==='wishlist')return 'wishlist';
  return 'collection|'+String(job.shelfId||'all');
}

function queueGridOrderSave(job){
  pendingGridOrderSaves.set(gridOrderSaveKey(job),job);
  if(gridOrderSaveRunning)return;
  flushGridOrderSaveQueue();
}

async function flushGridOrderSaveQueue(){
  if(gridOrderSaveRunning)return;
  gridOrderSaveRunning=true;

  while(pendingGridOrderSaves.size){
    var nextEntry=pendingGridOrderSaves.entries().next().value;
    var jobKey=nextEntry[0];
    var job=nextEntry[1];
    pendingGridOrderSaves.delete(jobKey);

    var result;

    if(job.kind==='wishlist'){
      result=await supabaseClient.rpc('set_wishlist_display_order',{
        p_wishlist_ids:job.ids
      });
    }else{
      result=await supabaseClient.rpc('set_collection_display_order',{
        p_shelf_id:job.shelfId||null,
        p_collection_ids:job.ids
      });
    }

    if(result.error){
      console.error('Kunde inte spara sorteringen:',result.error);
      pendingGridOrderSaves.clear();

      if(!gridOrderSaveErrorShown){
        gridOrderSaveErrorShown=true;
        alert('Kunde inte spara den nya ordningen. Samlingen laddas om så att inget hamnar fel.');
      }

      await window.loadCollection();
      break;
    }

    gridOrderSaveErrorShown=false;
  }

  gridOrderSaveRunning=false;

  if(pendingGridOrderSaves.size)flushGridOrderSaveQueue();
}

function paginationItems(current,total){
  if(total<=7)return Array.from({length:total},function(_,index){return index+1;});
  var values=[1,total,current-1,current,current+1]
    .filter(function(page){return page>=1&&page<=total;})
    .sort(function(a,b){return a-b;});
  var unique=values.filter(function(page,index){return !index||page!==values[index-1];});
  var items=[];
  unique.forEach(function(page,index){
    if(index&&page-unique[index-1]>1)items.push('…');
    items.push(page);
  });
  return items;
}

function renderLibraryPagination(totalItems){
  var totalPages=Math.max(1,Math.ceil(totalItems/RECORDS_PER_PAGE));
  libraryPage=Math.max(1,Math.min(libraryPage,totalPages));
  var targets=[libraryPaginationTop,libraryPaginationBottom];

  targets.forEach(function(target){
    if(totalPages<=1){target.innerHTML='';target.hidden=true;return;}
    target.hidden=false;
    target.innerHTML='<button type="button" data-page="'+(libraryPage-1)+'" aria-label="Previous page"'+(libraryPage===1?' disabled':'')+'>‹</button>'+
      paginationItems(libraryPage,totalPages).map(function(item){
        if(item==='…')return '<span class="pagination-ellipsis" aria-hidden="true">…</span>';
        return '<button type="button" data-page="'+item+'"'+(item===libraryPage?' class="active" aria-current="page"':'')+'>'+item+'</button>';
      }).join('')+
      '<button type="button" data-page="'+(libraryPage+1)+'" aria-label="Next page"'+(libraryPage===totalPages?' disabled':'')+'>›</button>';

    target.querySelectorAll('button[data-page]').forEach(function(button){
      button.addEventListener('click',function(){
        var page=parseInt(button.getAttribute('data-page'),10);
        if(isNaN(page)||page<1||page>totalPages||page===libraryPage)return;
        libraryPage=page;
        buildGrid();
        window.scrollTo({top:0,behavior:'smooth'});
      });
    });
  });
}
    
window.buildGrid=function(){
    
  collection.className='collection grid';

  var emptyCollection=document.getElementById('emptyCollection');
  var profileNotFound=document.getElementById('profileNotFound');
  var hasBlockingState=window.loginRequiredForViewedCollection||window.profileNotFound;
  var isViewingProfile=viewedUserId!==null;
  var isOwnCollection=!isViewingProfile&&!hasBlockingState;
  var isWishlist=window.libraryView==='wishlist';
  var canShowAddAlbumCard=isOwnCollection&&window.hasAuthenticatedUser&&records.length>0;
  var emptyWishlist=document.getElementById('emptyWishlist');
  var libraryTabs=document.getElementById('libraryTabs');
  var libraryTitle=document.getElementById('libraryTitle');
  var viewedUsername=window.groovyViewedStatisticsProfile&&window.groovyViewedStatisticsProfile.username;
  var activeShelf=(!isWishlist&&activeShelfId!=='all')?shelfById(activeShelfId):null;
  var showLoggedOutLanding=shouldShowLoggedOutLanding();

  renderShelfStrip();

  document.body.classList.toggle('logged-out-home',showLoggedOutLanding);
  updateLibraryTabLabels();

  libraryTitle.textContent=isWishlist
    ?(isViewingProfile?((viewedUsername||'User')+"'s Wishlist"):'My Wishlist')
    :(activeShelf?activeShelf.name:'All Records');
  librarySearchInput.placeholder=showLoggedOutLanding?'Search for an album, artist, or label...':(isWishlist?'Search this wishlist...':'Search this shelf...');
  librarySearchInput.readOnly=showLoggedOutLanding;
  mobileAddRecordButton.style.display=isViewingProfile?'none':'';

  if(showLoggedOutLanding){
    librarySearchQuery='';
    librarySearchInput.value='';
    renderLoggedOutLanding();
  }else{
    restoreEmptyCollectionMarkup();
  }

  emptyCollection.style.display=((isOwnCollection&&!isWishlist&&records.length===0)||showLoggedOutLanding)?'flex':'none';
  loginToViewCollection.style.display=window.loginRequiredForViewedCollection?'flex':'none';
  profileNotFound.style.display=window.profileNotFound?'flex':'none';
  emptyViewedCollection.style.display=(isViewingProfile&&!isWishlist&&records.length===0&&!hasBlockingState)?'flex':'none';
  emptyWishlist.style.display=(isWishlist&&records.length===0&&!hasBlockingState)?'flex':'none';
  document.getElementById('emptyWishlistTitle').textContent=isViewingProfile?'Wishlist is empty':'Your wishlist is empty';
  document.getElementById('emptyWishlistText').textContent=isViewingProfile
    ?"This user hasn't added any records yet."
    :'Save records you want to add next.';
  document.getElementById('emptyWishlistAddButton').style.display=isViewingProfile?'none':'';
  libraryTabs.style.display=(window.hasAuthenticatedUser||showLoggedOutLanding)?'flex':'none';
  document.getElementById('collectionTabButton').classList.toggle('active',showLoggedOutLanding||(isOwnCollection&&!isWishlist));
  document.getElementById('wishlistTabButton').classList.toggle('active',window.hasAuthenticatedUser&&isOwnCollection&&isWishlist);
  document.getElementById('collectionTabButton').setAttribute('aria-current',(showLoggedOutLanding||(isOwnCollection&&!isWishlist))?'page':'false');
  document.getElementById('wishlistTabButton').setAttribute('aria-current',(window.hasAuthenticatedUser&&isOwnCollection&&isWishlist)?'page':'false');
  document.getElementById('addAlbumButton').style.display=isViewingProfile?'none':'';
  document.getElementById('filterButton').parentElement.style.display=(isWishlist||showLoggedOutLanding)?'none':'';

  var shelfRecords=records.filter(function(record){
    return isWishlist||activeShelfId==='all'||String(record[13]||'')===String(activeShelfId);
  });

  if(!isWishlist){
    document.getElementById('collectionCount').textContent=activeShelf
      ?shelfRecords.length+' RECORDS IN '+activeShelf.name.toLocaleUpperCase()
      :records.length+' RECORDS IN COLLECTION';
  }

  var visibleRecords=LibraryCore.filterRecords(shelfRecords,{
    query:librarySearchQuery,
    selectedRating:selectedRating,
    isWishlist:isWishlist
  });
  visibleRecords=LibraryCore.sortRecords(visibleRecords,{
    sort:librarySort,
    isWishlist:isWishlist,
    activeShelfId:activeShelfId
  });
  renderLibraryPagination(visibleRecords.length);
  var totalPages=Math.max(1,Math.ceil(visibleRecords.length/RECORDS_PER_PAGE));
  var pageStart=(libraryPage-1)*RECORDS_PER_PAGE;
  var pageRecords=visibleRecords.slice(pageStart,pageStart+RECORDS_PER_PAGE);
  var html=pageRecords.map(function(record){return recordHTML(record,'');}).join('');

  if(!pageRecords.length&&records.length){
    html='<div class="library-no-results"><strong>'+(activeShelf&&shelfRecords.length===0?'This shelf is empty':'No records found')+'</strong><span>'+(activeShelf&&shelfRecords.length===0?'Use the record menu to add records to this shelf.':'Try another search or filter.')+'</span></div>';
  }

  if(canShowAddAlbumCard&&activeShelfId==='all'&&libraryPage===totalPages){
    html+='<button class="add-album-card" type="button" aria-label="Add record">'+
      '<span class="add-album-card-icon" aria-hidden="true">+</span>'+
      '<span class="add-album-card-title">Add Record</span>'+
      '<span class="add-album-card-text">'+(isWishlist?'The wishlist must grow':'The collection must grow')+'</span>'+
    '</button>';
  }

  collection.innerHTML=html;

  var addAlbumCard=collection.querySelector('.add-album-card');

  if(addAlbumCard){
    addAlbumCard.addEventListener('click',function(){
      document.getElementById('addAlbumButton').click();
    });
  }

  attachWishlistRemoveControls();
  attachRecordActionMenus();
  attachAlbumClicks();
  enableGridSorting();
  loadVisibleImages();
}

albumClose.onclick=function(){
  closeAlbum();
};

albumOverlay.onclick=function(event){
  if((event||window.event).target===albumOverlay){
    closeAlbum();
  }
};

document.onkeydown=function(event){
  event=event||window.event;

  if(event.keyCode===27){
    if(marketplaceController.handleEscape())return;
    if(albumOverlay.className.indexOf('visible')!==-1){
      closeAlbum();
    }
    return;
  }

};

filterButton.onclick=function(event){
  event.stopPropagation();
  filterMenu.classList.toggle('open');
  filterButton.setAttribute('aria-expanded',filterMenu.classList.contains('open')?'true':'false');
  librarySortMenu.classList.remove('open');
  librarySortButton.setAttribute('aria-expanded','false');
};

librarySearchInput.addEventListener('input',function(){
  librarySearchQuery=this.value.trim();
  libraryPage=1;
  buildGrid();
});

function promptAuthFromLibrarySearch(event){
  if(!shouldShowLoggedOutLanding())return;
  event.preventDefault();
  event.stopPropagation();
  librarySearchInput.blur();
  openAuthPanel('login');
}

librarySearchInput.addEventListener('focus',function(event){
  if(shouldShowLoggedOutLanding())promptAuthFromLibrarySearch(event);
});

librarySearchInput.addEventListener('pointerdown',function(event){
  if(shouldShowLoggedOutLanding())promptAuthFromLibrarySearch(event);
});

librarySearchInput.addEventListener('keydown',function(event){
  if(shouldShowLoggedOutLanding())promptAuthFromLibrarySearch(event);
});

librarySortButton.addEventListener('click',function(event){
  event.stopPropagation();
  var open=!librarySortMenu.classList.contains('open');
  librarySortMenu.classList.toggle('open',open);
  librarySortButton.setAttribute('aria-expanded',open?'true':'false');
  filterMenu.classList.remove('open');
  filterButton.setAttribute('aria-expanded','false');
});

librarySortMenu.querySelectorAll('button[data-sort]').forEach(function(button){
  button.addEventListener('click',function(event){
    event.stopPropagation();
    librarySort=button.getAttribute('data-sort')||'added';
    libraryPage=1;
    librarySortMenu.querySelectorAll('button[data-sort]').forEach(function(item){
      item.classList.toggle('active',item===button);
    });
    librarySortButton.textContent='Sort: '+button.textContent+' ▾';
    librarySortMenu.classList.remove('open');
    librarySortButton.setAttribute('aria-expanded','false');
    buildGrid();
  });
});

mobileAddRecordButton.addEventListener('click',function(){
  document.getElementById('addAlbumButton').click();
});

var filterButtons=filterMenu.querySelectorAll('button');

for(var f=0;f<filterButtons.length;f++){
  filterButtons[f].onclick=function(event){
    event.stopPropagation();

    selectedRating=this.getAttribute('data-rating');

    for(var i=0;i<filterButtons.length;i++){
      filterButtons[i].className='';
    }

    this.className='active';
    filterButton.textContent=this.textContent+' ▾';

    filterMenu.classList.remove('open');
    filterButton.setAttribute('aria-expanded','false');

    libraryPage=1;

    buildGrid();
  };
}

document.addEventListener('click',function(){
  filterMenu.classList.remove('open');
  filterButton.setAttribute('aria-expanded','false');
  librarySortMenu.classList.remove('open');
  librarySortButton.setAttribute('aria-expanded','false');
});

var imageLoadScheduled=false;
function scheduleImageLoad(){
  if(imageLoadScheduled)return;
  imageLoadScheduled=true;
  var run=window.requestAnimationFrame||function(fn){return setTimeout(fn,50);};
  run(function(){imageLoadScheduled=false;loadVisibleImages();});
}

window.onscroll=scheduleImageLoad;

})();

// ========================================
// ADD ALBUM / MUSICBRAINZ
// ========================================

const addAlbumButton=document.getElementById('addAlbumButton');
const addAlbumModal=document.getElementById('addAlbumModal');
const closeAddAlbum=document.getElementById('closeAddAlbum');
const albumSearchInput=document.getElementById('albumSearchInput');
const albumSearchResults=document.getElementById('albumSearchResults');

const myCollectionButton=document.getElementById('myCollectionButton');
const collectionTabButton=document.getElementById('collectionTabButton');
const wishlistTabButton=document.getElementById('wishlistTabButton');
const viewedUserShelfButton=document.getElementById('viewedUserShelfButton');
const viewedUserWishlistButton=document.getElementById('viewedUserWishlistButton');
const emptyWishlistAddButton=document.getElementById('emptyWishlistAddButton');

const logo=document.querySelector('.logo');

logo.addEventListener('click',async function(event){
    event.preventDefault();
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session||!session.user){
        if(window.location.pathname!=='/'||window.location.search)history.replaceState({},'','/');
        await renderCurrentRoute();
        return;
    }
    history.pushState({},'','/');
    libraryPage=1;
    setDeleteMode(false);
    await renderCurrentRoute();
});

myCollectionButton.addEventListener('click',async function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user){
        openAuthPanel('login');
        return;
    }

    history.pushState({},'','/');
    libraryPage=1;
    setDeleteMode(false);
    await renderCurrentRoute();
});

async function navigateOwnLibrary(nextView){
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session||!session.user){
        openAuthPanel('login');
        return;
    }
    libraryPage=1;
    setDeleteMode(false);
    var url='/';
    if(nextView==='wishlist')url+='?view=wishlist';
    if(window.location.pathname+window.location.search===url)return;
    history.pushState({},'',url);
    renderCurrentRoute();
}

function navigateViewedLibrary(nextView){
    var profile=window.groovyViewedStatisticsProfile;
    if(!profile||!profile.username)return;
    libraryPage=1;
    setDeleteMode(false);
    var url='/shelf/'+encodeURIComponent(profile.username);
    if(nextView==='wishlist')url+='?view=wishlist';
    if(window.location.pathname+window.location.search===url)return;
    history.pushState({},'',url);
    renderCurrentRoute();
}

collectionTabButton.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();navigateOwnLibrary('collection');});
wishlistTabButton.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();navigateOwnLibrary('wishlist');});
viewedUserShelfButton.addEventListener('click',function(){
    var header=document.getElementById('viewedUserHeader');
    if(header&&header.dataset.own==='true')navigateOwnLibrary('collection');
    else navigateViewedLibrary('collection');
});
viewedUserWishlistButton.addEventListener('click',function(){
    var header=document.getElementById('viewedUserHeader');
    if(header&&header.dataset.own==='true')navigateOwnLibrary('wishlist');
    else navigateViewedLibrary('wishlist');
});
emptyWishlistAddButton.addEventListener('click',function(){
    addAlbumButton.click();
});

let deleteMode=false;

function setDeleteMode(active){
  deleteMode=Boolean(active);
  document.body.classList.toggle('delete-mode-active',deleteMode);
}

document.addEventListener('click',function(event){
  if(!deleteMode)return;

  var target=event.target;
  var isDeleteControl=target.closest&&target.closest('.delete-cover-button,.wishlist-remove-button,#removeAlbumModal');

  if(isDeleteControl)return;

  event.preventDefault();
  event.stopPropagation();
  setDeleteMode(false);
},true);

var albumSearchController=AlbumSearch.create({
    supabaseClient:supabaseClient,
    addAlbumModal:addAlbumModal,
    closeAddAlbum:closeAddAlbum,
    albumSearchInput:albumSearchInput,
    albumSearchResults:albumSearchResults,
    appleSearchCore:AppleSearchCore,
    pressingCore:PressingCore
});

function openAddAlbumSearch(user){return albumSearchController.open(user);}
function invalidateSearchLibraryState(){return albumSearchController.invalidateLibraryState();}

addAlbumButton.addEventListener('click',async function(event){
    if(viewedUserId!==null)return;
    event.preventDefault();
    event.stopPropagation();

    const {data:{session}}=await supabaseClient.auth.getSession();

    if(!session||!session.user){
        openAuthPanel('login');
        return;
    }

    openAddAlbumSearch(session.user);
});

const emptyCollectionAddButton=document.getElementById('emptyCollectionAddButton');
const loginToViewCollection=document.getElementById('loginToViewCollection');
const loginToViewCollectionButton=document.getElementById('loginToViewCollectionButton');
const emptyViewedCollection=document.getElementById('emptyViewedCollection');
const defaultEmptyCollectionMarkup=emptyCollection.innerHTML;

function restoreEmptyCollectionMarkup(){
    if(emptyCollection.getAttribute('data-landing')==='true'){
        emptyCollection.innerHTML=defaultEmptyCollectionMarkup;
        emptyCollection.classList.remove('landing-state');
        emptyCollection.removeAttribute('data-landing');
    }
}

function renderLoggedOutLanding(){
    if(emptyCollection.getAttribute('data-landing')==='true')return;
    emptyCollection.setAttribute('data-landing','true');
    emptyCollection.classList.add('landing-state');
    emptyCollection.innerHTML=''+
      '<div class="landing-hero">'+
        '<img class="landing-record-art" src="/assets/images/avatar-placeholder.png" alt="Vinyl record">'+
        '<h2 class="landing-title">Track every record you own</h2>'+
        '<p class="landing-copy">Build your shelf, organize your collection, keep a wishlist, rate your favorites and discover the collectors who share your taste.</p>'+
        '<div class="landing-actions">'+
          '<button class="landing-primary" type="button" data-auth-mode="register">Create account</button>'+
          '<button class="landing-secondary" type="button" data-auth-mode="login">Log in</button>'+
        '</div>'+
        '<div class="landing-feature-grid">'+
          '<article class="landing-feature-card">'+
            '<div class="landing-feature-icon"><span class="record-icon" aria-hidden="true"></span></div>'+
            '<h3>Everything in one place</h3>'+
            '<p>Keep all your records together with artwork, notes, ratings and the exact pressing you own.</p>'+
          '</article>'+
          '<article class="landing-feature-card">'+
            '<div class="landing-feature-icon"><span class="wishlist-icon" aria-hidden="true"></span></div>'+
            '<h3>Organize your collection</h3>'+
            '<p>Use shelves and wishlists to sort your albums, plan future buys and make your library easy to browse.</p>'+
          '</article>'+
          '<article class="landing-feature-card">'+
            '<div class="landing-feature-icon feature-chart-icon" aria-hidden="true"></div>'+
            '<h3>Stats, collectors & prices</h3>'+
            '<p>See collection stats, find like-minded collectors and compare marketplace listings to spot better prices.</p>'+
          '</article>'+
        '</div>'+
      '</div>';

}

document.getElementById('emptyCollection').addEventListener('click',async function(event){
    var authButton=event.target.closest('[data-auth-mode]');
    if(authButton){
        event.preventDefault();
        event.stopPropagation();
        openAuthPanel(authButton.getAttribute('data-auth-mode')||'login');
        return;
    }

    if(!event.target.closest('#emptyCollectionAddButton'))return;
    event.preventDefault();
    event.stopPropagation();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user){
        openAuthPanel('register');
        return;
    }

    openAddAlbumSearch(user);
});

loginToViewCollectionButton.addEventListener('click',function(event){
    event.preventDefault();
    event.stopPropagation();

    openAuthPanel('login');
});



async function loadOtherUserCollection(userId){
    var loadVersion=++window.collectionLoadVersion;
    viewedUserId=userId;
    libraryPage=1;

    setDeleteMode(false);
    
    const {data:profile,error:profileError}=await supabaseClient
        .from('profiles')
        .select('username,avatar_url')
        .eq('id',userId)
        .maybeSingle();

    if(profileError){
        console.error('Kunde inte hämta användarprofil:',profileError);
        return;
    }

    const viewedUserHeader=document.getElementById('viewedUserHeader');
    const viewedUserAvatar=document.getElementById('viewedUserAvatar');
    const viewedUserName=document.getElementById('viewedUserName');

    viewedUserHeader.dataset.own='false';
    viewedUserHeader.style.display='flex';
    if(typeof window.groovySyncViewedProfileButtonLabel==='function')window.groovySyncViewedProfileButtonLabel(false);

    viewedUserAvatar.style.backgroundImage='url("'+
        (profile&&profile.avatar_url
            ?profile.avatar_url
            :'/assets/images/avatar-placeholder.png')+
        '")';

    viewedUserAvatar.style.backgroundSize='cover';
    viewedUserAvatar.style.backgroundPosition='center';

    viewedUserName.textContent=profile&&profile.username
        ?profile.username
        :'Unknown user';
    document.getElementById('viewedUserContext').textContent=window.libraryView==='wishlist'?'Wishlist':'Shelf';
    viewedUserShelfButton.classList.toggle('active',window.libraryView!=='wishlist');
    viewedUserWishlistButton.classList.toggle('active',window.libraryView==='wishlist');
    viewedUserShelfButton.setAttribute('aria-current',window.libraryView!=='wishlist'?'page':'false');
    viewedUserWishlistButton.setAttribute('aria-current',window.libraryView==='wishlist'?'page':'false');

    window.groovyViewedStatisticsProfile={
        id:userId,
        username:profile&&profile.username?profile.username:'Unknown user',
        avatar_url:profile&&profile.avatar_url?profile.avatar_url:''
    };

    if(viewedUserFollowButton){
        var isFollowingViewed=false;
        try{isFollowingViewed=await window.groovyIsFollowing(userId);}catch(error){isFollowingViewed=false;}
        socialController.setViewedUserFollowState(userId,profile&&profile.username?profile.username:'collector',isFollowingViewed);
        viewedUserFollowButton.style.display='inline-flex';
    }

    if(window.libraryView==='wishlist'){
        await window.loadWishlist(userId);
        return;
    }

    await window.loadShelvesForUser(userId);

    const {data,error}=await supabaseClient
        .from('collections')
        .select(`
            id,
            collection_number,
            sort_order,
            shelf_id,
            shelf_sort_order,
            cover_url,
            discogs_style,
            discogs_release_id,
            media_condition,
            sleeve_condition,
            pressing_country,
            pressing_year,
            pressing_label,
            catalog_number,
            matrix_runout_a,
            matrix_runout_b,
            matrix_runout_c,
            matrix_runout_d,
            matrix_runout_e,
            matrix_runout_f,
            matrix_runout_g,
            matrix_runout_h,
            pressing_match_status,
            albums(
                id,
                title,
                release_year,
                genre,
                cover_url,
                apple_collection_url,
                discogs_master_id,
                artists(
                    id,
                    name
                ),
                tracks(
                    id,
                    disc_side,
                    track_number,
                    title
                )
            )
        `)
        .eq('user_id',userId)
        .order('sort_order',{ascending:true});

    if(error){
        console.error('Kunde inte hämta användarens samling:',error);
        return;
    }



    var albumIds=data
        .map(function(item){
            return item.albums&&item.albums.id;
        })
        .filter(Boolean);

    var {data:{user:sessionUser}}=await supabaseClient.auth.getUser();
    var ownRatingUserId=sessionUser&&sessionUser.id?sessionUser.id:null;
    var albumRatingsMeta=await window.loadAlbumRatingData(albumIds,ownRatingUserId);

     if(loadVersion!==window.collectionLoadVersion)return;

    records=data
        .filter(function(item){
            return item.albums;
        })
        .map(function(item,index){
            var album=item.albums;

            var artist=
                album.artists&&album.artists.name
                    ?album.artists.name.replace(/\s*\(\d+\)$/,'')
                    :'Okänd artist';

            var sides=window.emptyRecordSides();

            if(Array.isArray(album.tracks)){
                album.tracks
                    .sort(function(a,b){
                        var sideCompare=String(a.disc_side||'').localeCompare(String(b.disc_side||''));
                        return sideCompare||((a.track_number||0)-(b.track_number||0))||((a.id||0)-(b.id||0));
                    })
                    .forEach(function(track){
                        var side=track.disc_side;

                        if(!sides[side])return;

                        sides[side].push({
                            id:track.id,
                            title:track.title||'Okänd låt',
                            trackNumber:track.track_number==null?null:track.track_number,
                            duration:track.duration||''
                        });
                    });
            }

            return window.applyAlbumRatingMeta([
                index+1,
                artist,
                album.title||'Okänd titel',
                album.release_year||'',
                item.discogs_style||album.genre||'',
                0,
                item.cover_url||album.cover_url||'',
                sides,
                album.id,
                item.id,
                album.discogs_master_id||'',
                copyDetailsFromRow(item),
                album.apple_collection_url||'',
                item.shelf_id||'',
                item.shelf_sort_order==null?null:item.shelf_sort_order,
                0,
                0
            ],albumRatingsMeta);
        });

    document.getElementById('collectionCount').textContent=records.length+' RECORDS IN COLLECTION';

    buildGrid();
    window.refreshLibraryStyles(data,loadVersion);
}



async function loadUserFromUrl(){
    var username=GroovyRouteState.profileUsernameFromPath(window.location.pathname);

    if(!username)return window.loadCollection();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const sessionUser=session&&session.user;
    window.hasAuthenticatedUser=!!sessionUser;
    const unresolvedState=GroovyRouteState.resolveProfileView(sessionUser,null);

    if(unresolvedState==='login-required'){
        viewedUserId='profile-route';
        records=[];
        window.loginRequiredForViewedCollection=true;
        window.profileNotFound=false;
        document.getElementById('viewedUserHeader').style.display='none';
        document.getElementById('collectionCount').textContent='0 RECORDS';
        buildGrid();
        return;
    }

    const {data:user,error}=await supabaseClient
        .from('profiles')
        .select('id')
        .ilike('username',username)
        .maybeSingle();

    if(error){
        console.error('Kunde inte hitta användaren:',error);
        return;
    }

    if(!user){
        viewedUserId='profile-route';
        records=[];
        window.loginRequiredForViewedCollection=false;
        window.profileNotFound=true;
        document.getElementById('viewedUserHeader').style.display='none';
        document.getElementById('collectionCount').textContent='0 RECORDS';
        buildGrid();
        return;
    }

    const resolvedState=GroovyRouteState.resolveProfileView(sessionUser,user);

    if(resolvedState==='own'){
        history.replaceState({},'','/'+(window.libraryView==='wishlist'?'?view=wishlist':''));
        await window.loadCollection();
        return;
    }

    window.loginRequiredForViewedCollection=false;
    window.profileNotFound=false;
    await loadOtherUserCollection(user.id);
}

window.addEventListener('popstate',function(){
    renderCurrentRoute();
});

const scrollTopButton=document.getElementById('scrollTopButton');
let scrollTopUpdatePending=false;

function updateScrollTopButton(){
    scrollTopUpdatePending=false;
    const scrollPosition=window.scrollY||document.documentElement.scrollTop||0;
    scrollTopButton.classList.toggle('visible',scrollPosition>420);
}

window.addEventListener('scroll',function(){
    if(scrollTopUpdatePending)return;
    scrollTopUpdatePending=true;
    window.requestAnimationFrame(updateScrollTopButton);
},{passive:true});

scrollTopButton.addEventListener('click',function(){
    const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:0,left:0,behavior:reduceMotion?'auto':'smooth'});
});

async function renderCurrentRoute(){
    window.dispatchEvent(new Event('groovy-route-change'));
    window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);
    await updateAuthUI();
    notificationController.closePanel();
    var routeUser=await currentSessionUser();
    if(!routeUser&&(window.location.pathname!=='/'||window.location.search||window.location.hash)){
        history.replaceState({},'','/');
        window.libraryView='collection';
    }
    if(!routeUser){
        socialController.hideFollowingPage();
        viewedUserId=null;
        window.loginRequiredForViewedCollection=false;
        window.profileNotFound=false;
        await window.loadCollection();
        return;
    }
    if(/^\/following\/?$/.test(window.location.pathname)){
        await socialController.renderFollowingPage();
        return;
    }
    socialController.hideFollowingPage();
    await loadUserFromUrl();
}

renderCurrentRoute();
updateScrollTopButton();

/* SHELVES V6.13 - portrait phone behavior */
(function(){
  /* Browsers do not universally allow a normal web page to physically lock orientation, so we combine a supported lock request with a landscape blocker. */
  var portraitGuard=document.createElement('div');
  portraitGuard.className='groovy-portrait-guard';
  portraitGuard.setAttribute('aria-hidden','true');
  portraitGuard.innerHTML='<div class="groovy-portrait-guard-card"><div class="groovy-portrait-guard-icon" aria-hidden="true">▯</div><strong>Rotate your phone</strong><span>GroovyShelves is designed for portrait mode.</span></div>';
  document.body.appendChild(portraitGuard);

  function isPhoneLike(){
    var coarse=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
    var shortSide=Math.min(window.screen&&screen.width?screen.width:window.innerWidth,window.screen&&screen.height?screen.height:window.innerHeight);
    return coarse&&shortSide<=600;
  }

  function updatePortraitGuard(){
    var landscape=window.innerWidth>window.innerHeight;
    var show=isPhoneLike()&&landscape;
    portraitGuard.classList.toggle('visible',show);
    portraitGuard.setAttribute('aria-hidden',show?'false':'true');
  }

  function requestPortraitLock(){
    if(!isPhoneLike())return;
    try{
      if(screen.orientation&&typeof screen.orientation.lock==='function'){
        var lockResult=screen.orientation.lock('portrait-primary');
        if(lockResult&&typeof lockResult.catch==='function')lockResult.catch(function(){});
      }
    }catch(error){}
  }

  window.addEventListener('resize',updatePortraitGuard,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(updatePortraitGuard,80);requestPortraitLock();},{passive:true});
  document.addEventListener('pointerdown',requestPortraitLock,{passive:true,once:true});
  updatePortraitGuard();
})();
