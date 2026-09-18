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


test('album rating UI removes the old heading and owns x/5 presentation in base markup',function(){
  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');
  const cards=fs.readFileSync(path.join(root,'js','library-render-controller.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  assert.doesNotMatch(layout,/Album Ratings|ensureHeading/);
  assert.match(cards,/cover-rating-max/);
  assert.match(cards,/>\/5<\/span>/);
  assert.match(css,/groovy-star-meter\.is-compact\{font-size:16px/);
  assert.match(css,/cover-rating-max\{[^}]*font-size:inherit[^}]*font-weight:400/);
});

test('avatar fallback is rendered directly rather than fixed by a later DOM observer',function(){
  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');
  const userSearch=fs.readFileSync(path.join(root,'js','user-search-controller.js'),'utf8');
  const social=fs.readFileSync(path.join(root,'js','social-controller.js'),'utf8');
  const notifications=fs.readFileSync(path.join(root,'js','notification-controller.js'),'utf8');
  assert.doesNotMatch(layout,/scanAvatars|applyInitialAvatar|avatar_placeholder/);
  [userSearch,social,notifications].forEach(function(source){assert.doesNotMatch(source,/avatar-placeholder\.png/);});
  assert.match(layout,/UserProfileCore\.avatarMarkup/);
});
