const test=require('node:test');
const assert=require('node:assert/strict');
const Library=require('../js/library-core.js');

function record(number,artist,album,year,genre,rating,shelfOrder,addedAt){
  const item=new Array(18).fill('');
  item[0]=number;
  item[1]=artist;
  item[2]=album;
  item[3]=year;
  item[4]=genre;
  item[5]=rating;
  item[14]=shelfOrder;
  item[17]=addedAt||'';
  return item;
}

const alpha=record(3,'ABBA','Arrival','1976','Pop',5,2);
const floyd=record(1,'Pink Floyd','The Dark Side of the Moon','1973','Progressive Rock',4,3);
const beatles=record(2,'The Beatles','Help!','1965','Rock',5,1);

test('filterRecords searches artist, album, year and genre case-insensitively',()=>{
  const records=[alpha,floyd,beatles];
  assert.deepEqual(Library.filterRecords(records,{query:'dark',selectedRating:'all'}),[floyd]);
  assert.deepEqual(Library.filterRecords(records,{query:'1976',selectedRating:'all'}),[alpha]);
  assert.deepEqual(Library.filterRecords(records,{query:'ROCK',selectedRating:'all'}),[floyd,beatles]);
});

test('filterRecords preserves rating filtering and ignores it for wishlist',()=>{
  const records=[alpha,floyd,beatles];
  assert.deepEqual(Library.filterRecords(records,{query:'',selectedRating:'5',isWishlist:false}),[alpha,beatles]);
  assert.deepEqual(Library.filterRecords(records,{query:'',selectedRating:'5',isWishlist:true}),records);
});

test('sortRecords handles album, artist and year modes',()=>{
  const records=[alpha,floyd,beatles];
  assert.deepEqual(Library.sortRecords(records,{sort:'album-asc'}),[alpha,beatles,floyd]);
  assert.deepEqual(Library.sortRecords(records,{sort:'artist-desc'}),[beatles,floyd,alpha]);
  assert.deepEqual(Library.sortRecords(records,{sort:'year-desc'}),[alpha,floyd,beatles]);
  assert.deepEqual(Library.sortRecords(records,{sort:'year-asc'}),[beatles,floyd,alpha]);
});

test('sortRecords uses real added_at timestamps for Date added newest first',()=>{
  const older=record(1,'Older','First','1970','Rock',0,null,'2026-01-01T10:00:00Z');
  const newest=record(3,'Newest','Third','1972','Rock',0,null,'2026-09-18T10:00:00Z');
  const middle=record(2,'Middle','Second','1971','Rock',0,null,'2026-06-01T10:00:00Z');
  assert.deepEqual(Library.sortRecords([older,newest,middle],{sort:'date-added'}),[newest,middle,older]);
});

test('sortRecords uses shelf order only on an active collection shelf',()=>{
  const records=[alpha,floyd,beatles];
  assert.deepEqual(Library.sortRecords(records,{sort:'standard',activeShelfId:'all',isWishlist:false}),[floyd,beatles,alpha]);
  assert.deepEqual(Library.sortRecords(records,{sort:'standard',activeShelfId:'shelf-a',isWishlist:false}),[beatles,alpha,floyd]);
  assert.deepEqual(Library.sortRecords(records,{sort:'standard',activeShelfId:'shelf-a',isWishlist:true}),[floyd,beatles,alpha]);
});

test('sortRecords keeps missing shelf positions last and does not mutate input',()=>{
  const missing=record(4,'Missing','Order','2000','Rock',0,null);
  const records=[missing,alpha,beatles];
  const before=records.slice();
  assert.deepEqual(Library.sortRecords(records,{sort:'standard',activeShelfId:'shelf-a'}),[beatles,alpha,missing]);
  assert.deepEqual(records,before);
});
