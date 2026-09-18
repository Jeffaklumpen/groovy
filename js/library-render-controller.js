(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyLibraryRenderController=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function create(options){
  options=options||{};

  var win=options.window;
  var doc=options.document;
  var core=options.libraryCore;
  var recordModel=options.recordModel;
  var pressingView=options.pressingView;
  var ratingRenderer=options.ratingRenderer;
  var elements=options.elements||{};
  var getState=typeof options.getState==='function'?options.getState:function(){return {};};
  var setPage=typeof options.setPage==='function'?options.setPage:function(){};
  var setSearchQuery=typeof options.setSearchQuery==='function'?options.setSearchQuery:function(){};
  var shelfById=typeof options.shelfById==='function'?options.shelfById:function(){return null;};
  var shelfIconSvg=typeof options.shelfIconSvg==='function'?options.shelfIconSvg:function(){return '';};
  var escapeHtml=typeof options.escapeHtml==='function'?options.escapeHtml:function(value){return String(value==null?'':value);};
  var spotifyAlbumLink=typeof options.spotifyAlbumLink==='function'?options.spotifyAlbumLink:function(){return '#';};
  var appleMusicAlbumLink=typeof options.appleMusicAlbumLink==='function'?options.appleMusicAlbumLink:function(){return '#';};
  var renderShelfStrip=typeof options.renderShelfStrip==='function'?options.renderShelfStrip:function(){};
  var updateLibraryTabLabels=typeof options.updateLibraryTabLabels==='function'?options.updateLibraryTabLabels:function(){};
  var shouldShowLoggedOutLanding=typeof options.shouldShowLoggedOutLanding==='function'?options.shouldShowLoggedOutLanding:function(){return false;};
  var renderLoggedOutLanding=typeof options.renderLoggedOutLanding==='function'?options.renderLoggedOutLanding:function(){};
  var restoreEmptyCollectionMarkup=typeof options.restoreEmptyCollectionMarkup==='function'?options.restoreEmptyCollectionMarkup:function(){};
  var attachWishlistRemoveControls=typeof options.attachWishlistRemoveControls==='function'?options.attachWishlistRemoveControls:function(){};
  var attachRecordActionMenus=typeof options.attachRecordActionMenus==='function'?options.attachRecordActionMenus:function(){};
  var attachAlbumClicks=typeof options.attachAlbumClicks==='function'?options.attachAlbumClicks:function(){};
  var enableGridSorting=typeof options.enableGridSorting==='function'?options.enableGridSorting:function(){};
  var onRendered=typeof options.onRendered==='function'?options.onRendered:function(){};
  var recordsPerPage=parseInt(options.recordsPerPage,10)||52;
  var imageLoadScheduled=false;

  if(!win||!doc)throw new Error('Library render controller requires window and document');
  if(!core)throw new Error('Library render controller requires library core');
  if(!recordModel)throw new Error('Library render controller requires record model');
  if(!pressingView)throw new Error('Library render controller requires pressing view');
  if(!ratingRenderer)throw new Error('Library render controller requires rating renderer');

  var collection=elements.collection;
  if(!collection)throw new Error('Library render controller requires collection element');

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

  function displayNumber(record,state){
    if(
      state.libraryView!=='wishlist'&&
      state.activeShelfId!=='all'&&
      String(recordModel.shelfId(record)||'')===String(state.activeShelfId)
    ){
      var shelfNumber=parseInt(recordModel.shelfSortOrder(record),10);
      if(!isNaN(shelfNumber)&&shelfNumber>0)return shelfNumber;
    }

    var allRecordsNumber=parseInt(recordModel.order(record),10);
    return !isNaN(allRecordsNumber)&&allRecordsNumber>0?allRecordsNumber:'';
  }

  function recordHTML(record,className,state){
    var records=state.records||[];
    var smallSrc=recordModel.coverUrl(record);
    var isWishlist=state.libraryView==='wishlist';
    var recordIndex=records.indexOf(record);
    var copy=recordModel.pressing(record)||{};
    var condition=!isWishlist?pressingView.conditionMeta(copy.mediaCondition):null;
    var showPressingPrompt=!isWishlist&&state.viewedUserId===null&&!condition&&!pressingView.hasCopyDetails(copy);
    var cardShelf=!isWishlist?shelfById(recordModel.shelfId(record)):null;
    var cardShelfName=cardShelf&&cardShelf.name?cardShelf.name:'';
    var cardShelfIcon=cardShelf?shelfIconSvg(cardShelf.icon):'';
    var cardShelfStatus=cardShelf
      ?'<span class="record-shelf-status" title="'+escapeHtml(cardShelfName)+'">'+
         (cardShelfIcon?'<span class="record-shelf-status-icon" aria-hidden="true">'+cardShelfIcon+'</span>':'')+
         '<strong>'+escapeHtml(cardShelfName)+'</strong>'+
       '</span>'
      :'';
    var canSelect=state.viewedUserId===null&&!isWishlist;
    var entryId=String(recordModel.entryId(record)||'');
    var selectToggle=canSelect
      ?'<button class="record-select-toggle" type="button" data-record-select data-record-title="'+escapeHtml(recordModel.title(record))+'" aria-pressed="false" aria-label="Select '+escapeHtml(recordModel.title(record))+'"><span aria-hidden="true">✓</span></button>'
      :'';
    var removeButton=state.viewedUserId===null
      ?(isWishlist
        ?'<button class="wishlist-remove-button" type="button" aria-label="Remove from wishlist">×</button>'
        :'<button class="record-menu-button" type="button" aria-label="Record menu" aria-expanded="false">•••</button>'+
         '<div class="record-action-menu">'+
           '<button class="record-action-item" type="button" data-action="view">View Record</button>'+
           '<button class="record-action-item" type="button" data-action="shelf">'+(recordModel.shelfId(record)?'Move to Shelf':'Add to Shelf')+'</button>'+
           (recordModel.shelfId(record)?'<button class="record-action-item" type="button" data-action="unshelf">Remove from Shelf</button>':'')+
           '<button class="record-action-item danger" type="button" data-action="delete">Delete Record</button>'+
         '</div>')
      :'';

    var html='<article class="record '+(isWishlist?'wishlist-record ':'')+(className||'')+'" draggable="false" data-index="'+recordIndex+'" data-entry-id="'+escapeHtml(entryId)+'">'+
      '<div class="record-card-topbar"><span class="number">'+displayNumber(record,state)+'</span>'+cardShelfStatus+removeButton+'</div>'+
      '<div class="cover-wrapper">'+selectToggle+
        '<img class="cover" draggable="false" loading="lazy" decoding="async" src="" data-src="'+escapeHtml(smallSrc)+'" alt="'+escapeHtml(recordModel.artist(record)+' - '+recordModel.title(record))+'">'+
      '</div>'+
      '<div class="info">'+
        '<div class="record-heading-row"><div class="album">'+escapeHtml(recordModel.title(record))+'</div></div>'+
        '<div class="artist">'+escapeHtml(recordModel.artist(record))+'</div>'+
        '<div class="record-meta-row"><span class="year">'+escapeHtml(recordModel.year(record))+'</span>'+
        (condition?'<span class="record-condition-badge condition-'+condition.className+'" title="Record condition: '+escapeHtml(condition.label)+'">'+escapeHtml(copy.mediaCondition)+'</span>':'')+
        (showPressingPrompt?'<span class="pressing-prompt-badge" title="Add pressing details">Add pressing</span>':'')+
        '<span class="cover-rating">';

    html+=ratingRenderer.renderGridRating(recordModel.ownRating(record)||0);

    html+='</span></div></div>'+
      (isWishlist&&state.viewedUserId===null
        ?'<button class="move-to-collection-button" type="button"><span class="record-icon" aria-hidden="true"></span>Add to collection</button>'
        :'')+
      '<div class="record-card-footer">'+
        '<a class="streaming-link streaming-service apple-service" href="'+escapeHtml(appleMusicAlbumLink(record))+'" target="_blank" rel="noopener noreferrer" aria-label="Listen to '+escapeHtml(recordModel.title(record))+' by '+escapeHtml(recordModel.artist(record))+' on Apple Music">'+
          '<img class="apple-music-small-badge" src="/assets/brands/apple-music-badge-small.svg" alt="Listen on Apple Music">'+
        '</a>'+
        '<a class="streaming-link streaming-service spotify-service" href="'+escapeHtml(spotifyAlbumLink(record))+'" target="_blank" rel="noopener noreferrer" aria-label="Find '+escapeHtml(recordModel.title(record))+' by '+escapeHtml(recordModel.artist(record))+' on Spotify">'+
          '<img class="spotify-service-logo" src="/assets/brands/spotify-full-logo-green.svg" alt="Spotify">'+
        '</a>'+
      '</div>'+
    '</article>';

    return html;
  }

  function loadVisibleImages(){
    var images=doc.querySelectorAll('.cover');
    var height=win.innerHeight||600;
    var width=win.innerWidth||1024;
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

  function scheduleImageLoad(){
    if(imageLoadScheduled)return;
    imageLoadScheduled=true;
    var run=win.requestAnimationFrame||function(fn){return win.setTimeout(fn,50);};
    run(function(){
      imageLoadScheduled=false;
      loadVisibleImages();
    });
  }

  function renderPagination(totalItems,state){
    var totalPages=Math.max(1,Math.ceil(totalItems/recordsPerPage));
    var page=Math.max(1,Math.min(parseInt(state.page,10)||1,totalPages));
    if(page!==state.page)setPage(page);

    [elements.paginationTop,elements.paginationBottom].forEach(function(target){
      if(!target)return;
      if(totalPages<=1){
        target.innerHTML='';
        target.hidden=true;
        return;
      }
      target.hidden=false;
      target.innerHTML='<button type="button" data-page="'+(page-1)+'" aria-label="Previous page"'+(page===1?' disabled':'')+'>‹</button>'+
        paginationItems(page,totalPages).map(function(item){
          if(item==='…')return '<span class="pagination-ellipsis" aria-hidden="true">…</span>';
          return '<button type="button" data-page="'+item+'"'+(item===page?' class="active" aria-current="page"':'')+'>'+item+'</button>';
        }).join('')+
        '<button type="button" data-page="'+(page+1)+'" aria-label="Next page"'+(page===totalPages?' disabled':'')+'>›</button>';

      target.querySelectorAll('button[data-page]').forEach(function(button){
        button.addEventListener('click',function(){
          var nextPage=parseInt(button.getAttribute('data-page'),10);
          if(isNaN(nextPage)||nextPage<1||nextPage>totalPages||nextPage===page)return;
          setPage(nextPage);
          render();
          win.scrollTo({top:0,behavior:'smooth'});
        });
      });
    });

    return {page:page,totalPages:totalPages};
  }

  function render(){
    var state=getState()||{};
    var records=Array.isArray(state.records)?state.records:[];
    var isWishlist=state.libraryView==='wishlist';
    var hasBlockingState=!!state.loginRequiredForViewedCollection||!!state.profileNotFound;
    var isViewingProfile=state.viewedUserId!==null;
    var isOwnCollection=!isViewingProfile&&!hasBlockingState;
    var canShowAddAlbumCard=isOwnCollection&&!!state.hasAuthenticatedUser&&records.length>0;
    var activeShelf=(!isWishlist&&state.activeShelfId!=='all')?shelfById(state.activeShelfId):null;
    var showLoggedOutLanding=shouldShowLoggedOutLanding();

    collection.className='collection grid';
    renderShelfStrip();
    if(doc.body&&doc.body.classList)doc.body.classList.toggle('logged-out-home',showLoggedOutLanding);
    updateLibraryTabLabels();

    if(elements.libraryTitle){
      elements.libraryTitle.textContent=isWishlist
        ?(isViewingProfile?((state.viewedUsername||'User')+"'s Wishlist"):'My Wishlist')
        :(activeShelf?activeShelf.name:'All Records');
    }

    if(elements.searchInput){
      elements.searchInput.placeholder=showLoggedOutLanding
        ?'Search for an album, artist, or label...'
        :(isWishlist?'Search this wishlist...':'Search this shelf...');
      elements.searchInput.readOnly=showLoggedOutLanding;
    }
    if(elements.mobileAddRecordButton)elements.mobileAddRecordButton.style.display=isViewingProfile?'none':'';

    if(showLoggedOutLanding){
      setSearchQuery('');
      if(elements.searchInput)elements.searchInput.value='';
      renderLoggedOutLanding();
    }else{
      restoreEmptyCollectionMarkup();
    }

    if(elements.emptyCollection)elements.emptyCollection.style.display=((isOwnCollection&&!isWishlist&&records.length===0)||showLoggedOutLanding)?'flex':'none';
    if(elements.loginToViewCollection)elements.loginToViewCollection.style.display=state.loginRequiredForViewedCollection?'flex':'none';
    if(elements.profileNotFound)elements.profileNotFound.style.display=state.profileNotFound?'flex':'none';
    if(elements.emptyViewedCollection)elements.emptyViewedCollection.style.display=(isViewingProfile&&!isWishlist&&records.length===0&&!hasBlockingState)?'flex':'none';
    if(elements.emptyWishlist)elements.emptyWishlist.style.display=(isWishlist&&records.length===0&&!hasBlockingState)?'flex':'none';
    if(elements.emptyWishlistTitle)elements.emptyWishlistTitle.textContent=isViewingProfile?'Wishlist is empty':'Your wishlist is empty';
    if(elements.emptyWishlistText)elements.emptyWishlistText.textContent=isViewingProfile?"This user hasn't added any records yet.":'Save records you want to add next.';
    if(elements.emptyWishlistAddButton)elements.emptyWishlistAddButton.style.display=isViewingProfile?'none':'';
    if(elements.libraryTabs)elements.libraryTabs.style.display=(state.hasAuthenticatedUser||showLoggedOutLanding)?'flex':'none';

    if(elements.collectionTabButton){
      elements.collectionTabButton.classList.toggle('active',showLoggedOutLanding||(isOwnCollection&&!isWishlist));
      elements.collectionTabButton.setAttribute('aria-current',(showLoggedOutLanding||(isOwnCollection&&!isWishlist))?'page':'false');
    }
    if(elements.wishlistTabButton){
      elements.wishlistTabButton.classList.toggle('active',!!state.hasAuthenticatedUser&&isOwnCollection&&isWishlist);
      elements.wishlistTabButton.setAttribute('aria-current',(state.hasAuthenticatedUser&&isOwnCollection&&isWishlist)?'page':'false');
    }

    if(elements.addAlbumButton)elements.addAlbumButton.style.display=isViewingProfile?'none':'';
    if(elements.selectButton)elements.selectButton.hidden=!(isOwnCollection&&!isWishlist&&state.hasAuthenticatedUser&&records.length>0);
    if(elements.filterButton&&elements.filterButton.parentElement){
      elements.filterButton.parentElement.style.display=(isWishlist||showLoggedOutLanding)?'none':'';
    }

    var shelfRecords=records.filter(function(record){
      return isWishlist||state.activeShelfId==='all'||String(recordModel.shelfId(record)||'')===String(state.activeShelfId);
    });

    if(!isWishlist&&elements.collectionCount){
      elements.collectionCount.textContent=activeShelf
        ?shelfRecords.length+' RECORDS IN '+activeShelf.name.toLocaleUpperCase()
        :records.length+' RECORDS IN COLLECTION';
    }

    var visibleRecords=core.filterRecords(shelfRecords,{
      query:state.searchQuery,
      selectedRating:state.selectedRating,
      isWishlist:isWishlist
    });
    visibleRecords=core.sortRecords(visibleRecords,{
      sort:state.sort,
      isWishlist:isWishlist,
      activeShelfId:state.activeShelfId
    });

    var pagination=renderPagination(visibleRecords.length,state);
    var pageStart=(pagination.page-1)*recordsPerPage;
    var pageRecords=visibleRecords.slice(pageStart,pageStart+recordsPerPage);
    var html=pageRecords.map(function(record){return recordHTML(record,'',state);}).join('');

    if(!pageRecords.length&&records.length){
      html='<div class="library-no-results"><strong>'+
        (activeShelf&&shelfRecords.length===0?'This shelf is empty':'No records found')+
        '</strong><span>'+
        (activeShelf&&shelfRecords.length===0?'Use the record menu to add records to this shelf.':'Try another search or filter.')+
        '</span></div>';
    }

    if(canShowAddAlbumCard&&state.activeShelfId==='all'&&pagination.page===pagination.totalPages){
      html+='<button class="add-album-card" type="button" aria-label="Add record">'+
        '<span class="add-album-card-icon" aria-hidden="true">+</span>'+
        '<span class="add-album-card-title">Add Record</span>'+
        '<span class="add-album-card-text">'+(isWishlist?'The wishlist must grow':'The collection must grow')+'</span>'+
      '</button>';
    }

    collection.innerHTML=html;
    var addAlbumCard=collection.querySelector('.add-album-card');
    if(addAlbumCard&&elements.addAlbumButton){
      addAlbumCard.addEventListener('click',function(){elements.addAlbumButton.click();});
    }

    attachWishlistRemoveControls();
    attachRecordActionMenus();
    attachAlbumClicks();
    enableGridSorting();
    loadVisibleImages();
    onRendered();

    return {visibleRecords:visibleRecords,pageRecords:pageRecords,page:pagination.page,totalPages:pagination.totalPages};
  }

  return Object.freeze({
    render:render,
    recordHTML:function(record,className){return recordHTML(record,className,getState()||{});},
    paginationItems:paginationItems,
    loadVisibleImages:loadVisibleImages,
    scheduleImageLoad:scheduleImageLoad
  });
}

return Object.freeze({create:create});
});
