const fs=require('node:fs');

const jsPath='js/album-rating-layout-v4.js';
const cssPath='css/detail-enhancements.css';
const testPath='tests/pwa.test.js';

let js=fs.readFileSync(jsPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');
let tests=fs.readFileSync(testPath,'utf8');

const marker='/* Album rating layout (moved from album-rating-layout-v4.js) */';
if(css.includes(marker))throw new Error('Rating layout CSS marker already exists');

const functionStart=js.indexOf('function installStyles(){');
if(functionStart<0)throw new Error('installStyles() was not found');

// Find the matching function brace without depending on the exact CSS contents.
const braceStart=js.indexOf('{',functionStart);
let depth=0;
let quote=null;
let escaped=false;
let functionEnd=-1;
for(let i=braceStart;i<js.length;i++){
  const ch=js[i];
  if(quote){
    if(escaped){escaped=false;continue;}
    if(ch==='\\'){escaped=true;continue;}
    if(ch===quote)quote=null;
    continue;
  }
  if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
  if(ch==='{')depth++;
  else if(ch==='}'){
    depth--;
    if(depth===0){functionEnd=i+1;break;}
  }
}
if(functionEnd<0)throw new Error('Could not find end of installStyles()');

const block=js.slice(functionStart,functionEnd);
const assignmentStart=block.indexOf('style.textContent=');
const appendStart=block.indexOf('document.head.appendChild(style);');
if(assignmentStart<0||appendStart<0||appendStart<=assignmentStart){
  throw new Error('Could not isolate rating CSS expression');
}
let expression=block.slice(assignmentStart+'style.textContent='.length,appendStart).trim();
if(!expression.endsWith(';'))throw new Error('Rating CSS expression did not end as expected');
expression=expression.slice(0,-1).trim();

// The expression is intentionally only a concatenation of string literals.
if(!/^(?:\s*'(?:\\.|[^'\\])*'\s*\+?\s*)+$/.test(expression)){
  throw new Error('Rating CSS expression contains something other than string literals');
}
const ratingCss=Function('"use strict";return ('+expression+');')();
if(typeof ratingCss!=='string'||ratingCss.length<1000)throw new Error('Extracted rating CSS looks incomplete');
if(!ratingCss.includes('.groovy-rating-section-heading')||!ratingCss.includes('.groovy-rating-avatar')){
  throw new Error('Expected rating selectors were missing from extracted CSS');
}

js=js.slice(0,functionStart)+js.slice(functionEnd);
const callCount=(js.match(/\binstallStyles\(\);/g)||[]).length;
if(callCount!==1)throw new Error('Expected exactly one installStyles() call, found '+callCount);
js=js.replace(/\n?\s*installStyles\(\);\s*/,'\n');
if(js.includes('groovyRatingLayoutV4Styles')||js.includes("createElement('style')")){
  throw new Error('Dynamic rating style installation still exists');
}

css=css.replace(/\s*$/,'')+'\n\n'+marker+'\n'+ratingCss+'\n';

const testBlock=`\n\ntest('album rating presentation lives in CSS instead of runtime style injection',function(){\n  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');\n  const css=fs.readFileSync(path.join(root,'css','detail-enhancements.css'),'utf8');\n  assert.doesNotMatch(layout,/installStyles|groovyRatingLayoutV4Styles|createElement\\(['\"]style['\"]\\)/);\n  assert.match(css,/Album rating layout \\(moved from album-rating-layout-v4\\.js\\)/);\n  assert.match(css,/\\.groovy-rating-section-heading/);\n  assert.match(css,/\\.groovy-rating-avatar/);\n});\n`;
if(tests.includes("album rating presentation lives in CSS"))throw new Error('Rating CSS regression test already exists');
tests+=testBlock;

fs.writeFileSync(jsPath,js);
fs.writeFileSync(cssPath,css);
fs.writeFileSync(testPath,tests);
