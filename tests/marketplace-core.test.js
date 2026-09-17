const test=require('node:test');
const assert=require('node:assert/strict');
const Marketplace=require('../js/marketplace-core.js');

test('safeExternalUrl allows only http and https URLs',()=>{
  assert.equal(Marketplace.safeExternalUrl('https://example.com/item?id=1'),'https://example.com/item?id=1');
  assert.equal(Marketplace.safeExternalUrl('http://example.com/test'),'http://example.com/test');
  assert.equal(Marketplace.safeExternalUrl('javascript:alert(1)'),'');
  assert.equal(Marketplace.safeExternalUrl('/relative/path'),'');
  assert.equal(Marketplace.safeExternalUrl(''),'');
});

test('buyNowCandidates filters invalid prices and normalizes fields',()=>{
  const good={buyNowPrice:'149.50',currency:'sek',url:'https://example.com/listing/1',title:'Record'};
  const rows=Marketplace.buyNowCandidates([
    good,
    {buyNowPrice:0,currency:'EUR',url:'https://example.com/zero'},
    {buyNowPrice:'nope',currency:'USD',url:'https://example.com/bad'},
    null
  ],'Tradera');
  assert.equal(rows.length,1);
  assert.equal(rows[0].amount,149.5);
  assert.equal(rows[0].currency,'SEK');
  assert.equal(rows[0].marketplace,'Tradera');
  assert.equal(rows[0].url,'https://example.com/listing/1');
  assert.equal(rows[0].listing,good);
});

test('buyNowCandidates defaults missing currency and strips unsafe URL',()=>{
  const rows=Marketplace.buyNowCandidates([{buyNowPrice:10,url:'javascript:alert(1)'}],'eBay');
  assert.equal(rows.length,1);
  assert.equal(rows[0].currency,'EUR');
  assert.equal(rows[0].url,'');
});

test('cacheKey normalizes surrounding whitespace and case',()=>{
  assert.equal(Marketplace.cacheKey('  Pink Floyd ',' The Dark Side Of The Moon  '),'pink floyd|the dark side of the moon');
});

test('normalizeIdentity removes accents punctuation and expands ampersands',()=>{
  assert.equal(Marketplace.normalizeIdentity('Beyoncé & JAY-Z'),'beyonce and jay z');
});

test('isRelevantListing keeps ordinary artist album combinations',()=>{
  assert.equal(Marketplace.isRelevantListing({title:'Pink Floyd Animals LP'},'Pink Floyd','Animals'),true);
});

test('isRelevantListing filters unrelated self-titled listings',()=>{
  assert.equal(Marketplace.isRelevantListing({title:'ABBA LP 1975 Swedish pressing'},'ABBA','ABBA'),true);
  assert.equal(Marketplace.isRelevantListing({title:'ABBA Arrival LP'},'ABBA','ABBA'),false);
});

test('regionCurrency preserves locale mapping and timezone fallback',()=>{
  assert.equal(Marketplace.regionCurrency('sv-SE','Europe/London'),'SEK');
  assert.equal(Marketplace.regionCurrency('en-GB','Europe/Stockholm'),'GBP');
  assert.equal(Marketplace.regionCurrency('en','Europe/Stockholm'),'SEK');
  assert.equal(Marketplace.regionCurrency('en','Europe/Berlin'),'EUR');
  assert.equal(Marketplace.regionCurrency('en','America/Chicago'),'EUR');
});

test('formatMoney keeps marketplace formatting behavior',()=>{
  assert.equal(Marketplace.formatMoney(0,'SEK','sv-SE'),'');
  assert.equal(Marketplace.formatMoney(-1,'SEK','sv-SE'),'');
  assert.match(Marketplace.formatMoney(149.5,'USD','en-US'),/149\.5/);
  assert.doesNotMatch(Marketplace.formatMoney(1234.56,'JPY','en-US'),/\.56/);
});
