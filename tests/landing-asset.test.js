const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('logged-out landing uses an existing record image asset',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  const asset='/assets/images/avatar-placeholder.png';
  assert.match(source,/class="landing-record-art" src="\/assets\/images\/avatar-placeholder\.png"/);
  assert.ok(fs.existsSync(asset.slice(1)),'landing record image asset is missing');
  assert.doesNotMatch(source,/class="landing-record-art" src="\/record\.png"/);
});
