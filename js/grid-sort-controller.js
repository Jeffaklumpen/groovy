(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyGridSortController=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function create(options){
  options=options||{};
  var api=options.api;
  var win=options.window;
  var doc=options.document;
  var navigatorObject=options.navigator||{};
  var collection=options.collection;
  var recordModel=options.recordModel;
  var recordsPerPage=parseInt(options.recordsPerPage,10)||52;
  var getRecords=typeof options.getRecords==='function'?options.getRecords:function(){return [];};
  var setRecords=typeof options.setRecords==='function'?options.setRecords:function(){};
  var getState=typeof options.getState==='function'?options.getState:function(){return {};};
  var setSuppressAlbumClick=typeof options.setSuppressAlbumClick==='function'?options.setSuppressAlbumClick:function(){};
  var setDeleteMode=typeof options.setDeleteMode==='function'?options.setDeleteMode:function(){};
  var renderGrid=typeof options.renderGrid==='function'?options.renderGrid:function(){};
  var loadCollection=typeof options.loadCollection==='function'?options.loadCollection:async function(){};
  var onAlert=typeof options.onAlert==='function'?options.onAlert:function(){};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};

  if(!api||typeof api.rpc!=='function')throw new Error('Grid sort controller requires Supabase');
  if(!win||!doc||!collection)throw new Error('Grid sort controller requires browser elements');
  if(!recordModel)throw new Error('Grid sort controller requires record model');

  var window=win;
  var document=doc;
  var navigator=navigatorObject;
  var requestAnimationFrame=typeof options.requestAnimationFrame==='function'?options.requestAnimationFrame:function(fn){return win.requestAnimationFrame(fn);};
  var cancelAnimationFrame=typeof options.cancelAnimationFrame==='function'?options.cancelAnimationFrame:function(id){return win.cancelAnimationFrame(id);};
  var setTimeout=typeof options.setTimeout==='function'?options.setTimeout:function(fn,delay){return win.setTimeout(fn,delay);};
  var clearTimeout=typeof options.clearTimeout==='function'?options.clearTimeout:function(id){return win.clearTimeout(id);};

  function log(level,message,error){onLog(level,message,error);}

var pendingGridOrderSaves=new Map();
var gridOrderSaveRunning=false;
var gridOrderSaveErrorShown=false;
var removeWindowListeners=null;

function saveKey(job){
  if(job.kind==='wishlist')return 'wishlist';
  return 'collection|'+String(job.shelfId||'all');
}

function queueSave(job){
  pendingGridOrderSaves.set(saveKey(job),job);
  if(gridOrderSaveRunning)return Promise.resolve(false);
  return flushSaveQueue();
}

async function flushSaveQueue(){
  if(gridOrderSaveRunning)return false;
  gridOrderSaveRunning=true;

  while(pendingGridOrderSaves.size){
    var nextEntry=pendingGridOrderSaves.entries().next().value;
    var jobKey=nextEntry[0];
    var job=nextEntry[1];
    pendingGridOrderSaves.delete(jobKey);

    var result;

    if(job.kind==='wishlist'){
      result=await api.rpc('set_wishlist_display_order',{
        p_wishlist_ids:job.ids
      });
    }else{
      result=await api.rpc('set_collection_display_order',{
        p_shelf_id:job.shelfId||null,
        p_collection_ids:job.ids
      });
    }

    if(result.error){
      log('error','Kunde inte spara sorteringen:',result.error);
      pendingGridOrderSaves.clear();

      if(!gridOrderSaveErrorShown){
        gridOrderSaveErrorShown=true;
        onAlert('Kunde inte spara den nya ordningen. Samlingen laddas om så att inget hamnar fel.');
      }

      await loadCollection();
      break;
    }

    gridOrderSaveErrorShown=false;
  }

  gridOrderSaveRunning=false;

  if(pendingGridOrderSaves.size)return flushSaveQueue();
  return true;
}


function commitDomOrder(){
  var state=getState()||{};
  var records=getRecords();
  var libraryPage=parseInt(state.page,10)||1;
  var activeShelfId=state.activeShelfId||'all';
  var libraryView=state.libraryView||'collection';
    var orderedCards=collection.querySelectorAll('.record');
    var reorderedPage=[];

    for(var i=0;i<orderedCards.length;i++){
      var index=parseInt(orderedCards[i].getAttribute('data-index'),10);
      var record=records[index];

      if(!record)continue;
      reorderedPage.push(record);
    }

    var pageStart=(libraryPage-1)*recordsPerPage;

    if(libraryView==='wishlist'||activeShelfId==='all'){
      var orderedList=records
        .slice()
        .sort(function(a,b){return (parseInt(recordModel.order(a),10)||0)-(parseInt(recordModel.order(b),10)||0);});

      orderedList.splice.apply(
        orderedList,
        [pageStart,reorderedPage.length].concat(reorderedPage)
      );

      records=orderedList;
      setRecords(orderedList);
      records.forEach(function(record,index){record[recordModel.INDEX.order]=index+1;});

      var allOrderIds=records
        .filter(function(record){return record&&recordModel.entryId(record);})
        .map(function(record){return String(recordModel.entryId(record));});

      renderGrid();
      queueSave({
        kind:libraryView==='wishlist'?'wishlist':'collection',
        shelfId:null,
        ids:allOrderIds
      });
      return;
    }

    var shelfList=records
      .filter(function(record){return String(recordModel.shelfId(record)||'')===String(activeShelfId);})
      .sort(function(a,b){
        var aOrder=parseInt(recordModel.shelfSortOrder(a),10);
        var bOrder=parseInt(recordModel.shelfSortOrder(b),10);
        if(isNaN(aOrder))aOrder=2147483647;
        if(isNaN(bOrder))bOrder=2147483647;
        return aOrder-bOrder||(parseInt(recordModel.order(a),10)||0)-(parseInt(recordModel.order(b),10)||0);
      });

    shelfList.splice.apply(
      shelfList,
      [pageStart,reorderedPage.length].concat(reorderedPage)
    );
    shelfList.forEach(function(record,index){record[recordModel.INDEX.shelfSortOrder]=index+1;});

    var shelfOrderIds=shelfList
      .filter(function(record){return record&&recordModel.entryId(record);})
      .map(function(record){return String(recordModel.entryId(record));});

    renderGrid();
    queueSave({
      kind:'collection',
      shelfId:activeShelfId,
      ids:shelfOrderIds
    });
  }

function enable(){
    if(removeWindowListeners){
      removeWindowListeners();
      removeWindowListeners=null;
    }

    var state=getState()||{};
    var records=getRecords();
    var viewedUserId=state.viewedUserId;
    var selectedRating=state.selectedRating;
    var librarySearchQuery=state.searchQuery||'';
    var librarySort=state.sort||'added';
    var libraryPage=parseInt(state.page,10)||1;
    var activeShelfId=state.activeShelfId||'all';
    var libraryView=state.libraryView||'collection';
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

  async function finishDrag(){
    commitDomOrder();
  }

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

  function handleWindowBlur(){
    if(dragged){
      dragged.classList.remove('dragging');
      dragged=null;
    }

    removeDragPreview();
    touchDragging=false;
    resetPointerState();
    resetTouchState();
  }

  window.addEventListener('blur',handleWindowBlur);
  removeWindowListeners=function(){
    window.removeEventListener('blur',handleWindowBlur);
  };

  function findTouch(touchList,id){
    for(var i=0;i<touchList.length;i++){
      if(touchList[i].identifier===id)return touchList[i];
    }

    return null;
  }

  function startPointerDrag(card,event){
    dragged=card;
    touchDragging=true;
    setSuppressAlbumClick(true);
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
      setSuppressAlbumClick(false);
      return;
    }

    var releasedDragged=dragged;

    releasedDragged.classList.remove('dragging');
    removeDragPreview();
    dragged=null;
    touchDragging=false;
    resetPointerState();
    resetTouchState();

    setSuppressAlbumClick(true);
    await finishDrag();

    setTimeout(function(){
      setSuppressAlbumClick(false);
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
    setSuppressAlbumClick(false);
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
        setSuppressAlbumClick(true);
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
          setSuppressAlbumClick(false);
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



  return Object.freeze({
    enable:enable,
    commitDomOrder:commitDomOrder,
    queueSave:queueSave,
    flushSaveQueue:flushSaveQueue,
    saveKey:saveKey
  });
}

return Object.freeze({create:create});
});
