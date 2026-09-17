(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./marketplace-core.js'));
  }else if(root){
    root.GroovyMarketplaceView=factory(root.GroovyMarketplaceCore||null);
  }
})(typeof window!=='undefined'?window:null,function(MarketplaceCore){
'use strict';

function core(){
  if(!MarketplaceCore)throw new Error('GroovyMarketplaceCore is required for marketplace view helpers');
  return MarketplaceCore;
}

function esc(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function buttonState(marketplace,state,count){
  var name=String(marketplace||'Marketplace');
  var total=Number(count||0);
  if(state==='loading')return {className:'loading',label:name+' · Checking…'};
  if(state==='ready')return {className:'',label:name+' · '+total+' '+(total===1?'listing':'listings')};
  if(state==='empty')return {className:'empty',label:name+' · No listings'};
  return {className:'unavailable',label:name+' · Unavailable'};
}

function applyButtonState(button,label,marketplace,state,count){
  if(!button||!label)return;
  var view=buttonState(marketplace,state,count);
  button.classList.remove('loading','empty','unavailable');
  button.disabled=false;
  if(view.className)button.classList.add(view.className);
  label.textContent=view.label;
}

function listingCardHtml(listing,marketplace,locale){
  var api=core();
  listing=listing||{};
  var href=api.safeExternalUrl(listing.url);
  var imageUrl=api.safeExternalUrl(listing.imageUrl);
  var price=api.listingPrice(listing,locale||'sv-SE');
  var ends=api.listingEndsText(listing.endDate,locale||'sv-SE');
  var bids=Number(listing.bidCount||0);
  var name=String(marketplace||'Marketplace');

  return '<article class="tradera-listing-card">'+
    '<a class="tradera-listing-image" href="'+esc(href||'#')+'" target="_blank" rel="noopener noreferrer" aria-label="View listing on '+esc(name)+'">'+
      (imageUrl?'<img src="'+esc(imageUrl)+'" alt="" loading="lazy">':'<span class="record-icon" aria-hidden="true"></span>')+
    '</a>'+
    '<div class="tradera-listing-body">'+
      '<h3>'+esc(listing.title||'Vinyl record')+'</h3>'+
      '<div class="tradera-listing-price-row">'+
        '<strong>'+esc(price||'See price')+'</strong>'+
        (bids?'<span>'+bids+' '+(bids===1?'bid':'bids')+'</span>':'')+
      '</div>'+
      (ends?'<div class="tradera-listing-end">'+esc(ends)+'</div>':'')+
      (href?'<a class="tradera-listing-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">View on '+esc(name)+' <span aria-hidden="true">↗</span></a>':'')+
    '</div>'+
  '</article>';
}

function renderListings(grid,listings,marketplace,locale){
  if(!grid)return;
  grid.innerHTML=(listings||[]).map(function(listing){
    return listingCardHtml(listing,marketplace,locale);
  }).join('');
}

function listingStatus(listings,state,marketplace,emptyText){
  var rows=listings||[];
  var name=String(marketplace||'Marketplace');
  if(state==='loading')return {className:'tradera-listings-status loading',text:'Finding active listings…'};
  if(rows.length)return {className:'tradera-listings-status',text:rows.length+' active '+(rows.length===1?'listing':'listings')};
  if(state==='unavailable')return {className:'tradera-listings-status error',text:name+' is temporarily unavailable. Please try again shortly.'};
  return {className:'tradera-listings-status empty',text:emptyText||'No active listings found for this album right now.'};
}

function openListingsModal(options){
  options=options||{};
  if(!options.modal)return;
  if(options.subtitle)options.subtitle.textContent=String(options.artist||'')+' · '+String(options.album||'');
  renderListings(options.grid,options.listings,options.marketplace,options.locale);

  var state='idle';
  if(options.button&&options.button.classList){
    if(options.button.classList.contains('loading'))state='loading';
    else if(options.button.classList.contains('unavailable'))state='unavailable';
  }
  var statusView=listingStatus(options.listings,state,options.marketplace,options.emptyText);
  if(options.status){
    options.status.className=statusView.className;
    options.status.textContent=statusView.text;
  }

  options.modal.classList.add('visible');
  options.modal.setAttribute('aria-hidden','false');
  if(options.closeButton&&typeof options.closeButton.focus==='function')options.closeButton.focus();
}

function closeListingsModal(modal){
  if(!modal)return;
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden','true');
}

return Object.freeze({
  buttonState:buttonState,
  applyButtonState:applyButtonState,
  listingCardHtml:listingCardHtml,
  renderListings:renderListings,
  listingStatus:listingStatus,
  openListingsModal:openListingsModal,
  closeListingsModal:closeListingsModal
});
});
