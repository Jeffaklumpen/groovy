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
