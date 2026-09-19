const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');

test('price alert migration owns user settings, dedupe and hourly scanning',()=>{
  const sql=fs.readFileSync(path.join(root,'supabase','migrations','20260919095000_marketplace_price_alerts.sql'),'utf8');
  assert.match(sql,/create table if not exists public\.marketplace_alerts/);
  assert.match(sql,/tradera_enabled boolean/);
  assert.match(sql,/ebay_enabled boolean/);
  assert.match(sql,/fixed_price boolean/);
  assert.match(sql,/auction boolean/);
  assert.match(sql,/marketplace_alert_matches_unique unique \(alert_id,marketplace,listing_id\)/);
  assert.match(sql,/notification_type in[\s\S]*'price_alert'/);
  assert.match(sql,/alter column actor_id drop not null/);
  assert.match(sql,/claim_marketplace_alert_scan/);
  assert.match(sql,/record_marketplace_alert_scan/);
  assert.match(sql,/marketplace-alert-scan-hourly/);
  assert.match(sql,/'13 \* \* \* \*'/);
});

test('background scanner evaluates both fixed price and auction matches',()=>{
  const source=fs.readFileSync(path.join(root,'supabase','functions','marketplace-alert-scan','index.ts'),'utf8');
  assert.match(source,/alert\.fixed_price&&listing\.saleTypes\.includes\('fixed'\)/);
  assert.match(source,/alert\.auction&&listing\.saleTypes\.includes\('auction'\)/);
  assert.match(source,/listing\.nextBid\|\|listing\.currentBid\|\|listing\.openingBid/);
  assert.match(source,/traderaCache=new Map/);
  assert.match(source,/ebayCache=new Map/);
  assert.match(source,/record_marketplace_alert_scan/);
});

test('marketplace APIs expose sale types needed by alerts',()=>{
  const tradera=fs.readFileSync(path.join(root,'supabase','functions','tradera-search','index.ts'),'utf8');
  const ebay=fs.readFileSync(path.join(root,'supabase','functions','ebay-search','index.ts'),'utf8');
  assert.match(tradera,/saleTypes/);
  assert.match(tradera,/saleTypes\.push\('auction'\)/);
  assert.match(ebay,/buyingOptions/);
  assert.match(ebay,/saleTypes\.push\('fixed'\)/);
  assert.match(ebay,/saleTypes\.push\('auction'\)/);
});

test('price alert UI exposes currency, marketplace and listing-type choices',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  assert.match(html,/id="marketplaceAlertPrice"/);
  assert.match(html,/id="marketplaceAlertCurrency"/);
  assert.match(html,/id="marketplaceAlertTradera"/);
  assert.match(html,/id="marketplaceAlertEbay"/);
  assert.match(html,/id="marketplaceAlertFixed"/);
  assert.match(html,/id="marketplaceAlertAuction"/);
  const controllerPos=html.indexOf('/js/marketplace-alert-controller.js');
  const appPos=html.indexOf('/js/app.js');
  assert.ok(controllerPos>=0&&appPos>controllerPos);
  assert.match(app,/MarketplaceAlertController\.create\(\{/);
  assert.match(app,/marketplaceAlertController\.openForRecord\(index\)/);
  assert.match(app,/marketplaceAlertController\.handleEscape\(\)/);
});


test('price alert choices use explicit checkbox controls instead of full selected cards',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','copy-marketplace.css'),'utf8');
  for(const id of ['marketplaceAlertTradera','marketplaceAlertEbay','marketplaceAlertFixed','marketplaceAlertAuction']){
    assert.match(html,new RegExp('id="'+id+'" class="marketplace-alert-checkbox" type="checkbox"'));
  }
  assert.match(html,/marketplace-alert-brand-mark tradera/);
  assert.match(html,/marketplace-alert-brand-mark ebay/);
  assert.match(css,/\.marketplace-alert-checkbox\{[^}]*width:19px/);
  assert.match(css,/\.marketplace-alert-checkbox:checked\{/);
  assert.match(css,/\.marketplace-alert-checkbox:checked:after\{/);
  assert.doesNotMatch(css,/\.marketplace-alert-choice-grid input\{position:absolute;opacity:0/);
});

test('price alert footer keeps compact actions when remove is hidden',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','copy-marketplace.css'),'utf8');
  const actions=html.slice(html.indexOf('class="marketplace-alert-actions"'),html.indexOf('</div>',html.indexOf('class="marketplace-alert-actions"')));
  assert.doesNotMatch(actions,/<span><\/span>/);
  assert.match(css,/\.marketplace-alert-actions\{display:flex/);
  assert.match(css,/\.marketplace-alert-delete\{margin-right:auto/);
});


test('price alert uses the shared modal scroll shell for inner spacing',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'css','library-shell.css'),'utf8');
  const start=html.indexOf('id="marketplaceAlertForm"');
  const end=html.indexOf('</form>',start);
  const markup=html.slice(start,end);
  assert.match(markup,/class="tradera-modal-scroll marketplace-alert-scroll"/);
  assert.match(css,/\.tradera-modal-panel\{padding:0;overflow:hidden\}/);
  assert.match(css,/\.tradera-modal-scroll\{[^}]*padding:32px/);
  assert.match(css,/@media screen and \(max-width:600px\)[\s\S]*\.tradera-modal-scroll\{[^}]*padding:25px 15px/);
});


test('stores current marketplace snapshots for the Price Alerts page',()=>{
  const sql=fs.readFileSync(path.join(root,'supabase','migrations','20260919103500_marketplace_alert_overview.sql'),'utf8');
  const source=fs.readFileSync(path.join(root,'supabase','functions','marketplace-alert-scan','index.ts'),'utf8');
  assert.match(sql,/create table if not exists public\.marketplace_alert_market_state/);
  assert.match(sql,/listing_count integer/);
  assert.match(sql,/listing_count_capped boolean/);
  assert.match(sql,/lowest_price numeric/);
  assert.match(sql,/marketplace_alert_market_state_select_own/);
  assert.match(source,/async function marketplaceState/);
  assert.match(source,/marketplace_alert_market_state/);
  assert.match(source,/listing_count_capped:count>0&&listings\.length>=60/);
  assert.match(source,/saveMarketplaceState\(db,alert,'Tradera'/);
  assert.match(source,/saveMarketplaceState\(db,alert,'eBay'/);
});

test('Price Alerts page is routed, editable and keeps streaming attribution beneath covers',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const page=fs.readFileSync(path.join(root,'js','price-alerts-page-controller.js'),'utf8');
  assert.match(html,/id="priceAlertsButton"[^>]*>Price Alerts</);
  assert.match(html,/id="priceAlertsPage"/);
  assert.match(html,/\/js\/price-alerts-page-controller\.js/);
  assert.match(app,/GroovyRouteState\.priceAlertsFromPath/);
  assert.match(app,/priceAlertsController\.renderPage\(\)/);
  assert.match(app,/marketplaceAlertController\.openForRecordData/);
  assert.match(page,/apple-music-badge-small\.svg/);
  assert.match(page,/spotify-full-logo-green\.svg/);
  assert.match(page,/data-price-alert-edit/);
  assert.match(page,/data-price-alert-remove/);
  assert.match(page,/listing_count_capped/);
});


test('Price Alerts snapshots keep the lowest listing URL for direct navigation',()=>{
  const sql=fs.readFileSync(path.join(root,'supabase','migrations','20260919105000_marketplace_alert_lowest_url.sql'),'utf8');
  const source=fs.readFileSync(path.join(root,'supabase','functions','marketplace-alert-scan','index.ts'),'utf8');
  const page=fs.readFileSync(path.join(root,'js','price-alerts-page-controller.js'),'utf8');
  assert.match(sql,/lowest_listing_url text/);
  assert.match(source,/lowestListingUrl=listing\.url/);
  assert.match(source,/lowest_listing_url:state\.lowest_listing_url/);
  assert.match(page,/price-alert-lowest-link/);
  assert.match(page,/target="_blank"/);
});

test('Price Alerts menu item uses the shared profile-menu button styling',()=>{
  const css=fs.readFileSync(path.join(root,'css','library-shell.css'),'utf8');
  assert.match(css,/#profileMenu #priceAlertsButton/);
  assert.match(css,/#profileMenu #priceAlertsButton:before/);
  assert.match(css,/#profileMenu #priceAlertsButton:hover/);
});

test('Price Alerts page can open marketplace listing modals and toggle visible marketplaces',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const page=fs.readFileSync(path.join(root,'js','price-alerts-page-controller.js'),'utf8');
  const marketplace=fs.readFileSync(path.join(root,'js','marketplace-controller.js'),'utf8');
  assert.match(html,/id="priceAlertsShowTradera"/);
  assert.match(html,/id="priceAlertsShowEbay"/);
  assert.match(app,/marketplaceController\.openMarketplaceForRecord/);
  assert.match(page,/data-price-alert-market/);
  assert.match(page,/groovy-price-alert-marketplace-visibility-v1/);
  assert.match(marketplace,/async function openMarketplaceForRecord/);
});


test('interactive marketplace listing modals are not capped at 60 results',()=>{
  const tradera=fs.readFileSync(path.join(root,'supabase','functions','tradera-search','index.ts'),'utf8');
  const ebay=fs.readFileSync(path.join(root,'supabase','functions','ebay-search','index.ts'),'utf8');
  assert.doesNotMatch(tradera,/\.slice\(0,\s*60\)/);
  assert.doesNotMatch(ebay,/\.slice\(0,\s*60\)/);
});


test('eBay precedes Tradera in both marketplace layouts and Price Alerts exposes display currency',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const page=fs.readFileSync(path.join(root,'js','price-alerts-page-controller.js'),'utf8');
  const triggerStart=html.indexOf('class="marketplace-triggers"');
  const triggerEnd=html.indexOf('</div>',triggerStart);
  const triggers=html.slice(triggerStart,triggerEnd);
  assert.ok(triggers.indexOf('id="ebayButton"')<triggers.indexOf('id="traderaButton"'));
  assert.ok(page.indexOf("serviceMarkup('eBay'")<page.indexOf("serviceMarkup('Tradera'"));
  assert.match(html,/id="priceAlertsCurrencySelect"/);
  assert.match(page,/groovy-price-alert-currency-v1/);
  assert.match(page,/createFxRateLoader/);
});

test('Price Alerts profile-menu icon is a bell mask',()=>{
  const css=fs.readFileSync(path.join(root,'css','library-shell.css'),'utf8');
  assert.match(css,/#profileMenu #priceAlertsButton:before\{content:"";[^}]*mask:url/);
});


test('same marketplace listing only notifies once per alert',()=>{
  const sql=fs.readFileSync(path.join(root,'supabase','migrations','20260919095000_marketplace_price_alerts.sql'),'utf8');
  assert.match(sql,/marketplace_alert_matches_unique unique \(alert_id,marketplace,listing_id\)/);
  assert.match(sql,/on conflict \(alert_id,marketplace,listing_id\) do nothing/);
});
