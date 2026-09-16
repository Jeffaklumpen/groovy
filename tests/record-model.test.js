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
  const appPosition=html.indexOf('/js/app.js?v=125');
  assert.ok(modelPosition>=0&&appPosition>modelPosition);
  assert.match(detail,/var Record=window.GroovyRecord/);
  assert.match(layout,/var Record=window.GroovyRecord/);
  assert.doesNotMatch(detail,/(?:record|current|item)[(?:1|2|4|5|6|8|9|10|15|16)]/);
  assert.doesNotMatch(layout,/record[(?:1|2|5|8|15|16)]/);
});
