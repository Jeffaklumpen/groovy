(function(root,factory){
  var api=factory(root&&root.GroovyMarketplaceCore,root&&root.GroovyStreaming);
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./marketplace-core.js'),require('./streaming-links.js'));
  }
  if(root)root.GroovyPriceAlertsPageController=api;
})(typeof window!=='undefined'?window:null,function(MarketplaceCore,Streaming){
'use strict';

function create(options){
  options=options||{};
  var api=options.api;
  var elements=options.elements||{};
  var win=options.window||(typeof window!=='undefined'?window:null);
  var doc=options.document||(typeof document!=='undefined'?document:null);
  var nav=options.navigator||(win&&win.navigator)||{};
  var storage=options.storage||(win&&win.localStorage)||null;
  var IntlApi=options.Intl||(typeof Intl!=='undefined'?Intl:null);
  var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
  var onOpenRoute=typeof options.onOpenRoute==='function'?options.onOpenRoute:function(){};
  var onBackHome=typeof options.onBackHome==='function'?options.onBackHome:function(){};
  var onEdit=typeof options.onEdit==='function'?options.onEdit:function(){};
  var onOpenMarketplace=typeof options.onOpenMarketplace==='function'?options.onOpenMarketplace:function(){};
  var onRequireAuth=typeof options.onRequireAuth==='function'?options.onRequireAuth:function(){};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};
  var loadVersion=0;
  var alerts=[];
  var bound=false;
  var visibilityStorageKey='groovy-price-alert-marketplace-visibility-v1';
  var marketVisibility=loadVisibility();

  if(!api||typeof api.from!=='function')throw new Error('Price alerts page requires Supabase');
  if(!MarketplaceCore)throw new Error('Price alerts page requires marketplace core');
  if(!Streaming)throw new Error('Price alerts page requires streaming links');

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function locale(){return (nav.languages&&nav.languages[0])||nav.language||undefined;}

  function timezone(){
    try{return IntlApi&&IntlApi.DateTimeFormat?IntlApi.DateTimeFormat().resolvedOptions().timeZone||'':'';}catch(error){return '';}
  }

  function defaultVisibility(){
    return {
      Tradera:MarketplaceCore.regionCurrency(locale()||'',timezone())==='SEK',
      eBay:true
    };
  }

  function loadVisibility(){
    var fallback=defaultVisibility();
    try{
      var saved=storage&&storage.getItem?JSON.parse(storage.getItem(visibilityStorageKey)||'null'):null;
      if(saved&&typeof saved==='object'){
        var tradera=saved.Tradera!==false;
        var ebay=saved.eBay!==false;
        if(!tradera&&!ebay)return fallback;
        return {Tradera:tradera,eBay:ebay};
      }
    }catch(error){}
    return fallback;
  }

  function saveVisibility(){
    try{
      if(storage&&storage.setItem)storage.setItem(visibilityStorageKey,JSON.stringify(marketVisibility));
    }catch(error){}
  }

  function safeExternalUrl(value){
    try{
      var parsed=new URL(String(value||''),win&&win.location?win.location.href:undefined);
      return parsed.protocol==='https:'||parsed.protocol==='http:'?parsed.href:'';
    }catch(error){
      return '';
    }
  }

  function syncVisibilityControls(){
    if(elements.traderaToggle)elements.traderaToggle.checked=!!marketVisibility.Tradera;
    if(elements.ebayToggle)elements.ebayToggle.checked=!!marketVisibility.eBay;
  }

  function setVisibility(marketplace,visible){
    marketVisibility[marketplace]=!!visible;
    if(!marketVisibility.Tradera&&!marketVisibility.eBay){
      marketVisibility[marketplace]=true;
    }
    saveVisibility();
    syncVisibilityControls();
    render();
  }

  function one(value){
    return Array.isArray(value)?(value[0]||null):(value||null);
  }

  function albumOf(alert){
    var album=one(alert&&alert.albums);
    var artist=album?one(album.artists):null;
    return {
      id:album&&album.id?album.id:(alert&&alert.album_id),
      title:album&&album.title?album.title:'Unknown album',
      artist:artist&&artist.name?String(artist.name).replace(/\s*\(\d+\)$/,''):'Unknown artist',
      coverUrl:album&&album.cover_url?album.cover_url:'',
      appleUrl:album&&album.apple_collection_url?album.apple_collection_url:''
    };
  }

  function statesOf(alert){
    var rows=alert&&Array.isArray(alert.marketplace_alert_market_state)
      ?alert.marketplace_alert_market_state
      :[];
    var map={};
    rows.forEach(function(row){if(row&&row.marketplace)map[row.marketplace]=row;});
    return map;
  }

  function money(value,currency){
    var amount=Number(value);
    if(!isFinite(amount))return '—';
    return MarketplaceCore.formatMoney(amount,currency,locale())||((Math.round(amount*100)/100)+' '+currency);
  }

  function relative(value){
    if(!value)return 'Waiting for first check';
    var time=new Date(value).getTime();
    if(!isFinite(time))return 'Checked recently';
    var seconds=Math.max(0,Math.round((Date.now()-time)/1000));
    if(seconds<60)return 'Checked just now';
    var minutes=Math.floor(seconds/60);
    if(minutes<60)return 'Checked '+minutes+' min ago';
    var hours=Math.floor(minutes/60);
    if(hours<24)return 'Checked '+hours+'h ago';
    var days=Math.floor(hours/24);
    return 'Checked '+days+'d ago';
  }

  function serviceMarkup(name,state,enabled,currency,alertId){
    if(!enabled||!marketVisibility[name])return '';
    var marketClass=name==='Tradera'?'tradera':'ebay';
    var brand=name==='Tradera'?'T':'e';
    var marketAttr=esc(name);
    if(!state){
      return '<div class="price-alert-market '+marketClass+'">'+
        '<button class="price-alert-market-open" type="button" data-price-alert-market="'+marketAttr+'" data-price-alert-market-id="'+esc(alertId)+'" aria-label="View active '+marketAttr+' listings">'+
          '<span class="price-alert-market-brand">'+brand+'</span><strong>'+name+'</strong><span>—</span>'+
        '</button>'+
        '<div class="price-alert-market-price"><strong>—</strong><span>Waiting for scan</span></div>'+
        '<small>Current marketplace data is not available yet.</small>'+
      '</div>';
    }
    var count=Math.max(0,parseInt(state.listing_count,10)||0);
    var countLabel=String(count)+(state.listing_count_capped?'+':'');
    var lowest=state.lowest_price==null?null:Number(state.lowest_price);
    var lowestUrl=safeExternalUrl(state.lowest_listing_url);
    var lowestMarkup=lowest&&lowest>0
      ?(lowestUrl
        ?'<a class="price-alert-lowest-link" href="'+esc(lowestUrl)+'" target="_blank" rel="noopener noreferrer" title="Open lowest-priced listing">'+esc(money(lowest,currency))+'</a>'
        :'<strong>'+esc(money(lowest,currency))+'</strong>')
      :'<strong>No price</strong>';
    return '<div class="price-alert-market '+marketClass+'">'+
      '<button class="price-alert-market-open" type="button" data-price-alert-market="'+marketAttr+'" data-price-alert-market-id="'+esc(alertId)+'" aria-label="View '+countLabel+' active '+marketAttr+' listings">'+
        '<span class="price-alert-market-brand">'+brand+'</span><strong>'+name+'</strong><span>'+countLabel+' '+(count===1&&!state.listing_count_capped?'listing':'listings')+'</span>'+
      '</button>'+
      '<div class="price-alert-market-price">'+lowestMarkup+'<span>Lowest current</span></div>'+
      '<small>'+esc(relative(state.checked_at))+'</small>'+
    '</div>';
  }

  function card(alert){
    var album=albumOf(alert);
    var states=statesOf(alert);
    var markets=[];
    if(alert.tradera_enabled)markets.push('Tradera');
    if(alert.ebay_enabled)markets.push('eBay');
    var types=[];
    if(alert.fixed_price)types.push('Fixed price');
    if(alert.auction)types.push('Auction');
    var apple=Streaming.appleMusicSearchUrl(album.artist,album.title,album.appleUrl,'se');
    var spotify=Streaming.spotifySearchUrl(album.artist,album.title);
    var cover=album.coverUrl||'/assets/images/avatar-placeholder.png';

    return '<article class="price-alert-card" data-alert-id="'+esc(alert.id)+'">'+
      '<div class="price-alert-cover-column">'+
        '<div class="price-alert-cover-wrap"><img src="'+esc(cover)+'" alt="'+esc(album.artist+' - '+album.title)+'" loading="lazy" decoding="async"></div>'+
        '<div class="price-alert-streaming" aria-label="Streaming links">'+
          '<a class="price-alert-apple" href="'+esc(apple)+'" target="_blank" rel="noopener noreferrer" aria-label="Listen on Apple Music"><img src="/assets/brands/apple-music-badge-small.svg" alt="Listen on Apple Music"></a>'+
          '<a class="price-alert-spotify" href="'+esc(spotify)+'" target="_blank" rel="noopener noreferrer" aria-label="Find on Spotify"><img src="/assets/brands/spotify-full-logo-green.svg" alt="Spotify"></a>'+
        '</div>'+
      '</div>'+
      '<div class="price-alert-card-main">'+
        '<div class="price-alert-identity">'+
          '<span class="price-alert-card-kicker">PRICE ALERT</span>'+
          '<h2>'+esc(album.title)+'</h2>'+
          '<p>'+esc(album.artist)+'</p>'+
        '</div>'+
        '<div class="price-alert-rule">'+
          '<span>Notify me under</span><strong>'+esc(money(alert.max_price,alert.currency))+'</strong>'+
        '</div>'+
        '<div class="price-alert-meta">'+
          '<span>'+esc(markets.join(' + '))+'</span>'+
          '<i aria-hidden="true"></i>'+
          '<span>'+esc(types.join(' + '))+'</span>'+
        '</div>'+
        '<div class="price-alert-market-grid">'+
          serviceMarkup('Tradera',states.Tradera,!!alert.tradera_enabled,alert.currency,alert.id)+
          serviceMarkup('eBay',states.eBay,!!alert.ebay_enabled,alert.currency,alert.id)+
        '</div>'+
      '</div>'+
      '<div class="price-alert-card-actions">'+
        '<button class="price-alert-edit" type="button" data-price-alert-edit="'+esc(alert.id)+'">Edit</button>'+
        '<button class="price-alert-remove" type="button" data-price-alert-remove="'+esc(alert.id)+'" aria-label="Delete price alert">Delete</button>'+
        '<div class="price-alert-delete-confirm" data-price-alert-confirm="'+esc(alert.id)+'" hidden>'+
          '<span>Remove this alert?</span>'+
          '<button type="button" data-price-alert-cancel="'+esc(alert.id)+'">Cancel</button>'+
          '<button class="danger" type="button" data-price-alert-delete="'+esc(alert.id)+'">Remove</button>'+
        '</div>'+
      '</div>'+
    '</article>';
  }

  function render(){
    if(elements.count)elements.count.textContent=alerts.length+' ACTIVE '+(alerts.length===1?'ALERT':'ALERTS');
    if(!elements.grid)return;
    if(!alerts.length){
      elements.grid.innerHTML='<div class="price-alert-empty"><span class="price-alert-empty-icon" aria-hidden="true"></span><strong>No price alerts yet</strong><p>Open a record and set a price alert to start watching Tradera and eBay.</p><button type="button" data-price-alert-back>Back to My Shelf</button></div>';
      return;
    }
    elements.grid.innerHTML=alerts.map(card).join('');
  }

  async function load(){
    var version=++loadVersion;
    if(elements.grid)elements.grid.innerHTML='<div class="price-alert-loading"><span></span><strong>Loading price alerts…</strong></div>';
    var user=await getCurrentUser();
    if(version!==loadVersion)return;
    if(!user){
      hidePage();
      onRequireAuth();
      return;
    }

    var result=await api.from('marketplace_alerts')
      .select('id,album_id,max_price,currency,tradera_enabled,ebay_enabled,fixed_price,auction,ebay_marketplace_id,active,last_checked_at,last_error,created_at,updated_at,albums(id,title,cover_url,apple_collection_url,artists(name)),marketplace_alert_market_state(marketplace,listing_count,listing_count_capped,lowest_price,lowest_listing_url,currency,checked_at)')
      .eq('user_id',user.id)
      .eq('active',true)
      .order('created_at',{ascending:false});

    if(version!==loadVersion)return;
    if(result.error){
      onLog('error','Could not load price alerts:',result.error);
      if(elements.grid)elements.grid.innerHTML='<div class="price-alert-empty error"><strong>Could not load price alerts.</strong><p>Please try again in a moment.</p></div>';
      return;
    }
    alerts=Array.isArray(result.data)?result.data:[];
    render();
  }

  function findAlert(id){
    id=String(id||'');
    return alerts.find(function(alert){return String(alert.id)===id;})||null;
  }

  function showDelete(id,show){
    if(!elements.grid)return;
    var cardElement=elements.grid.querySelector('[data-alert-id="'+String(id).replace(/"/g,'')+'"]');
    if(!cardElement)return;
    var edit=cardElement.querySelector('[data-price-alert-edit]');
    var remove=cardElement.querySelector('[data-price-alert-remove]');
    var confirm=cardElement.querySelector('[data-price-alert-confirm]');
    if(edit)edit.hidden=!!show;
    if(remove)remove.hidden=!!show;
    if(confirm)confirm.hidden=!show;
  }

  async function removeAlert(id){
    var alert=findAlert(id);
    if(!alert)return;
    var cardElement=elements.grid&&elements.grid.querySelector('[data-alert-id="'+String(id).replace(/"/g,'')+'"]');
    var button=cardElement&&cardElement.querySelector('[data-price-alert-delete]');
    if(button){button.disabled=true;button.textContent='Removing…';}
    try{
      var result=await api.rpc('delete_marketplace_alert',{p_album_id:alert.album_id});
      if(result.error)throw result.error;
      alerts=alerts.filter(function(item){return String(item.id)!==String(id);});
      render();
    }catch(error){
      onLog('error','Could not remove price alert:',error);
      if(button){button.disabled=false;button.textContent='Remove';}
      showDelete(id,false);
    }
  }

  function bind(){
    if(bound)return;
    bound=true;
    if(elements.menuButton)elements.menuButton.addEventListener('click',function(event){
      if(event){event.preventDefault();event.stopPropagation();}
      onOpenRoute();
    });
    if(elements.backButton)elements.backButton.addEventListener('click',onBackHome);
    if(elements.traderaToggle)elements.traderaToggle.addEventListener('change',function(){setVisibility('Tradera',this.checked);});
    if(elements.ebayToggle)elements.ebayToggle.addEventListener('change',function(){setVisibility('eBay',this.checked);});
    syncVisibilityControls();
    if(elements.grid)elements.grid.addEventListener('click',function(event){
      var target=event.target;
      var back=target.closest&&target.closest('[data-price-alert-back]');
      if(back){onBackHome();return;}
      var market=target.closest&&target.closest('[data-price-alert-market]');
      if(market){
        var marketAlert=findAlert(market.getAttribute('data-price-alert-market-id'));
        if(marketAlert)onOpenMarketplace(marketAlert,albumOf(marketAlert),market.getAttribute('data-price-alert-market'));
        return;
      }
      var edit=target.closest&&target.closest('[data-price-alert-edit]');
      if(edit){
        var alert=findAlert(edit.getAttribute('data-price-alert-edit'));
        if(alert)onEdit(alert,albumOf(alert));
        return;
      }
      var remove=target.closest&&target.closest('[data-price-alert-remove]');
      if(remove){showDelete(remove.getAttribute('data-price-alert-remove'),true);return;}
      var cancel=target.closest&&target.closest('[data-price-alert-cancel]');
      if(cancel){showDelete(cancel.getAttribute('data-price-alert-cancel'),false);return;}
      var del=target.closest&&target.closest('[data-price-alert-delete]');
      if(del)removeAlert(del.getAttribute('data-price-alert-delete'));
    });
  }

  async function renderPage(){
    if(!elements.page)return;
    elements.page.hidden=false;
    elements.page.setAttribute('aria-hidden','false');
    if(doc&&doc.body)doc.body.classList.add('price-alerts-page-open');
    if(elements.profileMenu)elements.profileMenu.classList.remove('open');
    await load();
  }

  function hidePage(){
    loadVersion++;
    if(elements.page){
      elements.page.hidden=true;
      elements.page.setAttribute('aria-hidden','true');
    }
    if(doc&&doc.body)doc.body.classList.remove('price-alerts-page-open');
  }

  function refreshIfOpen(){
    if(!elements.page||elements.page.hidden)return Promise.resolve();
    return load();
  }

  bind();

  return Object.freeze({
    renderPage:renderPage,
    hidePage:hidePage,
    refreshIfOpen:refreshIfOpen,
    state:function(){return {alerts:alerts.slice(),marketVisibility:{Tradera:marketVisibility.Tradera,eBay:marketVisibility.eBay},open:!!(elements.page&&!elements.page.hidden)};}
  });
}

return Object.freeze({create:create});
});
