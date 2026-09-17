const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/shelf-controller.js');

function classList(){const values=new Set();return {toggle(name,on){if(on)values.add(name);else values.delete(name);},remove(name){values.delete(name);},has(name){return values.has(name);}};}
function element(){const listeners={};return {hidden:false,disabled:false,innerHTML:'',textContent:'',value:'',style:{display:'',setProperty(){}},classList:classList(),scrollLeft:0,scrollWidth:0,clientWidth:0,listeners,addEventListener(name,fn){listeners[name]=fn;},querySelectorAll(){return [];},querySelector(){return null;},focus(){this.focused=true;},select(){this.selected=true;},getAttribute(){return '';},setAttribute(){}};}
function fixture(overrides){
  const shelves=[{id:'s1',user_id:'u1',name:'Favorites',icon:'heart',color:'#3B82F6',sort_order:1}];
  const record=new Array(17).fill('');record[2]='Album';record[9]='entry-1';record[13]='';record[14]=null;
  const elements={strip:element(),stripScroll:element(),scrollLeft:element(),scrollRight:element(),editButton:element(),deleteButton:element(),deleteModal:element(),closeDelete:element(),cancelDelete:element(),confirmDelete:element(),deleteMessage:element(),deleteStatus:element(),createModal:element(),createTitle:element(),createDescription:element(),closeCreate:element(),cancelCreate:element(),confirmCreate:element(),nameInput:element(),iconChoices:element(),colorChoices:element(),createStatus:element(),pickerModal:element(),closePicker:element(),cancelPicker:element(),confirmPicker:element(),createFromPicker:element(),pickerList:element(),pickerSubtitle:element(),pickerStatus:element(),pickerTitle:element(),detailActions:element(),detailStatus:element()};
  const state={shelves:shelves.slice(),active:'all',records:[record],grid:0,page:0};
  const api={rpc:async()=>({data:{shelf_sort_order:1},error:null})};
  const options=Object.assign({elements,colors:['#E85301','#3B82F6'],maxShelves:10,api,recordModel:{nextShelfOrder(){return 1;},compactShelfOrder(){}},getShelves:()=>state.shelves,setShelves:v=>{state.shelves=v;},getActiveShelfId:()=>state.active,setActiveShelfId:v=>{state.active=v;},getRecords:()=>state.records,getViewedUserId:()=>null,getLibraryView:()=>'collection',getDetailOpenRecordIndex:()=>-1,getSessionUser:async()=>({id:'u1'}),onLibraryPageReset:()=>{state.page++;},onGridChange:()=>{state.grid++;},isMobile:()=>false,requestFrame:fn=>fn()},overrides||{});
  return {controller:Controller.create(options),elements,state,api,record};
}

test('controller opens create and picker flows without owning library state',()=>{
  const fx=fixture();
  assert.equal(fx.controller.openCreate(-1),true);
  assert.equal(fx.elements.createModal.style.display,'flex');
  assert.equal(fx.elements.createTitle.textContent,'Create New Shelf');
  fx.controller.closeCreate();
  assert.equal(fx.elements.createModal.style.display,'none');
  assert.equal(fx.controller.openPicker(0),true);
  assert.equal(fx.elements.pickerModal.style.display,'flex');
  assert.equal(fx.controller.state().pickerRecordIndex,0);
});

test('assignRecord keeps optimistic shelf state and backend order in sync',async()=>{
  const fx=fixture();
  const ok=await fx.controller.assignRecord(0,'s1');
  assert.equal(ok,true);
  assert.equal(fx.record[13],'s1');
  assert.equal(fx.record[14],1);
  assert.ok(fx.state.page>=1);
  assert.ok(fx.state.grid>=1);
});

test('assignRecord rolls record state back when backend move fails',async()=>{
  const error=new Error('move failed');
  const fx=fixture({api:{rpc:async()=>({data:null,error})}});
  await assert.rejects(()=>fx.controller.assignRecord(0,'s1'),/move failed/);
  assert.equal(fx.record[13],'');
  assert.equal(fx.record[14],null);
});

test('loadForUser normalizes shelf colors and resets active shelf for another user',async()=>{
  const query={select(){return this;},eq(){return this;},order(){return this;},then(resolve){resolve({data:[{id:'s2',name:'Blue',color:'#3b82f6'}],error:null});}};
  const fx=fixture({api:{from(){return query;}}});
  fx.state.active='s1';
  const loaded=await fx.controller.loadForUser('u2');
  assert.equal(fx.state.active,'all');
  assert.equal(loaded[0].color,'#3B82F6');
});

test('detail actions stay hidden for wishlist and other-user contexts',()=>{
  let view='wishlist';
  let viewed=null;
  const fx=fixture({getLibraryView:()=>view,getViewedUserId:()=>viewed});
  fx.controller.renderDetailActions(0);
  assert.equal(fx.elements.detailActions.hidden,true);
  view='collection';viewed='other';
  fx.controller.renderDetailActions(0);
  assert.equal(fx.elements.detailActions.hidden,true);
});
