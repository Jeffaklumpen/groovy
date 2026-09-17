const fs=require('node:fs');

const appPath='js/app.js';
const indexPath='index.html';
let app=fs.readFileSync(appPath,'utf8');
let index=fs.readFileSync(indexPath,'utf8');

const pressingCoreInit="var PressingCore=window.GroovyPressingCore;\nif(!PressingCore)throw new Error('GroovyPressingCore must load before app.js');\n";
if(!app.includes(pressingCoreInit))throw new Error('Expected PressingCore bootstrap block not found');
if(app.includes('var PressingView=window.GroovyPressingView;'))throw new Error('PressingView is already initialized');
app=app.replace(pressingCoreInit,pressingCoreInit+'var PressingView=window.GroovyPressingView;\n');

const copyStart=app.indexOf('function hasCopyDetails(details){');
const copyEnd=app.indexOf('async function saveConditionDetails(index){',copyStart);
if(copyStart<0||copyEnd<0||copyEnd<=copyStart)throw new Error('Expected copy details block not found');
const copyReplacement=`function hasCopyDetails(details){return PressingView.hasCopyDetails(details);}\nfunction recordConditionMeta(value){return PressingView.conditionMeta(value);}\n\nfunction setCopyDetailsExpanded(expanded){\n  copyDetailsExpanded=!!expanded;\n  PressingView.setExpanded({root:copyDetails,toggle:copyDetailsToggle,content:copyDetailsContent},copyDetailsExpanded);\n}\n\ncopyDetailsToggle.addEventListener('click',function(){\n  setCopyDetailsExpanded(!copyDetailsExpanded);\n});\n\nfunction renderCopyDetails(index){\n  var record=records[index];\n  var result=PressingView.renderCopyDetails({\n    hasRecord:!!record,\n    isWishlist:window.libraryView==='wishlist',\n    isOwner:viewedUserId===null,\n    details:record&&record[11]?record[11]:{},\n    recordKey:record?String(record[9]||('record-'+index)):'',\n    previousRecordKey:copyDetailsRecordKey,\n    expanded:copyDetailsExpanded,\n    elements:{\n      root:copyDetails,\n      content:copyDetailsContent,\n      toggle:copyDetailsToggle,\n      summary:copyDetailsSummary,\n      saved:copyDetailsSaved\n    },\n    onIdentifyPressing:function(){openPressingPicker(index);},\n    onConditionChange:function(){saveConditionDetails(index);}\n  });\n  copyDetailsExpanded=result.expanded;\n  copyDetailsRecordKey=result.recordKey;\n}\n\n`;
app=app.slice(0,copyStart)+copyReplacement+app.slice(copyEnd);

const helperStart=app.indexOf('function setPressingOptions(select,values,placeholder,current){');
const helperEnd=app.indexOf('function currentPressingMatches(){',helperStart);
if(helperStart<0||helperEnd<0||helperEnd<=helperStart)throw new Error('Expected pressing field helper block not found');
const helperReplacement=`function setPressingOptions(select,values,placeholder,current){\n  PressingView.setOptions(select,values,placeholder,current);\n}\n\nfunction updatePressingProgress(){\n  PressingView.updateProgress(pressingForm,[pressingCountry.value,pressingYear.value,pressingLabel.value,pressingCatalogNumber.value]);\n}\n\n`;
app=app.slice(0,helperStart)+helperReplacement+app.slice(helperEnd);

const scriptNeedle='<script src="/js/pressing-core.js?v=3"></script>\n';
if(!index.includes(scriptNeedle))throw new Error('Expected pressing-core script tag not found');
if(index.includes('/js/pressing-view.js'))throw new Error('pressing-view script tag already exists');
index=index.replace(scriptNeedle,scriptNeedle+'<script src="/js/pressing-view.js?v=1"></script>\n');

fs.writeFileSync(appPath,app);
fs.writeFileSync(indexPath,index);
console.log('Pressing view extraction applied. app.js is now '+Buffer.byteLength(app)+' bytes.');
