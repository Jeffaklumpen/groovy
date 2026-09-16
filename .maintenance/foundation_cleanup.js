const fs=require('node:fs');

function functionRange(source,name){
  const start=source.indexOf('function '+name+'(');
  if(start<0)throw new Error('Function not found: '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quote=null,escaped=false,end=-1;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0){end=i+1;break;}
    }
  }
  if(end<0)throw new Error('Could not find end of function: '+name);
  return {start,end,text:source.slice(start,end)};
}

function removeFunction(source,name){
  const range=functionRange(source,name);
  return source.slice(0,range.start)+source.slice(range.end);
}

function insertBeforeFunctionEnd(source,name,code){
  const range=functionRange(source,name);
  if(range.text.includes(code.trim()))throw new Error(name+' already contains inserted code');
  const updated=range.text.slice(0,-1)+code+'\n}';
  return source.slice(0,range.start)+updated+source.slice(range.end);
}

// app.js remains the owner of saving album ratings and community math.
const appPath='js/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(app.includes("source:'save'"))throw new Error('Save rating event already exists');
app=insertBeforeFunctionEnd(app,'saveAlbumRating',"\n  window.dispatchEvent(new CustomEvent('groovy-rating-updated',{detail:{albumId:albumId,index:index,source:'save'}}));");
fs.writeFileSync(appPath,app);

// detail-enhancements owns wishlist hydration/removal and responds to the shared event.
const detailPath='js/detail-enhancements-v2.js';
let detail=fs.readFileSync(detailPath,'utf8');
if(detail.includes("source:'remove'"))throw new Error('Remove rating event already exists');
detail=insertBeforeFunctionEnd(detail,'removeRating',"\n  window.dispatchEvent(new CustomEvent('groovy-rating-updated',{detail:{albumId:albumId,index:index,source:'remove'}}));");
if(detail.includes("source:'wishlist-hydrate'"))throw new Error('Wishlist hydration event already exists');
detail=insertBeforeFunctionEnd(detail,'refreshWishlistRatings',"\n  window.dispatchEvent(new CustomEvent('groovy-rating-updated',{detail:{source:'wishlist-hydrate'}}));");

const oldStarBlock=`    /* Do not intercept rating stars. app.js owns saving and community math. We\n       only restore the Remove Rating footer after its panel has re-rendered. */\n    var star=event.target.closest&&event.target.closest('.album-rating-star');\n    if(star){\n      [180,550,1300].forEach(function(delay){\n        setTimeout(function(){\n          var index=detailIndex();\n          if(index>=0)updateDetailRating(index);\n        },delay);\n      });\n    }\n`;
if((detail.match(/\[180,550,1300\]/g)||[]).length!==1)throw new Error('Expected one legacy detail rating retry loop');
detail=detail.replace(oldStarBlock,'');
if(detail.includes('[180,550,1300]'))throw new Error('Legacy detail rating retry loop remains');

const observerAnchor=`  new MutationObserver(function(){\n    if(window.libraryView==='wishlist')scheduleWishlistRatings(100);\n  }).observe(collection,{childList:true,subtree:true});`;
if(detail.split(observerAnchor).length!==2)throw new Error('Could not locate detail observer anchor');
const ratingEventListener=`  window.addEventListener('groovy-rating-updated',function(event){\n    if(!overlay.classList.contains('visible'))return;\n    var index=detailIndex();\n    if(index<0)return;\n    var albumId=event&&event.detail&&event.detail.albumId;\n    var record=recordAt(index);\n    if(albumId&&record&&String(record[8])!==String(albumId))return;\n    updateDetailRating(index);\n  });\n\n`;
detail=detail.replace(observerAnchor,ratingEventListener+observerAnchor);
fs.writeFileSync(detailPath,detail);

// album-rating-layout becomes presentation + viewed-user context only. It must
// no longer refetch the complete rating set repeatedly after clicks/opening.
const layoutPath='js/album-rating-layout-v4.js';
let layout=fs.readFileSync(layoutPath,'utf8');
if((layout.match(/var ratingToken=0;/g)||[]).length!==1)throw new Error('Expected one ratingToken declaration');
layout=layout.replace('var ratingToken=0;\n','');
layout=removeFunction(layout,'refreshGlobal');
layout=removeFunction(layout,'scheduleRefresh');

const oldQueue=`    decorateBase();\n    scanAvatars(document);\n    syncViewed();`;
if(layout.split(oldQueue).length!==2)throw new Error('Could not locate queueDecorate body');
layout=layout.replace(oldQueue,`    decorateBase();\n    scanAvatars(document);`);

const oldViewedStart=`  var viewedId=window.viewedUserId;\n  var user=await currentUser();\n\n  if(!viewedId||!user||String(viewedId)===String(user.id)){\n    removeViewed();\n    return;\n  }`;
const newViewedStart=`  var viewedId=window.viewedUserId;\n  if(!viewedId){\n    removeViewed();\n    return;\n  }\n\n  var user=await currentUser();\n  if(!user||String(viewedId)===String(user.id)){\n    removeViewed();\n    return;\n  }`;
if(layout.split(oldViewedStart).length!==2)throw new Error('Could not optimize syncViewed session lookup');
layout=layout.replace(oldViewedStart,newViewedStart);

const oldOverlayOpen=`      setTimeout(function(){decorateBase();syncViewed();refreshGlobal();},40);`;
if(layout.split(oldOverlayOpen).length!==2)throw new Error('Could not locate overlay global rating refresh');
layout=layout.replace(oldOverlayOpen,`      setTimeout(function(){decorateBase();syncViewed();},40);`);
layout=layout.replace(/\n\s*ratingToken\+\+;/,'');

const oldClick=`  document.addEventListener('click',function(event){\n    if(event.target.closest&&event.target.closest('.album-rating-star,.groovy-remove-rating'))scheduleRefresh();\n  },false);\n\n`;
if(layout.split(oldClick).length!==2)throw new Error('Could not locate rating polling click handler');
layout=layout.replace(oldClick,'');

const oldRoute=`  window.addEventListener('popstate',function(){setTimeout(function(){decorateBase();syncViewed();},80);});\n\n  if(overlay.classList.contains('visible'))setTimeout(function(){decorateBase();syncViewed();refreshGlobal();},35);`;
const newRoute=`  window.addEventListener('groovy-rating-updated',function(event){\n    if(!overlay.classList.contains('visible'))return;\n    var record=currentRecord();\n    var albumId=event&&event.detail&&event.detail.albumId;\n    if(albumId&&record&&String(record[8])!==String(albumId))return;\n    setTimeout(decorateBase,0);\n  });\n\n  window.addEventListener('groovy-route-change',function(){\n    if(overlay.classList.contains('visible'))setTimeout(function(){decorateBase();syncViewed();},0);\n  });\n\n  if(overlay.classList.contains('visible'))setTimeout(function(){decorateBase();syncViewed();},35);`;
if(layout.split(oldRoute).length!==2)throw new Error('Could not replace rating route/initial refresh block');
layout=layout.replace(oldRoute,newRoute);

for(const forbidden of ['refreshGlobal','scheduleRefresh','ratingToken','[160,420,850,1400]','[220,600,1200,1700]']){
  if(layout.includes(forbidden))throw new Error('Legacy rating polling symbol remains: '+forbidden);
}
fs.writeFileSync(layoutPath,layout);

// Cache-bust every production asset changed during the recent routing/rating cleanup.
const indexPath='index.html';
let index=fs.readFileSync(indexPath,'utf8');
const bumps=[
  ['/css/detail-enhancements.css?v=7','/css/detail-enhancements.css?v=8'],
  ['/js/app.js?v=124','/js/app.js?v=125'],
  ['/js/detail-enhancements-v2.js?v=7','/js/detail-enhancements-v2.js?v=8'],
  ['/js/profile.js?v=9','/js/profile.js?v=10'],
  ['/js/album-rating-layout-v4.js?v=1','/js/album-rating-layout-v4.js?v=2']
];
for(const [from,to] of bumps){
  if(index.split(from).length!==2)throw new Error('Expected one cache version reference: '+from);
  index=index.replace(from,to);
}
fs.writeFileSync(indexPath,index);

const testPath='tests/rating.test.js';
if(fs.existsSync(testPath))throw new Error('tests/rating.test.js already exists');
fs.writeFileSync(testPath,`const assert=require('node:assert/strict');\nconst fs=require('node:fs');\nconst path=require('node:path');\nconst test=require('node:test');\n\nconst root=path.resolve(__dirname,'..');\n\ntest('album rating state is event-driven instead of repeatedly refetched',function(){\n  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');\n  const detail=fs.readFileSync(path.join(root,'js','detail-enhancements-v2.js'),'utf8');\n  const layout=fs.readFileSync(path.join(root,'js','album-rating-layout-v4.js'),'utf8');\n\n  assert.match(app,/groovy-rating-updated/);\n  assert.match(detail,/addEventListener\\('groovy-rating-updated'/);\n  assert.match(layout,/addEventListener\\('groovy-rating-updated'/);\n  assert.doesNotMatch(layout,/refreshGlobal|scheduleRefresh|ratingToken|160,420,850,1400|220,600,1200,1700/);\n  assert.doesNotMatch(detail,/180,550,1300/);\n  assert.doesNotMatch(layout,/select\\('user_id,rating'\\)/);\n});\n\ntest('changed frontend assets are cache-busted in index',function(){\n  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');\n  assert.match(html,/detail-enhancements\\.css\\?v=8/);\n  assert.match(html,/app\\.js\\?v=125/);\n  assert.match(html,/detail-enhancements-v2\\.js\\?v=8/);\n  assert.match(html,/profile\\.js\\?v=10/);\n  assert.match(html,/album-rating-layout-v4\\.js\\?v=2/);\n});\n`);
