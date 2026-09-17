const assert=require('node:assert/strict');
const test=require('node:test');
const statistics=require('../js/statistics-core.js');

test('builds collection statistics from records, ratings and pressing details',function(){
  const rows=[
    {
      discogs_style:'Prog Rock · Art Rock',
      discogs_release_id:10,
      media_condition:'NM',
      pressing_country:'UK',
      albums:{id:1,title:'First',release_year:1973,cover_url:'one.jpg',artists:{name:'Pink Floyd'},tracks:[{id:1,disc_side:'A'},{id:2,disc_side:'B'}]}
    },
    {
      discogs_style:'Prog Rock · Psychedelic Rock',
      media_condition:'VG+',
      pressing_country:'UK',
      albums:{id:2,title:'Second',release_year:1979,cover_url:'two.jpg',artists:{name:'Pink Floyd (2)'},tracks:[{id:3,disc_side:'A'},{id:4,disc_side:'C'}]}
    },
    {
      discogs_style:'Pop Rock',
      albums:{id:3,title:'Newest',release_year:1982,artists:{name:'ABBA'},tracks:[]}
    }
  ];

  const result=statistics.build(rows,4,[{album_id:1,rating:5},{album_id:2,rating:3},{album_id:99,rating:1}]);
  assert.equal(result.collectionCount,3);
  assert.equal(result.wishlistCount,4);
  assert.equal(result.artistCount,2);
  assert.equal(result.oldest.title,'First');
  assert.equal(result.newest.title,'Newest');
  assert.equal(result.topStyles[0].label,'Prog Rock');
  assert.equal(result.topArtists[0].label,'Pink Floyd');
  assert.equal(result.topDecades[0].label,'1970s');
  assert.equal(result.averageAlbumRating,4);
  assert.equal(result.fiveStarAlbums,1);
  assert.equal(result.identifiedPressings,1);
  assert.equal(result.topCountries[0].label,'UK');
});

test('returns calm empty states for a new collection',function(){
  const result=statistics.build([],0,[],[]);
  assert.equal(result.collectionCount,0);
  assert.equal(result.oldest,null);
  assert.equal(result.newest,null);
  assert.equal(result.averageAlbumRating,0);
  assert.deepEqual(result.topStyles,[]);
});

test('builds streaming search URLs without duplicating view logic',function(){
  const release={artist:'Pink Floyd',title:'The Wall'};
  assert.equal(statistics.spotifySearchUrl(release),'https://open.spotify.com/search/Pink%20Floyd%20The%20Wall');
  assert.equal(statistics.appleSearchUrl(release),'https://music.apple.com/us/search?term=Pink%20Floyd%20The%20Wall');
});

test('keeps a saved Apple Music URL when one is available',function(){
  const release={artist:'ABBA',title:'Arrival',appleUrl:'https://music.apple.com/se/album/arrival/1422648512'};
  assert.equal(statistics.appleSearchUrl(release),release.appleUrl);
});
