const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');

function loadModel(){
  const source=fs.readFileSync(path.join(root,'js','record-model.js'),'utf8');
  const context={window:{}};
  vm.runInNewContext(source,context);
  return context.window.GroovyRecord;
}

test('record model names legacy tuple fields without changing storage',function(){
  const Record=loadModel();
  const record=[1,'Pink Floyd','The Wall',1979,'Rock',4,'cover.jpg',{},42,99,123,{},'',null,null,4.5,10];
  assert.equal(Record.artist(record),'Pink Floyd');
  assert.equal(Record.title(record),'The Wall');
  assert.equal(Record.albumId(record),42);
  assert.equal(Record.communityRating(record),4.5);
  Record.setRatings(record,5,4.6,11);
  assert.equal(record[5],5);
  assert.equal(record[15],4.6);
  assert.equal(record[16],11);
});

test('record model loads before consumers and separated modules use named accessors',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const detail=fs.readFileSync(path.join(root,'js','detail-enhancements-v2.js'),'utf8');
  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');
  const modelPosition=html.indexOf('/js/record-model.js?v=');
  const appPosition=html.indexOf('/js/app.js?v=');
  assert.ok(modelPosition>=0&&appPosition>modelPosition);
  assert.match(detail,/var Record=window.GroovyRecord/);
  assert.match(layout,/var Record=window.GroovyRecord/);
  ['record[1]','record[2]','record[4]','record[5]','record[6]','record[8]','record[9]','record[10]','record[15]','record[16]','current[1]','current[2]','item[8]'].forEach(function(token){assert.equal(detail.includes(token),false,token+' should not remain in detail module');});
  ['record[1]','record[2]','record[5]','record[8]','record[15]','record[16]'].forEach(function(token){assert.equal(layout.includes(token),false,token+' should not remain in rating module');});
});

test('record-card and Wikipedia rendering use named record accessors in their extracted modules',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const card=fs.readFileSync(path.join(root,'js','library-render-controller.js'),'utf8');
  const wiki=fs.readFileSync(path.join(root,'js','wikipedia-about-controller.js'),'utf8');
  assert.match(app,/var Record=window.GroovyRecord/);
  ['record[0]','record[1]','record[2]','record[3]','record[6]','record[11]','record[12]','record[13]','record[14]','record[15]'].forEach(function(token){assert.equal(card.includes(token),false,token+' should not remain in card rendering');});
  assert.match(card,/recordModel\.artist\(record\)/);
  assert.match(card,/recordModel\.title\(record\)/);
  assert.match(card,/recordModel\.communityRating\(record\)/);
  ['record&&record[1]','record&&record[2]','record&&record[3]'].forEach(function(token){assert.equal(wiki.includes(token),false,token+' should not remain in Wikipedia identity');});
  assert.match(wiki,/recordModel\.title\(record\)/);
  assert.match(wiki,/recordModel\.artist\(record\)/);
});


test('record model builds wishlist tuples and empty sides consistently',function(){
  const Record=loadModel();
  const item={id:77,discogs_style:'Prog Rock',cover_url:'wish.jpg',albums:{id:42,title:'The Wall',release_year:1979,genre:'Rock',cover_url:'album.jpg',apple_collection_url:'https://music.apple.com/test',discogs_master_id:123,artists:{name:'Pink Floyd (2)'},tracks:[
    {id:2,disc_side:'B',track_number:1,title:'B One'},
    {id:1,disc_side:'A',track_number:1,title:'A One'}
  ]}};
  const record=Record.fromWishlist(item,3);
  assert.equal(record[0],4);
  assert.equal(Record.artist(record),'Pink Floyd');
  assert.equal(Record.title(record),'The Wall');
  assert.equal(Record.albumId(record),42);
  assert.equal(Record.discogsMasterId(record),123);
  assert.deepEqual(Array.from(Record.sides(record).A,function(track){return track.title;}),['A One']);
  assert.deepEqual(Array.from(Record.sides(record).B,function(track){return track.title;}),['B One']);
  assert.deepEqual(Object.keys(Record.emptySides()),['A','B','C','D','E','F','G','H']);
});

test('record model owns track-duration identity and mutation rules',function(){
  const Record=loadModel();
  const record=[1,'Artist','Album',1973,'Rock',0,'',{A:[{trackNumber:1,title:'One',duration:''},{trackNumber:2,title:'Two',duration:'2:00'}],B:[]},42,9,123];
  assert.equal(Record.trackDurationCacheKey(record),'groovy-track-durations:123');
  assert.equal(Record.hasMissingTrackDurations(record),true);
  assert.equal(Record.applyTrackDurations(record,[
    {disc_side:'A',track_number:1,duration:'3:15'},
    {disc_side:'A',track_number:2,duration:'4:20'}
  ],false),true);
  assert.equal(Record.sides(record).A[0].duration,'3:15');
  assert.equal(Record.sides(record).A[1].duration,'2:00');
  assert.equal(Record.hasMissingTrackDurations(record),false);
  assert.equal(Record.applyTrackDurations(record,[{disc_side:'A',track_number:2,duration:'4:20'}],true),true);
  assert.equal(Record.sides(record).A[1].duration,'4:20');
});

test('track-duration matching falls back to normalized title when side numbering differs',function(){
  const Record=loadModel();
  const record=[
    1,'Artist','Album',2016,'Rock',0,'',
    {
      A:[{trackNumber:1,title:'First Song',duration:''}],
      B:[{trackNumber:6,title:'A Savior in the Square',duration:''}],
      C:[{trackNumber:10,title:'Brother, Can You Hear Me?',duration:''}]
    },
    42,9,123
  ];

  assert.equal(Record.applyTrackDurations(record,[
    {disc_side:'A',track_number:1,title:'First Song',duration:'1:00'},
    {disc_side:'B',track_number:1,title:'A Savior In The Square',duration:'2:00'},
    {disc_side:'C',track_number:3,title:'Brother, Can You Hear Me?',duration:'3:00'}
  ],false),true);

  assert.equal(Record.sides(record).A[0].duration,'1:00');
  assert.equal(Record.sides(record).B[0].duration,'2:00');
  assert.equal(Record.sides(record).C[0].duration,'3:00');
});

test('track-duration title fallback does not guess when duplicate titles are ambiguous',function(){
  const Record=loadModel();
  const record=[
    1,'Artist','Album',1979,'Rock',0,'',
    {A:[{trackNumber:9,title:'Repeated',duration:''}]},
    42,9,123
  ];

  assert.equal(Record.applyTrackDurations(record,[
    {disc_side:'B',track_number:1,title:'Repeated',duration:'1:00'},
    {disc_side:'C',track_number:1,title:'Repeated',duration:'2:00'}
  ],false),false);
  assert.equal(Record.sides(record).A[0].duration,'');
});

test('track-duration controller delegates tuple mutation rules to record model',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const controller=fs.readFileSync(path.join(root,'js','detail-tracklist-controller.js'),'utf8');
  assert.equal(app.includes('function wishlistRecord('),false);
  assert.equal(app.includes('function applyTrackDurationRows('),false);
  assert.equal(controller.includes('record[7]'),false);
  assert.equal(controller.includes('record[8]'),false);
  assert.equal(controller.includes('record[10]'),false);
  assert.equal(controller.includes('recordModel.applyTrackDurations'),true);
  assert.equal(controller.includes('recordModel.hasMissingTrackDurations'),true);
  assert.equal(controller.includes('pressingCore.discogsTrackRows'),true);
});


test('record model compacts shelf order without changing other shelves',function(){
  const Record=loadModel();
  function item(order,shelfId,shelfOrder){
    const record=new Array(15).fill('');
    record[0]=order;record[13]=shelfId;record[14]=shelfOrder;
    return record;
  }
  const first=item(4,'target',3);
  const second=item(2,'target',1);
  const missing=item(1,'target',null);
  const other=item(3,'other',9);
  const records=[first,second,missing,other];
  assert.equal(Record.compactShelfOrder(records,'target'),records);
  assert.equal(Record.shelfSortOrder(second),1);
  assert.equal(Record.shelfSortOrder(first),2);
  assert.equal(Record.shelfSortOrder(missing),3);
  assert.equal(Record.shelfSortOrder(other),9);
});

test('record model finds the next shelf order while excluding a moving record',function(){
  const Record=loadModel();
  function item(shelfId,shelfOrder){
    const record=new Array(15).fill('');
    record[13]=shelfId;record[14]=shelfOrder;
    return record;
  }
  const one=item('target',1);
  const moving=item('target',8);
  const four=item('target',4);
  const other=item('other',20);
  assert.equal(Record.nextShelfOrder([one,moving,four,other],'target',moving),5);
  assert.equal(Record.nextShelfOrder([other],'target',null),1);
});

test('app controllers delegate local shelf ordering to record model',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const shelfController=fs.readFileSync(path.join(root,'js','shelf-controller.js'),'utf8');
  const libraryActions=fs.readFileSync(path.join(root,'js','library-actions-controller.js'),'utf8');
  assert.equal(app.includes('function compactLocalShelfOrder('),false);
  assert.equal(app.includes('function nextLocalShelfOrder('),false);
  assert.match(shelfController,/Record\.compactShelfOrder\(records,/);
  assert.match(libraryActions,/recordModel\.compactShelfOrder\(records,deletedShelfId\)/);
  assert.equal(shelfController.includes('Record.nextShelfOrder(records,normalized,record)'),true);
});


test('record model builds collection tuples with tracks, pressing and shelf metadata',function(){
  const Record=loadModel();
  const pressing={country:'CA',catalogNumber:'SMAS-11163'};
  const item={id:9,discogs_style:'Prog Rock',cover_url:'owned.jpg',shelf_id:'favorites',shelf_sort_order:4,albums:{id:42,title:'The Dark Side Of The Moon',release_year:1973,genre:'Rock',cover_url:'album.jpg',apple_collection_url:'https://music.apple.com/test',discogs_master_id:123,artists:{name:'Pink Floyd (2)'},tracks:[
    {id:2,disc_side:'B',track_number:1,title:'B One',duration:'4:00'},
    {id:1,disc_side:'A',track_number:1,title:'A One',duration:'3:00'}
  ]}};
  const record=Record.fromCollection(item,2,pressing);
  assert.equal(Record.order(record),3);
  assert.equal(Record.artist(record),'Pink Floyd');
  assert.equal(Record.albumId(record),42);
  assert.equal(Record.entryId(record),9);
  assert.equal(Record.pressing(record),pressing);
  assert.equal(Record.shelfId(record),'favorites');
  assert.equal(Record.shelfSortOrder(record),4);
  assert.equal(Record.sides(record).A[0].trackNumber,1);
  assert.equal(Record.sides(record).A[0].duration,'3:00');
});

test('record model applies album rating metadata through named tuple fields',function(){
  const Record=loadModel();
  const record=Record.fromCollection({id:9,albums:{id:42,title:'Album',artists:{name:'Artist'},tracks:[]}},0,{});
  assert.equal(Record.applyRatingMeta(record,{42:{ownRating:5,communityAverage:4.4,communityCount:12}}),record);
  assert.equal(Record.ownRating(record),5);
  assert.equal(Record.communityRating(record),4.4);
  assert.equal(Record.communityCount(record),12);
  Record.applyRatingMeta(record,{});
  assert.equal(Record.ownRating(record),0);
  assert.equal(Record.communityRating(record),0);
  assert.equal(Record.communityCount(record),0);
});

test('library data delegates collection tuple construction and rating mutation to record model',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const libraryData=fs.readFileSync(path.join(root,'js','library-data.js'),'utf8');
  assert.equal(app.includes('function applyAlbumRatingMeta('),false);
  assert.equal(app.includes('window.applyAlbumRatingMeta=Record.applyRatingMeta;'),true);
  assert.match(libraryData,/recordModel\.fromCollection\(item,index,copyDetailsFromRow\(item\)\)/);
  assert.match(libraryData,/recordModel\.applyRatingMeta\(/);
  assert.equal(app.includes('Record.fromCollection(item,index,copyDetailsFromRow(item))'),false);
});
