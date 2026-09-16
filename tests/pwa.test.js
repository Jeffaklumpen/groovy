const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const root=path.resolve(__dirname,'..');

test('manifest defines an installable root-scoped Groovy app',function(){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.short_name,'Groovy');
  assert.equal(manifest.id,'/');
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.scope,'/');
  assert.equal(manifest.display,'standalone');
  assert.deepEqual(manifest.display_override,['standalone']);
  assert.deepEqual(manifest.icons.map(function(icon){return icon.sizes;}),['192x192','512x512']);
});

test('service worker does not cache old application files',function(){
  const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  assert.doesNotMatch(worker,/caches\.open\s*\(/);
  assert.doesNotMatch(worker,/addAll\s*\(/);
  assert.match(worker,/fetch\(event\.request\)/);
});

test('mobile header offers app installation instead of a delete toggle',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const pwa=fs.readFileSync(path.join(root,'js','pwa.js'),'utf8');
  assert.match(html,/id="installAppShortcutButton"/);
  assert.doesNotMatch(html,/id="deleteModeButton"/);
  assert.match(pwa,/installShortcutButton\.addEventListener\('click',startInstall\)/);
  assert.doesNotMatch(pwa,/loadProfileModule|loadAlbumRatingLayoutV4|profile\.js|album-rating-layout-v4/);
  assert.match(html,/href="\/css\/profile\.css\?v=9"/);
  assert.match(html,/src="\/js\/profile\.js\?v=9"/);
  assert.match(html,/src="\/js\/album-rating-layout-v4\.js\?v=1"/);
});

test('long press enters delete mode before movement starts sorting',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  assert.match(app,/touchLongPressActive=true;[\s\S]*setDeleteMode\(true\)/);
  assert.match(app,/touchLongPressActive&&\(movedX>8\|\|movedY>8\)[\s\S]*startPointerDrag/);
  assert.match(app,/\.delete-cover-button,\.wishlist-remove-button,#removeAlbumModal/);
});

test('library controls and streaming links remain separate card actions',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const statistics=fs.readFileSync(path.join(root,'js','statistics.js'),'utf8');
  assert.match(html,/id="librarySortMenu"/);
  assert.match(html,/id="detailSpotifyLink"/);
  assert.match(app,/target\.closest\('\.streaming-link'\)/);
  assert.match(app,/streaming-service spotify-service/);
  assert.match(statistics,/stats-release-service stats-release-spotify/);
});

test('record rendering supports four LP track sides',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase','migrations','20260913010000_add_four_lp_matrices.sql'),'utf8');
  assert.match(app,/return \{A:\[\],B:\[\],C:\[\],D:\[\],E:\[\],F:\[\],G:\[\],H:\[\]\}/);
  assert.match(app,/var sideNames=\['A','B','C','D','E','F','G','H'\]/);
  assert.match(app,/\^\[A-H\]/);
  assert.match(app,/matrixE:item\.matrix_runout_e/);
  assert.match(migration,/matrix_runout_h text/);
});

test('login and empty collection actions use the shared viewport-safe flow',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  assert.match(html,/Track your collection/);
  assert.match(app,/document\.body\.appendChild\(loginPanel\)/);
  assert.match(app,/function openAddAlbumSearch\(user\)/);
  assert.match(app,/openAddAlbumSearch\(session\.user\)/);
  assert.match(app,/openAddAlbumSearch\(user\)/);
});

test('routing state stays pure and detail enhancements load directly',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const routeState=fs.readFileSync(path.join(root,'js','route-state.js'),'utf8');

  assert.doesNotMatch(routeState,/installRuntimeFixes|syncPublicShelfRecords|Object\.defineProperty\(windowObject,'loadCollection'/);
  assert.doesNotMatch(html,/route-runtime\.js/);
  assert.match(html,/href="\/css\/detail-enhancements\.css\?v=7"/);
  assert.match(html,/src="\/js\/detail-enhancements-v2\.js\?v=7"/);

  const statePosition=html.indexOf('/js/route-state.js');
  const appPosition=html.indexOf('/js/app.js');
  const detailPosition=html.indexOf('/js/detail-enhancements-v2.js');
  assert.ok(statePosition>=0&&appPosition>statePosition&&detailPosition>appPosition);
});

test('signup uses the auth trigger and collection membership checks are direct',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');

  assert.match(app,/handle_new_user creates the profile from signup metadata/);
  assert.doesNotMatch(app,/\.from\('profiles'\)[\s\S]{0,80}\.insert\(\{[\s\S]{0,80}id:data\.user\.id/);
  assert.match(app,/\.eq\('album_id',albumId\)\s*\.limit\(1\)/);
  assert.match(app,/\.eq\('album_id',record\[8\]\)\s*\.limit\(1\)/);
  assert.doesNotMatch(app,/\.limit\(500\)/);
});


test('document metadata is accessible and obsolete rating scripts are gone',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/<html lang="en">/);
  assert.match(html,/name="viewport" content="width=device-width, initial-scale=1.0"/);
  assert.doesNotMatch(html,/user-scalable=no|maximum-scale|minimum-scale/);
  ['album-rating-context.js','album-rating-layout-v2.js','album-rating-layout-v3.js'].forEach(function(file){
    assert.equal(fs.existsSync(path.join(root,'js',file)),false);
  });
  assert.equal(fs.existsSync(path.join(root,'js','album-rating-layout-v4.js')),true);
});
