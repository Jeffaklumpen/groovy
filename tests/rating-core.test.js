const test=require('node:test');
const assert=require('node:assert/strict');
const Rating=require('../js/rating-core.js');

test('clamps ratings to the 0-5 range',()=>{
  assert.equal(Rating.clamp(-2),0);
  assert.equal(Rating.clamp(3.7),3.7);
  assert.equal(Rating.clamp(9),5);
  assert.equal(Rating.clamp('not-a-number'),0);
});

test('formats community ratings exactly as the app did',()=>{
  assert.equal(Rating.format(0),'—');
  assert.equal(Rating.format(4),'4');
  assert.equal(Rating.format(4.24),'4.2');
  assert.equal(Rating.format(4.25),'4.3');
});

test('builds stable star fill percentages',()=>{
  assert.equal(Rating.fillPercent(0),'0.0%');
  assert.equal(Rating.fillPercent(2.5),'50.0%');
  assert.equal(Rating.fillPercent(5),'100.0%');
  assert.equal(Rating.fillPercent(8),'100.0%');
});
