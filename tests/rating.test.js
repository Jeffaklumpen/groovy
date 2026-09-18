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
  assert.doesNotMatch(detail,/addEventListener\('groovy-rating-updated'/);
  assert.match(detail,/groovyRenderAlbumRating/);
  assert.match(layout,/addEventListener\('groovy-rating-updated'/);
  assert.doesNotMatch(layout,/refreshGlobal|scheduleRefresh|ratingToken|160,420,850,1400|220,600,1200,1700/);
  assert.doesNotMatch(detail,/180,550,1300/);
  assert.doesNotMatch(layout,/select\('user_id,rating'\)/);
});


test('album rating UI removes the old heading and owns x/5 presentation in base markup',function(){
  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');
  const cards=fs.readFileSync(path.join(root,'js','library-render-controller.js'),'utf8');
  const ratingController=fs.readFileSync(path.join(root,'js','album-rating-controller.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  assert.doesNotMatch(layout,/Album Ratings|ensureHeading/);
  assert.match(cards,/renderGridRating/);
  assert.match(ratingController,/cover-rating-max/);
  assert.match(ratingController,/>\/5<\/span>/);
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


test('mobile rating panels share star geometry and footer alignment',function(){
  const controller=fs.readFileSync(path.join(root,'js','album-rating-controller.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  const searchCss=fs.readFileSync(path.join(root,'css','search-modals.css'),'utf8');
  assert.match(controller,/groovy-rating-star-cell/);
  assert.match(css,/grid-template-columns:repeat\(5,var\(--rating-star-size\)\)/);
  assert.match(css,/rating-panel-footer\{[\s\S]*min-height:24px!important/);
  assert.match(searchCss,/user-search-avatar\.groovy-user-avatar\{overflow:visible\}/);
});


test('mobile rating cards use identical grid geometry for own and community values',function(){
  const controller=fs.readFileSync(path.join(root,'js','album-rating-controller.js'),'utf8');
  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  assert.doesNotMatch(controller,/rating-panel-community-main|rating-panel-stars/);
  assert.match(controller,/groovy-rating-star-cell/);
  assert.match(layout,/groovy-rating-star-cell/);
  assert.match(css,/grid-template-rows:16px var\(--rating-star-size\) 24px/);
  assert.match(css,/grid-template-columns:repeat\(5,var\(--rating-star-size\)\)/);
  assert.match(css,/groovy-score-main,\nhtml body \.detail-rating \.groovy-score-max\{[\s\S]*font-size:21px/);
  assert.match(css,/rating-panel-footer\{[\s\S]*min-height:24px!important/);
});


test('detail rating star geometry has one canonical owner across desktop and mobile',function(){
  const controller=fs.readFileSync(path.join(root,'js','album-rating-controller.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  assert.match(controller,/album-rating-star groovy-rating-star-cell/);
  assert.match(css,/--rating-star-size:24px/);
  assert.match(css,/grid-template-columns:repeat\(5,var\(--rating-star-size\)\)/);
  assert.match(css,/\.album-rating-star,\nhtml body \.detail-rating \.groovy-rating-star-cell/);
  assert.match(css,/\.groovy-rating-star-base,\nhtml body \.detail-rating \.groovy-rating-star-fill/);
  assert.match(css,/@media screen and \(max-width:760px\)\{[\s\S]*--rating-star-size:19px/);
  assert.doesNotMatch(css,/groovy-rating-stars-base|groovy-rating-stars-fill/);
});


test('filled and empty detail stars share one centered glyph geometry',function(){
  const css=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  assert.match(css,/\.groovy-rating-star-glyph\{[\s\S]*align-items:center!important;[\s\S]*justify-content:center!important/);
  assert.match(css,/\.groovy-rating-star-fill\{[\s\S]*width:var\(--star-fill\)!important/);
  assert.doesNotMatch(css,/groovy-rating-star-fill\{[\s\S]{0,180}text-align:left!important/);
  assert.match(css,/html body \.detail-rating \.groovy-rating-stars\{\n  align-self:center!important/);
});


test('community score no longer has a separate line box size',function(){
  const legacy=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  const canonical=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  assert.doesNotMatch(canonical,/rating-panel-community-main|rating-panel-stars/);
  assert.match(canonical,/groovy-rating-score\{[\s\S]*height:var\(--rating-star-size\)!important;[\s\S]*font-size:0!important;[\s\S]*line-height:var\(--rating-star-size\)!important/);
});


test('base rating DOM has one owner and detail enhancements do not rewrite it',function(){
  const controller=fs.readFileSync(path.join(root,'js','album-rating-controller.js'),'utf8');
  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');
  const enhancements=fs.readFileSync(path.join(root,'js','detail-enhancements-v2.js'),'utf8');
  const ratingCss=fs.readFileSync(path.join(root,'css','ratings-detail.css'),'utf8');
  const detailCss=fs.readFileSync(path.join(root,'css','detail-enhancements.css'),'utf8');
  assert.match(controller,/function renderDetail\(/);
  assert.doesNotMatch(layout,/decorateYour|decorateCommunity|decorateBase|ensureOwnFooter|ensureScore/);
  assert.doesNotMatch(enhancements,/updateDetailRating|ensureRatingFooter/);
  assert.doesNotMatch(detailCss,/rating-panel|groovy-rating-value-row|groovy-rating-star-cell|groovy-rating-score/);
  assert.match(ratingCss,/grid-template-rows:26px var\(--rating-star-size\) 24px/);
  assert.match(ratingCss,/grid-row:1!important/);
  assert.match(ratingCss,/grid-row:2!important/);
  assert.match(ratingCss,/grid-row:3!important/);
});
