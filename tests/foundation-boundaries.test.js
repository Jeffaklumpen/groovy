const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Supabase browser client is pinned to an exact semver',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const match=html.match(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@(\d+\.\d+\.\d+)/);
  assert.ok(match,'Supabase JS CDN dependency must use an exact x.y.z version');
  assert.doesNotMatch(html,/supabase-js@2(?:["'/]|\s)/,'major-only Supabase JS pin must not return');
});

test('atomic album save migration owns the shared catalog write boundary',()=>{
  const sql=fs.readFileSync(
    'supabase/migrations/20260918085248_atomic_album_library_save.sql',
    'utf8'
  );
  assert.match(sql,/function public\.save_album_to_library\(/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/insert into public\.artists/i);
  assert.match(sql,/insert into public\.albums/i);
  assert.match(sql,/insert into public\.tracks/i);
  assert.match(sql,/insert into public\.(collections|wishlists)/i);
});

test('shared catalog direct client writes are removed by explicit grants migration',()=>{
  const sql=fs.readFileSync(
    'supabase/migrations/20260918085542_explicit_data_api_grants_and_catalog_writes.sql',
    'utf8'
  );
  assert.match(sql,/drop policy if exists "Authenticated users can insert albums"/);
  assert.match(sql,/drop policy if exists "Authenticated users can insert artists"/);
  assert.match(sql,/drop policy if exists "Authenticated users can insert tracks"/);
  assert.match(sql,/revoke all on table public\.albums from anon, authenticated/);
  assert.match(sql,/grant select on table public\.albums to authenticated/);
  assert.match(sql,/alter default privileges for role postgres in schema public/);
});

test('Supabase rebuild baseline is kept outside managed migrations',()=>{
  const baselinePath='supabase/baseline/20260918_live_schema.sql';
  assert.ok(fs.existsSync(baselinePath),'live schema baseline is missing');
  const sql=fs.readFileSync(baselinePath,'utf8');
  assert.match(sql,/rebuild baseline, NOT a migration/i);
  assert.match(sql,/function public\.save_album_to_library\(/i);
  assert.match(sql,/create table public\.collections/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/profile-images/);
});

test('CI dependencies are reproducible and current action runtimes are used',()=>{
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  const testWorkflow=fs.readFileSync('.github/workflows/test.yml','utf8');
  const e2eWorkflow=fs.readFileSync('.github/workflows/e2e.yml','utf8');

  assert.equal(lock.lockfileVersion,3);
  assert.equal(lock.packages['node_modules/@playwright/test'].version,'1.63.0');
  assert.match(testWorkflow,/actions\/checkout@v7/);
  assert.match(testWorkflow,/actions\/setup-node@v7/);
  assert.match(e2eWorkflow,/actions\/checkout@v7/);
  assert.match(e2eWorkflow,/actions\/setup-node@v7/);
  assert.match(e2eWorkflow,/npm ci --no-audit --no-fund/);
  assert.doesNotMatch(e2eWorkflow,/npm install --no-audit --no-fund/);
});


test('wishlist to collection is one authenticated database transaction',()=>{
  const sql=fs.readFileSync(
    'supabase/migrations/20260918100143_atomic_wishlist_to_collection.sql',
    'utf8'
  );
  assert.match(sql,/function public\.move_wishlist_to_collection\(/i);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/for update/i);
  assert.match(sql,/insert into public\.collections/i);
  assert.match(sql,/delete from public\.wishlists/i);
  assert.match(sql,/row_number\(\) over/i);
  assert.match(sql,/grant execute on function public\.move_wishlist_to_collection/i);
});

test('notes album persistence uses a service-role-only verified catalog writer',()=>{
  const sql=fs.readFileSync(
    'supabase/migrations/20260918100258_verified_album_library_save.sql',
    'utf8'
  );
  const edge=fs.readFileSync('supabase/functions/discogs-search/index.ts','utf8');
  assert.match(sql,/function public\.save_album_to_library_verified\(/i);
  assert.match(sql,/p_user_id uuid/i);
  assert.match(sql,/revoke all on function public\.save_album_to_library_verified[\s\S]*authenticated/i);
  assert.match(sql,/grant execute on function public\.save_album_to_library_verified[\s\S]*service_role/i);
  assert.match(edge,/action === 'saveAlbum'/);
  assert.match(edge,/auth\.getUser\(\)/);
  assert.match(edge,/save_album_to_library_verified/);
  assert.match(edge,/itunes\.apple\.com\/lookup/);
});

test('detail compatibility layers use app state and the shared library mutation owner',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const detail=fs.readFileSync('js/detail-enhancements-v2.js','utf8');
  const rating=fs.readFileSync('js/album-rating-layout-v4.js','utf8');
  assert.match(app,/window\.groovyGetOpenRecordIndex/);
  assert.match(app,/window\.groovyMoveWishlistToCollection/);
  assert.match(detail,/groovyGetOpenRecordIndex/);
  assert.match(detail,/groovyMoveWishlistToCollection/);
  assert.doesNotMatch(detail,/async function addWishlistToCollection/);
  assert.doesNotMatch(detail,/\.from\(['"]collections['"]\)\s*\.insert/);
  assert.match(rating,/groovyGetOpenRecordIndex/);
});
