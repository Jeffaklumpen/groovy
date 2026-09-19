const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/marketplace-alert-controller.js');

function classListMock(){
  const values=new Set();
  return {
    add(...names){names.forEach(name=>values.add(name));},
    remove(...names){names.forEach(name=>values.delete(name));},
    contains(name){return values.has(name);},
    toggle(name,on){if(on)values.add(name);else values.delete(name);return !!on;}
  };
}

function element(attrs){
  const listeners={};
  return {
    hidden:false,disabled:false,value:'',checked:false,textContent:'',className:'',
    attributes:Object.assign({},attrs||{}),classList:classListMock(),
    addEventListener(type,fn){listeners[type]=fn;},
    emit(type,event){if(listeners[type])return listeners[type].call(this,event||{target:this,preventDefault(){},stopPropagation(){}});},
    setAttribute(name,value){this.attributes[name]=String(value);},
    getAttribute(name){return this.attributes[name]||null;},
    focus(){this.focused=true;}
  };
}

function fixture(options){
  options=options||{};
  const elements={
    button:element(),buttonTitle:element(),buttonSummary:element(),
    modal:element(),form:element(),closeButton:element(),title:element(),subtitle:element(),
    priceInput:element(),currencySelect:element(),traderaCheckbox:element(),ebayCheckbox:element(),
    fixedCheckbox:element(),auctionCheckbox:element(),status:element(),deleteButton:element(),
    cancelButton:element(),saveButton:element()
  };
  const calls=[];
  const existing=options.existing||null;
  const api={
    functions:{
      invoke(name,payload){
        calls.push(['function',name,payload]);
        return Promise.resolve({data:{ok:true},error:null});
      }
    },
    from(name){
      calls.push(['from',name]);
      return {
        select(){return this;},
        eq(){return this;},
        async maybeSingle(){return {data:existing,error:null};}
      };
    },
    async rpc(name,payload){
      calls.push(['rpc',name,payload]);
      if(name==='save_marketplace_alert'){
        return {data:{
          id:9,album_id:42,max_price:payload.p_max_price,currency:payload.p_currency,
          tradera_enabled:payload.p_tradera,ebay_enabled:payload.p_ebay,
          fixed_price:payload.p_fixed,auction:payload.p_auction
        },error:null};
      }
      return {data:true,error:null};
    }
  };
  const record={id:42,artist:'Pink Floyd',title:'Animals'};
  const controller=Controller.create({
    api,elements,storage:{getItem(){return 'SEK';}},
    navigator:options.navigator||{languages:['sv-SE'],language:'sv-SE'},
    Intl,getCurrentUser:async()=>({id:'user-1'}),getRecord:()=>record,
    getAlbumId:r=>r.id,getArtist:r=>r.artist,getTitle:r=>r.title,
    onChanged:options.onChanged||(()=>{}),onLog:()=>{}
  });
  return {controller,elements,calls};
}

test('loads an existing alert and renders its summary',async()=>{
  const existing={id:3,album_id:42,max_price:300,currency:'SEK',tradera_enabled:true,ebay_enabled:false,fixed_price:true,auction:false};
  const {controller,elements}=fixture({existing});
  await controller.openForRecord(0);
  assert.equal(elements.button.hidden,false);
  assert.equal(elements.button.attributes['aria-pressed'],'true');
  assert.equal(elements.buttonTitle.textContent,'Price alert active');
  assert.match(elements.buttonSummary.textContent,/Tradera/);
  assert.match(elements.buttonSummary.textContent,/Fixed/);
});

test('saves price, currency, marketplaces and sale types through the RPC',async()=>{
  const {controller,elements,calls}=fixture();
  await controller.openForRecord(0);
  controller.openModal();
  elements.priceInput.value='275';
  elements.currencySelect.value='EUR';
  elements.traderaCheckbox.checked=true;
  elements.ebayCheckbox.checked=true;
  elements.fixedCheckbox.checked=false;
  elements.auctionCheckbox.checked=true;

  assert.equal(await controller.save(),true);
  const call=calls.find(entry=>entry[0]==='rpc'&&entry[1]==='save_marketplace_alert');
  assert.ok(call);
  assert.equal(call[2].p_max_price,275);
  assert.equal(call[2].p_currency,'EUR');
  assert.equal(call[2].p_tradera,true);
  assert.equal(call[2].p_ebay,true);
  assert.equal(call[2].p_fixed,false);
  assert.equal(call[2].p_auction,true);
  assert.equal(call[2].p_ebay_marketplace_id,'EBAY_US');
});

test('requires at least one marketplace and one sale type',async()=>{
  const {controller,elements,calls}=fixture();
  await controller.openForRecord(0);
  controller.openModal();
  elements.priceInput.value='300';
  elements.currencySelect.value='SEK';
  elements.traderaCheckbox.checked=false;
  elements.ebayCheckbox.checked=false;
  elements.fixedCheckbox.checked=true;
  elements.auctionCheckbox.checked=true;
  assert.equal(await controller.save(),false);
  assert.match(elements.status.textContent,/Tradera, eBay or both/);
  assert.equal(calls.some(entry=>entry[0]==='rpc'),false);

  elements.traderaCheckbox.checked=true;
  elements.fixedCheckbox.checked=false;
  elements.auctionCheckbox.checked=false;
  assert.equal(await controller.save(),false);
  assert.match(elements.status.textContent,/fixed price, auction or both/);
});

test('removes an existing alert and Escape closes the custom modal',async()=>{
  const existing={id:3,album_id:42,max_price:300,currency:'SEK',tradera_enabled:true,ebay_enabled:true,fixed_price:true,auction:true};
  const {controller,elements,calls}=fixture({existing});
  await controller.openForRecord(0);
  controller.openModal();
  assert.equal(elements.modal.classList.contains('visible'),true);
  assert.equal(controller.handleEscape(),true);
  assert.equal(elements.modal.classList.contains('visible'),false);
  controller.openModal();
  assert.equal(await controller.remove(),true);
  assert.ok(calls.some(entry=>entry[0]==='rpc'&&entry[1]==='delete_marketplace_alert'));
  assert.equal(elements.button.attributes['aria-pressed'],'false');
});


test('opens an existing alert directly from the Price Alerts page and refreshes after save',async()=>{
  const changes=[];
  const {controller,elements}=fixture({onChanged:event=>changes.push(event)});
  const record={id:77,artist:'Nirvana',title:'Nevermind'};
  const existing={id:10,album_id:77,max_price:1000,currency:'SEK',tradera_enabled:true,ebay_enabled:true,fixed_price:true,auction:true};
  assert.equal(await controller.openForRecordData(record,existing),true);
  assert.equal(elements.modal.classList.contains('visible'),true);
  assert.equal(elements.priceInput.value,'1000');
  assert.equal(elements.subtitle.textContent,'Nirvana · Nevermind');

  elements.priceInput.value='850';
  assert.equal(await controller.save(),true);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(changes[0].type,'saved');
  assert.equal(changes[0].record,record);
  assert.ok(changes.some(event=>event.type==='scanned'));
});



test('requests an immediate single-alert scan after saving',async()=>{
  const changes=[];
  const {controller,elements,calls}=fixture({onChanged:event=>changes.push(event)});
  await controller.openForRecord(0);
  controller.openModal();
  elements.priceInput.value='425';
  elements.currencySelect.value='SEK';
  elements.traderaCheckbox.checked=true;
  elements.ebayCheckbox.checked=true;
  elements.fixedCheckbox.checked=true;
  elements.auctionCheckbox.checked=true;
  assert.equal(await controller.save(),true);
  await new Promise(resolve=>setTimeout(resolve,0));
  const scan=calls.find(entry=>entry[0]==='function'&&entry[1]==='marketplace-alert-scan');
  assert.ok(scan);
  assert.equal(scan[2].body.alert_id,9);
  assert.ok(changes.some(event=>event.type==='scanned'));
});
