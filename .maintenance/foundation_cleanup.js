const fs=require('node:fs');

function replaceExact(source,from,to,label,expected=1){
  const count=source.split(from).length-1;
  if(count!==expected)throw new Error(`${label}: expected ${expected}, found ${count}`);
  return source.split(from).join(to);
}

const recordModel=`(function(windowObject){
'use strict';

if(!windowObject)return;

var INDEX=Object.freeze({
  order:0,
  artist:1,
  title:2,
  year:3,
  genre:4,
  ownRating:5,
  coverUrl:6,
  sides:7,
  albumId:8,
  entryId:9,
  discogsMasterId:10,
  pressing:11,
  appleUrl:12,
  shelfId:13,
  shelfSortOrder:14,
  communityRating:15,
  communityCount:16
});

function value(record,name){
  var index=INDEX[name];
  return record&&index!==undefined?record[index]:undefined;
}

function emptySides(){
  return {A:[],B:[],C:[],D:[],E:[],F:[],G:[],H:[]};
}

function setRatings(record,own,community,count){
  if(!record)return record;
  record[INDEX.ownRating]=own;
  record[INDEX.communityRating]=community;
  record[INDEX.communityCount]=count;
  return record;
}

function create(fields){
  fields=fields||{};
  return [
    fields.order==null?0:fields.order,
    fields.artist||'',
    fields.title||'',
    fields.year||'',
    fields.genre||'',
    fields.ownRating||0,
    fields.coverUrl||'',
    fields.sides||emptySides(),
    fields.albumId==null?null:fields.albumId,
    fields.entryId==null?null:fields.entryId,
    fields.discogsMasterId||'',
    fields.pressing||null,
    fields.appleUrl||'',
    fields.shelfId||'',
    fields.shelfSortOrder==null?null:fields.shelfSortOrder,
    fields.communityRating||0,
    fields.communityCount||0
  ];
}

function toObject(record){
  var result={};
  Object.keys(INDEX).forEach(function(name){result[name]=value(record,name);});
  return result;
}

var api={
  INDEX:INDEX,
  value:value,
  emptySides:emptySides,
  create:create,
  toObject:toObject,
  setRatings:setRatings
};

Object.keys(INDEX).forEach(function(name){
  if(api[name])return;
  api[name]=function(record){return value(record,name);};
});

windowObject.GroovyRecord=Object.freeze(api);
// Temporary compatibility alias while app.js is migrated in stages.
windowObject.emptyRecordSides=emptySides;
})(typeof window!=='undefined'?window:null);
`;

if(fs.existsSync('js/record-model.js'))throw new Error('js/record-model.js already exists');
fs.writeFileSync('js/record-model.js',recordModel);

// Make the record model available before every consumer.
let index=fs.readFileSync('index.html','utf8');
index=replaceExact(index,
  '<script src="/js/route-state.js?v=20"></script>\n<script src="/js/app.js?v=125"></script>',
  '<script src="/js/route-state.js?v=20"></script>\n<script src="/js/record-model.js?v=1"></script>\n<script src="/js/app.js?v=126"></script>',
  'record model script order');
index=replaceExact(index,'/js/detail-enhancements-v2.js?v=8','/js/detail-enhancements-v2.js?v=9','detail cache version');
index=replaceExact(index,'/js/album-rating-layout-v4.js?v=2','/js/album-rating-layout-v4.js?v=3','rating layout cache version');
fs.writeFileSync('index.html',index);

// app.js keeps its tuple storage for now, but the shared model owns side creation.
let app=fs.readFileSync('js/app.js','utf8');
const emptySidesBlock=`window.emptyRecordSides=function(){\n  return {A:[],B:[],C:[],D:[],E:[],F:[],G:[],H:[]};\n};\n\n`;
app=replaceExact(app,emptySidesBlock,'','legacy emptyRecordSides definition');
const appSideCalls=(app.match(/window\.emptyRecordSides\(\)/g)||[]).length;
if(appSideCalls<3)throw new Error('Expected at least three app emptyRecordSides calls, found '+appSideCalls);
app=app.replace(/window\.emptyRecordSides\(\)/g,'window.GroovyRecord.emptySides()');
fs.writeFileSync('js/app.js',app);

// Move the already-separated detail enhancement module off numeric tuple indexes.
let detail=fs.readFileSync('js/detail-enhancements-v2.js','utf8');
detail=replaceExact(detail,"'use strict';\n","'use strict';\n\nvar Record=window.GroovyRecord;\nif(!Record)return;\n",'detail Record dependency');

detail=replaceExact(detail,
`    record[5]=entry.own||0;\n    record[15]=entry.average||0;\n    record[16]=entry.count||0;`,
`    Record.setRatings(record,entry.own||0,entry.average||0,entry.count||0);`,
'wishlist rating assignment');
detail=replaceExact(detail,
`    item[5]=0;\n    item[15]=nextAverage;\n    item[16]=nextCount;`,
`    Record.setRatings(item,0,nextAverage,nextCount);`,
'remove rating assignment');

const detailReplacements=[
  ['current[2]','Record.title(current)'],
  ['current[1]','Record.artist(current)'],
  ['record[2]','Record.title(record)'],
  ['record[1]','Record.artist(record)'],
  ['record[4]','Record.genre(record)'],
  ['record[5]','Record.ownRating(record)'],
  ['record[6]','Record.coverUrl(record)'],
  ['record[8]','Record.albumId(record)'],
  ['record[9]','Record.entryId(record)'],
  ['record[10]','Record.discogsMasterId(record)'],
  ['record[15]','Record.communityRating(record)'],
  ['record[16]','Record.communityCount(record)'],
  ['item[8]','Record.albumId(item)']
];
for(const [from,to] of detailReplacements)detail=detail.split(from).join(to);
const detailMagic=detail.match(/\b(?:record|current|item)\[(?:1|2|4|5|6|8|9|10|15|16)\]/g);
if(detailMagic)throw new Error('Detail module still has magic record indexes: '+detailMagic.join(', '));
fs.writeFileSync('js/detail-enhancements-v2.js',detail);

// Do the same for rating presentation and remove a bare async token left by the
// previous function extraction. node --check accepts it as an identifier, so
// this pass explicitly guards against that runtime hazard.
let layout=fs.readFileSync('js/album-rating-layout-v4.js','utf8');
layout=replaceExact(layout,"'use strict';\n","'use strict';\n\nvar Record=window.GroovyRecord;\nif(!Record)return;\n",'layout Record dependency');
const bareAsync=/\nasync\s*\n+\s*function applyInitialAvatar/;
if(!bareAsync.test(layout))throw new Error('Expected the stray async token before applyInitialAvatar');
layout=layout.replace(bareAsync,'\nfunction applyInitialAvatar');
const layoutReplacements=[
  ['record[2]','Record.title(record)'],
  ['record[1]','Record.artist(record)'],
  ['record[5]','Record.ownRating(record)'],
  ['record[8]','Record.albumId(record)'],
  ['record[15]','Record.communityRating(record)'],
  ['record[16]','Record.communityCount(record)']
];
for(const [from,to] of layoutReplacements)layout=layout.split(from).join(to);
const layoutMagic=layout.match(/\brecord\[(?:1|2|5|8|15|16)\]/g);
if(layoutMagic)throw new Error('Rating layout still has magic record indexes: '+layoutMagic.join(', '));
if(/^\s*async\s*$/m.test(layout))throw new Error('Bare async token remains in rating layout');
fs.writeFileSync('js/album-rating-layout-v4.js',layout);

// Refresh existing cache-version assertions before the full suite runs.
let pwaTests=fs.readFileSync('tests/pwa.test.js','utf8');
pwaTests=replaceExact(pwaTests,'src="\\/js\\/album-rating-layout-v4\\.js\\?v=2"','src="\\/js\\/album-rating-layout-v4\\.js\\?v=3"','rating test cache assertion');
pwaTests=replaceExact(pwaTests,'src="\\/js\\/detail-enhancements-v2\\.js\\?v=8"','src="\\/js\\/detail-enhancements-v2\\.js\\?v=9"','detail test cache assertion');
fs.writeFileSync('tests/pwa.test.js',pwaTests);

const modelTest=`const assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst test=require('node:test');\nconst vm=require('node:vm');\n\nconst root=path.resolve(__dirname,'..');\n\nfunction loadModel(){\n  const source=fs.readFileSync(path.join(root,'js','record-model.js'),'utf8');\n  const context={window:{}};\n  vm.runInNewContext(source,context);\n  return context.window;\n}\n\ntest('record model names the legacy tuple fields without changing storage',function(){\n  const windowObject=loadModel();\n  const Record=windowObject.GroovyRecord;\n  const record=Record.create({artist:'Pink Floyd',title:'The Wall',albumId:42,ownRating:4,communityRating:4.5,communityCount:10});\n  assert.equal(Array.isArray(record),true);\n  assert.equal(Record.artist(record),'Pink Floyd');\n  assert.equal(Record.title(record),'The Wall');\n  assert.equal(Record.albumId(record),42);\n  assert.equal(Record.ownRating(record),4);\n  assert.equal(Record.communityRating(record),4.5);\n  assert.equal(Record.communityCount(record),10);\n  Record.setRatings(record,5,4.6,11);\n  assert.equal(record[Record.INDEX.ownRating],5);\n  assert.equal(record[Record.INDEX.communityRating],4.6);\n  assert.equal(record[Record.INDEX.communityCount],11);\n});\n\ntest('record model owns A-H side creation and loads before app.js',function(){\n  const windowObject=loadModel();\n  assert.deepEqual(Object.keys(windowObject.GroovyRecord.emptySides()),['A','B','C','D','E','F','G','H']);\n  assert.equal(windowObject.emptyRecordSides,windowObject.GroovyRecord.emptySides);\n  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');\n  const modelPosition=html.indexOf('/js/record-model.js?v=1');\n  const appPosition=html.indexOf('/js/app.js?v=126');\n  assert.ok(modelPosition>=0&&appPosition>modelPosition);\n});\n\ntest('separated detail and rating modules use named record accessors',function(){\n  const detail=fs.readFileSync(path.join(root,'js','detail-enhancements-v2.js'),'utf8');\n  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');\n  assert.match(detail,/var Record=window\\.GroovyRecord/);\n  assert.match(layout,/var Record=window\\.GroovyRecord/);\n  assert.doesNotMatch(detail,/\\b(?:record|current|item)\\[(?:1|2|4|5|6|8|9|10|15|16)\\]/);\n  assert.doesNotMatch(layout,/\\brecord\\[(?:1|2|5|8|15|16)\\]/);\n  assert.doesNotMatch(layout,/^\\s*async\\s*$/m);\n});\n`;
if(fs.existsSync('tests/record-model.test.js'))throw new Error('tests/record-model.test.js already exists');
fs.writeFileSync('tests/record-model.test.js',modelTest);
