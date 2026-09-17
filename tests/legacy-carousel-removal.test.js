const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('legacy carousel runtime and styles stay removed',()=>{
  const app=fs.readFileSync('js/app.js','utf8');
  const css=fs.readFileSync('css/style.css','utf8');
  const html=fs.readFileSync('index.html','utf8');

  [
    "var view='grid'",
    'activeIndex',
    'function buildCarousel(',
    'function setView(',
    'function centerCard(',
    "view==='carousel'",
    "view!=='carousel'",
    'carouselViewport',
    'carousel-card'
  ].forEach(token=>assert.equal(app.includes(token),false,token+' should remain removed'));

  assert.equal(/\.carousel(?:-|\{)/.test(css),false,'carousel CSS should remain removed');
  assert.equal(/carousel/i.test(html),false,'carousel controls should not exist in the document');
  assert.match(app,/if\(selectedRating!=='all'\|\|librarySearchQuery\|\|librarySort!=='added'\)/);
});
