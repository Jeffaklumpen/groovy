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
