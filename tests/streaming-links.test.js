const test=require('node:test');
const assert=require('node:assert/strict');
const Streaming=require('../js/streaming-links.js');

test('builds Spotify album search URLs',()=>{
  assert.equal(
    Streaming.spotifySearchUrl('Pink Floyd','The Wall'),
    'https://open.spotify.com/search/Pink%20Floyd%20The%20Wall'
  );
});

test('builds Apple Music fallback URLs with the requested storefront',()=>{
  assert.equal(
    Streaming.appleMusicSearchUrl('Pink Floyd','The Wall','', 'se'),
    'https://music.apple.com/se/search?term=Pink%20Floyd%20The%20Wall'
  );
});

test('preserves saved Apple Music and iTunes URLs',()=>{
  const musicUrl='https://music.apple.com/se/album/the-wall/1065975633';
  const itunesUrl='https://itunes.apple.com/se/album/id1065975633';
  assert.equal(Streaming.appleMusicSearchUrl('Pink Floyd','The Wall',musicUrl,'se'),musicUrl);
  assert.equal(Streaming.appleMusicSearchUrl('Pink Floyd','The Wall',itunesUrl,'se'),itunesUrl);
});

test('ignores non-Apple saved URLs',()=>{
  assert.equal(
    Streaming.appleMusicSearchUrl('ABBA','The Album','https://example.com/not-apple','us'),
    'https://music.apple.com/us/search?term=ABBA%20The%20Album'
  );
});
