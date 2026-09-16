from pathlib import Path
import re

# Keep PWA code focused on install/service-worker responsibilities.
pwa_path=Path('js/pwa.js')
pwa=pwa_path.read_text(encoding='utf-8')
pattern=re.compile(
    r"\n  function loadProfileModule\(\)\{.*?\n  \}\n\n  function loadAlbumRatingLayoutV4\(\)\{.*?\n  \}\n\n  setInstallCopy\(\);\n  loadProfileModule\(\);\n  loadAlbumRatingLayoutV4\(\);",
    re.S
)
pwa,count=pattern.subn("\n\n  setInstallCopy();",pwa,count=1)
if count!=1:
    raise SystemExit(f'Expected one dynamic module loading block, found {count}')
pwa_path.write_text(pwa,encoding='utf-8')

# Load application modules explicitly in the document so dependencies are visible.
index_path=Path('index.html')
index=index_path.read_text(encoding='utf-8')
style_old='  <link rel="stylesheet" href="/css/detail-enhancements.css?v=7">'
style_new=style_old+'\n  <link rel="stylesheet" href="/css/profile.css?v=9">'
if index.count(style_old)!=1:
    raise SystemExit('Expected one detail enhancement stylesheet')
index=index.replace(style_old,style_new,1)

scripts_old='''<script src="/js/route-state.js?v=20"></script>\n<script src="/js/app.js?v=124"></script>\n<script src="/js/detail-enhancements-v2.js?v=7"></script>\n<script src="/js/statistics-core.js?v=4"></script>\n<script src="/js/statistics.js?v=10"></script>\n<script src="/js/pwa.js?v=17"></script>'''
scripts_new='''<script src="/js/route-state.js?v=20"></script>\n<script src="/js/app.js?v=124"></script>\n<script src="/js/detail-enhancements-v2.js?v=7"></script>\n<script src="/js/statistics-core.js?v=4"></script>\n<script src="/js/statistics.js?v=10"></script>\n<script src="/js/profile.js?v=9"></script>\n<script src="/js/album-rating-layout-v4.js?v=1"></script>\n<script src="/js/pwa.js?v=18"></script>'''
if index.count(scripts_old)!=1:
    raise SystemExit('Expected one current application script block')
index=index.replace(scripts_old,scripts_new,1)
index_path.write_text(index,encoding='utf-8')

# Lock the separation in the existing PWA regression test.
test_path=Path('tests/pwa.test.js')
tests=test_path.read_text(encoding='utf-8')
needle="""  assert.match(pwa,/installShortcutButton\\.addEventListener\\('click',startInstall\\)/);"""
replacement=needle+"""
  assert.doesNotMatch(pwa,/loadProfileModule|loadAlbumRatingLayoutV4|profile\\.js|album-rating-layout-v4/);
  assert.match(html,/href=\"\\/css\\/profile\\.css\\?v=9\"/);
  assert.match(html,/src=\"\\/js\\/profile\\.js\\?v=9\"/);
  assert.match(html,/src=\"\\/js\\/album-rating-layout-v4\\.js\\?v=1\"/);"""
if tests.count(needle)!=1:
    raise SystemExit('Expected one PWA install assertion')
tests=tests.replace(needle,replacement,1)
test_path.write_text(tests,encoding='utf-8')
