const fs=require('fs');
const file='js/app.js';
let source=fs.readFileSync(file,'utf8');

const before=`function marketplaceDisplayCurrency(){
  var preference=marketplaceCurrencyPreference();
  return preference==='auto'?marketplaceRegionCurrency():preference;
}`;
const after=`function marketplaceDisplayCurrency(){
  return MarketplaceCore.displayCurrency(marketplaceCurrencyPreference(),marketplaceRegionCurrency());
}`;

const first=source.indexOf(before);
if(first===-1)throw new Error('Expected marketplace display currency block was not found; refusing to modify app.js');
if(source.indexOf(before,first+before.length)!==-1)throw new Error('Marketplace display currency block appeared more than once; refusing to modify app.js');
source=source.slice(0,first)+after+source.slice(first+before.length);

fs.writeFileSync(file,source);
console.log('Marketplace display currency extraction applied. app.js is now '+Buffer.byteLength(source)+' bytes.');
