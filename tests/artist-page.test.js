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

test('verified artist discography resolves trusted identity while Wikipedia alone owns membership',()=>{
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const start=edge.indexOf("if (action === 'verifyArtistDiscography')");
  const end=edge.indexOf("if (action === 'artistProfile')",start);
  assert.ok(start>=0&&end>start);
  const block=edge.slice(start,end);
  assert.match(edge,/P1953/);
  assert.match(edge,/sitefilter=enwiki/);
  assert.match(edge,/wikipediaStudioAlbumsFromHtml/);
  assert.match(edge,/standardised studio albums/);
  assert.match(block,/Wikipedia alone decides which releases belong to Main Discography/);
  assert.match(block,/\[catalogResult,structuredAlbums\]=await Promise\.all/);
  assert.match(block,/source:'wikipedia'/);
  assert.match(block,/discogs_master_id:master/);
  assert.doesNotMatch(block,/function wikidataRows/);
  assert.doesNotMatch(block,/source:'wikidata'/);
  assert.doesNotMatch(block,/wikidataId:String/);
});

test('artist navigation resolves missing Discogs identity without loading the full profile first',()=>{
  const controller=fs.readFileSync('js/artist-controller.js','utf8');
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  assert.match(controller,/function resolveArtistIdentity\(input\)/);
  assert.match(controller,/action:'resolveArtist'/);
  const navigateStart=controller.indexOf('async function navigateResolved');
  const navigateEnd=controller.indexOf('function renderCurrent',navigateStart);
  const navigateBlock=controller.slice(navigateStart,navigateEnd);
  assert.match(navigateBlock,/resolveArtistIdentity/);
  assert.ok(
    navigateBlock.indexOf('resolveArtistIdentity')<navigateBlock.indexOf('fetchProfile'),
    'lightweight identity resolution must happen before the full Discogs profile fallback'
  );
  assert.match(edge,/if \(action === 'resolveArtist'\)/);
  assert.match(edge,/score<70/);
});

test('shared verified discography cache is checked before Wikidata network resolution',()=>{
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const start=edge.indexOf("if (action === 'verifyArtistDiscography')");
  const end=edge.indexOf("if (action === 'artistProfile')",start);
  const block=edge.slice(start,end);
  const cacheRead=block.indexOf("select('wikidata_id,discography_checked_at,discography_source,discography_count')");
  const externalLookup=block.indexOf('wikidataArtistQidByDiscogsId(resolvedArtistId)');
  assert.ok(cacheRead>=0&&externalLookup>cacheRead);
  assert.match(block,/cachedSource==='wikipedia' && cachedCount>0/);
  assert.match(block,/verified:true,[\s\S]*cached:true/);
  assert.match(block,/let resolvedWikidataId=cachedWikidataId/);
});

test('artist prefetch fills the shared discography and artwork caches before navigation when possible',()=>{
  const controller=fs.readFileSync('js/artist-controller.js','utf8');
  const prefetchStart=controller.indexOf('function prefetch(input)');
  const prefetchEnd=controller.indexOf('async function localArtistByDiscogsId',prefetchStart);
  const block=controller.slice(prefetchStart,prefetchEnd);
  assert.match(block,/resolveArtistIdentity\(input\)/);
  assert.match(block,/ensureDiscographyCached\(resolvedId,name\)/);
  assert.match(block,/ensureArtworkCached\(resolvedId,name,overview\)/);
  assert.match(controller,/var discographyJobs=new Map\(\)/);
  assert.match(controller,/var artworkJobs=new Map\(\)/);
});

test('Apple artwork warming is scoped to the verified Main Discography cache',()=>{
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const start=edge.indexOf("if (action === 'cacheArtistArtwork')");
  const end=edge.indexOf("if (action === 'verifyArtistDiscography')",start);
  const block=edge.slice(start,end);
  assert.match(block,/\.from\('artist_discography_cache'\)/);
  assert.match(block,/\.eq\('discogs_artist_id',resolvedArtistId\)/);
  assert.doesNotMatch(block,/\.from\('musicbrainz_catalog'\)/);
  assert.match(block,/apple_artwork_cache/);
  assert.match(block,/apple_collection_url/);
  assert.match(block,/artwork_url/);
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


test('unverified artist discography fallback only accepts direct MusicBrainz-to-Discogs matches',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918190916_tighten_artist_discography_fallback.sql','utf8');
  assert.match(sql,/mb\.match_type='direct'/);
  assert.match(sql,/where not v_discography_verified/);
});


test('old unvalidated artist discography verification is reset before trusted identity matching',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918192036_reset_untrusted_artist_discography_verification.sql','utf8');
  assert.match(sql,/delete from public\.artist_discography_cache/i);
  assert.match(sql,/wikidata_id=null/i);
  assert.match(sql,/source in \('wikipedia','wikidata','manual'\)/i);
});


test('artist overview preserves discography verification state and hides unchecked fallback albums',()=>{
  const core=fs.readFileSync('js/artist-core.js','utf8');
  const view=fs.readFileSync('js/artist-view.js','utf8');
  assert.match(core,/discography_verified:!!raw\.discography_verified/);
  assert.match(core,/discography_source:String\(raw\.discography_source\|\|'unchecked'\)/);
  assert.match(view,/overview\.discography_source==='unchecked'/);
  assert.match(view,/Checking main discography/);
});

test('discography verifier always resolves the pending UI state even when verification falls back',()=>{
  const controller=fs.readFileSync('js/artist-controller.js','utf8');
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const verifyStart=controller.indexOf('function verifyDiscographyInBackground');
  const verifyEnd=controller.indexOf('function loadWikipediaInBackground',verifyStart);
  const verifyBlock=controller.slice(verifyStart,verifyEnd);
  assert.match(verifyBlock,/loadOverview\(name,true\)/);
  assert.doesNotMatch(verifyBlock,/!result\.data\.verified\|\|!result\.data\.changed/);
  assert.match(edge,/reason:'wikidata_identity_missing'/);
  assert.match(edge,/discography_source:'fallback'/);
});

test('discography source is exposed by the live read-model migration',()=>{
  const sql=fs.readFileSync('supabase/migrations/20260918192457_expose_artist_discography_verification_state.sql','utf8');
  assert.match(sql,/v_discography_source text := 'unchecked'/);
  assert.match(sql,/'discography_source',v_discography_source/);
});


test('Wikipedia studio tables own Main Discography independently of local Discogs enrichment',()=>{
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  const sql=fs.readFileSync('supabase/migrations/20260918203147_wikipedia_owned_artist_discography.sql','utf8');
  const view=fs.readFileSync('js/artist-view.js','utf8');
  const start=edge.indexOf("if (action === 'verifyArtistDiscography')");
  const end=edge.indexOf("if (action === 'artistProfile')",start);
  const block=edge.slice(start,end);

  assert.match(edge,/function wikipediaStudioAlbumsFromHtml/);
  assert.match(edge,/const firstList=html\.match\(\/<ul/);
  assert.match(edge,/Released\\s\*:/);
  assert.match(edge,/wikipediaParse\([\s\S]*?'text'/);
  assert.match(block,/Wikipedia alone decides which releases belong to Main Discography/i);
  assert.match(block,/\[catalogResult,structuredAlbums\]=await Promise\.all/);
  assert.doesNotMatch(block,/source:'wikidata'/);
  assert.match(block,/source_key:sourceKey/);
  assert.match(block,/const mbid=String\(local\?\.mbid\|\|structured\?\.mbid\|\|''\)/);
  assert.match(block,/discogs_master_id:master/);

  assert.match(sql,/alter column mbid drop not null/i);
  assert.match(sql,/alter column discogs_master_id drop not null/i);
  assert.match(sql,/primary key \(discogs_artist_id, source_key\)/i);
  assert.match(sql,/adc\.position::bigint as sort_position/i);
  assert.match(sql,/delete from public\.artist_discography_cache/i);

  assert.match(view,/item\.mbid\?\('https:\/\/coverartarchive\.org\/release-group\//);
  assert.match(view,/aria-disabled="true"/);
});
