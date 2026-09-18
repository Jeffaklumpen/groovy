(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyCommunityController=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function create(options){
  options=options||{};
  var api=options.api;
  var view=options.view;
  var socialController=options.socialController;
  var win=options.window||((typeof window!=='undefined')?window:null);
  var elements=options.elements||{};
  var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
  var onOpenRoute=typeof options.onOpenRoute==='function'?options.onOpenRoute:function(){};
  var onNavigateProfile=typeof options.onNavigateProfile==='function'?options.onNavigateProfile:function(){};
  var onNavigateShelf=typeof options.onNavigateShelf==='function'?options.onNavigateShelf:function(){};
  var onRequireAuth=typeof options.onRequireAuth==='function'?options.onRequireAuth:function(){};
  var onBeforeOpen=typeof options.onBeforeOpen==='function'?options.onBeforeOpen:function(){};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};
  var requestVersion=0;
  var active=false;

  if(!api||typeof api.rpc!=='function')throw new Error('Community controller requires Supabase');
  if(!view)throw new Error('Community controller requires a view');
  if(!socialController)throw new Error('Community controller requires social controller');

  function log(level,message,error){onLog(level,message,error);}

  function syncUser(user){
    if(elements.tabButton)elements.tabButton.hidden=!user;
  }

  function setTabState(open){
    if(elements.tabs&&open)elements.tabs.style.display='flex';
    if(elements.communityTab){
      elements.communityTab.classList.toggle('active',!!open);
      elements.communityTab.setAttribute('aria-current',open?'page':'false');
    }
    [elements.collectionTab,elements.wishlistTab].forEach(function(button){
      if(!button)return;
      if(open)button.classList.remove('active');
      if(open)button.setAttribute('aria-current','false');
    });
  }

  function hidePage(){
    requestVersion++;
    active=false;
    setTabState(false);
    view.hide();
  }

  async function renderPage(){
    var user=await getCurrentUser();
    if(!user){
      hidePage();
      onRequireAuth();
      return false;
    }

    var version=++requestVersion;
    active=true;
    onBeforeOpen();
    setTabState(true);
    view.show();
    view.loading();

    var result=await api.rpc('get_community_overview',{p_limit:5,p_activity_limit:8});
    if(version!==requestVersion||!active)return false;

    if(result.error){
      log('error','Could not load community overview:',result.error);
      view.error(result.error.message||'Try again in a moment.');
      return false;
    }

    view.render(result.data||{});
    return true;
  }

  async function toggleFollow(button){
    if(!button||button.disabled)return;
    var userId=button.getAttribute('data-user-id');
    var following=button.getAttribute('data-following')==='true';
    if(!userId)return;

    button.disabled=true;
    button.textContent=following?'Unfollowing...':'Following...';

    try{
      if(following)await socialController.unfollowUser(userId);
      else await socialController.followUser(userId);
      view.setFollowState(userId,!following);
      view.adjustConnections(following?-1:1);
    }catch(error){
      log('error','Could not change community follow state:',error);
      view.setFollowState(userId,following);
    }
  }

  async function handlePageClick(event){
    var service=event.target&&event.target.closest?event.target.closest('.community-cover-service'):null;
    if(service)return;

    var follow=event.target&&event.target.closest?event.target.closest('[data-community-follow]'):null;
    if(follow){
      event.preventDefault();
      event.stopPropagation();
      await toggleFollow(follow);
      return;
    }

    var shelf=event.target&&event.target.closest?event.target.closest('[data-community-shelf]'):null;
    if(shelf){
      event.preventDefault();
      onNavigateShelf(shelf.getAttribute('data-community-shelf'));
      return;
    }

    var profile=event.target&&event.target.closest?event.target.closest('[data-community-profile]'):null;
    if(profile){
      event.preventDefault();
      onNavigateProfile(profile.getAttribute('data-community-profile'));
    }
  }

  if(elements.tabButton){
    elements.tabButton.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      onOpenRoute();
    });
  }

  if(elements.page)elements.page.addEventListener('click',handlePageClick);

  if(win&&typeof win.addEventListener==='function'){
    win.addEventListener('groovy-follow-changed',function(event){
      if(!active)return;
      var detail=event&&event.detail||{};
      if(detail.userId)view.setFollowState(detail.userId,!!detail.following);
    });
  }

  return Object.freeze({
    syncUser:syncUser,
    renderPage:renderPage,
    hidePage:hidePage,
    isActive:function(){return active;}
  });
}

return Object.freeze({create:create});
});
