from pathlib import Path
import re

index_path=Path('index.html')
index=index_path.read_text(encoding='utf-8')

style_old='<link rel="stylesheet" href="/css/style.css?v=115">'
style_new=style_old+'\n  <link rel="stylesheet" href="/css/detail-enhancements.css?v=7">'
if index.count(style_old)!=1:
    raise SystemExit('Expected one main stylesheet tag')
index=index.replace(style_old,style_new,1)

scripts_old='''<script src="/js/route-state.js?v=20"></script>\n<script src="/js/route-runtime.js?v=1"></script>\n<script src="/js/app.js?v=123"></script>'''
scripts_new='''<script src="/js/route-state.js?v=20"></script>\n<script src="/js/app.js?v=124"></script>\n<script src="/js/detail-enhancements-v2.js?v=7"></script>'''
if index.count(scripts_old)!=1:
    raise SystemExit('Expected one routing/app script block')
index=index.replace(scripts_old,scripts_new,1)
index_path.write_text(index,encoding='utf-8')

runtime=Path('js/route-runtime.js')
if not runtime.exists():
    raise SystemExit('route-runtime.js was already missing')
runtime.unlink()

test_path=Path('tests/pwa.test.js')
tests=test_path.read_text(encoding='utf-8')
pattern=re.compile(
    r"test\('routing state stays pure and routing runtime contains no data or history patches',function\(\)\{.*?\n\}\);\n\n(?=test\('signup uses the auth trigger)",
    re.S
)
replacement="""test('routing state stays pure and detail enhancements load directly',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const routeState=fs.readFileSync(path.join(root,'js','route-state.js'),'utf8');

  assert.doesNotMatch(routeState,/installRuntimeFixes|syncPublicShelfRecords|Object\\.defineProperty\\(windowObject,'loadCollection'/);
  assert.doesNotMatch(html,/route-runtime\\.js/);
  assert.match(html,/href=\"\\/css\\/detail-enhancements\\.css\\?v=7\"/);
  assert.match(html,/src=\"\\/js\\/detail-enhancements-v2\\.js\\?v=7\"/);

  const statePosition=html.indexOf('/js/route-state.js');
  const appPosition=html.indexOf('/js/app.js');
  const detailPosition=html.indexOf('/js/detail-enhancements-v2.js');
  assert.ok(statePosition>=0&&appPosition>statePosition&&detailPosition>appPosition);
});

"""
tests,count=pattern.subn(replacement,tests,count=1)
if count!=1:
    raise SystemExit(f'Expected one routing runtime test block, found {count}')
test_path.write_text(tests,encoding='utf-8')
