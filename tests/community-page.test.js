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
  assert.match(view,/Collected Records/);
  assert.match(view,/taste_similarity/);
  assert.match(view,/Genre overlap/);
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
  assert.match(view,/apple-music-badge-small\.svg/);
  assert.match(view,/spotify-full-logo-green\.svg/);
  assert.match(view,/apple-music-small-badge/);
  assert.match(view,/spotify-service-logo/);
  const coverFunction=view.slice(view.indexOf('function coverMarkup'),view.indexOf('function avatar'));
  assert.doesNotMatch(coverFunction,/serviceLinks/);
  assert.doesNotMatch(css,/community-cover-services/);
});


test('community statistics use requested order and Top Rated moves to the wide panel',()=>{
  const view=fs.readFileSync('js/community-view.js','utf8');
  const statisticsStart=view.indexOf("panel('Community Statistics'");
  const statisticsEnd=view.indexOf("panel('Top rated albums'");
  const statistics=view.slice(statisticsStart,statisticsEnd);
  const collected=statistics.indexOf('Most collected albums');
  const wishlisted=statistics.indexOf('Most wishlisted albums');
  const artists=statistics.indexOf('Most collected artists');
  assert.ok(collected>=0&&wishlisted>collected&&artists>wishlisted);
  assert.match(statistics,/albumRows\(data\.most_wishlisted_albums,'wishlist'\)/);
  assert.match(view,/panel\('Top rated albums','trophy',topRatedAlbums\(data\.top_rated_albums\)/);
  assert.doesNotMatch(view,/panel\('Most wishlisted albums'/);
});

test('Community uses a three-person icon in the menu and shared people icon',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const view=fs.readFileSync('js/community-view.js','utf8');
  const css=fs.readFileSync('css/community.css','utf8');
  assert.match(html,/community-tab-icon[\s\S]*circle cx="12" cy="7"[\s\S]*circle cx="5\.4" cy="9"[\s\S]*circle cx="18\.6" cy="9"/);
  assert.match(view,/people:'<circle cx="12" cy="7" r="2\.6"\/><circle cx="5\.4" cy="9" r="2\.1"\/><circle cx="18\.6" cy="9" r="2\.1"\/>/);
  assert.match(css,/\.community-tab \.community-tab-icon\{width:18px;height:18px/);
  assert.doesNotMatch(css,/community-tab-icon:before|community-tab-icon:after/);
});


test('community albums delegate to the shared search preview flow',()=>{
  const view=fs.readFileSync('js/community-view.js','utf8');
  const controller=fs.readFileSync('js/community-controller.js','utf8');
  const app=fs.readFileSync('js/app.js','utf8');
  const search=fs.readFileSync('js/album-search.js','utf8');

  assert.match(view,/data-community-album-id/);
  assert.match(controller,/onOpenAlbum/);
  assert.match(controller,/community-streaming-row a/);
  assert.match(app,/communityAlbumPreviewHandler/);
  assert.match(app,/albumSearchController\.openCatalogPreview\(albumId\)/);
  assert.match(search,/async function openCatalogAlbumPreview\(albumId,options\)/);
  assert.match(search,/add_existing_album_to_library/);
  assert.match(search,/onPreview\(\{/);
});

test('existing catalog fallback only mutates a user library entry',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918174737_add_existing_album_to_library.sql','utf8');
  assert.match(sql,/function public\.add_existing_album_to_library/i);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/insert into public\.collections/i);
  assert.match(sql,/insert into public\.wishlists/i);
  assert.doesNotMatch(sql,/insert into public\.(?:albums|artists|tracks)/i);
  assert.match(sql,/revoke execute[\s\S]*anon/i);
  assert.match(sql,/grant execute[\s\S]*authenticated/i);
});


test('background auth refresh does not rerender the current route',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const profile=fs.readFileSync('js/profile.js','utf8');
  const statistics=fs.readFileSync('js/statistics.js','utf8');
  assert.match(app,/event==='TOKEN_REFRESHED'/);
  assert.match(app,/event==='SIGNED_IN'&&sameUser/);
  assert.match(app,/event==='INITIAL_SESSION'/);
  assert.match(profile,/event==='TOKEN_REFRESHED'/);
  assert.match(statistics,/event==='TOKEN_REFRESHED'/);
});

test('Top Rated mobile streaming controls stay inside their album card',()=>{
  const css=fs.readFileSync('css/community.css','utf8');
  assert.match(css,/\.community-album-copy \.community-streaming-row\{grid-column:1\/-1/);
  assert.match(css,/\.community-streaming-card \.spotify-service-logo\{width:43px;max-width:43px\}/);
});
