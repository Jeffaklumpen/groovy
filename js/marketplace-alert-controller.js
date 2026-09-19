(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./marketplace-core.js'));
  }else if(root){
    root.GroovyMarketplaceAlertController=factory(root.GroovyMarketplaceCore);
  }
})(typeof window!=='undefined'?window:null,function(Core){
'use strict';

function create(options){
  options=options||{};
  if(!Core)throw new Error('GroovyMarketplaceCore is required for marketplace alerts');

  var elements=options.elements||{};
  var api=options.api;
  var storage=options.storage||null;
  var nav=options.navigator||{};
  var IntlApi=options.Intl||(typeof Intl!=='undefined'?Intl:null);
  var getCurrentUser=typeof options.getCurrentUser==='function'?options.getCurrentUser:async function(){return null;};
  var getRecord=typeof options.getRecord==='function'?options.getRecord:function(){return null;};
  var recordModel=options.recordModel;
  var getAlbumId=typeof options.getAlbumId==='function'?options.getAlbumId:function(record){return recordModel&&recordModel.albumId?recordModel.albumId(record):null;};
  var getArtist=typeof options.getArtist==='function'?options.getArtist:function(record){return recordModel&&recordModel.artist?recordModel.artist(record)||'':'';};
  var getTitle=typeof options.getTitle==='function'?options.getTitle:function(record){return recordModel&&recordModel.title?recordModel.title(record)||'':'';};
  var onRequireAuth=typeof options.onRequireAuth==='function'?options.onRequireAuth:function(){};
  var onChanged=typeof options.onChanged==='function'?options.onChanged:function(){};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};
  var currencyStorageKey='groovy-marketplace-currency-v1';
  var activeIndex=-1;
  var activeRecordOverride=null;
  var activeUser=null;
  var currentAlert=null;
  var requestVersion=0;
  var bound=false;

  function locale(){return (nav.languages&&nav.languages[0])||nav.language||undefined;}
  function timezone(){
    try{return IntlApi&&IntlApi.DateTimeFormat?IntlApi.DateTimeFormat().resolvedOptions().timeZone||'':'';}catch(error){return '';}
  }
  function defaultCurrency(){
    var preference='auto';
    try{preference=storage&&storage.getItem?storage.getItem(currencyStorageKey)||'auto':'auto';}catch(error){}
    return Core.displayCurrency(preference,Core.regionCurrency(locale()||'',timezone()));
  }
  function ebayMarketplace(){return Core.ebayMarketplaceId(locale()||'');}
  function activeRecord(){return activeRecordOverride||getRecord(activeIndex);}
  function formatAmount(amount,currency){return Core.formatMoney(Number(amount),currency,locale())||String(amount)+' '+String(currency||'');}

  function setStatus(message,state){
    if(!elements.status)return;
    elements.status.textContent=String(message||'');
    elements.status.className='marketplace-alert-status'+(state?' '+state:'');
  }

  function summary(alert){
    if(!alert)return 'Notify me when this record drops below a price.';
    var markets=[];
    if(alert.tradera_enabled)markets.push('Tradera');
    if(alert.ebay_enabled)markets.push('eBay');
    var types=[];
    if(alert.fixed_price)types.push('Fixed');
    if(alert.auction)types.push('Auction');
    return 'Under '+formatAmount(alert.max_price,alert.currency)+' · '+markets.join(' + ')+' · '+types.join(' + ');
  }

  function renderTrigger(){
    if(!elements.button)return;
    var record=activeRecord();
    var albumId=record?Number(getAlbumId(record)||0):0;
    var available=!!(activeUser&&albumId>0);
    elements.button.hidden=!available;
    elements.button.classList.toggle('active',!!currentAlert);
    elements.button.setAttribute('aria-pressed',currentAlert?'true':'false');
    if(elements.buttonTitle)elements.buttonTitle.textContent=currentAlert?'Price alert active':'Set price alert';
    if(elements.buttonSummary)elements.buttonSummary.textContent=summary(currentAlert);
  }

  function populateForm(){
    var record=activeRecord();
    var alert=currentAlert;
    if(elements.title)elements.title.textContent=alert?'Edit price alert':'Notify me under';
    if(elements.subtitle)elements.subtitle.textContent=record?(getArtist(record)+' · '+getTitle(record)):'';
    if(elements.priceInput)elements.priceInput.value=alert?String(alert.max_price):'';
    if(elements.currencySelect)elements.currencySelect.value=alert&&alert.currency?alert.currency:defaultCurrency();
    if(elements.traderaCheckbox)elements.traderaCheckbox.checked=alert?!!alert.tradera_enabled:true;
    if(elements.ebayCheckbox)elements.ebayCheckbox.checked=alert?!!alert.ebay_enabled:true;
    if(elements.fixedCheckbox)elements.fixedCheckbox.checked=alert?!!alert.fixed_price:true;
    if(elements.auctionCheckbox)elements.auctionCheckbox.checked=alert?!!alert.auction:true;
    if(elements.deleteButton)elements.deleteButton.hidden=!alert;
    setStatus('','');
  }

  function openModal(){
    if(!activeUser){onRequireAuth();return false;}
    if(!activeRecord()||Number(getAlbumId(activeRecord())||0)<=0)return false;
    populateForm();
    if(elements.modal){
      elements.modal.classList.add('visible');
      elements.modal.setAttribute('aria-hidden','false');
    }
    if(elements.priceInput&&typeof elements.priceInput.focus==='function')elements.priceInput.focus();
    return true;
  }

  function closeModal(){
    if(!elements.modal)return;
    elements.modal.classList.remove('visible');
    elements.modal.setAttribute('aria-hidden','true');
    setStatus('','');
  }

  function formValue(){
    var maxPrice=Number(elements.priceInput&&elements.priceInput.value);
    var currency=String(elements.currencySelect&&elements.currencySelect.value||'').toUpperCase();
    var tradera=!!(elements.traderaCheckbox&&elements.traderaCheckbox.checked);
    var ebay=!!(elements.ebayCheckbox&&elements.ebayCheckbox.checked);
    var fixed=!!(elements.fixedCheckbox&&elements.fixedCheckbox.checked);
    var auction=!!(elements.auctionCheckbox&&elements.auctionCheckbox.checked);
    if(!isFinite(maxPrice)||maxPrice<=0)return {error:'Enter a price greater than 0.'};
    if(!currency)return {error:'Choose a currency.'};
    if(!tradera&&!ebay)return {error:'Choose Tradera, eBay or both.'};
    if(!fixed&&!auction)return {error:'Choose fixed price, auction or both.'};
    return {maxPrice:maxPrice,currency:currency,tradera:tradera,ebay:ebay,fixed:fixed,auction:auction};
  }

  async function save(){
    if(!api||typeof api.rpc!=='function')return false;
    var record=activeRecord();
    var albumId=record?Number(getAlbumId(record)||0):0;
    var value=formValue();
    if(value.error){setStatus(value.error,'error');return false;}
    if(!activeUser||!albumId)return false;

    if(elements.saveButton)elements.saveButton.disabled=true;
    if(elements.deleteButton)elements.deleteButton.disabled=true;
    setStatus('Saving alert…','loading');
    try{
      var result=await api.rpc('save_marketplace_alert',{
        p_album_id:albumId,
        p_max_price:value.maxPrice,
        p_currency:value.currency,
        p_tradera:value.tradera,
        p_ebay:value.ebay,
        p_fixed:value.fixed,
        p_auction:value.auction,
        p_ebay_marketplace_id:ebayMarketplace()
      });
      if(result.error)throw result.error;
      currentAlert=Array.isArray(result.data)?result.data[0]||null:result.data;
      renderTrigger();
      closeModal();
      onChanged({type:'saved',alert:currentAlert,record:record});
      if(api.functions&&typeof api.functions.invoke==='function'&&currentAlert&&currentAlert.id){
        api.functions.invoke('marketplace-alert-scan',{
          body:{alert_id:currentAlert.id,source:'price-alert-save'}
        }).then(function(scanResult){
          if(scanResult&&scanResult.error)throw scanResult.error;
          onChanged({type:'scanned',alert:currentAlert,record:record});
        }).catch(function(error){
          onLog('warn','Could not refresh marketplace state after saving alert:',error);
        });
      }
      return true;
    }catch(error){
      onLog('error','Could not save marketplace price alert:',error);
      setStatus(error&&error.message?error.message:'Could not save the alert.','error');
      return false;
    }finally{
      if(elements.saveButton)elements.saveButton.disabled=false;
      if(elements.deleteButton)elements.deleteButton.disabled=false;
    }
  }

  async function remove(){
    if(!currentAlert||!api||typeof api.rpc!=='function')return false;
    var record=activeRecord();
    var albumId=record?Number(getAlbumId(record)||0):0;
    if(!activeUser||!albumId)return false;
    if(elements.deleteButton)elements.deleteButton.disabled=true;
    if(elements.saveButton)elements.saveButton.disabled=true;
    setStatus('Removing alert…','loading');
    try{
      var result=await api.rpc('delete_marketplace_alert',{p_album_id:albumId});
      if(result.error)throw result.error;
      var removedAlert=currentAlert;
      currentAlert=null;
      renderTrigger();
      closeModal();
      onChanged({type:'removed',alert:removedAlert,record:record});
      return true;
    }catch(error){
      onLog('error','Could not remove marketplace price alert:',error);
      setStatus(error&&error.message?error.message:'Could not remove the alert.','error');
      return false;
    }finally{
      if(elements.deleteButton)elements.deleteButton.disabled=false;
      if(elements.saveButton)elements.saveButton.disabled=false;
    }
  }

  async function openForRecord(index){
    var version=++requestVersion;
    activeIndex=index;
    activeRecordOverride=null;
    currentAlert=null;
    activeUser=await getCurrentUser();
    if(version!==requestVersion)return null;
    renderTrigger();
    var record=activeRecord();
    var albumId=record?Number(getAlbumId(record)||0):0;
    if(!activeUser||!albumId||!api||typeof api.from!=='function')return null;

    try{
      var result=await api.from('marketplace_alerts')
        .select('id,album_id,max_price,currency,tradera_enabled,ebay_enabled,fixed_price,auction,ebay_marketplace_id,active,last_checked_at,last_error')
        .eq('user_id',activeUser.id)
        .eq('album_id',albumId)
        .maybeSingle();
      if(version!==requestVersion)return null;
      if(result.error)throw result.error;
      currentAlert=result.data||null;
    }catch(error){
      if(version!==requestVersion)return null;
      onLog('warn','Could not load marketplace price alert:',error);
      currentAlert=null;
    }
    renderTrigger();
    return currentAlert;
  }

  async function openForRecordData(record,alert){
    var version=++requestVersion;
    activeIndex=-1;
    activeRecordOverride=record||null;
    currentAlert=alert||null;
    activeUser=await getCurrentUser();
    if(version!==requestVersion)return false;
    if(!activeUser||!activeRecord()||Number(getAlbumId(activeRecord())||0)<=0){
      if(!activeUser)onRequireAuth();
      return false;
    }
    renderTrigger();
    return openModal();
  }

  function close(){
    requestVersion++;
    activeIndex=-1;
    activeRecordOverride=null;
    activeUser=null;
    currentAlert=null;
    closeModal();
    renderTrigger();
  }

  function handleEscape(){
    if(elements.modal&&elements.modal.classList&&elements.modal.classList.contains('visible')){
      closeModal();
      return true;
    }
    return false;
  }

  function bind(){
    if(bound)return;
    bound=true;
    if(elements.button)elements.button.addEventListener('click',function(event){
      if(event){event.preventDefault();event.stopPropagation();}
      openModal();
    });
    if(elements.closeButton)elements.closeButton.addEventListener('click',closeModal);
    if(elements.cancelButton)elements.cancelButton.addEventListener('click',closeModal);
    if(elements.saveButton)elements.saveButton.addEventListener('click',save);
    if(elements.deleteButton)elements.deleteButton.addEventListener('click',remove);
    if(elements.form)elements.form.addEventListener('submit',function(event){event.preventDefault();save();});
    if(elements.modal)elements.modal.addEventListener('click',function(event){if(event.target===elements.modal)closeModal();});
  }

  bind();
  renderTrigger();

  return Object.freeze({
    openForRecord:openForRecord,
    openForRecordData:openForRecordData,
    openModal:openModal,
    closeModal:closeModal,
    save:save,
    remove:remove,
    close:close,
    handleEscape:handleEscape,
    state:function(){return {activeIndex:activeIndex,alert:currentAlert,user:activeUser};}
  });
}

return Object.freeze({create:create});
});
