const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('community page has its own route, tab and feature modules',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(html,/id="communityTabButton"/);
  assert.match(html,/id="communityPage"/);
  assert.match(html,/\/css\/community\.css\?v=/);
  assert.match(html,/\/js\/community-core\.js\?v=/);
  assert.match(html,/\/js\/community-view\.js\?v=/);
  assert.match(html,/\/js\/community-controller\.js\?v=/);
  assert.ok(app.includes("if(/^\\/community\\/?$/.test(window.location.pathname)){"));
});

test('community controller owns overview loading and social interactions',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const controller=fs.readFileSync('js/community-controller.js','utf8');
  assert.match(controller,/api\.rpc\('get_community_overview'/);
  assert.match(controller,/socialController\.followUser/);
  assert.match(controller,/socialController\.unfollowUser/);
  assert.doesNotMatch(controller,/adjustConnections/);
  assert.doesNotMatch(app,/\.rpc\('get_community_overview'/);
  assert.doesNotMatch(app,/\.from\('community_activity'\)/);
});

test('community view uses the Collection Apple Music and Spotify assets',()=>{
  const view=fs.readFileSync('js/community-view.js','utf8');
  const css=fs.readFileSync('css/community.css','utf8');
  assert.match(view,/apple-music-badge-small\.svg/);
  assert.match(view,/spotify-full-logo-green\.svg/);
  assert.match(view,/community-streaming-row/);
  assert.match(css,/\.community-streaming-row/);
  assert.match(view,/apple-service community-streaming-apple/);
  assert.match(view,/spotify-service community-streaming-spotify/);
});

test('community migration owns global activity and read-only overview aggregation',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918170131_community_page_foundation.sql','utf8');
  assert.match(sql,/create table public\.community_activity/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/Authenticated users can read community activity/);
  assert.match(sql,/function public\.get_community_overview/i);
  assert.match(sql,/function public\.log_community_activity/i);
  assert.match(sql,/after insert on public\.collections/i);
  assert.match(sql,/after insert on public\.wishlists/i);
  assert.match(sql,/after update of rating on public\.album_ratings/i);
  assert.match(sql,/grant execute on function public\.get_community_overview[\s\S]*authenticated/i);
  assert.match(sql,/revoke all on table public\.community_activity from anon, authenticated/i);
});


test('community summary uses wishlisted records and taste cards use the statistics genre overlap metric',()=>{
  const core=fs.readFileSync('js/community-core.js','utf8');
  const view=fs.readFileSync('js/community-view.js','utf8');
  const migration=fs.readFileSync('supabase/migrations/20260918172422_community_wishlist_summary_and_genre_overlap.sql','utf8');

  assert.match(core,/wishlisted_records:number\(summary\.wishlisted_records\)/);
  assert.doesNotMatch(core,/connections:number\(summary\.connections\)/);
  assert.match(view,/Wishlisted Records/);
  assert.match(view,/taste_similarity/);
  assert.match(view,/genre overlap/);
  assert.doesNotMatch(view,/collection overlap/);
  assert.match(migration,/'wishlisted_records'/);
  assert.match(migration,/taste_similarity/);
  assert.match(migration,/regexp_split_to_table/);
  assert.match(migration,/least\(/);
});


test('similar collector cards render two separate taste metrics',()=>{
  const view=fs.readFileSync('js/community-view.js','utf8');
  const css=fs.readFileSync('css/community.css','utf8');
  assert.match(view,/community-taste-metric/);
  assert.match(view,/Records in common/);
  assert.match(view,/Genre overlap/);
  assert.match(css,/grid-template-columns:1fr 1fr/);
  assert.match(css,/community-taste-metric\+\.community-taste-metric/);
});


test('community keeps Collection streaming assets outside album artwork',()=>{
  const view=fs.readFileSync('js/community-view.js','utf8');
  const css=fs.readFileSync('css/community.css','utf8');
  assert.match(view,/apple-music-small-badge\.svg/);
  assert.match(view,/spotify-full-logo-green\.svg/);
  assert.match(view,/apple-music-small-badge/);
  assert.match(view,/spotify-service-logo/);
  const coverFunction=view.slice(view.indexOf('function coverMarkup'),view.indexOf('function avatar'));
  assert.doesNotMatch(coverFunction,/serviceLinks/);
  assert.doesNotMatch(css,/community-cover-services/);
});
