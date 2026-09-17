const fs=require('fs');

const appPath='js/app.js';
const indexPath='index.html';
const testPath='tests/pressing-picker.test.js';
let app=fs.readFileSync(appPath,'utf8');
let index=fs.readFileSync(indexPath,'utf8');
let tests=fs.readFileSync(testPath,'utf8');

function replaceOnce(source,oldText,newText,label){
  const first=source.indexOf(oldText);
  if(first<0)throw new Error('Missing expected '+label+' block');
  if(source.indexOf(oldText,first+oldText.length)>=0)throw new Error('Expected exactly one '+label+' block');
  return source.slice(0,first)+newText+source.slice(first+oldText.length);
}

app=replaceOnce(app,
"var PressingView=window.GroovyPressingView;\n",
"var PressingView=window.GroovyPressingView;\nvar PressingPicker=window.GroovyPressingPicker;\n",
'pressing dependency');

app=replaceOnce(app,
"var pressingAlbumIndex=-1;\nvar pressingVersions=[];\nvar pressingPages=1;\nvar pressingReleaseCache=new Map();\nvar pressingMatrixMatches=null;\n",
'',
'legacy pressing state');

const startMarker='var cleanVersionValue=PressingCore.cleanVersionValue;';
const endMarker='function spotifyAlbumLink(record){';
const start=app.indexOf(startMarker);
const end=app.indexOf(endMarker,start);
if(start<0||end<0)throw new Error('Could not locate pressing picker block');
if(app.indexOf(startMarker,start+1)>=0)throw new Error('Pressing picker start marker is not unique');

const replacement=`async function fetchPressingVersions(masterId,page){
  var response=await supabaseClient.functions.invoke('discogs-search',{
    body:{action:'versions',masterId:masterId,page:page}
  });
  if(response.error)throw response.error;
  return response.data||{};
}

async function fetchPressingRelease(releaseId){
  var response=await supabaseClient.functions.invoke('discogs-search',{
    body:{action:'release',releaseId:releaseId}
  });
  if(response.error)throw response.error;
  return response.data||{};
}

async function savePressingSelection(context){
  context=context||{};
  var selected=context.selected||{};
  var matrices=context.matrices||{};
  var button=context.button;
  var index=context.albumIndex;
  var record=records[index];
  if(!record)return;

  if(button){button.disabled=true;button.textContent='Saving…';}
  var userResult=await supabaseClient.auth.getUser();
  var user=userResult&&userResult.data&&userResult.data.user;
  var payload={
    discogs_release_id:parseInt(selected.id,10),
    pressing_country:selected.country||null,
    pressing_year:parseInt(selected.year,10)||null,
    pressing_label:selected.label||null,
    catalog_number:selected.catalogNumber||null,
    matrix_runout_a:matrices.A||null,
    matrix_runout_b:matrices.B||null,
    matrix_runout_c:matrices.C||null,
    matrix_runout_d:matrices.D||null,
    matrix_runout_e:matrices.E||null,
    matrix_runout_f:matrices.F||null,
    matrix_runout_g:matrices.G||null,
    matrix_runout_h:matrices.H||null,
    pressing_match_status:'discogs'
  };
  var result=(userResult.error||!user)?{error:userResult.error||new Error('Du måste vara inloggad.')}:await supabaseClient.from('collections').update(payload)
    .eq('id',record[9]).eq('user_id',user.id).select('id');

  if(result.error||!result.data||!result.data.length){
    console.error('Kunde inte spara pressningen:',result.error);
    if(button){button.disabled=false;button.textContent='Try saving again';}
    return;
  }

  record[11]=record[11]||{};
  record[11].discogsReleaseId=payload.discogs_release_id;
  record[11].country=payload.pressing_country||'';
  record[11].year=payload.pressing_year||'';
  record[11].label=payload.pressing_label||'';
  record[11].catalogNumber=payload.catalog_number||'';
  record[11].matrixA=payload.matrix_runout_a||'';
  record[11].matrixB=payload.matrix_runout_b||'';
  record[11].matrixC=payload.matrix_runout_c||'';
  record[11].matrixD=payload.matrix_runout_d||'';
  record[11].matrixE=payload.matrix_runout_e||'';
  record[11].matrixF=payload.matrix_runout_f||'';
  record[11].matrixG=payload.matrix_runout_g||'';
  record[11].matrixH=payload.matrix_runout_h||'';
  record[11].matchStatus='discogs';
  if(pressingPicker)pressingPicker.close();
  buildGrid();
  renderCopyDetails(index);
  copyDetailsSaved.textContent='Saved';
}

var pressingPicker=PressingPicker?PressingPicker.create({
  elements:{
    modal:pressingModal,
    closeButton:closePressingModalButton,
    loading:pressingLoading,
    form:pressingForm,
    error:pressingError,
    country:pressingCountry,
    year:pressingYear,
    label:pressingLabel,
    catalogNumber:pressingCatalogNumber,
    matrixSearch:pressingMatrixSearch,
    matrixQuery:pressingMatrixQuery,
    matrixSearchButton:pressingMatrixSearchButton,
    matches:pressingMatches
  },
  getRecord:function(index){return records[index]||null;},
  getMasterId:function(record){return record&&record[10];},
  fetchVersions:fetchPressingVersions,
  fetchRelease:fetchPressingRelease,
  onSave:savePressingSelection,
  onMissingMaster:function(){copyDetailsSaved.textContent='No Discogs master found';},
  onWarning:function(message,error){console.warn(message+':',error);},
  onError:function(message,error){console.error(message+':',error);},
  lockBody:function(){document.body.style.overflow='hidden';},
  unlockBody:function(){if(albumOverlay.className.indexOf('visible')===-1)document.body.style.overflow='';}
}):null;

function openPressingPicker(index){
  if(!pressingPicker){copyDetailsSaved.textContent='Pressing picker unavailable';return false;}
  return pressingPicker.open(index);
}

function closePressingPicker(){
  if(pressingPicker)pressingPicker.close();
}

`;

app=app.slice(0,start)+replacement+app.slice(end);

index=replaceOnce(index,
'<script src="/js/pressing-view.js?v=1"></script>\n',
'<script src="/js/pressing-view.js?v=1"></script>\n<script src="/js/pressing-picker.js?v=1"></script>\n',
'pressing picker script tag');

if(!tests.includes("test('pressing picker loads before app and owns the extracted flow'")){
  tests+=`\nconst fs=require('node:fs');\nconst path=require('node:path');\n\ntest('pressing picker loads before app and owns the extracted flow',()=>{\n  const root=path.resolve(__dirname,'..');\n  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');\n  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');\n  const pickerIndex=index.indexOf('/js/pressing-picker.js');\n  const appIndex=index.indexOf('/js/app.js');\n  assert.ok(pickerIndex>=0&&appIndex>pickerIndex);\n  assert.match(app,/var PressingPicker=window\\.GroovyPressingPicker;/);\n  assert.match(app,/PressingPicker\\?PressingPicker\\.create/);\n  assert.match(app,/fetchVersions:fetchPressingVersions/);\n  assert.match(app,/fetchRelease:fetchPressingRelease/);\n  assert.match(app,/onSave:savePressingSelection/);\n  assert.doesNotMatch(app,/function renderPressingMatches\\(/);\n  assert.doesNotMatch(app,/function searchPressingsByMatrix\\(/);\n  assert.doesNotMatch(app,/function refreshPressingFields\\(/);\n  assert.doesNotMatch(app,/function preparePressingConfirmation\\(/);\n  assert.doesNotMatch(app,/var pressingVersions=/);\n});\n`;
}

fs.writeFileSync(appPath,app);
fs.writeFileSync(indexPath,index);
fs.writeFileSync(testPath,tests);
console.log('Pressing picker extraction applied. app.js is now '+Buffer.byteLength(app)+' bytes.');
