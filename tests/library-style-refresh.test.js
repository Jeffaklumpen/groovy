const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const StyleRefresh=require('../js/library-style-refresh.js');

function loadRecordModel(){
  const source=fs.readFileSync(path.resolve(__dirname,'..','js','record-model.js'),'utf8');
  const context={window:{}};
  vm.runInNewContext(source,context);
  return context.window.GroovyRecord;
}

const Record=loadRecordModel();

function makeStorage(initial){
  const values=new Map(Object.entries(initial||{}));
  return {
    getItem(key){return values.has(key)?values.get(key):null;},
    setItem(key,value){values.set(key,String(value));},
    value(key){return values.get(key);}
  };
}

test('refresh persists own-library style and updates matching record',async()=>{
  const capture={invokes:[],updates:[]};
  const api={
    functions:{
      async invoke(name,options){
        capture.invokes.push([name,options]);
        return {data:{styles:['Progressive Rock']},error:null};
      }
    },
    from(table){
      return {
        update(payload){capture.updates.push([table,payload]);return this;},
        async eq(column,value){capture.eq=[column,value];return {error:null};}
      };
    }
  };

  const record=Record.fromCollection({id:'entry-1',discogs_style:'Rock',albums:{id:42,title:'Album',artists:{name:'Artist'},tracks:[]}},0,{});
  const rows=[{id:'entry-1',discogs_style:'Rock',albums:{id:42,discogs_master_id:99}}];
  const storage=makeStorage();
  let renders=0;

  const refresh=StyleRefresh.create({
    api,
    storage,
    recordModel:Record,
    discogsStyleLabel(){return 'Progressive Rock';},
    getRecords(){return [record];},
    getLibraryView(){return 'collection';},
    getViewedUserId(){return null;},
    getLoadVersion(){return 7;},
    renderGrid(){renders+=1;},
    now(){return 10000000000;}
  });

  assert.equal(await refresh.refresh(rows,7),true);
  assert.equal(capture.invokes.length,1);
  assert.deepEqual(capture.updates,[['collections',{discogs_style:'Progressive Rock'}]]);
  assert.deepEqual(capture.eq,['id','entry-1']);
  assert.equal(rows[0].discogs_style,'Progressive Rock');
  assert.equal(Record.genre(record),'Progressive Rock');
  assert.equal(renders,1);
  assert.equal(storage.value('groovy-style-v2-refresh-collections:entry-1'),'10000000000');
});

test('refresh updates viewed records without persisting another users rows',async()=>{
  let updateCalls=0;
  const api={
    functions:{async invoke(){return {data:{style:'Jazz'},error:null};}},
    from(){updateCalls+=1;throw new Error('should not persist viewed user style');}
  };

  const record=Record.fromCollection({id:'entry-2',discogs_style:'Rock',albums:{id:12,title:'Album',artists:{name:'Artist'},tracks:[]}},0,{});
  const refresh=StyleRefresh.create({
    api,
    storage:makeStorage(),
    recordModel:Record,
    discogsStyleLabel(){return 'Jazz';},
    getRecords(){return [record];},
    getLibraryView(){return 'collection';},
    getViewedUserId(){return 'other-user';},
    getLoadVersion(){return 3;},
    renderGrid(){},
    now(){return 20000000000;}
  });

  await refresh.refresh([{id:'entry-2',discogs_style:'Rock',albums:{id:12,discogs_master_id:77}}],3);
  assert.equal(updateCalls,0);
  assert.equal(Record.genre(record),'Jazz');
});

test('refresh skips entries cached within thirty days',async()=>{
  let invokes=0;
  const now=30000000000;
  const storage=makeStorage({'groovy-style-v2-refresh-wishlists:wish-1':String(now-1000)});
  const api={
    functions:{async invoke(){invokes+=1;return {data:{style:'Rock'},error:null};}},
    from(){throw new Error('not used');}
  };

  const refresh=StyleRefresh.create({
    api,
    storage,
    recordModel:Record,
    discogsStyleLabel(){return 'Rock';},
    getRecords(){return [];},
    getLibraryView(){return 'wishlist';},
    getViewedUserId(){return null;},
    getLoadVersion(){return 1;},
    renderGrid(){},
    now(){return now;}
  });

  assert.equal(await refresh.refresh([{id:'wish-1',albums:{id:5,discogs_master_id:6}}],1),false);
  assert.equal(invokes,0);
});
