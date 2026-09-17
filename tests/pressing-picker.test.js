const test=require('node:test');
const assert=require('node:assert/strict');
const Picker=require('../js/pressing-picker.js');

function classList(){
  const values=new Set();
  return {toggle(name,on){if(on)values.add(name);else values.delete(name);},has(name){return values.has(name);}};
}

function element(value=''){
  const listeners={};
  return {
    value,
    hidden:false,
    disabled:false,
    innerHTML:'',
    textContent:'',
    style:{},
    classList:classList(),
    listeners,
    addEventListener(name,handler){listeners[name]=handler;},
    querySelectorAll(){return [];},
    querySelector(){return null;}
  };
}

function pickerFixture(){
  const country=element('');
  const year=element('');
  const label=element('');
  const catalog=element('');
  const matrixQuery=element('');
  const matrixButton=element('');
  const matrixSearch=element('');
  const matches=element('');
  const modal=element('');
  const loading=element('');
  const form=element('');
  const error=element('');
  const closeButton=element('');
  const bars=[element(),element(),element(),element(),element()];
  form.querySelectorAll=()=>bars;

  const pages=[];
  const releases=[];
  const controller=Picker.create({
    elements:{modal,loading,form,error,country,year,label,catalogNumber:catalog,matrixSearch,matrixQuery,matrixSearchButton:matrixButton,matches,closeButton},
    getRecord:index=>index===0?['','','','','','','','','','','master-1']:null,
    getMasterId:record=>record&&record[10],
    fetchVersions:async(masterId,page)=>{
      pages.push([masterId,page]);
      if(page===1)return {versions:[{id:1,country:'Canada',released:'1973',label:['Harvest'],catno:'SMAS-11163',format:['Vinyl','LP']}],pagination:{pages:2}};
      return {versions:[{id:2,country:'Canada',released:'1974',label:['Harvest'],catno:'SMAS-11163',format:['Vinyl','LP']}],pagination:{pages:2}};
    },
    fetchRelease:async releaseId=>{
      releases.push(Number(releaseId));
      return {
        country:'Canada',released:'1973-03-01',labels:[{name:'Harvest',catno:'SMAS-11163'}],
        formats:[{name:'Vinyl',qty:'1'}],
        identifiers:[
          {type:'Matrix / Runout',description:'Side A',value:'SMAS-11163 A-2'},
          {type:'Matrix / Runout',description:'Side B',value:'SMAS-11163 B-2'}
        ]
      };
    }
  });

  return {controller,elements:{country,year,label,catalog,matrixQuery,matrixButton,matrixSearch,matches,modal,loading,form,error,closeButton,bars},pages,releases};
}

test('simple pressing picker markup escapes option and release content',()=>{
  assert.match(Picker.simpleOptions(['A&B']),/A&amp;B/);
  const html=Picker.matchMarkup({id:42,label:'Harvest',catalogNumber:'SMAS-11163',country:'Canada',year:'1973',format:'Vinyl, LP'});
  assert.match(html,/data-release-id="42"/);
  assert.match(html,/Harvest · SMAS-11163/);
  assert.match(html,/Canada · 1973 · Vinyl, LP/);
});

test('picker owns paged Discogs version state and cascading fields',async()=>{
  const fx=pickerFixture();
  assert.equal(await fx.controller.open(0),true);
  assert.deepEqual(fx.pages,[['master-1',1],['master-1',2]]);
  assert.equal(fx.controller.state().versions.length,2);
  assert.equal(fx.elements.modal.style.display,'flex');
  assert.equal(fx.elements.loading.hidden,true);
  assert.equal(fx.elements.form.hidden,false);
  assert.match(fx.elements.country.innerHTML,/Canada/);

  fx.elements.country.value='Canada';
  fx.controller.refreshFields('country');
  assert.match(fx.elements.year.innerHTML,/1973/);
  assert.match(fx.elements.year.innerHTML,/1974/);

  fx.elements.year.value='1973';
  fx.controller.refreshFields('year');
  assert.match(fx.elements.label.innerHTML,/Harvest/);

  fx.elements.label.value='Harvest';
  fx.controller.refreshFields('label');
  assert.match(fx.elements.catalog.innerHTML,/SMAS-11163/);

  fx.elements.catalog.value='SMAS-11163';
  fx.controller.renderMatches();
  assert.match(fx.elements.matches.innerHTML,/data-release-id="1"/);
  assert.equal(fx.elements.matrixSearch.hidden,false);
});

test('matrix search uses release cache and renders the matching runout',async()=>{
  const fx=pickerFixture();
  await fx.controller.open(0);
  fx.elements.country.value='Canada';
  fx.elements.year.value='1973';
  fx.elements.label.value='Harvest';
  fx.elements.catalog.value='SMAS-11163';
  fx.elements.matrixQuery.value='SMAS11163A2';
  await fx.controller.searchByMatrix();
  assert.deepEqual(fx.releases,[1]);
  assert.equal(fx.controller.state().matrixMatches.length,1);
  assert.match(fx.elements.matches.innerHTML,/SMAS-11163 A-2/);
  assert.equal(fx.elements.matrixButton.disabled,false);
  assert.equal(fx.elements.matrixButton.textContent,'Find matrix');

  await fx.controller.prepareConfirmation(1);
  assert.deepEqual(fx.releases,[1]);
  assert.match(fx.elements.matches.innerHTML,/Likely match/);
  assert.match(fx.elements.matches.innerHTML,/Matrix \/ Runout A/);
  assert.match(fx.elements.matches.innerHTML,/Save this pressing/);
});

test('picker reports a missing master without opening the modal',async()=>{
  let missing=-1;
  const modal=element('');
  const controller=Picker.create({
    elements:{modal},
    getRecord:()=>['record'],
    getMasterId:()=>'',
    onMissingMaster:index=>{missing=index;}
  });
  assert.equal(await controller.open(7),false);
  assert.equal(missing,7);
  assert.equal(modal.style.display,undefined);
});

const fs=require('node:fs');
const path=require('node:path');

test('pressing picker loads before controller and the controller owns picker integration',()=>{
  const root=path.resolve(__dirname,'..');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const controller=fs.readFileSync(path.join(root,'js','pressing-controller.js'),'utf8');
  const pickerIndex=index.indexOf('/js/pressing-picker.js');
  const controllerIndex=index.indexOf('/js/pressing-controller.js');
  const appIndex=index.indexOf('/js/app.js');
  assert.ok(pickerIndex>=0&&controllerIndex>pickerIndex&&appIndex>controllerIndex);
  assert.match(app,/var PressingController=window\.GroovyPressingController;/);
  assert.doesNotMatch(app,/GroovyPressingPicker/);
  assert.match(controller,/Picker\?Picker\.create/);
  assert.match(controller,/fetchVersions:fetchVersions/);
  assert.match(controller,/fetchRelease:fetchRelease/);
  assert.match(controller,/onSave:saveSelection/);
  assert.doesNotMatch(app,/function renderPressingMatches\(/);
  assert.doesNotMatch(app,/function searchPressingsByMatrix\(/);
  assert.doesNotMatch(app,/function refreshPressingFields\(/);
  assert.doesNotMatch(app,/function preparePressingConfirmation\(/);
  assert.doesNotMatch(app,/var pressingVersions=/);
});
