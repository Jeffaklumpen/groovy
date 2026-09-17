const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Wikipedia=require('../js/wikipedia-service.js');

const root=path.resolve(__dirname,'..');

test('Wikipedia service owns album identity and candidate helpers',function(){
  const record=[];
  record[1]='Beyoncé';
  record[2]='Renaissance (Deluxe Edition)';
  record[3]='2022';
  record[10]=123;
  assert.equal(Wikipedia.cacheKey(record),'groovy-wikipedia-about-v5:beyonce|renaissance deluxe edition');
  assert.equal(typeof Wikipedia.candidateScore,'function');
  assert.equal(typeof Wikipedia.searchCandidates,'function');
  assert.equal(typeof Wikipedia.firstSection,'function');
  assert.equal(typeof Wikipedia.sectionParagraphs,'function');
});

test('Wikipedia service loads before app and extracted functions leave app.js',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const recordPosition=html.indexOf('/js/record-model.js?v=1');
  const wikipediaPosition=html.indexOf('/js/wikipedia-service.js?v=1');
  const appPosition=html.indexOf('/js/app.js?v=');
  assert.ok(recordPosition>=0&&wikipediaPosition>recordPosition&&appPosition>wikipediaPosition);
  assert.equal(app.includes('var Wikipedia=window.GroovyWikipedia'),true);
  ['function normalizeWikipediaIdentity(','function wikipediaCacheKey(','function wikipediaIntroduction(','function wikipediaCandidateScore(','async function fetchWikipediaAlbumCandidates(','async function fetchWikipediaFirstSection(','async function fetchWikipediaSectionParagraphs('].forEach(function(token){assert.equal(app.includes(token),false,token+' should live outside app.js');});
  assert.equal(app.includes('Wikipedia.cacheKey(record)'),true);
  assert.equal(app.includes('Wikipedia.searchCandidates(record,queries[q])'),true);
});