const fs=require('fs');

function replaceOnce(source,search,replacement,label){
  const first=source.indexOf(search);
  if(first<0)throw new Error('Missing anchor: '+label);
  if(source.indexOf(search,first+search.length)>=0)throw new Error('Anchor is not unique: '+label);
  return source.slice(0,first)+replacement+source.slice(first+search.length);
}

function removeRange(source,start,end,label){
  const startIndex=source.indexOf(start);
  if(startIndex<0)throw new Error('Missing range start: '+label);
  const endIndex=source.indexOf(end,startIndex+start.length);
  if(endIndex<0)throw new Error('Missing range end: '+label);
  return source.slice(0,startIndex)+source.slice(endIndex);
}

let app=fs.readFileSync('js/app.js','utf8');

app=replaceOnce(
  app,
  "var MarketplaceCore=window.GroovyMarketplaceCore;\nvar ShelfCore=window.GroovyShelfCore;",
  "var MarketplaceCore=window.GroovyMarketplaceCore;\nvar MarketplaceUI=window.GroovyMarketplaceUI;\nvar ShelfCore=window.GroovyShelfCore;",
  'MarketplaceUI declaration'
);
app=replaceOnce(
  app,
  "if(!MarketplaceCore)throw new Error('GroovyMarketplaceCore must load before app.js');\nif(!ShelfCore)",
  "if(!MarketplaceCore)throw new Error('GroovyMarketplaceCore must load before app.js');\nif(!MarketplaceUI)throw new Error('GroovyMarketplaceUI must load before app.js');\nif(!ShelfCore)",
  'MarketplaceUI dependency check'
);

app=removeRange(
  app,
  "var traderaButton=document.getElementById('traderaButton');\n",
  "var copyDetails=document.getElementById('copyDetails');\n",
  'marketplace DOM references'
);

app=removeRange(
  app,
  "var traderaAlbumIndex=-1;\n",
  "var libraryPage=1;\n",
  'marketplace state'
);

app=removeRange(
  app,
  "function safeExternalUrl(value){\n",
  "function hasCopyDetails(details){\n",
  'marketplace controller functions'
);

app=replaceOnce(
  app,
  "  detailOpenRecordIndex=index;\n  closeTraderaModal();\n  closeEbayModal();\n  resetMarketplacePriceSummary(index);\n  loadTraderaListings(record,index);\n  if(ebayEnabled)loadEbayListings(record,index);\n  copyDetailsRecordKey='';",
  "  detailOpenRecordIndex=index;\n  MarketplaceUI.prepareAlbum(record,index);\n  copyDetailsRecordKey='';",
  'openAlbum marketplace handoff'
);

app=replaceOnce(
  app,
  "  closeTraderaModal();\n  closeEbayModal();\n  traderaRequestVersion++;\n  ebayRequestVersion++;\n  clearMarketplacePriceSummary();\n  albumOverlay.className='album-overlay';",
  "  MarketplaceUI.reset();\n  albumOverlay.className='album-overlay';",
  'closeAlbum marketplace reset'
);

const listenerStart="syncMarketplaceCurrencyControl();\nif(marketplaceCurrencySelect)marketplaceCurrencySelect.addEventListener('change',function(){";
const listenerEnd="albumOverlay.onclick=function(event){";
app=removeRange(app,listenerStart,listenerEnd,'marketplace event listeners');

const oldEscape=`  if(event.keyCode===27){\n    if(ebayModal.classList.contains('visible')){\n      closeEbayModal();\n      return;\n    }\n    if(traderaModal.classList.contains('visible')){\n      closeTraderaModal();\n      return;\n    }\n    if(albumOverlay.className.indexOf('visible')!==-1){\n      closeAlbum();\n    }\n    return;\n  }`;
const newEscape=`  if(event.keyCode===27){\n    if(MarketplaceUI.closeVisibleModal())return;\n    if(albumOverlay.className.indexOf('visible')!==-1){\n      closeAlbum();\n    }\n    return;\n  }`;
app=replaceOnce(app,oldEscape,newEscape,'Escape marketplace handoff');

if(app.includes("function safeExternalUrl(value){"))throw new Error('Marketplace controller still exists in app.js');
if(app.includes("var traderaAlbumIndex=-1;"))throw new Error('Marketplace state still exists in app.js');
if(!app.includes('MarketplaceUI.prepareAlbum(record,index);'))throw new Error('openAlbum handoff missing');
if(!app.includes('MarketplaceUI.reset();'))throw new Error('closeAlbum handoff missing');
if(!app.includes('MarketplaceUI.closeVisibleModal()'))throw new Error('Escape handoff missing');
fs.writeFileSync('js/app.js',app);

let html=fs.readFileSync('index.html','utf8');
html=replaceOnce(
  html,
  '<script src="/js/marketplace-core.js?v=1"></script>\n',
  '<script src="/js/marketplace-core.js?v=1"></script>\n<script src="/js/marketplace-ui.js?v=1"></script>\n',
  'marketplace UI script tag'
);
html=replaceOnce(html,'<script src="/js/app.js?v=143"></script>','<script src="/js/app.js?v=144"></script>','app cache version');
fs.writeFileSync('index.html',html);

let bootstrap=fs.readFileSync('tests/app-bootstrap-order.test.js','utf8');
const marker="test('Apple search core is initialized before first use in app.js',()=>{";
const marketplaceTest=`test('marketplace UI loads after its core and before app.js',()=>{\n  const html=fs.readFileSync('index.html','utf8');\n  const core=html.indexOf('/js/marketplace-core.js?v=');\n  const ui=html.indexOf('/js/marketplace-ui.js?v=');\n  const app=html.indexOf('/js/app.js?v=');\n  assert.ok(core>=0,'marketplace-core.js script is missing');\n  assert.ok(ui>=0,'marketplace-ui.js script is missing');\n  assert.ok(app>=0,'app.js script is missing');\n  assert.ok(core<ui,'marketplace-core.js must load before marketplace-ui.js');\n  assert.ok(ui<app,'marketplace-ui.js must load before app.js');\n\n  const source=fs.readFileSync('js/app.js','utf8');\n  const declaration=source.indexOf('var MarketplaceUI=window.GroovyMarketplaceUI;');\n  const firstUse=source.indexOf('MarketplaceUI.prepareAlbum');\n  assert.ok(declaration>=0,'MarketplaceUI bootstrap declaration is missing');\n  assert.ok(firstUse>=0,'MarketplaceUI first use is missing');\n  assert.ok(declaration<firstUse,'MarketplaceUI must be initialized before it is used');\n});\n\n`;
bootstrap=replaceOnce(bootstrap,marker,marketplaceTest+marker,'bootstrap marketplace test');
fs.writeFileSync('tests/app-bootstrap-order.test.js',bootstrap);

const originalWorkflow=`name: Tests\n\non:\n  push:\n    branches: [notes]\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  node-tests:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n      - name: Check out repository\n        uses: actions/checkout@v4\n      - name: Set up Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: '22'\n      - name: Run regression tests\n        run: node --test tests/*.test.js\n`;
fs.writeFileSync('.github/workflows/test.yml',originalWorkflow);
fs.unlinkSync('scripts/apply-marketplace-extraction.js');

console.log('Marketplace extraction applied. app.js is now '+Buffer.byteLength(app)+' bytes.');
