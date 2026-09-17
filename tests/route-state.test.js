const test=require('node:test');
const assert=require('node:assert/strict');
const {
  profileUsernameFromPath,
  resolveProfileView,
  libraryViewFromSearch,
  statisticsFromSearch,
  albumIdentityKey
}=require('../js/route-state.js');

test('recognises and decodes current shelf URLs',function(){
  assert.equal(profileUsernameFromPath('/shelf/Jeffaklumpen'),'Jeffaklumpen');
  assert.equal(profileUsernameFromPath('/shelf/Anna%20Maria/'),'Anna Maria');

  // Keep the legacy /user route readable while links are migrated to /shelf.
  assert.equal(profileUsernameFromPath('/user/Jeffaklumpen'),'Jeffaklumpen');

  assert.equal(profileUsernameFromPath('/'),null);
  assert.equal(profileUsernameFromPath('/groovy/user/Jeffaklumpen'),null);
  assert.equal(profileUsernameFromPath('/other/user/Jeffaklumpen'),null);
  assert.equal(profileUsernameFromPath('/shelf/%E0%A4%A'),null);
});

test('reads the library view from the URL',function(){
  assert.equal(libraryViewFromSearch('?view=wishlist'),'wishlist');
  assert.equal(libraryViewFromSearch('?view=collection'),'collection');
  assert.equal(libraryViewFromSearch(''),'collection');
});

test('recognises a directly linked statistics view',function(){
  assert.equal(statisticsFromSearch('?stats=1'),true);
  assert.equal(statisticsFromSearch('?view=wishlist&stats=1'),true);
  assert.equal(statisticsFromSearch('?view=wishlist'),false);
});

test('matches the same album across formatting and edition suffixes',function(){
  assert.equal(
    albumIdentityKey('Beyoncé','Renaissance (Deluxe Edition)'),
    albumIdentityKey('Beyonce','Renaissance')
  );
  assert.notEqual(
    albumIdentityKey('Toto','Toto IV'),
    albumIdentityKey('Toto','The Seventh One')
  );
});

test('requires login before a shelf profile is resolved',function(){
  assert.equal(resolveProfileView(null,null),'login-required');
});

test('distinguishes missing, own and other shelf profiles',function(){
  const signedInUser={id:'user-1'};

  assert.equal(resolveProfileView(signedInUser,null),'not-found');
  assert.equal(resolveProfileView(signedInUser,{id:'user-1'}),'own');
  assert.equal(resolveProfileView(signedInUser,{id:'user-2'}),'other');
});


test('profile routing does not monkey patch browser history or route helpers',function(){
  const fs=require('node:fs');
  const path=require('node:path');
  const root=path.resolve(__dirname,'..');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const profile=fs.readFileSync(path.join(root,'js','profile.js'),'utf8');

  assert.match(app,/groovy-route-change/);
  assert.doesNotMatch(app,/['"]\/user\/['"]\+encodeURIComponent/);
  assert.doesNotMatch(profile,/history\.pushState\s*=|history\.replaceState\s*=|__groovyShelfRoutesPatched/);
  assert.doesNotMatch(profile,/GroovyRouteState\.profileUsernameFromPath\s*=/);
  assert.match(profile,/addEventListener\('groovy-route-change',syncRoute\)/);
});


test('own collection loader cannot invalidate a viewed shelf load',function(){
  const fs=require('node:fs');
  const path=require('node:path');
  const app=fs.readFileSync(path.resolve(__dirname,'..','js','app.js'),'utf8');
  const start=app.indexOf('window.loadCollection=async function(){');
  const end=app.indexOf('async function refreshLibraryStyles',start);
  assert.ok(start>=0&&end>start,'loadCollection block should exist');
  const block=app.slice(start,end);
  const routeGuard=block.indexOf("var path=window.location.pathname;");
  const loadVersion=block.indexOf('var loadVersion=++window.collectionLoadVersion;');
  assert.ok(routeGuard>=0,'route guard should exist');
  assert.ok(loadVersion>routeGuard,'load version must be incremented only after the public shelf route guard');
});


test('viewed shelf rating helpers are available outside the collection module',function(){
  const fs=require('node:fs');
  const path=require('node:path');
  const app=fs.readFileSync(path.resolve(__dirname,'..','js','app.js'),'utf8');
  assert.match(app,/window\.loadAlbumRatingData=ratingController\.loadData/);
  assert.match(app,/window\.applyAlbumRatingMeta=Record\.applyRatingMeta/);
});

test('notification realtime channel is subscribed before the first awaited reload',function(){
  const fs=require('node:fs');
  const path=require('node:path');
  const controller=fs.readFileSync(path.resolve(__dirname,'..','js','notification-controller.js'),'utf8');
  const start=controller.indexOf('async function syncUser(user)');
  const end=controller.indexOf('async function togglePanel()',start);
  assert.ok(start>=0&&end>start);
  const block=controller.slice(start,end);
  const subscribe=block.indexOf('.subscribe();');
  const initialLoad=block.lastIndexOf('await load();');
  assert.ok(subscribe>=0&&initialLoad>subscribe,'channel must exist before an awaited notification load can race');
});


test('viewed shelf loader uses public rating facades across the app IIFE boundary',function(){
  const fs=require('node:fs');
  const path=require('node:path');
  const app=fs.readFileSync(path.resolve(__dirname,'..','js','app.js'),'utf8');

  const iifeStart=app.indexOf('(function(){',app.indexOf('function copyDetailsFromRow'));
  const iifeEnd=app.indexOf('})();',iifeStart);
  const start=app.indexOf('async function loadOtherUserCollection(userId){');
  const end=app.indexOf('async function loadUserFromUrl(){',start);

  assert.ok(iifeStart>=0&&iifeEnd>iifeStart&&start>iifeEnd&&end>start,'viewed shelf loader should remain outside the main app IIFE');
  const block=app.slice(start,end);
  assert.match(block,/window\.loadAlbumRatingData\(albumIds,ownRatingUserId\)/);
  assert.match(block,/window\.applyAlbumRatingMeta\(\[/);
  assert.doesNotMatch(block,/\bratingController\b/);
  assert.doesNotMatch(block,/\bRecord\./);
});
