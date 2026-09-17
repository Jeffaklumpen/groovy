(function(windowObject){
'use strict';

if(!windowObject)return;

var Record=windowObject.GroovyRecord;
if(!Record)throw new Error('GroovyRecord must load before wikipedia-service.js');

function normalizeIdentity(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
}

function cacheKey(record){
  return 'groovy-wikipedia-about-v5:'+normalizeIdentity(Record.artist(record))+'|'+normalizeIdentity(Record.title(record));
}

function introduction(extract){
  var html=String(extract||'').trim();
  if(!html)return '';

  try{
    var doc=new DOMParser().parseFromString(html,'text/html');
    var paragraphs=Array.prototype.slice.call(doc.body.querySelectorAll('p')).map(function(paragraph){
      return String(paragraph.textContent||'').replace(/\s+/g,' ').trim();
    }).filter(Boolean);
    if(paragraphs.length)return paragraphs.join('\n\n');
    return String(doc.body.textContent||'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  }catch(error){
    var fallback=document.createElement('div');
    fallback.innerHTML=html;
    return String(fallback.textContent||'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  }
}

function candidateScore(page,record){
  var album=normalizeIdentity(Record.title(record));
  var artist=normalizeIdentity(Record.artist(record));
  var title=normalizeIdentity(page&&page.title);
  var extract=normalizeIdentity(introduction(page&&page.extract));
  var year=String(Record.year(record)||'').trim();
  var score=0;

  if(!album||!title)return -100;
  if(title===album)score+=30;
  else if(title.indexOf(album+' ')===0)score+=25;
  else if(title.indexOf(album)!==-1)score+=13;
  if(/\balbum\b/.test(title))score+=7;
  if(artist&&title.indexOf(artist)!==-1)score+=12;
  if(artist&&extract.indexOf(artist)!==-1)score+=22;
  if(/\b(studio|live|compilation|soundtrack|debut|album)\b/.test(extract))score+=8;
  if(year&&extract.indexOf(year)!==-1)score+=3;
  if(/may refer to|can refer to|disambiguation/.test(extract))score-=60;
  if(page&&page.index)score+=Math.max(0,6-Number(page.index));
  return score;
}

async function searchCandidates(record,query){
  var params=new URLSearchParams({
    action:'query',
    format:'json',
    formatversion:'2',
    origin:'*',
    generator:'search',
    gsrsearch:query,
    gsrnamespace:'0',
    gsrlimit:'5',
    prop:'extracts|info',
    exintro:'1',
    inprop:'url',
    redirects:'1'
  });
  var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{method:'GET',credentials:'omit'});
  if(!response.ok)throw new Error('Wikipedia returned '+response.status);
  var data=await response.json();
  return data&&data.query&&Array.isArray(data.query.pages)?data.query.pages:[];
}

async function firstSection(page){
  if(!page)return null;
  var params=new URLSearchParams({
    action:'parse',
    format:'json',
    formatversion:'2',
    origin:'*',
    prop:'sections',
    redirects:'1'
  });
  if(page.pageid)params.set('pageid',String(page.pageid));
  else if(page.title)params.set('page',String(page.title));
  else return null;
  var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{method:'GET',credentials:'omit'});
  if(!response.ok)return null;
  var data=await response.json();
  var sections=data&&data.parse&&Array.isArray(data.parse.sections)?data.parse.sections:[];
  var section=sections.find(function(item){return String(item.level||'')==='2'||Number(item.toclevel)===1;});
  if(!section||!section.line)return null;
  var holder=document.createElement('div');
  holder.innerHTML=String(section.line);
  return {
    heading:String(holder.textContent||'').replace(/\s+/g,' ').trim(),
    index:section.index===undefined||section.index===null?'':String(section.index)
  };
}

async function sectionParagraphs(page,sectionIndex){
  if(!page||sectionIndex==='')return [];
  var params=new URLSearchParams({
    action:'parse',
    format:'json',
    formatversion:'2',
    origin:'*',
    prop:'text',
    section:String(sectionIndex),
    redirects:'1',
    disableeditsection:'1'
  });
  if(page.pageid)params.set('pageid',String(page.pageid));
  else if(page.title)params.set('page',String(page.title));
  else return [];
  var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{method:'GET',credentials:'omit'});
  if(!response.ok)return [];
  var data=await response.json();
  var html=data&&data.parse?String(data.parse.text||''):'';
  if(!html)return [];
  var doc=new DOMParser().parseFromString(html,'text/html');
  Array.prototype.slice.call(doc.body.querySelectorAll('sup.reference,.mw-editsection,style,script,table,figure,.navbox,.infobox,.thumb,.hatnote')).forEach(function(element){element.remove();});
  return Array.prototype.slice.call(doc.body.querySelectorAll('p')).map(function(paragraph){
    return String(paragraph.textContent||'').replace(/\s+/g,' ').trim();
  }).filter(Boolean);
}

windowObject.GroovyWikipedia=Object.freeze({
  normalizeIdentity:normalizeIdentity,
  cacheKey:cacheKey,
  introduction:introduction,
  candidateScore:candidateScore,
  searchCandidates:searchCandidates,
  firstSection:firstSection,
  sectionParagraphs:sectionParagraphs
});
})(typeof window!=='undefined'?window:null);
