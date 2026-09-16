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
  const modelPosition=html.indexOf('/js/record-model.js?v=1');
  const appPosition=html.indexOf('/js/app.js?v=126');
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
