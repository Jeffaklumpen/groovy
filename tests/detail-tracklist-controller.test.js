const test=require('node:test');
const assert=require('node:assert/strict');
const DetailTracklistController=require('../js/detail-tracklist-controller.js');

function makeStorage(){
  const data=new Map();
  return {
    data,
    getItem(key){return data.has(key)?data.get(key):null;},
    setItem(key,value){data.set(key,String(value));}
  };
}

function escapeHtml(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function makeRecordModel(){
  return {
    albumId(record){return record.albumId;},
    discogsMasterId(record){return record.masterId;},
    sides(record){return record.sides;},
    trackDurationCacheKey(record){return record.albumId?'cache:'+String(record.masterId||record.albumId):'';},
    hasMissingTrackDurations(record){
      return Object.values(record.sides||{}).some(tracks=>(tracks||[]).some(track=>!String(track.duration||'').trim()));
    },
    applyTrackDurations(record,incoming,overwrite){
      let changed=false;
      Object.keys(record.sides||{}).forEach(side=>{
        (record.sides[side]||[]).forEach((track,index)=>{
          const match=incoming.find(candidate=>
            String(candidate.disc_side||'').toUpperCase()===String(side).toUpperCase()&&
            Number(candidate.track_number||index+1)===Number(track.trackNumber||index+1)
          );
          if(!match)return;
          if(overwrite||!track.duration){
            const next=String(match.duration||'').trim();
            if(next&&track.duration!==next){track.duration=next;changed=true;}
          }
        });
      });
      return changed;
    }
  };
}

function createController(overrides={}){
  const element=overrides.element||{innerHTML:''};
  const storage=overrides.storage||makeStorage();
  const calls=[];
  const api=overrides.api||{
    functions:{
      async invoke(name,payload){
        calls.push({name,payload});
        return {data:{tracklist:[]}};
      }
    }
  };
  const pressingCore=overrides.pressingCore||{discogsTrackRows(){return [];}};
  const controller=DetailTracklistController.create({
    api,
    recordModel:overrides.recordModel||makeRecordModel(),
    pressingCore,
    element,
    storage,
    escapeHtml,
    getOpenRecordIndex:overrides.getOpenRecordIndex||(()=>0),
    now:overrides.now||(()=>1000),
    onLog:overrides.onLog||(()=>{})
  });
  return {controller,element,storage,calls};
}

test('cached track durations render without a Discogs request',async()=>{
  const storage=makeStorage();
  const record={albumId:1,masterId:9,sides:{A:[{id:'x',trackNumber:1,title:'One',duration:''}]}};
  storage.setItem('cache:9',JSON.stringify({tracks:[{disc_side:'A',track_number:1,duration:'3:00'}]}));
  let requests=0;
  const {controller,element}=createController({
    storage,
    api:{functions:{async invoke(){requests++;return {data:{tracklist:[]}};}}},
    getOpenRecordIndex:()=>4
  });

  await controller.openForRecord(record,4);

  assert.match(element.innerHTML,/3:00/);
  assert.equal(requests,0);
});

test('Discogs master durations normalize through pressing core and persist',async()=>{
  const storage=makeStorage();
  const record={albumId:42,masterId:123,sides:{A:[{trackNumber:1,title:'One',duration:''}]}};
  const actions=[];
  const {controller,element}=createController({
    storage,
    getOpenRecordIndex:()=>2,
    api:{functions:{async invoke(name,payload){
      actions.push(payload.body.action);
      return {data:{tracklist:[{position:'A1',title:'One',duration:'3:15'}]}};
    }}},
    pressingCore:{discogsTrackRows(albumId,tracks,includeDuration){
      assert.equal(albumId,42);
      assert.equal(includeDuration,true);
      assert.equal(tracks[0].position,'A1');
      return [{album_id:42,disc_side:'A',track_number:1,title:'One',duration:'3:15'}];
    }}
  });

  await controller.openForRecord(record,2);

  assert.deepEqual(actions,['master']);
  assert.match(element.innerHTML,/3:15/);
  assert.ok(storage.getItem('cache:123'));
  assert.equal(JSON.parse(storage.getItem('cache:123')).savedAt,1000);
});

test('Discogs hydration falls back to a vinyl release when master positions lack sides',async()=>{
  const record={albumId:42,masterId:123,sides:{A:[{trackNumber:1,title:'One',duration:''}]}};
  const actions=[];
  let normalizedTracklist=null;
  const {controller}=createController({
    api:{functions:{async invoke(name,payload){
      actions.push(payload.body.action);
      if(payload.body.action==='master')return {data:{tracklist:[{position:'1',title:'One'}]}};
      return {data:{tracklist:[{position:'A1',title:'One',duration:'4:00'}]}};
    }}},
    pressingCore:{discogsTrackRows(albumId,tracks){
      normalizedTracklist=tracks;
      return [{album_id:albumId,disc_side:'A',track_number:1,duration:'4:00'}];
    }}
  });

  await controller.openForRecord(record,0);

  assert.deepEqual(actions,['master','vinylRelease']);
  assert.equal(normalizedTracklist[0].position,'A1');
  assert.equal(record.sides.A[0].duration,'4:00');
});

test('late duration responses update data but do not rerender another open record',async()=>{
  const record={albumId:42,masterId:123,sides:{A:[{trackNumber:1,title:'One',duration:''}]}};
  const element={innerHTML:''};
  let currentIndex=0;
  let resolveRequest;
  const pendingRequest=new Promise(resolve=>{resolveRequest=resolve;});
  const {controller}=createController({
    element,
    getOpenRecordIndex:()=>currentIndex,
    api:{functions:{invoke(){return pendingRequest;}}},
    pressingCore:{discogsTrackRows(){
      return [{album_id:42,disc_side:'A',track_number:1,duration:'5:00'}];
    }}
  });

  const pending=controller.openForRecord(record,0);
  currentIndex=1;
  resolveRequest({data:{tracklist:[{position:'A1',duration:'5:00'}]}});
  await pending;

  assert.equal(record.sides.A[0].duration,'5:00');
  assert.doesNotMatch(element.innerHTML,/5:00/);
});

test('tracklist renderer preserves sides, numbering, empty durations and escaping',()=>{
  const record={
    albumId:42,
    masterId:123,
    sides:{
      A:[
        {id:'<1>',trackNumber:1,title:'One & Two',duration:'3:15'},
        {id:'2',trackNumber:null,title:'<Three>',duration:''}
      ],
      B:[]
    }
  };
  const {controller,element}=createController();

  controller.render(record);

  assert.match(element.innerHTML,/SIDE<\/span>A/);
  assert.match(element.innerHTML,/track-index">01</);
  assert.match(element.innerHTML,/One &amp; Two/);
  assert.match(element.innerHTML,/&lt;Three&gt;/);
  assert.match(element.innerHTML,/track-duration">—</);
  assert.match(element.innerHTML,/data-track-id="&lt;1&gt;"/);
});
