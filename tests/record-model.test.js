const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');

function loadModel(){
  const source=fs.readFileSync(path.join(root,'js','record-model.js'),'utf8');
  const sandbox={window:{}};
  vm.runInNewContext(source,sandbox,{filename:'record-model.js'});
  return sandbox.window.GroovyRecord;
}

test('record model exposes named accessors for the legacy tuple',function(){
  const Record=loadModel();
  const record=new Array(17).fill('');
  record[1]='Pink Floyd';
  record[2]='The Dark Side Of The Moon';
  record[8]=42;
  record[13]='favorites';
  assert.equal(Record.artist(record),'Pink Floyd');
  assert.equal(Record.title(record),'The Dark Side Of The Moon');
  assert.equal(Record.albumId(record),42);
  assert.equal(Record.shelfId(record),'favorites');
});

test('record model updates rating fields without changing tuple shape',function(){
  const Record=loadModel();
  const record=new Array(17).fill('');
  const result=Record.setRatings(record,4,3.5,12);
  assert.equal(result,record);
  assert.equal(record.length,17);
  assert.equal(Record.ownRating(record),4);
  assert.equal(Record.communityRating(record),3.5);
  assert.equal(Record.communityCount(record),12);
});

test('record model creates independent empty track sides A-H',function(){
  const Record=loadModel();
  const sides=Record.emptySides();
  assert.deepEqual(Object.keys(sides),['A','B','C','D','E','F','G','H']);
  sides.A.push('one');
  assert.equal(sides.B.length,0);
});

test('record model builds wishlist tuples without app-level tuple assembly',function(){
  const Record=loadModel();
  const item={id:7,album_id:42,discogs_style:'Rock',albums:{id:42,title:'Wish',release_year:1973,genre:'Prog',cover_url:'cover.jpg',apple_collection_url:'https://music.apple.com/test',discogs_master_id:123,artists:{name:'Pink Floyd (2)'},tracks:[{disc_side:'A',track_number:1,title:'One',duration:'3:00'}]}};
  const record=Record.fromWishlist(item,0);
  assert.equal(Record.artist(record),'Pink Floyd');
  assert.equal(Record.title(record),'Wish');
  assert.equal(Record.albumId(record),42);
  assert.equal(Record.discogsMasterId(record),123);
  assert.equal(record[7].A[0].title,'One');
});

test('record model applies rating metadata to matching album records',function(){
  const Record=loadModel();
  const a=new Array(17).fill('');a[8]=1;
  const b=new Array(17).fill('');b[8]=2;
  const own=new Map([[1,4]]);
  const community=new Map([[1,{average:3.25,count:8}],[2,{average:5,count:1}]]);
  Record.applyRatingMeta([a,b],own,community);
  assert.equal(Record.ownRating(a),4);
  assert.equal(Record.communityRating(a),3.25);
  assert.equal(Record.communityCount(a),8);
  assert.equal(Record.ownRating(b),0);
  assert.equal(Record.communityRating(b),5);
});

test('record model track duration cache and updates use album identity',function(){
  const Record=loadModel();
  const record=new Array(17).fill('');record[8]=42;record[7]={A:[{title:'One',duration:''}],B:[],C:[],D:[],E:[],F:[],G:[],H:[]};
  assert.equal(Record.trackDurationCacheKey(record),'album:42');
  assert.equal(Record.hasMissingTrackDurations(record),true);
  assert.equal(Record.applyTrackDurations(record,{A:[{duration:'3:00'}]}),true);
  assert.equal(record[7].A[0].duration,'3:00');
  assert.equal(Record.hasMissingTrackDurations(record),false);
});

test('record model compacts local shelf ordering',function(){
  const Record=loadModel();
  function item(id,shelfId,shelfOrder){
    const record=new Array(15).fill('');
    record[9]=id;record[13]=shelfId;record[14]=shelfOrder;
    return record;
  }
  const records=[item('a','target',8),item('b','other',4),item('c','target',2),item('d','target',null)];
  Record.compactShelfOrder(records,'target');
  assert.equal(records[2][14],1);
  assert.equal(records[0][14],2);
  assert.equal(records[3][14],3);
  assert.equal(records[1][14],4);
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

test('app and shelf controller delegate local shelf ordering to record model',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const shelfController=fs.readFileSync(path.join(root,'js','shelf-controller.js'),'utf8');
  assert.equal(app.includes('function compactLocalShelfOrder('),false);
  assert.equal(app.includes('function nextLocalShelfOrder('),false);
  const combined=app+'\n'+shelfController;
  assert.ok((combined.match(/Record\.compactShelfOrder\(records,/g)||[]).length>=2);
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
  assert.equal(Record.shelfId(record),'favorites');
  assert.equal(Record.shelfSortOrder(record),4);
  assert.equal(Record.genre(record),'Prog Rock');
  assert.equal(Record.coverUrl(record),'owned.jpg');
  assert.deepEqual(JSON.parse(JSON.stringify(Record.pressing(record))),pressing);
  assert.equal(record[7].A[0].title,'A One');
  assert.equal(record[7].B[0].duration,'4:00');
});
