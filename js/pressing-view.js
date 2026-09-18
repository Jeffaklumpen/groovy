(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory();
  }else if(root){
    root.GroovyPressingView=factory();
  }
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function esc(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function hasPressingDetails(details){
  return !!(details&&(details.discogsReleaseId||details.country||details.year||details.label||
    details.catalogNumber||details.matrixA||details.matrixB||details.matrixC||details.matrixD||
    details.matrixE||details.matrixF||details.matrixG||details.matrixH));
}

function hasCopyDetails(details){
  return !!(details&&(details.mediaCondition||details.sleeveCondition||hasPressingDetails(details)));
}

function conditionOptions(selected,includeNoCover){
  var options=[
    ['', 'Not set'],
    ['M', 'Mint (M)'],
    ['NM', 'Near Mint (NM)'],
    ['VG+', 'Very Good Plus (VG+)'],
    ['VG', 'Very Good (VG)'],
    ['G+', 'Good Plus (G+)'],
    ['G', 'Good (G)'],
    ['F', 'Fair (F)'],
    ['P', 'Poor (P)']
  ];
  if(includeNoCover)options.push(['NO_COVER','No cover']);
  return options.map(function(option){
    return '<option value="'+esc(option[0])+'"'+(option[0]===selected?' selected':'')+'>'+esc(option[1])+'</option>';
  }).join('');
}

function conditionMeta(value){
  var conditions={
    'M':{className:'mint',label:'Mint'},
    'NM':{className:'near-mint',label:'Near Mint'},
    'VG+':{className:'very-good-plus',label:'Very Good Plus'},
    'VG':{className:'very-good',label:'Very Good'},
    'G+':{className:'good-plus',label:'Good Plus'},
    'G':{className:'good',label:'Good'},
    'F':{className:'fair',label:'Fair'},
    'P':{className:'poor',label:'Poor'}
  };
  return conditions[value]||null;
}

function copyDetailItem(label,value){
  if(!value)return '';
  return '<div class="copy-detail-item"><span class="copy-detail-label">'+esc(label)+'</span><span class="copy-detail-value">'+esc(value)+'</span></div>';
}

function copySummaryText(details){
  details=details||{};
  var values=[details.country,details.year];
  var summary=values.filter(Boolean).join(' · ');
  return summary||(details.mediaCondition?'':'Add details');
}

function conditionChipHtml(value){
  var condition=conditionMeta(value);
  return condition
    ?'<span class="copy-condition-chip condition-'+condition.className+'" title="Record condition: '+esc(condition.label)+'">'+esc(value)+'</span>'
    :'';
}

function setExpanded(elements,expanded){
  elements=elements||{};
  expanded=!!expanded;
  if(elements.root&&elements.root.classList)elements.root.classList.toggle('expanded',expanded);
  if(elements.toggle&&elements.toggle.setAttribute)elements.toggle.setAttribute('aria-expanded',expanded?'true':'false');
  if(elements.content){
    if(elements.content.setAttribute)elements.content.setAttribute('aria-hidden',expanded?'false':'true');
    elements.content.inert=!expanded;
  }
  return expanded;
}

function matrixMarkup(details){
  details=details||{};
  var hasMatrix=details.matrixA||details.matrixB||details.matrixC||details.matrixD||details.matrixE||details.matrixF||details.matrixG||details.matrixH;
  if(!hasMatrix)return '';
  var html='<section class="advanced-pressing"><div class="advanced-pressing-title">Advanced pressing</div><div class="matrix-list">';
  ['A','B','C','D','E','F','G','H'].forEach(function(side){
    var value=details['matrix'+side];
    if(value)html+='<div><span class="copy-detail-label">Matrix / Runout '+side+'</span><div class="matrix-value">'+esc(value)+'</div></div>';
  });
  return html+'</div></section>';
}

function renderCopyDetails(options){
  options=options||{};
  var elements=options.elements||{};
  var root=elements.root;
  var content=elements.content;
  var summaryElement=elements.summary;
  var saved=elements.saved;
  var details=options.details||{};
  var previousRecordKey=String(options.previousRecordKey||'');
  var recordKey=String(options.recordKey||'');
  var expanded=!!options.expanded;

  if(!options.hasRecord||options.isWishlist){
    if(root)root.hidden=true;
    if(content)content.innerHTML='';
    return {expanded:expanded,recordKey:previousRecordKey};
  }

  if(!options.isOwner&&!hasCopyDetails(details)){
    if(root)root.hidden=true;
    if(content)content.innerHTML='';
    return {expanded:expanded,recordKey:previousRecordKey};
  }

  if(root)root.hidden=false;
  if(saved)saved.textContent='';
  if(recordKey!==previousRecordKey)expanded=!hasCopyDetails(details);

  var compactText=copySummaryText(details);
  if(summaryElement)summaryElement.innerHTML=(compactText?'<span class="copy-summary-text">'+esc(compactText)+'</span>':'')+conditionChipHtml(details.mediaCondition);

  var chips='';
  if(details.mediaCondition)chips+=conditionChipHtml(details.mediaCondition);
  if(details.sleeveCondition)chips+='<span class="copy-summary-chip">Sleeve '+esc(details.sleeveCondition)+'</span>';

  var info=copyDetailItem('Country',details.country)+
    copyDetailItem('Release year',details.year)+
    copyDetailItem('Record label',details.label)+
    copyDetailItem('Catalog number',details.catalogNumber);
  var matrix=matrixMarkup(details);
  var hasPressing=hasPressingDetails(details);
  var summary=chips
    ?'<div class="copy-summary">'+chips+'</div>'
    :(!info&&!matrix?'<p class="copy-summary-empty">Add details about the physical record you own.</p>':'');

  if(content){
    if(options.isOwner){
      content.innerHTML=summary+
        (info?'<div class="copy-details-readonly">'+info+'</div>':'')+
        matrix+
        '<div class="copy-details-actions">'+
          '<button id="editConditionButton" class="copy-action-button" type="button">'+(details.mediaCondition||details.sleeveCondition?'Edit condition':'Add condition')+'</button>'+
          '<button id="identifyPressingButton" class="copy-action-button primary" type="button">'+(details.discogsReleaseId?'Change pressing':'Identify pressing')+'</button>'+
          (hasPressing?'<button id="clearPressingButton" class="copy-action-button danger copy-action-button-clear" type="button">Clear pressing</button>':'')+
        '</div>'+
        '<div id="conditionEditor" class="condition-editor" hidden>'+
          '<label class="condition-field"><span>Record condition</span><select id="mediaConditionSelect">'+conditionOptions(details.mediaCondition||'',false)+'</select></label>'+
          '<label class="condition-field"><span>Sleeve condition</span><select id="sleeveConditionSelect">'+conditionOptions(details.sleeveCondition||'',true)+'</select></label>'+
        '</div>'+
        (details.discogsReleaseId?'<p class="copy-credit">Pressing data from <a href="https://www.discogs.com/release/'+encodeURIComponent(details.discogsReleaseId)+'" target="_blank" rel="noopener noreferrer">Discogs</a></p>':'');

      var editButton=content.querySelector?content.querySelector('#editConditionButton'):null;
      var identifyButton=content.querySelector?content.querySelector('#identifyPressingButton'):null;
      var clearButton=content.querySelector?content.querySelector('#clearPressingButton'):null;
      var editor=content.querySelector?content.querySelector('#conditionEditor'):null;
      var mediaSelect=content.querySelector?content.querySelector('#mediaConditionSelect'):null;
      var sleeveSelect=content.querySelector?content.querySelector('#sleeveConditionSelect'):null;
      if(editButton&&editButton.addEventListener)editButton.addEventListener('click',function(){if(editor)editor.hidden=!editor.hidden;});
      if(identifyButton&&identifyButton.addEventListener)identifyButton.addEventListener('click',function(){if(typeof options.onIdentifyPressing==='function')options.onIdentifyPressing();});
      if(clearButton&&clearButton.addEventListener)clearButton.addEventListener('click',function(){if(typeof options.onClearPressing==='function')options.onClearPressing();});
      [mediaSelect,sleeveSelect].forEach(function(select){
        if(select&&select.addEventListener)select.addEventListener('change',function(){if(typeof options.onConditionChange==='function')options.onConditionChange();});
      });
    }else{
      content.innerHTML=(chips?'<div class="copy-summary">'+chips+'</div>':'')+
        (info?'<div class="copy-details-readonly">'+info+'</div>':'')+matrix+
        (details.discogsReleaseId?'<p class="copy-credit">Pressing data from <a href="https://www.discogs.com/release/'+encodeURIComponent(details.discogsReleaseId)+'" target="_blank" rel="noopener noreferrer">Discogs</a></p>':'');
    }
  }

  setExpanded(elements,expanded);
  return {expanded:expanded,recordKey:recordKey};
}

function setOptions(select,values,placeholder,current){
  if(!select)return;
  values=Array.isArray(values)?values:[];
  select.innerHTML='<option value="">'+esc(placeholder)+'</option>'+values.map(function(value){
    return '<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(value)+'</option>';
  }).join('');
  select.disabled=!values.length;
}

function updateProgress(form,values){
  if(!form||!form.querySelectorAll)return 0;
  var completed=(values||[]).filter(Boolean).length;
  var bars=form.querySelectorAll('.pressing-progress span');
  for(var i=0;i<bars.length;i++)bars[i].classList.toggle('active',i<=completed);
  return completed;
}

return Object.freeze({
  hasPressingDetails:hasPressingDetails,
  hasCopyDetails:hasCopyDetails,
  conditionOptions:conditionOptions,
  conditionMeta:conditionMeta,
  copyDetailItem:copyDetailItem,
  copySummaryText:copySummaryText,
  conditionChipHtml:conditionChipHtml,
  setExpanded:setExpanded,
  renderCopyDetails:renderCopyDetails,
  setOptions:setOptions,
  updateProgress:updateProgress
});
});
