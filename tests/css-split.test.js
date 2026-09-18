const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const CSS_FILES=[
  'css/base-library.css',
  'css/search-modals.css',
  'css/copy-marketplace.css',
  'css/library-shell.css',
  'css/shelves-streaming.css',
  'css/album-detail-extras.css',
  'css/landing-social.css',
  'css/ratings-detail.css'
];

test('split stylesheets load in cascade order before enhancement styles',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const positions=CSS_FILES.map(function(file){
    const href='/'+file+'?v=';
    const position=html.indexOf(href);
    assert.ok(position>=0,href+' should be loaded');
    return position;
  });

  positions.forEach(function(position,index){
    if(index>0)assert.ok(position>positions[index-1],CSS_FILES[index]+' should preserve cascade order');
  });

  const enhancements=html.indexOf('/css/detail-enhancements.css?v=');
  const profile=html.indexOf('/css/profile.css?v=');
  assert.ok(enhancements>positions[positions.length-1]);
  assert.ok(profile>enhancements);
  assert.equal(html.includes('/css/style.css?v='),false,'legacy monolithic stylesheet should not be loaded');
});

test('split stylesheet boundaries keep major domains in their intended files',()=>{
  CSS_FILES.forEach(function(file){
    assert.ok(fs.existsSync(file),file+' should exist');
  });

  assert.match(fs.readFileSync('css/search-modals.css','utf8'),/\/\* ADD ALBUM MODAL \*\//);
  assert.match(fs.readFileSync('css/copy-marketplace.css','utf8'),/\/\* PERSONAL COPY DETAILS \*\//);
  assert.match(fs.readFileSync('css/library-shell.css','utf8'),/\/\* HEADER REFRESH \*\//);
  assert.match(fs.readFileSync('css/shelves-streaming.css','utf8'),/\/\* SHELVES \*\//);
  assert.match(fs.readFileSync('css/album-detail-extras.css','utf8'),/\/\* PROFILE NAV V1/);
  assert.match(fs.readFileSync('css/landing-social.css','utf8'),/\/\* LOGGED OUT LANDING \*\//);
  assert.match(fs.readFileSync('css/ratings-detail.css','utf8'),/\/\* GLOBAL ALBUM RATING \+ TRACK DURATIONS V11 \*\//);
});
