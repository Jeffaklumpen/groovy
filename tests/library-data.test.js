const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const LibraryData=require('../js/library-data.js');

function loadRecordModel(){
  const source=fs.readFileSync(path.resolve(__dirname,'..','js','record-model.js'),'utf8');
  const context={window:{}};
  vm.runInNewContext(source,context);
  return context.window.GroovyRecord;
}

const Record=loadRecordModel();

function makeQuery(result,capture){
  return {
    select(columns){capture.select=columns;return this;},
    eq(column,value){capture.eq=[column,value];return this;},
    order(column,options){capture.order=[column,options];return Promise.resolve(result);}
  };
}

test('fetchCollection uses one shared ordered collection query',async()=>{
  const capture={};
  const api={from(table){assert.equal(table,'collections');return makeQuery({data:[{id:'row-1'}],error:null},capture);}};
  const data=LibraryData.create({api,recordModel:Record});
  const result=await data.fetchCollection('user-1');
  assert.deepEqual(result,{data:[{id:'row-1'}],error:null});
  assert.match(capture.select,/matrix_runout_h/);
  assert.match(capture.select,/tracks\(/);
  assert.deepEqual(capture.eq,['user_id','user-1']);
  assert.deepEqual(capture.order,['sort_order',{ascending:true}]);
});

test('copyDetailsFromRow preserves pressing and matrix A-H fields',()=>{
  const api={from(){throw new Error('not used');}};
  const data=LibraryData.create({api,recordModel:Record});
  assert.deepEqual(data.copyDetailsFromRow({
    discogs_release_id:123,media_condition:'NM',sleeve_condition:'VG+',
    pressing_country:'Sweden',pressing_year:1977,pressing_label:'Harvest',
    catalog_number:'ABC-1',matrix_runout_a:'A-1',matrix_runout_h:'H-8',
    pressing_match_status:'discogs'
  }),{
    discogsReleaseId:123,mediaCondition:'NM',sleeveCondition:'VG+',country:'Sweden',
    year:1977,label:'Harvest',catalogNumber:'ABC-1',matrixA:'A-1',matrixB:'',
    matrixC:'',matrixD:'',matrixE:'',matrixF:'',matrixG:'',matrixH:'H-8',matchStatus:'discogs'
  });
});

test('mapCollectionRows uses Record.fromCollection for tracks sides pressing and ratings',()=>{
  const api={from(){throw new Error('not used');}};
  const data=LibraryData.create({api,recordModel:Record});
  const rows=[{
    id:'entry-1',sort_order:1,shelf_id:'shelf-1',shelf_sort_order:2,
    cover_url:'copy.jpg',discogs_style:'Prog Rock',discogs_release_id:321,
    media_condition:'VG+',matrix_runout_a:'A-1',
    albums:{
      id:42,title:'Album',release_year:1979,genre:'Rock',cover_url:'album.jpg',
      apple_collection_url:'https://music.apple.test/album',discogs_master_id:99,
      artists:{name:'Artist (2)'},
      tracks:[
        {id:2,disc_side:'B',track_number:1,title:'Second'},
        {id:1,disc_side:'A',track_number:1,title:'First'}
      ]
    }
  }];
  const ratingMeta={42:{ownRating:4,communityAverage:3.5,communityCount:8}};
  const records=data.mapCollectionRows(rows,ratingMeta);
  assert.equal(records.length,1);
  assert.equal(Record.artist(records[0]),'Artist');
  assert.equal(Record.title(records[0]),'Album');
  assert.equal(Record.coverUrl(records[0]),'copy.jpg');
  assert.equal(Record.entryId(records[0]),'entry-1');
  assert.equal(Record.shelfId(records[0]),'shelf-1');
  assert.equal(Record.shelfSortOrder(records[0]),2);
  assert.equal(Record.pressing(records[0]).discogsReleaseId,321);
  assert.equal(Record.pressing(records[0]).matrixA,'A-1');
  assert.equal(Record.ownRating(records[0]),4);
  assert.equal(Record.communityRating(records[0]),3.5);
  assert.equal(Record.communityCount(records[0]),8);
  assert.equal(Array.from(Record.sides(records[0]).A,function(track){return track.title;}).join('|'),'First');
  assert.equal(Array.from(Record.sides(records[0]).B,function(track){return track.title;}).join('|'),'Second');
});

test('albumIds ignores rows without albums',()=>{
  const api={from(){throw new Error('not used');}};
  const data=LibraryData.create({api,recordModel:Record});
  assert.deepEqual(data.albumIds([{albums:{id:1}},{albums:null},{albums:{id:2}}]),[1,2]);
});
