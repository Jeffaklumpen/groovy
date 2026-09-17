const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const appPath=path.join(root,'js','app.js');
const indexPath=path.join(root,'index.html');
let app=fs.readFileSync(appPath,'utf8');
let index=fs.readFileSync(indexPath,'utf8');

function replaceRange(source,startMarker,endMarker,replacement,label){
  const start=source.indexOf(startMarker);
  if(start<0)throw new Error('Missing '+label+' start marker');
  const end=source.indexOf(endMarker,start);
  if(end<0)throw new Error('Missing '+label+' end marker');
  return source.slice(0,start)+replacement+'\n\n'+source.slice(end);
}

if(app.includes('var MarketplaceView=window.GroovyMarketplaceView;'))throw new Error('MarketplaceView already wired');
app=app.replace(
  'var MarketplaceCore=window.GroovyMarketplaceCore;\n',
  'var MarketplaceCore=window.GroovyMarketplaceCore;\nvar MarketplaceView=window.GroovyMarketplaceView;\n'
);
if(!app.includes('var MarketplaceView=window.GroovyMarketplaceView;'))throw new Error('Could not wire MarketplaceView');

const traderaReplacement=`function setTraderaButtonState(state,count){
  MarketplaceView.applyButtonState(traderaButton,traderaButtonLabel,'Tradera',state,count);
}

function renderTraderaListings(){
  MarketplaceView.renderListings(traderaListingsGrid,traderaListings,'Tradera','sv-SE');
}

function openTraderaModal(){
  var record=records[traderaAlbumIndex];
  if(!record)return;
  MarketplaceView.openListingsModal({
    modal:traderaModal,
    closeButton:closeTraderaModalButton,
    subtitle:traderaModalSubtitle,
    status:traderaListingsStatus,
    grid:traderaListingsGrid,
    listings:traderaListings,
    button:traderaButton,
    marketplace:'Tradera',
    artist:record[1],
    album:record[2],
    locale:'sv-SE',
    emptyText:'No active listings found for this album right now.'
  });
}

function closeTraderaModal(){
  MarketplaceView.closeListingsModal(traderaModal);
}`;

app=replaceRange(
  app,
  'function setTraderaButtonState(state,count){',
  'async function loadTraderaListings(record,index){',
  traderaReplacement,
  'Tradera listing UI'
);

const ebayReplacement=`function setEbayButtonState(state,count){
  MarketplaceView.applyButtonState(ebayButton,ebayButtonLabel,'eBay',state,count);
}

function renderEbayListings(){
  MarketplaceView.renderListings(ebayListingsGrid,ebayListings,'eBay','sv-SE');
}

function openEbayModal(){
  var record=records[ebayAlbumIndex];
  if(!record)return;
  MarketplaceView.openListingsModal({
    modal:ebayModal,
    closeButton:closeEbayModalButton,
    subtitle:ebayModalSubtitle,
    status:ebayListingsStatus,
    grid:ebayListingsGrid,
    listings:ebayListings,
    button:ebayButton,
    marketplace:'eBay',
    artist:record[1],
    album:record[2],
    locale:'sv-SE',
    emptyText:'No active vinyl LP listings found for this album right now.'
  });
}

function closeEbayModal(){
  MarketplaceView.closeListingsModal(ebayModal);
}`;

app=replaceRange(
  app,
  'function setEbayButtonState(state,count){',
  'async function loadEbayListings(record,index){',
  ebayReplacement,
  'eBay listing UI'
);

if(app.includes('function traderaPrice(')||app.includes('function traderaEndsText('))throw new Error('Legacy listing format wrappers remain');
if(!app.includes('MarketplaceView.openListingsModal'))throw new Error('Marketplace view modal delegation missing');

const coreTag='<script src="/js/marketplace-core.js?v=1"></script>';
const viewTag='<script src="/js/marketplace-view.js?v=1"></script>';
if(index.includes(viewTag))throw new Error('Marketplace view script already present');
if(!index.includes(coreTag))throw new Error('Marketplace core script tag missing');
index=index.replace(coreTag,coreTag+'\n'+viewTag);
if(!index.includes('/js/app.js?v=143'))throw new Error('Expected app.js cache version not found');
index=index.replace('/js/app.js?v=143','/js/app.js?v=144');

fs.writeFileSync(appPath,app);
fs.writeFileSync(indexPath,index);
console.log('Marketplace listing view extraction applied. app.js is now '+Buffer.byteLength(app)+' bytes.');
