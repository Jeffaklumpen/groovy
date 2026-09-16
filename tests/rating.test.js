const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const root=path.resolve(__dirname,'..');

test('album rating state is event-driven instead of repeatedly refetched',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const detail=fs.readFileSync(path.join(root,'js','detail-enhancements-v2.js'),'utf8');
  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');

  assert.match(app,/groovy-rating-updated/);
  assert.match(detail,/addEventListener\('groovy-rating-updated'/);
  assert.match(layout,/addEventListener\('groovy-rating-updated'/);
  assert.doesNotMatch(layout,/refreshGlobal|scheduleRefresh|ratingToken|160,420,850,1400|220,600,1200,1700/);
  assert.doesNotMatch(detail,/180,550,1300/);
  assert.doesNotMatch(layout,/select\('user_id,rating'\)/);
});

test('changed frontend assets are cache-busted in index',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/detail-enhancements\.css\?v=8/);
  assert.match(html,/app\.js\?v=127/);
  assert.match(html,/detail-enhancements-v2\.js\?v=9/);
  assert.match(html,/profile\.js\?v=10/);
  assert.match(html,/album-rating-layout-v4\.js\?v=3/);
});
