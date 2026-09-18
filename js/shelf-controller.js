(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./shelf-core.js'),require('./shelf-view.js'));
  }else if(root){
    root.GroovyShelfController=factory(root.GroovyShelfCore,root.GroovyShelfView);
  }
})(typeof window!=='undefined'?window:null,function(Core,View){
'use strict';

function create(options){
  options=options||{};
  var elements=options.elements||{};
  var colors=Array.isArray(options.colors)&&options.colors.length?options.colors.slice():['#E85301'];
  var maxShelves=Number(options.maxShelves)||10;
  var api=options.api;
  var Record=options.recordModel;

  var loadedUserId='';
  var pickerRecordIndex=-1;
  var createReturnRecordIndex=-1;
  var selectedIcon='record';
  var selectedColor=colors[0];
  var editingShelfId='';

  function getShelves(){return typeof options.getShelves==='function'?(options.getShelves()||[]):[];}
  function setShelves(value){if(typeof options.setShelves==='function')options.setShelves(Array.isArray(value)?value:[]);}
  function getActiveShelfId(){return typeof options.getActiveShelfId==='function'?(options.getActiveShelfId()||'all'):'all';}
  function setActiveShelfId(value){if(typeof options.setActiveShelfId==='function')options.setActiveShelfId(value||'all');}
  function getRecords(){return typeof options.getRecords==='function'?(options.getRecords()||[]):[];}
  function viewedUserId(){return typeof options.getViewedUserId==='function'?options.getViewedUserId():null;}
  function libraryView(){return typeof options.getLibraryView==='function'?options.getLibraryView():'collection';}
  function detailOpenIndex(){return typeof options.getDetailOpenRecordIndex==='function'?options.getDetailOpenRecordIndex():-1;}
  function resetLibraryPage(){if(typeof options.onLibraryPageReset==='function')options.onLibraryPageReset();}
  function renderGrid(){if(typeof options.onGridChange==='function')options.onGridChange();}
  function isMobile(){return typeof options.isMobile==='function'&&options.isMobile();}
  function requestFrame(fn){
    if(typeof options.requestFrame==='function')return options.requestFrame(fn);
    if(typeof requestAnimationFrame==='function')return requestAnimationFrame(fn);
    return fn();
  }
  function report(level,message,error){
    if(typeof options.onLog==='function')options.onLog(level,message,error);
    else if(typeof console!=='undefined'&&console[level])console[level](message,error||'');
  }
  function showAlert(message){
    if(typeof options.alert==='function')options.alert(message);
  }
  async function sessionUser(){
    if(typeof options.getSessionUser==='function')return options.getSessionUser();
    if(!api||!api.auth||!api.auth.getSession)return null;
    var result=await api.auth.getSession();
    return result&&result.data&&result.data.session&&result.data.session.user||null;
  }
  function shelfById(id){return Core.findById(getShelves(),id);}
  function recordCount(id){return Core.recordCount(getRecords(),id,Record.shelfId);}

  function updateScrollArrows(){
    var strip=elements.strip;
    var scroll=elements.stripScroll;
    if(!strip||!scroll)return;
    if(isMobile()){
      strip.classList.remove('has-overflow');
      return;
    }
    var maxScroll=Math.max(0,scroll.scrollWidth-scroll.clientWidth);
    var hasOverflow=maxScroll>2;
    strip.classList.toggle('has-overflow',hasOverflow);
    maxScroll=Math.max(0,scroll.scrollWidth-scroll.clientWidth);
    if(elements.scrollLeft)elements.scrollLeft.disabled=!hasOverflow||scroll.scrollLeft<=2;
    if(elements.scrollRight)elements.scrollRight.disabled=!hasOverflow||scroll.scrollLeft>=maxScroll-2;
  }

  function stripHidden(){
    if(typeof options.shouldHideStrip==='function')return !!options.shouldHideStrip();
    return libraryView()==='wishlist';
  }

  function renderStrip(){
    var strip=elements.strip;
    var scroll=elements.stripScroll;
    if(!strip||!scroll)return;
    var hide=stripHidden();
    strip.hidden=hide;
    if(hide){
      scroll.innerHTML='';
      strip.classList.remove('has-overflow');
      if(elements.editButton)elements.editButton.hidden=true;
      if(elements.deleteButton)elements.deleteButton.hidden=true;
      return;
    }

    var active=getActiveShelfId();
    if(active!=='all'&&!shelfById(active)){
      active='all';
      setActiveShelfId(active);
    }

    var previousScroll=scroll.scrollLeft;
    scroll.innerHTML=View.stripMarkup({
      shelves:getShelves(),records:getRecords(),activeShelfId:active,
      maxShelves:maxShelves,showCreate:viewedUserId()===null,colors:colors
    });
    scroll.scrollLeft=previousScroll;

    scroll.querySelectorAll('.shelf-chip[data-shelf-id]').forEach(function(button){
      button.addEventListener('click',function(){
        setActiveShelfId(button.getAttribute('data-shelf-id')||'all');
        resetLibraryPage();
        renderGrid();
      });
    });
    var newButton=scroll.querySelector('.shelf-new-button:not(:disabled)');
    if(newButton)newButton.addEventListener('click',function(){openCreate(-1);});

    var canManage=viewedUserId()===null&&active!=='all'&&shelfById(active);
    if(elements.editButton)elements.editButton.hidden=!canManage;
    if(elements.deleteButton)elements.deleteButton.hidden=!canManage;
    requestFrame(updateScrollArrows);
  }

  async function loadForUser(userId){
    if(!userId){
      setShelves([]);
      setActiveShelfId('all');
      loadedUserId='';
      renderStrip();
      return [];
    }
    if(String(loadedUserId)!==String(userId))setActiveShelfId('all');
    loadedUserId=String(userId);
    if(!api||!api.from)throw new Error('Shelf data API is unavailable.');

    var query=api.from('shelves')
      .select('id,user_id,name,icon,color,sort_order,created_at')
      .eq('user_id',userId)
      .order('sort_order',{ascending:true})
      .order('created_at',{ascending:true});
    var result=await query;
    if(result.error){
      report('error','Kunde inte hämta shelves:',result.error);
      setShelves([]);
      setActiveShelfId('all');
    }else{
      var next=(result.data||[]).map(function(shelf){
        shelf.color=Core.normalizeColor(shelf.color,colors);
        return shelf;
      });
      setShelves(next);
      var active=getActiveShelfId();
      if(active!=='all'&&!shelfById(active))setActiveShelfId('all');
    }
    renderStrip();
    return getShelves();
  }

  function setIcon(icon){
    selectedIcon=View.applyIconChoice(elements.iconChoices,icon);
    return selectedIcon;
  }
  function resetIcon(){return setIcon('record');}
  function setColor(color){
    selectedColor=View.applyColorChoice(elements.colorChoices,elements.createModal,color,colors);
    return selectedColor;
  }
  function resetColor(){return setColor(colors[0]);}
  function resetModalScroll(){
    var box=elements.createModal&&elements.createModal.querySelector('.shelf-modal-box');
    if(box)box.scrollTop=0;
  }
  function shouldAutofocus(){return !isMobile();}

  function closeCreate(){
    if(elements.createModal)elements.createModal.style.display='none';
    if(elements.nameInput)elements.nameInput.value='';
    if(elements.createStatus)elements.createStatus.textContent='';
    createReturnRecordIndex=-1;
    editingShelfId='';
    if(elements.createTitle)elements.createTitle.textContent='Create New Shelf';
    if(elements.createDescription)elements.createDescription.textContent='Give your shelf a name, icon and color.';
    if(elements.confirmCreate)elements.confirmCreate.textContent='Create Shelf';
    resetIcon();
    resetColor();
  }

  function openCreate(returnRecordIndex){
    if(viewedUserId()!==null)return false;
    if(getShelves().length>=maxShelves){
      if(returnRecordIndex>=0&&elements.pickerStatus)elements.pickerStatus.textContent='You can create up to '+maxShelves+' shelves.';
      return false;
    }
    editingShelfId='';
    createReturnRecordIndex=typeof returnRecordIndex==='number'?returnRecordIndex:-1;
    if(elements.nameInput)elements.nameInput.value='';
    if(elements.createStatus)elements.createStatus.textContent='';
    if(elements.createTitle)elements.createTitle.textContent='Create New Shelf';
    if(elements.createDescription)elements.createDescription.textContent='Give your shelf a name, icon and color.';
    if(elements.confirmCreate)elements.confirmCreate.textContent='Create Shelf';
    resetIcon();resetColor();
    if(elements.createModal)elements.createModal.style.display='flex';
    resetModalScroll();
    if(shouldAutofocus()&&elements.nameInput)setTimeout(function(){elements.nameInput.focus();},0);
    return true;
  }

  function openEdit(){
    var active=getActiveShelfId();
    if(viewedUserId()!==null||active==='all')return false;
    var shelf=shelfById(active);
    if(!shelf)return false;
    editingShelfId=String(shelf.id);
    createReturnRecordIndex=-1;
    if(elements.nameInput)elements.nameInput.value=String(shelf.name||'');
    if(elements.createStatus)elements.createStatus.textContent='';
    if(elements.createTitle)elements.createTitle.textContent='Edit Shelf';
    if(elements.createDescription)elements.createDescription.textContent='Change the shelf name, icon or color.';
    if(elements.confirmCreate)elements.confirmCreate.textContent='Save Changes';
    setIcon(shelf.icon||'record');setColor(shelf.color||colors[0]);
    if(elements.createModal)elements.createModal.style.display='flex';
    resetModalScroll();
    if(shouldAutofocus()&&elements.nameInput)setTimeout(function(){elements.nameInput.focus();elements.nameInput.select();},0);
    return true;
  }

  function closePicker(){
    if(elements.pickerModal)elements.pickerModal.style.display='none';
    pickerRecordIndex=-1;
    if(elements.pickerStatus)elements.pickerStatus.textContent='';
  }

  function renderPicker(index){
    var record=getRecords()[index];
    if(!record)return false;
    var current=String(Record.shelfId(record)||'');
    var title=Record.title(record)||'record';
    if(elements.pickerTitle)elements.pickerTitle.textContent=current?'Move to Shelf':'Add to Shelf';
    if(elements.pickerSubtitle)elements.pickerSubtitle.textContent=current
      ?'Choose a new shelf for “'+title+'”.'
      :'Choose a shelf for “'+title+'”.';
    if(elements.pickerList){
      elements.pickerList.innerHTML=View.pickerMarkup({shelves:getShelves(),currentShelfId:current,colors:colors});
      elements.pickerList.querySelectorAll('input[name="recordShelf"]').forEach(function(input){
        input.addEventListener('change',function(){View.syncPickerSelection(elements.pickerList);});
      });
    }
    if(elements.createFromPicker){
      elements.createFromPicker.disabled=getShelves().length>=maxShelves;
      elements.createFromPicker.textContent=getShelves().length>=maxShelves?maxShelves+' shelf limit reached':'+ New Shelf';
    }
    return true;
  }

  function openPicker(index){
    if(viewedUserId()!==null||libraryView()==='wishlist'||!getRecords()[index])return false;
    pickerRecordIndex=index;
    if(elements.pickerStatus)elements.pickerStatus.textContent='';
    renderPicker(index);
    if(elements.pickerModal)elements.pickerModal.style.display='flex';
    return true;
  }

  function renderDetailStatus(index){
    if(!elements.detailStatus)return;
    var record=getRecords()[index];
    View.renderDetailStatus(elements.detailStatus,{
      record:record,
      shelf:record?shelfById(Record.shelfId(record)):null,
      isWishlist:libraryView()==='wishlist'
    });
  }

  function renderDetailActions(index){
    if(!elements.detailActions)return;
    var record=getRecords()[index];
    var canEdit=!!record&&viewedUserId()===null&&libraryView()!=='wishlist';
    if(!canEdit){
      elements.detailActions.hidden=true;
      elements.detailActions.innerHTML='';
      return;
    }
    elements.detailActions.hidden=false;
    elements.detailActions.innerHTML=View.detailActionsMarkup(!!Record.shelfId(record));
    var pick=elements.detailActions.querySelector('[data-detail-shelf-action="pick"]');
    if(pick)pick.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();openPicker(index);});
    var remove=elements.detailActions.querySelector('[data-detail-shelf-action="remove"]');
    if(remove)remove.addEventListener('click',async function(event){
      event.preventDefault();event.stopPropagation();remove.disabled=true;
      try{await assignRecord(index,null);renderDetailActions(index);}
      catch(error){report('error','Kunde inte ta bort albumet från shelf:',error);showAlert('Could not remove the record from the shelf.\n\n'+(error.message||error));remove.disabled=false;}
    });
  }

  function refreshDetail(index){
    if(detailOpenIndex()===index){renderDetailStatus(index);renderDetailActions(index);}
  }

  async function assignRecord(index,shelfId){
    var records=getRecords();
    var record=records[index];
    if(!record||viewedUserId()!==null)return false;
    var user=await sessionUser();
    if(!user)throw new Error('Du måste vara inloggad.');
    var normalized=shelfId||null;
    var old=Record.shelfId(record)||'';
    if(String(old||'')===String(normalized||''))return true;
    var snapshot=records.map(function(item){return {record:item,shelfId:Record.shelfId(item)||'',shelfOrder:Record.shelfSortOrder(item)==null?null:Record.shelfSortOrder(item)};});
    var nextOrder=normalized?Record.nextShelfOrder(records,normalized,record):null;
    Record.setShelf(record,normalized||'',nextOrder);
    if(old&&String(old)!==String(normalized||''))Record.compactShelfOrder(records,old);
    resetLibraryPage();renderStrip();renderGrid();refreshDetail(index);
    try{
      var result=await api.rpc('move_collection_to_shelf',{p_collection_id:String(Record.entryId(record)),p_shelf_id:normalized});
      if(result.error)throw result.error;
      if(result.data&&result.data.shelf_sort_order!=null)Record.setValue(record,'shelfSortOrder',parseInt(result.data.shelf_sort_order,10)||Record.shelfSortOrder(record));
      else if(!normalized)Record.setValue(record,'shelfSortOrder',null);
      return true;
    }catch(error){
      snapshot.forEach(function(item){Record.setShelf(item.record,item.shelfId,item.shelfOrder);});
      renderStrip();renderGrid();refreshDetail(index);
      throw error;
    }
  }

  async function confirmCreate(){
    var shelves=getShelves();
    var editing=editingShelfId?shelfById(editingShelfId):null;
    if(!editing&&shelves.length>=maxShelves){if(elements.createStatus)elements.createStatus.textContent='You can create up to '+maxShelves+' shelves.';return false;}
    var name=elements.nameInput?elements.nameInput.value.trim():'';
    if(!name){if(elements.createStatus)elements.createStatus.textContent='Enter a shelf name.';if(elements.nameInput)elements.nameInput.focus();return false;}
    if(name.length>30){if(elements.createStatus)elements.createStatus.textContent='Use 30 characters or fewer.';return false;}
    if(shelves.some(function(shelf){return (!editing||String(shelf.id)!==String(editing.id))&&String(shelf.name).toLocaleLowerCase()===name.toLocaleLowerCase();})){
      if(elements.createStatus)elements.createStatus.textContent='You already have a shelf with that name.';return false;
    }
    if(elements.confirmCreate)elements.confirmCreate.disabled=true;
    if(elements.createStatus)elements.createStatus.textContent=editing?'Saving…':'Creating…';
    try{
      var user=await sessionUser();
      if(!user)throw new Error('Du måste vara inloggad.');
      if(editing){
        var updateResult=await api.from('shelves').update({name:name,icon:selectedIcon,color:selectedColor}).eq('id',editing.id).eq('user_id',user.id).select('id,user_id,name,icon,color,sort_order,created_at').single();
        if(updateResult.error)throw updateResult.error;
        setShelves(shelves.map(function(shelf){return String(shelf.id)===String(updateResult.data.id)?updateResult.data:shelf;}));
        closeCreate();renderStrip();renderGrid();return true;
      }
      var createResult=await api.from('shelves').insert({user_id:user.id,name:name,icon:selectedIcon,color:selectedColor,sort_order:shelves.length+1}).select('id,user_id,name,icon,color,sort_order,created_at').single();
      if(createResult.error)throw createResult.error;
      var nextShelves=shelves.slice();nextShelves.push(createResult.data);nextShelves.sort(function(a,b){return (a.sort_order||0)-(b.sort_order||0);});setShelves(nextShelves);
      var returnIndex=createReturnRecordIndex;
      closeCreate();
      if(returnIndex>=0&&getRecords()[returnIndex]){await assignRecord(returnIndex,createResult.data.id);refreshDetail(returnIndex);}
      else{setActiveShelfId(createResult.data.id);resetLibraryPage();renderStrip();renderGrid();}
      return true;
    }catch(error){
      report('error',editing?'Kunde inte uppdatera shelf:':'Kunde inte skapa shelf:',error);
      if(elements.createStatus)elements.createStatus.textContent=editing?'Could not update shelf.':'Could not create shelf.';
      return false;
    }finally{if(elements.confirmCreate)elements.confirmCreate.disabled=false;}
  }

  function closeDelete(){if(elements.deleteModal)elements.deleteModal.style.display='none';if(elements.deleteStatus)elements.deleteStatus.textContent='';}
  function openDelete(){
    var active=getActiveShelfId();
    if(viewedUserId()!==null||active==='all')return false;
    var shelf=shelfById(active);if(!shelf)return false;
    var count=recordCount(shelf.id);
    if(elements.deleteStatus)elements.deleteStatus.textContent='';
    if(elements.deleteMessage)elements.deleteMessage.textContent='Delete “'+shelf.name+'”? '+count+' record'+(count===1?'':'s')+' will stay in All Records and become unshelved.';
    if(elements.deleteModal)elements.deleteModal.style.display='flex';
    return true;
  }
  async function deleteActive(){
    var active=getActiveShelfId();
    if(viewedUserId()!==null||active==='all')return false;
    var shelf=shelfById(active);if(!shelf)return false;
    if(elements.confirmDelete)elements.confirmDelete.disabled=true;
    if(elements.deleteStatus)elements.deleteStatus.textContent='Deleting…';
    try{
      var user=await sessionUser();if(!user)throw new Error('Du måste vara inloggad.');
      var result=await api.rpc('delete_shelf_and_unshelve',{p_shelf_id:shelf.id});if(result.error)throw result.error;
      getRecords().forEach(function(record){if(String(Record.shelfId(record)||'')===String(shelf.id))Record.setShelf(record,'',null);});
      setShelves(getShelves().filter(function(item){return String(item.id)!==String(shelf.id);}));
      setActiveShelfId('all');resetLibraryPage();closeDelete();renderStrip();renderGrid();return true;
    }catch(error){report('error','Kunde inte radera shelf:',error);if(elements.deleteStatus)elements.deleteStatus.textContent='Could not delete shelf.';return false;}
    finally{if(elements.confirmDelete)elements.confirmDelete.disabled=false;}
  }

  async function confirmPicker(){
    if(pickerRecordIndex<0)return false;
    var selected=elements.pickerList&&elements.pickerList.querySelector('input[name="recordShelf"]:checked');
    if(!selected){if(elements.pickerStatus)elements.pickerStatus.textContent='Choose a shelf.';return false;}
    var index=pickerRecordIndex;
    if(elements.confirmPicker)elements.confirmPicker.disabled=true;
    if(elements.pickerStatus)elements.pickerStatus.textContent='Saving…';
    try{await assignRecord(index,selected.value);refreshDetail(index);closePicker();return true;}
    catch(error){report('error','Kunde inte flytta albumet till shelf:',error);if(elements.pickerStatus)elements.pickerStatus.textContent='Could not save shelf.';return false;}
    finally{if(elements.confirmPicker)elements.confirmPicker.disabled=false;}
  }

  function bind(){
    View.renderIconChoices(elements.iconChoices);resetColor();
    if(elements.iconChoices)elements.iconChoices.addEventListener('click',function(event){var button=event.target.closest('.shelf-icon-choice');if(button)setIcon(button.getAttribute('data-icon')||'record');});
    if(elements.colorChoices)elements.colorChoices.addEventListener('click',function(event){var button=event.target.closest('.shelf-color-choice');if(button)setColor(button.getAttribute('data-color'));});
    if(elements.closeCreate)elements.closeCreate.addEventListener('click',closeCreate);
    if(elements.cancelCreate)elements.cancelCreate.addEventListener('click',closeCreate);
    if(elements.createModal)elements.createModal.addEventListener('click',function(event){if(event.target===elements.createModal)closeCreate();});
    if(elements.confirmCreate)elements.confirmCreate.addEventListener('click',confirmCreate);
    if(elements.editButton)elements.editButton.addEventListener('click',openEdit);
    if(elements.deleteButton)elements.deleteButton.addEventListener('click',openDelete);
    if(elements.closeDelete)elements.closeDelete.addEventListener('click',closeDelete);
    if(elements.cancelDelete)elements.cancelDelete.addEventListener('click',closeDelete);
    if(elements.confirmDelete)elements.confirmDelete.addEventListener('click',deleteActive);
    if(elements.deleteModal)elements.deleteModal.addEventListener('click',function(event){if(event.target===elements.deleteModal)closeDelete();});
    if(elements.scrollLeft)elements.scrollLeft.addEventListener('click',function(){elements.stripScroll.scrollBy({left:-Math.max(260,elements.stripScroll.clientWidth*.65),behavior:'smooth'});});
    if(elements.scrollRight)elements.scrollRight.addEventListener('click',function(){elements.stripScroll.scrollBy({left:Math.max(260,elements.stripScroll.clientWidth*.65),behavior:'smooth'});});
    if(elements.stripScroll)elements.stripScroll.addEventListener('scroll',updateScrollArrows,{passive:true});
    if(elements.closePicker)elements.closePicker.addEventListener('click',closePicker);
    if(elements.cancelPicker)elements.cancelPicker.addEventListener('click',closePicker);
    if(elements.pickerModal)elements.pickerModal.addEventListener('click',function(event){if(event.target===elements.pickerModal)closePicker();});
    if(elements.createFromPicker)elements.createFromPicker.addEventListener('click',function(){var index=pickerRecordIndex;closePicker();openCreate(index);});
    if(elements.confirmPicker)elements.confirmPicker.addEventListener('click',confirmPicker);
    if(elements.nameInput)elements.nameInput.addEventListener('keydown',function(event){if(event.key==='Enter'&&elements.confirmCreate)elements.confirmCreate.click();});
  }

  bind();
  return Object.freeze({
    renderStrip:renderStrip,updateScrollArrows:updateScrollArrows,loadForUser:loadForUser,
    openCreate:openCreate,closeCreate:closeCreate,openEdit:openEdit,
    openPicker:openPicker,closePicker:closePicker,renderPicker:renderPicker,
    renderDetailStatus:renderDetailStatus,renderDetailActions:renderDetailActions,
    assignRecord:assignRecord,openDelete:openDelete,closeDelete:closeDelete,deleteActive:deleteActive,
    confirmCreate:confirmCreate,confirmPicker:confirmPicker,
    state:function(){return {loadedUserId:loadedUserId,pickerRecordIndex:pickerRecordIndex,createReturnRecordIndex:createReturnRecordIndex,editingShelfId:editingShelfId,selectedIcon:selectedIcon,selectedColor:selectedColor};}
  });
}

return Object.freeze({create:create});
});
