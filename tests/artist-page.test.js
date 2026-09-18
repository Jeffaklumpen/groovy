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
  assert.match(view,/Current members/);
  assert.match(view,/Past members/);
  assert.match(view,/Main Discography/);
  assert.match(view,/Official website/);
  assert.match(view,/FROM WIKIPEDIA/);
  assert.match(view,/Collected Records/);
  assert.match(view,/Collectors/);
  assert.match(view,/Wishlisted Records/);
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

test('artist and album navigation preserve contextual back behavior',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const view=fs.readFileSync('js/artist-view.js','utf8');
  const html=fs.readFileSync('index.html','utf8');
  assert.match(view,/data-artist-back-album/);
  assert.match(html,/id="detailContextBack"/);
  assert.match(app,/groovyReopenAlbum/);
  assert.match(app,/restoreAlbumFromHistoryState/);
  assert.match(app,/window\.groovyAlbumDetailNavigation=Object\.freeze/);
  assert.match(app,/navigation\.getContext\(\)/);
  assert.match(app,/navigation\.reopenLibraryAlbumById\(context\.albumId\)/);
  assert.match(app,/navigationContext=\{source:'artist'/);
  assert.match(app,/artistSource:'search'/);
});
