(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./pressing-view.js'),require('./pressing-picker.js'));
  }else if(root){
    root.GroovyPressingController=factory(root.GroovyPressingView,root.GroovyPressingPicker);
  }
})(typeof window!=='undefined'?window:null,function(View,Picker){
'use strict';

function create(options){
  options=options||{};
  var api=options.api;
  var recordModel=options.recordModel;
  var doc=options.document;
  var elements=options.elements||{};
  var getRecords=typeof options.getRecords==='function'?options.getRecords:function(){return [];};
  var getViewedUserId=typeof options.getViewedUserId==='function'?options.getViewedUserId:function(){return null;};
  var getViewedUsername=typeof options.getViewedUsername==='function'?options.getViewedUsername:function(){return '';};
  var getLibraryView=typeof options.getLibraryView==='function'?options.getLibraryView:function(){return 'collection';};
  var renderGrid=typeof options.renderGrid==='function'?options.renderGrid:function(){};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};

  var rootElement=elements.root||null;
  var content=elements.content||null;
  var toggle=elements.toggle||null;
  var summary=elements.summary||null;
  var saved=elements.saved||null;
  var albumOverlay=elements.albumOverlay||null;
  var clearPressingModal=elements.clearPressingModal||null;
  var clearPressingMessage=elements.clearPressingMessage||null;
  var cancelClearPressing=elements.cancelClearPressing||null;
  var confirmClearPressing=elements.confirmClearPressing||null;

  var expanded=false;
  var recordKey='';
  var picker=null;
  var pendingClearIndex=null;

  if(!api||typeof api.from!=='function')throw new Error('Pressing controller requires Supabase');
  if(!recordModel)throw new Error('Pressing controller requires record model');
  if(!View)throw new Error('Pressing controller requires pressing view');

  function log(level,message,error){onLog(level,message,error);}

  function recordAt(index){
    return getRecords()[index]||null;
  }

  function detailsFor(record){
    return recordModel.ensurePressing(record);
  }

  function setExpanded(next){
    expanded=!!next;
    View.setExpanded({root:rootElement,toggle:toggle,content:content},expanded);
  }

  function resetRecord(){
    recordKey='';
  }

  function closeDetails(){
    setExpanded(false);
    recordKey='';
  }

  function render(index){
    var record=recordAt(index);
    var isOwner=getViewedUserId()===null;
    if(elements.title){
      var username=String(getViewedUsername()||'').trim();
      elements.title.textContent=isOwner?'My Pressing':((username||'Collector')+"'s Pressing");
    }
    var result=View.renderCopyDetails({
      hasRecord:!!record,
      isWishlist:getLibraryView()==='wishlist',
      isOwner:isOwner,
      details:record?detailsFor(record):{},
      recordKey:record?String(recordModel.entryId(record)||('record-'+index)):'',
      previousRecordKey:recordKey,
      expanded:expanded,
      elements:{
        root:rootElement,
        content:content,
        toggle:toggle,
        summary:summary,
        saved:saved
      },
      onIdentifyPressing:function(){openPicker(index);},
      onClearPressing:function(){requestClearPressing(index);},
      onConditionChange:function(){saveCondition(index);}
    });
    expanded=result.expanded;
    recordKey=result.recordKey;
    return result;
  }

  async function saveCondition(index){
    var record=recordAt(index);
    if(!record||getViewedUserId()!==null)return false;

    var mediaSelect=content&&content.querySelector?content.querySelector('#mediaConditionSelect'):null;
    var sleeveSelect=content&&content.querySelector?content.querySelector('#sleeveConditionSelect'):null;
    if(!mediaSelect||!sleeveSelect)return false;

    var media=mediaSelect.value||null;
    var sleeve=sleeveSelect.value||null;
    mediaSelect.disabled=true;
    sleeveSelect.disabled=true;
    if(saved)saved.textContent='Saving…';

    var userResult=await api.auth.getUser();
    var user=userResult&&userResult.data&&userResult.data.user;
    var result=(userResult.error||!user)
      ?{error:userResult.error||new Error('Du måste vara inloggad.')}
      :await api.from('collections')
        .update({media_condition:media,sleeve_condition:sleeve})
        .eq('id',recordModel.entryId(record))
        .eq('user_id',user.id)
        .select('id');

    if(result.error||!result.data||!result.data.length){
      log('error','Kunde inte spara skicket:',result.error);
      if(saved)saved.textContent='Could not save';
      mediaSelect.disabled=false;
      sleeveSelect.disabled=false;
      return false;
    }

    var details=detailsFor(record);
    details.mediaCondition=media||'';
    details.sleeveCondition=sleeve||'';
    renderGrid();
    render(index);
    if(saved)saved.textContent='Saved';
    return true;
  }

  function closeClearPressingConfirm(){
    if(clearPressingModal)clearPressingModal.style.display='none';
    pendingClearIndex=null;
    if(confirmClearPressing){
      confirmClearPressing.disabled=false;
      confirmClearPressing.textContent='Clear pressing';
    }
  }

  function requestClearPressing(index){
    var record=recordAt(index);
    if(!record||getViewedUserId()!==null)return false;

    var details=detailsFor(record);
    if(!View.hasPressingDetails(details))return false;

    pendingClearIndex=index;
    if(clearPressingMessage){
      var title=typeof recordModel.title==='function'?String(recordModel.title(record)||'').trim():'';
      clearPressingMessage.textContent=title
        ?'Clear the saved pressing details for "'+title+'"? Record and sleeve condition will be kept.'
        :'Clear the saved pressing details for this record? Record and sleeve condition will be kept.';
    }
    if(clearPressingModal)clearPressingModal.style.display='flex';
    return true;
  }

  async function clearPressing(index){
    var record=recordAt(index);
    if(!record||getViewedUserId()!==null)return false;

    var details=detailsFor(record);
    if(!View.hasPressingDetails(details))return false;

    if(saved)saved.textContent='Clearing…';

    var userResult=await api.auth.getUser();
    var user=userResult&&userResult.data&&userResult.data.user;
    var payload={
      discogs_release_id:null,
      pressing_country:null,
      pressing_year:null,
      pressing_label:null,
      catalog_number:null,
      matrix_runout_a:null,
      matrix_runout_b:null,
      matrix_runout_c:null,
      matrix_runout_d:null,
      matrix_runout_e:null,
      matrix_runout_f:null,
      matrix_runout_g:null,
      matrix_runout_h:null,
      pressing_match_status:null
    };
    var result=(userResult.error||!user)
      ?{error:userResult.error||new Error('Du måste vara inloggad.')}
      :await api.from('collections')
        .update(payload)
        .eq('id',recordModel.entryId(record))
        .eq('user_id',user.id)
        .select('id');

    if(result.error||!result.data||!result.data.length){
      log('error','Kunde inte rensa pressningen:',result.error);
      if(saved)saved.textContent='Could not clear pressing';
      return false;
    }

    details.discogsReleaseId=null;
    details.country='';
    details.year='';
    details.label='';
    details.catalogNumber='';
    details.matrixA='';
    details.matrixB='';
    details.matrixC='';
    details.matrixD='';
    details.matrixE='';
    details.matrixF='';
    details.matrixG='';
    details.matrixH='';
    details.matchStatus='';

    renderGrid();
    render(index);
    if(saved)saved.textContent='Pressing cleared';
    return true;
  }

  async function fetchVersions(masterId,page){
    var response=await api.functions.invoke('discogs-search',{
      body:{action:'versions',masterId:masterId,page:page}
    });
    if(response.error)throw response.error;
    return response.data||{};
  }

  async function fetchRelease(releaseId){
    var response=await api.functions.invoke('discogs-search',{
      body:{action:'release',releaseId:releaseId}
    });
    if(response.error)throw response.error;
    return response.data||{};
  }

  async function saveSelection(context){
    context=context||{};
    var selected=context.selected||{};
    var matrices=context.matrices||{};
    var button=context.button;
    var index=context.albumIndex;
    var record=recordAt(index);
    if(!record)return false;

    if(button){button.disabled=true;button.textContent='Saving…';}

    var userResult=await api.auth.getUser();
    var user=userResult&&userResult.data&&userResult.data.user;
    var payload={
      discogs_release_id:parseInt(selected.id,10),
      pressing_country:selected.country||null,
      pressing_year:parseInt(selected.year,10)||null,
      pressing_label:selected.label||null,
      catalog_number:selected.catalogNumber||null,
      matrix_runout_a:matrices.A||null,
      matrix_runout_b:matrices.B||null,
      matrix_runout_c:matrices.C||null,
      matrix_runout_d:matrices.D||null,
      matrix_runout_e:matrices.E||null,
      matrix_runout_f:matrices.F||null,
      matrix_runout_g:matrices.G||null,
      matrix_runout_h:matrices.H||null,
      pressing_match_status:'discogs'
    };
    var result=(userResult.error||!user)
      ?{error:userResult.error||new Error('Du måste vara inloggad.')}
      :await api.from('collections').update(payload)
        .eq('id',recordModel.entryId(record))
        .eq('user_id',user.id)
        .select('id');

    if(result.error||!result.data||!result.data.length){
      log('error','Kunde inte spara pressningen:',result.error);
      if(button){button.disabled=false;button.textContent='Try saving again';}
      return false;
    }

    var details=detailsFor(record);
    details.discogsReleaseId=payload.discogs_release_id;
    details.country=payload.pressing_country||'';
    details.year=payload.pressing_year||'';
    details.label=payload.pressing_label||'';
    details.catalogNumber=payload.catalog_number||'';
    details.matrixA=payload.matrix_runout_a||'';
    details.matrixB=payload.matrix_runout_b||'';
    details.matrixC=payload.matrix_runout_c||'';
    details.matrixD=payload.matrix_runout_d||'';
    details.matrixE=payload.matrix_runout_e||'';
    details.matrixF=payload.matrix_runout_f||'';
    details.matrixG=payload.matrix_runout_g||'';
    details.matrixH=payload.matrix_runout_h||'';
    details.matchStatus='discogs';

    if(picker)picker.close();
    renderGrid();
    render(index);
    if(saved)saved.textContent='Saved';
    return true;
  }

  picker=Picker?Picker.create({
    elements:{
      modal:elements.pressingModal,
      closeButton:elements.closePressingModalButton,
      loading:elements.pressingLoading,
      form:elements.pressingForm,
      error:elements.pressingError,
      country:elements.pressingCountry,
      year:elements.pressingYear,
      label:elements.pressingLabel,
      catalogNumber:elements.pressingCatalogNumber,
      matrixSearch:elements.pressingMatrixSearch,
      matrixQuery:elements.pressingMatrixQuery,
      matrixSearchButton:elements.pressingMatrixSearchButton,
      matches:elements.pressingMatches
    },
    getRecord:recordAt,
    recordModel:recordModel,
    getMasterId:function(record){return record&&recordModel.discogsMasterId(record);},
    fetchVersions:fetchVersions,
    fetchRelease:fetchRelease,
    onSave:saveSelection,
    onMissingMaster:function(){if(saved)saved.textContent='No Discogs master found';},
    onWarning:function(message,error){log('warn',message+':',error);},
    onError:function(message,error){log('error',message+':',error);},
    lockBody:function(){if(doc&&doc.body)doc.body.style.overflow='hidden';},
    unlockBody:function(){
      if(doc&&doc.body&&(!albumOverlay||String(albumOverlay.className||'').indexOf('visible')===-1)){
        doc.body.style.overflow='';
      }
    }
  }):null;

  function openPicker(index){
    if(!picker){
      if(saved)saved.textContent='Pressing picker unavailable';
      return false;
    }
    return picker.open(index);
  }

  function closePicker(){
    if(picker)picker.close();
  }

  if(toggle&&toggle.addEventListener){
    toggle.addEventListener('click',function(){setExpanded(!expanded);});
  }

  if(cancelClearPressing&&cancelClearPressing.addEventListener){
    cancelClearPressing.addEventListener('click',closeClearPressingConfirm);
  }

  if(clearPressingModal&&clearPressingModal.addEventListener){
    clearPressingModal.addEventListener('click',function(event){
      if(event.target===clearPressingModal)closeClearPressingConfirm();
    });
  }

  if(confirmClearPressing&&confirmClearPressing.addEventListener){
    confirmClearPressing.addEventListener('click',async function(){
      if(pendingClearIndex===null)return;
      var index=pendingClearIndex;
      confirmClearPressing.disabled=true;
      confirmClearPressing.textContent='Clearing…';
      var cleared=await clearPressing(index);
      if(cleared)closeClearPressingConfirm();
      else{
        confirmClearPressing.disabled=false;
        confirmClearPressing.textContent='Clear pressing';
      }
    });
  }

  return Object.freeze({
    render:render,
    resetRecord:resetRecord,
    closeDetails:closeDetails,
    saveCondition:saveCondition,
    requestClearPressing:requestClearPressing,
    closeClearPressingConfirm:closeClearPressingConfirm,
    clearPressing:clearPressing,
    saveSelection:saveSelection,
    openPicker:openPicker,
    closePicker:closePicker,
    fetchVersions:fetchVersions,
    fetchRelease:fetchRelease,
    state:function(){return {expanded:expanded,recordKey:recordKey};}
  });
}

return Object.freeze({create:create});
});
