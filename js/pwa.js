(function(){
  var installBanner=document.getElementById('installAppBanner');
  var installButton=document.getElementById('installAppButton');
  var installMenuButton=document.getElementById('installAppMenuButton');
  var installShortcutButton=document.getElementById('installAppShortcutButton');
  var profileMenuElement=document.getElementById('profileMenu');
  var dismissButton=document.getElementById('dismissInstallApp');
  var helpModal=document.getElementById('installHelpModal');
  var helpSteps=document.getElementById('installHelpSteps');
  var closeHelpButton=document.getElementById('closeInstallHelp');
  var helpDoneButton=document.getElementById('installHelpDone');
  var deferredInstallPrompt=null;
  var userAgent=navigator.userAgent||'';
  var isIos=/iPad|iPhone|iPod/.test(userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var isAndroid=/Android/i.test(userAgent);
  var isTwa=document.referrer.indexOf('android-app://')===0;
  var isStandalone=window.matchMedia('(display-mode: standalone)').matches||
    window.navigator.standalone===true||
    isTwa;
  var androidApkUrl='/GroovyShelves.apk';

  function setInstallCopy(){
    installMenuButton.textContent='Get the App';
    installShortcutButton.setAttribute('aria-label','Get the GroovyShelves app');
    installShortcutButton.setAttribute('title','Get the GroovyShelves app');

    if(!installBanner)return;
    var title=installBanner.querySelector('strong');
    var subtitle=installBanner.querySelector('small');

    if(isAndroid){
      installBanner.setAttribute('aria-label','Install GroovyShelves for Android');
      if(title)title.textContent='Install GroovyShelves';
      if(subtitle)subtitle.textContent='Download the Android app';
      return;
    }

    if(isIos){
      installBanner.setAttribute('aria-label','Add GroovyShelves to your home screen');
      if(title)title.textContent='Get GroovyShelves';
      if(subtitle)subtitle.textContent='Add it to your home screen';
      return;
    }

    installBanner.setAttribute('aria-label','Get the GroovyShelves app');
    if(title)title.textContent='Get GroovyShelves';
    if(subtitle)subtitle.textContent='Install it on your device';
  }

  function wasDismissed(){
    try{
      var dismissedAt=parseInt(localStorage.getItem('groovy-install-dismissed'),10)||0;
      return Date.now()-dismissedAt<30*24*60*60*1000;
    }
    catch(error){return false;}
  }

  function showBanner(){
    if(!isStandalone&&!wasDismissed())installBanner.hidden=false;
  }

  function hideBanner(){
    installBanner.hidden=true;
  }

  function openHelp(){
    var steps=isIos
      ?['Tap the Share button in your browser.','Choose “Add to Home Screen”.','Tap “Add” to install Groovy.']
      :['Open Groovy on your phone.','Open the menu in Safari or Chrome.','Choose “Add to Home Screen” to use it like an app.'];
    helpModal.classList.toggle('desktop-install-help',!isIos);
    document.getElementById('installHelpTitle').textContent=isIos
      ?'Add Groovy to your home screen'
      :'Add it to your phone’s home screen';
    helpSteps.innerHTML=steps.map(function(step,index){
      return '<div class="install-help-step"><span>'+(index+1)+'</span><div>'+step+'</div></div>';
    }).join('');
    helpModal.classList.add('visible');
    helpModal.setAttribute('aria-hidden','false');
    closeHelpButton.focus();
  }

  function closeHelp(){
    helpModal.classList.remove('visible');
    helpModal.setAttribute('aria-hidden','true');
  }

  function startAndroidApkInstall(){
    hideBanner();
    window.location.assign(androidApkUrl);
  }

  async function startInstall(){
    profileMenuElement.classList.remove('open');

    if(isAndroid){
      startAndroidApkInstall();
      return;
    }

    if(!isIos){
      openHelp();
      return;
    }

    if(!deferredInstallPrompt){
      openHelp();
      return;
    }

    deferredInstallPrompt.prompt();
    var choice=await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    if(choice&&choice.outcome==='accepted')hideBanner();
  }

  function loadProfileModule(){
    if(!document.getElementById('groovyProfileStyles')){
      var style=document.createElement('link');
      style.id='groovyProfileStyles';
      style.rel='stylesheet';
      style.href='/css/profile.css?v=6';
      document.head.appendChild(style);
    }

    if(!document.getElementById('groovyProfileScript')){
      var script=document.createElement('script');
      script.id='groovyProfileScript';
      script.src='/js/profile.js?v=6';
      document.body.appendChild(script);
    }
  }

  setInstallCopy();
  loadProfileModule();

  if('serviceWorker' in navigator){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'})
        .catch(function(error){console.warn('Could not enable app installation:',error);});
    });
  }

  window.addEventListener('beforeinstallprompt',function(event){
    event.preventDefault();
    deferredInstallPrompt=event;
    showBanner();
  });

  window.addEventListener('appinstalled',function(){
    deferredInstallPrompt=null;
    hideBanner();
    installMenuButton.hidden=true;
    installShortcutButton.hidden=true;
    closeHelp();
  });

  installButton.addEventListener('click',startInstall);
  installMenuButton.addEventListener('click',startInstall);
  installShortcutButton.addEventListener('click',startInstall);

  dismissButton.addEventListener('click',function(){
    hideBanner();
    try{localStorage.setItem('groovy-install-dismissed',String(Date.now()));}catch(error){}
  });
  closeHelpButton.addEventListener('click',closeHelp);
  helpDoneButton.addEventListener('click',closeHelp);
  helpModal.addEventListener('click',function(event){
    if(event.target===helpModal)closeHelp();
  });
  document.addEventListener('keydown',function(event){
    if(event.key==='Escape'&&helpModal.classList.contains('visible'))closeHelp();
  });

  installMenuButton.hidden=isStandalone;
  installShortcutButton.hidden=isStandalone;
  if((isIos||isAndroid)&&!isStandalone)showBanner();
})();
