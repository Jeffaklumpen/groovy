const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const consumers=[
  'js/detail-enhancements-v2.js',
  'js/album-rating-layout-v4.js',
  'js/library-render-controller.js',
  'js/wikipedia-about-controller.js',
  'js/detail-tracklist-controller.js',
  'js/detail-social-controller.js',
  'js/pressing-picker.js',
  'js/pressing-controller.js',
  'js/marketplace-controller.js',
  'js/shelf-core.js',
  'js/shelf-controller.js'
];

test('feature modules do not know legacy record tuple positions',()=>{
  const offenders=[];
  consumers.forEach(file=>{
    const source=fs.readFileSync(file,'utf8');
    if(/\brecord\s*\[\s*\d+\s*\]/.test(source))offenders.push(file+': direct record index');
    if(/\brecordModel\.INDEX\b/.test(source))offenders.push(file+': recordModel.INDEX');
    if(/\bRecord\.INDEX\b/.test(source))offenders.push(file+': Record.INDEX');
  });
  assert.deepEqual(offenders,[]);
});

test('remaining record-aware app integrations inject or pass named accessors',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(app,/DetailSocialController\.create\(\{[\s\S]*?recordModel:Record/);
  assert.match(app,/MarketplaceController\.create\(\{[\s\S]*?recordModel:Record/);
  assert.match(app,/ShelfController\.create\(\{[\s\S]*?recordModel:Record/);
  assert.match(app,/PressingController\.create\(\{[\s\S]*?recordModel:Record/);
  assert.match(app,/ShelfCore\.recordCount\(records,id,Record\.shelfId\)/);
});
