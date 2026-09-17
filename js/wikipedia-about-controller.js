(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory();
  }else{
    root.GroovyWikipediaAboutController=factory();
  }
})(typeof window!=='undefined'?window:null,function(){
  function create(options){
    options=options||{};

    var service=options.service;
    var recordModel=options.recordModel;
    var win=options.window||((typeof window!=='undefined')?window:null);
    var doc=options.document||(win&&win.document)||null;
    var elements=options.elements||{};
    var rootElement=elements.root||null;
    var textElement=elements.text||null;
    var bodyElement=elements.body||null;
    var toggleElement=elements.toggle||null;
    var linkElement=elements.link||null;
    var storage=options.storage||(win&&win.localStorage)||null;
    var now=typeof options.now==='function'?options.now:Date.now;
    var requestFrame=options.requestAnimationFrame||
      ((win&&typeof win.requestAnimationFrame==='function')?win.requestAnimationFrame.bind(win):function(fn){fn();});
    var getComputedStyleFn=options.getComputedStyle||
      ((win&&typeof win.getComputedStyle==='function')?win.getComputedStyle.bind(win):function(){return {lineHeight:'20.8px'};});
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};
    var requestVersion=0;
    var cache=new Map();
    var cacheTtl=14*24*60*60*1000;
    var bound=false;

    if(!service)throw new Error('Wikipedia about controller requires a Wikipedia service');
    if(!recordModel)throw new Error('Wikipedia about controller requires a record model');
    if(!doc)throw new Error('Wikipedia about controller requires a document');

    function log(level,message,error){onLog(level,message,error);}

    function lineHeight(){
      if(!textElement)return 20.8;
      var sample=textElement.querySelector('p')||textElement;
      var style=getComputedStyleFn(sample);
      return parseFloat(style.lineHeight)||20.8;
    }

    function renderParagraphs(text,heading,sectionParagraphs){
      if(!textElement)return;
      textElement.innerHTML='';
      String(text||'').split(/\n{2,}/).map(function(paragraph){
        return paragraph.replace(/\s*\n\s*/g,' ').trim();
      }).filter(Boolean).forEach(function(paragraph){
        var paragraphElement=doc.createElement('p');
        paragraphElement.textContent=paragraph;
        textElement.appendChild(paragraphElement);
      });
      if(heading){
        var headingElement=doc.createElement('h3');
        headingElement.className='about-album-first-heading';
        headingElement.textContent=heading;
        textElement.appendChild(headingElement);
      }
      (Array.isArray(sectionParagraphs)?sectionParagraphs:[]).forEach(function(paragraph){
        var value=String(paragraph||'').replace(/\s+/g,' ').trim();
        if(!value)return;
        var paragraphElement=doc.createElement('p');
        paragraphElement.textContent=value;
        textElement.appendChild(paragraphElement);
      });
    }

    function setExpanded(expanded,animate){
      if(!bodyElement||!toggleElement)return;
      var textSpan=toggleElement.querySelector('span');
      var collapsedHeight=lineHeight()*3;
      toggleElement.setAttribute('aria-expanded',expanded?'true':'false');
      bodyElement.classList.toggle('expanded',expanded);
      if(textSpan)textSpan.textContent=expanded?'Show less':'Read more';
      if(!animate)bodyElement.style.transition='none';
      bodyElement.style.maxHeight=(expanded?bodyElement.scrollHeight:collapsedHeight)+'px';
      if(!animate){
        bodyElement.offsetHeight;
        bodyElement.style.transition='';
      }
    }

    function syncToggle(reset){
      if(!bodyElement||!textElement||!toggleElement)return;
      if(reset)setExpanded(false,false);
      requestFrame(function(){
        var collapsedHeight=lineHeight()*3;
        var needsToggle=bodyElement.scrollHeight>collapsedHeight+2;
        toggleElement.hidden=!needsToggle;
        if(!needsToggle){
          bodyElement.classList.add('expanded');
          bodyElement.style.maxHeight=bodyElement.scrollHeight+'px';
        }else if(reset){
          setExpanded(false,false);
        }
      });
    }

    function readCache(record){
      var key=service.cacheKey(record);
      if(cache.has(key))return cache.get(key);
      if(!storage)return null;
      try{
        var stored=JSON.parse(storage.getItem(key)||'null');
        if(stored&&stored.savedAt&&now()-stored.savedAt<cacheTtl&&stored.text){
          cache.set(key,stored);
          return stored;
        }
      }catch(error){}
      return null;
    }

    function saveCache(record,result){
      var key=service.cacheKey(record);
      var cached={
        text:result.text,
        heading:result.heading||'',
        sectionParagraphs:Array.isArray(result.sectionParagraphs)?result.sectionParagraphs:[],
        url:result.url,
        title:result.title,
        savedAt:now()
      };
      cache.set(key,cached);
      if(storage){
        try{storage.setItem(key,JSON.stringify(cached));}catch(error){}
      }
      return cached;
    }

    function render(result){
      if(!rootElement||!textElement||!linkElement)return;
      if(!result||!result.text){rootElement.hidden=true;return;}
      renderParagraphs(result.text,result.heading||'',result.sectionParagraphs||[]);
      linkElement.href=result.url||'https://en.wikipedia.org/';
      linkElement.setAttribute('aria-label','Read '+(result.title||'this album article')+' on Wikipedia');
      rootElement.hidden=false;
      syncToggle(true);
    }

    async function openForRecord(record){
      var request=++requestVersion;
      if(!rootElement||!textElement||!linkElement)return;

      var cached=readCache(record);
      if(cached){render(cached);return;}

      renderParagraphs('Loading album information…','',[]);
      if(toggleElement)toggleElement.hidden=true;
      if(bodyElement){
        bodyElement.classList.remove('expanded');
        bodyElement.style.maxHeight='';
      }
      linkElement.href='https://en.wikipedia.org/';
      rootElement.hidden=false;

      try{
        var album=String(recordModel.title(record)||'').trim();
        var artist=String(recordModel.artist(record)||'').trim();
        var queries=['"'+album+'" "'+artist+'" album',album+' '+artist+' album'];
        var pages=[];

        for(var q=0;q<queries.length&&!pages.length;q++){
          pages=await service.searchCandidates(record,queries[q]);
        }

        if(request!==requestVersion)return;
        var ranked=pages.map(function(page){
          return {page:page,score:service.candidateScore(page,record)};
        }).sort(function(a,b){return b.score-a.score;});
        var best=ranked.length?ranked[0]:null;
        var introduction=best&&best.score>=18?service.introduction(best.page.extract):'';

        if(!introduction){rootElement.hidden=true;return;}
        var firstSection=await service.firstSection(best.page);
        if(request!==requestVersion)return;
        var firstHeading=firstSection&&firstSection.heading?firstSection.heading:'';
        var sectionParagraphs=firstSection?await service.sectionParagraphs(best.page,firstSection.index):[];
        if(request!==requestVersion)return;
        var result=saveCache(record,{
          text:introduction,
          heading:firstHeading,
          sectionParagraphs:sectionParagraphs,
          url:best.page.fullurl||'https://en.wikipedia.org/wiki/'+encodeURIComponent(best.page.title||''),
          title:best.page.title||''
        });
        render(result);
      }catch(error){
        if(request!==requestVersion)return;
        log('warn','Could not load Wikipedia album information:',error);
        rootElement.hidden=true;
      }
    }

    function close(){
      requestVersion++;
      if(rootElement)rootElement.hidden=true;
      if(toggleElement){
        toggleElement.hidden=true;
        toggleElement.setAttribute('aria-expanded','false');
      }
      if(bodyElement){
        bodyElement.classList.remove('expanded');
        bodyElement.style.maxHeight='';
      }
    }

    function handleToggleClick(){
      var expanded=toggleElement.getAttribute('aria-expanded')==='true';
      setExpanded(!expanded,true);
    }

    function bind(){
      if(bound)return;
      bound=true;
      if(toggleElement&&typeof toggleElement.addEventListener==='function'){
        toggleElement.addEventListener('click',handleToggleClick);
      }
    }

    bind();

    return Object.freeze({
      openForRecord:openForRecord,
      close:close,
      setExpanded:setExpanded,
      syncToggle:syncToggle,
      state:function(){return {requestVersion:requestVersion,cacheSize:cache.size};}
    });
  }

  return Object.freeze({create:create});
});
