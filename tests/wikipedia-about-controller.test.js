const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const WikipediaAboutController=require('../js/wikipedia-about-controller.js');

function classList(){
  const values=new Set();
  return {
    add(name){values.add(name);},
    remove(name){values.delete(name);},
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    contains(name){return values.has(name);}
  };
}

function node(tag='div'){
  const listeners={};
  return {
    tagName:tag,
    hidden:false,
    innerHTML:'',
    textContent:'',
    className:'',
    style:{},
    classList:classList(),
    children:[],
    attributes:{},
    href:'',
    scrollHeight:120,
    offsetHeight:20,
    appendChild(child){this.children.push(child);return child;},
    querySelector(selector){
      if(selector==='p')return this.children.find(child=>child.tagName==='p')||null;
      if(selector==='span')return this.span||null;
      return null;
    },
    setAttribute(name,value){this.attributes[name]=String(value);},
    getAttribute(name){return this.attributes[name]||null;},
    addEventListener(type,fn){listeners[type]=fn;},
    emit(type,event={}){if(listeners[type])return listeners[type].call(this,Object.assign({target:this},event));}
  };
}

function makeElements(){
  const root=node('section');
  const text=node('div');
  const body=node('div');
  const toggle=node('button');
  const link=node('a');
  root.hidden=true;
  toggle.span=node('span');
  toggle.attributes['aria-expanded']='false';
  return {root,text,body,toggle,link};
}

function makeDocument(){
  return {createElement(tag){return node(tag);}};
}

function makeStorage(){
  const data=new Map();
  return {
    data,
    getItem(key){return data.has(key)?data.get(key):null;},
    setItem(key,value){data.set(key,String(value));}
  };
}

const recordModel={
  artist(record){return record[1];},
  title(record){return record[2];}
};

function options(service,elements,extra={}){
  return Object.assign({
    service,
    recordModel,
    document:makeDocument(),
    elements,
    storage:makeStorage(),
    requestAnimationFrame(fn){fn();},
    getComputedStyle(){return {lineHeight:'20px'};}
  },extra);
}

test('cached Wikipedia about content renders without another search',async()=>{
  const elements=makeElements();
  const storage=makeStorage();
  const service={
    cacheKey(){return 'wiki:cached';},
    searchCandidates(){throw new Error('cached content should avoid search');}
  };
  storage.setItem('wiki:cached',JSON.stringify({
    text:'Cached introduction.',
    heading:'Background',
    sectionParagraphs:['More context.'],
    url:'https://example.test/wiki',
    title:'Animals',
    savedAt:900
  }));
  const controller=WikipediaAboutController.create(options(service,elements,{storage,now:()=>1000}));

  await controller.openForRecord([1,'Pink Floyd','Animals']);

  assert.equal(elements.root.hidden,false);
  assert.equal(elements.link.href,'https://example.test/wiki');
  assert.equal(elements.link.attributes['aria-label'],'Read Animals on Wikipedia');
  assert.equal(elements.text.children.length,3);
  assert.equal(controller.state().cacheSize,1);
});

test('Wikipedia search result renders and persists the same about data',async()=>{
  const elements=makeElements();
  const storage=makeStorage();
  const calls=[];
  const page={
    pageid:1,
    title:'Animals (Pink Floyd album)',
    extract:'<p>Animals is an album by Pink Floyd.</p>',
    fullurl:'https://example.test/animals'
  };
  const service={
    cacheKey(){return 'wiki:animals';},
    async searchCandidates(record,query){calls.push(['search',query]);return [page];},
    candidateScore(){return 30;},
    introduction(){return 'Animals is an album by Pink Floyd.';},
    async firstSection(){calls.push(['section']);return {heading:'Background',index:'1'};},
    async sectionParagraphs(){calls.push(['paragraphs']);return ['Recorded in 1976.'];}
  };
  const controller=WikipediaAboutController.create(options(service,elements,{storage,now:()=>2000}));

  await controller.openForRecord([1,'Pink Floyd','Animals']);

  assert.equal(elements.root.hidden,false);
  assert.equal(elements.link.href,'https://example.test/animals');
  assert.equal(calls.filter(call=>call[0]==='search').length,1);
  assert.ok(storage.getItem('wiki:animals'));
  const cached=JSON.parse(storage.getItem('wiki:animals'));
  assert.equal(cached.heading,'Background');
  assert.deepEqual(cached.sectionParagraphs,['Recorded in 1976.']);
});

test('close invalidates an in-flight Wikipedia request and resets the panel',async()=>{
  const elements=makeElements();
  let resolveSearch;
  const pendingSearch=new Promise(resolve=>{resolveSearch=resolve;});
  const service={
    cacheKey(){return 'wiki:pending';},
    searchCandidates(){return pendingSearch;},
    candidateScore(){return 30;},
    introduction(){return 'Late result';},
    async firstSection(){return null;},
    async sectionParagraphs(){return [];}
  };
  const controller=WikipediaAboutController.create(options(service,elements));

  const pending=controller.openForRecord([1,'Artist','Album']);
  controller.close();
  resolveSearch([{title:'Album',extract:'Late result'}]);
  await pending;

  assert.equal(elements.root.hidden,true);
  assert.equal(elements.toggle.hidden,true);
  assert.equal(elements.toggle.attributes['aria-expanded'],'false');
  assert.equal(elements.body.classList.contains('expanded'),false);
  assert.equal(elements.body.style.maxHeight,'');
});

test('Wikipedia attribution stays inside the expandable About body',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const bodyStart=html.indexOf('id="detailAboutAlbumBody"');
  const source=html.indexOf('class="album-about-source"',bodyStart);
  const toggle=html.indexOf('id="detailAboutAlbumToggle"',bodyStart);

  assert.ok(bodyStart>=0&&source>bodyStart&&toggle>source);
  const expandableMarkup=html.slice(bodyStart,toggle);
  assert.match(expandableMarkup,/class="album-about-source"/);
  assert.match(expandableMarkup,/Wikipedia contributors/);
  assert.match(expandableMarkup,/CC BY-SA 4\.0/);
});

test('Read more toggle preserves expanded and collapsed presentation',()=>{
  const elements=makeElements();
  elements.body.scrollHeight=180;
  const controller=WikipediaAboutController.create(options({cacheKey(){return 'wiki:x';}},elements));

  elements.toggle.emit('click');
  assert.equal(elements.toggle.attributes['aria-expanded'],'true');
  assert.equal(elements.toggle.span.textContent,'Show less');
  assert.equal(elements.body.classList.contains('expanded'),true);
  assert.equal(elements.body.style.maxHeight,'180px');

  elements.toggle.emit('click');
  assert.equal(elements.toggle.attributes['aria-expanded'],'false');
  assert.equal(elements.toggle.span.textContent,'Read more');
  assert.equal(elements.body.classList.contains('expanded'),false);
  assert.equal(elements.body.style.maxHeight,'60px');
});

test('low-confidence Wikipedia candidates hide the about panel',async()=>{
  const elements=makeElements();
  const service={
    cacheKey(){return 'wiki:none';},
    async searchCandidates(){return [{title:'Unrelated',extract:'Something else'}];},
    candidateScore(){return 5;},
    introduction(){return 'Should not render';},
    async firstSection(){throw new Error('should not load section');},
    async sectionParagraphs(){return [];}
  };
  const controller=WikipediaAboutController.create(options(service,elements));

  await controller.openForRecord([1,'Artist','Album']);

  assert.equal(elements.root.hidden,true);
});
