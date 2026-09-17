const fs=require('fs');

const appPath='js/app.js';
const workflowPath='.github/workflows/test.yml';
let app=fs.readFileSync(appPath,'utf8');

const oldRegion=`function marketplaceRegionCurrency(){
  var region='';
  try{
    var locale=(navigator.languages&&navigator.languages[0])||navigator.language||'';
    if(typeof Intl.Locale==='function')region=(new Intl.Locale(locale)).region||'';
    if(!region){var match=String(locale).match(/[-_]([A-Z]{2})\\b/i);region=match?match[1].toUpperCase():'';}
  }catch(error){}

  var byRegion={SE:'SEK',NO:'NOK',DK:'DKK',GB:'GBP',US:'USD',CA:'CAD',AU:'AUD',NZ:'NZD',CH:'CHF',JP:'JPY',PL:'PLN',CZ:'CZK',AT:'EUR',BE:'EUR',CY:'EUR',DE:'EUR',EE:'EUR',ES:'EUR',FI:'EUR',FR:'EUR',GR:'EUR',HR:'EUR',IE:'EUR',IT:'EUR',LT:'EUR',LU:'EUR',LV:'EUR',MT:'EUR',NL:'EUR',PT:'EUR',SI:'EUR',SK:'EUR'};
  if(byRegion[region])return byRegion[region];

  try{
    var timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
    if(timezone==='Europe/Stockholm')return 'SEK';
    if(timezone==='Europe/Oslo')return 'NOK';
    if(timezone==='Europe/Copenhagen')return 'DKK';
    if(timezone==='Europe/London')return 'GBP';
    if(timezone==='Europe/Zurich')return 'CHF';
    if(timezone==='Europe/Warsaw')return 'PLN';
    if(timezone==='Europe/Prague')return 'CZK';
    if(/^Europe\\//.test(timezone))return 'EUR';
  }catch(error){}
  return 'EUR';
}`;

const newRegion=`function marketplaceRegionCurrency(){
  var locale=(navigator.languages&&navigator.languages[0])||navigator.language||'';
  var timezone='';
  try{timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(error){}
  return MarketplaceCore.regionCurrency(locale,timezone);
}`;

const oldFormat=`function marketplaceFormatMoney(amount,currency){
  if(!isFinite(amount)||amount<=0)return '';
  try{
    return new Intl.NumberFormat((navigator.languages&&navigator.languages[0])||navigator.language||undefined,{style:'currency',currency:String(currency||'EUR').toUpperCase(),currencyDisplay:'narrowSymbol',minimumFractionDigits:0,maximumFractionDigits:String(currency||'').toUpperCase()==='JPY'?0:2}).format(amount);
  }catch(error){return Math.round(amount*100)/100+' '+String(currency||'').toUpperCase();}
}`;

const newFormat=`function marketplaceFormatMoney(amount,currency){
  var locale=(navigator.languages&&navigator.languages[0])||navigator.language||undefined;
  return MarketplaceCore.formatMoney(amount,currency,locale);
}`;

if(!app.includes(oldRegion))throw new Error('Expected marketplaceRegionCurrency block was not found; refusing to modify app.js');
if(!app.includes(oldFormat))throw new Error('Expected marketplaceFormatMoney block was not found; refusing to modify app.js');

app=app.replace(oldRegion,newRegion).replace(oldFormat,newFormat);
fs.writeFileSync(appPath,app);

const originalWorkflow=`name: Tests\n\non:\n  push:\n    branches: [notes]\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  node-tests:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n      - name: Check out repository\n        uses: actions/checkout@v4\n      - name: Set up Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: '22'\n      - name: Run regression tests\n        run: node --test tests/*.test.js\n`;
fs.writeFileSync(workflowPath,originalWorkflow);
fs.unlinkSync(__filename);
console.log('Marketplace currency helper extraction applied safely.');
