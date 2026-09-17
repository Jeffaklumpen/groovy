const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('album search wishlist button uses shared modal styling for all states',()=>{
  const css=fs.readFileSync('css/style.css','utf8');
  assert.match(css,/#addAlbumModal \.mb-wishlist-button,\.search-modal-box \.mb-wishlist-button\{/);
  assert.match(css,/#addAlbumModal \.mb-wishlist-button:hover,\.search-modal-box \.mb-wishlist-button:hover\{/);
  assert.match(css,/#addAlbumModal \.mb-wishlist-button:active,\.search-modal-box \.mb-wishlist-button:active\{/);
  assert.match(css,/#addAlbumModal \.mb-wishlist-button\.mb-wishlisted,\.search-modal-box \.mb-wishlist-button\.mb-wishlisted\{/);
});
