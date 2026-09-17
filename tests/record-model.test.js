const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const root=path.resolve(__dirname,'..');
const Record=require('../js/record-model.js');

test('record model names legacy tuple fields without changing storage',function(){
  const record=[3,'Artist','Album',1980,'Rock',4,'cover.jpg',{A:[]},42,99,123,{mediaCondition:'VG+'},'https://music.apple.com/album',7,2,4.5,8];
  assert.equal(Record.order(record),3);
  assert.equal(Record.artist(record),'Artist');
  assert.equal(Record.title(record),'Album');
  assert.equal(Record.year(record),1980);
  assert.equal(Record.genre(record),'Rock');
  assert.equal(Record.ownRating(record),4);
  assert.equal(Record.coverUrl(record),'cover.jpg');
  assert.deepEqual(Record.sides(record),{A:[]});
  assert.equal(Record.albumId(record),42);
  assert.equal(Record.entryId(record),99);
  assert.equal(Record.discogsMasterId(record),123);
  assert.equal(Record.pressing(record).mediaCondition,'VG+');
  assert.equal(Record.appleUrl(record),'https://music.apple.com/album');
  assert.equal(Record.shelfId(record),7);
  assert.equal(Record.shelfSortOrder(record),2);
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
  const modelPosition=html.indexOf('/js/record-model.js?v=1');
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