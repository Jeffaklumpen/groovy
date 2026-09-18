const test=require('node:test');
const assert=require('node:assert/strict');

const pickerPath=require.resolve('../js/pressing-picker.js');
const originalPicker=require(pickerPath);
const pickerInstances=[];

require.cache[pickerPath].exports={
  create(options){
    const instance={
      options,
      openCalls:[],
      closeCalls:0,
      open(index){this.openCalls.push(index);return Promise.resolve(true);},
      close(){this.closeCalls++;}
    };
    pickerInstances.push(instance);
    return instance;
  }
};
delete require.cache[require.resolve('../js/pressing-controller.js')];
const Controller=require('../js/pressing-controller.js');
require.cache[pickerPath].exports=originalPicker;

function makeRecordModel(){
  return {
    entryId(record){return record.entryId;},
    discogsMasterId(record){return record.masterId;},
    pressing(record){return record.pressing;},
    ensurePressing(record){
      if(!record.pressing)record.pressing={};
      return record.pressing;
    }
  };
}

function makeElement(){
  return {
    textContent:'',
    className:'',
    hidden:false,
    inert:false,
    disabled:false,
    value:'',
    style:{},
    innerHTML:'',
    listeners:{},
    addEventListener(name,fn){this.listeners[name]=fn;},
    setAttribute(){},
    classList:{toggle(){}},
    querySelector(){return null;}
  };
}

function makeApi(updateResult){
  const updates=[];
  const invokes=[];
  const api={
    auth:{async getUser(){return {data:{user:{id:'user-1'}},error:null};}},
    functions:{
      async invoke(name,options){
        invokes.push({name,options});
        return {data:{ok:true},error:null};
      }
    },
    from(table){
      assert.equal(table,'collections');
      return {
        update(payload){
          const call={payload,eqs:[]};
          updates.push(call);
          return {
            eq(column,value){
              call.eqs.push([column,value]);
              return this;
            },
            async select(){
              return updateResult||{data:[{id:'entry-1'}],error:null};
            }
          };
        }
      };
    }
  };
  return {api,updates,invokes};
}

function createHarness(record){
  pickerInstances.length=0;
  const elements={
    root:makeElement(),content:makeElement(),toggle:makeElement(),summary:makeElement(),saved:makeElement(),
    albumOverlay:makeElement(),pressingModal:makeElement(),closePressingModalButton:makeElement(),
    pressingLoading:makeElement(),pressingForm:makeElement(),pressingError:makeElement(),
    pressingCountry:makeElement(),pressingYear:makeElement(),pressingLabel:makeElement(),
    pressingCatalogNumber:makeElement(),pressingMatrixSearch:makeElement(),pressingMatrixQuery:makeElement(),
    pressingMatrixSearchButton:makeElement(),pressingMatches:makeElement(),
    clearPressingModal:makeElement(),clearPressingMessage:makeElement(),
    cancelClearPressing:makeElement(),confirmClearPressing:makeElement()
  };
  elements.albumOverlay.className='album-overlay visible';
  const media=makeElement();media.value='NM';
  const sleeve=makeElement();sleeve.value='VG+';
  elements.content.querySelector=selector=>selector==='#mediaConditionSelect'?media:selector==='#sleeveConditionSelect'?sleeve:null;
  const apiData=makeApi();
  let renderCount=0;
  const controller=Controller.create({
    api:apiData.api,
    recordModel:makeRecordModel(),
    document:{body:{style:{}}},
    elements,
    getRecords:()=>[record],
    getViewedUserId:()=>null,
    getLibraryView:()=> 'collection',
    renderGrid:()=>{renderCount++;}
  });
  return {controller,elements,media,sleeve,apiData,get renderCount(){return renderCount;},picker:pickerInstances[0]};
}

test('saves record and sleeve condition through the controller',async()=>{
  const record={artist:'Artist',title:'Album',albumId:'album-1',entryId:'entry-1',masterId:'master-1',pressing:{}};
  const h=createHarness(record);
  assert.equal(await h.controller.saveCondition(0),true);
  assert.deepEqual(h.apiData.updates[0].payload,{media_condition:'NM',sleeve_condition:'VG+'});
  assert.deepEqual(h.apiData.updates[0].eqs,[['id','entry-1'],['user_id','user-1']]);
  assert.equal(record.pressing.mediaCondition,'NM');
  assert.equal(record.pressing.sleeveCondition,'VG+');
  assert.equal(h.renderCount,1);
  assert.equal(h.elements.saved.textContent,'Saved');
});

test('saves a selected Discogs pressing and all matrix sides',async()=>{
  const record={artist:'Artist',title:'Album',albumId:'album-1',entryId:'entry-1',masterId:'master-1',pressing:{}};
  const h=createHarness(record);
  const button={disabled:false,textContent:'Save this pressing'};
  assert.equal(await h.controller.saveSelection({
    albumIndex:0,
    selected:{id:'123',country:'Sweden',year:'1977',label:'Harvest',catalogNumber:'ABC-1'},
    matrices:{A:'A-1',B:'B-2',H:'H-8'},
    button
  }),true);
  const payload=h.apiData.updates[0].payload;
  assert.equal(payload.discogs_release_id,123);
  assert.equal(payload.pressing_country,'Sweden');
  assert.equal(payload.pressing_year,1977);
  assert.equal(payload.matrix_runout_a,'A-1');
  assert.equal(payload.matrix_runout_b,'B-2');
  assert.equal(payload.matrix_runout_h,'H-8');
  assert.equal(record.pressing.discogsReleaseId,123);
  assert.equal(record.pressing.matrixH,'H-8');
  assert.equal(record.pressing.matchStatus,'discogs');
  assert.equal(h.picker.closeCalls,1);
  assert.equal(h.elements.saved.textContent,'Saved');
});

test('clear pressing opens the Groovy confirmation modal before changing data',async()=>{
  const record={
    artist:'Artist',title:'Album',albumId:'album-1',entryId:'entry-1',masterId:'master-1',
    pressing:{discogsReleaseId:123,country:'Sweden',mediaCondition:'NM',sleeveCondition:'VG+'}
  };
  const h=createHarness(record);

  assert.equal(h.controller.requestClearPressing(0),true);
  assert.equal(h.elements.clearPressingModal.style.display,'flex');
  assert.match(h.elements.clearPressingMessage.textContent,/Record and sleeve condition will be kept/);
  assert.equal(h.apiData.updates.length,0,'opening the modal must not clear data');

  await h.elements.confirmClearPressing.listeners.click();
  assert.equal(h.apiData.updates.length,1);
  assert.equal(h.elements.clearPressingModal.style.display,'none');
  assert.equal(h.elements.confirmClearPressing.disabled,false);
  assert.equal(h.elements.confirmClearPressing.textContent,'Clear pressing');
});

test('clears saved pressing metadata without removing condition grades',async()=>{
  const record={
    artist:'Artist',title:'Album',albumId:'album-1',entryId:'entry-1',masterId:'master-1',
    pressing:{
      discogsReleaseId:123,country:'Sweden',year:1977,label:'Harvest',catalogNumber:'ABC-1',
      matrixA:'A-1',matrixB:'B-2',matrixH:'H-8',matchStatus:'discogs',
      mediaCondition:'NM',sleeveCondition:'VG+'
    }
  };
  const h=createHarness(record);
  assert.equal(await h.controller.clearPressing(0),true);
  assert.deepEqual(h.apiData.updates[0].payload,{
    discogs_release_id:null,
    pressing_country:null,
    pressing_year:null,
    pressing_label:null,
    catalog_number:null,
    matrix_runout_a:null,
    matrix_runout_b:null,
    matrix_runout_c:null,
    matrix_runout_d:null,
    matrix_runout_e:null,
    matrix_runout_f:null,
    matrix_runout_g:null,
    matrix_runout_h:null,
    pressing_match_status:null
  });
  assert.equal(record.pressing.discogsReleaseId,null);
  assert.equal(record.pressing.country,'');
  assert.equal(record.pressing.matrixH,'');
  assert.equal(record.pressing.matchStatus,'');
  assert.equal(record.pressing.mediaCondition,'NM');
  assert.equal(record.pressing.sleeveCondition,'VG+');
  assert.equal(h.renderCount,1);
  assert.equal(h.elements.saved.textContent,'Pressing cleared');
});

test('Discogs fetch helpers keep versions and release actions separate',async()=>{
  const record={artist:'Artist',title:'Album',albumId:'album-1',entryId:'entry-1',masterId:'master-1',pressing:{}};
  const h=createHarness(record);
  await h.controller.fetchVersions('master-1',3);
  await h.controller.fetchRelease('release-2');
  assert.deepEqual(h.apiData.invokes,[
    {name:'discogs-search',options:{body:{action:'versions',masterId:'master-1',page:3}}},
    {name:'discogs-search',options:{body:{action:'release',releaseId:'release-2'}}}
  ]);
});

test('picker receives named record-model accessors and controller owns open/close',async()=>{
  const record={artist:'Artist',title:'Album',albumId:'album-1',entryId:'entry-1',masterId:'master-1',pressing:{}};
  const h=createHarness(record);
  assert.equal(h.picker.options.getMasterId(record),'master-1');
  assert.equal(await h.controller.openPicker(0),true);
  assert.deepEqual(h.picker.openCalls,[0]);
  h.controller.closePicker();
  assert.equal(h.picker.closeCalls,1);
});


test('pressing heading source uses viewed collector username outside own collection',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'..','js','pressing-controller.js'),'utf8');
  assert.match(source,/getViewedUsername/);
  assert.match(source,/\+"'s pressing"\)/);
});
