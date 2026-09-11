const test=require('node:test');
const assert=require('node:assert/strict');
const {
  profileUsernameFromPath,
  resolveProfileView,
  libraryViewFromSearch,
  albumIdentityKey
}=require('../js/route-state.js');

test('recognises and decodes a profile URL',function(){
  assert.equal(profileUsernameFromPath('/groovy/user/Jeffaklumpen'),'Jeffaklumpen');
  assert.equal(profileUsernameFromPath('/groovy/user/Anna%20Maria/'),'Anna Maria');
  assert.equal(profileUsernameFromPath('/groovy/'),null);
  assert.equal(profileUsernameFromPath('/other/user/Jeffaklumpen'),null);
  assert.equal(profileUsernameFromPath('/groovy/user/%E0%A4%A'),null);
});

test('reads the library view from the URL',function(){
  assert.equal(libraryViewFromSearch('?view=wishlist'),'wishlist');
  assert.equal(libraryViewFromSearch('?view=collection'),'collection');
  assert.equal(libraryViewFromSearch(''),'collection');
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

test('requires login before a profile is resolved',function(){
  assert.equal(resolveProfileView(null,null),'login-required');
});

test('distinguishes missing, own and other profiles',function(){
  const signedInUser={id:'user-1'};

  assert.equal(resolveProfileView(signedInUser,null),'not-found');
  assert.equal(resolveProfileView(signedInUser,{id:'user-1'}),'own');
  assert.equal(resolveProfileView(signedInUser,{id:'user-2'}),'other');
});
