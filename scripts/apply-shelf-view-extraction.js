const fs=require('node:fs');

function replaceOne(source,search,replacement,label){
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(label+' expected exactly once, found '+count);
  return source.replace(search,replacement);
}

function replaceBetween(source,startMarker,endMarker,replacement,label){
  const start=source.indexOf(startMarker);
  if(start<0)throw new Error(label+' start marker missing');
  const end=source.indexOf(endMarker,start+startMarker.length);
  if(end<0)throw new Error(label+' end marker missing');
  return source.slice(0,start)+replacement+source.slice(end);
}

let app=fs.readFileSync('js/app.js','utf8');
let html=fs.readFileSync('index.html','utf8');

app=replaceOne(app,'var ShelfCore=window.GroovyShelfCore;\nvar LibraryCore=window.GroovyLibraryCore;','var ShelfCore=window.GroovyShelfCore;\nvar ShelfView=window.GroovyShelfView;\nvar LibraryCore=window.GroovyLibraryCore;','ShelfView bootstrap declaration');
app=replaceOne(app,"if(!ShelfCore)throw new Error('GroovyShelfCore must load before app.js');\nif(!LibraryCore)throw new Error('GroovyLibraryCore must load before app.js');","if(!ShelfCore)throw new Error('GroovyShelfCore must load before app.js');\nif(!ShelfView)throw new Error('GroovyShelfView must load before app.js');\nif(!LibraryCore)throw new Error('GroovyLibraryCore must load before app.js');",'ShelfView bootstrap guard');
app=replaceOne(app,"var SHELF_ICON_OPTIONS=ShelfCore.ICON_OPTIONS;\nvar SHELF_ICON_ALIASES=ShelfCore.ICON_ALIASES;\nvar SHELF_ICON_PATHS=ShelfCore.ICON_PATHS;\n\n",'', 'legacy shelf icon aliases');
app=replaceBetween(app,'function renderShelfIconChoices(){','\n\nrenderShelfIconChoices();',"function renderShelfIconChoices(){\n  ShelfView.renderIconChoices(shelfIconChoices);\n}",'renderShelfIconChoices');
app=replaceBetween(app,"  var html='<button class=\"shelf-chip '",'  var previousShelfScrollLeft=shelfStripScroll.scrollLeft;',"  var html=ShelfView.stripMarkup({\n    shelves:shelves,\n    records:records,\n    activeShelfId:activeShelfId,\n    maxShelves:MAX_SHELVES,\n    showCreate:viewedUserId===null,\n    colors:SHELF_COLORS\n  });\n\n",'shelf strip markup');
app=replaceBetween(app,'function setShelfIconChoice(icon){','\n\nfunction resetShelfIconChoice()',"function setShelfIconChoice(icon){\n  selectedShelfIcon=ShelfView.applyIconChoice(shelfIconChoices,icon);\n}",'setShelfIconChoice');
app=replaceBetween(app,'function setShelfColorChoice(color){','\n\nfunction resetShelfColorChoice()',"function setShelfColorChoice(color){\n  selectedShelfColor=ShelfView.applyColorChoice(shelfColorChoices,createShelfModal,color,SHELF_COLORS);\n}",'setShelfColorChoice');
app=replaceBetween(app,'  var options=shelves.slice();\n  shelfPickerList.innerHTML=options.map(function(shelf){','  createShelfFromPickerButton.disabled=shelves.length>=MAX_SHELVES;',"  shelfPickerList.innerHTML=ShelfView.pickerMarkup({\n    shelves:shelves,\n    currentShelfId:currentShelf,\n    colors:SHELF_COLORS\n  });\n\n  shelfPickerList.querySelectorAll('input[name=\"recordShelf\"]').forEach(function(input){\n    input.addEventListener('change',function(){ShelfView.syncPickerSelection(shelfPickerList);});\n  });\n\n",'shelf picker markup');
app=replaceBetween(app,'function renderDetailShelfStatus(index){','\n\nfunction renderDetailShelfActions(index){',"function renderDetailShelfStatus(index){\n  if(!detailShelfStatus)return;\n  var record=records[index];\n  var shelf=record?shelfById(record[13]):null;\n  ShelfView.renderDetailStatus(detailShelfStatus,{\n    record:record,\n    shelf:shelf,\n    isWishlist:window.libraryView==='wishlist'\n  });\n}",'detail shelf status rendering');
app=replaceBetween(app,'  var hasShelf=!!record[13];\n  detailShelfActions.hidden=false;',"  var pickButton=detailShelfActions.querySelector('[data-detail-shelf-action=\"pick\"]');","  var hasShelf=!!record[13];\n  detailShelfActions.hidden=false;\n  detailShelfActions.innerHTML=ShelfView.detailActionsMarkup(hasShelf);\n\n",'detail shelf actions markup');
html=replaceOne(html,'<script src="/js/shelf-core.js?v=2"></script>\n<script src="/js/library-core.js?v=1"></script>','<script src="/js/shelf-core.js?v=2"></script>\n<script src="/js/shelf-view.js?v=1"></script>\n<script src="/js/library-core.js?v=1"></script>','shelf-view script tag');
html=replaceOne(html,'<script src="/js/app.js?v=144"></script>','<script src="/js/app.js?v=145"></script>','app cache version');
fs.writeFileSync('js/app.js',app);
fs.writeFileSync('index.html',html);
console.log('Shelf view extraction applied.');
