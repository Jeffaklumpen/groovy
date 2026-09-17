const test=require('node:test');
const assert=require('node:assert/strict');
const RouteState=require('../js/route-state.js');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');

test('recognises and decodes current shelf URLs',function(){
  assert.equal(RouteState.profileUsernameFromPath('/groovy/user/Jeff'),'Jeff');
  assert.equal(RouteState.profileUsernameFromPath('/groovy/user/Jeff%20Sundin'),'Jeff Sundin');
  assert.equal(RouteState.profileUsernameFromPath('/user/Jeff'),'Jeff');
  assert.equal(RouteState.profileUsernameFromPath('/groovy/'),null);
});

test('reads the library view from the URL',function(){
  assert.equal(RouteState.libraryViewFromSearch('?view=wishlist'),'wishlist');
  assert.equal(RouteState.libraryViewFromSearch('?view=collection'),'collection');
  assert.equal(RouteState.libraryViewFromSearch(''),'collection');
});

test('recognises a directly linked statistics view',function(){
  assert.equal(RouteState.profileSectionFromSearch('?section=statistics'),'statistics');
  assert.equal(RouteState.profileSectionFromSearch('?view=wishlist'),'library');
});

test('matches the same album across formatting and edition suffixes',function(){
  assert.equal(RouteState.sameAlbum('The Beatles','Abbey Road','Beatles','Abbey Road'),true);
  assert.equal(RouteState.sameAlbum('Björk','Debut','Bjork','Debut (Remastered)'),true);
  assert.equal(RouteState.sameAlbum('Muse','Origin of Symmetry','Muse','Absolution'),false);
});

test('requires login before a shelf profile is resolved',function(){
  assert.equal(RouteState.resolveProfileView({hasUser:false,username:'Jeff'}),'login-required');
  assert.equal(RouteState.resolveProfileView({hasUser:false,username:null}),'own');
});

test('distinguishes missing, own and other shelf profiles',function(){
  assert.equal(RouteState.resolveProfileView({hasUser:true,username:'Missing',profileFound:false}),'not-found');
  assert.equal(RouteState.resolveProfileView({hasUser:true,username:'Jeff',profileFound:true,profileId:'1',currentUserId:'1'}),'own');
  assert.equal(RouteState.resolveProfileView({hasUser:true,username:'Anna',profileFound:true,profileId:'2',currentUserId:'1'}),'other');
});

test('profile routing does not monkey patch browser history or route helpers',function(){
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
  assert.match(app,/window\.loadAlbumRatingData=loadAlbumRatingData/);
  assert.match(app,/window\.applyAlbumRatingMeta=Record\.applyRatingMeta/);
});

test('notification realtime channel is subscribed before the first awaited reload',function(){
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const start=app.indexOf('async function syncNotificationSubscription(user){');
  const end=app.indexOf('function closeNotificationPanel',start);
  const block=end>start?app.slice(start,end):app.slice(start,start+5000);
  assert.ok(start>=0,'syncNotificationSubscription should exist');
  const subscribe=block.indexOf("notificationChannel.subscribe");
  const firstAwait=block.indexOf('await ');
  assert.ok(subscribe>=0,'notification channel should subscribe');
  assert.ok(firstAwait<0||subscribe<firstAwait,'notification channel must subscribe before an awaited reload can yield');
});

test('album search wishlist button uses shared modal styling for all states',function(){
  const feature=fs.readFileSync(path.join(root,'js','album-search.js'),'utf8');
  assert.match(feature,/wishlistToggleButton\.className='search-wishlist-button'/);
  assert.doesNotMatch(feature,/className='search-wishlist-button added'/);
});
