const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('album review controller exports a create API',()=>{
  const controller=require('../js/album-review-controller.js');
  assert.equal(typeof controller.create,'function');
});

test('album reviews persist one review per user and album with RLS',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260919021500_album_reviews.sql','utf8');
  assert.match(sql,/create table public\.album_reviews/i);
  assert.match(sql,/unique \(user_id,album_id\)/i);
  assert.match(sql,/char_length\(btrim\(body\)\) between 1 and 2000/i);
  assert.match(sql,/alter table public\.album_reviews enable row level security/i);
  assert.match(sql,/Users can add own album reviews/);
  assert.match(sql,/Users can update own album reviews/);
  assert.match(sql,/Users can delete own album reviews/);
});

test('review save keeps review text and album rating in one transaction',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260919021500_album_reviews.sql','utf8');
  assert.match(sql,/create or replace function public\.save_album_review/i);
  assert.match(sql,/insert into public\.album_ratings\(user_id,album_id,rating\)/i);
  assert.match(sql,/on conflict \(user_id,album_id\)/i);
  assert.match(sql,/insert into public\.album_reviews\(album_id,user_id,body\)/i);
  assert.match(sql,/grant execute on function public\.save_album_review/i);
});

test('helpful votes are separate from reviews and cannot target your own review',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260919021500_album_reviews.sql','utf8');
  assert.match(sql,/create table public\.album_review_likes/i);
  assert.match(sql,/primary key \(review_id,user_id\)/i);
  assert.match(sql,/r\.user_id<>\(select auth\.uid\(\)\)/i);
  assert.match(sql,/Users can remove own review likes/);
});

test('album detail mounts reviews between About and Marketplace',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const about=html.indexOf('id="detailAboutAlbum"');
  const reviews=html.indexOf('id="detailReviews"');
  const marketplace=html.indexOf('class="marketplace-panel"');
  assert.ok(about>=0&&reviews>about&&marketplace>reviews);
  assert.match(html,/\/css\/reviews-detail\.css\?v=\d+/);
  const controller=html.indexOf('/js/album-review-controller.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(controller>=0&&app>controller);
});

test('review controller owns loading writing editing deleting and helpful votes',()=>{
  const source=fs.readFileSync('js/album-review-controller.js','utf8');
  assert.match(source,/\.from\('album_reviews'\)/);
  assert.match(source,/api\.rpc\('save_album_review'/);
  assert.match(source,/\.from\('album_review_likes'\)/);
  assert.match(source,/data-review-write/);
  assert.match(source,/data-review-edit/);
  assert.match(source,/data-review-delete/);
  assert.match(source,/data-review-like/);
  assert.match(source,/maxlength="2000"/);
  assert.match(source,/UserProfileCore\.avatarMarkup/);
});

test('review layout has dedicated desktop tablet and mobile placement',()=>{
  const css=fs.readFileSync('css/reviews-detail.css','utf8');
  assert.match(css,/grid-column:1\/3/);
  assert.match(css,/@media screen and \(max-width:1120px\) and \(min-width:761px\)/);
  assert.match(css,/\.album-reviews\{grid-column:1\/-1;grid-row:4/);
  assert.match(css,/@media screen and \(max-width:760px\)/);
  assert.match(css,/grid-row:7!important/);
  assert.match(css,/\.marketplace-panel\{grid-row:8!important\}/);
  assert.match(css,/\.album-review-editor\{align-items:flex-end;padding:0\}/);
});

test('Escape closes the review editor before it can close the album overlay',()=>{
  const controller=fs.readFileSync('js/album-review-controller.js','utf8');
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(controller,/function handleEscape\(\)/);
  assert.match(controller,/return true/);
  assert.doesNotMatch(controller,/addEventListener\('keydown',handleKeyDown\)/);
  const reviewEscape=app.indexOf('albumReviewController&&albumReviewController.handleEscape()');
  const marketEscape=app.indexOf('marketplaceController.handleEscape()',reviewEscape);
  const closeAlbum=app.indexOf("albumOverlay.className.indexOf('visible')",marketEscape);
  assert.ok(reviewEscape>=0&&marketEscape>reviewEscape&&closeAlbum>marketEscape);
});

test('app opens reviews with album detail and closes them with the overlay',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(app,/var AlbumReviewController=window\.GroovyAlbumReviewController/);
  assert.match(app,/AlbumReviewController\.create\(\{/);
  assert.match(app,/albumReviewController\.openForRecord\(record,index\)/);
  assert.match(app,/albumReviewController\.openForRecord\(record,SEARCH_PREVIEW_INDEX\)/);
  assert.match(app,/albumReviewController\.close\(\)/);
  assert.match(app,/ratingController\.loadData\(\[detail\.albumId\],user\.id\)/);
});
