(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./shelf-core.js'));
  }else if(root){
    root.GroovyShelfView=factory(root.GroovyShelfCore);
  }
})(typeof window!=='undefined'?window:null,function(Core){
'use strict';

function esc(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function iconChoicesMarkup(){
  return Core.ICON_OPTIONS.map(function(item,index){
    return '<button type="button" class="shelf-icon-choice '+(index===0?'selected':'')+'" role="radio" aria-checked="'+(index===0?'true':'false')+'" data-icon="'+esc(item.id)+'" aria-label="'+esc(item.label)+'" title="'+esc(item.label)+'">'+Core.iconSvg(item.id)+'</button>';
  }).join('');
}

function renderIconChoices(container){
  if(!container)return;
  container.innerHTML=iconChoicesMarkup();
}

function applyIconChoice(container,icon){
  var selected=Core.normalizeIcon(icon);
  if(container&&container.querySelectorAll){
    container.querySelectorAll('.shelf-icon-choice').forEach(function(button){
      var isSelected=button.getAttribute('data-icon')===selected;
      button.classList.toggle('selected',isSelected);
      button.setAttribute('aria-checked',isSelected?'true':'false');
    });
  }
  return selected;
}

function applyColorChoice(container,modal,color,colors){
  var selected=Core.normalizeColor(color,colors);
  if(modal&&modal.style&&modal.style.setProperty)modal.style.setProperty('--shelf-choice-color',selected);
  if(container&&container.querySelectorAll){
    container.querySelectorAll('.shelf-color-choice').forEach(function(button){
      var isSelected=Core.normalizeColor(button.getAttribute('data-color'),colors)===selected;
      button.classList.toggle('selected',isSelected);
      button.setAttribute('aria-checked',isSelected?'true':'false');
    });
  }
  return selected;
}

function stripMarkup(options){
  options=options||{};
  var shelves=Array.isArray(options.shelves)?options.shelves:[];
  var records=Array.isArray(options.records)?options.records:[];
  var activeShelfId=options.activeShelfId==null?'all':options.activeShelfId;
  var maxShelves=Number(options.maxShelves)||10;
  var colors=options.colors;
  var getShelfId=options.getShelfId;
  var html='<button class="shelf-chip '+(activeShelfId==='all'?'active':'')+'" type="button" data-shelf-id="all">'+
    '<span class="shelf-chip-icon" aria-hidden="true">'+Core.iconSvg('record')+'</span><span class="shelf-chip-copy"><strong>All Records</strong><small>'+Core.recordCount(records,'all',getShelfId)+' records</small></span></button>';

  shelves.forEach(function(shelf){
    html+='<button class="shelf-chip shelf-chip-custom '+(String(activeShelfId)===String(shelf.id)?'active':'')+'" type="button" data-shelf-id="'+esc(shelf.id)+'" style="'+Core.colorStyle(shelf,colors)+'">'+
      '<span class="shelf-chip-icon" aria-hidden="true">'+Core.iconSvg(shelf.icon)+'</span><span class="shelf-chip-copy"><strong>'+esc(shelf.name)+'</strong><small>'+Core.recordCount(records,shelf.id,getShelfId)+' records</small></span></button>';
  });

  if(options.showCreate){
    if(shelves.length<maxShelves){
      html+='<button class="shelf-chip shelf-new-button" type="button"><span class="shelf-chip-icon" aria-hidden="true">+</span><span class="shelf-chip-copy"><strong>New Shelf</strong><small>'+shelves.length+' of '+maxShelves+'</small></span></button>';
    }else{
      html+='<button class="shelf-chip shelf-new-button shelf-limit-button" type="button" disabled><span class="shelf-chip-icon" aria-hidden="true">✓</span><span class="shelf-chip-copy"><strong>Shelf limit</strong><small>'+maxShelves+' of '+maxShelves+'</small></span></button>';
    }
  }

  return html;
}

function pickerMarkup(options){
  options=options||{};
  var shelves=Array.isArray(options.shelves)?options.shelves:[];
  var currentShelf=String(options.currentShelfId||'');
  var colors=options.colors;
  if(!shelves.length)return '<div class="shelf-picker-empty">No shelves yet. Create your first shelf below.</div>';

  return shelves.map(function(shelf){
    var id=String(shelf.id||'');
    var selected=id===currentShelf;
    return '<label class="shelf-picker-option shelf-colored '+(selected?'selected':'')+'" style="'+Core.colorStyle(shelf,colors)+'">'+
      '<input type="radio" name="recordShelf" value="'+esc(id)+'" '+(selected?'checked':'')+'>'+ 
      '<span class="shelf-picker-icon" aria-hidden="true">'+Core.iconSvg(shelf.icon)+'</span>'+ 
      '<span class="shelf-picker-name">'+esc(shelf.name)+'</span>'+ 
      '<span class="shelf-choice-check" aria-hidden="true">✓</span>'+ 
    '</label>';
  }).join('');
}

function syncPickerSelection(container){
  if(!container||!container.querySelectorAll)return;
  container.querySelectorAll('.shelf-picker-option').forEach(function(option){
    var radio=option.querySelector('input');
    option.classList.toggle('selected',!!(radio&&radio.checked));
  });
}

function detailStatusState(record,shelf,isWishlist){
  if(!record||isWishlist){
    return {hidden:true,unshelved:false,html:''};
  }
  var shelfName=shelf&&shelf.name?shelf.name:'no shelf';
  var shelfIcon=shelf?Core.iconSvg(shelf.icon):'';
  return {
    hidden:false,
    unshelved:!shelf,
    html:(shelfIcon?'<span class="detail-shelf-status-icon" aria-hidden="true">'+shelfIcon+'</span>':'')+
      '<strong title="'+esc(shelfName)+'">'+esc(shelfName)+'</strong>'
  };
}

function renderDetailStatus(element,options){
  if(!element)return;
  options=options||{};
  var state=detailStatusState(options.record,options.shelf,options.isWishlist);
  element.hidden=state.hidden;
  element.innerHTML=state.html;
  if(element.classList)element.classList.toggle('unshelved',state.unshelved);
  return state;
}

function detailActionsMarkup(hasShelf){
  return '<button class="detail-shelf-button primary" type="button" data-detail-shelf-action="pick">'+
      (hasShelf?'Move to Shelf':'Add to Shelf')+
    '</button>'+
    (hasShelf
      ?'<button class="detail-shelf-button secondary" type="button" data-detail-shelf-action="remove">Remove from Shelf</button>'
      :'');
}

return Object.freeze({
  iconChoicesMarkup:iconChoicesMarkup,
  renderIconChoices:renderIconChoices,
  applyIconChoice:applyIconChoice,
  applyColorChoice:applyColorChoice,
  stripMarkup:stripMarkup,
  pickerMarkup:pickerMarkup,
  syncPickerSelection:syncPickerSelection,
  detailStatusState:detailStatusState,
  renderDetailStatus:renderDetailStatus,
  detailActionsMarkup:detailActionsMarkup
});
});
