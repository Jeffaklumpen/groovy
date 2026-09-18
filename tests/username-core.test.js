const test=require('node:test');
const assert=require('node:assert/strict');
const UserProfileCore=require('../js/user-profile-core.js');

test('username validation has one shared 3-30 character contract',()=>{
  assert.equal(UserProfileCore.validUsername('Jeff_94'),true);
  assert.equal(UserProfileCore.validUsername('Åsa-LP'),true);
  assert.equal(UserProfileCore.validUsername('ab'),false);
  assert.equal(UserProfileCore.validUsername('a'.repeat(31)),false);
  assert.equal(UserProfileCore.validUsername('bad name'),false);
  assert.equal(UserProfileCore.validUsername('bad/name'),false);
  assert.equal(UserProfileCore.validUsername(''),false);
});


test('profile avatar helpers use username initials instead of the vinyl placeholder',()=>{
  assert.equal(UserProfileCore.firstLetter('jeff'),'J');
  assert.equal(UserProfileCore.firstLetter('Åsa'),'Å');
  assert.equal(UserProfileCore.firstLetter(''),'');
  assert.deepEqual(UserProfileCore.avatarState('', 'jeff'),{hasImage:false,url:'',initial:'J'});
  const fallback=UserProfileCore.avatarMarkup('test-avatar','','jeff');
  assert.match(fallback,/groovy-initial-avatar/);
  assert.match(fallback,/>J<\/span>/);
  assert.doesNotMatch(fallback,/avatar-placeholder/);
  assert.match(UserProfileCore.avatarMarkup('test-avatar','avatar.jpg','jeff'),/background-image/);
});
