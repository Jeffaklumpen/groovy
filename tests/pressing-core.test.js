const test=require('node:test');
const assert=require('node:assert/strict');
const Pressing=require('../js/pressing-core.js');

test('normalizes Discogs version data without UI dependencies',()=>{
  assert.deepEqual(Pressing.normalizeVersion({
    id:123,title:'  The Wall  ',country:' UK ',released:'1979-11-30',
    label:['Harvest','EMI'],catno:' SHDW 411 ',format:['Vinyl','LP']
  }),{id:123,title:'The Wall',country:'UK',year:'1979',label:'Harvest, EMI',catalogNumber:'SHDW 411',format:'Vinyl, LP'});
});

test('deduplicates pressing filter values case-insensitively and sorts them',()=>{
  assert.deepEqual(
    Pressing.uniqueVersionValues([{label:'Harvest'},{label:'harvest'},{label:' EMI '},{label:''}],'label'),
    ['EMI','Harvest']
  );
});

test('matches pressing choices, uncertain years and catalog punctuation',()=>{
  assert.equal(Pressing.pressingChoiceMatches(' UK ','uk'),true);
  assert.equal(Pressing.pressingYearMatches('', '1973'),true);
  assert.equal(Pressing.pressingYearMatches('1973','1974'),false);
  assert.equal(Pressing.pressingCatalogMatches('SMAS-11163','SMAS 11163'),true);
});

test('normalizes and extracts Discogs matrix runouts',()=>{
  assert.equal(Pressing.normalizedMatrix('SMAS-11163 A-2'),'smas11163a2');
  assert.deepEqual(Pressing.matrixValues({identifiers:[
    {type:'Matrix / Runout',value:' SMAS-11163 A-2 '},
    {type:'Barcode',value:'123'},
    {type:'Runout',value:'SMAS-11163 B-2'}
  ]}),['SMAS-11163 A-2','SMAS-11163 B-2']);
});

test('groups matrix choices by side and detects vinyl disc count',()=>{
  const choices=Pressing.matrixChoices({identifiers:[
    {type:'Matrix / Runout',description:'Side A',value:'AAA A-1'},
    {type:'Matrix / Runout',description:'Side B',value:'BBB B-1'}
  ]});
  assert.deepEqual(choices.a,['AAA A-1']);
  assert.deepEqual(choices.b,['BBB B-1']);
  assert.equal(Pressing.vinylDiscCount({formats:[{name:'Vinyl',qty:'1',descriptions:['2 x LP','Album']}]}),2);
  assert.equal(Pressing.vinylDiscCount({formats:[{name:'Vinyl',qty:'3'}]}),3);
});


test('filters Discogs versions with the same rules as the pressing picker',()=>{
  const versions=[
    {id:1,country:'UK',year:'1973',label:'Harvest',catalogNumber:'SMAS-11163'},
    {id:2,country:'UK',year:'',label:'Harvest',catalogNumber:'SMAS 11163'},
    {id:3,country:'US',year:'1973',label:'Capitol',catalogNumber:'SMAS-11163'}
  ];
  assert.deepEqual(Pressing.filterVersions(versions,{country:'uk',year:'1973',label:'harvest',catalogNumber:'SMAS 11163'}).map(v=>v.id),[1,2]);
});

test('deduplicates matrix matches using matrix, country, label and catalog identity',()=>{
  const values=[
    {id:1,matrixMatch:'SMAS-11163 A-2',country:'Canada',label:'Harvest',catalogNumber:'SMAS-11163'},
    {id:2,matrixMatch:'SMAS 11163 A2',country:'canada',label:'harvest',catalogNumber:'SMAS 11163'},
    {id:3,matrixMatch:'SMAS-11163 B-2',country:'Canada',label:'Harvest',catalogNumber:'SMAS-11163'}
  ];
  assert.deepEqual(Pressing.dedupeMatrixMatches(values).map(v=>v.id),[1,3]);
});

test('builds selected pressing details and matrix sides without UI dependencies',()=>{
  assert.deepEqual(Pressing.selectReleaseDetails(99,{country:'CA',released:'1973-03-01',labels:[{name:'Harvest',catno:'SMAS-11163'}]},{format:'Vinyl'}),{
    id:99,country:'CA',year:'1973',label:'Harvest',catalogNumber:'SMAS-11163',format:'Vinyl'
  });
  assert.deepEqual(Pressing.matrixSideNames({formats:[{name:'Vinyl',qty:'2'}]}),['a','b','c','d']);
  assert.deepEqual(Pressing.matrixSideNames({formats:[{name:'Vinyl',qty:'5'}]}),['a','b','c','d','e','f','g','h']);
});
