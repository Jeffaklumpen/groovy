const test=require('node:test');
const assert=require('node:assert/strict');
const Apple=require('../js/apple-search-core.js');

test('Apple search core exports the extracted pure helpers',()=>{
  [
    'normalizeAppleSearchText','appleArtistMatches','appleAlbumMatches',
    'appleArtworkUrl','applePreviewArtworkUrl','appleAlbumData',
    'normalizeAppleFullTitle','appleEditionPenalty','appleReleaseIsExcluded'
  ].forEach((name)=>assert.equal(typeof Apple[name],'function',name+' should be exported'));
});

test('artist matching ignores a leading The and accents',()=>{
  assert.equal(Apple.appleArtistMatches('The Beatles','Beatles'),true);
  assert.equal(Apple.appleArtistMatches('Beyonce','Beyoncé'),true);
  assert.equal(Apple.appleArtistMatches('Pink Floyd','Fleetwood Mac'),false);
});

test('album matching keeps exact titles and rejects unrelated titles',()=>{
  assert.equal(Apple.appleAlbumMatches('Abbey Road','Abbey Road','The Beatles'),true);
  assert.equal(Apple.appleAlbumMatches('Animals','The Wall','Pink Floyd'),false);
});

test('Apple artwork helpers expand the iTunes artwork size',()=>{
  const album={artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/example/100x100bb.jpg'};
  assert.equal(Apple.appleArtworkUrl(album),'https://is1-ssl.mzstatic.com/image/thumb/example/1200x1200bb.jpg');
  assert.equal(Apple.applePreviewArtworkUrl(album),'https://is1-ssl.mzstatic.com/image/thumb/example/300x300bb.jpg');
  assert.equal(Apple.appleArtworkUrl(null),'');
});

test('edition helpers penalize and exclude deluxe variants',()=>{
  const plain=Apple.appleEditionPenalty('Abbey Road','Abbey Road');
  const deluxe=Apple.appleEditionPenalty('Abbey Road Deluxe Edition','Abbey Road');
  assert.ok(deluxe>plain);
  assert.equal(Apple.appleReleaseIsExcluded('Abbey Road Deluxe Edition'),true);
  assert.equal(Apple.appleReleaseIsExcluded('Abbey Road'),false);
});
