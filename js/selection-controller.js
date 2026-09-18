(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovySelectionController=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function create(options){
  options=options||{};
  var elements=options.elements||{};
  var recordModel=options.recordModel;
  var getRecords=typeof options.getRecords==='function'?options.getRecords:function(){return [];};
  var canActivate=typeof options.canActivate==='function'?options.canActivate:function(){return true;};
  var getContext=typeof options.getContext==='function'?options.getContext:function(){return {};};
  var onModeChange=typeof options.onModeChange==='function'?options.onModeChange:function(){};
  var onMove=typeof options.onMove==='function'?options.onMove:function(){};
  var onRemoveShelf=typeof options.onRemoveShelf==='function'?options.onRemoveShelf:function(){};
  var onAddToCollection=typeof options.onAddToCollection==='function'?options.onAddToCollection:function(){};
  var onDelete=typeof options.onDelete==='function'?options.onDelete:function(){};
  var selected=new Set();
  var active=false;

  if(!recordModel||typeof recordModel.entryId!=='function')throw new Error('Selection controller requires record model');

  function normalizeId(value){return String(value==null?'':value).trim();}
  function recordId(record){return normalizeId(record&&recordModel.entryId(record));}

  function prune(){
    var valid=new Set((getRecords()||[]).map(recordId).filter(Boolean));
    Array.from(selected).forEach(function(id){if(!valid.has(id))selected.delete(id);});
  }

  function selectedIds(){prune();return Array.from(selected);}

  function syncChrome(){
    var context=getContext()||{};
    var isWishlist=context.libraryView==='wishlist';
    var isShelf=!isWishlist&&String(context.activeShelfId||'all')!=='all';

    if(elements.body&&elements.body.classList)elements.body.classList.toggle('selection-mode-active',active);
    if(elements.selectButton){
      elements.selectButton.classList.toggle('active',active);
      elements.selectButton.setAttribute('aria-pressed',active?'true':'false');
    }
    if(elements.actionBar)elements.actionBar.hidden=!active;
    if(elements.count)elements.count.textContent=selected.size+' selected';

    if(elements.moveButton)elements.moveButton.hidden=isWishlist;
    if(elements.removeShelfButton)elements.removeShelfButton.hidden=!isShelf;
    if(elements.addCollectionButton)elements.addCollectionButton.hidden=!isWishlist;

    var disabled=!active||selected.size===0;
    if(elements.moveButton)elements.moveButton.disabled=disabled;
    if(elements.removeShelfButton)elements.removeShelfButton.disabled=disabled;
    if(elements.addCollectionButton)elements.addCollectionButton.disabled=disabled;
    if(elements.deleteButton)elements.deleteButton.disabled=disabled;
  }

  function syncCards(){
    prune();
    if(elements.collection&&elements.collection.querySelectorAll){
      elements.collection.querySelectorAll('.record[data-entry-id]').forEach(function(card){
        var id=normalizeId(card.getAttribute('data-entry-id'));
        var isSelected=active&&selected.has(id);
        if(card.classList)card.classList.toggle('selected',isSelected);
        var toggle=card.querySelector&&card.querySelector('[data-record-select]');
        if(toggle){
          toggle.setAttribute('aria-pressed',isSelected?'true':'false');
          toggle.setAttribute('aria-label',(isSelected?'Deselect ':'Select ')+(toggle.getAttribute('data-record-title')||'record'));
        }
      });
    }
    syncChrome();
  }

  function setActive(next,config){
    next=!!next;
    config=config||{};
    if(next&&!canActivate())return false;
    var changed=active!==next;
    active=next;
    if(!active)selected.clear();
    syncCards();
    if(changed&&!config.silent)onModeChange(active);
    return active;
  }

  function activate(){return setActive(true);}
  function deactivate(config){setActive(false,config);return true;}

  function toggleIndex(index){
    if(!active)return false;
    var record=(getRecords()||[])[index];
    var id=recordId(record);
    if(!id)return false;
    if(selected.has(id))selected.delete(id);
    else selected.add(id);
    syncCards();
    return selected.has(id);
  }

  function requestMove(){
    var ids=selectedIds();
    if(!active||!ids.length)return false;
    return onMove(ids)!==false;
  }

  function requestRemoveShelf(){
    var ids=selectedIds();
    if(!active||!ids.length)return false;
    return onRemoveShelf(ids)!==false;
  }

  function requestAddToCollection(){
    var ids=selectedIds();
    if(!active||!ids.length)return false;
    return onAddToCollection(ids)!==false;
  }

  function requestDelete(){
    var ids=selectedIds();
    if(!active||!ids.length)return false;
    return onDelete(ids)!==false;
  }

  if(elements.selectButton)elements.selectButton.addEventListener('click',function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    setActive(!active);
  });
  if(elements.cancelButton)elements.cancelButton.addEventListener('click',function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    deactivate();
  });
  if(elements.moveButton)elements.moveButton.addEventListener('click',function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    requestMove();
  });
  if(elements.removeShelfButton)elements.removeShelfButton.addEventListener('click',function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    requestRemoveShelf();
  });
  if(elements.addCollectionButton)elements.addCollectionButton.addEventListener('click',function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    requestAddToCollection();
  });
  if(elements.deleteButton)elements.deleteButton.addEventListener('click',function(event){
    if(event){event.preventDefault();event.stopPropagation();}
    requestDelete();
  });

  syncChrome();

  return Object.freeze({
    activate:activate,
    deactivate:deactivate,
    isActive:function(){return active;},
    toggleIndex:toggleIndex,
    selectedIds:selectedIds,
    syncCards:syncCards,
    requestMove:requestMove,
    requestRemoveShelf:requestRemoveShelf,
    requestAddToCollection:requestAddToCollection,
    requestDelete:requestDelete
  });
}

return Object.freeze({create:create});
});
