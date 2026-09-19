var Router=window.GroovyRouter;
if(!Router)throw new Error('GroovyRouter must load before app.js');
var UserProfileCore=window.GroovyUserProfileCore;
if(!UserProfileCore)throw new Error('GroovyUserProfileCore must load before app.js');
var NotificationCore=window.GroovyNotificationCore;
if(!NotificationCore)throw new Error('GroovyNotificationCore must load before app.js');
var NotificationController=window.GroovyNotificationController;
if(!NotificationController)throw new Error('GroovyNotificationController must load before app.js');
var SocialController=window.GroovySocialController;
if(!SocialController)throw new Error('GroovySocialController must load before app.js');
var CommunityView=window.GroovyCommunityView;
if(!CommunityView)throw new Error('GroovyCommunityView must load before app.js');
var CommunityController=window.GroovyCommunityController;
if(!CommunityController)throw new Error('GroovyCommunityController must load before app.js');
var UserSearchController=window.GroovyUserSearchController;
if(!UserSearchController)throw new Error('GroovyUserSearchController must load before app.js');
var DetailSocialController=window.GroovyDetailSocialController;
if(!DetailSocialController)throw new Error('GroovyDetailSocialController must load before app.js');
var AlbumReviewController=window.GroovyAlbumReviewController;
if(!AlbumReviewController)throw new Error('GroovyAlbumReviewController must load before app.js');
var AppleSearchCore=window.GroovyAppleSearchCore;
if(!AppleSearchCore)throw new Error('GroovyAppleSearchCore must load before app.js');
var AlbumSearch=window.GroovyAlbumSearch;
if(!AlbumSearch)throw new Error('GroovyAlbumSearch must load before app.js');
var PressingCore=window.GroovyPressingCore;
if(!PressingCore)throw new Error('GroovyPressingCore must load before app.js');
var PressingView=window.GroovyPressingView;
var PressingController=window.GroovyPressingController;
if(!PressingController)throw new Error('GroovyPressingController must load before app.js');

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
var communityController=null;
var priceAlertsController=null;

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
    return Router.navigate(url);
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
  onOpenFollowingRoute:function(){return Router.navigate('/following');},
  onBackHome:function(){return Router.navigate('/');},
  onRequireAuth:function(){openAuthPanel('login');Router.replace('/',{}, {render:false});},
  onBeforeFollowingOpen:function(){profileMenu.classList.remove('open');},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var communityAlbumPreviewHandler=null;

var communityView=CommunityView.create({
  window:window,
  document:document,
  elements:{
    page:document.getElementById('communityPage'),
    content:document.getElementById('communityContent')
  },
  escapeHtml:escapeSocialHtml
});

communityController=CommunityController.create({
  api:supabaseClient,
  view:communityView,
  socialController:socialController,
  window:window,
  elements:{
    page:document.getElementById('communityPage'),
    tabs:document.getElementById('libraryTabs'),
    tabButton:document.getElementById('communityTabButton'),
    communityTab:document.getElementById('communityTabButton'),
    collectionTab:document.getElementById('collectionTabButton'),
    wishlistTab:document.getElementById('wishlistTabButton')
  },
  getCurrentUser:currentSessionUser,
  onOpenRoute:function(){return Router.navigate('/community');},
  onNavigateProfile:function(username){return openCollectorRoute(username,'profile');},
  onNavigateShelf:function(username){return openCollectorRoute(username,'collection');},
  onOpenAlbum:function(albumId){
    if(typeof communityAlbumPreviewHandler==='function'){
      return communityAlbumPreviewHandler(albumId);
    }
  },
  onRequireAuth:function(){openAuthPanel('login');return Router.replace('/',{}, {render:false});},
  onBeforeOpen:function(){profileMenu.classList.remove('open');notificationController.closePanel();},
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
    return Router.navigate('/shelf/'+encodeURIComponent(username));
  },
  persistLastSeen:async function(userId,lastSeenAt){
    var result=await supabaseClient.from('user_presence_status')
      .upsert({user_id:userId,last_seen_at:lastSeenAt},{onConflict:'user_id'});
    if(result.error)throw result.error;
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
  onOpenExternal:function(url){window.open(url,'_blank','noopener,noreferrer');},
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

        UserProfileCore.applyAvatar(profileImage,profile&&profile.avatar_url,username);
        UserProfileCore.applyAvatar(profileImageMenu,profile&&profile.avatar_url,username);

        loginEmail.value='';
        loginPassword.value='';
        registerUsername.value='';
        notificationController.syncUser(user);
    }else{
        profileButton.style.display='flex';
        profileMenu.classList.remove('open');
        loginPanel.classList.remove('open');

        UserProfileCore.applyAvatar(profileImage,'/assets/images/avatar-placeholder.png','');
        UserProfileCore.applyAvatar(profileImageMenu,'/assets/images/avatar-placeholder.png','');
        notificationController.syncUser(null);
    }
    if(communityController)communityController.syncUser(user);
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

        UserProfileCore.applyAvatar(profileImage,avatarUrl,profileUsername.textContent);
        UserProfileCore.applyAvatar(profileImageMenu,avatarUrl,profileUsername.textContent);

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

    if(!UserProfileCore.validUsername(username)){
        alert('Användarnamnet måste vara 3–30 tecken och får bara innehålla bokstäver, siffror, punkt, bindestreck och understreck.');
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
    await Router.replace('/');
});

var authRouteUserId='';
var authRouteStateInitialized=false;

supabaseClient.auth.onAuthStateChange(function(event,session){
    var nextUserId=session&&session.user&&session.user.id?String(session.user.id):'';
    var sameUser=authRouteStateInitialized&&nextUserId===authRouteUserId;

    authRouteStateInitialized=true;
    authRouteUserId=nextUserId;

    // Supabase may refresh or re-announce the same session when a browser tab
    // becomes active again. That must not reload the current Groovy route.
    if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED'||(event==='SIGNED_IN'&&sameUser)){
        return;
    }

    setTimeout(function(){
        renderCurrentRoute();
    },0);
});

var LibraryData=window.GroovyLibraryData;
if(!LibraryData)throw new Error('GroovyLibraryData must load before app.js');
var libraryData=LibraryData.create({
  api:supabaseClient,
  recordModel:window.GroovyRecord
});

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
var MarketplaceAlertController=window.GroovyMarketplaceAlertController;
var PushNotifications=window.GroovyPushNotifications;
var PriceAlertsPageController=window.GroovyPriceAlertsPageController;
var ShelfCore=window.GroovyShelfCore;
var ShelfView=window.GroovyShelfView;
var ShelfController=window.GroovyShelfController;
var LibraryCore=window.GroovyLibraryCore;
var LibraryStyleRefresh=window.GroovyLibraryStyleRefresh;
var LibraryActionsController=window.GroovyLibraryActionsController;
var LibraryRenderController=window.GroovyLibraryRenderController;
var GridSortController=window.GroovyGridSortController;
var SelectionController=window.GroovySelectionController;
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
if(!MarketplaceAlertController)throw new Error('GroovyMarketplaceAlertController must load before app.js');
if(!PushNotifications)throw new Error('GroovyPushNotifications must load before app.js');
if(!PriceAlertsPageController)throw new Error('GroovyPriceAlertsPageController must load before app.js');
if(!ShelfCore)throw new Error('GroovyShelfCore must load before app.js');
if(!ShelfView)throw new Error('GroovyShelfView must load before app.js');
if(!ShelfController)throw new Error('GroovyShelfController must load before app.js');
if(!LibraryCore)throw new Error('GroovyLibraryCore must load before app.js');
if(!LibraryStyleRefresh)throw new Error('GroovyLibraryStyleRefresh must load before app.js');
if(!LibraryActionsController)throw new Error('GroovyLibraryActionsController must load before app.js');
if(!LibraryRenderController)throw new Error('GroovyLibraryRenderController must load before app.js');
if(!GridSortController)throw new Error('GroovyGridSortController must load before app.js');
if(!SelectionController)throw new Error('GroovySelectionController must load before app.js');

window.records = [];
window.viewedUserId=null;
window.hasAuthenticatedUser=false;
window.loginRequiredForViewedCollection=false;
window.profileNotFound=false;
window.collectionLoadVersion=0;
window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);

window.albumIdentityKey=GroovyRouteState.albumIdentityKey;

window.emptyRecordSides=Record.emptySides;
window.loadWishlist=async function(userId){
  var loadVersion=++window.collectionLoadVersion;
  var wishlistResult=await libraryData.fetchWishlist(userId);
  var data=wishlistResult.data;
  var error=wishlistResult.error;

  if(error){
    console.error('Kunde inte hämta önskelistan:',error);
    return;
  }

  var albumIds=libraryData.albumIds(data);
  var userResult=await supabaseClient.auth.getUser();
  var sessionUser=userResult&&userResult.data?userResult.data.user:null;
  var ownRatingUserId=sessionUser&&sessionUser.id?sessionUser.id:null;
  var ratingMeta=await ratingController.loadData(albumIds,ownRatingUserId);

  if(loadVersion!==window.collectionLoadVersion)return;

  records=libraryData.mapWishlistRows(data,ratingMeta);

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

  var ownProfile=null;
  try{
    var profileResult=await supabaseClient
      .from('profiles')
      .select('username,avatar_url')
      .eq('id',user.id)
      .maybeSingle();
    if(!profileResult.error&&profileResult.data)ownProfile=profileResult.data;
  }catch(error){
    console.warn('Kunde inte hämta profil för egen hylla:',error);
  }

  var ownUsername=ownProfile&&ownProfile.username
    ?ownProfile.username
    :(user.user_metadata&&user.user_metadata.username
      ?user.user_metadata.username
      :(user.email?user.email.split('@')[0]:'User'));
  UserProfileCore.applyAvatar(viewedUserAvatar,ownProfile&&ownProfile.avatar_url,ownUsername);
  viewedUserName.textContent='Your Shelf';
  viewedUserContext.textContent=window.libraryView==='wishlist'?'Wishlist':'Collection';
  window.groovyViewedStatisticsProfile={
    id:user.id,
    username:ownUsername,
    avatar_url:ownProfile&&ownProfile.avatar_url?ownProfile.avatar_url:''
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

  var collectionResult=await libraryData.fetchCollection(user.id);
  var collectionData=collectionResult.data;
  var collectionError=collectionResult.error;

    if(collectionError){
        console.error('Kunde inte hämta samlingen:',collectionError);
        return;
    }


    
  var albumIds=libraryData.albumIds(collectionData);

  var ratingMeta=await ratingController.loadData(albumIds,user.id);

  if(loadVersion!==window.collectionLoadVersion)return;

  records=libraryData.mapCollectionRows(collectionData,ratingMeta);

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
var detailReviews=document.getElementById('detailReviews');
var albumReviewController=null;
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
    if(albumReviewController)albumReviewController.refresh();
  },
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});
window.loadAlbumRatingData=ratingController.loadData;
window.applyAlbumRatingMeta=Record.applyRatingMeta;
window.groovyRenderAlbumRating=ratingController.renderDetail;
window.groovyRenderGridRating=ratingController.renderGridRating;
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
    reviews:detailReviews,
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

albumReviewController=AlbumReviewController.create({
  api:supabaseClient,
  recordModel:Record,
  rootElement:detailReviews,
  window:window,
  document:document,
  getCurrentUser:currentSessionUser,
  getOpenRecordIndex:function(){return detailOpenRecordIndex;},
  onNavigate:function(username){
    closeAlbum();
    openCollectorRoute(username,'profile');
  },
  onRatingChanged:async function(detail){
    var user=await currentSessionUser();
    if(!user||!detail||!detail.albumId)return;

    var ratingMap=await ratingController.loadData([detail.albumId],user.id);

    for(var i=0;i<records.length;i++){
      if(Number(Record.albumId(records[i]))!==Number(detail.albumId))continue;
      Record.applyRatingMeta(records[i],ratingMap);
    }

    if(detailPreviewRecord&&Number(Record.albumId(detailPreviewRecord))===Number(detail.albumId)){
      Record.applyRatingMeta(detailPreviewRecord,ratingMap);
    }

    if(detailOpenRecordIndex===SEARCH_PREVIEW_INDEX&&detailPreviewRecord){
      ratingController.renderPreview(detailPreviewRecord);
    }else if(
      detailOpenRecordIndex>=0&&
      records[detailOpenRecordIndex]&&
      Number(Record.albumId(records[detailOpenRecordIndex]))===Number(detail.albumId)
    ){
      ratingController.renderDetail(detailOpenRecordIndex);
    }

    var cards=collection?collection.querySelectorAll('.record'):[];
    for(var c=0;c<cards.length;c++){
      var cardIndex=parseInt(cards[c].getAttribute('data-index'),10);
      var cardRecord=records[cardIndex];
      if(!cardRecord||Number(Record.albumId(cardRecord))!==Number(detail.albumId))continue;
      var coverRating=cards[c].querySelector('.cover-rating');
      if(coverRating){
        coverRating.innerHTML=ratingController.renderGridRating(Record.ownRating(cardRecord));
      }
    }

    window.dispatchEvent(new CustomEvent('groovy-rating-updated',{
      detail:{albumId:detail.albumId,index:detail.index,source:'review'}
    }));
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
var marketplaceAlertButton=document.getElementById('marketplaceAlertButton');
var marketplaceAlertButtonTitle=document.getElementById('marketplaceAlertButtonTitle');
var marketplaceAlertButtonSummary=document.getElementById('marketplaceAlertButtonSummary');
var marketplaceAlertModal=document.getElementById('marketplaceAlertModal');
var marketplaceAlertForm=document.getElementById('marketplaceAlertForm');
var closeMarketplaceAlert=document.getElementById('closeMarketplaceAlert');
var marketplaceAlertTitle=document.getElementById('marketplaceAlertTitle');
var marketplaceAlertSubtitle=document.getElementById('marketplaceAlertSubtitle');
var marketplaceAlertPrice=document.getElementById('marketplaceAlertPrice');
var marketplaceAlertCurrency=document.getElementById('marketplaceAlertCurrency');
var marketplaceAlertTradera=document.getElementById('marketplaceAlertTradera');
var marketplaceAlertEbay=document.getElementById('marketplaceAlertEbay');
var marketplaceAlertFixed=document.getElementById('marketplaceAlertFixed');
var marketplaceAlertAuction=document.getElementById('marketplaceAlertAuction');
var marketplaceAlertStatus=document.getElementById('marketplaceAlertStatus');
var deleteMarketplaceAlert=document.getElementById('deleteMarketplaceAlert');
var cancelMarketplaceAlert=document.getElementById('cancelMarketplaceAlert');
var saveMarketplaceAlert=document.getElementById('saveMarketplaceAlert');
var copyDetails=document.getElementById('copyDetails');
var copyDetailsTitle=document.getElementById('copyDetailsTitle');
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
var libraryPage=1;
var RECORDS_PER_PAGE=52;
var librarySearchInput=document.getElementById('librarySearchInput');
var librarySortButton=document.getElementById('librarySortButton');
var librarySortMenu=document.getElementById('librarySortMenu');
var librarySelectButton=document.getElementById('librarySelectButton');
var selectionActionBar=document.getElementById('selectionActionBar');
var selectionCount=document.getElementById('selectionCount');
var selectionMoveButton=document.getElementById('selectionMoveButton');
var selectionRemoveShelfButton=document.getElementById('selectionRemoveShelfButton');
var selectionAddCollectionButton=document.getElementById('selectionAddCollectionButton');
var selectionDeleteButton=document.getElementById('selectionDeleteButton');
var selectionCancelButton=document.getElementById('selectionCancelButton');
var mobileAddRecordButton=document.getElementById('mobileAddRecordButton');
var librarySearchQuery='';
var librarySort='standard';
var shelves=[];
var activeShelfId='all';
var selectionController=null;
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
var detailLibraryRemoveButton=document.getElementById('detailLibraryRemoveButton');
var detailSocialContext=document.getElementById('detailSocialContext');
var SEARCH_PREVIEW_INDEX=1000000000;
var detailOpenRecordIndex=-1;
var detailPreviewRecord=null;
var detailPreviewPayload=null;

function detailRecordAt(index){
  return index===SEARCH_PREVIEW_INDEX?detailPreviewRecord:(records[index]||null);
}

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
  recordModel:Record,
  window:window,
  document:document,
  element:detailSocialContext,
  getCurrentUser:currentSessionUser,
  getViewedUserId:function(){return viewedUserId;},
  getViewedUsername:function(){
    var profile=window.groovyViewedStatisticsProfile;
    return profile&&profile.username?profile.username:'';
  },
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
  return ShelfCore.recordCount(records,id,Record.shelfId);
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
  requestFrame:function(callback){return requestAnimationFrame(callback);},alert:function(message){alert(message);},
  onDetailActionsRendered:function(index,container){renderDetailLibraryActions(index,container);},
  onBulkAssign:function(entryIds,shelfId){
    if(!libraryActionsController)return Promise.resolve(false);
    return libraryActionsController.moveCollectionRecordsToShelf(entryIds,shelfId);
  },
  onBulkAssigned:function(){
    if(selectionController)selectionController.deactivate();
  }
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
        document.getElementById('removeAlbumMessage').textContent='Are you sure you want to remove "'+Record.title(records[index])+'" from your collection?';
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

var libraryStyleRefresh=LibraryStyleRefresh.create({
  api:supabaseClient,
  storage:localStorage,
  recordModel:Record,
  discogsStyleLabel:discogsStyleLabel,
  getRecords:function(){return records;},
  getLibraryView:function(){return window.libraryView;},
  getViewedUserId:function(){return viewedUserId;},
  getLoadVersion:function(){return window.collectionLoadVersion;},
  renderGrid:function(){buildGrid();},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

function refreshLibraryStyles(rows,loadVersion){
  return libraryStyleRefresh.refresh(rows,loadVersion);
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
  recordModel:Record,
  getRecord:detailRecordAt,
  getArtist:function(record){return Record.artist(record);},
  getTitle:function(record){return Record.title(record);},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var pushNotifications=PushNotifications.create({
  api:supabaseClient,
  window:window,
  navigator:navigator,
  getCurrentUser:currentSessionUser,
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var marketplaceAlertController=MarketplaceAlertController.create({
  elements:{
    button:marketplaceAlertButton,
    buttonTitle:marketplaceAlertButtonTitle,
    buttonSummary:marketplaceAlertButtonSummary,
    modal:marketplaceAlertModal,
    form:marketplaceAlertForm,
    closeButton:closeMarketplaceAlert,
    title:marketplaceAlertTitle,
    subtitle:marketplaceAlertSubtitle,
    priceInput:marketplaceAlertPrice,
    currencySelect:marketplaceAlertCurrency,
    traderaCheckbox:marketplaceAlertTradera,
    ebayCheckbox:marketplaceAlertEbay,
    fixedCheckbox:marketplaceAlertFixed,
    auctionCheckbox:marketplaceAlertAuction,
    status:marketplaceAlertStatus,
    deleteButton:deleteMarketplaceAlert,
    cancelButton:cancelMarketplaceAlert,
    saveButton:saveMarketplaceAlert
  },
  api:supabaseClient,
  storage:localStorage,
  navigator:navigator,
  Intl:Intl,
  recordModel:Record,
  pushNotifications:pushNotifications,
  getCurrentUser:currentSessionUser,
  getRecord:detailRecordAt,
  getAlbumId:function(record){return Record.albumId(record);},
  getArtist:function(record){return Record.artist(record);},
  getTitle:function(record){return Record.title(record);},
  onRequireAuth:function(){openAuthPanel('login');},
  onChanged:function(){
    if(priceAlertsController)priceAlertsController.refreshIfOpen();
  },
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

priceAlertsController=PriceAlertsPageController.create({
  api:supabaseClient,
  window:window,
  document:document,
  navigator:navigator,
  storage:localStorage,
  Intl:Intl,
  request:window.fetch.bind(window),
  elements:{
    menuButton:document.getElementById('priceAlertsButton'),
    profileMenu:profileMenu,
    page:document.getElementById('priceAlertsPage'),
    grid:document.getElementById('priceAlertsGrid'),
    count:document.getElementById('priceAlertsCount'),
    backButton:document.getElementById('priceAlertsBackButton'),
    traderaToggle:document.getElementById('priceAlertsShowTradera'),
    ebayToggle:document.getElementById('priceAlertsShowEbay'),
    currencySelect:document.getElementById('priceAlertsCurrencySelect'),
    selectButton:document.getElementById('priceAlertsSelectButton'),
    deleteSelectedButton:document.getElementById('priceAlertsDeleteSelectedButton')
  },
  getCurrentUser:currentSessionUser,
  onOpenRoute:function(){profileMenu.classList.remove('open');return Router.navigate('/price-alerts');},
  onBackHome:function(){return Router.navigate('/');},
  onRequireAuth:function(){openAuthPanel('login');return Router.replace('/',{}, {render:false});},
  onEdit:function(alert,album){
    var record=Record.fromSearchPreview({
      artist:album.artist,
      title:album.title,
      coverUrl:album.coverUrl,
      albumId:album.id,
      appleUrl:album.appleUrl
    });
    marketplaceAlertController.openForRecordData(record,alert);
  },
  onOpenAlbum:function(alert,album){
    if(album&&album.id&&typeof communityAlbumPreviewHandler==='function'){
      return communityAlbumPreviewHandler(album.id);
    }
  },
  onOpenMarketplace:function(alert,album,marketplace){
    var record=Record.fromSearchPreview({
      artist:album.artist,
      title:album.title,
      coverUrl:album.coverUrl,
      albumId:album.id,
      appleUrl:album.appleUrl
    });
    marketplaceController.openMarketplaceForRecord(record,marketplace);
  },
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var pressingController=PressingController.create({
  api:supabaseClient,
  recordModel:Record,
  document:document,
  elements:{
    root:copyDetails,
    title:copyDetailsTitle,
    content:copyDetailsContent,
    toggle:copyDetailsToggle,
    summary:copyDetailsSummary,
    saved:copyDetailsSaved,
    albumOverlay:albumOverlay,
    pressingModal:pressingModal,
    closePressingModalButton:closePressingModalButton,
    pressingLoading:pressingLoading,
    pressingForm:pressingForm,
    pressingError:pressingError,
    pressingCountry:pressingCountry,
    pressingYear:pressingYear,
    pressingLabel:pressingLabel,
    pressingCatalogNumber:pressingCatalogNumber,
    pressingMatrixSearch:pressingMatrixSearch,
    pressingMatrixQuery:pressingMatrixQuery,
    pressingMatrixSearchButton:pressingMatrixSearchButton,
    pressingMatches:pressingMatches,
    clearPressingModal:document.getElementById('clearPressingModal'),
    clearPressingMessage:document.getElementById('clearPressingMessage'),
    cancelClearPressing:document.getElementById('cancelClearPressing'),
    confirmClearPressing:document.getElementById('confirmClearPressing')
  },
  getRecords:function(){return records;},
  getViewedUserId:function(){return viewedUserId;},
  getViewedUsername:function(){
    var profile=window.groovyViewedStatisticsProfile;
    return profile&&profile.username?profile.username:'';
  },
  getLibraryView:function(){return window.libraryView;},
  renderGrid:function(){buildGrid();},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

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

var gridSortController=GridSortController.create({
  api:supabaseClient,
  window:window,
  document:document,
  navigator:navigator,
  collection:collection,
  recordModel:Record,
  recordsPerPage:RECORDS_PER_PAGE,
  getRecords:function(){return records;},
  setRecords:function(nextRecords){records=nextRecords;},
  getState:function(){
    return {
      selectedRating:selectedRating,
      searchQuery:librarySearchQuery,
      sort:librarySort,
      viewedUserId:viewedUserId,
      libraryView:window.libraryView,
      activeShelfId:activeShelfId,
      page:libraryPage,
      selectionMode:!!(selectionController&&selectionController.isActive())
    };
  },
  setSuppressAlbumClick:function(value){suppressAlbumClick=!!value;},
  setDeleteMode:function(active){setDeleteMode(active);},
  renderGrid:function(){buildGrid();},
  loadCollection:function(){return window.loadCollection();},
  onAlert:function(message){alert(message);},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

var libraryRenderController=LibraryRenderController.create({
  window:window,
  document:document,
  libraryCore:LibraryCore,
  recordModel:Record,
  pressingView:PressingView,
  ratingRenderer:ratingController,
  recordsPerPage:RECORDS_PER_PAGE,
  elements:{
    collection:collection,
    paginationTop:document.getElementById('libraryPaginationTop'),
    paginationBottom:document.getElementById('libraryPaginationBottom'),
    searchInput:librarySearchInput,
    mobileAddRecordButton:mobileAddRecordButton,
    emptyCollection:document.getElementById('emptyCollection'),
    loginToViewCollection:document.getElementById('loginToViewCollection'),
    profileNotFound:document.getElementById('profileNotFound'),
    emptyViewedCollection:document.getElementById('emptyViewedCollection'),
    emptyWishlist:document.getElementById('emptyWishlist'),
    emptyWishlistTitle:document.getElementById('emptyWishlistTitle'),
    emptyWishlistText:document.getElementById('emptyWishlistText'),
    emptyWishlistAddButton:document.getElementById('emptyWishlistAddButton'),
    libraryTabs:document.getElementById('libraryTabs'),
    libraryTitle:document.getElementById('libraryTitle'),
    collectionTabButton:document.getElementById('collectionTabButton'),
    wishlistTabButton:document.getElementById('wishlistTabButton'),
    addAlbumButton:document.getElementById('addAlbumButton'),
    filterButton:document.getElementById('filterButton'),
    selectButton:librarySelectButton,
    collectionCount:document.getElementById('collectionCount')
  },
  getState:function(){
    return {
      records:records,
      viewedUserId:viewedUserId,
      libraryView:window.libraryView,
      loginRequiredForViewedCollection:window.loginRequiredForViewedCollection,
      profileNotFound:window.profileNotFound,
      hasAuthenticatedUser:window.hasAuthenticatedUser,
      viewedUsername:window.groovyViewedStatisticsProfile&&window.groovyViewedStatisticsProfile.username,
      activeShelfId:activeShelfId,
      selectedRating:selectedRating,
      searchQuery:librarySearchQuery,
      sort:librarySort,
      page:libraryPage
    };
  },
  setPage:function(page){libraryPage=page;},
  setSearchQuery:function(query){librarySearchQuery=query;},
  shelfById:shelfById,
  shelfIconSvg:shelfIconSvg,
  escapeHtml:esc,
  spotifyAlbumLink:spotifyAlbumLink,
  appleMusicAlbumLink:appleMusicAlbumLink,
  renderShelfStrip:function(){renderShelfStrip();},
  updateLibraryTabLabels:updateLibraryTabLabels,
  shouldShowLoggedOutLanding:shouldShowLoggedOutLanding,
  renderLoggedOutLanding:renderLoggedOutLanding,
  restoreEmptyCollectionMarkup:restoreEmptyCollectionMarkup,
  attachWishlistRemoveControls:attachWishlistRemoveControls,
  attachRecordActionMenus:attachRecordActionMenus,
  attachAlbumClicks:attachAlbumClicks,
  enableGridSorting:gridSortController.enable,
  onRendered:function(){if(selectionController)selectionController.syncCards();}
});

function buildGrid(){
  return libraryRenderController.render();
}
window.buildGrid=buildGrid;

function setSearchPreviewActionState(addButton,wishlistButton,status){
  if(!addButton||!wishlistButton)return;
  if(status==='collection'){
    addButton.textContent='✓ In collection';
    addButton.disabled=true;
    wishlistButton.textContent='In collection';
    wishlistButton.disabled=true;
  }else if(status==='wishlist'){
    addButton.textContent='On wishlist';
    addButton.disabled=true;
    wishlistButton.textContent='✓ Wishlisted';
    wishlistButton.disabled=true;
  }
}

function renderSearchPreviewActions(payload){
  if(!detailShelfActions)return;
  detailShelfActions.innerHTML='';
  detailShelfActions.hidden=false;

  var addButton=document.createElement('button');
  addButton.type='button';
  addButton.className='detail-shelf-button primary';
  addButton.textContent='Add Record';

  var wishlistButton=document.createElement('button');
  wishlistButton.type='button';
  wishlistButton.className='detail-shelf-button secondary';
  wishlistButton.innerHTML='<span class="wishlist-icon" aria-hidden="true"></span>Wishlist';

  if(payload&&payload.isAdded)setSearchPreviewActionState(addButton,wishlistButton,'collection');
  else if(payload&&payload.isWishlisted)setSearchPreviewActionState(addButton,wishlistButton,'wishlist');

  addButton.addEventListener('click',async function(event){
    event.preventDefault();
    event.stopPropagation();
    if(!payload||typeof payload.save!=='function')return;
    var status=await payload.save('collection',addButton);
    if(status){
      payload.isAdded=status==='collection';
      payload.isWishlisted=status==='wishlist';
      setSearchPreviewActionState(addButton,wishlistButton,status);
    }
  });

  wishlistButton.addEventListener('click',async function(event){
    event.preventDefault();
    event.stopPropagation();
    if(!payload||typeof payload.save!=='function')return;
    var status=await payload.save('wishlist',wishlistButton);
    if(status){
      payload.isAdded=status==='collection';
      payload.isWishlisted=status==='wishlist';
      setSearchPreviewActionState(addButton,wishlistButton,status);
    }
  });

  detailShelfActions.appendChild(addButton);
  detailShelfActions.appendChild(wishlistButton);
}

function renderAlbumDetail(record,index,options){
  options=options||{};
  if(!record)return;

  var searchPreview=!!options.searchPreview;
  detailOpenRecordIndex=index;
  marketplaceController.openForRecord(index);
  marketplaceAlertController.openForRecord(index);
  pressingController.resetRecord();

  var isWishlist=!searchPreview&&window.libraryView==='wishlist';
  detailNumber.hidden=!isWishlist;
  detailNumber.textContent=isWishlist?'Wishlisted':'';

  var artist=Record.artist(record);
  var title=Record.title(record);
  detailArtist.innerHTML=esc(artist);
  detailAlbum.innerHTML=esc(title);
  detailYear.innerHTML=esc(Record.year(record));
  var genreLabel=Record.genre(record)||'Genre saknas';
  detailGenre.textContent=genreLabel;
  detailGenre.setAttribute('data-mobile-genre',genreLabel.split(' · ')[0]||genreLabel);

  if(searchPreview){
    copyDetails.hidden=true;
  }else{
    pressingController.render(index);
  }

  detailCover.src=Record.coverUrl(record);
  detailCover.alt=artist+' - '+title;

  var detailAppleMusicLink=document.getElementById('detailAppleMusicLink');
  var detailSpotifyLink=document.getElementById('detailSpotifyLink');
  if(detailAppleMusicLink){
    detailAppleMusicLink.href=appleMusicAlbumLink(record);
    detailAppleMusicLink.setAttribute('aria-label','Listen to '+title+' by '+artist+' on Apple Music');
  }
  detailSpotifyLink.href=spotifyAlbumLink(record);
  detailSpotifyLink.setAttribute('aria-label','Find '+title+' by '+artist+' on Spotify');
  wikipediaAboutController.openForRecord(record);

  if(searchPreview){
    ratingController.renderPreview(record);
    if(detailShelfStatus){detailShelfStatus.hidden=true;detailShelfStatus.innerHTML='';detailShelfStatus.classList.remove('unshelved');}
    if(detailLibraryRemoveButton){detailLibraryRemoveButton.hidden=true;detailLibraryRemoveButton.dataset.index='';}
    renderSearchPreviewActions(options.payload||null);
    detailSocialController.openForRecord(record,index,{searchPreview:true});
  }else{
    ratingController.renderDetail(index);
    renderDetailShelfStatus(index);
    renderDetailShelfActions(index);
    detailSocialController.openForRecord(record,index);
  }

  detailTracklistController.openForRecord(record,index);
  albumReviewController.openForRecord(record,index);

  albumOverlay.className='album-overlay visible'+(searchPreview?' search-preview':'');
  document.body.style.overflow='hidden';
  detailLayoutController.syncOpen();
}

function openAlbum(index){
  var record=records[index];
  if(!record)return;
  detailPreviewRecord=null;
  detailPreviewPayload=null;
  renderAlbumDetail(record,index,{searchPreview:false});
}

async function hydrateSearchAlbumPreview(record){
  var masterId=String(Record.discogsMasterId(record)||'').trim();
  var albumId=Number(Record.albumId(record))||0;
  if(!masterId&&!albumId)return;

  try{
    var query=supabaseClient
      .from('albums')
      .select('id,release_year,genre,cover_url,apple_collection_url,tracks(id,disc_side,track_number,title,duration)');
    query=albumId?query.eq('id',albumId):query.eq('discogs_master_id',masterId);
    var result=await query.maybeSingle();

    if(result.error)throw result.error;
    if(detailPreviewRecord!==record||detailOpenRecordIndex!==SEARCH_PREVIEW_INDEX||!result.data)return;

    var album=result.data;
    Record.setValue(record,'albumId',album.id||null);
    if(!Record.year(record)&&album.release_year)Record.setValue(record,'year',album.release_year);
    if(!Record.genre(record)&&album.genre)Record.setValue(record,'genre',album.genre);
    if(!Record.appleUrl(record)&&album.apple_collection_url)Record.setValue(record,'appleUrl',album.apple_collection_url);
    if(!Record.coverUrl(record)&&album.cover_url)Record.setValue(record,'coverUrl',album.cover_url);
    if(Array.isArray(album.tracks)&&album.tracks.length){
      Record.replaceTrackRows(record,album.tracks);
      detailTracklistController.render(record);
    }

    var user=await currentSessionUser();
    if(detailPreviewRecord!==record||detailOpenRecordIndex!==SEARCH_PREVIEW_INDEX)return;
    var ratingMap=await ratingController.loadData([album.id],user&&user.id);
    if(detailPreviewRecord!==record||detailOpenRecordIndex!==SEARCH_PREVIEW_INDEX)return;
    Record.applyRatingMeta(record,ratingMap);
    ratingController.renderPreview(record);

    detailYear.textContent=Record.year(record)||'';
    var genreLabel=Record.genre(record)||'Genre saknas';
    detailGenre.textContent=genreLabel;
    detailGenre.setAttribute('data-mobile-genre',genreLabel.split(' · ')[0]||genreLabel);
    albumReviewController.openForRecord(record,SEARCH_PREVIEW_INDEX);
  }catch(error){
    console.warn('Could not hydrate search album preview:',error);
  }
}

function openSearchAlbumPreview(payload){
  if(!payload)return;
  var masterId=String(payload.master&&payload.master.id||'').trim();
  var albumId=Number(payload.albumId)||null;
  if(!masterId&&!albumId)return;

  detailPreviewPayload=payload;
  detailPreviewRecord=Record.fromSearchPreview({
    artist:payload.artist,
    title:payload.albumTitle,
    year:payload.year,
    genre:payload.genre,
    coverUrl:payload.coverState&&payload.coverState.url?payload.coverState.url:'',
    albumId:albumId,
    discogsMasterId:masterId,
    appleUrl:payload.coverState&&payload.coverState.appleCollectionUrl?payload.coverState.appleCollectionUrl:''
  });

  renderAlbumDetail(detailPreviewRecord,SEARCH_PREVIEW_INDEX,{
    searchPreview:true,
    payload:payload
  });
  hydrateSearchAlbumPreview(detailPreviewRecord);
}
window.groovyOpenSearchAlbumPreview=openSearchAlbumPreview;

function closeAlbum(){
  wikipediaAboutController.close();
  marketplaceController.close();
  marketplaceAlertController.close();
  albumOverlay.className='album-overlay';
  document.body.style.overflow='';
  pressingController.closeDetails();
  detailOpenRecordIndex=-1;
  detailPreviewRecord=null;
  detailPreviewPayload=null;
  if(detailShelfActions){detailShelfActions.hidden=true;detailShelfActions.innerHTML='';}
  if(detailShelfStatus){detailShelfStatus.hidden=true;detailShelfStatus.innerHTML='';detailShelfStatus.classList.remove('unshelved');}
  detailSocialController.close();
  albumReviewController.close();
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

var libraryActionsController=LibraryActionsController.create({
  api:supabaseClient,
  recordModel:Record,
  getRecords:function(){return records;},
  getViewedUserId:function(){return viewedUserId;},
  getLibraryView:function(){return window.libraryView;},
  invalidateSearchState:function(){invalidateSearchLibraryState();},
  loadCollection:function(){return window.loadCollection();},
  resetPage:function(){libraryPage=1;},
  renderShelfStrip:function(){renderShelfStrip();},
  renderGrid:function(){buildGrid();},
  onAlert:function(message){alert(message);},
  onLog:function(level,message,error){
    if(level==='error')console.error(message,error||'');
    else if(level==='warn')console.warn(message,error||'');
    else console.log(message,error||'');
  }
});

selectionController=SelectionController.create({
  recordModel:Record,
  elements:{
    body:document.body,
    collection:collection,
    selectButton:librarySelectButton,
    actionBar:selectionActionBar,
    count:selectionCount,
    moveButton:selectionMoveButton,
    removeShelfButton:selectionRemoveShelfButton,
    addCollectionButton:selectionAddCollectionButton,
    deleteButton:selectionDeleteButton,
    cancelButton:selectionCancelButton
  },
  getRecords:function(){return records;},
  getContext:function(){
    return {libraryView:window.libraryView,activeShelfId:activeShelfId};
  },
  canActivate:function(){
    return viewedUserId===null&&window.hasAuthenticatedUser&&records.length>0;
  },
  onModeChange:function(){
    closeRecordActionMenus();
    buildGrid();
  },
  onMove:function(entryIds){
    return shelfController.openBulkPicker(entryIds);
  },
  onRemoveShelf:async function(entryIds){
    var moved=await libraryActionsController.moveCollectionRecordsToShelf(entryIds,null);
    if(moved&&selectionController)selectionController.deactivate();
    return moved;
  },
  onAddToCollection:async function(entryIds){
    var moved=await libraryActionsController.moveWishlistRecordsToCollection(entryIds);
    if(moved&&selectionController)selectionController.deactivate();
    return moved;
  },
  onDelete:function(entryIds){
    requestBulkRemove(entryIds);
    return true;
  }
});
window.groovyExitSelectionMode=function(){
  if(selectionController)selectionController.deactivate({silent:true});
};

window.groovyGetOpenRecordIndex=function(){return detailOpenRecordIndex;};

function renderDetailLibraryActions(index,container){
  if(!container)return;
  container.querySelectorAll('[data-detail-library-action]').forEach(function(button){button.remove();});

  var record=records[index];
  var canEdit=!!record&&viewedUserId===null;

  if(detailLibraryRemoveButton){
    detailLibraryRemoveButton.hidden=!canEdit;
    detailLibraryRemoveButton.dataset.index=canEdit?String(index):'';
    var removeLabel=window.libraryView==='wishlist'?'Remove from wishlist':'Remove from collection';
    detailLibraryRemoveButton.setAttribute('aria-label',removeLabel);
    detailLibraryRemoveButton.title=removeLabel;
  }

  if(!canEdit){
    if(!container.children.length)container.hidden=true;
    return;
  }

  if(window.libraryView==='wishlist'){
    container.hidden=false;
    var add=document.createElement('button');
    add.type='button';
    add.className='detail-shelf-button primary';
    add.dataset.detailLibraryAction='move';
    add.textContent='Add to collection';
    add.addEventListener('click',async function(event){
      event.preventDefault();event.stopPropagation();
      add.disabled=true;
      var moved=await libraryActionsController.moveWishlistToCollection(index,add);
      if(moved)closeAlbum();
      else add.disabled=false;
    });
    container.appendChild(add);
  }
}

if(detailLibraryRemoveButton){
  detailLibraryRemoveButton.addEventListener('click',function(event){
    event.preventDefault();
    event.stopPropagation();
    var index=parseInt(detailLibraryRemoveButton.dataset.index,10);
    if(!isNaN(index))requestRemoveAlbum(index,true);
  });
}

window.groovyMoveWishlistToCollection=async function(index,button){
  var moved=await libraryActionsController.moveWishlistToCollection(index,button);
  if(moved)closeAlbum();
  return moved;
};

function attachAlbumClicks(){
  if(collection._albumClickAttached)return;
  collection._albumClickAttached=true;

  collection.addEventListener('click',async function(event){
    var target=event.target||event.srcElement;

    if(selectionController&&selectionController.isActive()){
      var selectionRecord=target.closest?target.closest('.record'):null;
      if(selectionRecord){
        event.preventDefault();
        event.stopPropagation();
        var selectionIndex=parseInt(selectionRecord.getAttribute('data-index'),10);
        if(!isNaN(selectionIndex))selectionController.toggleIndex(selectionIndex);
      }
      return;
    }

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

      requestRemoveAlbum(wishlistIndex,false);
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
      await libraryActionsController.moveWishlistToCollection(moveIndex,moveButton);
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
        
        requestRemoveAlbum(index,false);
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
const removeAlbumMessage=document.getElementById('removeAlbumMessage');
const cancelRemoveAlbum=document.getElementById('cancelRemoveAlbum');
const confirmRemoveAlbum=document.getElementById('confirmRemoveAlbum');

let removeAlbumIndex=null;
let removeAlbumIds=[];
let removeAlbumFromDetail=false;

function requestBulkRemove(entryIds){
    var valid={};
    records.forEach(function(record){
      var id=String(Record.entryId(record)||'');
      if(id)valid[id]=true;
    });
    var seen={};
    var ids=(Array.isArray(entryIds)?entryIds:[])
      .map(function(value){return String(value==null?'':value).trim();})
      .filter(function(value){
        if(!value||!valid[value]||seen[value])return false;
        seen[value]=true;
        return true;
      });
    if(!ids.length)return false;
    removeAlbumIndex=null;
    removeAlbumIds=ids;
    removeAlbumFromDetail=false;
    var targetLabel=window.libraryView==='wishlist'?'your wishlist':'your collection';
    removeAlbumMessage.textContent='Remove '+ids.length+' selected record'+(ids.length===1?'':'s')+' from '+targetLabel+'?';
    confirmRemoveAlbum.textContent=ids.length===1?'Remove record':'Remove '+ids.length+' records';
    removeAlbumModal.style.display='flex';
    return true;
}

function requestRemoveAlbum(index,fromDetail){
    var record=records[index];
    if(!record||viewedUserId!==null)return;
    removeAlbumIndex=index;
    removeAlbumIds=[];
    removeAlbumFromDetail=!!fromDetail;
    confirmRemoveAlbum.textContent='Remove';
    removeAlbumMessage.textContent=window.libraryView==='wishlist'
      ?'Remove "'+Record.title(record)+'" from your wishlist?'
      :'Are you sure you want to remove "'+Record.title(record)+'" from your collection?';
    removeAlbumModal.style.display='flex';
}

cancelRemoveAlbum.addEventListener('click',function(){
    removeAlbumModal.style.display='none';
    removeAlbumIndex=null;
    removeAlbumIds=[];
    removeAlbumFromDetail=false;
    confirmRemoveAlbum.textContent='Remove';
});

removeAlbumModal.addEventListener('click',function(event){
    if(event.target===removeAlbumModal){
        removeAlbumModal.style.display='none';
        removeAlbumIndex=null;
        removeAlbumIds=[];
        removeAlbumFromDetail=false;
        confirmRemoveAlbum.textContent='Remove';
    }
});

confirmRemoveAlbum.addEventListener('click',async function(){
    if(removeAlbumIds.length){
      var bulkIds=removeAlbumIds.slice();
      removeAlbumModal.style.display='none';
      removeAlbumIndex=null;
      removeAlbumIds=[];
      removeAlbumFromDetail=false;
      confirmRemoveAlbum.textContent='Remove';
      var bulkRemoved=window.libraryView==='wishlist'
        ?await libraryActionsController.deleteWishlistRecords(bulkIds)
        :await libraryActionsController.deleteCollectionRecords(bulkIds);
      if(bulkRemoved&&selectionController)selectionController.deactivate();
      return;
    }

    if(removeAlbumIndex===null)return;

    const index=removeAlbumIndex;
    const fromDetail=removeAlbumFromDetail;

    removeAlbumModal.style.display='none';
    removeAlbumIndex=null;
    removeAlbumIds=[];
    removeAlbumFromDetail=false;
    confirmRemoveAlbum.textContent='Remove';

    var removed;
    if(window.libraryView==='wishlist'){
      removed=await libraryActionsController.deleteWishlist(index);
    }else{
      removed=await libraryActionsController.deleteCollection(index);
    }
    if(removed&&fromDetail)closeAlbum();
});

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
      document.getElementById('removeAlbumMessage').textContent='Remove "'+Record.title(records[index])+'" from your wishlist?';
      document.getElementById('removeAlbumModal').style.display='flex';
    });
  }
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
    if(albumReviewController&&albumReviewController.handleEscape())return;
    if(marketplaceAlertController&&marketplaceAlertController.handleEscape())return;
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
    librarySort=button.getAttribute('data-sort')||'standard';
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

window.onscroll=libraryRenderController.scheduleImageLoad;

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
        if(window.location.pathname!=='/'||window.location.search){
            await Router.replace('/');
        }else{
            await renderCurrentRoute();
        }
        return;
    }
    libraryPage=1;
    setDeleteMode(false);
    await Router.navigate('/');
});

myCollectionButton.addEventListener('click',async function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user){
        openAuthPanel('login');
        return;
    }

    libraryPage=1;
    setDeleteMode(false);
    await Router.navigate('/');
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
    return Router.navigate(url);
}

function navigateViewedLibrary(nextView){
    var profile=window.groovyViewedStatisticsProfile;
    if(!profile||!profile.username)return;
    libraryPage=1;
    setDeleteMode(false);
    var url='/shelf/'+encodeURIComponent(profile.username);
    if(nextView==='wishlist')url+='?view=wishlist';
    if(window.location.pathname+window.location.search===url)return;
    return Router.navigate(url);
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
  if(!deleteMode&&window.groovyExitSelectionMode)window.groovyExitSelectionMode();
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
    pressingCore:PressingCore,
    onPreview:function(payload){return window.groovyOpenSearchAlbumPreview(payload);}
});
communityAlbumPreviewHandler=function(albumId){
    return albumSearchController.openCatalogPreview(albumId);
};

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

    var viewedUsername=profile&&profile.username
        ?profile.username
        :'Unknown user';
    UserProfileCore.applyAvatar(viewedUserAvatar,profile&&profile.avatar_url,viewedUsername);
    viewedUserName.textContent=viewedUsername;
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

    var collectionResult=await libraryData.fetchCollection(userId);
    var data=collectionResult.data;
    var error=collectionResult.error;

    if(error){
        console.error('Kunde inte hämta användarens samling:',error);
        return;
    }



    var albumIds=libraryData.albumIds(data);

    var {data:{user:sessionUser}}=await supabaseClient.auth.getUser();
    var ownRatingUserId=sessionUser&&sessionUser.id?sessionUser.id:null;
    var albumRatingsMeta=await window.loadAlbumRatingData(albumIds,ownRatingUserId);

     if(loadVersion!==window.collectionLoadVersion)return;

    records=libraryData.mapCollectionRows(data,albumRatingsMeta);

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
        Router.replace('/'+(window.libraryView==='wishlist'?'?view=wishlist':''),{}, {render:false});
        await window.loadCollection();
        return;
    }

    window.loginRequiredForViewedCollection=false;
    window.profileNotFound=false;
    await loadOtherUserCollection(user.id);
}

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
        Router.replace('/',{}, {render:false});
        window.libraryView='collection';
    }
    if(!routeUser){
        communityController.hidePage();
        socialController.hideFollowingPage();
        if(priceAlertsController)priceAlertsController.hidePage();
        viewedUserId=null;
        window.loginRequiredForViewedCollection=false;
        window.profileNotFound=false;
        await window.loadCollection();
        return;
    }
    if(GroovyRouteState.priceAlertsFromPath(window.location.pathname)){
        communityController.hidePage();
        socialController.hideFollowingPage();
        await priceAlertsController.renderPage();
        return;
    }
    if(priceAlertsController)priceAlertsController.hidePage();
    if(/^\/community\/?$/.test(window.location.pathname)){
        socialController.hideFollowingPage();
        await communityController.renderPage();
        return;
    }
    communityController.hidePage();
    if(/^\/following\/?$/.test(window.location.pathname)){
        await socialController.renderFollowingPage();
        return;
    }
    socialController.hideFollowingPage();
    await loadUserFromUrl();
}

Router.setHandler(renderCurrentRoute);
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
