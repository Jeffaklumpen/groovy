const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/selection-controller.js');

function classList(){
  const values=new Set();
  return {
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    contains(name){return values.has(name);}
  };
}
function button(){
  const listeners={};
  return {
    hidden:false,disabled:false,textContent:'',attrs:{},classList:classList(),
    addEventListener(type,fn){listeners[type]=fn;},
    click(){if(listeners.click)listeners.click({preventDefault(){},stopPropagation(){}});},
    setAttribute(name,value){this.attrs[name]=value;},
    getAttribute(name){return this.attrs[name]||'';}
  };
}
function card(id,title){
  const toggle=button();
  toggle.attrs['data-record-title']=title;
  return {
    classList:classList(),
    getAttribute(name){return name==='data-entry-id'?id:'';},
    querySelector(selector){return selector==='[data-record-select]'?toggle:null;},
    toggle
  };
}

test('selection mode tracks stable collection entry ids and drives actions',()=>{
  const records=[{id:'10'},{id:'20'}];
  const cards=[card('10','One'),card('20','Two')];
  const elements={
    body:{classList:classList()},
    collection:{querySelectorAll(){return cards;}},
    selectButton:button(),actionBar:{hidden:true},count:{textContent:''},
    moveButton:button(),removeShelfButton:button(),addCollectionButton:button(),deleteButton:button(),cancelButton:button()
  };
  const moved=[];const unshelved=[];const added=[];const deleted=[];let renders=0;
  const controller=Controller.create({
    elements,
    recordModel:{entryId:record=>record.id},
    getRecords:()=>records,
    getContext:()=>({libraryView:'collection',activeShelfId:'shelf-1'}),
    canActivate:()=>true,
    onModeChange:()=>renders++,
    onMove:ids=>{moved.push(ids);return true;},
    onRemoveShelf:ids=>{unshelved.push(ids);return true;},
    onAddToCollection:ids=>{added.push(ids);return true;},
    onDelete:ids=>{deleted.push(ids);return true;}
  });

  elements.selectButton.click();
  assert.equal(controller.isActive(),true);
  assert.equal(elements.actionBar.hidden,false);
  assert.equal(elements.body.classList.contains('selection-mode-active'),true);
  assert.equal(elements.moveButton.disabled,true);
  assert.equal(elements.moveButton.hidden,false);
  assert.equal(elements.removeShelfButton.hidden,false);
  assert.equal(elements.addCollectionButton.hidden,true);

  controller.toggleIndex(1);
  assert.deepEqual(controller.selectedIds(),['20']);
  assert.equal(cards[1].classList.contains('selected'),true);
  assert.equal(elements.count.textContent,'1 selected');
  assert.equal(elements.moveButton.disabled,false);

  elements.moveButton.click();
  elements.removeShelfButton.click();
  elements.deleteButton.click();
  assert.deepEqual(moved,[['20']]);
  assert.deepEqual(unshelved,[['20']]);
  assert.deepEqual(added,[]);
  assert.deepEqual(deleted,[['20']]);

  elements.cancelButton.click();
  assert.equal(controller.isActive(),false);
  assert.deepEqual(controller.selectedIds(),[]);
  assert.equal(renders,2);
});

test('selection mode refuses activation when the current library is not editable',()=>{
  const elements={
    body:{classList:classList()},
    collection:{querySelectorAll(){return [];}},
    selectButton:button(),actionBar:{hidden:true},count:{textContent:''},
    moveButton:button(),removeShelfButton:button(),addCollectionButton:button(),deleteButton:button(),cancelButton:button()
  };
  const controller=Controller.create({
    elements,
    recordModel:{entryId:record=>record.id},
    getRecords:()=>[],
    canActivate:()=>false
  });

  elements.selectButton.click();
  assert.equal(controller.isActive(),false);
  assert.equal(elements.actionBar.hidden,true);
});


test('wishlist selection exposes add-to-collection instead of shelf actions',()=>{
  const records=[{id:'wish-1'}];
  const cards=[card('wish-1','Wishlist album')];
  const elements={
    body:{classList:classList()},
    collection:{querySelectorAll(){return cards;}},
    selectButton:button(),actionBar:{hidden:true},count:{textContent:''},
    moveButton:button(),removeShelfButton:button(),addCollectionButton:button(),deleteButton:button(),cancelButton:button()
  };
  const added=[];const deleted=[];
  const controller=Controller.create({
    elements,
    recordModel:{entryId:record=>record.id},
    getRecords:()=>records,
    getContext:()=>({libraryView:'wishlist',activeShelfId:'all'}),
    canActivate:()=>true,
    onAddToCollection:ids=>{added.push(ids);return true;},
    onDelete:ids=>{deleted.push(ids);return true;}
  });

  controller.activate();
  controller.toggleIndex(0);
  assert.equal(elements.moveButton.hidden,true);
  assert.equal(elements.removeShelfButton.hidden,true);
  assert.equal(elements.addCollectionButton.hidden,false);
  assert.equal(elements.addCollectionButton.disabled,false);

  elements.addCollectionButton.click();
  elements.deleteButton.click();
  assert.deepEqual(added,[['wish-1']]);
  assert.deepEqual(deleted,[['wish-1']]);
});
