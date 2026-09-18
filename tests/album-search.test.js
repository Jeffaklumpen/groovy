const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('album search is a dedicated feature module loaded before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const feature=html.indexOf('/js/album-search.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  assert.ok(feature>=0,'album-search.js script is missing');
  assert.ok(app>feature,'album-search.js must load before app.js');
});

test('album search owns search, artwork enrichment and Discogs save flow',()=>{
  const source=fs.readFileSync('js/album-search.js','utf8');
  assert.match(source,/windowObject\.GroovyAlbumSearch=Object\.freeze\(\{create:create\}\)/);
  assert.match(source,/async function searchDiscogs\(query\)/);
  assert.match(source,/async function searchAppleAlbumArtwork\(artist,albumTitle,originalYear\)/);
  assert.match(source,/async function saveAlbumFromDiscogs\(master,artist,albumTitle,year,coverState,button,destination\)/);
  assert.match(source,/async function getSearchLibraryState\(user\)/);
  assert.equal(source.includes('async function loadOtherUserCollection(userId)'),false);
  assert.equal(source.includes('async function renderCurrentRoute()'),false);
});

test('search results expose a detail-preview callback without moving save ownership into app.js',()=>{
  const source=fs.readFileSync('js/album-search.js','utf8');
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(source,/var onPreview=typeof options\.onPreview===['"]function['"]/);
  assert.match(source,/div\.addEventListener\(['"]click['"]/);
  assert.match(source,/onPreview\(\{/);
  assert.match(source,/save:saveResult/);
  assert.match(app,/window\.groovyOpenSearchAlbumPreview=openSearchAlbumPreview/);
  assert.match(app,/onPreview:function\(payload\)\{return window\.groovyOpenSearchAlbumPreview\(payload\);\}/);
  assert.match(app,/Record\.fromSearchPreview/);
  assert.match(app,/searchPreview:true/);
  assert.match(app,/renderSearchPreviewActions/);
  assert.equal(app.includes('async function saveAlbumFromDiscogs('),false);
});

test('persisted Apple artwork is used before the visible search result render',()=>{
  const source=fs.readFileSync('js/album-search.js','utf8');
  const lookup=source.indexOf('await getPersistentAppleArtworkCache(searchResults)');
  const render=source.indexOf("albumSearchResults.innerHTML='';",lookup);
  assert.ok(lookup>=0,'visible search results should load persisted artwork');
  assert.ok(render>lookup,'persisted artwork should resolve before the visible results are rendered');
  assert.match(source,/\.from\('albums'\)[\s\S]*cover_url[\s\S]*apple_collection_url/);
  assert.match(source,/cachedAppleAlbumFromRow[\s\S]*100x100bb/);
  assert.match(source,/enrichSearchResultsWithApple\([\s\S]*searchResults/);
});

test('app delegates album-search behavior while retaining library integration',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  assert.match(app,/var AlbumSearch=window\.GroovyAlbumSearch;/);
  assert.match(app,/var albumSearchController=AlbumSearch\.create\(\{/);
  assert.match(app,/function openAddAlbumSearch\(user\)\{return albumSearchController\.open\(user\);\}/);
  assert.match(app,/function invalidateSearchLibraryState\(\)\{return albumSearchController\.invalidateLibraryState\(\);\}/);
  assert.equal(app.includes('async function searchDiscogs(query)'),false);
  assert.equal(app.includes('async function saveAlbumFromDiscogs('),false);
  assert.equal(app.includes('async function searchAppleAlbumArtwork('),false);
  assert.equal(app.includes('async function getSearchLibraryState('),false);
  assert.match(app,/async function loadOtherUserCollection\(userId\)/);
});

test('album library saves use the verified Discogs edge boundary instead of browser catalog writes',()=>{
  const source=fs.readFileSync('js/album-search.js','utf8');
  assert.match(source,/action:['"]saveAlbum['"]/);
  assert.match(source,/functions\.invoke\(\s*['"]discogs-search['"]/);
  assert.doesNotMatch(source,/\.rpc\(\s*['"]save_album_to_library['"]/);
  assert.doesNotMatch(source,/upsert_apple_artwork_cache/);
  assert.doesNotMatch(source,/\.from\(\s*['"]artists['"]\s*\)\s*\.insert\(/);
  assert.doesNotMatch(source,/\.from\(\s*['"]albums['"]\s*\)\s*\.insert\(/);
  assert.doesNotMatch(source,/\.from\(\s*['"]tracks['"]\s*\)\s*\.insert\(/);
});

