const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const View=require('../js/pressing-view.js');

function classList(){
  const values=new Set();
  return {
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    has(name){return values.has(name);}
  };
}

function element(){
  return {
    hidden:false,
    innerHTML:'',
    textContent:'',
    inert:false,
    attrs:{},
    classList:classList(),
    setAttribute(name,value){this.attrs[name]=String(value);},
    querySelector(){return null;}
  };
}

test('copy detail helpers preserve conditions, summaries and A-H matrix output',()=>{
  assert.equal(View.hasCopyDetails({country:'Canada'}),true);
  assert.equal(View.hasCopyDetails({}),false);
  assert.equal(View.copySummaryText({country:'Canada',year:'1973'}),'Canada · 1973');
  assert.match(View.conditionOptions('VG+',true),/value="VG\+" selected/);
  assert.match(View.conditionOptions('',true),/No cover/);
  assert.deepEqual(View.conditionMeta('NM'),{className:'near-mint',label:'Near Mint'});
});

test('renderCopyDetails renders owner metadata, conditions and Discogs credit',()=>{
  const root=element(),content=element(),toggle=element(),summary=element(),saved=element();
  const state=View.renderCopyDetails({
    hasRecord:true,
    isWishlist:false,
    isOwner:true,
    details:{
      mediaCondition:'VG+',sleeveCondition:'VG',country:'Canada',year:'1973',label:'Harvest',catalogNumber:'SMAS-11163',
      matrixA:'SMAS-11163 A-2',matrixB:'SMAS-11163 B-2',discogsReleaseId:3417275
    },
    recordKey:'copy-1',
    previousRecordKey:'',
    expanded:false,
    elements:{root,content,toggle,summary,saved}
  });
  assert.deepEqual(state,{expanded:false,recordKey:'copy-1'});
  assert.equal(root.hidden,false);
  assert.match(summary.innerHTML,/Canada · 1973/);
  assert.match(summary.innerHTML,/VG\+/);
  assert.match(content.innerHTML,/Matrix \/ Runout A/);
  assert.match(content.innerHTML,/SMAS-11163 B-2/);
  assert.match(content.innerHTML,/Edit condition/);
  assert.match(content.innerHTML,/Change pressing/);
  assert.match(content.innerHTML,/discogs\.com\/release\/3417275/);
  assert.equal(toggle.attrs['aria-expanded'],'false');
  assert.equal(content.attrs['aria-hidden'],'true');
});

test('renderCopyDetails hides wishlist and empty other-user copy details',()=>{
  const root=element(),content=element();
  let state=View.renderCopyDetails({hasRecord:true,isWishlist:true,isOwner:true,details:{country:'SE'},previousRecordKey:'old',expanded:true,elements:{root,content}});
  assert.equal(root.hidden,true);
  assert.equal(content.innerHTML,'');
  assert.deepEqual(state,{expanded:true,recordKey:'old'});

  root.hidden=false;
  state=View.renderCopyDetails({hasRecord:true,isWishlist:false,isOwner:false,details:{},previousRecordKey:'old',expanded:false,elements:{root,content}});
  assert.equal(root.hidden,true);
  assert.deepEqual(state,{expanded:false,recordKey:'old'});
});

test('pressing select and progress helpers preserve legacy UI behavior',()=>{
  const select={innerHTML:'',disabled:false};
  View.setOptions(select,['Sweden','Canada'],'Choose country','Canada');
  assert.equal(select.disabled,false);
  assert.match(select.innerHTML,/Canada" selected/);
  View.setOptions(select,[],'Choose year','');
  assert.equal(select.disabled,true);

  const bars=[{classList:classList()},{classList:classList()},{classList:classList()},{classList:classList()},{classList:classList()}];
  const form={querySelectorAll(){return bars;}};
  assert.equal(View.updateProgress(form,['Canada','1973','','']),2);
  assert.equal(bars[0].classList.has('active'),true);
  assert.equal(bars[1].classList.has('active'),true);
  assert.equal(bars[2].classList.has('active'),true);
  assert.equal(bars[3].classList.has('active'),false);
});

test('pressing view loads before picker and app delegates copy rendering after extraction',()=>{
  const root=path.resolve(__dirname,'..');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const picker=fs.readFileSync(path.join(root,'js','pressing-picker.js'),'utf8');
  const viewIndex=index.indexOf('/js/pressing-view.js');
  const pickerIndex=index.indexOf('/js/pressing-picker.js');
  const appIndex=index.indexOf('/js/app.js');
  assert.ok(viewIndex>=0&&pickerIndex>viewIndex&&appIndex>pickerIndex);
  assert.match(app,/var PressingView=window\.GroovyPressingView;/);
  assert.match(app,/PressingView\.renderCopyDetails/);
  assert.match(picker,/View\.setOptions/);
  assert.match(picker,/View\.updateProgress/);
  assert.doesNotMatch(app,/PressingView\.setOptions/);
  assert.doesNotMatch(app,/PressingView\.updateProgress/);
  assert.match(app,/function recordConditionMeta\(value\)\{return PressingView\.conditionMeta\(value\);\}/);
  assert.match(app,/function hasCopyDetails\(details\)\{return PressingView\.hasCopyDetails\(details\);\}/);
  assert.doesNotMatch(app,/function conditionOptions\(/);
});
