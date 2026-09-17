(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./pressing-core.js'),require('./pressing-view.js'));
  }else if(root){
    root.GroovyPressingPicker=factory(root.GroovyPressingCore,root.GroovyPressingView);
  }
})(typeof window!=='undefined'?window:null,function(Core,View){
'use strict';

function esc(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function simpleOptions(values){
  values=Array.isArray(values)?values:[];
  return '<option value="">Not set</option>'+values.map(function(value){
    return '<option value="'+esc(value)+'">'+esc(value)+'</option>';
  }).join('');
}

function matchMarkup(version){
  version=version||{};
  return '<button class="pressing-match" type="button" data-release-id="'+esc(version.id)+'">'+
    '<span class="pressing-match-title">'+esc((version.label||'')+' · '+(version.catalogNumber||''))+'</span>'+
    '<span class="pressing-match-meta">'+esc([version.country,version.year||'Year not listed',version.format].filter(Boolean).join(' · '))+'</span>'+
    (version.matrixMatch?'<span class="pressing-match-matrix">'+esc(version.matrixMatch)+'</span>':'')+
  '</button>';
}

function create(options){
  options=options||{};
  var elements=options.elements||{};
  var modal=elements.modal;
  var loading=elements.loading;
  var form=elements.form;
  var errorBox=elements.error;
  var country=elements.country;
  var year=elements.year;
  var label=elements.label;
  var catalog=elements.catalogNumber;
  var matrixSearch=elements.matrixSearch;
  var matrixQuery=elements.matrixQuery;
  var matrixSearchButton=elements.matrixSearchButton;
  var matches=elements.matches;
  var closeButton=elements.closeButton;

  var albumIndex=-1;
  var versions=[];
  var pages=1;
  var releaseCache=new Map();
  var matrixMatches=null;

  function getRecord(index){
    return typeof options.getRecord==='function'?options.getRecord(index):null;
  }

  function getMasterId(record){
    return typeof options.getMasterId==='function'?options.getMasterId(record):(record&&record[10]);
  }

  function currentMatches(){
    return Core.filterVersions(versions,{
      country:country&&country.value,
      year:year&&year.value,
      label:label&&label.value,
      catalogNumber:catalog&&catalog.value
    });
  }

  function updateProgress(){
    return View.updateProgress(form,[country&&country.value,year&&year.value,label&&label.value,catalog&&catalog.value]);
  }

  function renderMatches(){
    if(!matches)return;
    var allMatches=matrixMatches===null?currentMatches():matrixMatches;

    if(!catalog||!catalog.value){
      matches.innerHTML='';
      if(matrixSearch)matrixSearch.hidden=true;
      return;
    }

    if(matrixSearch)matrixSearch.hidden=false;
    var visible=matrixMatches===null?allMatches.slice(0,5):allMatches;
    var moreCount=matrixMatches===null?Math.max(0,allMatches.length-visible.length):0;

    matches.innerHTML=visible.map(matchMarkup).join('')+
      (moreCount?'<p class="pressing-help">'+moreCount+' more possible pressings. Enter your matrix above to find the right one.</p>':'');

    if(!visible.length){
      matches.innerHTML='<div class="pressing-error">'+(matrixMatches===null
        ?'No pressings match these choices.'
        :'No pressing contains that matrix. Try a shorter section of the runout text.')+'</div>';
    }

    if(matches.querySelectorAll){
      var buttons=matches.querySelectorAll('.pressing-match');
      for(var i=0;i<buttons.length;i++){
        if(buttons[i]&&buttons[i].addEventListener)buttons[i].addEventListener('click',function(){
          prepareConfirmation(this.getAttribute('data-release-id'));
        });
      }
    }
  }

  function refreshFields(changedField){
    matrixMatches=null;
    if(matrixQuery)matrixQuery.value='';
    var countryValue=country?country.value:'';
    var yearValue=changedField==='country'?'':(year?year.value:'');
    var labelValue=(changedField==='country'||changedField==='year')?'':(label?label.value:'');
    var catalogValue=(changedField!=='catalog')?'':(catalog?catalog.value:'');

    if(changedField==='country'){
      View.setOptions(year,Core.uniqueVersionValues(versions.filter(function(version){return version.country===countryValue;}),'year'),'Choose year',yearValue);
      View.setOptions(label,[],'Choose label','');
      View.setOptions(catalog,[],'Choose catalog number','');
    }else if(changedField==='year'){
      View.setOptions(label,Core.uniqueVersionValues(versions.filter(function(version){return version.country===countryValue&&Core.pressingYearMatches(version.year,yearValue); }),'label'),'Choose label',labelValue);
      View.setOptions(catalog,[],'Choose catalog number','');
    }else if(changedField==='label'){
      View.setOptions(catalog,Core.uniqueVersionValues(versions.filter(function(version){return version.country===countryValue&&Core.pressingYearMatches(version.year,yearValue)&&version.label===labelValue;}),'catalogNumber'),'Choose catalog number',catalogValue);
    }

    renderMatches();
    updateProgress();
  }

  async function loadPage(masterId,page){
    if(typeof options.fetchVersions!=='function')throw new Error('Pressing versions loader is unavailable.');
    var data=await options.fetchVersions(masterId,page);
    var newVersions=(data&&Array.isArray(data.versions)?data.versions:[])
      .map(Core.normalizeVersion)
      .filter(function(version){return version.id;});
    newVersions.forEach(function(version){
      if(!versions.some(function(existing){return String(existing.id)===String(version.id);}))versions.push(version);
    });
    pages=data&&data.pagination&&data.pagination.pages?data.pagination.pages:page;
  }

  async function loadAllPages(masterId){
    await loadPage(masterId,1);
    var totalPages=Math.min(pages,100);
    if(totalPages<=1)return;

    var nextPage=2;
    var loadedPages=1;
    var workerCount=Math.min(3,totalPages-1);

    async function loadNext(){
      while(nextPage<=totalPages){
        var page=nextPage++;
        await loadPage(masterId,page);
        loadedPages++;
        if(loading)loading.textContent='Finding vinyl pressings… '+loadedPages+' of '+totalPages;
      }
    }

    var workers=[];
    for(var i=0;i<workerCount;i++)workers.push(loadNext());
    await Promise.all(workers);
  }

  async function fetchRelease(releaseId){
    var key=String(releaseId);
    if(releaseCache.has(key))return releaseCache.get(key);
    if(typeof options.fetchRelease!=='function')throw new Error('Pressing release loader is unavailable.');
    var data=await options.fetchRelease(releaseId);
    data=data||{};
    releaseCache.set(key,data);
    return data;
  }

  async function searchByMatrix(){
    var query=Core.normalizedMatrix(matrixQuery&&matrixQuery.value);
    if(query.length<5){
      if(matches)matches.innerHTML='<div class="pressing-error">Enter at least five letters or numbers from one side of the matrix.</div>';
      return;
    }

    var candidates=currentMatches();
    if(!candidates.length){
      if(matches)matches.innerHTML='<div class="pressing-error">No pressings match the choices above.</div>';
      return;
    }

    if(matrixSearchButton){
      matrixSearchButton.disabled=true;
      matrixSearchButton.textContent='Checking 0 of '+candidates.length+'…';
    }
    if(matches)matches.innerHTML='<div class="pressing-loading">Comparing Discogs matrix data…</div>';

    var nextIndex=0;
    var completed=0;
    var found=[];

    async function checkNext(){
      while(nextIndex<candidates.length){
        var version=candidates[nextIndex++];
        try{
          var release=await fetchRelease(version.id);
          var match=Core.matrixValues(release).find(function(value){return Core.normalizedMatrix(value).indexOf(query)!==-1;});
          if(match)found.push(Object.assign({},version,{matrixMatch:match}));
        }catch(fetchError){
          if(typeof options.onWarning==='function')options.onWarning('Could not compare Discogs release '+version.id,fetchError);
        }
        completed++;
        if(matrixSearchButton)matrixSearchButton.textContent='Checking '+completed+' of '+candidates.length+'…';
      }
    }

    var workers=[];
    for(var i=0;i<Math.min(3,candidates.length);i++)workers.push(checkNext());
    await Promise.all(workers);

    matrixMatches=Core.dedupeMatrixMatches(found);
    if(matrixSearchButton){
      matrixSearchButton.disabled=false;
      matrixSearchButton.textContent='Find matrix';
    }
    renderMatches();
  }

  function readMatrixSelections(){
    var result={};
    ['A','B','C','D','E','F','G','H'].forEach(function(side){
      var select=matches&&matches.querySelector?matches.querySelector('#pressingMatrix'+side):null;
      result[side]=select&&select.value?select.value:null;
    });
    return result;
  }

  async function prepareConfirmation(releaseId){
    if(matches)matches.innerHTML='<div class="pressing-loading">Loading pressing details…</div>';
    try{
      var data=await fetchRelease(releaseId);
      var version=versions.find(function(item){return String(item.id)===String(releaseId);})||{};
      var selected=Core.selectReleaseDetails(releaseId,data,version);
      var matrices=Core.matrixChoices(data||{});
      var sideNames=Core.matrixSideNames(data||{});
      var hasMatrixChoices=sideNames.some(function(side){return matrices[side].length;});
      var matrixFields=sideNames.map(function(side){
        var upper=side.toUpperCase();
        return '<label class="pressing-field"><span>Matrix / Runout '+upper+'</span><select id="pressingMatrix'+upper+'">'+simpleOptions(matrices[side])+'</select></label>';
      }).join('');

      if(matches)matches.innerHTML='<div class="pressing-match selected">'+
        '<span class="pressing-match-title">Likely match</span>'+
        '<span class="pressing-match-meta">'+esc([selected.country,selected.year,selected.label,selected.catalogNumber].filter(Boolean).join(' · '))+'</span>'+
      '</div>'+
      '<section class="advanced-pressing pressing-advanced"><div class="advanced-pressing-title">Advanced pressing</div>'+
        (hasMatrixChoices?'<div class="matrix-list">'+matrixFields+'</div>':'<p class="pressing-help">Discogs has no matrix information for this pressing.</p>')+
      '</section>'+
      '<button id="savePressingButton" class="copy-action-button primary" type="button">Save this pressing</button>';

      var saveButton=matches&&matches.querySelector?matches.querySelector('#savePressingButton'):null;
      if(saveButton&&saveButton.addEventListener)saveButton.addEventListener('click',function(){
        if(typeof options.onSave==='function')options.onSave({
          selected:selected,
          matrices:readMatrixSelections(),
          button:this,
          albumIndex:albumIndex
        });
      });
      return selected;
    }catch(loadError){
      if(typeof options.onError==='function')options.onError('Could not load pressing details',loadError);
      if(matches)matches.innerHTML='<div class="pressing-error">Could not load this pressing. Choose another match or try again.</div>';
      return null;
    }
  }

  async function open(index){
    var record=getRecord(index);
    var masterId=getMasterId(record);
    if(!record||!masterId){
      if(typeof options.onMissingMaster==='function')options.onMissingMaster(index);
      return false;
    }

    albumIndex=index;
    versions=[];
    pages=1;
    matrixMatches=null;
    if(matrixQuery)matrixQuery.value='';
    if(matrixSearch)matrixSearch.hidden=true;
    if(modal)modal.style.display='flex';
    if(loading){loading.hidden=false;loading.textContent='Finding vinyl pressings…';}
    if(form)form.hidden=true;
    if(errorBox)errorBox.hidden=true;
    if(matches)matches.innerHTML='';
    if(typeof options.lockBody==='function')options.lockBody();

    try{
      await loadAllPages(masterId);
      View.setOptions(country,Core.uniqueVersionValues(versions,'country'),'Choose country','');
      View.setOptions(year,[],'Choose year','');
      View.setOptions(label,[],'Choose label','');
      View.setOptions(catalog,[],'Choose catalog number','');
      if(loading)loading.hidden=true;
      if(form)form.hidden=false;
      updateProgress();
      return true;
    }catch(loadError){
      if(typeof options.onError==='function')options.onError('Could not load Discogs pressings',loadError);
      if(loading)loading.hidden=true;
      if(errorBox){
        errorBox.hidden=false;
        errorBox.textContent='Could not load Discogs pressings. Please try again in a moment.';
      }
      return false;
    }
  }

  function close(){
    if(modal)modal.style.display='none';
    if(typeof options.unlockBody==='function')options.unlockBody();
  }

  function bind(){
    if(country&&country.addEventListener)country.addEventListener('change',function(){refreshFields('country');});
    if(year&&year.addEventListener)year.addEventListener('change',function(){refreshFields('year');});
    if(label&&label.addEventListener)label.addEventListener('change',function(){refreshFields('label');});
    if(catalog&&catalog.addEventListener)catalog.addEventListener('change',function(){refreshFields('catalog');});
    if(matrixSearchButton&&matrixSearchButton.addEventListener)matrixSearchButton.addEventListener('click',searchByMatrix);
    if(matrixQuery&&matrixQuery.addEventListener)matrixQuery.addEventListener('keydown',function(event){
      if(event.key==='Enter'){
        if(event.preventDefault)event.preventDefault();
        searchByMatrix();
      }
    });
    if(closeButton&&closeButton.addEventListener)closeButton.addEventListener('click',close);
    if(modal&&modal.addEventListener)modal.addEventListener('click',function(event){if(event.target===modal)close();});
  }

  bind();

  return Object.freeze({
    open:open,
    close:close,
    currentMatches:currentMatches,
    refreshFields:refreshFields,
    renderMatches:renderMatches,
    searchByMatrix:searchByMatrix,
    prepareConfirmation:prepareConfirmation,
    readMatrixSelections:readMatrixSelections,
    state:function(){return {albumIndex:albumIndex,versions:versions.slice(),pages:pages,matrixMatches:matrixMatches===null?null:matrixMatches.slice()};}
  });
}

return Object.freeze({
  simpleOptions:simpleOptions,
  matchMarkup:matchMarkup,
  create:create
});
});
