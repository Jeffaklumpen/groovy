const test=require('node:test');
const assert=require('node:assert/strict');
const View=require('../js/shelf-view.js');

function classList(){
  const values=new Set();
  return {
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    has(name){return values.has(name);}
  };
}

function choice(attrs){
  return {
    attrs:Object.assign({},attrs),
    classList:classList(),
    getAttribute(name){return this.attrs[name]||'';},
    setAttribute(name,value){this.attrs[name]=String(value);}
  };
}

test('icon choices keep the existing shelf icon presentation',()=>{
  const html=View.iconChoicesMarkup();
  assert.match(html,/data-icon="record"/);
  assert.match(html,/aria-label="Vinyl"/);
  assert.match(html,/shelf-svg-icon/);
});

test('strip markup keeps counts, active shelf and create limit state',()=>{
  const a={shelf:'s1'};
  const b={shelf:'s2'};
  const html=View.stripMarkup({
    shelves:[{id:'s1',name:'Favorites',icon:'heart',color:'#3B82F6'},{id:'s2',name:'Late Night',icon:'moon',color:'#10B981'}],
    records:[a,b],getShelfId:record=>record.shelf,activeShelfId:'s1',maxShelves:10,showCreate:true,
    colors:['#E85301','#3B82F6','#10B981']
  });
  assert.match(html,/All Records/);
  assert.match(html,/2 records/);
  assert.match(html,/shelf-chip-custom active/);
  assert.match(html,/Favorites/);
  assert.match(html,/1 records/);
  assert.match(html,/New Shelf/);
  assert.match(html,/2 of 10/);
});

test('picker markup preserves selected shelf and empty state',()=>{
  const html=View.pickerMarkup({
    shelves:[{id:'s1',name:'A&B',icon:'record',color:'#E85301'}],
    currentShelfId:'s1',colors:['#E85301']
  });
  assert.match(html,/value="s1" checked/);
  assert.match(html,/A&amp;B/);
  assert.match(html,/shelf-picker-option shelf-colored selected/);
  assert.match(View.pickerMarkup({shelves:[]}),/No shelves yet/);
});

test('choice helpers preserve selected icon and color state',()=>{
  const iconA=choice({'data-icon':'record'});
  const iconB=choice({'data-icon':'heart'});
  const iconContainer={querySelectorAll(){return [iconA,iconB];}};
  assert.equal(View.applyIconChoice(iconContainer,'heart'),'heart');
  assert.equal(iconA.classList.has('selected'),false);
  assert.equal(iconB.classList.has('selected'),true);
  assert.equal(iconB.attrs['aria-checked'],'true');

  const colorA=choice({'data-color':'#E85301'});
  const colorB=choice({'data-color':'#3B82F6'});
  const colorContainer={querySelectorAll(){return [colorA,colorB];}};
  const styles={};
  const modal={style:{setProperty(name,value){styles[name]=value;}}};
  assert.equal(View.applyColorChoice(colorContainer,modal,'#3b82f6',['#E85301','#3B82F6']),'#3B82F6');
  assert.equal(colorB.classList.has('selected'),true);
  assert.equal(styles['--shelf-choice-color'],'#3B82F6');
});

test('detail shelf presentation keeps wishlist, unshelved and assigned states',()=>{
  assert.deepEqual(View.detailStatusState(null,null,false),{hidden:true,unshelved:false,html:''});
  assert.deepEqual(View.detailStatusState(['record'],null,true),{hidden:true,unshelved:false,html:''});

  const unshelved=View.detailStatusState(['record'],null,false);
  assert.equal(unshelved.hidden,false);
  assert.equal(unshelved.unshelved,true);
  assert.match(unshelved.html,/no shelf/);

  const assigned=View.detailStatusState(['record'],{name:'Favorites',icon:'heart'},false);
  assert.equal(assigned.unshelved,false);
  assert.match(assigned.html,/Favorites/);
  assert.match(assigned.html,/shelf-svg-icon/);
  assert.match(View.detailActionsMarkup(false),/Add to Shelf/);
  assert.match(View.detailActionsMarkup(true),/Move to Shelf/);
  assert.match(View.detailActionsMarkup(true),/Remove from Shelf/);
});
