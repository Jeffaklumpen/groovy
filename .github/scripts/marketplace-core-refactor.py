from pathlib import Path

app=Path('js/app.js')
source=app.read_text()

old="""function safeExternalUrl(value){
  try{
    var url=new URL(String(value||''));
    return url.protocol==='https:'||url.protocol==='http:'?url.href:'';
  }catch(error){
    return '';
  }
}
"""
new="""function safeExternalUrl(value){
  return MarketplaceCore.safeExternalUrl(value);
}
"""
if source.count(old)!=1:
    raise SystemExit('safeExternalUrl source block did not match exactly once')
source=source.replace(old,new,1)

old="""function marketplaceBuyNowCandidates(listings,marketplace){
  return (listings||[]).map(function(listing){
    var amount=Number(listing&&listing.buyNowPrice||0);
    if(!isFinite(amount)||amount<=0)return null;
    return {amount:amount,currency:String(listing.currency||'EUR').toUpperCase(),marketplace:marketplace,url:safeExternalUrl(listing.url),listing:listing};
  }).filter(Boolean);
}
"""
new="""function marketplaceBuyNowCandidates(listings,marketplace){
  return MarketplaceCore.buyNowCandidates(listings,marketplace);
}
"""
if source.count(old)!=1:
    raise SystemExit('marketplaceBuyNowCandidates source block did not match exactly once')
source=source.replace(old,new,1)

old="""var RatingCore=window.GroovyRatingCore;
if(!Record)throw new Error('GroovyRecord must load before app.js');"""
new="""var RatingCore=window.GroovyRatingCore;
var MarketplaceCore=window.GroovyMarketplaceCore;
if(!Record)throw new Error('GroovyRecord must load before app.js');"""
if source.count(old)!=1:
    raise SystemExit('dependency declaration block did not match exactly once')
source=source.replace(old,new,1)

old="""if(!RatingCore)throw new Error('GroovyRatingCore must load before app.js');

window.records = [];"""
new="""if(!RatingCore)throw new Error('GroovyRatingCore must load before app.js');
if(!MarketplaceCore)throw new Error('GroovyMarketplaceCore must load before app.js');

window.records = [];"""
if source.count(old)!=1:
    raise SystemExit('dependency guard block did not match exactly once')
source=source.replace(old,new,1)
app.write_text(source)

Path('js/marketplace-core.js').write_text("""(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyMarketplaceCore=api;
})(typeof window!=='undefined'?window:null,function(){
  function safeExternalUrl(value){
    try{
      var url=new URL(String(value||''));
      return url.protocol==='https:'||url.protocol==='http:'?url.href:'';
    }catch(error){
      return '';
    }
  }

  function buyNowCandidates(listings,marketplace){
    return (listings||[]).map(function(listing){
      var amount=Number(listing&&listing.buyNowPrice||0);
      if(!isFinite(amount)||amount<=0)return null;
      return {amount:amount,currency:String(listing.currency||'EUR').toUpperCase(),marketplace:marketplace,url:safeExternalUrl(listing.url),listing:listing};
    }).filter(Boolean);
  }

  return Object.freeze({
    safeExternalUrl:safeExternalUrl,
    buyNowCandidates:buyNowCandidates
  });
});
""")

Path('tests/marketplace-core.test.js').write_text("""const test=require('node:test');
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
""")

index=Path('index.html')
html=index.read_text()
old='<script src="/js/rating-core.js?v=1"></script>\n<script src="/js/wikipedia-service.js?v=1"></script>\n<script src="/js/app.js?v=132"></script>'
new='<script src="/js/rating-core.js?v=1"></script>\n<script src="/js/marketplace-core.js?v=1"></script>\n<script src="/js/wikipedia-service.js?v=1"></script>\n<script src="/js/app.js?v=133"></script>'
if html.count(old)!=1:
    raise SystemExit('index script block did not match exactly once')
index.write_text(html.replace(old,new,1))

test_file=Path('tests/app-bootstrap-order.test.js')
test_source=test_file.read_text()
old="['/js/notification-core.js?v=','/js/pressing-core.js?v=','/js/rating-core.js?v=']"
new="['/js/notification-core.js?v=','/js/pressing-core.js?v=','/js/rating-core.js?v=','/js/marketplace-core.js?v=']"
if test_source.count(old)!=1:
    raise SystemExit('bootstrap script list did not match exactly once')
test_file.write_text(test_source.replace(old,new,1))

docs=Path('docs/ARCHITECTURE.md')
doc=docs.read_text()
old='- `js/rating-core.js` — pure 0–5 rating normalization and display formatting helpers.\n'
new=old+'- `js/marketplace-core.js` — pure external-listing URL validation and buy-now candidate normalization.\n'
if doc.count(old)!=1:
    raise SystemExit('architecture rating-core line did not match exactly once')
docs.write_text(doc.replace(old,new,1))
