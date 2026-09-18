const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/library-render-controller.js');
const LibraryCore=require('../js/library-core.js');

function element(){
  return {
    innerHTML:'',textContent:'',hidden:false,readOnly:false,value:'',style:{},attrs:{},parentElement:{style:{}},listeners:{},
    classList:{values:new Set(),toggle(name,on){if(on)this.values.add(name);else this.values.delete(name);},contains(name){return this.values.has(name);}},
    setAttribute(name,value){this.attrs[name]=value;},addEventListener(name,fn){this.listeners[name]=fn;},querySelector(){return null;},querySelectorAll(){return [];}
  };
}
function recordModel(){
  const fields={order:0,artist:1,title:2,year:3,genre:4,coverUrl:6,albumId:8,entryId:9,pressing:11,shelfId:13,shelfSortOrder:14,communityRating:15};
  const model={};Object.keys(fields).forEach(name=>{model[name]=record=>record&&record[fields[name]];});return model;
}
function makeHarness(overrides){
  const collection=element();const paginationTop=element();const paginationBottom=element();const addAlbumButton=element();
  addAlbumButton.clickCount=0;addAlbumButton.click=function(){this.clickCount++;};
  const elements={collection,paginationTop,paginationBottom,searchInput:element(),mobileAddRecordButton:element(),emptyCollection:element(),loginToViewCollection:element(),profileNotFound:element(),emptyViewedCollection:element(),emptyWishlist:element(),emptyWishlistTitle:element(),emptyWishlistText:element(),emptyWishlistAddButton:element(),libraryTabs:element(),libraryTitle:element(),collectionTabButton:element(),wishlistTabButton:element(),addAlbumButton,filterButton:element(),collectionCount:element()};
  const doc={body:{classList:{toggle(){}}},querySelectorAll(){return [];}};
  const win={innerHeight:800,innerWidth:1200,requestAnimationFrame(fn){fn();},setTimeout(fn){fn();},scrollTo(){}};
  const baseRecord=[1,'Pink Floyd','The Wall','1979','Progressive Rock',0,'cover.jpg',{},1,'entry-1',10,{},null,'shelf-1',2,4.5];
  let state={records:[baseRecord],viewedUserId:null,libraryView:'collection',loginRequiredForViewedCollection:false,profileNotFound:false,hasAuthenticatedUser:true,viewedUsername:null,activeShelfId:'all',selectedRating:'all',searchQuery:'',sort:'added',page:1};
  if(overrides)Object.assign(state,overrides);
  const calls={page:[],search:[],hooks:0};
  const controller=Controller.create({
    window:win,document:doc,libraryCore:LibraryCore,recordModel:recordModel(),
    pressingView:{conditionMeta(value){return value?{className:'near-mint',label:'Near Mint'}:null;},hasCopyDetails(details){return !!(details&&details.country);}},
    ratingRenderer:{
      renderStaticStarMeter(value){return '<span class="stars">'+value+'</span>';},
      formatCommunityRating(value){return Number(value).toFixed(1);},
      renderGridRating(value){return '<span class="cover-rating-inner"><span class="stars">'+value+'</span><span class="cover-rating-number"><span class="cover-rating-value">'+Number(value).toFixed(1)+'</span><span class="cover-rating-max">/5</span></span></span>';}
    },
    elements,getState:()=>state,setPage:page=>{state.page=page;calls.page.push(page);},setSearchQuery:q=>{state.searchQuery=q;calls.search.push(q);},
    shelfById:id=>id==='shelf-1'?{id,name:'Favorites',icon:'star'}:null,shelfIconSvg:()=>'<svg></svg>',
    escapeHtml:value=>String(value==null?'':value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    spotifyAlbumLink:record=>'spotify:'+record[2],appleMusicAlbumLink:record=>'apple:'+record[2],
    renderShelfStrip:()=>calls.hooks++,updateLibraryTabLabels:()=>calls.hooks++,shouldShowLoggedOutLanding:()=>false,renderLoggedOutLanding:()=>calls.hooks++,restoreEmptyCollectionMarkup:()=>calls.hooks++,
    attachWishlistRemoveControls:()=>calls.hooks++,attachRecordActionMenus:()=>calls.hooks++,attachAlbumClicks:()=>calls.hooks++,enableGridSorting:()=>calls.hooks++,recordsPerPage:52
  });
  return {controller,elements,state,calls,baseRecord,collection,doc,win};
}
test('record cards preserve shelf rating and streaming presentation',()=>{
  const h=makeHarness({activeShelfId:'shelf-1'});const html=h.controller.recordHTML(h.baseRecord,'');
  assert.match(html,/record-shelf-status/);assert.match(html,/Favorites/);assert.match(html,/data-index="0"/);assert.match(html,/class="number">2</);
  assert.match(html,/streaming-service apple-service/);assert.match(html,/streaming-service spotify-service/);assert.match(html,/cover-rating-value">4\.5</);assert.match(html,/cover-rating-max">\/5</);
});
test('wishlist cards keep remove and add-to-collection controls',()=>{
  const h=makeHarness({libraryView:'wishlist'});const html=h.controller.recordHTML(h.baseRecord,'');
  assert.match(html,/wishlist-remove-button/);assert.match(html,/wishlist-cover-label/);assert.match(html,/move-to-collection-button/);assert.doesNotMatch(html,/record-action-menu/);
});
test('pagination items preserve compact ellipsis behavior',()=>{
  const h=makeHarness();assert.deepEqual(h.controller.paginationItems(1,3),[1,2,3]);assert.deepEqual(h.controller.paginationItems(5,10),[1,'…',4,5,6,'…',10]);
});
test('render filters through LibraryCore and shows matching card plus add-record card',()=>{
  const pink=[1,'Pink Floyd','The Wall','1979','Progressive Rock',0,'cover.jpg',{},1,'entry-1',10,{},null,'',0,4.5];
  const abba=[2,'ABBA','Arrival','1976','Pop',0,'abba.jpg',{},2,'entry-2',11,{},null,'',0,3.2];
  const h=makeHarness({records:[pink,abba],searchQuery:'arrival'});const result=h.controller.render();
  assert.equal(result.visibleRecords.length,1);assert.equal(result.pageRecords[0][2],'Arrival');assert.match(h.collection.innerHTML,/Arrival/);assert.match(h.collection.innerHTML,/add-album-card/);assert.equal(h.elements.collectionCount.textContent,'2 RECORDS IN COLLECTION');
});
test('render exposes empty shelf messaging without changing interaction ownership',()=>{
  const h=makeHarness({activeShelfId:'shelf-1'});h.state.records=[[1,'ABBA','Arrival','1976','Pop',0,'abba.jpg',{},2,'entry-2',11,{},null,'other-shelf',1,3.2]];
  const result=h.controller.render();assert.equal(result.pageRecords.length,0);assert.match(h.collection.innerHTML,/This shelf is empty/);assert.match(h.collection.innerHTML,/Use the record menu to add records to this shelf/);
});
test('lazy image loading only hydrates covers near the viewport',()=>{
  const near={src:'',attrs:{'data-src':'near.jpg'},getAttribute(name){return this.attrs[name]||null;},removeAttribute(name){delete this.attrs[name];},getBoundingClientRect(){return {top:100,bottom:300,left:100,right:300};}};
  const far={src:'',attrs:{'data-src':'far.jpg'},getAttribute(name){return this.attrs[name]||null;},removeAttribute(name){delete this.attrs[name];},getBoundingClientRect(){return {top:5000,bottom:5200,left:100,right:300};}};
  const h=makeHarness();h.doc.querySelectorAll=()=>[near,far];h.controller.loadVisibleImages();
  assert.equal(near.src,'near.jpg');assert.equal(near.attrs['data-src'],undefined);assert.equal(far.src,'');assert.equal(far.attrs['data-src'],'far.jpg');
});
