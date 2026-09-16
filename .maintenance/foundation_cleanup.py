from pathlib import Path
import re

path=Path('js/app.js')
text=path.read_text(encoding='utf-8')


def remove_js_function(source,name):
    marker='async function '+name+'('
    start=source.find(marker)
    if start<0:
        raise SystemExit(f'Could not find {name}')
    brace=source.find('{',start)
    if brace<0:
        raise SystemExit(f'Could not find opening brace for {name}')
    depth=0
    state='normal'
    escaped=False
    i=brace
    while i<len(source):
        ch=source[i]
        nxt=source[i+1] if i+1<len(source) else ''
        if state in ('single','double','template'):
            if escaped:
                escaped=False
            elif ch=='\\':
                escaped=True
            elif state=='single' and ch=="'":
                state='normal'
            elif state=='double' and ch=='"':
                state='normal'
            elif state=='template' and ch=='`':
                state='normal'
        elif state=='linecomment':
            if ch=='\n': state='normal'
        elif state=='blockcomment':
            if ch=='*' and nxt=='/':
                state='normal'; i+=1
        else:
            if ch=="'": state='single'
            elif ch=='"': state='double'
            elif ch=='`': state='template'
            elif ch=='/' and nxt=='/': state='linecomment'; i+=1
            elif ch=='/' and nxt=='*': state='blockcomment'; i+=1
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:
                    end=i+1
                    while end<len(source) and source[end] in '\r\n': end+=1
                    return source[:start]+source[end:]
        i+=1
    raise SystemExit(f'Could not find closing brace for {name}')

# The live schema has matrix A-H, so load them in the original collection query.
select_pattern=re.compile(
    r'(?m)^(?P<i>[ \t]*)matrix_runout_a,\n(?P=i)matrix_runout_b,\n(?P=i)matrix_runout_c,\n(?P=i)matrix_runout_d,\n(?P=i)pressing_match_status,'
)
def expand_select(match):
    i=match.group('i')
    return '\n'.join([
        i+'matrix_runout_a,',i+'matrix_runout_b,',i+'matrix_runout_c,',i+'matrix_runout_d,',
        i+'matrix_runout_e,',i+'matrix_runout_f,',i+'matrix_runout_g,',i+'matrix_runout_h,',
        i+'pressing_match_status,'
    ])
text,count=select_pattern.subn(expand_select,text)
if count!=2:
    raise SystemExit(f'Expected two collection select blocks, found {count}')

# The second compatibility query is now redundant.
text=remove_js_function(text,'hydrateExtendedMatrices')
text,count=re.subn(r'\n[ \t]*await hydrateExtendedMatrices\((?:collectionData,user\.id|data,userId)\);[ \t]*', '\n', text)
if count!=2:
    raise SystemExit(f'Expected two hydration calls, found {count}')

# Persist all eight matrix sides in the same update.
old="""    matrix_runout_c:matrixC&&matrixC.value?matrixC.value:null,
    matrix_runout_d:matrixD&&matrixD.value?matrixD.value:null,
    pressing_match_status:'discogs'"""
new="""    matrix_runout_c:matrixC&&matrixC.value?matrixC.value:null,
    matrix_runout_d:matrixD&&matrixD.value?matrixD.value:null,
    matrix_runout_e:matrixE&&matrixE.value?matrixE.value:null,
    matrix_runout_f:matrixF&&matrixF.value?matrixF.value:null,
    matrix_runout_g:matrixG&&matrixG.value?matrixG.value:null,
    matrix_runout_h:matrixH&&matrixH.value?matrixH.value:null,
    pressing_match_status:'discogs'"""
if text.count(old)!=1:
    raise SystemExit(f'Expected one pressing payload, found {text.count(old)}')
text=text.replace(old,new,1)

start=text.find('\n  var extendedPayload={')
end=text.find('\n\n  record[11]=',start)
if start<0 or end<0:
    raise SystemExit('Could not isolate the extended matrix compatibility block')
text=text[:start]+text[end:]

old_assign="""  record[11].matrixD=payload.matrix_runout_d||'';
  record[11].matrixE=extendedMatricesSaved?(extendedPayload.matrix_runout_e||''):'';
  record[11].matrixF=extendedMatricesSaved?(extendedPayload.matrix_runout_f||''):'';
  record[11].matrixG=extendedMatricesSaved?(extendedPayload.matrix_runout_g||''):'';
  record[11].matrixH=extendedMatricesSaved?(extendedPayload.matrix_runout_h||''):'';"""
new_assign="""  record[11].matrixD=payload.matrix_runout_d||'';
  record[11].matrixE=payload.matrix_runout_e||'';
  record[11].matrixF=payload.matrix_runout_f||'';
  record[11].matrixG=payload.matrix_runout_g||'';
  record[11].matrixH=payload.matrix_runout_h||'';"""
if text.count(old_assign)!=1:
    raise SystemExit('Expected one extended matrix local assignment block')
text=text.replace(old_assign,new_assign,1)

old_saved="copyDetailsSaved.textContent=extendedMatricesSaved?'Saved':'Saved A–D · database update needed for E–H';"
if text.count(old_saved)!=1:
    raise SystemExit('Expected one extended matrix save status')
text=text.replace(old_saved,"copyDetailsSaved.textContent='Saved';",1)

path.write_text(text,encoding='utf-8')

# Regression coverage for the compatibility-layer removal.
test_path=Path('tests/pwa.test.js')
tests=test_path.read_text(encoding='utf-8')
tests += '''\n\ntest('pressing matrices A-H use one schema path without compatibility hydration',function(){\n  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');\n  assert.doesNotMatch(app,/hydrateExtendedMatrices|extendedMatricesSaved|extendedPayload|database update needed for E–H/);\n  assert.ok((app.match(/matrix_runout_h,/g)||[]).length>=2);\n  assert.match(app,/matrix_runout_h:matrixH&&matrixH\\.value\\?matrixH\\.value:null/);\n  assert.match(app,/record\\[11\\]\\.matrixH=payload\\.matrix_runout_h\\|\\|''/);\n});\n'''
test_path.write_text(tests,encoding='utf-8')
