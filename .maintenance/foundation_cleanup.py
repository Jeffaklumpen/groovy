from pathlib import Path

root=Path('.')
targets=[
    Path('js/album-rating-context.js'),
    Path('js/album-rating-layout-v2.js'),
    Path('js/album-rating-layout-v3.js'),
]

# Refuse to delete a legacy file if anything else in the repository still names it.
ignored={Path('.maintenance/foundation_cleanup.py'),Path('.github/workflows/foundation-maintenance.yml'),*targets}
for target in targets:
    if not target.exists():
        raise SystemExit(f'Missing expected legacy file: {target}')
    needle=target.name
    references=[]
    for path in root.rglob('*'):
        if not path.is_file() or path in ignored or '.git' in path.parts:
            continue
        try:
            text=path.read_text(encoding='utf-8')
        except (UnicodeDecodeError,OSError):
            continue
        if needle in text:
            references.append(str(path))
    if references:
        raise SystemExit(f'{target} is still referenced by: {references}')

for target in targets:
    target.unlink()

index_path=Path('index.html')
index=index_path.read_text(encoding='utf-8')
if index.count('<html lang="sv">')!=1:
    raise SystemExit('Expected exactly one Swedish html lang attribute')
index=index.replace('<html lang="sv">','<html lang="en">',1)
old_viewport='<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">'
new_viewport='<meta name="viewport" content="width=device-width, initial-scale=1.0">'
if index.count(old_viewport)!=1:
    raise SystemExit('Expected exactly one legacy viewport tag')
index=index.replace(old_viewport,new_viewport,1)
index_path.write_text(index,encoding='utf-8')

test_path=Path('tests/pwa.test.js')
tests=test_path.read_text(encoding='utf-8')
tests += '''\n\ntest('document metadata is accessible and obsolete rating scripts are gone',function(){\n  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');\n  assert.match(html,/<html lang="en">/);\n  assert.match(html,/name="viewport" content="width=device-width, initial-scale=1.0"/);\n  assert.doesNotMatch(html,/user-scalable=no|maximum-scale|minimum-scale/);\n  ['album-rating-context.js','album-rating-layout-v2.js','album-rating-layout-v3.js'].forEach(function(file){\n    assert.equal(fs.existsSync(path.join(root,'js',file)),false);\n  });\n  assert.equal(fs.existsSync(path.join(root,'js','album-rating-layout-v4.js')),true);\n});\n'''
test_path.write_text(tests,encoding='utf-8')
