const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ArtistCore=require('../js/artist-core.js');
const ArtistWikipedia=require('../js/artist-wikipedia-service.js');

test('artist routes use stable Discogs identity and readable slugs',()=>{
  assert.equal(ArtistCore.route(123,'Pink Floyd'),'/artist/123-pink-floyd');
  assert.equal(ArtistCore.route(456,'Beyoncé & Jay-Z'),'/artist/456-beyonce-and-jay-z');
});

test('artist page exposes the requested profile information',()=>{
  const view=fs.readFileSync('js/artist-view.js','utf8');
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/id="artistPage"/);
  assert.match(view,/artist-photo-shell/);
  assert.match(view,/artist-genres/);
  assert.match(view,/concat\(profile\.genres\|\|\[\],overview\.genres\|\|\[\]\)/);
  assert.match(view,/Current members/);
  assert.match(view,/Past members/);
  assert.match(view,/Main Discography/);
  assert.match(view,/Official website/);
  assert.match(view,/FROM WIKIPEDIA/);
  assert.match(view,/Collected Records/);
  assert.match(view,/Collectors/);
  assert.match(view,/Wishlisted Records/);
  const metrics=view.slice(view.indexOf("'<div class=\"artist-metrics\">'"),view.indexOf("'</div>'+",view.indexOf("'<div class=\"artist-metrics\">'"))+9);
  assert.ok(metrics.indexOf("'Collectors'")<metrics.indexOf("'Collected Records'"));
  assert.ok(metrics.indexOf("'Collected Records'")<metrics.indexOf("'Wishlisted Records'"));
});

test('artist Wikipedia selects two useful top-level sections and only free Commons images',()=>{
  const source=fs.readFileSync('js/artist-wikipedia-service.js','utf8');
  assert.match(source,/topSections\(page,2\)/);
  assert.match(source,/references\|external links\|see also/i);
  assert.match(source,/LicenseShortName/);
  assert.match(source,/freeLicense/);
  assert.doesNotMatch(source,/discogs.*image/i);
  assert.ok(ArtistWikipedia.candidateScore({title:'Pink Floyd',extract:'English rock band'},'Pink Floyd')>25);
});

test('artist database foundation stores identity and returns Groovy stats plus base discography',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918181354_artist_pages_foundation.sql','utf8');
  assert.match(sql,/add column if not exists discogs_artist_id bigint/i);
  assert.match(sql,/function public\.get_artist_overview/i);
  assert.match(sql,/musicbrainz_catalog/i);
  assert.match(sql,/secondary_types/i);
  assert.match(sql,/Soundtrack/);
  assert.match(sql,/collected_records/);
  assert.match(sql,/wishlisted_records/);
  assert.match(sql,/revoke execute[\s\S]*anon/i);
  assert.match(sql,/grant execute[\s\S]*authenticated/i);
});

test('Discogs artist integration returns identity members genres and official URL but no artist image',()=>{
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const start=edge.indexOf("if (action === 'artistProfile')");
  const end=edge.indexOf("if (action === 'master')",start);
  assert.ok(start>=0&&end>start);
  const block=edge.slice(start,end);
  assert.match(block,/current_members/);
  assert.match(block,/past_members/);
  assert.match(block,/genres:genres/);
  assert.match(block,/official_url/);
  assert.doesNotMatch(block,/artist\.images|thumb|cover_image/);
});

test('existing album search renders artist results without replacing album results',()=>{
  const search=fs.readFileSync('js/album-search.js','utf8');
  assert.match(search,/function renderArtistSearchResults/);
  assert.match(search,/search-result-section-title/);
  assert.match(search,/albumHeading\.textContent='ALBUMS'/);
  assert.match(search,/onArtistNavigate/);
  assert.match(search,/openDiscogsMasterPreview/);
});

test('artist and album navigation preserve contextual back behavior without a second album back control',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const view=fs.readFileSync('js/artist-view.js','utf8');
  const html=fs.readFileSync('index.html','utf8');
  assert.match(view,/data-artist-back-album/);
  assert.doesNotMatch(html,/id="detailContextBack"/);
  assert.match(app,/groovyReopenAlbum/);
  assert.match(app,/restoreAlbumFromHistoryState/);
  assert.match(app,/window\.groovyAlbumDetailNavigation=Object\.freeze/);
  assert.match(app,/navigation\.getContext\(\)/);
  assert.match(app,/navigation\.reopenLibraryAlbumById\(context\.albumId\)/);
  assert.match(app,/artistSource:'search'/);
});


test('artist pages render from local data before external enrichment and warm artwork asynchronously',()=>{
  const controller=fs.readFileSync('js/artist-controller.js','utf8');
  assert.match(controller,/api\.rpc\('get_artist_overview'/);
  assert.match(controller,/currentProfile=emptyProfile\(id,name\);[\s\S]*loadOverview\(name,false\)/);
  assert.match(controller,/renderCurrent\(version\);[\s\S]*loadProfileInBackground/);
  assert.match(controller,/loadWikipediaInBackground/);
  assert.match(controller,/warmArtworkInBackground/);
  assert.match(controller,/action:'cacheArtistArtwork'/);
});

test('artist discography and search read Apple artwork from persistent cache rather than live Apple search',()=>{
  const search=fs.readFileSync('js/album-search.js','utf8');
  const enrichStart=search.indexOf('async function enrichSearchResultsWithApple');
  const enrichEnd=search.indexOf('async function searchDiscogs',enrichStart);
  const enrich=search.slice(enrichStart,enrichEnd);
  assert.match(enrich,/getPersistentAppleArtworkCache/);
  assert.doesNotMatch(enrich,/itunes\.apple\.com|searchApplePreviewArtwork/);

  const masterStart=search.indexOf('async function openDiscogsMasterPreview');
  const masterEnd=search.indexOf('async function openCatalogAlbumPreview',masterStart);
  const master=search.slice(masterStart,masterEnd);
  assert.match(master,/getPersistentAppleArtworkCache/);
  assert.doesNotMatch(master,/searchAppleAlbumArtwork/);

  const saveStart=search.indexOf('async function saveAlbumFromDiscogs');
  const saveEnd=search.indexOf('async function saveExistingCatalogAlbum',saveStart);
  assert.doesNotMatch(search.slice(saveStart,saveEnd),/searchAppleAlbumArtwork/);
});

test('artist cache migration joins Apple artwork into the main discography',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918184046_artist_profile_and_artwork_cache.sql','utf8');
  assert.match(sql,/create table if not exists public\.artist_profile_cache/i);
  assert.match(sql,/left join public\.apple_artwork_cache/i);
  assert.match(sql,/coalesce\(aac\.artwork_url,a\.cover_url\)/i);
  assert.match(sql,/apple_artwork_cached/i);
  assert.match(sql,/artwork_cache/i);
});

test('artist artwork cache batches an Apple artist lookup and persists all matched album URLs',()=>{
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const start=edge.indexOf("if (action === 'cacheArtistArtwork')");
  const end=edge.indexOf("if (action === 'artistProfile')",start);
  assert.ok(start>=0&&end>start);
  const block=edge.slice(start,end);
  assert.match(block,/entity=musicArtist/);
  assert.match(block,/entity=album&limit=200/);
  assert.match(block,/apple_artwork_cache/);
  assert.match(block,/artwork_url/);
  assert.match(block,/apple_collection_url/);
  assert.match(block,/\.from\('albums'\)/);
});


test('artist artwork cache is normalized to high resolution at the database boundary',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918185340_normalize_apple_artwork_cache_resolution.sql','utf8');
  assert.match(sql,/1200x1200bb/);
  assert.match(sql,/before insert or update of artwork_url/i);
  assert.match(sql,/update public\.apple_artwork_cache/i);
});

test('returning from artist restores the album before the underlying route is revealed',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const routeStart=app.indexOf('var artistRoute=GroovyRouteState.artistFromPath');
  const earlyRestore=app.indexOf('restoredAlbumEarly=await restoreAlbumFromHistoryState();',routeStart);
  const hideArtist=app.indexOf('artistController.hidePage();',routeStart);
  assert.ok(routeStart>=0&&earlyRestore>routeStart&&hideArtist>earlyRestore);
  assert.match(app,/if\(!restoredAlbumEarly\)await restoreAlbumFromHistoryState\(\)/);
});


test('artist Wikipedia exposes Wikidata identity for structured discography verification',()=>{
  const source=fs.readFileSync('js/artist-wikipedia-service.js','utf8');
  assert.match(source,/pageprops/);
  assert.match(source,/wikibase_item/);
  assert.match(source,/wikidata_id/);
});

test('artist overview is prefetched from album detail and reused by artist routes',()=>{
  const controller=fs.readFileSync('js/artist-controller.js','utf8');
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(controller,/var overviewCache=new Map\(\)/);
  assert.match(controller,/function prefetch\(input\)/);
  assert.match(controller,/loadOverview\(name,false\)/);
  assert.match(app,/window\.groovyPrefetchArtist/);
  assert.match(app,/groovyPrefetchArtist\(\{id:previewArtistId,name:artist\}\)/);
});

test('verified artist discography uses Wikidata studio albums and stable catalog IDs',()=>{
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const start=edge.indexOf("if (action === 'verifyArtistDiscography')");
  const end=edge.indexOf("if (action === 'artistProfile')",start);
  assert.ok(start>=0&&end>start);
  const block=edge.slice(start,end);
  assert.match(edge,/Q208569/);
  assert.match(edge,/P436/);
  assert.match(edge,/P1954/);
  assert.match(block,/artist_discography_cache/);
  assert.match(block,/wikidataCoverage>=0\.55/);
  assert.match(block,/baselineCoverage>=0\.55/);
});

test('verified discography cache replaces the loose fallback only when populated',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918190526_verified_artist_discography_cache.sql','utf8');
  assert.match(sql,/create table if not exists public\.artist_discography_cache/i);
  assert.match(sql,/v_discography_verified/i);
  assert.match(sql,/verified_rows/i);
  assert.match(sql,/where not v_discography_verified/i);
  assert.match(sql,/discography_verified/i);
});

test('auth UI profile read is cached across ordinary route changes',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(app,/authUiProfileCache/);
  assert.match(app,/Date\.now\(\)-authUiProfileCache\.loadedAt<60000/);
  assert.match(app,/loadAuthUiProfile\(user,!!options\.forceProfile\)/);
});
