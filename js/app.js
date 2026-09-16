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
const notificationBox=document.getElementById('notificationBox');
const notificationBellButton=document.getElementById('notificationBellButton');
const notificationBadge=document.getElementById('notificationBadge');
const notificationPanel=document.getElementById('notificationPanel');
const notificationList=document.getElementById('notificationList');
const markAllNotificationsRead=document.getElementById('markAllNotificationsRead');
const clearNotificationsButton=document.getElementById('clearNotificationsButton');
const followingButton=document.getElementById('followingButton');
const viewedUserFollowButton=document.getElementById('viewedUserFollowButton');
let notificationChannel=null;
let notificationUserId=null;
let notificationsCache=[];

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

function escapeSocialHtml(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(character){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
}

async function currentSessionUser(){
    const {data:{session}}=await supabaseClient.auth.getSession();
    return session&&session.user?session.user:null;
}

async function groovyFollowingIds(userIds){
    var user=await currentSessionUser();
    if(!user||!Array.isArray(userIds)||!userIds.length)return new Set();
    var ids=userIds.filter(function(id){return id&&id!==user.id;});
    if(!ids.length)return new Set();
    var {data,error}=await supabaseClient.from('user_follows')
      .select('followed_id')
      .eq('follower_id',user.id)
      .in('followed_id',ids);
    if(error){console.warn('Could not load follow status:',error);return new Set();}
    return new Set((data||[]).map(function(row){return row.followed_id;}));
}

window.groovyIsFollowing=async function(targetUserId){
    if(!targetUserId)return false;
    var set=await groovyFollowingIds([targetUserId]);
    return set.has(targetUserId);
};

window.groovyFollowUser=async function(targetUserId){
    var user=await currentSessionUser();
    if(!user)throw new Error('You need to be logged in to follow collectors.');
    if(!targetUserId||targetUserId===user.id)return false;
    var {error}=await supabaseClient.from('user_follows').insert({follower_id:user.id,followed_id:targetUserId});
    if(error&&error.code!=='23505')throw error;
    window.dispatchEvent(new CustomEvent('groovy-follow-changed',{detail:{userId:targetUserId,following:true}}));
    return true;
};

window.groovyUnfollowUser=async function(targetUserId){
    var user=await currentSessionUser();
    if(!user)throw new Error('You need to be logged in.');
    if(!targetUserId)return false;
    var {error}=await supabaseClient.from('user_follows').delete()
      .eq('follower_id',user.id)
      .eq('followed_id',targetUserId);
    if(error)throw error;
    window.dispatchEvent(new CustomEvent('groovy-follow-changed',{detail:{userId:targetUserId,following:false}}));
    return true;
};

async function setFollowButtonState(button,targetUserId,isFollowing){
    if(!button)return;
    button.dataset.following=isFollowing?'true':'false';
    button.classList.toggle('following',isFollowing);
    button.textContent=isFollowing?'Following':'Follow';
    button.setAttribute('aria-label',(isFollowing?'Unfollow ':'Follow ')+(button.dataset.username||'collector'));
    button.dataset.userId=targetUserId||'';
}

function setViewedUserFollowState(targetUserId,username,isFollowing){
    if(!viewedUserFollowButton)return;
    viewedUserFollowButton.dataset.userId=targetUserId||'';
    viewedUserFollowButton.dataset.username=username||'collector';
    viewedUserFollowButton.dataset.following=isFollowing?'true':'false';
    viewedUserFollowButton.classList.toggle('following',isFollowing);
    viewedUserFollowButton.setAttribute('aria-label',(isFollowing?'Unfollow ':'Follow ')+(username||'collector'));
    var label=viewedUserFollowButton.querySelector('.viewed-action-label');
    var icon=viewedUserFollowButton.querySelector('.viewed-follow-icon');
    if(label)label.textContent=isFollowing?'Following':'Follow';
    if(icon)icon.textContent=isFollowing?'✓':'+';
}

function relativeNotificationTime(value){
    var time=new Date(value).getTime();
    if(!time)return '';
    var seconds=Math.max(0,Math.floor((Date.now()-time)/1000));
    if(seconds<60)return 'now';
    var minutes=Math.floor(seconds/60);
    if(minutes<60)return minutes+'m';
    var hours=Math.floor(minutes/60);
    if(hours<24)return hours+'h';
    var days=Math.floor(hours/24);
    if(days<7)return days+'d';
    return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

function closeNotificationPanel(){
    if(!notificationPanel||!notificationBellButton)return;
    notificationPanel.classList.remove('open');
    notificationPanel.setAttribute('aria-hidden','true');
    notificationBellButton.setAttribute('aria-expanded','false');
}

function updateNotificationBadge(){
    if(!notificationBadge)return;
    var unread=notificationsCache.filter(function(item){return !item.read_at;}).length;
    notificationBadge.textContent=unread>99?'99+':String(unread);
    notificationBadge.hidden=unread===0;
    if(notificationBellButton)notificationBellButton.classList.toggle('has-unread',unread>0);
}

function notificationCopy(item){
    var actor=item.actor&&item.actor.username?item.actor.username:'A collector';
    var payload=item.payload||{};
    if(item.notification_type==='new_follower')return '<strong>'+escapeSocialHtml(actor)+'</strong> started following you.';
    if(item.notification_type==='collection_activity'){
        var count=Math.max(1,parseInt(item.item_count,10)||1);
        var sharedCount=Math.max(0,parseInt(payload.shared_count,10)||0);
        if(count===1&&payload.album_title){
            var single='<strong>'+escapeSocialHtml(actor)+'</strong> added <em>'+escapeSocialHtml(payload.album_title)+'</em> to their collection.';
            if(sharedCount>0)single+=' <b class="notification-shared">You have this too</b>';
            return single;
        }
        var grouped='<strong>'+escapeSocialHtml(actor)+'</strong> added '+count+' records to their collection.';
        if(sharedCount===1)grouped+=' <b class="notification-shared">1 is also in your collection</b>';
        if(sharedCount>1)grouped+=' <b class="notification-shared">'+sharedCount+' are also in your collection</b>';
        return grouped;
    }
    if(item.notification_type==='wishlist_match'){
        var wishlistCount=Math.max(1,parseInt(item.item_count,10)||1);
        if(wishlistCount===1&&payload.album_title){
            return '<strong>'+escapeSocialHtml(actor)+'</strong> added <em>'+escapeSocialHtml(payload.album_title)+'</em> to their wishlist. <b class="notification-shared">It is in your collection</b>';
        }
        return '<strong>'+escapeSocialHtml(actor)+'</strong> added '+wishlistCount+' records to their wishlist that you already own. <b class="notification-shared">Collection match</b>';
    }
    return '<strong>'+escapeSocialHtml(actor)+'</strong> has new activity.';
}

function renderNotifications(){
    if(!notificationList)return;
    updateNotificationBadge();
    if(!notificationsCache.length){
        notificationList.innerHTML='<div class="notification-empty"><span>All caught up</span><p>Updates from collectors you follow will appear here.</p></div>';
        return;
    }
    notificationList.innerHTML=notificationsCache.map(function(item){
        var actor=item.actor||{};
        return '<button class="notification-item'+(item.read_at?'':' unread')+'" type="button" data-notification-id="'+item.id+'" data-username="'+escapeSocialHtml(actor.username||'')+'" data-type="'+escapeSocialHtml(item.notification_type||'')+'">'+
          '<span class="notification-avatar" style="background-image:url(&quot;'+escapeSocialHtml(actor.avatar_url||'/avatar_placeholder.png')+'&quot;)"></span>'+
          '<span class="notification-item-copy"><span>'+notificationCopy(item)+'</span><small>'+escapeSocialHtml(relativeNotificationTime(item.updated_at||item.created_at))+'</small></span>'+
          '<i aria-hidden="true"></i>'+
        '</button>';
    }).join('');
}

async function loadNotifications(){
    var user=await currentSessionUser();
    if(!user){notificationsCache=[];renderNotifications();return;}
    var {data,error}=await supabaseClient.from('notifications')
      .select('id,notification_type,item_count,payload,created_at,updated_at,read_at,actor:profiles!notifications_actor_id_fkey(id,username,avatar_url)')
      .eq('recipient_id',user.id)
      .order('updated_at',{ascending:false})
      .limit(30);
    if(error){console.warn('Could not load notifications:',error);return;}
    notificationsCache=data||[];
    renderNotifications();
}

async function markNotificationRead(id){
    var item=notificationsCache.find(function(entry){return String(entry.id)===String(id);});
    if(item&&!item.read_at)item.read_at=new Date().toISOString();
    renderNotifications();
    var user=await currentSessionUser();
    if(!user)return;
    await supabaseClient.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',user.id).is('read_at',null);
}

async function syncNotificationSubscription(user){
    if(!notificationBox)return;
    if(!user){
        notificationBox.hidden=true;
        notificationUserId=null;
        notificationsCache=[];
        renderNotifications();
        if(notificationChannel){try{await supabaseClient.removeChannel(notificationChannel);}catch(error){}notificationChannel=null;}
        return;
    }
    notificationBox.hidden=false;
    if(notificationUserId===user.id&&notificationChannel){await loadNotifications();return;}
    if(notificationChannel){try{await supabaseClient.removeChannel(notificationChannel);}catch(error){}notificationChannel=null;}
    notificationUserId=user.id;
    await loadNotifications();
    notificationChannel=supabaseClient.channel('groovy-notifications-'+user.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'recipient_id=eq.'+user.id},function(){loadNotifications();})
      .subscribe();
}

function openCollectorRoute(username,view){
    if(!username)return;
    var url=view==='profile'?'/profile/'+encodeURIComponent(username):'/shelf/'+encodeURIComponent(username);
    if(view==='wishlist')url+='?view=wishlist';
    history.pushState({},'',url);
    renderCurrentRoute();
}

function ensureFollowingPage(){
    var page=document.getElementById('followingPage');
    if(page)return page;
    page=document.createElement('section');
    page.id='followingPage';
    page.className='following-page';
    page.hidden=true;
    page.innerHTML='<div class="following-shell">'+
      '<div class="following-heading"><div><span class="following-kicker">YOUR COMMUNITY</span><h1>Following</h1><p>Collectors you follow, their libraries and the records you have in common.</p></div><button id="followingBackButton" type="button">Back to My Shelf</button></div>'+
      '<div id="followingGrid" class="following-grid"></div>'+
    '</div>';
    document.body.appendChild(page);
    page.querySelector('#followingBackButton').addEventListener('click',function(){history.pushState({},'','/');renderCurrentRoute();});
    page.querySelector('#followingGrid').addEventListener('click',async function(event){
        var unfollow=event.target.closest('[data-unfollow-user]');
        if(unfollow){
            event.preventDefault();event.stopPropagation();
            var id=unfollow.getAttribute('data-unfollow-user');
            unfollow.disabled=true;unfollow.textContent='Unfollowing...';
            try{await window.groovyUnfollowUser(id);await renderFollowingPage();}
            catch(error){console.error('Could not unfollow:',error);unfollow.disabled=false;unfollow.textContent='Unfollow';}
            return;
        }
        var shelf=event.target.closest('[data-shelf-username]');
        if(shelf){
            event.preventDefault();
            openCollectorRoute(shelf.getAttribute('data-shelf-username'),'collection');
            return;
        }
        var open=event.target.closest('[data-profile-username]');
        if(open){
            event.preventDefault();
            openCollectorRoute(open.getAttribute('data-profile-username'),'profile');
        }
    });
    return page;
}

function hideFollowingPage(){
    var page=document.getElementById('followingPage');
    if(page)page.hidden=true;
    document.body.classList.remove('following-page-open');
}

async function renderFollowingPage(){
    var page=ensureFollowingPage();
    var grid=page.querySelector('#followingGrid');
    var user=await currentSessionUser();
    if(!user){
        hideFollowingPage();
        openAuthPanel('login');
        history.replaceState({},'','/');
        return;
    }
    page.hidden=false;
    document.body.classList.add('following-page-open');
    grid.innerHTML='<div class="following-loading"><span></span><strong>Loading collectors...</strong></div>';
    var {data,error}=await supabaseClient.rpc('get_following_overview');
    if(error){
        console.error('Could not load following:',error);
        grid.innerHTML='<div class="following-empty"><strong>Could not load following.</strong><span>Make sure the social migration has been run in Supabase.</span></div>';
        return;
    }
    if(!data||!data.length){
        grid.innerHTML='<div class="following-empty"><strong>You are not following anyone yet.</strong><span>Use Search User or visit a collector profile to follow someone.</span></div>';
        return;
    }
    grid.innerHTML=data.map(function(item){
        return '<article class="following-card">'+
          '<button class="following-identity" type="button" data-profile-username="'+escapeSocialHtml(item.username||'')+'">'+
            '<span class="following-avatar" style="background-image:url(&quot;'+escapeSocialHtml(item.avatar_url||'/avatar_placeholder.png')+'&quot;)"></span>'+
            '<span><strong>'+escapeSocialHtml(item.username||'Collector')+'</strong><small>Following since '+escapeSocialHtml(new Date(item.followed_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))+'</small></span>'+
          '</button>'+
          '<div class="following-stats">'+
            '<div><strong>'+Number(item.collection_count||0)+'</strong><span>Records</span></div>'+
            '<div><strong>'+Number(item.wishlist_count||0)+'</strong><span>Wishlist</span></div>'+
            '<div><strong>'+Number(item.common_count||0)+'</strong><span>In common</span></div>'+
          '</div>'+
          '<div class="following-actions"><button type="button" data-profile-username="'+escapeSocialHtml(item.username||'')+'">View Profile</button><button type="button" data-shelf-username="'+escapeSocialHtml(item.username||'')+'">View Shelf</button><button class="following-unfollow" type="button" data-unfollow-user="'+escapeSocialHtml(item.user_id||'')+'">Unfollow</button></div>'+
        '</article>';
    }).join('');
}

if(notificationBox)notificationBox.addEventListener('click',function(event){event.stopPropagation();});
if(notificationBellButton)notificationBellButton.addEventListener('click',async function(event){
    event.preventDefault();event.stopPropagation();
    profileMenu.classList.remove('open');
    var open=!notificationPanel.classList.contains('open');
    notificationPanel.classList.toggle('open',open);
    notificationPanel.setAttribute('aria-hidden',open?'false':'true');
    notificationBellButton.setAttribute('aria-expanded',open?'true':'false');
    if(open)await loadNotifications();
});
if(markAllNotificationsRead)markAllNotificationsRead.addEventListener('click',async function(event){
    event.preventDefault();event.stopPropagation();
    var user=await currentSessionUser();
    if(!user)return;
    var now=new Date().toISOString();
    notificationsCache.forEach(function(item){if(!item.read_at)item.read_at=now;});
    renderNotifications();
    var {error}=await supabaseClient.from('notifications').update({read_at:now}).eq('recipient_id',user.id).is('read_at',null);
    if(error)console.warn('Could not mark notifications read:',error);
});
if(clearNotificationsButton)clearNotificationsButton.addEventListener('click',async function(event){
    event.preventDefault();event.stopPropagation();
    var user=await currentSessionUser();
    if(!user)return;
    clearNotificationsButton.disabled=true;
    var previous=notificationsCache.slice();
    notificationsCache=[];
    renderNotifications();
    var {error}=await supabaseClient.from('notifications').delete().eq('recipient_id',user.id);
    if(error){
        console.warn('Could not clear notifications:',error);
        notificationsCache=previous;
        renderNotifications();
    }
    clearNotificationsButton.disabled=false;
});
if(notificationList)notificationList.addEventListener('click',async function(event){
    var itemButton=event.target.closest('.notification-item');
    if(!itemButton)return;
    event.preventDefault();event.stopPropagation();
    await markNotificationRead(itemButton.getAttribute('data-notification-id'));
    closeNotificationPanel();
    var username=itemButton.getAttribute('data-username');
    if(username){
        var type=itemButton.getAttribute('data-type');
        openCollectorRoute(username,type==='new_follower'?'profile':(type==='wishlist_match'?'wishlist':'shelf'));
    }
});
if(followingButton)followingButton.addEventListener('click',function(event){
    event.preventDefault();event.stopPropagation();
    profileMenu.classList.remove('open');
    history.pushState({},'','/following');
    renderCurrentRoute();
});

loginClose.addEventListener('click',function(){
    loginPanel.classList.remove('open');
});

profileButton.addEventListener('click',async function(event){
    event.stopPropagation();
    closeNotificationPanel();

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
    closeNotificationPanel();
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
    syncUserPresence(user);

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
            profileImage.style.backgroundImage='url("/avatar_placeholder.png")';
            profileImage.style.backgroundSize='cover';
            profileImage.style.backgroundPosition='center';
        
            profileImageMenu.style.backgroundImage='url("/avatar_placeholder.png")';
            profileImageMenu.style.backgroundSize='cover';
            profileImageMenu.style.backgroundPosition='center';
        }

        loginEmail.value='';
        loginPassword.value='';
        registerUsername.value='';
        syncNotificationSubscription(user);
    }else{
        profileButton.style.display='flex';
        profileMenu.classList.remove('open');
        loginPanel.classList.remove('open');

        profileImage.style.backgroundImage='url("/avatar_placeholder.png")';
        profileImage.style.backgroundSize='cover';
        profileImage.style.backgroundPosition='center';
        
        profileImageMenu.style.backgroundImage='url("/avatar_placeholder.png")';
        profileImageMenu.style.backgroundSize='cover';
        profileImageMenu.style.backgroundPosition='center';
        syncNotificationSubscription(null);
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
    closeNotificationPanel();
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

window.records = [];
window.viewedUserId=null;
window.hasAuthenticatedUser=false;
window.loginRequiredForViewedCollection=false;
window.profileNotFound=false;
window.collectionLoadVersion=0;
window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);

window.albumIdentityKey=GroovyRouteState.albumIdentityKey;

window.emptyRecordSides=function(){
  return {A:[],B:[],C:[],D:[],E:[],F:[],G:[],H:[]};
};

function wishlistRecord(item,index){
  var album=item.albums;
  var sides=window.emptyRecordSides();

  if(Array.isArray(album.tracks)){
    album.tracks
      .sort(function(a,b){
        var sideCompare=String(a.disc_side||'').localeCompare(String(b.disc_side||''));
        return sideCompare||((a.track_number||0)-(b.track_number||0))||((a.id||0)-(b.id||0));
      })
      .forEach(function(track){
        if(!sides[track.disc_side])return;
        sides[track.disc_side].push({
          id:track.id,
          title:track.title||'Okänd låt',
          rating:0
        });
      });
  }

  return [
    index+1,
    album.artists&&album.artists.name
      ?album.artists.name.replace(/\s*\(\d+\)$/,'')
      :'Okänd artist',
    album.title||'Okänd titel',
    album.release_year||'',
    item.discogs_style||album.genre||'',
    0,
    item.cover_url||album.cover_url||'',
    sides,
    album.id,
    item.id,
    album.discogs_master_id||'',
    {},
    album.apple_collection_url||'',
    '',
    null
  ];
}

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

  var avatarUrl='/avatar_placeholder.png';
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


function clampGroovyRating(value){
  var numeric=Number(value);
  if(!isFinite(numeric))numeric=0;
  return Math.max(0,Math.min(5,numeric));
}

function formatCommunityRating(value){
  var numeric=clampGroovyRating(value);
  if(!numeric)return '—';
  var rounded=Math.round(numeric*10)/10;
  return Number.isInteger(rounded)?String(rounded.toFixed(0)):String(rounded.toFixed(1));
}

function ratingFillPercent(value){
  return (clampGroovyRating(value)/5*100).toFixed(1)+'%';
}

function renderStaticStarMeter(value,extraClass){
  var label=(clampGroovyRating(value)||0).toFixed(1)+' out of 5';
  return '<span class="groovy-star-meter'+(extraClass?' '+extraClass:'')+'" style="--rating-fill:'+ratingFillPercent(value)+';" aria-label="'+esc(label)+'">'+
    '<span class="groovy-star-meter-base" aria-hidden="true">★★★★★</span>'+
    '<span class="groovy-star-meter-fill" aria-hidden="true">★★★★★</span>'+
  '</span>';
}

function loadCachedTrackDurations(record){
  if(!record||!record[8])return;
  try{
    var key='groovy-track-durations:'+String(record[10]||record[8]);
    var raw=localStorage.getItem(key);
    if(!raw)return;
    var parsed=JSON.parse(raw);
    if(!parsed||!Array.isArray(parsed.tracks))return;
    applyTrackDurationRows(record,parsed.tracks,false);
  }catch(error){}
}

function persistTrackDurations(record,tracks){
  if(!record||!record[8]||!Array.isArray(tracks)||!tracks.length)return;
  try{
    var key='groovy-track-durations:'+String(record[10]||record[8]);
    localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),tracks:tracks}));
  }catch(error){}
}

function applyTrackDurationRows(record,incomingTracks,overwriteExisting){
  if(!record||!record[7]||!Array.isArray(incomingTracks))return false;
  var changed=false;
  var byKey={};
  incomingTracks.forEach(function(track,index){
    var side=String(track.disc_side||'').toUpperCase();
    var number=track.track_number==null?'':String(track.track_number);
    byKey[side+'|'+number]=Object.assign({__index:index},track);
  });
  Object.keys(record[7]).forEach(function(side){
    var tracks=record[7][side];
    if(!Array.isArray(tracks))return;
    tracks.forEach(function(track,idx){
      var key=String(side).toUpperCase()+'|'+String(track.trackNumber==null?'':track.trackNumber);
      var match=byKey[key]||incomingTracks.find(function(candidate){
        return String(candidate.disc_side||'').toUpperCase()===String(side).toUpperCase()&&Number(candidate.track_number||idx+1)===Number(track.trackNumber||idx+1);
      });
      if(!match)return;
      if(overwriteExisting||!track.duration){
        var nextDuration=String(match.duration||'').trim();
        if(nextDuration&&track.duration!==nextDuration){
          track.duration=nextDuration;
          changed=true;
        }
      }
    });
  });
  return changed;
}

function renderDetailTracklist(record){
  var sides=record&&record[7]||{};
  var sideNames=['A','B','C','D','E','F','G','H'];
  var html='';

  for(var i=0;i<sideNames.length;i++){
    var side=sideNames[i];
    var tracks=sides[side];
    if(!tracks||!tracks.length)continue;

    html+='<section class="track-side">'+
      '<div class="side-title"><span>SIDE</span>'+side+'</div>'+
      '<ol class="tracks-list">';

    for(var j=0;j<tracks.length;j++){
      var track=tracks[j]||{};
      var title=track.title||'Okänd låt';
      var number=track.trackNumber==null?String(j+1).padStart(2,'0'):String(track.trackNumber).padStart(2,'0');
      var duration=String(track.duration||'').trim();
      html+='<li data-track-id="'+esc(track.id||'')+'">'+
        '<span class="track-index">'+esc(number)+'</span>'+
        '<span class="track-title">'+esc(title)+'</span>'+
        '<span class="track-duration">'+esc(duration||'—')+'</span>'+
      '</li>';
    }

    html+='</ol></section>';
  }

  detailTracks.innerHTML=html||'<div style="color:#666;font-size:13px">Ingen låtlista tillagd</div>';
}

async function ensureDetailTrackDurations(record,index){
  if(!record||!record[8])return;
  loadCachedTrackDurations(record);
  if(detailOpenRecordIndex===index)renderDetailTracklist(record);

  var hasMissing=false;
  Object.keys(record[7]||{}).forEach(function(side){
    (record[7][side]||[]).forEach(function(track){
      if(!String(track.duration||'').trim())hasMissing=true;
    });
  });

  if(!hasMissing)return;
  var masterId=String(record[10]||'').trim();
  if(!masterId)return;

  try{
    var result=await supabaseClient.functions.invoke('discogs-search',{body:{action:'master',masterId:masterId}});
    var discogsData=result&&result.data?result.data:null;
    var discogsError=result&&result.error?result.error:null;
    if(discogsError)throw discogsError;

    var finalTracklist=Array.isArray(discogsData&&discogsData.tracklist)?discogsData.tracklist:[];
    var hasDiscSides=finalTracklist.some(function(track){
      var position=String(track&&track.position||'').toUpperCase();
      return /^[A-H]\d/.test(position);
    });

    if(!hasDiscSides){
      var vinylResult=await supabaseClient.functions.invoke('discogs-search',{body:{action:'vinylRelease',masterId:masterId}});
      if(vinylResult&&vinylResult.data&&Array.isArray(vinylResult.data.tracklist)&&vinylResult.data.tracklist.length){
        finalTracklist=vinylResult.data.tracklist;
      }
    }

    var incoming=discogsTrackRows(record[8],finalTracklist,true);
    if(!incoming.length)return;
    var changed=applyTrackDurationRows(record,incoming,false);
    persistTrackDurations(record,incoming);
    if(changed&&detailOpenRecordIndex===index)renderDetailTracklist(record);
  }catch(error){
    console.warn('Could not hydrate track durations:',error);
  }
}

async function loadAlbumRatingData(albumIds,ownUserId){
  var ids=Array.from(new Set((albumIds||[]).filter(Boolean)));
  if(!ids.length)return {};

  var map={};
  ids.forEach(function(id){
    map[id]={ownRating:0,communityAverage:0,communityCount:0};
  });

  var ratingsResponse=await supabaseClient
    .from('album_ratings')
    .select('album_id,user_id,rating')
    .in('album_id',ids);

  if(ratingsResponse.error){
    console.error('Kunde inte hämta albumratings:',ratingsResponse.error);
    return map;
  }

  (ratingsResponse.data||[]).forEach(function(row){
    var entry=map[row.album_id]||(map[row.album_id]={ownRating:0,communityAverage:0,communityCount:0});
    var rating=clampGroovyRating(row.rating);
    if(!rating)return;
    entry.communityTotal=(entry.communityTotal||0)+rating;
    entry.communityCount=(entry.communityCount||0)+1;
    if(ownUserId&&row.user_id===ownUserId)entry.ownRating=rating;
  });

  Object.keys(map).forEach(function(id){
    var entry=map[id];
    entry.communityAverage=entry.communityCount?Math.round((entry.communityTotal||0)/entry.communityCount*10)/10:0;
    delete entry.communityTotal;
  });

  return map;
}

function applyAlbumRatingMeta(record,ratingMap){
  if(!record)return record;
  var meta=ratingMap&&ratingMap[record[8]]?ratingMap[record[8]]:{};
  record[5]=meta&&meta.ownRating?meta.ownRating:0;
  record[15]=meta&&meta.communityAverage?meta.communityAverage:0;
  record[16]=meta&&meta.communityCount?meta.communityCount:0;
  return record;
}

function renderDetailRatingPanels(index){
  var record=records[index];
  if(!record)return;
  var ownRating=clampGroovyRating(record[5]);
  var communityAverage=clampGroovyRating(record[15]);
  var communityCount=parseInt(record[16],10)||0;
  var ownStars='';
  var personIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"></circle><path d="M5.8 19.3c.4-4 2.8-6.2 6.2-6.2s5.8 2.2 6.2 6.2"></path></svg>';
  var communityIcon='<svg viewBox="0 0 28 24" aria-hidden="true"><circle cx="14" cy="6.2" r="2.8"></circle><circle cx="6.6" cy="8.1" r="2.3"></circle><circle cx="21.4" cy="8.1" r="2.3"></circle><path d="M8.4 19.4c.35-4.1 2.45-6.4 5.6-6.4s5.25 2.3 5.6 6.4"></path><path d="M1.9 19.4c.25-3.2 1.9-5.1 4.7-5.1 1.1 0 2 .25 2.8.75M26.1 19.4c-.25-3.2-1.9-5.1-4.7-5.1-1.1 0-2 .25-2.8.75"></path></svg>';

  for(var i=1;i<=5;i++){
    ownStars+='<button class="album-rating-star '+(i<=ownRating?'filled':'empty')+'" type="button" data-rating="'+i+'" aria-label="Rate '+i+' out of 5">★</button>';
  }

  detailRating.innerHTML='<div class="rating-panels">'+
    '<section class="rating-panel rating-panel-your">'+
      '<div class="rating-panel-label"><span class="rating-panel-icon rating-panel-icon-user">'+personIcon+'</span><span>Your rating</span></div>'+
      '<div class="rating-panel-stars" aria-label="Your rating">'+ownStars+'</div>'+
      (ownRating?'':'<div class="rating-panel-footer"><span class="rating-panel-empty-note">Not rated yet</span></div>')+
    '</section>'+
    '<section class="rating-panel rating-panel-community">'+
      '<div class="rating-panel-label"><span class="rating-panel-icon rating-panel-icon-group">'+communityIcon+'</span><span>Community rating</span></div>'+
      '<div class="rating-panel-community-main">'+renderStaticStarMeter(communityAverage,'is-community')+'<strong>'+esc(formatCommunityRating(communityAverage))+'</strong></div>'+
      '<div class="rating-panel-footer"><span class="rating-panel-meta">'+esc(String(communityCount||0))+' rating'+(communityCount===1?'':'s')+'</span></div>'+
    '</section>'+
  '</div>';

  var ratingButtons=detailRating.querySelectorAll('.album-rating-star');
  for(var r=0;r<ratingButtons.length;r++){
    ratingButtons[r].addEventListener('mouseenter',function(){
      var hoverRating=parseInt(this.getAttribute('data-rating'),10);
      for(var i=0;i<ratingButtons.length;i++)ratingButtons[i].classList.toggle('hover-filled',i<hoverRating);
    });
    ratingButtons[r].addEventListener('mouseleave',function(){
      for(var i=0;i<ratingButtons.length;i++)ratingButtons[i].classList.remove('hover-filled');
    });
    ratingButtons[r].addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      saveAlbumRating(index,parseInt(this.getAttribute('data-rating'),10));
    });
    ratingButtons[r].addEventListener('touchend',function(event){
      event.preventDefault();
      event.stopPropagation();
      saveAlbumRating(index,parseInt(this.getAttribute('data-rating'),10));
    },{passive:false});
  }
}

window.loadCollection=async function(){
  var loadVersion=++window.collectionLoadVersion;
  var path=window.location.pathname;

  if(/^\/(?:user|shelf)\/[^\/]+\/?$/.test(path)){
    return;
  }

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

  var ratingMeta=await loadAlbumRatingData(albumIds,user.id);

  if(loadVersion!==window.collectionLoadVersion)return;

  records=collectionData
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

        return applyAlbumRatingMeta([
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
        ],ratingMeta);

    });

  document.getElementById('collectionCount').textContent=records.length+' RECORDS IN COLLECTION';
  buildGrid();
  refreshLibraryStyles(collectionData,loadVersion);
}

var collection=document.getElementById('collection');
var filterButton=document.getElementById('filterButton');
var filterMenu=document.getElementById('filterMenu');
var albumOverlay=document.getElementById('albumOverlay');
var albumDetailElement=albumOverlay?albumOverlay.querySelector('.album-detail'):null;
var albumTracksPanel=albumOverlay?albumOverlay.querySelector('.album-tracks'):null;
var marketplacePanelElement=albumOverlay?albumOverlay.querySelector('.marketplace-panel'):null;
var albumDesktopRightColumn=null;
var albumClose=document.getElementById('albumClose');
var detailCover=document.getElementById('detailCover');
var detailNumber=document.getElementById('detailNumber');
var detailArtist=document.getElementById('detailArtist');
var detailAlbum=document.getElementById('detailAlbum');
var detailYear=document.getElementById('detailYear');
var detailGenre=document.getElementById('detailGenre');
var detailRating=document.getElementById('detailRating');
var detailTracks=document.getElementById('detailTracks');
var detailAboutAlbum=document.getElementById('detailAboutAlbum');
var detailAboutAlbumText=document.getElementById('detailAboutAlbumText');
var detailAboutAlbumBody=document.getElementById('detailAboutAlbumBody');
var detailAboutAlbumToggle=document.getElementById('detailAboutAlbumToggle');
var detailAboutAlbumLink=document.getElementById('detailAboutAlbumLink');

function syncAlbumDesktopColumns(){
  if(!albumDetailElement||!albumTracksPanel||!marketplacePanelElement||!detailAboutAlbum)return;
  var desktop=window.innerWidth>1120;

  if(desktop){
    if(!albumDesktopRightColumn){
      albumDesktopRightColumn=document.createElement('div');
      albumDesktopRightColumn.className='album-desktop-right';
    }
    if(!albumDesktopRightColumn.parentNode)albumDetailElement.appendChild(albumDesktopRightColumn);
    if(albumTracksPanel.parentNode!==albumDesktopRightColumn)albumDesktopRightColumn.appendChild(albumTracksPanel);
    if(marketplacePanelElement.parentNode!==albumDesktopRightColumn)albumDesktopRightColumn.appendChild(marketplacePanelElement);
    return;
  }

  if(albumDesktopRightColumn&&albumTracksPanel.parentNode===albumDesktopRightColumn){
    albumDetailElement.insertBefore(albumTracksPanel,detailAboutAlbum);
  }
  if(albumDesktopRightColumn&&marketplacePanelElement.parentNode===albumDesktopRightColumn){
    if(detailAboutAlbum.nextSibling)albumDetailElement.insertBefore(marketplacePanelElement,detailAboutAlbum.nextSibling);
    else albumDetailElement.appendChild(marketplacePanelElement);
  }
  if(albumDesktopRightColumn&&albumDesktopRightColumn.parentNode){
    albumDesktopRightColumn.parentNode.removeChild(albumDesktopRightColumn);
  }
}

syncAlbumDesktopColumns();

function syncDesktopAlbumMiddleHeight(){
  if(!albumDetailElement)return;
  var main=albumDetailElement.querySelector('.album-detail-main');
  var cover=albumDetailElement.querySelector('.album-detail-cover');
  if(!main||!cover)return;

  if(window.innerWidth<=1120){
    main.style.height='';
    main.style.maxHeight='';
    return;
  }

  var coverHeight=Math.floor(cover.getBoundingClientRect().height||0);
  if(coverHeight>0){
    main.style.height=coverHeight+'px';
    main.style.maxHeight=coverHeight+'px';
  }
}

window.addEventListener('resize',function(){
  syncAlbumDesktopColumns();
  window.requestAnimationFrame(syncDesktopAlbumMiddleHeight);
},{passive:true});
var wikipediaAboutRequestVersion=0;
var wikipediaAlbumCache=new Map();
var WIKIPEDIA_CACHE_TTL=14*24*60*60*1000;
var traderaButton=document.getElementById('traderaButton');
var traderaButtonLabel=document.getElementById('traderaButtonLabel');
var traderaModal=document.getElementById('traderaModal');
var closeTraderaModalButton=document.getElementById('closeTraderaModal');
var traderaModalSubtitle=document.getElementById('traderaModalSubtitle');
var traderaListingsStatus=document.getElementById('traderaListingsStatus');
var traderaListingsGrid=document.getElementById('traderaListingsGrid');
var ebayButton=document.getElementById('ebayButton');
var ebayButtonLabel=document.getElementById('ebayButtonLabel');
var ebayEnabled=ebayButton&&ebayButton.getAttribute('data-enabled')==='true';
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

var view='grid';
var activeIndex=0;
var drag=false;
var selectedRating='all';
var startX=0;
var startY=0;
var startScroll=0;
var scrollTimer=null;
var suppressAlbumClick=false;
var pressingAlbumIndex=-1;
var pressingVersions=[];
var pressingPages=1;
var pressingReleaseCache=new Map();
var pressingMatrixMatches=null;
var copyDetailsExpanded=false;
var copyDetailsRecordKey='';
var traderaAlbumIndex=-1;
var traderaRequestVersion=0;
var traderaListings=[];
var traderaListingCache=new Map();
var ebayAlbumIndex=-1;
var ebayRequestVersion=0;
var ebayListings=[];
var ebayListingCache=new Map();
var marketplacePriceAlbumIndex=-1;
var marketplacePriceFinished={tradera:false,ebay:false};
var marketplacePriceRenderVersion=0;
var marketplaceFxCache=new Map();
var MARKETPLACE_CURRENCY_STORAGE_KEY='groovy-marketplace-currency-v1';
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
var loadedShelfUserId='';
var shelfPickerRecordIndex=-1;
var createShelfReturnRecordIndex=-1;
var selectedShelfIcon='record';
var SHELF_COLORS=['#E85301','#FF3B45','#FF6B4A','#F43F8C','#8B5CF6','#6366F1','#3B82F6','#14B8D4','#10B981','#84CC16','#F5C542','#6B7280','#14B8A6','#F59E0B'];
var selectedShelfColor=SHELF_COLORS[0];
var editingShelfId='';
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
var detailInfoCard=document.querySelector('.detail-info-card');
var detailOpenRecordIndex=-1;
var detailSocialRequestVersion=0;
var detailSocialCache=new Map();

var SHELF_ICON_OPTIONS=[
  {id:'record',label:'Vinyl'},
  {id:'heart',label:'Heart'},
  {id:'music',label:'Music note'},
  {id:'star',label:'Star'},
  {id:'bookmark',label:'Bookmark'},
  {id:'headphones',label:'Headphones'},
  {id:'guitar',label:'Electric guitar'},
  {id:'bolt',label:'Lightning'},
  {id:'flame',label:'Fire'},
  {id:'crown',label:'Crown'},
  {id:'coffee',label:'Coffee'},
  {id:'leaf',label:'Cannabis leaf'},
  {id:'smiley',label:'Smiley'},
  {id:'diamond',label:'Diamond'},
  {id:'radio',label:'Radio'},
  {id:'skull',label:'Skull'},
  {id:'mushroom',label:'Mushroom'},
  {id:'rocket',label:'Rocket'},
  {id:'microphone',label:'Microphone'},
  {id:'eye',label:'Eye'},
  {id:'ufo',label:'UFO'}
];

var SHELF_ICON_ALIASES={film:'radio',sun:'star',moon:'eye',vinyl:'record',lightning:'bolt',fire:'flame',party:'leaf'};

var SHELF_ICON_PATHS={
  record:'<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 3.5a8.5 8.5 0 0 1 7.4 4.3M4.6 16.2A8.5 8.5 0 0 0 12 20.5"></path>',
  heart:'<path d="M20.8 4.7a5.6 5.6 0 0 0-7.9 0L12 5.6l-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.4a5.6 5.6 0 0 0 0-7.9Z"></path>',
  music:'<path d="M9 18V5l10-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="16" cy="16" r="3"></circle>',
  star:'<path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9L12 2.8Z"></path>',
  bookmark:'<path d="M6 3.5h12v17l-6-4-6 4v-17Z"></path>',
  headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><path d="M4 14h3v6H5.5A1.5 1.5 0 0 1 4 18.5V14Zm16 0h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5V14Z"></path>',
  guitar:'<path d="m13.8 10.2 5.8-5.8"></path><path d="m18.2 2.8 3 3-1.6 1.6-3-3 1.6-1.6Z"></path><path d="M14.2 9.8c-1.2-1.2-3.1-1.2-4.3 0l-1 1-2.1-.7-2.7 2.7 1.6 1.6-.7 2.2 2.4 2.4 2.2-.7 1.6 1.6 2.7-2.7-.7-2.1 1-1c1.2-1.2 1.2-3.1 0-4.3Z"></path><path d="m8.4 13.8 2 2"></path><circle cx="9.4" cy="14.8" r=".7"></circle>',
  bolt:'<path d="M13.5 2.5 5.8 13h5.6l-.9 8.5L18.2 11h-5.6l.9-8.5Z"></path>',
  flame:'<path d="M12 22c4.4 0 8-3.2 8-7.5 0-2.5-1.2-4.7-3.4-6.5.1 2.5-1.2 4-2.6 4.5.2-4.3-2-7.8-5.3-10.5.3 3.8-1.7 6.1-3.2 8.2C4.6 11.6 4 13 4 14.8 4 18.8 7.6 22 12 22Z"></path><path d="M9.2 18.2c0-1.8 1.1-3.3 2.8-5 1.7 1.7 2.8 3.2 2.8 5"></path>',
  crown:'<path d="m3.5 7 4.2 4 4.3-6 4.3 6 4.2-4-1.5 11H5L3.5 7Z"></path><path d="M6 21h12"></path>',
  coffee:'<path d="M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"></path><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2"></path><path d="M8 4c0 1 1 1 1 2M12 3c0 1 1 1 1 2"></path>',
  leaf:'<path d="M12 21v-8"></path><path d="M12 14c-1.7-2.6-3.7-5.7-2.7-10.6 1.9 1.2 2.8 3.6 2.7 6.7.2-3.3.8-6.1 2.9-8.1.9 3.7-.2 6.6-2.3 9.3 2.1-2.4 4.5-4.1 7.4-4.1-.4 2.8-2.6 4.8-6.2 6.2 2.7-.5 5-.1 6.6 1.3-2.1 2-4.7 2-7.5 1.1 1.7 1 2.8 2.2 3.1 3.6-2 .1-3.5-1-4.2-2.7-.7 1.7-2.2 2.8-4.2 2.7.3-1.4 1.4-2.6 3.1-3.6-2.8.9-5.4.9-7.5-1.1 1.6-1.4 3.9-1.8 6.6-1.3-3.6-1.4-5.8-3.4-6.2-6.2 2.9 0 5.3 1.7 7.4 4.1Z"></path>',
  smiley:'<circle cx="12" cy="12" r="9"></circle><path d="M8.5 14.5c.9 1.3 2 2 3.5 2s2.6-.7 3.5-2"></path><path d="M9 9h.01M15 9h.01"></path>',
  diamond:'<path d="m12 2.8 7.5 7.1L12 21.2 4.5 9.9 12 2.8Z"></path><path d="M4.5 9.9h15M9.1 9.9 12 2.8l2.9 7.1L12 21.2 9.1 9.9Z"></path>',
  radio:'<rect x="3" y="6" width="18" height="14" rx="2"></rect><path d="m7 6 10-3"></path><circle cx="15.5" cy="13" r="3"></circle><path d="M6.5 11h3M6.5 14h3M6.5 17h3"></path>',
  skull:'<path d="M5 11a7 7 0 1 1 14 0c0 3-1.4 4.7-3.2 5.7V20H8.2v-3.3C6.4 15.7 5 14 5 11Z"></path><circle cx="9" cy="11" r="1.2"></circle><circle cx="15" cy="11" r="1.2"></circle><path d="M10.5 15h3M10 20v-2M14 20v-2"></path>',
  mushroom:'<path d="M4 11a8 8 0 0 1 16 0H4Z"></path><path d="M10 11v4.3c0 1.6-.8 2.7-2 3.7h8c-1.2-1-2-2.1-2-3.7V11"></path><path d="M8 7h.01M15 8h.01"></path>',
  rocket:'<path d="M12 2.5c3 2.3 4.5 5.4 4.5 8.8V15h-9v-3.7C7.5 7.9 9 4.8 12 2.5Z"></path><circle cx="12" cy="8.8" r="1.6"></circle><path d="M7.5 12.3 5 15.2V18l2.5-1.2M16.5 12.3l2.5 2.9V18l-2.5-1.2"></path><path d="M9.7 15c.1 2.2 1 4.3 2.3 6 1.3-1.7 2.2-3.8 2.3-6"></path>',
  microphone:'<rect x="8" y="3" width="8" height="12" rx="4"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"></path>',
  eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.8"></circle>',
  ufo:'<path d="M8 10a4 4 0 0 1 8 0"></path><path d="M5 11.5c1.6-1 4-1.5 7-1.5s5.4.5 7 1.5c1.1.7 1.1 1.8 0 2.5-1.6 1-4 1.5-7 1.5S6.6 15 5 14c-1.1-.7-1.1-1.8 0-2.5Z"></path><path d="M8 17.5 6.5 20M12 17.5V21M16 17.5l1.5 2.5"></path>'
};

function normalizeShelfIcon(icon){
  var key=String(icon||'record');
  key=SHELF_ICON_ALIASES[key]||key;
  return SHELF_ICON_PATHS[key]?key:'record';
}

function shelfIconSvg(icon){
  var key=normalizeShelfIcon(icon);
  return '<svg class="shelf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+SHELF_ICON_PATHS[key]+'</svg>';
}

function renderShelfIconChoices(){
  if(!shelfIconChoices)return;
  shelfIconChoices.innerHTML=SHELF_ICON_OPTIONS.map(function(item,index){
    return '<button type="button" class="shelf-icon-choice '+(index===0?'selected':'')+'" role="radio" aria-checked="'+(index===0?'true':'false')+'" data-icon="'+item.id+'" aria-label="'+item.label+'" title="'+item.label+'">'+shelfIconSvg(item.id)+'</button>';
  }).join('');
}

renderShelfIconChoices();

function normalizeShelfColor(value){
  var candidate=String(value||'').toUpperCase();
  for(var i=0;i<SHELF_COLORS.length;i++){if(SHELF_COLORS[i].toUpperCase()===candidate)return SHELF_COLORS[i];}
  return SHELF_COLORS[0];
}

function shelfColorRgb(value){
  var color=normalizeShelfColor(value).replace('#','');
  return parseInt(color.slice(0,2),16)+','+parseInt(color.slice(2,4),16)+','+parseInt(color.slice(4,6),16);
}

function shelfColorStyle(shelf){
  var color=normalizeShelfColor(shelf&&shelf.color);
  return '--shelf-color:'+color+';--shelf-rgb:'+shelfColorRgb(color)+';';
}

function syncMobileDetailPairHeight(){
  if(!detailInfoCard)return;
  var cover=document.querySelector('.album-detail-cover');
  var isMobile=window.matchMedia&&window.matchMedia('(max-width: 760px)').matches;

  if(!isMobile||!cover){
    detailInfoCard.style.height='';
    return;
  }

  detailInfoCard.style.height='';
  var height=Math.round(cover.getBoundingClientRect().height||0);
  if(height>0)detailInfoCard.style.height=height+'px';
}

function shelfById(id){
  return shelves.find(function(shelf){return String(shelf.id)===String(id);})||null;
}

function shelfRecordCount(id){
  if(id==='all')return records.length;
  return records.filter(function(record){return String(record[13]||'')===String(id);}).length;
}

window.addEventListener('resize',syncMobileDetailPairHeight,{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',syncMobileDetailPairHeight,{passive:true});

var recordMenuBackdrop=document.createElement('div');
recordMenuBackdrop.className='record-menu-backdrop';
recordMenuBackdrop.setAttribute('aria-hidden','true');
document.body.appendChild(recordMenuBackdrop);

function isMobileRecordMenu(){
  return window.matchMedia&&window.matchMedia('(max-width: 760px)').matches;
}

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

function updateShelfScrollArrows(){
  if(!shelfStrip||!shelfStripScroll)return;
  if(isMobileRecordMenu()){
    shelfStrip.classList.remove('has-overflow');
    return;
  }

  var maxScroll=Math.max(0,shelfStripScroll.scrollWidth-shelfStripScroll.clientWidth);
  var hasOverflow=maxScroll>2;
  shelfStrip.classList.toggle('has-overflow',hasOverflow);
  maxScroll=Math.max(0,shelfStripScroll.scrollWidth-shelfStripScroll.clientWidth);

  if(shelfScrollLeft)shelfScrollLeft.disabled=!hasOverflow||shelfStripScroll.scrollLeft<=2;
  if(shelfScrollRight)shelfScrollRight.disabled=!hasOverflow||shelfStripScroll.scrollLeft>=maxScroll-2;
}

function renderShelfStrip(){
  if(!shelfStrip||!shelfStripScroll)return;

  var hide=window.libraryView==='wishlist'||window.loginRequiredForViewedCollection||window.profileNotFound||(!window.hasAuthenticatedUser&&viewedUserId===null);
  shelfStrip.hidden=hide;
  if(hide){
    shelfStripScroll.innerHTML='';
    shelfStrip.classList.remove('has-overflow');
    if(editShelfButton)editShelfButton.hidden=true;
    if(deleteShelfButton)deleteShelfButton.hidden=true;
    return;
  }

  if(activeShelfId!=='all'&&!shelfById(activeShelfId))activeShelfId='all';

  var html='<button class="shelf-chip '+(activeShelfId==='all'?'active':'')+'" type="button" data-shelf-id="all">'+
    '<span class="shelf-chip-icon" aria-hidden="true">'+shelfIconSvg('record')+'</span><span class="shelf-chip-copy"><strong>All Records</strong><small>'+shelfRecordCount('all')+' records</small></span></button>';

  shelves.forEach(function(shelf){
    html+='<button class="shelf-chip shelf-chip-custom '+(String(activeShelfId)===String(shelf.id)?'active':'')+'" type="button" data-shelf-id="'+esc(shelf.id)+'" style="'+shelfColorStyle(shelf)+'">'+
      '<span class="shelf-chip-icon" aria-hidden="true">'+shelfIconSvg(shelf.icon)+'</span><span class="shelf-chip-copy"><strong>'+esc(shelf.name)+'</strong><small>'+shelfRecordCount(shelf.id)+' records</small></span></button>';
  });

  if(viewedUserId===null){
    if(shelves.length<MAX_SHELVES){
      html+='<button class="shelf-chip shelf-new-button" type="button"><span class="shelf-chip-icon" aria-hidden="true">+</span><span class="shelf-chip-copy"><strong>New Shelf</strong><small>'+shelves.length+' of '+MAX_SHELVES+'</small></span></button>';
    }else{
      html+='<button class="shelf-chip shelf-new-button shelf-limit-button" type="button" disabled><span class="shelf-chip-icon" aria-hidden="true">✓</span><span class="shelf-chip-copy"><strong>Shelf limit</strong><small>'+MAX_SHELVES+' of '+MAX_SHELVES+'</small></span></button>';
    }
  }

  var previousShelfScrollLeft=shelfStripScroll.scrollLeft;
  shelfStripScroll.innerHTML=html;
  shelfStripScroll.scrollLeft=previousShelfScrollLeft;

  shelfStripScroll.querySelectorAll('.shelf-chip[data-shelf-id]').forEach(function(button){
    button.addEventListener('click',function(){
      activeShelfId=button.getAttribute('data-shelf-id')||'all';
      libraryPage=1;
      buildGrid();
    });
  });

  var newShelfButton=shelfStripScroll.querySelector('.shelf-new-button:not(:disabled)');
  if(newShelfButton)newShelfButton.addEventListener('click',function(){openCreateShelfModal(-1);});

  var canManageActiveShelf=viewedUserId===null&&activeShelfId!=='all'&&shelfById(activeShelfId);
  if(editShelfButton)editShelfButton.hidden=!canManageActiveShelf;
  if(deleteShelfButton)deleteShelfButton.hidden=!canManageActiveShelf;

  requestAnimationFrame(updateShelfScrollArrows);
}

window.renderShelfStrip=renderShelfStrip;

window.loadShelvesForUser=async function(userId){
  if(!userId){
    shelves=[];
    activeShelfId='all';
    loadedShelfUserId='';
    renderShelfStrip();
    return;
  }

  if(String(loadedShelfUserId)!==String(userId))activeShelfId='all';
  loadedShelfUserId=String(userId);

  var {data,error}=await supabaseClient
    .from('shelves')
    .select('id,user_id,name,icon,color,sort_order,created_at')
    .eq('user_id',userId)
    .order('sort_order',{ascending:true})
    .order('created_at',{ascending:true});

  if(error){
    console.error('Kunde inte hämta shelves:',error);
    shelves=[];
    activeShelfId='all';
  }else{
    shelves=(data||[]).map(function(shelf){shelf.color=normalizeShelfColor(shelf.color);return shelf;});
    if(activeShelfId!=='all'&&!shelfById(activeShelfId))activeShelfId='all';
  }

  renderShelfStrip();
};

function setShelfIconChoice(icon){
  selectedShelfIcon=normalizeShelfIcon(icon);
  if(!shelfIconChoices)return;
  shelfIconChoices.querySelectorAll('.shelf-icon-choice').forEach(function(button){
    var selected=button.getAttribute('data-icon')===selectedShelfIcon;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-checked',selected?'true':'false');
  });
}

function resetShelfIconChoice(){setShelfIconChoice('record');}

function setShelfColorChoice(color){
  selectedShelfColor=normalizeShelfColor(color);
  if(createShelfModal)createShelfModal.style.setProperty('--shelf-choice-color',selectedShelfColor);
  if(!shelfColorChoices)return;
  shelfColorChoices.querySelectorAll('.shelf-color-choice').forEach(function(button){
    var selected=normalizeShelfColor(button.getAttribute('data-color'))===selectedShelfColor;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-checked',selected?'true':'false');
  });
}

function resetShelfColorChoice(){setShelfColorChoice(SHELF_COLORS[0]);}

function shouldAutofocusShelfModal(){
  return !(window.matchMedia&&window.matchMedia('(max-width: 760px)').matches);
}

function resetShelfModalScroll(){
  var box=createShelfModal&&createShelfModal.querySelector('.shelf-modal-box');
  if(box)box.scrollTop=0;
}

function closeCreateShelfModal(){
  createShelfModal.style.display='none';
  shelfNameInput.value='';
  createShelfStatus.textContent='';
  createShelfReturnRecordIndex=-1;
  editingShelfId='';
  if(createShelfTitle)createShelfTitle.textContent='Create New Shelf';
  if(createShelfDescription)createShelfDescription.textContent='Give your shelf a name, icon and color.';
  if(confirmCreateShelfButton)confirmCreateShelfButton.textContent='Create Shelf';
  resetShelfIconChoice();
  resetShelfColorChoice();
}

function openCreateShelfModal(returnRecordIndex){
  if(viewedUserId!==null)return;
  if(shelves.length>=MAX_SHELVES){
    if(returnRecordIndex>=0){
      shelfPickerStatus.textContent='You can create up to '+MAX_SHELVES+' shelves.';
    }
    return;
  }
  editingShelfId='';
  createShelfReturnRecordIndex=typeof returnRecordIndex==='number'?returnRecordIndex:-1;
  shelfNameInput.value='';
  createShelfStatus.textContent='';
  if(createShelfTitle)createShelfTitle.textContent='Create New Shelf';
  if(createShelfDescription)createShelfDescription.textContent='Give your shelf a name, icon and color.';
  if(confirmCreateShelfButton)confirmCreateShelfButton.textContent='Create Shelf';
  resetShelfIconChoice();
  resetShelfColorChoice();
  createShelfModal.style.display='flex';
  resetShelfModalScroll();
  if(shouldAutofocusShelfModal())setTimeout(function(){shelfNameInput.focus();},0);
}

function openEditShelfModal(){
  if(viewedUserId!==null||activeShelfId==='all')return;
  var shelf=shelfById(activeShelfId);
  if(!shelf)return;

  editingShelfId=String(shelf.id);
  createShelfReturnRecordIndex=-1;
  shelfNameInput.value=String(shelf.name||'');
  createShelfStatus.textContent='';
  if(createShelfTitle)createShelfTitle.textContent='Edit Shelf';
  if(createShelfDescription)createShelfDescription.textContent='Change the shelf name, icon or color.';
  if(confirmCreateShelfButton)confirmCreateShelfButton.textContent='Save Changes';
  setShelfIconChoice(shelf.icon||'record');
  setShelfColorChoice(shelf.color||SHELF_COLORS[0]);
  createShelfModal.style.display='flex';
  resetShelfModalScroll();
  if(shouldAutofocusShelfModal())setTimeout(function(){shelfNameInput.focus();shelfNameInput.select();},0);
}

function closeShelfPicker(){
  shelfPickerModal.style.display='none';
  shelfPickerRecordIndex=-1;
  shelfPickerStatus.textContent='';
}

function renderShelfPicker(index){
  var record=records[index];
  if(!record)return;
  var currentShelf=String(record[13]||'');
  shelfPickerTitle.textContent=currentShelf?'Move to Shelf':'Add to Shelf';
  shelfPickerSubtitle.textContent=currentShelf
    ?'Choose a new shelf for “'+record[2]+'”.'
    :'Choose a shelf for “'+record[2]+'”.';

  var options=shelves.slice();
  shelfPickerList.innerHTML=options.map(function(shelf){
    var id=String(shelf.id||'');
    var selected=id===currentShelf;
    return '<label class="shelf-picker-option shelf-colored '+(selected?'selected':'')+'" style="'+shelfColorStyle(shelf)+'">'+
      '<input type="radio" name="recordShelf" value="'+esc(id)+'" '+(selected?'checked':'')+'>'+ 
      '<span class="shelf-picker-icon" aria-hidden="true">'+shelfIconSvg(shelf.icon)+'</span>'+ 
      '<span class="shelf-picker-name">'+esc(shelf.name)+'</span>'+ 
      '<span class="shelf-choice-check" aria-hidden="true">✓</span>'+ 
    '</label>';
  }).join('');

  if(!options.length){
    shelfPickerList.innerHTML='<div class="shelf-picker-empty">No shelves yet. Create your first shelf below.</div>';
  }

  shelfPickerList.querySelectorAll('input[name="recordShelf"]').forEach(function(input){
    input.addEventListener('change',function(){
      shelfPickerList.querySelectorAll('.shelf-picker-option').forEach(function(option){
        var radio=option.querySelector('input');
        option.classList.toggle('selected',!!(radio&&radio.checked));
      });
    });
  });

  createShelfFromPickerButton.disabled=shelves.length>=MAX_SHELVES;
  createShelfFromPickerButton.textContent=shelves.length>=MAX_SHELVES
    ?MAX_SHELVES+' shelf limit reached'
    :'+ New Shelf';
}

function openShelfPicker(index){
  if(viewedUserId!==null||window.libraryView==='wishlist')return;
  if(!records[index])return;
  shelfPickerRecordIndex=index;
  shelfPickerStatus.textContent='';
  renderShelfPicker(index);
  shelfPickerModal.style.display='flex';
}

function renderDetailShelfStatus(index){
  if(!detailShelfStatus)return;

  var record=records[index];
  if(!record||window.libraryView==='wishlist'){
    detailShelfStatus.hidden=true;
    detailShelfStatus.innerHTML='';
    detailShelfStatus.classList.remove('unshelved');
    return;
  }

  var shelf=shelfById(record[13]);
  var shelfName=shelf&&shelf.name?shelf.name:'no shelf';
  var shelfIcon=shelf?shelfIconSvg(shelf.icon):'';

  detailShelfStatus.hidden=false;
  detailShelfStatus.classList.toggle('unshelved',!shelf);
  detailShelfStatus.innerHTML=
    (shelfIcon?'<span class="detail-shelf-status-icon" aria-hidden="true">'+shelfIcon+'</span>':'')+
    '<strong title="'+esc(shelfName)+'">'+esc(shelfName)+'</strong>';
}

function renderDetailShelfActions(index){
  if(!detailShelfActions)return;

  var record=records[index];
  var canEdit=!!record&&viewedUserId===null&&window.libraryView!=='wishlist';

  if(!canEdit){
    detailShelfActions.hidden=true;
    detailShelfActions.innerHTML='';
    return;
  }

  var hasShelf=!!record[13];
  detailShelfActions.hidden=false;
  detailShelfActions.innerHTML=
    '<button class="detail-shelf-button primary" type="button" data-detail-shelf-action="pick">'+
      (hasShelf?'Move to Shelf':'Add to Shelf')+
    '</button>'+
    (hasShelf
      ?'<button class="detail-shelf-button secondary" type="button" data-detail-shelf-action="remove">Remove from Shelf</button>'
      :'');

  var pickButton=detailShelfActions.querySelector('[data-detail-shelf-action="pick"]');
  if(pickButton){
    pickButton.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      openShelfPicker(index);
    });
  }

  var removeButton=detailShelfActions.querySelector('[data-detail-shelf-action="remove"]');
  if(removeButton){
    removeButton.addEventListener('click',async function(event){
      event.preventDefault();
      event.stopPropagation();
      removeButton.disabled=true;
      try{
        await assignRecordToShelf(index,null);
        renderDetailShelfActions(index);
      }catch(error){
        console.error('Kunde inte ta bort albumet från shelf:',error);
        alert('Could not remove the record from the shelf.\n\n'+(error.message||error));
        removeButton.disabled=false;
      }
    });
  }
}

function compactLocalShelfOrder(shelfId){
  if(!shelfId)return;
  records
    .filter(function(record){return String(record[13]||'')===String(shelfId);})
    .sort(function(a,b){
      var aOrder=parseInt(a[14],10);
      var bOrder=parseInt(b[14],10);
      if(isNaN(aOrder))aOrder=2147483647;
      if(isNaN(bOrder))bOrder=2147483647;
      return aOrder-bOrder||(parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);
    })
    .forEach(function(record,index){record[14]=index+1;});
}

function nextLocalShelfOrder(shelfId,excludedRecord){
  var highest=0;
  records.forEach(function(record){
    if(record===excludedRecord)return;
    if(String(record[13]||'')!==String(shelfId||''))return;
    highest=Math.max(highest,parseInt(record[14],10)||0);
  });
  return highest+1;
}

async function assignRecordToShelf(index,shelfId){
  var record=records[index];
  if(!record||viewedUserId!==null)return false;

  var {data:{session}}=await supabaseClient.auth.getSession();
  var user=session&&session.user;
  if(!user)throw new Error('Du måste vara inloggad.');

  var normalizedShelfId=shelfId||null;
  var oldShelfId=record[13]||'';

  if(String(oldShelfId||'')===String(normalizedShelfId||''))return true;

  var snapshot=records.map(function(item){
    return {record:item,shelfId:item[13]||'',shelfOrder:item[14]==null?null:item[14]};
  });

  var newShelfOrder=normalizedShelfId
    ?nextLocalShelfOrder(normalizedShelfId,record)
    :null;

  record[13]=normalizedShelfId||'';
  record[14]=newShelfOrder;

  if(oldShelfId&&String(oldShelfId)!==String(normalizedShelfId||'')){
    compactLocalShelfOrder(oldShelfId);
  }

  libraryPage=1;
  renderShelfStrip();
  buildGrid();
  if(detailOpenRecordIndex===index){
    renderDetailShelfStatus(index);
    renderDetailShelfActions(index);
  }

  try{
    var {data,error}=await supabaseClient.rpc('move_collection_to_shelf',{
      p_collection_id:String(record[9]),
      p_shelf_id:normalizedShelfId
    });

    if(error)throw error;

    if(data&&data.shelf_sort_order!=null){
      record[14]=parseInt(data.shelf_sort_order,10)||record[14];
    }else if(!normalizedShelfId){
      record[14]=null;
    }

    return true;
  }catch(error){
    snapshot.forEach(function(item){
      item.record[13]=item.shelfId;
      item.record[14]=item.shelfOrder;
    });
    renderShelfStrip();
    buildGrid();
    if(detailOpenRecordIndex===index){
      renderDetailShelfStatus(index);
      renderDetailShelfActions(index);
    }
    throw error;
  }
}

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

if(shelfIconChoices){
  shelfIconChoices.addEventListener('click',function(event){
    var button=event.target.closest('.shelf-icon-choice');
    if(!button)return;
    setShelfIconChoice(button.getAttribute('data-icon')||'record');
  });
}

if(shelfColorChoices){
  shelfColorChoices.addEventListener('click',function(event){
    var button=event.target.closest('.shelf-color-choice');
    if(!button)return;
    setShelfColorChoice(button.getAttribute('data-color'));
  });
}

closeCreateShelfButton.addEventListener('click',closeCreateShelfModal);
cancelCreateShelfButton.addEventListener('click',closeCreateShelfModal);
createShelfModal.addEventListener('click',function(event){if(event.target===createShelfModal)closeCreateShelfModal();});

confirmCreateShelfButton.addEventListener('click',async function(){
  var editingShelf=editingShelfId?shelfById(editingShelfId):null;

  if(!editingShelf&&shelves.length>=MAX_SHELVES){
    createShelfStatus.textContent='You can create up to '+MAX_SHELVES+' shelves.';
    return;
  }

  var name=shelfNameInput.value.trim();
  if(!name){createShelfStatus.textContent='Enter a shelf name.';shelfNameInput.focus();return;}
  if(name.length>30){createShelfStatus.textContent='Use 30 characters or fewer.';return;}
  if(shelves.some(function(shelf){
    return (!editingShelf||String(shelf.id)!==String(editingShelf.id))&&
      String(shelf.name).toLocaleLowerCase()===name.toLocaleLowerCase();
  })){
    createShelfStatus.textContent='You already have a shelf with that name.';
    return;
  }

  confirmCreateShelfButton.disabled=true;
  createShelfStatus.textContent=editingShelf?'Saving…':'Creating…';

  try{
    var {data:{session}}=await supabaseClient.auth.getSession();
    var user=session&&session.user;
    if(!user)throw new Error('Du måste vara inloggad.');

    if(editingShelf){
      var {data:updatedShelf,error:updateError}=await supabaseClient
        .from('shelves')
        .update({name:name,icon:selectedShelfIcon,color:selectedShelfColor})
        .eq('id',editingShelf.id)
        .eq('user_id',user.id)
        .select('id,user_id,name,icon,color,sort_order,created_at')
        .single();

      if(updateError)throw updateError;

      shelves=shelves.map(function(shelf){
        return String(shelf.id)===String(updatedShelf.id)?updatedShelf:shelf;
      });

      closeCreateShelfModal();
      renderShelfStrip();
      buildGrid();
      return;
    }

    var {data,error}=await supabaseClient
      .from('shelves')
      .insert({user_id:user.id,name:name,icon:selectedShelfIcon,color:selectedShelfColor,sort_order:shelves.length+1})
      .select('id,user_id,name,icon,color,sort_order,created_at')
      .single();

    if(error)throw error;
    shelves.push(data);
    shelves.sort(function(a,b){return (a.sort_order||0)-(b.sort_order||0);});
    var returnIndex=createShelfReturnRecordIndex;
    closeCreateShelfModal();

    if(returnIndex>=0&&records[returnIndex]){
      await assignRecordToShelf(returnIndex,data.id);
      if(detailOpenRecordIndex===returnIndex){renderDetailShelfStatus(returnIndex);renderDetailShelfActions(returnIndex);}
    }else{
      activeShelfId=data.id;
      renderShelfStrip();
      buildGrid();
    }
  }catch(error){
    console.error(editingShelf?'Kunde inte uppdatera shelf:':'Kunde inte skapa shelf:',error);
    createShelfStatus.textContent=editingShelf?'Could not update shelf.':'Could not create shelf.';
  }finally{
    confirmCreateShelfButton.disabled=false;
  }
});

function closeDeleteShelfModal(){
  deleteShelfModal.style.display='none';
  deleteShelfStatus.textContent='';
}

function openDeleteShelfModal(){
  if(viewedUserId!==null||activeShelfId==='all')return;
  var shelf=shelfById(activeShelfId);
  if(!shelf)return;
  var count=shelfRecordCount(shelf.id);
  deleteShelfStatus.textContent='';
  deleteShelfMessage.textContent='Delete “'+shelf.name+'”? '+count+' record'+(count===1?'':'s')+' will stay in All Records and become unshelved.';
  deleteShelfModal.style.display='flex';
}

async function deleteActiveShelf(){
  if(viewedUserId!==null||activeShelfId==='all')return;
  var shelf=shelfById(activeShelfId);
  if(!shelf)return;

  confirmDeleteShelfButton.disabled=true;
  deleteShelfStatus.textContent='Deleting…';

  try{
    var {data:{session}}=await supabaseClient.auth.getSession();
    var user=session&&session.user;
    if(!user)throw new Error('Du måste vara inloggad.');

    var {error}=await supabaseClient.rpc('delete_shelf_and_unshelve',{
      p_shelf_id:shelf.id
    });

    if(error)throw error;

    records.forEach(function(record){
      if(String(record[13]||'')===String(shelf.id)){
        record[13]='';
        record[14]=null;
      }
    });
    shelves=shelves.filter(function(item){return String(item.id)!==String(shelf.id);});
    activeShelfId='all';
    libraryPage=1;
    closeDeleteShelfModal();
    renderShelfStrip();
    buildGrid();
  }catch(error){
    console.error('Kunde inte radera shelf:',error);
    deleteShelfStatus.textContent='Could not delete shelf.';
  }finally{
    confirmDeleteShelfButton.disabled=false;
  }
}

if(editShelfButton)editShelfButton.addEventListener('click',openEditShelfModal);
if(deleteShelfButton)deleteShelfButton.addEventListener('click',openDeleteShelfModal);
if(closeDeleteShelfButton)closeDeleteShelfButton.addEventListener('click',closeDeleteShelfModal);
if(cancelDeleteShelfButton)cancelDeleteShelfButton.addEventListener('click',closeDeleteShelfModal);
if(confirmDeleteShelfButton)confirmDeleteShelfButton.addEventListener('click',deleteActiveShelf);
if(deleteShelfModal)deleteShelfModal.addEventListener('click',function(event){if(event.target===deleteShelfModal)closeDeleteShelfModal();});

if(shelfScrollLeft)shelfScrollLeft.addEventListener('click',function(){
  shelfStripScroll.scrollBy({left:-Math.max(260,shelfStripScroll.clientWidth*.65),behavior:'smooth'});
});
if(shelfScrollRight)shelfScrollRight.addEventListener('click',function(){
  shelfStripScroll.scrollBy({left:Math.max(260,shelfStripScroll.clientWidth*.65),behavior:'smooth'});
});
if(shelfStripScroll)shelfStripScroll.addEventListener('scroll',updateShelfScrollArrows,{passive:true});

closeShelfPickerButton.addEventListener('click',closeShelfPicker);
cancelShelfPickerButton.addEventListener('click',closeShelfPicker);
shelfPickerModal.addEventListener('click',function(event){if(event.target===shelfPickerModal)closeShelfPicker();});

createShelfFromPickerButton.addEventListener('click',function(){
  var returnIndex=shelfPickerRecordIndex;
  closeShelfPicker();
  openCreateShelfModal(returnIndex);
});

confirmShelfPickerButton.addEventListener('click',async function(){
  if(shelfPickerRecordIndex<0)return;
  var selected=shelfPickerList.querySelector('input[name="recordShelf"]:checked');
  if(!selected){shelfPickerStatus.textContent='Choose a shelf.';return;}

  var pickerRecordIndex=shelfPickerRecordIndex;
  confirmShelfPickerButton.disabled=true;
  shelfPickerStatus.textContent='Saving…';
  try{
    await assignRecordToShelf(pickerRecordIndex,selected.value);
    if(detailOpenRecordIndex===pickerRecordIndex){renderDetailShelfStatus(pickerRecordIndex);renderDetailShelfActions(pickerRecordIndex);}
    closeShelfPicker();
  }catch(error){
    console.error('Kunde inte flytta albumet till shelf:',error);
    shelfPickerStatus.textContent='Could not save shelf.';
  }finally{
    confirmShelfPickerButton.disabled=false;
  }
});

shelfNameInput.addEventListener('keydown',function(event){
  if(event.key==='Enter')confirmCreateShelfButton.click();
});

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

if(ebayButton)ebayButton.hidden=!ebayEnabled;

function esc(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function discogsStyleLabel(data){
  var values=data&&Array.isArray(data.styles)&&data.styles.length
    ?data.styles
    :(data&&Array.isArray(data.genres)?data.genres:[]);
  var seen={};
  return values.map(function(value){return String(value||'').trim();})
    .filter(function(value){
      var key=value.toLocaleLowerCase();
      if(!value||seen[key])return false;
      seen[key]=true;
      return true;
    })
    .slice(0,2)
    .join(' · ');
}
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

function safeExternalUrl(value){
  try{
    var url=new URL(String(value||''));
    return url.protocol==='https:'||url.protocol==='http:'?url.href:'';
  }catch(error){
    return '';
  }
}

function traderaCacheKey(record){
  return String(record&&record[1]||'').trim().toLowerCase()+'|'+
    String(record&&record[2]||'').trim().toLowerCase();
}

function normalizeTraderaIdentity(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
}

function isRelevantTraderaListing(listing,record){
  var artist=normalizeTraderaIdentity(record&&record[1]);
  var album=normalizeTraderaIdentity(record&&record[2]);
  if(!artist||artist!==album)return true;

  var title=normalizeTraderaIdentity(listing&&listing.title);
  var escaped=artist.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
  var remainder=title
    .replace(new RegExp('\\b'+escaped+'\\b'),' ')
    .replace(new RegExp('\\b'+escaped+'\\b'),' ')
    .replace(/\b(?:self titled|debut|album|vinyl|skiva|gatefold|lp|\d+x?lp|(?:180|200)g)\b/g,' ')
    .replace(/\b(?:19|20)\d{2}\b/g,' ')
    .replace(/\b(?:sweden|swedish|sverige|germany|german|canada|canadian|uk|us|usa|eu|press|pressing|first|1st|original|mono|stereo|sealed|new|ny)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  return !remainder;
}

function marketplaceRegionCurrency(){
  var region='';
  try{
    var locale=(navigator.languages&&navigator.languages[0])||navigator.language||'';
    if(typeof Intl.Locale==='function')region=(new Intl.Locale(locale)).region||'';
    if(!region){var match=String(locale).match(/[-_]([A-Z]{2})\b/i);region=match?match[1].toUpperCase():'';}
  }catch(error){}

  var byRegion={SE:'SEK',NO:'NOK',DK:'DKK',GB:'GBP',US:'USD',CA:'CAD',AU:'AUD',NZ:'NZD',CH:'CHF',JP:'JPY',PL:'PLN',CZ:'CZK',AT:'EUR',BE:'EUR',CY:'EUR',DE:'EUR',EE:'EUR',ES:'EUR',FI:'EUR',FR:'EUR',GR:'EUR',HR:'EUR',IE:'EUR',IT:'EUR',LT:'EUR',LU:'EUR',LV:'EUR',MT:'EUR',NL:'EUR',PT:'EUR',SI:'EUR',SK:'EUR'};
  if(byRegion[region])return byRegion[region];

  try{
    var timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
    if(timezone==='Europe/Stockholm')return 'SEK';
    if(timezone==='Europe/Oslo')return 'NOK';
    if(timezone==='Europe/Copenhagen')return 'DKK';
    if(timezone==='Europe/London')return 'GBP';
    if(timezone==='Europe/Zurich')return 'CHF';
    if(timezone==='Europe/Warsaw')return 'PLN';
    if(timezone==='Europe/Prague')return 'CZK';
    if(/^Europe\//.test(timezone))return 'EUR';
  }catch(error){}
  return 'EUR';
}

function marketplaceCurrencyPreference(){
  try{return localStorage.getItem(MARKETPLACE_CURRENCY_STORAGE_KEY)||'auto';}catch(error){return 'auto';}
}

function marketplaceDisplayCurrency(){
  var preference=marketplaceCurrencyPreference();
  return preference==='auto'?marketplaceRegionCurrency():preference;
}

function syncMarketplaceCurrencyControl(){
  if(!marketplaceCurrencySelect)return;
  var preference=marketplaceCurrencyPreference();
  var autoOption=marketplaceCurrencySelect.querySelector('option[value="auto"]');
  if(autoOption)autoOption.textContent='Auto · '+marketplaceRegionCurrency();
  marketplaceCurrencySelect.value=Array.from(marketplaceCurrencySelect.options).some(function(option){return option.value===preference;})?preference:'auto';
}

function marketplaceFormatMoney(amount,currency){
  if(!isFinite(amount)||amount<=0)return '';
  try{
    return new Intl.NumberFormat((navigator.languages&&navigator.languages[0])||navigator.language||undefined,{style:'currency',currency:String(currency||'EUR').toUpperCase(),currencyDisplay:'narrowSymbol',minimumFractionDigits:0,maximumFractionDigits:String(currency||'').toUpperCase()==='JPY'?0:2}).format(amount);
  }catch(error){return Math.round(amount*100)/100+' '+String(currency||'').toUpperCase();}
}

function marketplaceBuyNowCandidates(listings,marketplace){
  return (listings||[]).map(function(listing){
    var amount=Number(listing&&listing.buyNowPrice||0);
    if(!isFinite(amount)||amount<=0)return null;
    return {amount:amount,currency:String(listing.currency||'EUR').toUpperCase(),marketplace:marketplace,url:safeExternalUrl(listing.url),listing:listing};
  }).filter(Boolean);
}

async function marketplaceFxRate(from,to){
  from=String(from||'').toUpperCase();to=String(to||'').toUpperCase();
  if(!from||!to)throw new Error('Missing currency');
  if(from===to)return 1;
  var key=from+'-'+to;
  var memory=marketplaceFxCache.get(key);
  if(memory&&Date.now()-memory.savedAt<12*60*60*1000)return memory.rate;
  var storageKey='groovy-fx-v1-'+key;
  try{
    var stored=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(stored&&Number(stored.rate)>0&&Date.now()-Number(stored.savedAt)<12*60*60*1000){marketplaceFxCache.set(key,stored);return Number(stored.rate);}
  }catch(error){}

  var response=await fetch('https://api.frankfurter.dev/v2/rate/'+encodeURIComponent(from.toLowerCase())+'/'+encodeURIComponent(to.toLowerCase()),{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('FX rate unavailable');
  var data=await response.json();
  var rate=Number(data&&data.rate);
  if(!isFinite(rate)||rate<=0)throw new Error('Invalid FX rate');
  var cached={rate:rate,savedAt:Date.now()};
  marketplaceFxCache.set(key,cached);
  try{localStorage.setItem(storageKey,JSON.stringify(cached));}catch(error){}
  return rate;
}

function clearMarketplacePriceSummary(){
  marketplacePriceAlbumIndex=-1;
  marketplacePriceFinished={tradera:false,ebay:!ebayEnabled};
  marketplacePriceRenderVersion++;
  traderaListings=[];
  ebayListings=[];
  if(!marketplacePriceSummary)return;
  marketplacePriceSummary.classList.remove('loading','empty','partial','ready');
  if(marketplaceLowestPriceLink){marketplaceLowestPriceLink.hidden=true;marketplaceLowestPriceLink.href='#';}
  if(marketplaceLowestPrice)marketplaceLowestPrice.textContent='';
  if(marketplaceLowestMeta)marketplaceLowestMeta.textContent='';
  if(marketplacePriceStatus){marketplacePriceStatus.hidden=false;marketplacePriceStatus.textContent='Checking fixed prices…';}
  if(marketplacePriceNote)marketplacePriceNote.textContent='Excl. shipping';
}

function resetMarketplacePriceSummary(index){
  marketplacePriceAlbumIndex=index;
  marketplacePriceFinished={tradera:false,ebay:!ebayEnabled};
  marketplacePriceRenderVersion++;
  if(!marketplacePriceSummary)return;
  marketplacePriceSummary.classList.add('loading');
  marketplacePriceSummary.classList.remove('empty','partial','ready');
  marketplaceLowestPriceLink.hidden=true;
  marketplacePriceStatus.hidden=false;
  marketplacePriceStatus.textContent='Checking fixed prices…';
  marketplacePriceNote.textContent='Excl. shipping';
}

async function refreshMarketplaceBestPrice(index){
  if(index!==marketplacePriceAlbumIndex||!marketplacePriceSummary)return;
  if(!marketplacePriceFinished.tradera||!marketplacePriceFinished.ebay)return;
  var renderVersion=++marketplacePriceRenderVersion;
  var candidates=marketplaceBuyNowCandidates(traderaListings,'Tradera');
  if(ebayEnabled)candidates=candidates.concat(marketplaceBuyNowCandidates(ebayListings,'eBay'));
  marketplacePriceSummary.classList.remove('loading','empty','partial','ready');

  if(!candidates.length){
    marketplacePriceSummary.classList.add('empty');
    marketplaceLowestPriceLink.hidden=true;
    marketplacePriceStatus.hidden=false;
    marketplacePriceStatus.textContent='No Buy Now prices found';
    marketplacePriceNote.textContent='Auctions are not included';
    return;
  }

  var target=marketplaceDisplayCurrency();
  var converted=[];
  for(var i=0;i<candidates.length;i++){
    try{
      var rate=await marketplaceFxRate(candidates[i].currency,target);
      if(renderVersion!==marketplacePriceRenderVersion||index!==marketplacePriceAlbumIndex)return;
      converted.push(Object.assign({},candidates[i],{converted:candidates[i].amount*rate}));
    }catch(error){converted.push(Object.assign({},candidates[i],{converted:null}));}
  }
  if(renderVersion!==marketplacePriceRenderVersion||index!==marketplacePriceAlbumIndex)return;

  var comparable=converted.filter(function(item){return isFinite(item.converted)&&item.converted>0;});
  if(candidates.length>1&&comparable.length!==candidates.length){
    marketplacePriceSummary.classList.add('partial');
    marketplaceLowestPriceLink.hidden=true;
    marketplacePriceStatus.hidden=false;
    marketplacePriceStatus.textContent=converted.map(function(item){return item.marketplace+' '+marketplaceFormatMoney(item.amount,item.currency);}).join(' · ');
    marketplacePriceNote.textContent='Currency conversion unavailable';
    return;
  }

  var best=(comparable.length?comparable:converted).slice().sort(function(a,b){
    var av=isFinite(a.converted)?a.converted:a.amount;
    var bv=isFinite(b.converted)?b.converted:b.amount;
    return av-bv;
  })[0];
  var shownAmount=isFinite(best.converted)?best.converted:best.amount;
  var shownCurrency=isFinite(best.converted)?target:best.currency;
  var original=marketplaceFormatMoney(best.amount,best.currency);
  var convertedLabel=marketplaceFormatMoney(shownAmount,shownCurrency);
  marketplacePriceSummary.classList.add('ready');
  marketplacePriceStatus.hidden=true;
  marketplaceLowestPrice.textContent=convertedLabel;
  marketplaceLowestMeta.textContent=best.marketplace+(best.currency!==shownCurrency?' · '+original:'');
  marketplaceLowestPriceLink.href=best.url||'#';
  marketplaceLowestPriceLink.hidden=false;
  marketplacePriceNote.textContent='Excl. shipping';
}

function setTraderaButtonState(state,count){
  traderaButton.classList.remove('loading','empty','unavailable');
  traderaButton.disabled=false;

  if(state==='loading'){
    traderaButton.classList.add('loading');
    traderaButtonLabel.textContent='Tradera · Checking…';
  }else if(state==='ready'){
    traderaButtonLabel.textContent='Tradera · '+count+' '+(count===1?'listing':'listings');
  }else if(state==='empty'){
    traderaButton.classList.add('empty');
    traderaButtonLabel.textContent='Tradera · No listings';
  }else{
    traderaButton.classList.add('unavailable');
    traderaButtonLabel.textContent='Tradera · Unavailable';
  }
}

function traderaPrice(listing){
  var amount=Number(listing.buyNowPrice||listing.nextBid||listing.currentBid||listing.openingBid||0);
  if(!isFinite(amount)||amount<=0)return '';

  try{
    return new Intl.NumberFormat('sv-SE',{
      style:'currency',
      currency:String(listing.currency||'SEK'),
      maximumFractionDigits:0
    }).format(amount);
  }catch(error){
    return Math.round(amount)+' kr';
  }
}

function traderaEndsText(value){
  var date=new Date(value);
  if(!value||isNaN(date.getTime()))return '';

  return 'Ends '+date.toLocaleDateString('sv-SE',{
    day:'numeric',
    month:'short'
  })+' · '+date.toLocaleTimeString('sv-SE',{
    hour:'2-digit',
    minute:'2-digit'
  });
}

function renderTraderaListings(){
  if(!traderaListings.length){
    traderaListingsGrid.innerHTML='';
    return;
  }

  traderaListingsGrid.innerHTML=traderaListings.map(function(listing){
    var href=safeExternalUrl(listing.url);
    var imageUrl=safeExternalUrl(listing.imageUrl);
    var price=traderaPrice(listing);
    var ends=traderaEndsText(listing.endDate);
    var bids=Number(listing.bidCount||0);

    return '<article class="tradera-listing-card">'+
      '<a class="tradera-listing-image" href="'+esc(href||'#')+'" target="_blank" rel="noopener noreferrer" aria-label="View listing on Tradera">'+
        (imageUrl?'<img src="'+esc(imageUrl)+'" alt="" loading="lazy">':'<span class="record-icon" aria-hidden="true"></span>')+
      '</a>'+
      '<div class="tradera-listing-body">'+
        '<h3>'+esc(listing.title||'Vinyl record')+'</h3>'+
        '<div class="tradera-listing-price-row">'+
          '<strong>'+esc(price||'See price')+'</strong>'+
          (bids?'<span>'+bids+' '+(bids===1?'bid':'bids')+'</span>':'')+
        '</div>'+
        (ends?'<div class="tradera-listing-end">'+esc(ends)+'</div>':'')+
        (href?'<a class="tradera-listing-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">View on Tradera <span aria-hidden="true">↗</span></a>':'')+
      '</div>'+
    '</article>';
  }).join('');
}

function openTraderaModal(){
  var record=records[traderaAlbumIndex];
  if(!record)return;

  traderaModalSubtitle.textContent=record[1]+' · '+record[2];
  renderTraderaListings();

  if(traderaButton.classList.contains('loading')){
    traderaListingsStatus.className='tradera-listings-status loading';
    traderaListingsStatus.textContent='Finding active listings…';
  }else if(traderaListings.length){
    traderaListingsStatus.className='tradera-listings-status';
    traderaListingsStatus.textContent=traderaListings.length+' active '+(traderaListings.length===1?'listing':'listings');
  }else if(traderaButton.classList.contains('unavailable')){
    traderaListingsStatus.className='tradera-listings-status error';
    traderaListingsStatus.textContent='Tradera is temporarily unavailable. Please try again shortly.';
  }else{
    traderaListingsStatus.className='tradera-listings-status empty';
    traderaListingsStatus.textContent='No active listings found for this album right now.';
  }

  traderaModal.classList.add('visible');
  traderaModal.setAttribute('aria-hidden','false');
  closeTraderaModalButton.focus();
}

function closeTraderaModal(){
  traderaModal.classList.remove('visible');
  traderaModal.setAttribute('aria-hidden','true');
}

async function loadTraderaListings(record,index){
  traderaAlbumIndex=index;
  traderaListings=[];
  var requestVersion=++traderaRequestVersion;
  var key=traderaCacheKey(record);
  var cached=traderaListingCache.get(key);

  if(cached&&Date.now()-cached.savedAt<5*60*1000){
    traderaListings=cached.listings;
    setTraderaButtonState(traderaListings.length?'ready':'empty',traderaListings.length);
    marketplacePriceFinished.tradera=true;
    refreshMarketplaceBestPrice(index);
    return;
  }

  setTraderaButtonState('loading',0);

  try{
    var response=await supabaseClient.functions.invoke('tradera-search',{
      body:{artist:record[1],album:record[2]}
    });

    if(requestVersion!==traderaRequestVersion)return;
    if(response.error)throw response.error;

    traderaListings=response.data&&Array.isArray(response.data.listings)
      ?response.data.listings.filter(function(listing){return isRelevantTraderaListing(listing,record);})
      :[];
    traderaListingCache.set(key,{savedAt:Date.now(),listings:traderaListings});
    setTraderaButtonState(traderaListings.length?'ready':'empty',traderaListings.length);
  }catch(error){
    if(requestVersion!==traderaRequestVersion)return;
    console.error('Could not load Tradera listings:',error);
    traderaListings=[];
    setTraderaButtonState('unavailable',0);
  }

  marketplacePriceFinished.tradera=true;
  refreshMarketplaceBestPrice(index);

  if(traderaModal.classList.contains('visible')&&traderaAlbumIndex===index){
    openTraderaModal();
  }
}

function setEbayButtonState(state,count){
  ebayButton.classList.remove('loading','empty','unavailable');
  ebayButton.disabled=false;

  if(state==='loading'){
    ebayButton.classList.add('loading');
    ebayButtonLabel.textContent='eBay · Checking…';
  }else if(state==='ready'){
    ebayButtonLabel.textContent='eBay · '+count+' '+(count===1?'listing':'listings');
  }else if(state==='empty'){
    ebayButton.classList.add('empty');
    ebayButtonLabel.textContent='eBay · No listings';
  }else{
    ebayButton.classList.add('unavailable');
    ebayButtonLabel.textContent='eBay · Unavailable';
  }
}

function renderEbayListings(){
  if(!ebayListings.length){
    ebayListingsGrid.innerHTML='';
    return;
  }

  ebayListingsGrid.innerHTML=ebayListings.map(function(listing){
    var href=safeExternalUrl(listing.url);
    var imageUrl=safeExternalUrl(listing.imageUrl);
    var price=traderaPrice(listing);
    var ends=traderaEndsText(listing.endDate);
    var bids=Number(listing.bidCount||0);

    return '<article class="tradera-listing-card">'+
      '<a class="tradera-listing-image" href="'+esc(href||'#')+'" target="_blank" rel="noopener noreferrer" aria-label="View listing on eBay">'+
        (imageUrl?'<img src="'+esc(imageUrl)+'" alt="" loading="lazy">':'<span class="record-icon" aria-hidden="true"></span>')+
      '</a>'+
      '<div class="tradera-listing-body">'+
        '<h3>'+esc(listing.title||'Vinyl record')+'</h3>'+
        '<div class="tradera-listing-price-row">'+
          '<strong>'+esc(price||'See price')+'</strong>'+
          (bids?'<span>'+bids+' '+(bids===1?'bid':'bids')+'</span>':'')+
        '</div>'+
        (ends?'<div class="tradera-listing-end">'+esc(ends)+'</div>':'')+
        (href?'<a class="tradera-listing-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">View on eBay <span aria-hidden="true">↗</span></a>':'')+
      '</div>'+
    '</article>';
  }).join('');
}

function openEbayModal(){
  var record=records[ebayAlbumIndex];
  if(!record)return;

  ebayModalSubtitle.textContent=record[1]+' · '+record[2];
  renderEbayListings();

  if(ebayButton.classList.contains('loading')){
    ebayListingsStatus.className='tradera-listings-status loading';
    ebayListingsStatus.textContent='Finding active listings…';
  }else if(ebayListings.length){
    ebayListingsStatus.className='tradera-listings-status';
    ebayListingsStatus.textContent=ebayListings.length+' active '+(ebayListings.length===1?'listing':'listings');
  }else if(ebayButton.classList.contains('unavailable')){
    ebayListingsStatus.className='tradera-listings-status error';
    ebayListingsStatus.textContent='eBay is temporarily unavailable. Please try again shortly.';
  }else{
    ebayListingsStatus.className='tradera-listings-status empty';
    ebayListingsStatus.textContent='No active vinyl LP listings found for this album right now.';
  }

  ebayModal.classList.add('visible');
  ebayModal.setAttribute('aria-hidden','false');
  closeEbayModalButton.focus();
}

function closeEbayModal(){
  ebayModal.classList.remove('visible');
  ebayModal.setAttribute('aria-hidden','true');
}

async function loadEbayListings(record,index){
  ebayAlbumIndex=index;
  ebayListings=[];
  var requestVersion=++ebayRequestVersion;
  var key=traderaCacheKey(record);
  var cached=ebayListingCache.get(key);

  if(cached&&Date.now()-cached.savedAt<5*60*1000){
    ebayListings=cached.listings;
    setEbayButtonState(ebayListings.length?'ready':'empty',ebayListings.length);
    marketplacePriceFinished.ebay=true;
    refreshMarketplaceBestPrice(index);
    return;
  }

  setEbayButtonState('loading',0);

  try{
    var response=await supabaseClient.functions.invoke('ebay-search',{
      body:{artist:record[1],album:record[2]}
    });

    if(requestVersion!==ebayRequestVersion)return;
    if(response.error)throw response.error;

    ebayListings=response.data&&Array.isArray(response.data.listings)
      ?response.data.listings.filter(function(listing){return isRelevantTraderaListing(listing,record);})
      :[];
    ebayListingCache.set(key,{savedAt:Date.now(),listings:ebayListings});
    setEbayButtonState(ebayListings.length?'ready':'empty',ebayListings.length);
  }catch(error){
    if(requestVersion!==ebayRequestVersion)return;
    console.error('Could not load eBay listings:',error);
    ebayListings=[];
    setEbayButtonState('unavailable',0);
  }

  marketplacePriceFinished.ebay=true;
  refreshMarketplaceBestPrice(index);

  if(ebayModal.classList.contains('visible')&&ebayAlbumIndex===index){
    openEbayModal();
  }
}

function hasCopyDetails(details){
  return !!(details&&(details.mediaCondition||details.sleeveCondition||
    details.discogsReleaseId||details.country||details.year||details.label||
    details.catalogNumber||details.matrixA||details.matrixB||details.matrixC||details.matrixD||
    details.matrixE||details.matrixF||details.matrixG||details.matrixH));
}

function conditionOptions(selected,includeNoCover){
  var options=[
    ['', 'Not set'],
    ['M', 'Mint (M)'],
    ['NM', 'Near Mint (NM)'],
    ['VG+', 'Very Good Plus (VG+)'],
    ['VG', 'Very Good (VG)'],
    ['G+', 'Good Plus (G+)'],
    ['G', 'Good (G)'],
    ['F', 'Fair (F)'],
    ['P', 'Poor (P)']
  ];

  if(includeNoCover)options.push(['NO_COVER','No cover']);

  return options.map(function(option){
    return '<option value="'+esc(option[0])+'"'+(option[0]===selected?' selected':'')+'>'+esc(option[1])+'</option>';
  }).join('');
}

function recordConditionMeta(value){
  var conditions={
    'M':{className:'mint',label:'Mint'},
    'NM':{className:'near-mint',label:'Near Mint'},
    'VG+':{className:'very-good-plus',label:'Very Good Plus'},
    'VG':{className:'very-good',label:'Very Good'},
    'G+':{className:'good-plus',label:'Good Plus'},
    'G':{className:'good',label:'Good'},
    'F':{className:'fair',label:'Fair'},
    'P':{className:'poor',label:'Poor'}
  };
  return conditions[value]||null;
}

function copyDetailItem(label,value){
  if(!value)return '';
  return '<div class="copy-detail-item"><span class="copy-detail-label">'+esc(label)+'</span><span class="copy-detail-value">'+esc(value)+'</span></div>';
}

function copySummaryText(details){
  var values=[details.country,details.year];
  var summary=values.filter(Boolean).join(' · ');
  return summary||(details.mediaCondition?'':'Add details');
}

function conditionChipHTML(value){
  var condition=recordConditionMeta(value);
  return condition
    ?'<span class="copy-condition-chip condition-'+condition.className+'" title="Record condition: '+esc(condition.label)+'">'+esc(value)+'</span>'
    :'';
}

function setCopyDetailsExpanded(expanded){
  copyDetailsExpanded=!!expanded;
  copyDetails.classList.toggle('expanded',copyDetailsExpanded);
  copyDetailsToggle.setAttribute('aria-expanded',copyDetailsExpanded?'true':'false');
  copyDetailsContent.setAttribute('aria-hidden',copyDetailsExpanded?'false':'true');
  copyDetailsContent.inert=!copyDetailsExpanded;
}

copyDetailsToggle.addEventListener('click',function(){
  setCopyDetailsExpanded(!copyDetailsExpanded);
});

function renderCopyDetails(index){
  var record=records[index];
  var isWishlist=window.libraryView==='wishlist';

  if(!record||isWishlist){
    copyDetails.hidden=true;
    copyDetailsContent.innerHTML='';
    return;
  }

  var details=record[11]||{};
  var isOwner=viewedUserId===null;

  if(!isOwner&&!hasCopyDetails(details)){
    copyDetails.hidden=true;
    copyDetailsContent.innerHTML='';
    return;
  }

  copyDetails.hidden=false;
  copyDetailsSaved.textContent='';
  var recordKey=String(record[9]||('record-'+index));
  if(recordKey!==copyDetailsRecordKey){
    copyDetailsRecordKey=recordKey;
    copyDetailsExpanded=!hasCopyDetails(details);
  }
  var compactText=copySummaryText(details);
  copyDetailsSummary.innerHTML=(compactText?'<span class="copy-summary-text">'+esc(compactText)+'</span>':'')+conditionChipHTML(details.mediaCondition);
  var chips='';

  if(details.mediaCondition)chips+=conditionChipHTML(details.mediaCondition);
  if(details.sleeveCondition)chips+='<span class="copy-summary-chip">Sleeve '+esc(details.sleeveCondition)+'</span>';

  var info=copyDetailItem('Country',details.country)+
    copyDetailItem('Release year',details.year)+
    copyDetailItem('Record label',details.label)+
    copyDetailItem('Catalog number',details.catalogNumber);

  var matrix='';
  if(details.matrixA||details.matrixB||details.matrixC||details.matrixD||details.matrixE||details.matrixF||details.matrixG||details.matrixH){
    matrix='<section class="advanced-pressing"><div class="advanced-pressing-title">Advanced pressing</div><div class="matrix-list">'+
      (details.matrixA?'<div><span class="copy-detail-label">Matrix / Runout A</span><div class="matrix-value">'+esc(details.matrixA)+'</div></div>':'')+
      (details.matrixB?'<div><span class="copy-detail-label">Matrix / Runout B</span><div class="matrix-value">'+esc(details.matrixB)+'</div></div>':'')+
      (details.matrixC?'<div><span class="copy-detail-label">Matrix / Runout C</span><div class="matrix-value">'+esc(details.matrixC)+'</div></div>':'')+
      (details.matrixD?'<div><span class="copy-detail-label">Matrix / Runout D</span><div class="matrix-value">'+esc(details.matrixD)+'</div></div>':'')+
      (details.matrixE?'<div><span class="copy-detail-label">Matrix / Runout E</span><div class="matrix-value">'+esc(details.matrixE)+'</div></div>':'')+
      (details.matrixF?'<div><span class="copy-detail-label">Matrix / Runout F</span><div class="matrix-value">'+esc(details.matrixF)+'</div></div>':'')+
      (details.matrixG?'<div><span class="copy-detail-label">Matrix / Runout G</span><div class="matrix-value">'+esc(details.matrixG)+'</div></div>':'')+
      (details.matrixH?'<div><span class="copy-detail-label">Matrix / Runout H</span><div class="matrix-value">'+esc(details.matrixH)+'</div></div>':'')+
    '</div></section>';
  }

  var summary=chips
    ?'<div class="copy-summary">'+chips+'</div>'
    :(!info&&!matrix?'<p class="copy-summary-empty">Add details about the physical record you own.</p>':'');

  if(isOwner){
    copyDetailsContent.innerHTML=summary+
      (info?'<div class="copy-details-readonly">'+info+'</div>':'')+
      matrix+
      '<div class="copy-details-actions">'+
        '<button id="editConditionButton" class="copy-action-button" type="button">'+(details.mediaCondition||details.sleeveCondition?'Edit condition':'Add condition')+'</button>'+
        '<button id="identifyPressingButton" class="copy-action-button primary" type="button">'+(details.discogsReleaseId?'Change pressing':'Identify pressing')+'</button>'+
      '</div>'+
      '<div id="conditionEditor" class="condition-editor" hidden>'+
        '<label class="condition-field"><span>Record condition</span><select id="mediaConditionSelect">'+conditionOptions(details.mediaCondition||'',false)+'</select></label>'+
        '<label class="condition-field"><span>Sleeve condition</span><select id="sleeveConditionSelect">'+conditionOptions(details.sleeveCondition||'',true)+'</select></label>'+
      '</div>'+
      (details.discogsReleaseId?'<p class="copy-credit">Pressing data from <a href="https://www.discogs.com/release/'+encodeURIComponent(details.discogsReleaseId)+'" target="_blank" rel="noopener noreferrer">Discogs</a></p>':'');

    document.getElementById('editConditionButton').addEventListener('click',function(){
      var editor=document.getElementById('conditionEditor');
      editor.hidden=!editor.hidden;
    });

    document.getElementById('identifyPressingButton').addEventListener('click',function(){
      openPressingPicker(index);
    });

    ['mediaConditionSelect','sleeveConditionSelect'].forEach(function(id){
      document.getElementById(id).addEventListener('change',function(){
        saveConditionDetails(index);
      });
    });
  }else{
    copyDetailsContent.innerHTML=(chips?'<div class="copy-summary">'+chips+'</div>':'')+
      (info?'<div class="copy-details-readonly">'+info+'</div>':'')+matrix+
      (details.discogsReleaseId?'<p class="copy-credit">Pressing data from <a href="https://www.discogs.com/release/'+encodeURIComponent(details.discogsReleaseId)+'" target="_blank" rel="noopener noreferrer">Discogs</a></p>':'');
  }

  setCopyDetailsExpanded(copyDetailsExpanded);
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

function cleanVersionValue(value,fallback){
  var text=String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  return text||fallback||'';
}

function normalizeVersion(version){
  var rawYear=cleanVersionValue(version.released||version.year||'','');
  var year=rawYear.slice(0,4);
  if(!/^\d{4}$/.test(year)||year==='0000')year='';
  var label=Array.isArray(version.label)?version.label.join(', '):version.label;
  var format=Array.isArray(version.format)?version.format.join(', '):version.format;
  return {
    id:version.id||version.release_id,
    title:cleanVersionValue(version.title,''),
    country:cleanVersionValue(version.country,'Unknown'),
    year:year,
    label:cleanVersionValue(label,'Unknown'),
    catalogNumber:cleanVersionValue(version.catno||version.catalog_number,'Unknown'),
    format:cleanVersionValue(format,'Vinyl')
  };
}

function uniqueVersionValues(list,key){
  var seen={};
  return list.map(function(item){return cleanVersionValue(item[key],'');})
    .filter(function(value){
      if(!value)return false;
      var normalized=value.toLocaleLowerCase().replace(/\s*([,;:/-])\s*/g,'$1');
      if(seen[normalized])return false;
      seen[normalized]=true;
      return true;
    })
    .sort(function(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});});
}

function setPressingOptions(select,values,placeholder,current){
  select.innerHTML='<option value="">'+esc(placeholder)+'</option>'+values.map(function(value){
    return '<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(value)+'</option>';
  }).join('');
  select.disabled=!values.length;
}

function updatePressingProgress(){
  var completed=[pressingCountry.value,pressingYear.value,pressingLabel.value,pressingCatalogNumber.value].filter(Boolean).length;
  var bars=pressingForm.querySelectorAll('.pressing-progress span');
  for(var i=0;i<bars.length;i++)bars[i].classList.toggle('active',i<=completed);
}

function pressingChoiceMatches(left,right){
  return cleanVersionValue(left,'').toLocaleLowerCase()===cleanVersionValue(right,'').toLocaleLowerCase();
}

function pressingYearMatches(versionYear,selectedYear){
  // Some Discogs releases have a blank Released field even when the physical
  // copy carries a copyright year. Keep those candidates until the matrix is
  // checked instead of silently filtering out the correct pressing.
  return !selectedYear||!versionYear||pressingChoiceMatches(versionYear,selectedYear);
}

function pressingCatalogMatches(left,right){
  return cleanVersionValue(left,'').toLocaleLowerCase().replace(/[^a-z0-9]/g,'')===
    cleanVersionValue(right,'').toLocaleLowerCase().replace(/[^a-z0-9]/g,'');
}

function currentPressingMatches(){
  return pressingVersions.filter(function(version){
    return (!pressingCountry.value||pressingChoiceMatches(version.country,pressingCountry.value))&&
      pressingYearMatches(version.year,pressingYear.value)&&
      (!pressingLabel.value||pressingChoiceMatches(version.label,pressingLabel.value))&&
      (!pressingCatalogNumber.value||pressingCatalogMatches(version.catalogNumber,pressingCatalogNumber.value));
  });
}

function normalizedMatrix(value){
  return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^a-z0-9]/g,'');
}

function matrixValues(release){
  return (Array.isArray(release&&release.identifiers)?release.identifiers:[])
    .filter(function(item){return /matrix|runout/i.test(String(item&&item.type||''));})
    .map(function(item){return String(item.value||'').trim();})
    .filter(Boolean);
}

function renderPressingMatches(){
  var allMatches=pressingMatrixMatches===null?currentPressingMatches():pressingMatrixMatches;

  if(!pressingCatalogNumber.value){
    pressingMatches.innerHTML='';
    pressingMatrixSearch.hidden=true;
    return;
  }

  pressingMatrixSearch.hidden=false;
  var matches=pressingMatrixMatches===null?allMatches.slice(0,5):allMatches;
  var moreCount=pressingMatrixMatches===null?Math.max(0,allMatches.length-matches.length):0;

  pressingMatches.innerHTML=matches.map(function(version){
    return '<button class="pressing-match" type="button" data-release-id="'+esc(version.id)+'">'+
      '<span class="pressing-match-title">'+esc(version.label+' · '+version.catalogNumber)+'</span>'+
      '<span class="pressing-match-meta">'+esc([version.country,version.year||'Year not listed',version.format].filter(Boolean).join(' · '))+'</span>'+
      (version.matrixMatch?'<span class="pressing-match-matrix">'+esc(version.matrixMatch)+'</span>':'')+
    '</button>';
  }).join('')+
    (moreCount?'<p class="pressing-help">'+moreCount+' more possible pressings. Enter your matrix above to find the right one.</p>':'');

  if(!matches.length){
    pressingMatches.innerHTML='<div class="pressing-error">'+(pressingMatrixMatches===null
      ?'No pressings match these choices.'
      :'No pressing contains that matrix. Try a shorter section of the runout text.')+'</div>';
  }

  pressingMatches.querySelectorAll('.pressing-match').forEach(function(button){
    button.addEventListener('click',function(){
      preparePressingConfirmation(this.getAttribute('data-release-id'));
    });
  });
}

async function searchPressingsByMatrix(){
  var query=normalizedMatrix(pressingMatrixQuery.value);
  if(query.length<5){
    pressingMatches.innerHTML='<div class="pressing-error">Enter at least five letters or numbers from one side of the matrix.</div>';
    return;
  }

  var candidates=currentPressingMatches();
  if(!candidates.length){
    pressingMatches.innerHTML='<div class="pressing-error">No pressings match the choices above.</div>';
    return;
  }

  pressingMatrixSearchButton.disabled=true;
  pressingMatrixSearchButton.textContent='Checking 0 of '+candidates.length+'…';
  pressingMatches.innerHTML='<div class="pressing-loading">Comparing Discogs matrix data…</div>';
  var nextIndex=0;
  var completed=0;
  var found=[];

  async function checkNext(){
    while(nextIndex<candidates.length){
      var version=candidates[nextIndex++];
      var release=pressingReleaseCache.get(String(version.id));
      try{
        if(!release){
          var response=await supabaseClient.functions.invoke('discogs-search',{body:{action:'release',releaseId:version.id}});
          if(response.error)throw response.error;
          release=response.data||{};
          pressingReleaseCache.set(String(version.id),release);
        }
        var match=matrixValues(release).find(function(value){return normalizedMatrix(value).indexOf(query)!==-1;});
        if(match)found.push(Object.assign({},version,{matrixMatch:match}));
      }catch(error){
        console.warn('Could not compare Discogs release '+version.id+':',error);
      }
      completed++;
      pressingMatrixSearchButton.textContent='Checking '+completed+' of '+candidates.length+'…';
    }
  }

  var workers=[];
  for(var i=0;i<Math.min(3,candidates.length);i++)workers.push(checkNext());
  await Promise.all(workers);

  var seen={};
  pressingMatrixMatches=found.filter(function(version){
    var key=[normalizedMatrix(version.matrixMatch),version.country.toLocaleLowerCase(),version.label.toLocaleLowerCase(),normalizedMatrix(version.catalogNumber)].join('|');
    if(seen[key])return false;
    seen[key]=true;
    return true;
  });
  pressingMatrixSearchButton.disabled=false;
  pressingMatrixSearchButton.textContent='Find matrix';
  renderPressingMatches();
}

function refreshPressingFields(changedField){
  pressingMatrixMatches=null;
  pressingMatrixQuery.value='';
  var country=pressingCountry.value;
  var year=changedField==='country'?'':pressingYear.value;
  var label=(changedField==='country'||changedField==='year')?'':pressingLabel.value;
  var catalog=(changedField!=='catalog')?'':pressingCatalogNumber.value;

  if(changedField==='country'){
    setPressingOptions(pressingYear,uniqueVersionValues(pressingVersions.filter(function(v){return v.country===country;}),'year'),'Choose year',year);
    setPressingOptions(pressingLabel,[],'Choose label','');
    setPressingOptions(pressingCatalogNumber,[],'Choose catalog number','');
  }else if(changedField==='year'){
    setPressingOptions(pressingLabel,uniqueVersionValues(pressingVersions.filter(function(v){return v.country===country&&pressingYearMatches(v.year,year); }),'label'),'Choose label',label);
    setPressingOptions(pressingCatalogNumber,[],'Choose catalog number','');
  }else if(changedField==='label'){
    setPressingOptions(pressingCatalogNumber,uniqueVersionValues(pressingVersions.filter(function(v){return v.country===country&&pressingYearMatches(v.year,year)&&v.label===label;}),'catalogNumber'),'Choose catalog number',catalog);
  }

  renderPressingMatches();
  updatePressingProgress();
}

async function loadPressingPage(page){
  var record=records[pressingAlbumIndex];
  var {data,error}=await supabaseClient.functions.invoke('discogs-search',{
    body:{action:'versions',masterId:record&&record[10],page:page}
  });
  if(error)throw error;

  var newVersions=(data&&Array.isArray(data.versions)?data.versions:[]).map(normalizeVersion).filter(function(version){return version.id;});
  newVersions.forEach(function(version){
    if(!pressingVersions.some(function(existing){return String(existing.id)===String(version.id);}))pressingVersions.push(version);
  });
  pressingPages=data&&data.pagination&&data.pagination.pages?data.pagination.pages:page;
}

async function loadAllPressingPages(){
  await loadPressingPage(1);
  var totalPages=Math.min(pressingPages,100);
  if(totalPages<=1)return;

  var nextPage=2;
  var loadedPages=1;
  var workerCount=Math.min(3,totalPages-1);

  async function loadNext(){
    while(nextPage<=totalPages){
      var page=nextPage++;
      await loadPressingPage(page);
      loadedPages++;
      pressingLoading.textContent='Finding vinyl pressings… '+loadedPages+' of '+totalPages;
    }
  }

  var workers=[];
  for(var i=0;i<workerCount;i++)workers.push(loadNext());
  await Promise.all(workers);
}

async function openPressingPicker(index){
  var record=records[index];
  if(!record||!record[10]){
    copyDetailsSaved.textContent='No Discogs master found';
    return;
  }

  pressingAlbumIndex=index;
  pressingVersions=[];
  pressingPages=1;
  pressingMatrixMatches=null;
  pressingMatrixQuery.value='';
  pressingMatrixSearch.hidden=true;
  pressingModal.style.display='flex';
  pressingLoading.hidden=false;
  pressingForm.hidden=true;
  pressingError.hidden=true;
  pressingMatches.innerHTML='';
  document.body.style.overflow='hidden';

  try{
    pressingLoading.textContent='Finding vinyl pressings…';
    await loadAllPressingPages();
    setPressingOptions(pressingCountry,uniqueVersionValues(pressingVersions,'country'),'Choose country','');
    setPressingOptions(pressingYear,[],'Choose year','');
    setPressingOptions(pressingLabel,[],'Choose label','');
    setPressingOptions(pressingCatalogNumber,[],'Choose catalog number','');
    pressingLoading.hidden=true;
    pressingForm.hidden=false;
    updatePressingProgress();
  }catch(error){
    console.error('Kunde inte hämta pressningar:',error);
    pressingLoading.hidden=true;
    pressingError.hidden=false;
    pressingError.textContent='Could not load Discogs pressings. Please try again in a moment.';
  }
}

function matrixChoices(release){
  var identifiers=Array.isArray(release.identifiers)?release.identifiers.filter(function(item){
    return /matrix|runout/i.test(String(item.type||''));
  }):[];
  var sides={a:[],b:[],c:[],d:[],e:[],f:[],g:[],h:[]};

  function detectedSide(description,value){
    var descriptionMatch=String(description||'').match(/side\s*([a-h])|([a-h])[- ]?side/i);
    if(descriptionMatch)return (descriptionMatch[1]||descriptionMatch[2]).toLowerCase();
    var valueMatch=String(value||'').match(/(?:^|[\s-])([a-h])(?:\s*[-:]\s*\d|\s*$)/i);
    return valueMatch?valueMatch[1].toLowerCase():'';
  }

  identifiers.forEach(function(item,index){
    var value=String(item.value||'').trim();
    if(!value)return;
    var description=String(item.description||'');
    var side=detectedSide(description,value);
    if(side&&sides[side])sides[side].push(value);
    else sides[index%2===0?'a':'b'].push(value);
  });

  Object.keys(sides).forEach(function(side){
    sides[side]=uniqueVersionValues(sides[side].map(function(value){return {value:value};}),'value');
  });
  return sides;
}

function vinylDiscCount(release){
  var formats=Array.isArray(release&&release.formats)?release.formats:[];
  var vinyl=formats.find(function(format){return /vinyl|lp/i.test(String(format&&format.name||''));});
  if(!vinyl)return 1;
  var qty=parseInt(vinyl.qty,10)||1;
  var descriptions=Array.isArray(vinyl.descriptions)?vinyl.descriptions.join(' '):'';
  var multiplier=descriptions.match(/\b([2-9])\s*x\s*lp\b/i);
  return Math.max(qty,multiplier?parseInt(multiplier[1],10):1);
}

function simpleOptions(values){
  return '<option value="">Not set</option>'+values.map(function(value){return '<option value="'+esc(value)+'">'+esc(value)+'</option>';}).join('');
}

async function preparePressingConfirmation(releaseId){
  pressingMatches.innerHTML='<div class="pressing-loading">Loading pressing details…</div>';
  try{
    var data=pressingReleaseCache.get(String(releaseId));
    if(!data){
      var response=await supabaseClient.functions.invoke('discogs-search',{body:{action:'release',releaseId:releaseId}});
      if(response.error)throw response.error;
      data=response.data||{};
      pressingReleaseCache.set(String(releaseId),data);
    }
    var version=pressingVersions.find(function(item){return String(item.id)===String(releaseId);})||{};
    var label=data&&Array.isArray(data.labels)&&data.labels.length?data.labels[0]:{};
    var selected={
      id:releaseId,
      country:data.country||version.country||'',
      year:String(data.released||data.year||version.year||'').slice(0,4),
      label:label.name||version.label||'',
      catalogNumber:label.catno||version.catalogNumber||'',
      format:version.format||'Vinyl'
    };
    var matrices=matrixChoices(data||{});
    var matrixSideCount=Math.min(8,Math.max(2,vinylDiscCount(data||{})*2));
    var matrixSideNames=['a','b','c','d','e','f','g','h'].slice(0,matrixSideCount);
    var hasMatrixChoices=matrixSideNames.some(function(side){return matrices[side].length;});
    var matrixFields=matrixSideNames.map(function(side){
      var upper=side.toUpperCase();
      return '<label class="pressing-field"><span>Matrix / Runout '+upper+'</span><select id="pressingMatrix'+upper+'">'+simpleOptions(matrices[side])+'</select></label>';
    }).join('');

    pressingMatches.innerHTML='<div class="pressing-match selected">'+
      '<span class="pressing-match-title">Likely match</span>'+
      '<span class="pressing-match-meta">'+esc([selected.country,selected.year,selected.label,selected.catalogNumber].filter(Boolean).join(' · '))+'</span>'+
    '</div>'+
    '<section class="advanced-pressing pressing-advanced"><div class="advanced-pressing-title">Advanced pressing</div>'+
      (hasMatrixChoices?'<div class="matrix-list">'+matrixFields+'</div>':'<p class="pressing-help">Discogs has no matrix information for this pressing.</p>')+
    '</section>'+
    '<button id="savePressingButton" class="copy-action-button primary" type="button">Save this pressing</button>';

    document.getElementById('savePressingButton').addEventListener('click',function(){
      saveSelectedPressing(selected,this);
    });
  }catch(error){
    console.error('Kunde inte hämta pressningsdetaljer:',error);
    pressingMatches.innerHTML='<div class="pressing-error">Could not load this pressing. Choose another match or try again.</div>';
  }
}

async function saveSelectedPressing(selected,button){
  var record=records[pressingAlbumIndex];
  if(!record)return;
  var matrixA=document.getElementById('pressingMatrixA');
  var matrixB=document.getElementById('pressingMatrixB');
  var matrixC=document.getElementById('pressingMatrixC');
  var matrixD=document.getElementById('pressingMatrixD');
  var matrixE=document.getElementById('pressingMatrixE');
  var matrixF=document.getElementById('pressingMatrixF');
  var matrixG=document.getElementById('pressingMatrixG');
  var matrixH=document.getElementById('pressingMatrixH');
  button.disabled=true;
  button.textContent='Saving…';

  var {data:{user},error:userError}=await supabaseClient.auth.getUser();
  var payload={
    discogs_release_id:parseInt(selected.id,10),
    pressing_country:selected.country||null,
    pressing_year:parseInt(selected.year,10)||null,
    pressing_label:selected.label||null,
    catalog_number:selected.catalogNumber||null,
    matrix_runout_a:matrixA&&matrixA.value?matrixA.value:null,
    matrix_runout_b:matrixB&&matrixB.value?matrixB.value:null,
    matrix_runout_c:matrixC&&matrixC.value?matrixC.value:null,
    matrix_runout_d:matrixD&&matrixD.value?matrixD.value:null,
    matrix_runout_e:matrixE&&matrixE.value?matrixE.value:null,
    matrix_runout_f:matrixF&&matrixF.value?matrixF.value:null,
    matrix_runout_g:matrixG&&matrixG.value?matrixG.value:null,
    matrix_runout_h:matrixH&&matrixH.value?matrixH.value:null,
    pressing_match_status:'discogs'
  };
  var result=(userError||!user)?{error:userError||new Error('Du måste vara inloggad.')}:await supabaseClient.from('collections').update(payload)
    .eq('id',record[9]).eq('user_id',user.id).select('id');

  if(result.error||!result.data||!result.data.length){
    console.error('Kunde inte spara pressningen:',result.error);
    button.disabled=false;
    button.textContent='Try saving again';
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
  closePressingPicker();
  buildGrid();
  renderCopyDetails(pressingAlbumIndex);
  copyDetailsSaved.textContent='Saved';
}

function closePressingPicker(){
  pressingModal.style.display='none';
  if(albumOverlay.className.indexOf('visible')===-1)document.body.style.overflow='';
}

pressingCountry.addEventListener('change',function(){refreshPressingFields('country');});
pressingYear.addEventListener('change',function(){refreshPressingFields('year');});
pressingLabel.addEventListener('change',function(){refreshPressingFields('label');});
pressingCatalogNumber.addEventListener('change',function(){refreshPressingFields('catalog');});
pressingMatrixSearchButton.addEventListener('click',searchPressingsByMatrix);
pressingMatrixQuery.addEventListener('keydown',function(event){
  if(event.key==='Enter'){
    event.preventDefault();
    searchPressingsByMatrix();
  }
});
closePressingModalButton.addEventListener('click',closePressingPicker);
pressingModal.addEventListener('click',function(event){if(event.target===pressingModal)closePressingPicker();});

function spotifyAlbumLink(record){
    var query=[
        record&&record[1],
        record&&record[2]
    ].filter(Boolean).join(' ');

    return 'https://open.spotify.com/search/'+encodeURIComponent(query);
}

function appleMusicAlbumLink(record){
    var savedUrl=record&&record[12];

    if(/^https:\/\/(?:music|itunes)\.apple\.com\//.test(String(savedUrl||''))){
        return savedUrl;
    }

    var query=[
        record&&record[1],
        record&&record[2]
    ].filter(Boolean).join(' ');

    return 'https://music.apple.com/se/search?term='+encodeURIComponent(query);
}

function recordDisplayNumber(record){
  if(
    window.libraryView!=='wishlist'&&
    activeShelfId!=='all'&&
    String(record&&record[13]||'')===String(activeShelfId)
  ){
    var shelfNumber=parseInt(record&&record[14],10);
    if(!isNaN(shelfNumber)&&shelfNumber>0)return shelfNumber;
  }

  var allRecordsNumber=parseInt(record&&record[0],10);
  return !isNaN(allRecordsNumber)&&allRecordsNumber>0?allRecordsNumber:'';
}

function recordArrayIndex(record){
  return records.indexOf(record);
}

function recordHTML(record, className){
  var smallSrc=record[6];
  var isWishlist=window.libraryView==='wishlist';
  var recordIndex=recordArrayIndex(record);
  var displayNumber=recordDisplayNumber(record);
  var copy=record[11]||{};
  var condition=!isWishlist?recordConditionMeta(copy.mediaCondition):null;
  var showPressingPrompt=!isWishlist&&viewedUserId===null&&!condition&&!hasCopyDetails(copy);
  var cardShelf=!isWishlist?shelfById(record[13]):null;
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
         '<button class="record-action-item" type="button" data-action="shelf">'+(record[13]?'Move to Shelf':'Add to Shelf')+'</button>'+
         (record[13]?'<button class="record-action-item" type="button" data-action="unshelf">Remove from Shelf</button>':'')+
         '<button class="record-action-item danger" type="button" data-action="delete">Delete Record</button>'+
       '</div>')
    :'';

  var html='<article class="record '+(isWishlist?'wishlist-record ':'')+(className||'')+'" draggable="false" data-index="'+recordIndex+'">'+
    '<div class="record-card-topbar"><span class="number">'+displayNumber+'</span>'+cardShelfStatus+removeButton+'</div>'+
    '<div class="cover-wrapper">'+
      '<img class="cover" draggable="false" loading="lazy" decoding="async" src="" data-src="'+esc(smallSrc)+'" alt="'+esc(record[1]+' - '+record[2])+'">'+
    '</div>'+
    '<div class="info">'+
      '<div class="record-heading-row"><div class="album">'+esc(record[2])+'</div></div>'+
      '<div class="artist">'+esc(record[1])+'</div>'+
      '<div class="record-meta-row"><span class="year">'+esc(record[3])+'</span>'+
      (condition?'<span class="record-condition-badge condition-'+condition.className+'" title="Record condition: '+esc(condition.label)+'">'+esc(copy.mediaCondition)+'</span>':'')+
      (showPressingPrompt?'<span class="pressing-prompt-badge" title="Add pressing details">Add pressing</span>':'')+
      '<span class="cover-rating">';

  if(isWishlist){
    html+='<span class="wishlist-cover-label"><span class="wishlist-icon" aria-hidden="true"></span>Wishlisted</span>';
  }else{
    html+='<span class="cover-rating-inner">'+renderStaticStarMeter(record[15]||0,'is-compact')+'<span class="cover-rating-number">'+esc(formatCommunityRating(record[15]||0))+'</span></span>';
  }

  html+='</span></div></div>'+
    (isWishlist&&viewedUserId===null
      ?'<button class="move-to-collection-button" type="button"><span class="record-icon" aria-hidden="true"></span>Add to collection</button>'
      :'')+
    '<div class="record-card-footer">'+
    
        '<a class="streaming-link streaming-service apple-service" '+
            'href="'+esc(appleMusicAlbumLink(record))+'" '+
            'target="_blank" rel="noopener noreferrer" '+
            'aria-label="Listen to '+esc(record[2])+' by '+esc(record[1])+' on Apple Music">'+
            '<img class="apple-music-small-badge" '+
                'src="/Apple_Music_Listen_on_Badge_Small.svg" '+
                'alt="Listen on Apple Music">'+
        '</a>'+
    
        '<a class="streaming-link streaming-service spotify-service" '+
            'href="'+esc(spotifyAlbumLink(record))+'" '+
            'target="_blank" rel="noopener noreferrer" '+
            'aria-label="Listen to '+esc(record[2])+' by '+esc(record[1])+' on Spotify">'+
            '<img class="spotify-service-logo" '+
                'src="/Full_Logo_Green_RGB.svg" '+
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

function normalizeWikipediaIdentity(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
}

function wikipediaCacheKey(record){
  return 'groovy-wikipedia-about-v5:'+normalizeWikipediaIdentity(record&&record[1])+'|'+normalizeWikipediaIdentity(record&&record[2]);
}

function wikipediaIntroduction(extract){
  var html=String(extract||'').trim();
  if(!html)return '';

  try{
    var doc=new DOMParser().parseFromString(html,'text/html');
    var paragraphs=Array.prototype.slice.call(doc.body.querySelectorAll('p')).map(function(paragraph){
      return String(paragraph.textContent||'').replace(/\s+/g,' ').trim();
    }).filter(Boolean);
    if(paragraphs.length)return paragraphs.join('\n\n');
    return String(doc.body.textContent||'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  }catch(error){
    var fallback=document.createElement('div');
    fallback.innerHTML=html;
    return String(fallback.textContent||'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  }
}

function wikipediaAboutLineHeight(){
  if(!detailAboutAlbumText)return 20.8;
  var sample=detailAboutAlbumText.querySelector('p')||detailAboutAlbumText;
  var style=window.getComputedStyle(sample);
  return parseFloat(style.lineHeight)||20.8;
}

function renderWikipediaParagraphs(text,heading,sectionParagraphs){
  if(!detailAboutAlbumText)return;
  detailAboutAlbumText.innerHTML='';
  String(text||'').split(/\n{2,}/).map(function(paragraph){return paragraph.replace(/\s*\n\s*/g,' ').trim();}).filter(Boolean).forEach(function(paragraph){
    var element=document.createElement('p');
    element.textContent=paragraph;
    detailAboutAlbumText.appendChild(element);
  });
  if(heading){
    var headingElement=document.createElement('h3');
    headingElement.className='about-album-first-heading';
    headingElement.textContent=heading;
    detailAboutAlbumText.appendChild(headingElement);
  }
  (Array.isArray(sectionParagraphs)?sectionParagraphs:[]).forEach(function(paragraph){
    var value=String(paragraph||'').replace(/\s+/g,' ').trim();
    if(!value)return;
    var element=document.createElement('p');
    element.textContent=value;
    detailAboutAlbumText.appendChild(element);
  });
}

function setWikipediaAboutExpanded(expanded,animate){
  if(!detailAboutAlbumBody||!detailAboutAlbumToggle)return;
  var textSpan=detailAboutAlbumToggle.querySelector('span');
  var lineHeight=wikipediaAboutLineHeight();
  var collapsedHeight=lineHeight*3;
  detailAboutAlbumToggle.setAttribute('aria-expanded',expanded?'true':'false');
  detailAboutAlbumBody.classList.toggle('expanded',expanded);
  if(textSpan)textSpan.textContent=expanded?'Show less':'Read more';
  if(!animate)detailAboutAlbumBody.style.transition='none';
  detailAboutAlbumBody.style.maxHeight=(expanded?detailAboutAlbumBody.scrollHeight:collapsedHeight)+'px';
  if(!animate){
    detailAboutAlbumBody.offsetHeight;
    detailAboutAlbumBody.style.transition='';
  }
}

function syncWikipediaAboutToggle(reset){
  if(!detailAboutAlbumBody||!detailAboutAlbumText||!detailAboutAlbumToggle)return;
  if(reset)setWikipediaAboutExpanded(false,false);
  requestAnimationFrame(function(){
    var lineHeight=wikipediaAboutLineHeight();
    var collapsedHeight=lineHeight*3;
    var needsToggle=detailAboutAlbumBody.scrollHeight>collapsedHeight+2;
    detailAboutAlbumToggle.hidden=!needsToggle;
    if(!needsToggle){
      detailAboutAlbumBody.classList.add('expanded');
      detailAboutAlbumBody.style.maxHeight=detailAboutAlbumBody.scrollHeight+'px';
    }else if(reset){
      setWikipediaAboutExpanded(false,false);
    }
  });
}

function wikipediaCandidateScore(page,record){
  var album=normalizeWikipediaIdentity(record&&record[2]);
  var artist=normalizeWikipediaIdentity(record&&record[1]);
  var title=normalizeWikipediaIdentity(page&&page.title);
  var extract=normalizeWikipediaIdentity(wikipediaIntroduction(page&&page.extract));
  var year=String(record&&record[3]||'').trim();
  var score=0;

  if(!album||!title)return -100;
  if(title===album)score+=30;
  else if(title.indexOf(album+' ')===0)score+=25;
  else if(title.indexOf(album)!==-1)score+=13;
  if(/\balbum\b/.test(title))score+=7;
  if(artist&&title.indexOf(artist)!==-1)score+=12;
  if(artist&&extract.indexOf(artist)!==-1)score+=22;
  if(/\b(studio|live|compilation|soundtrack|debut|album)\b/.test(extract))score+=8;
  if(year&&extract.indexOf(year)!==-1)score+=3;
  if(/may refer to|can refer to|disambiguation/.test(extract))score-=60;
  if(page&&page.index)score+=Math.max(0,6-Number(page.index));
  return score;
}

async function fetchWikipediaAlbumCandidates(record,query){
  var params=new URLSearchParams({
    action:'query',
    format:'json',
    formatversion:'2',
    origin:'*',
    generator:'search',
    gsrsearch:query,
    gsrnamespace:'0',
    gsrlimit:'5',
    prop:'extracts|info',
    exintro:'1',
    inprop:'url',
    redirects:'1'
  });
  var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{method:'GET',credentials:'omit'});
  if(!response.ok)throw new Error('Wikipedia returned '+response.status);
  var data=await response.json();
  return data&&data.query&&Array.isArray(data.query.pages)?data.query.pages:[];
}

async function fetchWikipediaFirstSection(page){
  if(!page)return null;
  var params=new URLSearchParams({
    action:'parse',
    format:'json',
    formatversion:'2',
    origin:'*',
    prop:'sections',
    redirects:'1'
  });
  if(page.pageid)params.set('pageid',String(page.pageid));
  else if(page.title)params.set('page',String(page.title));
  else return null;
  var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{method:'GET',credentials:'omit'});
  if(!response.ok)return null;
  var data=await response.json();
  var sections=data&&data.parse&&Array.isArray(data.parse.sections)?data.parse.sections:[];
  var section=sections.find(function(item){return String(item.level||'')==='2'||Number(item.toclevel)===1;});
  if(!section||!section.line)return null;
  var holder=document.createElement('div');
  holder.innerHTML=String(section.line);
  return {
    heading:String(holder.textContent||'').replace(/\s+/g,' ').trim(),
    index:section.index===undefined||section.index===null?'':String(section.index)
  };
}

async function fetchWikipediaSectionParagraphs(page,sectionIndex){
  if(!page||sectionIndex==='')return [];
  var params=new URLSearchParams({
    action:'parse',
    format:'json',
    formatversion:'2',
    origin:'*',
    prop:'text',
    section:String(sectionIndex),
    redirects:'1',
    disableeditsection:'1'
  });
  if(page.pageid)params.set('pageid',String(page.pageid));
  else if(page.title)params.set('page',String(page.title));
  else return [];
  var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{method:'GET',credentials:'omit'});
  if(!response.ok)return [];
  var data=await response.json();
  var html=data&&data.parse?String(data.parse.text||''):'';
  if(!html)return [];
  var doc=new DOMParser().parseFromString(html,'text/html');
  Array.prototype.slice.call(doc.body.querySelectorAll('sup.reference,.mw-editsection,style,script,table,figure,.navbox,.infobox,.thumb,.hatnote')).forEach(function(element){element.remove();});
  return Array.prototype.slice.call(doc.body.querySelectorAll('p')).map(function(paragraph){
    return String(paragraph.textContent||'').replace(/\s+/g,' ').trim();
  }).filter(Boolean);
}

function readWikipediaCache(record){
  var key=wikipediaCacheKey(record);
  if(wikipediaAlbumCache.has(key))return wikipediaAlbumCache.get(key);
  try{
    var stored=JSON.parse(localStorage.getItem(key)||'null');
    if(stored&&stored.savedAt&&Date.now()-stored.savedAt<WIKIPEDIA_CACHE_TTL&&stored.text){
      wikipediaAlbumCache.set(key,stored);
      return stored;
    }
  }catch(error){}
  return null;
}

function saveWikipediaCache(record,result){
  var key=wikipediaCacheKey(record);
  var cached={text:result.text,heading:result.heading||'',sectionParagraphs:Array.isArray(result.sectionParagraphs)?result.sectionParagraphs:[],url:result.url,title:result.title,savedAt:Date.now()};
  wikipediaAlbumCache.set(key,cached);
  try{localStorage.setItem(key,JSON.stringify(cached));}catch(error){}
  return cached;
}

function renderWikipediaAbout(result){
  if(!detailAboutAlbum||!detailAboutAlbumText||!detailAboutAlbumLink)return;
  if(!result||!result.text){detailAboutAlbum.hidden=true;return;}
  renderWikipediaParagraphs(result.text,result.heading||'',result.sectionParagraphs||[]);
  detailAboutAlbumLink.href=result.url||'https://en.wikipedia.org/';
  detailAboutAlbumLink.setAttribute('aria-label','Read '+(result.title||'this album article')+' on Wikipedia');
  detailAboutAlbum.hidden=false;
  syncWikipediaAboutToggle(true);
}

async function loadWikipediaAlbumAbout(record){
  var requestVersion=++wikipediaAboutRequestVersion;
  if(!detailAboutAlbum||!detailAboutAlbumText||!detailAboutAlbumLink)return;

  var cached=readWikipediaCache(record);
  if(cached){renderWikipediaAbout(cached);return;}

  renderWikipediaParagraphs('Loading album information…','',[]);
  if(detailAboutAlbumToggle)detailAboutAlbumToggle.hidden=true;
  if(detailAboutAlbumBody){detailAboutAlbumBody.classList.remove('expanded');detailAboutAlbumBody.style.maxHeight='';}
  detailAboutAlbumLink.href='https://en.wikipedia.org/';
  detailAboutAlbum.hidden=false;

  try{
    var album=String(record&&record[2]||'').trim();
    var artist=String(record&&record[1]||'').trim();
    var queries=['"'+album+'" "'+artist+'" album',album+' '+artist+' album'];
    var pages=[];

    for(var q=0;q<queries.length&&!pages.length;q++){
      pages=await fetchWikipediaAlbumCandidates(record,queries[q]);
    }

    if(requestVersion!==wikipediaAboutRequestVersion)return;
    var ranked=pages.map(function(page){return {page:page,score:wikipediaCandidateScore(page,record)};}).sort(function(a,b){return b.score-a.score;});
    var best=ranked.length?ranked[0]:null;
    var introduction=best&&best.score>=18?wikipediaIntroduction(best.page.extract):'';

    if(!introduction){detailAboutAlbum.hidden=true;return;}
    var firstSection=await fetchWikipediaFirstSection(best.page);
    if(requestVersion!==wikipediaAboutRequestVersion)return;
    var firstHeading=firstSection&&firstSection.heading?firstSection.heading:'';
    var sectionParagraphs=firstSection?await fetchWikipediaSectionParagraphs(best.page,firstSection.index):[];
    if(requestVersion!==wikipediaAboutRequestVersion)return;
    var result=saveWikipediaCache(record,{text:introduction,heading:firstHeading,sectionParagraphs:sectionParagraphs,url:best.page.fullurl||'https://en.wikipedia.org/wiki/'+encodeURIComponent(best.page.title||''),title:best.page.title||''});
    renderWikipediaAbout(result);
  }catch(error){
    if(requestVersion!==wikipediaAboutRequestVersion)return;
    console.warn('Could not load Wikipedia album information:',error);
    detailAboutAlbum.hidden=true;
  }
}

if(detailAboutAlbumToggle){
  detailAboutAlbumToggle.addEventListener('click',function(){
    var expanded=this.getAttribute('aria-expanded')==='true';
    setWikipediaAboutExpanded(!expanded,true);
  });
}


function detailSocialEscape(value){
  return esc(value==null?'':String(value));
}

function detailSocialCacheGet(key){
  var item=detailSocialCache.get(key);
  if(!item)return null;
  if(Date.now()-item.time>120000){detailSocialCache.delete(key);return null;}
  return item.value;
}

function detailSocialCacheSet(key,value){
  detailSocialCache.set(key,{time:Date.now(),value:value});
  if(detailSocialCache.size>120){
    var first=detailSocialCache.keys().next();
    if(!first.done)detailSocialCache.delete(first.value);
  }
}

function hideDetailSocialContext(){
  if(!detailSocialContext)return;
  detailSocialContext.hidden=true;
  detailSocialContext.innerHTML='';
  detailSocialContext.classList.remove('own-match');
}

function renderFollowedCollectorsForAlbum(profiles){
  if(!detailSocialContext||!profiles||!profiles.length){hideDetailSocialContext();return;}
  detailSocialContext.classList.remove('own-match');
  detailSocialContext.hidden=false;

  var compact=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
  var slotLimit=compact?4:10;
  var hasMore=profiles.length>slotLimit;
  var visibleLimit=hasMore?slotLimit-1:slotLimit;
  var visibleProfiles=profiles.slice(0,visibleLimit);
  var extraProfiles=profiles.slice(visibleLimit);

  function personButton(profile,extraClass){
    var username=profile.username||'Collector';
    return '<button class="detail-social-person'+(extraClass?' '+extraClass:'')+'" type="button" data-detail-social-username="'+detailSocialEscape(username)+'" data-tooltip="'+detailSocialEscape(username)+'" aria-label="View '+detailSocialEscape(username)+'">'+
      '<span class="detail-social-avatar" style="background-image:url(&quot;'+detailSocialEscape(profile.avatar_url||'/avatar_placeholder.png')+'&quot;)"></span>'+
      '<span class="detail-social-person-name">'+detailSocialEscape(username)+'</span>'+
    '</button>';
  }

  detailSocialContext.innerHTML=
    '<div class="detail-social-heading"><strong>Also collected by</strong><small>Collectors you follow</small></div>'+
    '<div class="detail-social-people">'+
      visibleProfiles.map(function(profile){return personButton(profile,'');}).join('')+
      (hasMore?'<button class="detail-social-more" type="button" data-detail-social-more aria-expanded="false" aria-label="Show more collectors">…</button>':'')+
    '</div>'+
    (hasMore?'<div class="detail-social-menu" data-detail-social-menu hidden><div class="detail-social-menu-title">More collectors</div><div class="detail-social-menu-list">'+extraProfiles.map(function(profile){return personButton(profile,'detail-social-menu-person');}).join('')+'</div></div>':'');
}

function renderOwnCollectionMatch(){
  if(!detailSocialContext)return;
  detailSocialContext.classList.add('own-match');
  detailSocialContext.hidden=false;
  detailSocialContext.innerHTML=
    '<span class="detail-social-check" aria-hidden="true">✓</span>'+
    '<div class="detail-own-match-copy"><span>COLLECTION MATCH</span><strong>This record is also in your collection</strong></div>';
}

async function loadDetailSocialContext(record,index){
  var requestVersion=++detailSocialRequestVersion;
  hideDetailSocialContext();
  if(!record||!record[8])return;

  var sessionResult=await supabaseClient.auth.getSession();
  if(requestVersion!==detailSocialRequestVersion||detailOpenRecordIndex!==index)return;
  var sessionUser=sessionResult.data&&sessionResult.data.session&&sessionResult.data.session.user;
  if(!sessionUser)return;

  var albumId=record[8];
  var masterId=String(record[10]||'').trim();
  var matchKey=masterId?'master:'+masterId:'album:'+albumId;

  try{
    if(viewedUserId!==null){
      var ownKey='own:'+sessionUser.id+':'+matchKey;
      var ownMatch=detailSocialCacheGet(ownKey);
      if(ownMatch===null){
        var ownQuery=supabaseClient.from('collections')
          .select(masterId?'id,albums!inner(discogs_master_id)':'id')
          .eq('user_id',sessionUser.id)
          .limit(1);
        ownQuery=masterId
          ?ownQuery.eq('albums.discogs_master_id',masterId)
          :ownQuery.eq('album_id',albumId);
        var ownResult=await ownQuery;
        if(ownResult.error)throw ownResult.error;
        ownMatch=!!(ownResult.data&&ownResult.data.length);
        detailSocialCacheSet(ownKey,ownMatch);
      }
      if(requestVersion!==detailSocialRequestVersion||detailOpenRecordIndex!==index)return;
      if(ownMatch)renderOwnCollectionMatch();
      return;
    }

    if(window.libraryView==='wishlist')return;

    var followedKey='followed:'+sessionUser.id+':'+matchKey;
    var cachedProfiles=detailSocialCacheGet(followedKey);
    if(cachedProfiles!==null){
      if(requestVersion===detailSocialRequestVersion&&detailOpenRecordIndex===index)renderFollowedCollectorsForAlbum(cachedProfiles);
      return;
    }

    var followResult=await supabaseClient.from('user_follows')
      .select('followed_id')
      .eq('follower_id',sessionUser.id);
    if(followResult.error)throw followResult.error;
    var followedIds=(followResult.data||[]).map(function(row){return row.followed_id;}).filter(Boolean);
    if(!followedIds.length){detailSocialCacheSet(followedKey,[]);return;}

    var collectionQuery=supabaseClient.from('collections')
      .select(masterId?'user_id,albums!inner(discogs_master_id)':'user_id')
      .in('user_id',followedIds);
    collectionQuery=masterId
      ?collectionQuery.eq('albums.discogs_master_id',masterId)
      :collectionQuery.eq('album_id',albumId);
    var collectionResult=await collectionQuery;
    if(collectionResult.error)throw collectionResult.error;
    var matchingIds=Array.from(new Set((collectionResult.data||[]).map(function(row){return row.user_id;}).filter(Boolean)));
    if(!matchingIds.length){detailSocialCacheSet(followedKey,[]);return;}

    var profileResult=await supabaseClient.from('profiles')
      .select('id,username,avatar_url')
      .in('id',matchingIds);
    if(profileResult.error)throw profileResult.error;

    var order=new Map(matchingIds.map(function(id,pos){return [id,pos];}));
    var profiles=(profileResult.data||[]).slice().sort(function(a,b){
      return (order.get(a.id)||0)-(order.get(b.id)||0);
    });
    detailSocialCacheSet(followedKey,profiles);
    if(requestVersion!==detailSocialRequestVersion||detailOpenRecordIndex!==index)return;
    renderFollowedCollectorsForAlbum(profiles);
  }catch(error){
    console.warn('Could not load album collection matches:',error);
    if(requestVersion===detailSocialRequestVersion&&detailOpenRecordIndex===index)hideDetailSocialContext();
  }
}

window.addEventListener('groovy-follow-changed',function(){detailSocialCache.clear();});

function positionDetailSocialMenu(menu){
  if(!menu)return;
  menu.style.top='';
  menu.style.bottom='';
  menu.style.maxHeight='';
  if(!window.matchMedia||!window.matchMedia('(min-width:761px)').matches)return;
  var cover=document.querySelector('.album-detail-cover');
  if(!cover)return;
  var coverRect=cover.getBoundingClientRect();
  var contextRect=detailSocialContext.getBoundingClientRect();
  var gap=6;
  var below=Math.floor(coverRect.bottom-contextRect.bottom-gap);
  var above=Math.floor(contextRect.top-coverRect.top-gap);
  if(below>=96||below>=above){
    menu.style.top='calc(100% + '+gap+'px)';
    menu.style.bottom='auto';
    menu.style.maxHeight=Math.max(72,Math.min(260,below))+'px';
  }else{
    menu.style.top='auto';
    menu.style.bottom='calc(100% + '+gap+'px)';
    menu.style.maxHeight=Math.max(72,Math.min(260,above))+'px';
  }
}

if(detailSocialContext){
  detailSocialContext.addEventListener('click',function(event){
    var moreButton=event.target.closest('[data-detail-social-more]');
    if(moreButton){
      event.preventDefault();
      event.stopPropagation();
      var menu=detailSocialContext.querySelector('[data-detail-social-menu]');
      if(!menu)return;
      var opening=menu.hidden;
      menu.hidden=!opening;
      moreButton.setAttribute('aria-expanded',opening?'true':'false');
      detailSocialContext.classList.toggle('menu-open',opening);
      if(opening)window.requestAnimationFrame(function(){positionDetailSocialMenu(menu);});
      return;
    }

    var button=event.target.closest('[data-detail-social-username]');
    if(!button)return;
    var username=button.getAttribute('data-detail-social-username');
    if(!username)return;
    closeAlbum();
    openCollectorRoute(username,'profile');
  });
}

document.addEventListener('click',function(event){
  if(!detailSocialContext||detailSocialContext.hidden||detailSocialContext.contains(event.target))return;
  var menu=detailSocialContext.querySelector('[data-detail-social-menu]');
  var moreButton=detailSocialContext.querySelector('[data-detail-social-more]');
  if(menu)menu.hidden=true;
  if(moreButton)moreButton.setAttribute('aria-expanded','false');
  detailSocialContext.classList.remove('menu-open');
});

function openAlbum(index){
  var record=records[index];
  if(!record)return;

  detailOpenRecordIndex=index;
  closeTraderaModal();
  closeEbayModal();
  resetMarketplacePriceSummary(index);
  loadTraderaListings(record,index);
  if(ebayEnabled)loadEbayListings(record,index);
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
  loadWikipediaAlbumAbout(record);

  renderDetailRatingPanels(index);
  renderDetailShelfStatus(index);
  renderDetailShelfActions(index);
  loadDetailSocialContext(record,index);
  renderDetailTracklist(record);
  ensureDetailTrackDurations(record,index);

  albumOverlay.className='album-overlay visible';
  document.body.style.overflow='hidden';
  requestAnimationFrame(function(){
    syncDesktopAlbumMiddleHeight();
    syncMobileDetailPairHeight();
    requestAnimationFrame(function(){
      syncDesktopAlbumMiddleHeight();
      syncMobileDetailPairHeight();
    });
  });
}

async function saveAlbumRating(index,rating){
  var record=records[index];
  if(!record)return;

  var {data:{user},error:userError}=await supabaseClient.auth.getUser();
  if(userError||!user){
    alert('Du måste vara inloggad.');
    return;
  }

  var albumId=record[8];
  var previousOwnRating=clampGroovyRating(record[5]);
  var previousAverage=clampGroovyRating(record[15]);
  var previousCount=parseInt(record[16],10)||0;

  var {error}=await supabaseClient
    .from('album_ratings')
    .upsert({
      user_id:user.id,
      album_id:albumId,
      rating:rating
    },{
      onConflict:'user_id,album_id'
    });

  if(error){
    console.error('Kunde inte spara albumrating:',error);
    alert('Kunde inte spara ratingen.\n\n'+error.message);
    return;
  }

  var nextCount=previousCount;
  var nextAverage=previousAverage;
  if(previousOwnRating>0&&previousCount>0){
    nextAverage=((previousAverage*previousCount)-previousOwnRating+rating)/previousCount;
  }else if(rating>0){
    nextCount=previousCount+1;
    nextAverage=((previousAverage*previousCount)+rating)/Math.max(1,nextCount);
  }
  nextAverage=Math.round(clampGroovyRating(nextAverage)*10)/10;

  for(var r=0;r<records.length;r++){
    if(records[r][8]!==albumId)continue;
    records[r][5]=rating;
    records[r][15]=nextAverage;
    records[r][16]=nextCount;
  }

  renderDetailRatingPanels(index);

  var cards=collection.querySelectorAll('.record');
  for(var c=0;c<cards.length;c++){
    var cardIndex=parseInt(cards[c].getAttribute('data-index'),10);
    var cardRecord=records[cardIndex];
    if(!cardRecord||cardRecord[8]!==albumId)continue;
    var coverRating=cards[c].querySelector('.cover-rating');
    if(coverRating){
      coverRating.innerHTML='<span class="cover-rating-inner">'+renderStaticStarMeter(nextAverage,'is-compact')+'<span class="cover-rating-number">'+esc(formatCommunityRating(nextAverage))+'</span></span>';
    }
  }

  window.dispatchEvent(new CustomEvent('groovy-rating-updated',{detail:{albumId:albumId,index:index,source:'save'}}));
}

function closeAlbum(){
  wikipediaAboutRequestVersion++;
  if(detailAboutAlbum)detailAboutAlbum.hidden=true;
  if(detailAboutAlbumToggle){detailAboutAlbumToggle.hidden=true;detailAboutAlbumToggle.setAttribute('aria-expanded','false');}
  if(detailAboutAlbumBody){detailAboutAlbumBody.classList.remove('expanded');detailAboutAlbumBody.style.maxHeight='';}
  closeTraderaModal();
  closeEbayModal();
  traderaRequestVersion++;
  ebayRequestVersion++;
  clearMarketplacePriceSummary();
  albumOverlay.className='album-overlay';
  document.body.style.overflow='';
  setCopyDetailsExpanded(false);
  copyDetailsRecordKey='';
  detailOpenRecordIndex=-1;
  detailSocialRequestVersion++;
  if(detailShelfActions){detailShelfActions.hidden=true;detailShelfActions.innerHTML='';}
  if(detailShelfStatus){detailShelfStatus.hidden=true;detailShelfStatus.innerHTML='';detailShelfStatus.classList.remove('unshelved');}
  hideDetailSocialContext();
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

  var deletedShelfId=record[13]||'';
  records.splice(index,1);
  records
    .slice()
    .sort(function(a,b){return (parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);})
    .forEach(function(item,position){item[0]=position+1;});

  if(deletedShelfId)compactLocalShelfOrder(deletedShelfId);

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

    if(view==='carousel'&&drag)return;

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
    if(view!=='grid'||selectedRating!=='all'||librarySearchQuery||librarySort!=='added'){
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

  var query=librarySearchQuery.toLocaleLowerCase();
  var visibleRecords=shelfRecords.filter(function(record){
    var rating=parseInt(record[5],10);
    var matchesRating=isWishlist||selectedRating==='all'||rating===parseInt(selectedRating,10);
    var matchesSearch=!query||[record[1],record[2],record[3],record[4]].join(' ').toLocaleLowerCase().indexOf(query)!==-1;
    return matchesRating&&matchesSearch;
  });
  visibleRecords=visibleRecords.slice().sort(function(a,b){
    if(librarySort==='album-asc')return String(a[2]||'').localeCompare(String(b[2]||''),undefined,{sensitivity:'base'});
    if(librarySort==='album-desc')return String(b[2]||'').localeCompare(String(a[2]||''),undefined,{sensitivity:'base'});
    if(librarySort==='artist-asc')return String(a[1]||'').localeCompare(String(b[1]||''),undefined,{sensitivity:'base'});
    if(librarySort==='artist-desc')return String(b[1]||'').localeCompare(String(a[1]||''),undefined,{sensitivity:'base'});
    if(librarySort==='year-desc')return (parseInt(b[3],10)||0)-(parseInt(a[3],10)||0);
    if(librarySort==='year-asc')return (parseInt(a[3],10)||9999)-(parseInt(b[3],10)||9999);
    if(!isWishlist&&activeShelfId!=='all'){
      var aShelfOrder=parseInt(a[14],10);
      var bShelfOrder=parseInt(b[14],10);
      if(isNaN(aShelfOrder))aShelfOrder=2147483647;
      if(isNaN(bShelfOrder))bShelfOrder=2147483647;
      return aShelfOrder-bShelfOrder||(parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);
    }
    return (parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);
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

function setActive(index){
  activeIndex=index;

  var cards=document.getElementsByClassName('carousel-card');

  for(var i=0;i<cards.length;i++){
    cards[i].className=cards[i].className.replace(/\sactive\b/g,'');

    if(i===index){
      cards[i].className+=' active';
    }
  }
}

function animateScroll(element,to,smooth){
  if(!smooth){
    element.scrollLeft=to;
    return;
  }

  if(element.scrollTo){
    try{
      element.scrollTo({left:to,behavior:'smooth'});
      return;
    }catch(e){}
  }

  var from=element.scrollLeft;
  var change=to-from;
  var duration=420;
  var start=new Date().getTime();

  function step(){
    var time=new Date().getTime();
    var progress=Math.min(1,(time-start)/duration);
    var easing=progress*(2-progress);
    element.scrollLeft=from+change*easing;
    if(progress<1)setTimeout(step,16);
  }
  step();
}

function centerCard(index,smooth){
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');
  var card=cards[index];

  if(!viewport||!card)return;

  var target=card.offsetLeft-(viewport.clientWidth-card.offsetWidth)/2;
  var max=viewport.scrollWidth-viewport.clientWidth;

  target=Math.max(0,Math.min(target,max));

  setActive(index);
  animateScroll(viewport,target,smooth);
}

function nearest(){
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');
  var center=viewport.scrollLeft+viewport.clientWidth/2;

  var best=0;
  var distance=Infinity;

  for(var i=0;i<cards.length;i++){
    var card=cards[i];
    var cardCenter=card.offsetLeft+card.offsetWidth/2;
    var currentDistance=Math.abs(cardCenter-center);

    if(currentDistance<distance){
      distance=currentDistance;
      best=i;
    }
  }

  return best;
}

function buildCarousel(){
  collection.className='collection carousel';

  var html=
    '<div class="carousel-viewport" id="carouselViewport">'+
      '<div class="carousel-track" id="carouselTrack">';

  for(var i=0;i<records.length;i++){
    var rating=parseInt(records[i][5],10);
  
    if(selectedRating==='all'||rating===parseInt(selectedRating,10)){
      html+=recordHTML(records[i],'carousel-card');
    }
  }

  html+='</div></div>';
  collection.innerHTML=html;
  loadVisibleImages();
  
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');

  attachWishlistRemoveControls();
  attachAlbumClicks();

  function scheduleSettle(){
    if(scrollTimer)clearTimeout(scrollTimer);

    scrollTimer=setTimeout(function(){
      setActive(nearest());
    },180);
  }

  viewport.onscroll=function(){
    scheduleImageLoad();
    scheduleSettle();
  };

  viewport.ontouchstart=function(event){
    if(!event.touches||!event.touches.length)return;

    drag=false;
    startX=event.touches[0].pageX;
    startY=event.touches[0].pageY;
    startScroll=viewport.scrollLeft;

    if(scrollTimer)clearTimeout(scrollTimer);
  };

  viewport.ontouchmove=function(event){
    if(!event.touches||!event.touches.length)return;

    var dx=event.touches[0].pageX-startX;

    if(Math.abs(dx)>8)drag=true;
  };

  viewport.ontouchend=function(){
    scheduleSettle();

    setTimeout(function(){
      drag=false;
    },120);
  };

  setTimeout(function(){
    centerCard(activeIndex,false);
    scheduleImageLoad();
  },30);
}

function setView(nextView){
  view=nextView;

  view='grid';
  buildGrid();
}

albumClose.onclick=function(){
  closeAlbum();
};

syncMarketplaceCurrencyControl();
if(marketplaceCurrencySelect)marketplaceCurrencySelect.addEventListener('change',function(){
  try{localStorage.setItem(MARKETPLACE_CURRENCY_STORAGE_KEY,this.value);}catch(error){}
  syncMarketplaceCurrencyControl();
  if(marketplacePriceAlbumIndex>=0)refreshMarketplaceBestPrice(marketplacePriceAlbumIndex);
});

traderaButton.addEventListener('click',function(event){
  event.preventDefault();
  event.stopPropagation();
  openTraderaModal();
});

closeTraderaModalButton.addEventListener('click',function(){
  closeTraderaModal();
});

traderaModal.addEventListener('click',function(event){
  if(event.target===traderaModal)closeTraderaModal();
});

ebayButton.addEventListener('click',function(event){
  event.preventDefault();
  event.stopPropagation();
  openEbayModal();
});

closeEbayModalButton.addEventListener('click',function(){
  closeEbayModal();
});

ebayModal.addEventListener('click',function(event){
  if(event.target===ebayModal)closeEbayModal();
});

albumOverlay.onclick=function(event){
  if((event||window.event).target===albumOverlay){
    closeAlbum();
  }
};

document.onkeydown=function(event){
  event=event||window.event;

  if(event.keyCode===27){
    if(ebayModal.classList.contains('visible')){
      closeEbayModal();
      return;
    }
    if(traderaModal.classList.contains('visible')){
      closeTraderaModal();
      return;
    }
    if(albumOverlay.className.indexOf('visible')!==-1){
      closeAlbum();
    }
    return;
  }

  if(view!=='carousel')return;

  if(event.keyCode===39&&activeIndex<records.length-1){
    centerCard(activeIndex+1,true);
  }else if(event.keyCode===37&&activeIndex>0){
    centerCard(activeIndex-1,true);
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

    activeIndex=0;
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

const searchUserButton=document.getElementById('searchUserButton');
const searchUserModal=document.getElementById('searchUserModal');
const closeSearchUser=document.getElementById('closeSearchUser');

const userSearchInput=document.getElementById('userSearchInput');
const userSearchResults=document.getElementById('userSearchResults');

let userSearchTimer=null;
var userPresenceChannel=null;
var presenceUserId='';
var onlineUserIds=new Set();
var anonymousPresenceKey='viewer-'+Math.random().toString(36).slice(2)+'-'+Date.now().toString(36);
const onlineUsersStatus=document.getElementById('onlineUsersStatus');
const onlineUsersCount=document.getElementById('onlineUsersCount');
const onlineUsersDesktopLabel=document.getElementById('onlineUsersDesktopLabel');

function refreshOnlineUserCount(){
    const count=onlineUserIds.size;
    if(!onlineUsersStatus||!onlineUsersCount)return;
    onlineUsersCount.textContent=String(count);
    if(onlineUsersDesktopLabel)onlineUsersDesktopLabel.textContent=count===1?'user online':'users online';
    onlineUsersStatus.classList.toggle('has-users',count>0);
    onlineUsersStatus.setAttribute('aria-label',count+' '+(count===1?'user online':'users online'));
}

function refreshUserPresenceDots(){
    document.querySelectorAll('.user-presence-dot[data-user-id]').forEach(function(dot){
        const isOnline=onlineUserIds.has(dot.dataset.userId);
        dot.classList.toggle('online',isOnline);
        dot.setAttribute('aria-label',isOnline?'Online':'Offline');
        dot.title=isOnline?'Online now':'';
    });
    refreshOnlineUserCount();
}

function addUserPresenceDot(avatar,userId){
    const dot=document.createElement('span');
    dot.className='user-presence-dot';
    dot.dataset.userId=String(userId||'');
    avatar.appendChild(dot);
    refreshUserPresenceDots();
}

async function syncUserPresence(user){
    const nextUserId=user&&user.id?String(user.id):'';
    const nextPresenceIdentity=nextUserId||'__viewer__';
    if(nextPresenceIdentity===presenceUserId&&userPresenceChannel)return;

    const previousChannel=userPresenceChannel;
    userPresenceChannel=null;
    presenceUserId=nextPresenceIdentity;
    onlineUserIds=new Set();
    refreshUserPresenceDots();

    if(previousChannel){
        try{await previousChannel.untrack();}catch(error){}
        try{await supabaseClient.removeChannel(previousChannel);}catch(error){}
    }

    const channel=supabaseClient.channel('groovy-online-users',{
        config:{presence:{key:nextUserId||anonymousPresenceKey}}
    });
    userPresenceChannel=channel;

    channel.on('presence',{event:'sync'},function(){
        if(channel!==userPresenceChannel)return;
        const presenceState=channel.presenceState();
        onlineUserIds=new Set(
            Object.keys(presenceState||{}).filter(function(key){return key.indexOf('viewer-')!==0;})
        );
        refreshUserPresenceDots();
    });

    channel.subscribe(async function(status){
        if(channel!==userPresenceChannel)return;
        if(status==='SUBSCRIBED'&&nextUserId){
            try{
                await channel.track({user_id:nextUserId,online_at:new Date().toISOString()});
            }catch(error){
                console.warn('Could not update online status:',error);
            }
            return;
        }
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
            onlineUserIds=new Set();
            refreshUserPresenceDots();
        }
    });
}

userSearchInput.addEventListener('input',function(){
    const query=userSearchInput.value.trim();

    clearTimeout(userSearchTimer);

    if(query.length<2){
        loadTopUsers();
        return;
    }

    userSearchResults.innerHTML='<p>Searching...</p>';

    userSearchTimer=setTimeout(function(){
        searchUsers(query);
    },250);
});

function appendUserSearchFollowButton(container,user,sessionUser,followingSet){
    if(!container||!user||!sessionUser||user.id===sessionUser.id)return;
    var button=document.createElement('button');
    button.type='button';
    button.className='user-search-follow-button';
    button.dataset.username=user.username||'collector';
    setFollowButtonState(button,user.id,followingSet&&followingSet.has(user.id));
    button.addEventListener('click',async function(event){
        event.preventDefault();
        event.stopPropagation();
        var wasFollowing=button.dataset.following==='true';
        button.disabled=true;
        button.textContent=wasFollowing?'Unfollowing...':'Following...';
        try{
            if(wasFollowing)await window.groovyUnfollowUser(user.id);
            else await window.groovyFollowUser(user.id);
            setFollowButtonState(button,user.id,!wasFollowing);
        }catch(error){
            console.error('Could not change follow status:',error);
            setFollowButtonState(button,user.id,wasFollowing);
        }
        button.disabled=false;
    });
    container.appendChild(button);
}

async function loadTopUsers(){
    const {data:users,error}=await supabaseClient
        .from('profiles')
        .select('id,username,avatar_url');

    if(error){
        console.error('Top users error:',error);
        userSearchResults.innerHTML='<p>Could not load users.</p>';
        return;
    }

    if(!users||!users.length){
        userSearchResults.innerHTML='<p>No users found.</p>';
        return;
    }

    const sessionUser=await currentSessionUser();
    const followingSet=sessionUser?await groovyFollowingIds(users.map(function(user){return user.id;})):new Set();

    const userCollectionCounts=await Promise.all(
        users.map(async function(user){
            const {count,error}=await supabaseClient
                .from('collections')
                .select('id',{count:'exact',head:true})
                .eq('user_id',user.id);

            return {
                id:user.id,
                count:error?0:(count||0)
            };
        })
    );

    userCollectionCounts.sort(function(a,b){
        return b.count-a.count;
    });

    const topUsers=userCollectionCounts.slice(0,10);

    userSearchResults.innerHTML='';

    topUsers.forEach(function(item){
        const user=users.find(function(user){
            return user.id===item.id;
        });

        if(!user)return;

        const div=document.createElement('div');

        div.className='user-search-result';
        div.dataset.userId=user.id;
        div.style.cursor='pointer';

        const avatar=document.createElement('div');
        avatar.className='user-search-avatar';

        avatar.style.backgroundImage='url("'+
            (user.avatar_url||'/avatar_placeholder.png')+
            '")';

        avatar.style.backgroundSize='cover';
        avatar.style.backgroundPosition='center';
        addUserPresenceDot(avatar,user.id);

        const userInfo=document.createElement('div');
        userInfo.className='user-search-info';

        const username=document.createElement('span');
        username.className='user-search-username';
        username.textContent=user.username;

        const collectionCount=document.createElement('span');
        collectionCount.className='user-search-count';
        collectionCount.textContent=item.count+' collected records';

        userInfo.appendChild(username);
        userInfo.appendChild(collectionCount);

        div.appendChild(avatar);
        div.appendChild(userInfo);
        appendUserSearchFollowButton(div,user,sessionUser,followingSet);

        userSearchResults.appendChild(div);

        div.addEventListener('click',function(){
            searchUserModal.style.display='none';
            history.pushState({},'','/shelf/'+encodeURIComponent(user.username));
            renderCurrentRoute();
        });
    });
}

async function searchUsers(query){
    const {data,error}=await supabaseClient
        .from('profiles')
        .select('id,username,avatar_url')
        .ilike('username','%'+query+'%')
        .limit(10);

    if(error){
        console.error('User search error:',error);
        userSearchResults.innerHTML='<p>Could not search users.</p>';
        return;
    }

    userSearchResults.innerHTML='';

    if(!data||!data.length){
        userSearchResults.innerHTML='<p>No users found.</p>';
        return;
    }

    const sessionUser=await currentSessionUser();
    const followingSet=sessionUser?await groovyFollowingIds(data.map(function(user){return user.id;})):new Set();

    const userCollectionCounts=await Promise.all(
        data.map(async function(user){
            const {count,error}=await supabaseClient
                .from('collections')
                .select('id',{count:'exact',head:true})
                .eq('user_id',user.id);
    
            return {
                id:user.id,
                count:error?0:(count||0)
            };
        })
    );
    
    const collectionCountMap={};
    
    userCollectionCounts.forEach(function(item){
        collectionCountMap[item.id]=item.count;
    });

    data.forEach(function(user){
        const div=document.createElement('div');

        div.className='user-search-result';
        div.dataset.userId=user.id;
        div.style.cursor='pointer';
        
        const avatar=document.createElement('div');
        avatar.className='user-search-avatar';
    
        avatar.style.backgroundImage='url("'+
            (user.avatar_url||'/avatar_placeholder.png')+
            '")';
    
        avatar.style.backgroundSize='cover';
        avatar.style.backgroundPosition='center';
        addUserPresenceDot(avatar,user.id);
    
        const userInfo=document.createElement('div');
        userInfo.className='user-search-info';
        
        const username=document.createElement('span');
        username.className='user-search-username';
        username.textContent=user.username;
        
        const collectionCount=document.createElement('span');
        collectionCount.className='user-search-count';
        collectionCount.textContent=(collectionCountMap[user.id]||0)+' collected records';
        
        userInfo.appendChild(username);
        userInfo.appendChild(collectionCount);
        
        div.appendChild(avatar);
        div.appendChild(userInfo);
        appendUserSearchFollowButton(div,user,sessionUser,followingSet);
    
        userSearchResults.appendChild(div);

        div.addEventListener('click',function(){
            searchUserModal.style.display='none';
            history.pushState({},'','/shelf/'+encodeURIComponent(user.username));
            renderCurrentRoute();
        });
    });
}

window.addEventListener('groovy-follow-changed',function(event){
    var detail=event.detail||{};
    document.querySelectorAll('.user-search-follow-button[data-user-id="'+String(detail.userId||'')+'"]')
      .forEach(function(button){setFollowButtonState(button,detail.userId,!!detail.following);});
    if(viewedUserFollowButton&&String(viewedUserFollowButton.dataset.userId||'')===String(detail.userId||'')){
        setViewedUserFollowState(detail.userId,viewedUserFollowButton.dataset.username,!!detail.following);
    }
});

searchUserButton.addEventListener('click',async function(event){
    event.preventDefault();
    event.stopPropagation();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user)return;

    searchUserModal.style.display='flex';
    userSearchInput.value='';
    loadTopUsers();
    userSearchInput.focus();
});

closeSearchUser.addEventListener('click',function(){
    searchUserModal.style.display='none';
});

searchUserModal.addEventListener('click',function(event){
    if(event.target===searchUserModal){
        searchUserModal.style.display='none';
    }
});

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
if(viewedUserFollowButton)viewedUserFollowButton.addEventListener('click',async function(event){
    event.preventDefault();event.stopPropagation();
    var targetUserId=viewedUserFollowButton.dataset.userId;
    if(!targetUserId)return;
    var wasFollowing=viewedUserFollowButton.dataset.following==='true';
    viewedUserFollowButton.disabled=true;
    var label=viewedUserFollowButton.querySelector('.viewed-action-label');
    if(label)label.textContent=wasFollowing?'Unfollowing...':'Following...';
    try{
        if(wasFollowing)await window.groovyUnfollowUser(targetUserId);
        else await window.groovyFollowUser(targetUserId);
        setViewedUserFollowState(targetUserId,viewedUserFollowButton.dataset.username,!wasFollowing);
    }catch(error){
        console.error('Could not change follow status:',error);
        setViewedUserFollowState(targetUserId,viewedUserFollowButton.dataset.username,wasFollowing);
    }
    viewedUserFollowButton.disabled=false;
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

let searchTimer=null;

function openAddAlbumSearch(user){
    addAlbumModal.style.display='flex';
    addAlbumModal.scrollTop=0;

    if(user){
        getSearchLibraryState(user).catch(function(error){
            console.warn('Kunde inte förbereda sökstatus:',error);
        });
    }

    window.requestAnimationFrame(function(){
        try{
            albumSearchInput.focus({preventScroll:true});
        }catch(error){
            albumSearchInput.focus();
        }
    });
}

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
        '<img class="landing-record-art" src="/record.png" alt="Vinyl record">'+
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

closeAddAlbum.addEventListener('click',function(){
    addAlbumModal.style.display='none';
    albumSearchInput.value='';
    albumSearchResults.innerHTML='';
});

addAlbumModal.addEventListener('click',function(event){
    if(event.target===addAlbumModal){
        addAlbumModal.style.display='none';
        albumSearchInput.value='';
        albumSearchResults.innerHTML='';
    }
});

albumSearchInput.addEventListener('input',function(){
    const query=albumSearchInput.value.trim();

    clearTimeout(searchTimer);

    if(query.length<2){

        albumSearchResults.innerHTML='';
        return;
    }

    albumSearchResults.innerHTML='<p>Searching...</p>';

    searchTimer=setTimeout(function(){
        searchDiscogs(query);
    },250);
});

function escapeHTML(text){
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

let musicBrainzSearchNumber=0;
const appleAlbumSearchCache=new Map();
const coverArtArchiveCache=new Map();
const appleArtworkPersistentCache=new Map();
const appleArtworkPersistentLoaded=new Set();
const APPLE_RATE_LIMIT_COOLDOWN=65000;
const APPLE_ARTWORK_CACHE_FRESH_MS=90*24*60*60*1000;
let appleSearchBlockedUntil=0;
let appleArtworkPersistentCacheAvailable=true;

function discogsMasterAppleFields(master){
    const title=String(master&&master.title||'');
    const parts=title.split(' - ');
    const artist=
        parts.length>1
            ?parts[0].replace(/\s*\(\d+\)$/,'').trim()
            :'';
    const albumTitle=
        parts.length>1
            ?parts.slice(1).join(' - ').trim()
            :title.trim();

    return {
        masterId:String(master&&master.id||'').trim(),
        artist:artist,
        albumTitle:albumTitle,
        year:master&&master.year?String(master.year):''
    };
}

function appleArtworkCacheIsFresh(row){
    if(!row||!row.matched_at)return false;
    const matchedAt=Date.parse(row.matched_at);
    return Number.isFinite(matchedAt)&&Date.now()-matchedAt<APPLE_ARTWORK_CACHE_FRESH_MS;
}

function cachedAppleAlbumFromRow(row){
    if(!row||!row.artwork_url)return null;

    return {
        artistName:row.artist_name||'',
        collectionName:row.album_title||'',
        releaseDate:row.release_year?String(row.release_year)+'-01-01T00:00:00Z':'',
        artworkUrl100:row.artwork_url||'',
        collectionViewUrl:row.apple_collection_url||'',
        collectionId:row.apple_collection_id||null
    };
}

async function getPersistentAppleArtworkCache(masters){
    const result=new Map();

    if(!appleArtworkPersistentCacheAvailable)return result;

    const ids=[...new Set(
        (masters||[])
            .map(function(master){
                return String(master&&master.id||'').trim();
            })
            .filter(Boolean)
    )];

    ids.forEach(function(id){
        if(appleArtworkPersistentCache.has(id)){
            result.set(id,appleArtworkPersistentCache.get(id));
        }
    });

    const missingIds=ids.filter(function(id){
        return !appleArtworkPersistentLoaded.has(id);
    });

    if(!missingIds.length)return result;

    try{
        const {data,error}=await supabaseClient
            .from('apple_artwork_cache')
            .select('discogs_master_id,artist_name,album_title,release_year,apple_collection_id,apple_collection_url,artwork_url,matched_at')
            .in('discogs_master_id',missingIds);

        if(error)throw error;

        missingIds.forEach(function(id){
            appleArtworkPersistentLoaded.add(String(id));
        });

        (data||[]).forEach(function(row){
            const id=String(row.discogs_master_id||'');
            if(!id)return;
            appleArtworkPersistentCache.set(id,row);
            result.set(id,row);
        });
    }catch(error){
        appleArtworkPersistentCacheAvailable=false;
        console.warn('Apple artwork cache unavailable:',error);
    }

    return result;
}

async function savePersistentAppleArtworkMatches(matches){
    if(!appleArtworkPersistentCacheAvailable||!Array.isArray(matches)||!matches.length)return;

    const byMaster=new Map();

    matches.forEach(function(match){
        const masterId=String(match&&match.masterId||'').trim();
        const artworkUrl=String(match&&match.artworkUrl100||'').trim();
        const collectionUrl=String(match&&match.collectionUrl||'').trim();

        if(!masterId||!artworkUrl||!collectionUrl)return;

        byMaster.set(masterId,{
            discogs_master_id:Number(masterId),
            artist_name:String(match.artist||'').trim().slice(0,300),
            album_title:String(match.albumTitle||'').trim().slice(0,500),
            release_year:parseInt(match.year,10)||null,
            apple_collection_id:match.collectionId?Number(match.collectionId):null,
            apple_collection_url:collectionUrl.slice(0,1500),
            artwork_url:artworkUrl.slice(0,1500)
        });
    });

    const payload=[...byMaster.values()].filter(function(item){
        return Number.isFinite(item.discogs_master_id)&&item.discogs_master_id>0;
    }).slice(0,200);

    if(!payload.length)return;

    try{
        const {error}=await supabaseClient.rpc(
            'upsert_apple_artwork_cache',
            {p_matches:payload}
        );

        if(error)throw error;

        const matchedAt=new Date().toISOString();

        payload.forEach(function(item){
            const id=String(item.discogs_master_id);
            const row={
                discogs_master_id:item.discogs_master_id,
                artist_name:item.artist_name,
                album_title:item.album_title,
                release_year:item.release_year,
                apple_collection_id:item.apple_collection_id,
                apple_collection_url:item.apple_collection_url,
                artwork_url:item.artwork_url,
                matched_at:matchedAt
            };
            appleArtworkPersistentLoaded.add(id);
            appleArtworkPersistentCache.set(id,row);
        });
    }catch(error){
        console.warn('Could not save Apple artwork cache:',error);
    }
}

function persistentMatchFromAppleAlbum(master,appleAlbum){
    if(!master||!appleAlbum||!appleAlbum.artworkUrl100||!appleAlbum.collectionViewUrl)return null;

    const fields=discogsMasterAppleFields(master);

    if(!fields.masterId||!fields.artist||!fields.albumTitle)return null;

    return {
        masterId:fields.masterId,
        artist:fields.artist,
        albumTitle:fields.albumTitle,
        year:fields.year,
        collectionId:appleAlbum.collectionId||null,
        collectionUrl:String(appleAlbum.collectionViewUrl||''),
        artworkUrl100:String(appleAlbum.artworkUrl100||'')
    };
}

function persistentMatchFromAppleData(entry,appleData){
    if(!entry||!entry.master||!appleData||!appleData.artworkUrl100||!appleData.collectionUrl)return null;

    return {
        masterId:String(entry.master.id||''),
        artist:entry.artist||'',
        albumTitle:entry.albumTitle||'',
        year:entry.year||'',
        collectionId:appleData.collectionId||null,
        collectionUrl:appleData.collectionUrl||'',
        artworkUrl100:appleData.artworkUrl100||''
    };
}

const searchLibraryStateCache={
    userId:'',
    loadedAt:0,
    value:null,
    promise:null
};

function emptySearchLibraryState(){
    return {
        existingMasterIds:new Set(),
        wishlistedMasterIds:new Set(),
        existingAlbumKeys:new Set(),
        wishlistedAlbumKeys:new Set()
    };
}

function invalidateSearchLibraryState(){
    searchLibraryStateCache.loadedAt=0;
    searchLibraryStateCache.value=null;
}

async function getSearchLibraryState(user){
    if(!user)return emptySearchLibraryState();

    const fresh=
        searchLibraryStateCache.userId===user.id&&
        searchLibraryStateCache.value&&
        Date.now()-searchLibraryStateCache.loadedAt<60000;

    if(fresh)return searchLibraryStateCache.value;

    if(
        searchLibraryStateCache.userId===user.id&&
        searchLibraryStateCache.promise
    ){
        return searchLibraryStateCache.promise;
    }

    searchLibraryStateCache.userId=user.id;

    searchLibraryStateCache.promise=Promise.all([
        supabaseClient
            .from('collections')
            .select('albums(discogs_master_id,title,artists(name))')
            .eq('user_id',user.id),
        supabaseClient
            .from('wishlists')
            .select('albums(discogs_master_id,title,artists(name))')
            .eq('user_id',user.id)
    ]).then(function(states){
        const collectionState=states[0];
        const wishlistState=states[1];

        if(collectionState.error)throw collectionState.error;
        if(wishlistState.error)throw wishlistState.error;

        const value={
            existingMasterIds:new Set(
                (collectionState.data||[])
                    .map(function(item){
                        return item.albums&&String(item.albums.discogs_master_id||'');
                    })
                    .filter(Boolean)
            ),
            wishlistedMasterIds:new Set(
                (wishlistState.data||[])
                    .map(function(item){
                        return item.albums&&String(item.albums.discogs_master_id||'');
                    })
                    .filter(Boolean)
            ),
            existingAlbumKeys:new Set(
                (collectionState.data||[])
                    .map(function(item){
                        var album=item.albums;
                        return album&&window.albumIdentityKey(
                            album.artists&&album.artists.name,
                            album.title
                        );
                    })
                    .filter(Boolean)
            ),
            wishlistedAlbumKeys:new Set(
                (wishlistState.data||[])
                    .map(function(item){
                        var album=item.albums;
                        return album&&window.albumIdentityKey(
                            album.artists&&album.artists.name,
                            album.title
                        );
                    })
                    .filter(Boolean)
            )
        };

        searchLibraryStateCache.value=value;
        searchLibraryStateCache.loadedAt=Date.now();
        return value;
    }).finally(function(){
        searchLibraryStateCache.promise=null;
    });

    return searchLibraryStateCache.promise;
}

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
            :'/avatar_placeholder.png')+
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
        setViewedUserFollowState(userId,profile&&profile.username?profile.username:'collector',isFollowingViewed);
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
    var albumRatingsMeta=await loadAlbumRatingData(albumIds,ownRatingUserId);

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

            return applyAlbumRatingMeta([
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

function setSearchResultStatus(button,status){
    var actions=button&&button.closest?button.closest('.mb-actions'):null;
    if(!actions)return;
    var addButton=actions.querySelector('.mb-add-button');
    var wishlistButton=actions.querySelector('.mb-wishlist-button');

    if(status==='collection'){
        addButton.textContent='✓ In collection';
        addButton.classList.add('mb-added');
        addButton.disabled=true;
        wishlistButton.textContent='In collection';
        wishlistButton.classList.add('mb-wishlisted');
        wishlistButton.disabled=true;
    }else if(status==='wishlist'){
        addButton.textContent='On wishlist';
        addButton.classList.add('mb-added');
        addButton.disabled=true;
        wishlistButton.textContent='✓ Wishlisted';
        wishlistButton.classList.add('mb-wishlisted');
        wishlistButton.disabled=true;
    }
}


async function getMusicBrainzCatalogRows(masterIds){
    if(!masterIds.length)return new Map();

    const ids=[...new Set(
        masterIds
            .map(function(id){return String(id||'').trim();})
            .filter(Boolean)
    )];

    const {data,error}=await supabaseClient
        .from('musicbrainz_catalog')
        .select('mbid,discogs_master_id,artist_name,album_title,first_release_year')
        .in('discogs_master_id',ids);

    if(error){
        console.error('Kunde inte läsa musicbrainz_catalog:',error);
        return new Map();
    }

    const result=new Map();

    (data||[]).forEach(function(row){
        result.set(String(row.discogs_master_id),row);
    });

    return result;
}

function imageExists(url){
    return new Promise(function(resolve){
        const image=new Image();
        let finished=false;

        const finish=function(result){
            if(finished)return;
            finished=true;
            clearTimeout(timeout);
            image.onload=null;
            image.onerror=null;
            resolve(result);
        };

        const timeout=setTimeout(function(){
            finish(false);
        },6000);

        image.onload=function(){
            finish(true);
        };

        image.onerror=function(){
            finish(false);
        };

        image.src=url;
    });
}

async function resolveAlbumCover(mbid,discogsFallback){
    const cleanMbid=String(mbid||'').trim();
    const fallback=String(discogsFallback||'').trim();

    if(!cleanMbid){
        return {
            url:fallback,
            source:fallback?'discogs':''
        };
    }

    if(coverArtArchiveCache.has(cleanMbid)){
        const cached=coverArtArchiveCache.get(cleanMbid);

        if(cached){
            return {
                url:cached,
                source:'coverartarchive'
            };
        }

        return {
            url:fallback,
            source:fallback?'discogs':''
        };
    }

    const coverArtUrl=
        'https://coverartarchive.org/release-group/'+
        encodeURIComponent(cleanMbid)+
        '/front-1200';

    const exists=await imageExists(coverArtUrl);

    if(exists){
        coverArtArchiveCache.set(cleanMbid,coverArtUrl);

        return {
            url:coverArtUrl,
            source:'coverartarchive'
        };
    }

    coverArtArchiveCache.set(cleanMbid,'');

    return {
        url:fallback,
        source:fallback?'discogs':''
    };
}


function setSearchResultCover(entry,url,source,previewUrl,appleCollectionUrl){
    if(!entry||!url)return;

    entry.coverState.url=url;
    entry.coverState.source=source||'';

    if(source==='apple'){
        entry.coverState.appleCollectionUrl=appleCollectionUrl||'';
    }

    if(entry.imageElement){
        entry.imageElement.style.display='';
        entry.imageElement.onerror=function(){
            this.style.display='none';
        };
        entry.imageElement.src=previewUrl||url;
    }
}

function startCaaCoverUpgrade(entry,mbid,searchNumber){
    const cleanMbid=String(mbid||'').trim();
    if(!cleanMbid||!entry)return;

    if(coverArtArchiveCache.has(cleanMbid)){
        const cached=coverArtArchiveCache.get(cleanMbid);

        if(
            cached&&
            searchNumber===musicBrainzSearchNumber&&
            entry.coverState.source!=='apple'
        ){
            setSearchResultCover(
                entry,
                cached,
                'coverartarchive',
                cached,
                ''
            );
        }

        return;
    }

    const caaUrl=
        'https://coverartarchive.org/release-group/'+
        encodeURIComponent(cleanMbid)+
        '/front-1200';

    const probe=new Image();

    probe.onload=function(){
        coverArtArchiveCache.set(cleanMbid,caaUrl);

        if(
            searchNumber!==musicBrainzSearchNumber||
            entry.coverState.source==='apple'
        )return;

        setSearchResultCover(
            entry,
            caaUrl,
            'coverartarchive',
            caaUrl,
            ''
        );
    };

    probe.onerror=function(){
        coverArtArchiveCache.set(cleanMbid,'');
    };

    probe.src=caaUrl;
}

async function enrichSearchResultsWithCaa(entries,searchNumber){
    try{
        const masterIds=entries
            .map(function(entry){return entry.master.id;})
            .filter(Boolean);

        const catalogByMaster=
            await getMusicBrainzCatalogRows(masterIds);

        if(searchNumber!==musicBrainzSearchNumber)return;

        entries.forEach(function(entry){
            const catalogRow=
                catalogByMaster.get(String(entry.master.id||''));

            if(!catalogRow||!catalogRow.mbid)return;

            startCaaCoverUpgrade(
                entry,
                catalogRow.mbid,
                searchNumber
            );
        });
    }catch(error){
        console.warn('CAA-bakgrundsuppdatering misslyckades:',error);
    }
}

async function enrichSearchResultsWithApple(query,entries,searchNumber,allMasters){
    try{
        const discogsMasters=
            Array.isArray(allMasters)&&allMasters.length
                ?allMasters
                :(entries||[]).map(function(entry){
                    return entry.master;
                }).filter(Boolean);

        const persistentByMaster=
            await getPersistentAppleArtworkCache(
                discogsMasters
            );

        if(searchNumber!==musicBrainzSearchNumber)return;

        entries.forEach(function(entry){
            const cachedRow=
                persistentByMaster.get(
                    String(entry.master&&entry.master.id||'')
                );

            if(!cachedRow)return;

            const cachedAlbum=
                cachedAppleAlbumFromRow(cachedRow);

            const cachedData=
                appleAlbumData(cachedAlbum);

            if(!cachedData.url)return;

            setSearchResultCover(
                entry,
                cachedData.url,
                'apple',
                cachedData.previewUrl,
                cachedData.collectionUrl
            );
        });

        const needsLiveSearch=
            discogsMasters.some(function(master){
                const row=
                    persistentByMaster.get(
                        String(master&&master.id||'')
                    );

                return !row||!appleArtworkCacheIsFresh(row);
            });

        let appleSearchResults=[];
        const appleQueryKey=normalizeAppleFullTitle(query);

        if(appleAlbumSearchCache.has(appleQueryKey)){
            appleSearchResults=appleAlbumSearchCache.get(appleQueryKey);
        }else if(
            needsLiveSearch&&
            Date.now()>=appleSearchBlockedUntil
        ){
            try{
                const appleResponse=await fetch(
                    'https://itunes.apple.com/search?term='+
                    encodeURIComponent(query)+
                    '&entity=album&limit=100&country=SE'
                );

                if(appleResponse.ok){
                    const appleData=await appleResponse.json();
                    appleSearchResults=appleData.results||[];
                    appleAlbumSearchCache.set(
                        appleQueryKey,
                        appleSearchResults
                    );
                }else{
                    if(
                        appleResponse.status===403||
                        appleResponse.status===429
                    ){
                        appleSearchBlockedUntil=
                            Date.now()+APPLE_RATE_LIMIT_COOLDOWN;
                    }

                    console.warn(
                        'Apple album search status:',
                        appleResponse.status
                    );
                }
            }catch(appleError){
                console.warn(
                    'Apple album search unavailable:',
                    appleError
                );
            }
        }

        if(searchNumber!==musicBrainzSearchNumber)return;

        const persistentMatches=[];

        if(appleSearchResults.length){
            discogsMasters.forEach(function(master){
                const fields=discogsMasterAppleFields(master);

                if(
                    !fields.masterId||
                    !fields.artist||
                    !fields.albumTitle
                )return;

                const appleAlbum=pickBestAppleAlbum(
                    appleSearchResults,
                    fields.artist,
                    fields.albumTitle,
                    fields.year
                );

                if(!appleAlbum)return;

                const persistentMatch=
                    persistentMatchFromAppleAlbum(
                        master,
                        appleAlbum
                    );

                if(persistentMatch){
                    persistentMatches.push(
                        persistentMatch
                    );
                }
            });

            entries.forEach(function(entry){
                const appleAlbum=pickBestAppleAlbum(
                    appleSearchResults,
                    entry.artist,
                    entry.albumTitle,
                    entry.year
                );

                if(!appleAlbum)return;

                const appleData=appleAlbumData(appleAlbum);

                if(appleData.url){
                    setSearchResultCover(
                        entry,
                        appleData.url,
                        'apple',
                        appleData.previewUrl,
                        appleData.collectionUrl
                    );
                }
            });
        }

        if(persistentMatches.length){
            savePersistentAppleArtworkMatches(
                persistentMatches
            );
        }

        const unresolved=entries.filter(function(entry){
            return entry.coverState.source!=='apple';
        });

        let nextIndex=0;

        async function appleWorker(){
            while(nextIndex<unresolved.length){
                const entry=unresolved[nextIndex++];

                if(searchNumber!==musicBrainzSearchNumber)return;

                const appleData=
                    await searchApplePreviewArtwork(
                        entry.artist,
                        entry.albumTitle,
                        entry.year
                    );

                if(searchNumber!==musicBrainzSearchNumber)return;

                if(appleData&&appleData.url){
                    setSearchResultCover(
                        entry,
                        appleData.url,
                        'apple',
                        appleData.previewUrl,
                        appleData.collectionUrl
                    );

                    const persistentMatch=
                        persistentMatchFromAppleData(
                            entry,
                            appleData
                        );

                    if(persistentMatch){
                        savePersistentAppleArtworkMatches([
                            persistentMatch
                        ]);
                    }
                }
            }
        }

        await Promise.all([
            appleWorker(),
            appleWorker()
        ]);
    }catch(error){
        console.warn('Apple-bakgrundsuppdatering misslyckades:',error);
    }
}

async function searchDiscogs(query){
    const searchNumber=++musicBrainzSearchNumber;

    albumSearchResults.innerHTML='<p>Searching...</p>';

    try{
        const {data:{session}}=
            await supabaseClient.auth.getSession();

        const user=session&&session.user;
        if(!user)throw new Error('Du måste vara inloggad.');

        const libraryStatePromise=
            getSearchLibraryState(user);

        const discogsPromise=
            supabaseClient.functions.invoke(
                'discogs-search',
                {body:{query:query}}
            );

        const searchResponses=await Promise.all([
            discogsPromise,
            libraryStatePromise
        ]);

        const discogsResponse=searchResponses[0];
        const libraryState=searchResponses[1];

        if(discogsResponse.error){
            console.error(
                'Discogs error:',
                discogsResponse.error
            );
            throw discogsResponse.error;
        }

        if(searchNumber!==musicBrainzSearchNumber)return;

        const data=discogsResponse.data;
        const seenResults={};

        const results=
            (data&&data.results?data.results:[])
                .filter(function(master){
                    if(
                        /\banniversary\b/i.test(
                            String(master&&master.title||'')
                        )
                    )return false;

                    var title=String(master&&master.title||'');
                    var parts=title.split(' - ');
                    var artist=
                        parts.length>1
                            ?parts[0].replace(/\s*\(\d+\)$/,'')
                            :'';
                    var albumTitle=
                        parts.length>1
                            ?parts.slice(1).join(' - ')
                            :title;

                    var key=
                        window.albumIdentityKey(
                            artist,
                            albumTitle
                        )+
                        '|'+
                        String(master&&master.year||'');

                    if(seenResults[key])return false;

                    seenResults[key]=true;
                    return true;
                });

        if(!results.length){
            albumSearchResults.innerHTML=
                '<p>Inga album hittades.</p>';
            return;
        }

        const searchResults=results.slice(0,10);

        // Render Discogs immediately. Apple and CAA upgrade the covers later.
        albumSearchResults.innerHTML='';

        const entries=searchResults.map(function(master){
            const title=master.title||'Okänd titel';
            const parts=title.split(' - ');

            const artist=
                parts.length>1
                    ?parts[0].replace(/\s*\(\d+\)$/,'')
                    :'Okänd artist';

            const albumTitle=
                parts.length>1
                    ?parts.slice(1).join(' - ')
                    :title;

            const year=master.year||'';
            const resultAlbumKey=
                window.albumIdentityKey(
                    artist,
                    albumTitle
                );

            const isAdded=
                libraryState.existingMasterIds.has(
                    String(master.id)
                )||
                libraryState.existingAlbumKeys.has(
                    resultAlbumKey
                );

            const isWishlisted=
                libraryState.wishlistedMasterIds.has(
                    String(master.id)
                )||
                libraryState.wishlistedAlbumKeys.has(
                    resultAlbumKey
                );

            const discogsFullImage=
                master.cover_image||
                master.thumb||
                '';

            const discogsPreviewImage=
                master.thumb||
                master.cover_image||
                '';

            const coverState={
                url:discogsFullImage,
                source:discogsFullImage?'discogs':'',
                appleCollectionUrl:''
            };

            const div=document.createElement('div');
            div.className='mb-result';

            div.innerHTML=
                '<img class="mb-cover" '+
                    (discogsPreviewImage
                        ?'src="'+escapeHTML(discogsPreviewImage)+'"'
                        :'style="display:none"')+
                    ' alt="">'+

                '<div class="mb-info">'+
                    '<div class="mb-title">'+
                        escapeHTML(albumTitle)+
                    '</div>'+
                    '<div class="mb-artist">'+
                        escapeHTML(artist)+
                    '</div>'+
                    '<div class="mb-year">'+
                        escapeHTML(String(year))+
                    '</div>'+
                '</div>'+

                '<div class="mb-actions">'+
                  (isAdded
                      ?'<button class="mb-add-button mb-added" disabled>✓ In collection</button>'
                      :(isWishlisted
                          ?'<button class="mb-add-button mb-added" disabled>On wishlist</button>'
                          :'<button class="mb-add-button">Add Record</button>'))+
                  (isAdded
                      ?'<button class="mb-wishlist-button mb-wishlisted" disabled>In collection</button>'
                      :(isWishlisted
                          ?'<button class="mb-wishlist-button mb-wishlisted" disabled>✓ Wishlisted</button>'
                          :'<button class="mb-wishlist-button"><span class="wishlist-icon" aria-hidden="true"></span>Wishlist</button>'))+
                '</div>';

            const imageElement=
                div.querySelector('.mb-cover');

            imageElement.onerror=function(){
                this.style.display='none';
            };

            const entry={
                master:master,
                artist:artist,
                albumTitle:albumTitle,
                year:year,
                coverState:coverState,
                imageElement:imageElement,
                element:div
            };

            const addButton=
                div.querySelector('.mb-add-button');

            const wishlistButton=
                div.querySelector('.mb-wishlist-button');

            addButton.addEventListener(
                'click',
                function(event){
                    event.stopPropagation();

                    addAlbumFromDiscogs(
                        master,
                        artist,
                        albumTitle,
                        year,
                        coverState,
                        addButton
                    );
                }
            );

            wishlistButton.addEventListener(
                'click',
                function(event){
                    event.stopPropagation();

                    addAlbumToWishlistFromDiscogs(
                        master,
                        artist,
                        albumTitle,
                        year,
                        coverState,
                        wishlistButton
                    );
                }
            );

            albumSearchResults.appendChild(div);
            return entry;
        });

        // These do not block the visible results.
        enrichSearchResultsWithCaa(
            entries,
            searchNumber
        );

        enrichSearchResultsWithApple(
            query,
            entries,
            searchNumber,
            results
        );

    }catch(error){
        console.error('Discogs-fel:',error);

        if(searchNumber===musicBrainzSearchNumber){
            albumSearchResults.innerHTML=
                '<p>Kunde inte kontakta Discogs.</p>';
        }
    }
}
function normalizeAppleSearchText(value){
    var text=String(value||'').toLowerCase();

    if(text.normalize){
        text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    }

    return text
        .replace(/\([^)]*\)/g,' ')
        .replace(/[^a-z0-9]+/g,' ')
        .trim()
        .replace(/\s+/g,' ');
}

async function searchApplePreviewArtwork(artist,albumTitle,originalYear){
    var cacheKey=
        'resolved|'+
        normalizeAppleFullTitle(artist)+
        '|'+
        normalizeAppleFullTitle(albumTitle);

    if(appleAlbumSearchCache.has(cacheKey)){
        var cached=appleAlbumSearchCache.get(cacheKey);

        if(
            cached&&
            typeof cached==='object'&&
            !Array.isArray(cached)
        ){
            return cached;
        }
    }

    var empty={
        url:'',
        previewUrl:'',
        collectionUrl:''
    };

    if(Date.now()<appleSearchBlockedUntil)return empty;

    try{
        var response=await fetch(
            'https://itunes.apple.com/search?term='+
            encodeURIComponent(artist+' '+albumTitle)+
            '&entity=album&limit=50&country=SE'
        );

        if(!response.ok){
            if(response.status===403||response.status===429){
                appleSearchBlockedUntil=
                    Date.now()+APPLE_RATE_LIMIT_COOLDOWN;
            }

            return empty;
        }

        var data=await response.json();

        var appleAlbum=pickBestAppleAlbum(
            data.results,
            artist,
            albumTitle,
            originalYear
        );

        var result=appleAlbumData(appleAlbum);

        appleAlbumSearchCache.set(
            cacheKey,
            result
        );

        return result;
    }catch(error){
        console.warn(
            'Apple resolved album search unavailable:',
            error
        );
        return empty;
    }
}
function appleArtistMatches(candidate,artist){
    var candidateText=normalizeAppleSearchText(candidate);
    var artistText=normalizeAppleSearchText(artist);

    if(!candidateText||!artistText)return false;

    // Ignorera ett inledande "The" vid artistmatchning.
    var candidateWithoutThe=candidateText.replace(/^the\s+/,'');
    var artistWithoutThe=artistText.replace(/^the\s+/,'');

    return candidateText===artistText||
        candidateWithoutThe===artistWithoutThe||
        candidateText.indexOf(artistText+' ')===0||
        artistText.indexOf(candidateText+' ')===0||
        candidateWithoutThe.indexOf(artistWithoutThe+' ')===0||
        artistWithoutThe.indexOf(candidateWithoutThe+' ')===0;
}

function appleAlbumMatches(candidate,albumTitle,artist){
    var candidateText=normalizeAppleSearchText(candidate);
    var albumText=normalizeAppleSearchText(albumTitle);
    var artistText=normalizeAppleSearchText(artist);

    if(!candidateText||!albumText)return false;

    // Vanlig exakt titel.
    if(candidateText===albumText)return true;

    // Apple kan ibland skriva:
    // "ABBA: The Album"
    // när vår titel bara är:
    // "The Album"
    //
    // Tillåt detta ENDAST när prefixet är samma artist.
    if(artistText){
        var artistWithoutThe=artistText.replace(/^the\s+/,'');
        var candidateWithoutThe=candidateText.replace(/^the\s+/,'');

        var possiblePrefixes=[
            artistText,
            artistWithoutThe
        ];

        for(var i=0;i<possiblePrefixes.length;i+=1){
            var prefix=possiblePrefixes[i];

            if(!prefix)continue;

            if(candidateText.indexOf(prefix+' ')===0){
                var remaining=candidateText
                    .slice(prefix.length)
                    .trim();

                if(remaining===albumText){
                    return true;
                }
            }

            if(candidateWithoutThe.indexOf(prefix+' ')===0){
                var remainingWithoutThe=candidateWithoutThe
                    .slice(prefix.length)
                    .trim();

                if(remainingWithoutThe===albumText){
                    return true;
                }
            }
        }
    }

    // Behåll den gamla säkra remaster-regeln.
    if(candidateText.indexOf(albumText+' ')!==0)return false;

    var suffix=candidateText
        .slice(albumText.length)
        .trim();

    return /^(?:\d{4}\s+)?remaster(?:ed)?(?:\s+edition)?$/.test(suffix);
}
function appleArtworkUrl(album){
    return album&&album.artworkUrl100
        ?album.artworkUrl100.replace('100x100bb','1200x1200bb')
        :'';
}

function applePreviewArtworkUrl(album){
    return album&&album.artworkUrl100
        ?album.artworkUrl100.replace('100x100bb','300x300bb')
        :'';
}

function appleAlbumData(album){
    return {
        url:appleArtworkUrl(album),
        previewUrl:applePreviewArtworkUrl(album),
        collectionUrl:album&&album.collectionViewUrl
            ?String(album.collectionViewUrl)
            :'',
        collectionId:album&&album.collectionId
            ?String(album.collectionId)
            :'',
        artworkUrl100:album&&album.artworkUrl100
            ?String(album.artworkUrl100)
            :'',
        artistName:album&&album.artistName
            ?String(album.artistName)
            :'',
        collectionName:album&&album.collectionName
            ?String(album.collectionName)
            :'',
        releaseDate:album&&album.releaseDate
            ?String(album.releaseDate)
            :''
    };
}

function normalizeAppleFullTitle(value){
    var text=String(value||'').toLowerCase();

    if(text.normalize){
        text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    }

    return text
        .replace(/[^a-z0-9]+/g,' ')
        .trim()
        .replace(/\s+/g,' ');
}

function appleEditionPenalty(candidate,albumTitle){
    var candidateText=normalizeAppleFullTitle(candidate);
    var albumText=normalizeAppleFullTitle(albumTitle);
    var editionTerms=[
        'super deluxe','deluxe','remaster','remastered','anniversary',
        'expanded','special edition','collector edition','bonus track',
        'reissue','live'
    ];
    var penalty=0;

    editionTerms.forEach(function(term){
        if(candidateText.indexOf(term)!==-1&&albumText.indexOf(term)===-1){
            penalty+=term==='super deluxe'?40:20;
        }
    });

    return penalty;
}

function appleReleaseIsExcluded(candidate){
    var text=normalizeAppleFullTitle(candidate);
    var excludedPatterns=[
        /\bsuper deluxe\b/,
        /\bdeluxe\b/,
        /\bspecial edition\b/,
        /\bcollectors? edition\b/,
        /\bbonus tracks?\b/,
        /\breissue\b/,
        /\banniversary\b/,
        /\bremix(?:ed)?\b/,
        /\b\d{4} mix\b/,
        /\bsingle\b/,
        /\bep\b/,
        /\blive\b/
    ];

    return excludedPatterns.some(function(pattern){
        return pattern.test(text);
    });
}

function pickBestAppleAlbum(results,artist,albumTitle,originalYear){
    var wantedTitle=normalizeAppleFullTitle(albumTitle);
    var wantedYear=parseInt(originalYear,10)||0;

    return (results||[])
        .filter(function(item){
            return appleArtistMatches(item.artistName,artist)&&
                appleAlbumMatches(item.collectionName,albumTitle,artist)&&
                !appleReleaseIsExcluded(item.collectionName)&&
                item.artworkUrl100;
        })
        .map(function(item,index){
            var candidateTitle=normalizeAppleFullTitle(item.collectionName);
            var score=candidateTitle===wantedTitle?100:70;
            var releaseYear=parseInt(String(item.releaseDate||'').slice(0,4),10)||0;

            score-=appleEditionPenalty(item.collectionName,albumTitle);

            if(wantedYear&&releaseYear){
                score-=Math.min(Math.abs(releaseYear-wantedYear),20);
            }

            return {item:item,score:score,index:index};
        })
        .sort(function(a,b){
            return b.score-a.score||a.index-b.index;
        })
        .map(function(result){
            return result.item;
        })[0];
}

async function searchAppleAlbumArtwork(artist,albumTitle,originalYear){
    var empty={
        url:'',
        previewUrl:'',
        collectionUrl:''
    };

    var cacheKey=
        'resolved|'+
        normalizeAppleFullTitle(artist)+
        '|'+
        normalizeAppleFullTitle(albumTitle);

    if(appleAlbumSearchCache.has(cacheKey)){
        var cached=appleAlbumSearchCache.get(cacheKey);

        if(
            cached&&
            typeof cached==='object'&&
            !Array.isArray(cached)&&
            cached.url
        ){
            return cached;
        }
    }

    function remember(album){
        var result=appleAlbumData(album);

        if(result.url){
            appleAlbumSearchCache.set(
                cacheKey,
                result
            );
        }

        return result;
    }

    try{
        var directTerm=
            encodeURIComponent(
                artist+' '+albumTitle
            );

        var directResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            directTerm+
            '&entity=album&limit=50'
        );

        if(!directResponse.ok){
            throw new Error(
                'Apple album search failed'
            );
        }

        var directData=await directResponse.json();

        var directResult=pickBestAppleAlbum(
            directData.results,
            artist,
            albumTitle,
            originalYear
        );

        if(directResult){
            return remember(directResult);
        }

        var titleResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            encodeURIComponent(albumTitle)+
            '&entity=album&limit=100'
        );

        if(titleResponse.ok){
            var titleData=await titleResponse.json();

            var titleResult=pickBestAppleAlbum(
                titleData.results,
                artist,
                albumTitle,
                originalYear
            );

            if(titleResult){
                return remember(titleResult);
            }
        }

        var songResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            directTerm+
            '&entity=song&limit=100&country=SE'
        );

        if(songResponse.ok){
            var songData=await songResponse.json();

            var songResult=pickBestAppleAlbum(
                songData.results,
                artist,
                albumTitle,
                originalYear
            );

            if(songResult){
                return remember(songResult);
            }
        }

        var artistQuery=
            encodeURIComponent(artist);

        var artistResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            artistQuery+
            '&entity=musicArtist&limit=10'
        );

        if(!artistResponse.ok){
            throw new Error(
                'Apple artist search failed'
            );
        }

        var artistData=await artistResponse.json();

        var artistResult=
            (artistData.results||[])
                .find(function(item){
                    return appleArtistMatches(
                        item.artistName,
                        artist
                    )&&item.artistId;
                });

        if(!artistResult)return empty;

        var lookupResponse=await fetch(
            'https://itunes.apple.com/lookup?id='+
            artistResult.artistId+
            '&entity=album&limit=200'
        );

        if(!lookupResponse.ok){
            throw new Error(
                'Apple album lookup failed'
            );
        }

        var lookupData=await lookupResponse.json();

        var albumResult=pickBestAppleAlbum(
            lookupData.results,
            artist,
            albumTitle,
            originalYear
        );

        return albumResult
            ?remember(albumResult)
            :empty;

    }catch(error){
        console.error(
            'Apple artwork error:',
            error
        );
        return empty;
    }
}
function discogsTrackRows(albumId,tracklist,includeDuration){
    const rawTracks=[];

    (Array.isArray(tracklist)?tracklist:[]).forEach(function(track){
        if(track&&track.type_==='track')rawTracks.push(track);

        if(track&&Array.isArray(track.sub_tracks)){
            track.sub_tracks.forEach(function(subTrack){
                if(subTrack&&(
                    subTrack.type_==='track'||
                    (!subTrack.type_&&subTrack.title)
                ))rawTracks.push(subTrack);
            });
        }
    });

    const hasDiscSides=rawTracks.some(function(track){
        return /^[A-H]\s*\d/.test(String(track.position||'').toUpperCase());
    });

    return rawTracks.map(function(track,index){
        const position=String(track.position||'').toUpperCase();
        let discSide='';
        let trackNumber=null;

        if(hasDiscSides){
            discSide=position.charAt(0);
            trackNumber=parseInt(position.substring(1),10);
        }else{
            const middle=Math.ceil(rawTracks.length/2);
            discSide=index<middle?'A':'B';
            trackNumber=index<middle?index+1:index-middle+1;
        }

        var row={
            album_id:albumId,
            disc_side:discSide,
            track_number:Number.isNaN(trackNumber)?null:trackNumber,
            title:track.title||'Okänd låt'
        };

        if(includeDuration)row.duration=String(track.duration||'').trim();
        return row;
    });
}

async function saveAlbumFromDiscogs(master,artist,albumTitle,year,coverState,button,destination){
    var isWishlistDestination=destination==='wishlist';
    if(button.classList.contains(isWishlistDestination?'mb-wishlisted':'mb-added'))return;

    button.textContent='Sparar...';
    button.disabled=true;

    try{
        const masterId=master.id;

        if(!masterId){
            throw new Error('Master Release saknar ID');
        }

        const {data,error}=await supabaseClient.functions.invoke(
            'discogs-search',
            {
                body:{
                    action:'master',
                    masterId:masterId
                }
            }
        );

        if(error){
            console.error('Discogs master error:',error);
            throw error;
        }

        const discogsTitle=data.title||albumTitle;
        const discogsYear=parseInt(data.year||year,10)||null;

        const discogsGenre=window.discogsStyleLabel(data);

        const discogsArtist=
            data.artists &&
            data.artists.length &&
            data.artists[0].name
                ?data.artists[0].name.replace(/\s*\(\d+\)$/,'')
                :artist;

        const tracklist=
            data &&
            Array.isArray(data.tracklist)
                ?data.tracklist
                :[];

        let finalTracklist=tracklist;
        
        const hasDiscSides=tracklist.some(function(track){
            const position=String(track.position||'').toUpperCase();
            return /^[A-H]\d/.test(position);
        });
        
        if(!hasDiscSides){
            const {
                data:vinylData,
                error:vinylError
            }=await supabaseClient.functions.invoke(
                'discogs-search',
                {
                    body:{
                        action:'vinylRelease',
                        masterId:masterId
                    }
                }
            );
        
            if(vinylError){
                console.error(
                    'Kunde inte hämta vinyl-release:',
                    vinylError
                );
            }else if(
                vinylData &&
                Array.isArray(vinylData.tracklist) &&
                vinylData.tracklist.length
            ){
                finalTracklist=vinylData.tracklist;
        
            }
        }

        // Read the LIVE search-result state here. Apple/CAA may have upgraded
        // the cover while the user was looking at the results.
        const liveCoverState=coverState||{};
        let previewCoverUrl=liveCoverState.url||'';
        let previewCoverSource=liveCoverState.source||'';
        let appleCollectionUrl=
            liveCoverState.appleCollectionUrl||'';

        // Preserve the exact cover source selected in the search result.
        // Priority is Apple -> Cover Art Archive -> Discogs.
        let coverUrl=previewCoverUrl||'';

        // Discogs search results may use a small thumbnail. Upgrade only when
        // Discogs is still the selected source.
        if(
            previewCoverSource==='discogs'&&
            data.images&&
            data.images.length&&
            data.images[0].uri
        ){
            coverUrl=data.images[0].uri;
        }

        // If the background Apple lookup has not finished yet, do the safe
        // Apple match now while saving this ONE album. This does not slow down
        // the search-result list.
        if(!appleCollectionUrl){
            const appleDetails=
                await searchAppleAlbumArtwork(
                    discogsArtist,
                    discogsTitle,
                    discogsYear
                );

            if(appleDetails&&appleDetails.url){
                coverUrl=appleDetails.url;
                previewCoverSource='apple';
            }

            if(
                appleDetails&&
                appleDetails.collectionUrl
            ){
                appleCollectionUrl=
                    appleDetails.collectionUrl;
            }
        }

        if(!coverUrl){
            const catalogByMaster=
                await getMusicBrainzCatalogRows([masterId]);

            const catalogRow=
                catalogByMaster.get(String(masterId));

            const mbid=
                catalogRow
                    ?catalogRow.mbid
                    :'';

            const discogsFallback=
                data.images&&
                data.images.length&&
                data.images[0].uri
                    ?data.images[0].uri
                    :'';

            const resolvedCover=
                await resolveAlbumCover(
                    mbid,
                    discogsFallback
                );

            coverUrl=resolvedCover.url||'';
        }

        let albumId=null;
        const {data:existingAlbums,error:existingAlbumError}=await supabaseClient
            .from('albums')
            .select('id')
            .eq('discogs_master_id',String(masterId))
            .limit(1);

        if(existingAlbumError)throw existingAlbumError;
        if(existingAlbums&&existingAlbums.length){
            albumId=existingAlbums[0].id;

            // Album rows are shared. Refresh metadata we now know safely.
            const albumUpdates={};

            if(discogsGenre){
                albumUpdates.genre=discogsGenre;
            }

            if(appleCollectionUrl){
                albumUpdates.apple_collection_url=
                    appleCollectionUrl;
            }

            if(
                previewCoverSource==='apple'&&
                coverUrl
            ){
                albumUpdates.cover_url=coverUrl;
            }

            if(Object.keys(albumUpdates).length){
                const {error:albumUpdateError}=
                    await supabaseClient
                        .from('albums')
                        .update(albumUpdates)
                        .eq('id',albumId);

                if(albumUpdateError){
                    console.warn(
                        'Could not refresh shared album metadata:',
                        albumUpdateError
                    );
                }
            }

        }

        if(!albumId){
        let artistId=null;

        const {
            data:existingArtists,
            error:artistSearchError
        }=await supabaseClient
            .from('artists')
            .select('id,name')
            .eq('name',discogsArtist)
            .limit(1);

        if(artistSearchError){
            throw artistSearchError;
        }

        if(existingArtists && existingArtists.length){
            artistId=existingArtists[0].id;
        }else{
            const {
                data:newArtist,
                error:newArtistError
            }=await supabaseClient
                .from('artists')
                .insert({
                    name:discogsArtist
                })
                .select('id')
                .single();

            if(newArtistError){
                throw newArtistError;
            }

            artistId=newArtist.id;
        }

        const {
            data:newAlbum,
            error:albumError
        }=await supabaseClient
            .from('albums')
            .insert({
                artist_id:artistId,
                title:discogsTitle,
                release_year:discogsYear,
                genre:discogsGenre,
                cover_url:coverUrl,
                discogs_master_id:String(masterId),
                apple_collection_url:appleCollectionUrl||null
            })
            .select('id')
            .single();

        if(albumError){
            throw albumError;
        }

        albumId=newAlbum.id;

        if(finalTracklist.length){
            const tracks=discogsTrackRows(albumId,finalTracklist);

            if(tracks.length){
                const {
                    error:tracksError
                }=await supabaseClient
                    .from('tracks')
                    .insert(tracks);

                if(tracksError){
                    throw tracksError;
                }
            }
        }
        }

        // Album records are shared and remain in the database when a user
        // removes an album from their collection. Complete an older album
        // record with any tracks that were previously omitted, including
        // Discogs sub-tracks, instead of assuming its tracklist is complete.
        if(albumId&&finalTracklist.length&&existingAlbums&&existingAlbums.length){
            const incomingTracks=discogsTrackRows(albumId,finalTracklist);
            const {data:storedTracks,error:storedTracksError}=await supabaseClient
                .from('tracks')
                .select('disc_side,track_number,title')
                .eq('album_id',albumId);

            if(storedTracksError)throw storedTracksError;

            const storedTrackCounts=new Map();
            (storedTracks||[]).forEach(function(track){
                const key=[
                    String(track.disc_side||''),
                    String(track.track_number==null?'':track.track_number),
                    String(track.title||'').trim().toLocaleLowerCase()
                ].join('|');
                storedTrackCounts.set(key,(storedTrackCounts.get(key)||0)+1);
            });

            const missingTracks=incomingTracks.filter(function(track){
                const key=[
                    String(track.disc_side||''),
                    String(track.track_number==null?'':track.track_number),
                    String(track.title||'').trim().toLocaleLowerCase()
                ].join('|');
                const count=storedTrackCounts.get(key)||0;
                if(count){
                    storedTrackCounts.set(key,count-1);
                    return false;
                }
                return true;
            });

            if(missingTracks.length){
                const {error:missingTracksError}=await supabaseClient
                    .from('tracks')
                    .insert(missingTracks);
                if(missingTracksError)throw missingTracksError;
            }
        }

        const {
            data:{
                user
            }
        }=await supabaseClient.auth.getUser();

        if(!user){
            throw new Error(
                'Du måste vara inloggad för att lägga till album.'
            );
        }

        if(isWishlistDestination){
            const {data:collectionRows,error:collectionMatchError}=await supabaseClient
                .from('collections')
                .select('id')
                .eq('user_id',user.id)
                .eq('album_id',albumId)
                .limit(1);

            if(collectionMatchError)throw collectionMatchError;

            const collectionMatch=!!(collectionRows&&collectionRows.length);

            if(collectionMatch){
                setSearchResultStatus(button,'collection');
                return;
            }

            const {data:lastWishlist,error:lastWishlistError}=await supabaseClient
                .from('wishlists')
                .select('sort_order')
                .eq('user_id',user.id)
                .order('sort_order',{ascending:false,nullsFirst:false})
                .limit(1);

            if(lastWishlistError)throw lastWishlistError;

            const nextWishlistSortOrder=lastWishlist&&lastWishlist.length&&lastWishlist[0].sort_order
                ?lastWishlist[0].sort_order+1
                :1;

            const {error:wishlistError}=await supabaseClient
                .from('wishlists')
                .insert({
                    user_id:user.id,
                    album_id:albumId,
                    cover_url:coverUrl,
                    discogs_style:discogsGenre||null,
                    sort_order:nextWishlistSortOrder
                });

            if(wishlistError&&wishlistError.code!=='23505')throw wishlistError;

            invalidateSearchLibraryState();
            setSearchResultStatus(button,'wishlist');
            if(window.libraryView==='wishlist')await window.loadCollection();
            return;
        }

        const {data:lastCollection,error:lastCollectionError}=await supabaseClient
            .from('collections')
            .select('sort_order')
            .eq('user_id',user.id)
            .order('sort_order',{ascending:false})
            .limit(1);
        
        if(lastCollectionError){
            throw lastCollectionError;
        }
        
        const nextSortOrder=
            lastCollection&&lastCollection.length
                ?lastCollection[0].sort_order+1
                :1;
        
        const {
            error:collectionError
        }=await supabaseClient
            .from('collections')
            .insert({
                user_id:user.id,
                album_id:albumId,
                cover_url:coverUrl,
                discogs_style:discogsGenre||null,
                sort_order:nextSortOrder
            });
        
        if(collectionError){
            throw collectionError;
        }

        invalidateSearchLibraryState();
        setSearchResultStatus(button,'collection');
        
        await window.loadCollection();

    }catch(error){
        console.error(
            'Kunde inte spara Discogs-album:',
            error
        );

        button.innerHTML=isWishlistDestination
            ?'<span class="wishlist-icon" aria-hidden="true"></span>Wishlist'
            :'Add Record';
        button.disabled=false;

        alert(
            'Kunde inte spara albumet.\n\n'+
            (error.message||error)
        );
    }
}

function addAlbumFromDiscogs(master,artist,albumTitle,year,coverState,button){
    return saveAlbumFromDiscogs(
        master,
        artist,
        albumTitle,
        year,
        coverState,
        button,
        'collection'
    );
}

function addAlbumToWishlistFromDiscogs(master,artist,albumTitle,year,coverState,button){
    return saveAlbumFromDiscogs(
        master,
        artist,
        albumTitle,
        year,
        coverState,
        button,
        'wishlist'
    );
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
    closeNotificationPanel();
    var routeUser=await currentSessionUser();
    if(!routeUser&&(window.location.pathname!=='/'||window.location.search||window.location.hash)){
        history.replaceState({},'','/');
        window.libraryView='collection';
    }
    if(!routeUser){
        hideFollowingPage();
        viewedUserId=null;
        window.loginRequiredForViewedCollection=false;
        window.profileNotFound=false;
        await window.loadCollection();
        return;
    }
    if(/^\/following\/?$/.test(window.location.pathname)){
        await renderFollowingPage();
        return;
    }
    hideFollowingPage();
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
