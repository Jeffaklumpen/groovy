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
