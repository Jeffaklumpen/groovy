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

test('app record-card and Wikipedia identity rendering use named record accessors',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  assert.match(app,/var Record=window.GroovyRecord/);
  const cardStart=app.indexOf('function spotifyAlbumLink(record){');
  const cardEnd=app.indexOf('function loadVisibleImages(){',cardStart);
  const card=app.slice(cardStart,cardEnd);
  ['record[0]','record[1]','record[2]','record[3]','record[6]','record[11]','record[12]','record[13]','record[14]','record[15]'].forEach(function(token){assert.equal(card.includes(token),false,token+' should not remain in card rendering');});
  assert.equal(card.includes('Record.artist(record)'),true);
  assert.equal(card.includes('Record.title(record)'),true);
  assert.equal(card.includes('Record.communityRating(record)'),true);
  const wikiStart=app.indexOf('function wikipediaCacheKey(record){');
  const wikiEnd=app.indexOf('async function fetchWikipediaAlbumCandidates',wikiStart);
  const wiki=app.slice(wikiStart,wikiEnd);
  ['record&&record[1]','record&&record[2]','record&&record[3]'].forEach(function(token){assert.equal(wiki.includes(token),false,token+' should not remain in Wikipedia identity');});
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

test('app delegates wishlist and track-duration tuple logic to record model',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const start=app.indexOf('window.emptyRecordSides=Record.emptySides;');
  const end=app.indexOf('async function loadAlbumRatingData',start);
  const section=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.equal(section.includes('function wishlistRecord('),false);
  assert.equal(section.includes('function applyTrackDurationRows('),false);
  assert.equal(section.includes('record[7]'),false);
  assert.equal(section.includes('record[8]'),false);
  assert.equal(section.includes('record[10]'),false);
  assert.equal(section.includes('Record.applyTrackDurations'),true);
  assert.equal(section.includes('Record.hasMissingTrackDurations'),true);
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

test('app delegates local shelf ordering to record model',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  assert.equal(app.includes('function compactLocalShelfOrder('),false);
  assert.equal(app.includes('function nextLocalShelfOrder('),false);
  assert.ok((app.match(/Record\.compactShelfOrder\(records,/g)||[]).length>=2);
  assert.equal(app.includes('Record.nextShelfOrder(records,normalizedShelfId,record)'),true);
});
