from pathlib import Path

app_path=Path('js/app.js')
app=app_path.read_text(encoding='utf-8')

# Internal shelf navigation should use the canonical route directly.
old="'/user/'+encodeURIComponent"
count=app.count(old)
if count!=2:
    raise SystemExit(f'Expected two internal /user/ route builders, found {count}')
app=app.replace(old,"'/shelf/'+encodeURIComponent")

# Programmatic application routing announces the URL change to feature modules.
old_render="""async function renderCurrentRoute(){
    window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);"""
new_render="""async function renderCurrentRoute(){
    window.dispatchEvent(new Event('groovy-route-change'));
    window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);"""
if app.count(old_render)!=1:
    raise SystemExit('Expected one renderCurrentRoute entry point')
app=app.replace(old_render,new_render,1)
app_path.write_text(app,encoding='utf-8')

profile_path=Path('js/profile.js')
profile=profile_path.read_text(encoding='utf-8')

# Remove the global history/GroovyRouteState monkey patch. Keep only the helper
# needed to recognise the /profile/:username surface owned by this module.
start=profile.find('  var originalPushState=')
end=profile.find('  var state=',start)
if start<0 or end<0:
    raise SystemExit('Could not isolate profile history patch block')
replacement="""  function decodeUsername(value){
    try{return decodeURIComponent(value);}catch(error){return null;}
  }

  function publicProfileUsernameFromPath(pathname){
    var match=String(pathname||'').match(/^\\/profile\\/([^\\/]+)\\/?$/);
    return match?decodeUsername(match[1]):null;
  }

"""
profile=profile[:start]+replacement+profile[end:]

# Opening your own profile previously depended on the pushState monkey patch.
old_open="history.pushState({},'', '/profile/'+encodeURIComponent(username));"
new_open=old_open+"\n    syncRoute();"
if profile.count(old_open)!=1:
    raise SystemExit(f'Expected one direct own-profile push, found {profile.count(old_open)}')
profile=profile.replace(old_open,new_open,1)

old_tail="""  window.addEventListener('popstate',queueRouteSync);
  supabaseClient.auth.onAuthStateChange(function(){setTimeout(syncRoute,0);});

  if(shelfUsernameFromPath(window.location.pathname))setTimeout(dispatchRouteChange,0);
  syncRoute();"""
new_tail="""  window.addEventListener('popstate',syncRoute);
  window.addEventListener('groovy-route-change',syncRoute);
  supabaseClient.auth.onAuthStateChange(function(){setTimeout(syncRoute,0);});

  syncRoute();"""
if profile.count(old_tail)!=1:
    raise SystemExit('Expected one legacy profile route listener block')
profile=profile.replace(old_tail,new_tail,1)

for forbidden in [
    'originalPushState','originalReplaceState','routeSyncTimer','rewriteLegacyShelfUrl',
    'queueRouteSync','__groovyShelfRoutesPatched','GroovyRouteState.profileUsernameFromPath=',
    'shelfUsernameFromPath'
]:
    if forbidden in profile:
        raise SystemExit(f'Legacy profile routing symbol still present: {forbidden}')

profile_path.write_text(profile,encoding='utf-8')

# Add regression protection.
test_path=Path('tests/route-state.test.js')
tests=test_path.read_text(encoding='utf-8')
tests += '''\n\ntest('profile routing does not monkey patch browser history or route helpers',function(){\n  const fs=require('node:fs');\n  const path=require('node:path');\n  const root=path.resolve(__dirname,'..');\n  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');\n  const profile=fs.readFileSync(path.join(root,'js','profile.js'),'utf8');\n\n  assert.match(app,/groovy-route-change/);\n  assert.doesNotMatch(app,/['\"]\\/user\\/['\"]\\+encodeURIComponent/);\n  assert.doesNotMatch(profile,/history\\.pushState\\s*=|history\\.replaceState\\s*=|__groovyShelfRoutesPatched/);\n  assert.doesNotMatch(profile,/GroovyRouteState\\.profileUsernameFromPath\\s*=/);\n  assert.match(profile,/addEventListener\\('groovy-route-change',syncRoute\\)/);\n});\n'''
test_path.write_text(tests,encoding='utf-8')
