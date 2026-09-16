const fs=require('fs');
const cp=require('child_process');

const backupRef='origin/backup/foundation-cleanup-2026-09-16';
const current=fs.readFileSync('index.html','utf8');
const backup=cp.execFileSync('git',['show',`${backupRef}:index.html`],{encoding:'utf8'});

const start='<div class="album-overlay" id="albumOverlay">';
const end='<div id="addAlbumModal"';
const currentStart=current.indexOf(start);
const currentEnd=current.indexOf(end,currentStart);
const backupStart=backup.indexOf(start);
const backupEnd=backup.indexOf(end,backupStart);
if([currentStart,currentEnd,backupStart,backupEnd].some(v=>v<0)) throw new Error('Could not locate repair boundaries');

const repaired=current.slice(0,currentStart)+backup.slice(backupStart,backupEnd)+current.slice(currentEnd);
fs.writeFileSync('index.html',repaired);

const app=fs.readFileSync('js/app.js','utf8');
const requested=[...app.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
const ids=new Set([...repaired.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
const dynamic=new Set([
  'carouselViewport','followingPage',
  'conditionEditor','editConditionButton','identifyPressingButton','mediaConditionSelect','sleeveConditionSelect',
  'pressingMatrixA','pressingMatrixB','pressingMatrixC','pressingMatrixD','pressingMatrixE','pressingMatrixF','pressingMatrixG','pressingMatrixH',
  'savePressingButton'
]);
const missing=[...new Set(requested)].filter(id=>!ids.has(id)&&!dynamic.has(id)).sort();
if(missing.length) throw new Error('Static DOM IDs still missing after repair: '+missing.join(', '));

const test=`const test=require('node:test');\nconst assert=require('node:assert/strict');\nconst fs=require('fs');\n\ntest('app.js static DOM references exist in index.html',()=>{\n  const app=fs.readFileSync('js/app.js','utf8');\n  const html=fs.readFileSync('index.html','utf8');\n  const requested=[...app.matchAll(/getElementById\\(['\"]([^'\"]+)['\"]\\)/g)].map(m=>m[1]);\n  const ids=new Set([...html.matchAll(/\\bid=[\"']([^\"']+)[\"']/g)].map(m=>m[1]));\n  const dynamic=new Set(['carouselViewport','followingPage','conditionEditor','editConditionButton','identifyPressingButton','mediaConditionSelect','sleeveConditionSelect','pressingMatrixA','pressingMatrixB','pressingMatrixC','pressingMatrixD','pressingMatrixE','pressingMatrixF','pressingMatrixG','pressingMatrixH','savePressingButton']);\n  const missing=[...new Set(requested)].filter(id=>!ids.has(id)&&!dynamic.has(id)).sort();\n  assert.deepEqual(missing,[]);\n});\n`;
fs.writeFileSync('tests/dom-contract.test.js',test);
console.log('Repaired index DOM section and wrote DOM contract test.');
