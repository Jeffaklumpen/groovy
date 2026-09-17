const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('app.js static DOM references exist in index.html',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const html=fs.readFileSync('index.html','utf8');
  const requested=[...app.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
  const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
  const dynamic=new Set(['carouselViewport','followingPage','conditionEditor','editConditionButton','identifyPressingButton','mediaConditionSelect','sleeveConditionSelect','pressingMatrixA','pressingMatrixB','pressingMatrixC','pressingMatrixD','pressingMatrixE','pressingMatrixF','pressingMatrixG','pressingMatrixH','savePressingButton']);
  const missing=[...new Set(requested)].filter(id=>!ids.has(id)&&!dynamic.has(id)).sort();
  assert.deepEqual(missing,[]);
});
