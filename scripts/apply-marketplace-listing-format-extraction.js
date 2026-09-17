const fs=require('fs');
const file='js/app.js';
let source=fs.readFileSync(file,'utf8');

const replacements=[
  [
`function traderaPrice(listing){
  var amount=Number(listing.buyNowPrice||listing.nextBid||listing.currentBid||listing.openingBid||0);
  if(!isFinite(amount)||amount<=0)return '';

  try{
    return new Intl.NumberFormat('sv-SE',{
      style:'currency',
      currency:String(listing.currency||'SEK'),
      maximumFractionDigits:0
    }).format(amount);
  }catch(error){
    return Math.round(amount)+' kr';
  }
}`,
`function traderaPrice(listing){
  return MarketplaceCore.listingPrice(listing,'sv-SE');
}`
  ],
  [
`function traderaEndsText(value){
  var date=new Date(value);
  if(!value||isNaN(date.getTime()))return '';

  return 'Ends '+date.toLocaleDateString('sv-SE',{
    day:'numeric',
    month:'short'
  })+' · '+date.toLocaleTimeString('sv-SE',{
    hour:'2-digit',
    minute:'2-digit'
  });
}`,
`function traderaEndsText(value){
  return MarketplaceCore.listingEndsText(value,'sv-SE');
}`
  ]
];

for(const [before,after] of replacements){
  const first=source.indexOf(before);
  if(first===-1)throw new Error('Expected marketplace formatter block was not found; refusing to modify app.js');
  if(source.indexOf(before,first+before.length)!==-1)throw new Error('Marketplace formatter block appeared more than once; refusing to modify app.js');
  source=source.slice(0,first)+after+source.slice(first+before.length);
}

fs.writeFileSync(file,source);
console.log('Marketplace listing formatter extraction applied. app.js is now '+Buffer.byteLength(source)+' bytes.');
