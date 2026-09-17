const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');

function loadWikipedia(){
  const source=fs.readFileSync(path.join(root,'js','wikipedia-service.js'),'utf8');
  const windowObject={GroovyRecord:{artist:function(record){return record[1];},title:function(record){return record[2];},year:function(record){return record[3];}}};
  const context={window:windowObject};
  vm.runInNewContext(source,context);
  return windowObject.GroovyWikipedia;
}

test('Wikipedia service owns album identity and candidate helpers',function(){
  const Wikipedia=loadWikipedia();
  const record=[1,'Beyoncé','Renaissance (Deluxe Edition)',2022];
  assert.equal(Wikipedia.normalizeIdentity('Beyoncé & Jay-Z'),'beyonce and jay z');
  assert.equal(Wikipedia.cacheKey(record),'groovy-wikipedia-about-v5:beyonce|renaissance deluxe edition');
  assert.equal(typeof Wikipedia.candidateScore,'function');
  assert.equal(typeof Wikipedia.searchCandidates,'function');
  assert.equal(typeof Wikipedia.firstSection,'function');
  assert.equal(typeof Wikipedia.sectionParagraphs,'function');
});

test('Wikipedia service loads before app and extracted functions leave app.js',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const recordPosition=html.indexOf('/js/record-model.js?v=');
  const wikipediaPosition=html.indexOf('/js/wikipedia-service.js?v=');
  const controllerPosition=html.indexOf('/js/wikipedia-about-controller.js?v=');
  const appPosition=html.indexOf('/js/app.js?v=');
  const controller=fs.readFileSync(path.join(root,'js','wikipedia-about-controller.js'),'utf8');
  assert.ok(recordPosition>=0&&wikipediaPosition>recordPosition&&controllerPosition>wikipediaPosition&&appPosition>controllerPosition);
  assert.equal(app.includes('var Wikipedia=window.GroovyWikipedia'),true);
  assert.equal(app.includes('var WikipediaAboutController=window.GroovyWikipediaAboutController'),true);
  ['function normalizeWikipediaIdentity(','function wikipediaCacheKey(','function wikipediaIntroduction(','function wikipediaCandidateScore(','async function fetchWikipediaAlbumCandidates(','async function fetchWikipediaFirstSection(','async function fetchWikipediaSectionParagraphs('].forEach(function(token){assert.equal(app.includes(token),false,token+' should live outside app.js');});
  assert.equal(controller.includes('service.cacheKey(record)'),true);
  assert.equal(controller.includes('service.searchCandidates(record,queries[q])'),true);
  assert.equal(app.includes('Wikipedia.cacheKey(record)'),false);
  assert.equal(app.includes('Wikipedia.searchCandidates(record,queries[q])'),false);
});