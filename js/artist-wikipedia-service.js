(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyArtistWikipedia=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  var cache=new Map();

  function normalize(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  }

  function plain(value){
    var html=String(value||'');
    if(!html)return '';
    try{
      var doc=new DOMParser().parseFromString(html,'text/html');
      return String(doc.body.textContent||'').replace(/\s+/g,' ').trim();
    }catch(error){
      return html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    }
  }

  function candidateScore(page,name){
    var wanted=normalize(name);
    var title=normalize(page&&page.title);
    var extract=normalize(page&&page.extract);
    var score=0;
    if(!wanted||!title)return -100;
    if(title===wanted)score+=60;
    else if(title.indexOf(wanted)!==-1)score+=28;
    if(/\b(band|musician|singer|rapper|composer|artist|duo|group|songwriter|producer)\b/.test(extract))score+=18;
    if(/may refer to|disambiguation/.test(extract))score-=70;
    if(page&&page.index)score+=Math.max(0,6-Number(page.index));
    return score;
  }

  async function search(name){
    var params=new URLSearchParams({
      action:'query',
      format:'json',
      formatversion:'2',
      origin:'*',
      generator:'search',
      gsrsearch:'"'+name+'" musician OR band',
      gsrnamespace:'0',
      gsrlimit:'6',
      prop:'extracts|info|pageimages',
      exintro:'1',
      explaintext:'1',
      inprop:'url',
      piprop:'thumbnail|name',
      pithumbsize:'900',
      redirects:'1'
    });
    var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{credentials:'omit'});
    if(!response.ok)throw new Error('Wikipedia returned '+response.status);
    var data=await response.json();
    var pages=data&&data.query&&Array.isArray(data.query.pages)?data.query.pages:[];
    return pages.map(function(page,index){page.index=index;return page;});
  }

  async function topSections(page,limit){
    var params=new URLSearchParams({
      action:'parse',format:'json',formatversion:'2',origin:'*',prop:'sections',redirects:'1'
    });
    if(page.pageid)params.set('pageid',String(page.pageid)); else params.set('page',String(page.title||''));
    var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{credentials:'omit'});
    if(!response.ok)return [];
    var data=await response.json();
    var blocked=/^(references|external links|see also|notes|sources|bibliography|further reading)$/i;
    return (data&&data.parse&&Array.isArray(data.parse.sections)?data.parse.sections:[])
      .filter(function(item){return (String(item.level||'')==='2'||Number(item.toclevel)===1)&&!blocked.test(plain(item.line));})
      .slice(0,Math.max(1,Number(limit)||2))
      .map(function(item){return {heading:plain(item.line),index:String(item.index||'')};});
  }

  async function sectionParagraphs(page,index){
    if(!index)return [];
    var params=new URLSearchParams({
      action:'parse',format:'json',formatversion:'2',origin:'*',prop:'text',
      section:String(index),redirects:'1',disableeditsection:'1'
    });
    if(page.pageid)params.set('pageid',String(page.pageid)); else params.set('page',String(page.title||''));
    var response=await fetch('https://en.wikipedia.org/w/api.php?'+params.toString(),{credentials:'omit'});
    if(!response.ok)return [];
    var data=await response.json();
    var html=data&&data.parse?String(data.parse.text||''):'';
    if(!html)return [];
    var doc=new DOMParser().parseFromString(html,'text/html');
    Array.prototype.slice.call(doc.body.querySelectorAll('sup.reference,.mw-editsection,style,script,table,figure,.navbox,.infobox,.thumb,.hatnote')).forEach(function(node){node.remove();});
    return Array.prototype.slice.call(doc.body.querySelectorAll('p')).map(function(p){
      return String(p.textContent||'').replace(/\s+/g,' ').trim();
    }).filter(Boolean);
  }

  function freeLicense(value){
    var license=String(value||'').trim();
    return /^(?:CC\s|CC0|Public domain|PD\b|GNU Free Documentation|GFDL)/i.test(license);
  }

  async function freeImage(page){
    var fileName=String(page&&page.pageimage||'').trim();
    if(!fileName)return null;
    var params=new URLSearchParams({
      action:'query',format:'json',formatversion:'2',origin:'*',
      titles:'File:'+fileName,prop:'imageinfo',
      iiprop:'url|extmetadata',iiurlwidth:'900'
    });
    var response=await fetch('https://commons.wikimedia.org/w/api.php?'+params.toString(),{credentials:'omit'});
    if(!response.ok)return null;
    var data=await response.json();
    var pages=data&&data.query&&Array.isArray(data.query.pages)?data.query.pages:[];
    var info=pages[0]&&Array.isArray(pages[0].imageinfo)?pages[0].imageinfo[0]:null;
    if(!info)return null;
    var meta=info.extmetadata||{};
    var license=meta.LicenseShortName&&meta.LicenseShortName.value?plain(meta.LicenseShortName.value):'';
    if(!freeLicense(license))return null;
    return {
      url:String(info.thumburl||info.url||''),
      page_url:String(info.descriptionurl||''),
      credit:plain((meta.Artist&&meta.Artist.value)||(meta.Credit&&meta.Credit.value)||'Wikimedia Commons'),
      license:license
    };
  }

  async function load(name){
    var key=normalize(name);
    if(!key)return null;
    if(cache.has(key))return cache.get(key);

    var promise=(async function(){
      var pages=await search(name);
      var ranked=pages.map(function(page){return {page:page,score:candidateScore(page,name)};}).sort(function(a,b){return b.score-a.score;});
      var best=ranked[0];
      if(!best||best.score<25)return null;
      var page=best.page;
      var sections=await topSections(page,2);
      var sectionData=[];
      for(var i=0;i<sections.length;i++){
        sectionData.push({
          heading:sections[i].heading,
          paragraphs:await sectionParagraphs(page,sections[i].index)
        });
      }
      var image=null;
      try{image=await freeImage(page);}catch(error){}
      return {
        title:String(page.title||name),
        url:String(page.fullurl||'https://en.wikipedia.org/wiki/'+encodeURIComponent(page.title||name)),
        introduction:String(page.extract||'').replace(/\s+/g,' ').trim(),
        sections:sectionData,
        image:image
      };
    })();

    cache.set(key,promise);
    try{
      var result=await promise;
      cache.set(key,Promise.resolve(result));
      return result;
    }catch(error){
      cache.delete(key);
      throw error;
    }
  }

  return Object.freeze({normalize:normalize,candidateScore:candidateScore,load:load});
});
