const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('router loads after route-state and before application modules',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const routeState=html.indexOf('/js/route-state.js?v=');
  const router=html.indexOf('/js/router.js?v=');
  const app=html.indexOf('/js/app.js?v=');
  const statistics=html.indexOf('/js/statistics.js?v=');
  const profile=html.indexOf('/js/profile.js?v=');
  assert.ok(routeState>=0,'route-state.js is missing');
  assert.ok(router>routeState,'router.js must load after route-state.js');
  assert.ok(app>router,'router.js must load before app.js');
  assert.ok(statistics>router,'router.js must load before statistics.js');
  assert.ok(profile>router,'router.js must load before profile.js');
});

test('router is the only JavaScript owner of browser history mutation',()=>{
  const jsFiles=fs.readdirSync('js').filter(name=>name.endsWith('.js'));
  const offenders=[];
  jsFiles.forEach(name=>{
    if(name==='router.js')return;
    const source=fs.readFileSync(path.join('js',name),'utf8');
    if(/history\.(?:pushState|replaceState|back)\s*\(/.test(source)){
      offenders.push(name);
    }
  });
  assert.deepEqual(offenders,[]);
});

test('router is the only JavaScript owner of popstate handling',()=>{
  const jsFiles=fs.readdirSync('js').filter(name=>name.endsWith('.js'));
  const offenders=[];
  jsFiles.forEach(name=>{
    if(name==='router.js')return;
    const source=fs.readFileSync(path.join('js',name),'utf8');
    if(/addEventListener\(\s*['"]popstate['"]/.test(source)){
      offenders.push(name);
    }
  });
  assert.deepEqual(offenders,[]);
});

test('app registers the route renderer with the central router',()=>{
  const source=fs.readFileSync('js/app.js','utf8');
  assert.match(source,/var Router=window\.GroovyRouter/);
  assert.match(source,/Router\.setHandler\(renderCurrentRoute\)/);
  assert.doesNotMatch(source,/history\.(?:pushState|replaceState|back)\s*\(/);
});

test('profile and statistics react to route changes without owning history',()=>{
  for(const file of ['js/profile.js','js/statistics.js']){
    const source=fs.readFileSync(file,'utf8');
    assert.match(source,/window\.GroovyRouter/);
    assert.match(source,/groovy-route-change/);
    assert.doesNotMatch(source,/addEventListener\(\s*['"]popstate['"]/);
    assert.doesNotMatch(source,/history\.(?:pushState|replaceState|back)\s*\(/);
  }
});


test('router remembers per-route scroll and restores it after async rendering',()=>{
  const source=fs.readFileSync('js/router.js','utf8');
  assert.match(source,/routeScrollPositions/);
  assert.match(source,/history\.scrollRestoration='manual'/);
  assert.match(source,/rememberScroll\(current\(\)\)/);
  assert.match(source,/await Promise\.resolve\(runRouteHandler\(\)\)/);
  assert.match(source,/windowObject\.scrollTo\(\{top:top,left:0,behavior:'auto'\}\)/);
});
