const test=require('node:test');
const assert=require('node:assert/strict');
const Shelf=require('../js/shelf-core.js');

const colors=['#E85301','#3B82F6','#10B981'];

test('normalizeColor matches case-insensitively and falls back to first color',()=>{
  assert.equal(Shelf.normalizeColor('#3b82f6',colors),'#3B82F6');
  assert.equal(Shelf.normalizeColor('#ffffff',colors),'#E85301');
  assert.equal(Shelf.normalizeColor('',colors),'#E85301');
});

test('colorRgb and colorStyle preserve shelf color output',()=>{
  assert.equal(Shelf.colorRgb('#10B981',colors),'16,185,129');
  assert.equal(Shelf.colorStyle({color:'#3b82f6'},colors),'--shelf-color:#3B82F6;--shelf-rgb:59,130,246;');
});

test('findById compares shelf ids as strings',()=>{
  const shelves=[{id:1,name:'One'},{id:'2',name:'Two'}];
  assert.equal(Shelf.findById(shelves,'1'),shelves[0]);
  assert.equal(Shelf.findById(shelves,2),shelves[1]);
  assert.equal(Shelf.findById(shelves,'3'),null);
});

test('recordCount handles all shelves and positional shelf ids',()=>{
  const a=new Array(14).fill('');a[13]='shelf-a';
  const b=new Array(14).fill('');b[13]='shelf-b';
  const c=new Array(14).fill('');c[13]='shelf-a';
  assert.equal(Shelf.recordCount([a,b,c],'all'),3);
  assert.equal(Shelf.recordCount([a,b,c],'shelf-a'),2);
  assert.equal(Shelf.recordCount([a,b,c],'missing'),0);
});

test('shelf icon aliases normalize to supported icons',()=>{
  assert.equal(Shelf.normalizeIcon('vinyl'),'record');
  assert.equal(Shelf.normalizeIcon('fire'),'flame');
  assert.equal(Shelf.normalizeIcon('not-real'),'record');
});

test('shelf icon SVG uses the normalized icon path',()=>{
  const svg=Shelf.iconSvg('vinyl');
  assert.match(svg,/class="shelf-svg-icon"/);
  assert.match(svg,/viewBox="0 0 24 24"/);
  assert.ok(svg.includes(Shelf.ICON_PATHS.record));
});

test('shelf icon metadata remains available to the app',()=>{
  assert.ok(Array.isArray(Shelf.ICON_OPTIONS));
  assert.equal(Shelf.ICON_OPTIONS[0].id,'record');
  assert.equal(Shelf.ICON_ALIASES.lightning,'bolt');
});

