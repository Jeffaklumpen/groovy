const fs=require('node:fs');

const appPath='js/app.js';
const htmlPath='index.html';
let app=fs.readFileSync(appPath,'utf8');

function take(startMarker,endMarker){
  const start=app.indexOf(startMarker);
  const end=app.indexOf(endMarker,start);
  if(start<0||end<0||end<=start)throw new Error('Could not find extraction range: '+startMarker+' -> '+endMarker);
  return app.slice(start,end);
}

const modalBlock=take('let searchTimer=null;','\n\naddAlbumButton.addEventListener');
const searchStateBlock=take('function closeAddAlbumSearch(){','\n\nasync function loadOtherUserCollection(userId){');
const searchFlowBlock=take('function setSearchResultStatus(button,status){','\n\nasync function loadUserFromUrl(){');

const moduleSource=`(function(windowObject){
'use strict';
if(!windowObject)return;

function create(options){
  options=options||{};
  var supabaseClient=options.supabaseClient;
  var addAlbumModal=options.addAlbumModal;
  var closeAddAlbum=options.closeAddAlbum;
  var albumSearchInput=options.albumSearchInput;
  var albumSearchResults=options.albumSearchResults;
  var AppleSearchCore=options.appleSearchCore;
  var PressingCore=options.pressingCore;

  if(!supabaseClient)throw new Error('Album search requires Supabase');
  if(!addAlbumModal||!closeAddAlbum||!albumSearchInput||!albumSearchResults)throw new Error('Album search DOM is incomplete');
  if(!AppleSearchCore)throw new Error('Album search requires GroovyAppleSearchCore');
  if(!PressingCore)throw new Error('Album search requires GroovyPressingCore');

${modalBlock}

${searchStateBlock}

${searchFlowBlock}

  return Object.freeze({
    open:openAddAlbumSearch,
    close:closeAddAlbumSearch,
    invalidateLibraryState:invalidateSearchLibraryState
  });
}

windowObject.GroovyAlbumSearch=Object.freeze({create:create});
})(typeof window!=='undefined'?window:null);
`;

const integration=`var albumSearchController=AlbumSearch.create({
    supabaseClient:supabaseClient,
    addAlbumModal:addAlbumModal,
    closeAddAlbum:closeAddAlbum,
    albumSearchInput:albumSearchInput,
    albumSearchResults:albumSearchResults,
    appleSearchCore:AppleSearchCore,
    pressingCore:PressingCore
});

function openAddAlbumSearch(user){return albumSearchController.open(user);}
function invalidateSearchLibraryState(){return albumSearchController.invalidateLibraryState();}`;

app=app.replace(searchFlowBlock,'');
app=app.replace(searchStateBlock,'');
app=app.replace(modalBlock,integration);

const appleBootstrap="var AppleSearchCore=window.GroovyAppleSearchCore;\nif(!AppleSearchCore)throw new Error('GroovyAppleSearchCore must load before app.js');";
if(!app.includes(appleBootstrap))throw new Error('AppleSearchCore bootstrap marker missing');
app=app.replace(appleBootstrap,appleBootstrap+"\nvar AlbumSearch=window.GroovyAlbumSearch;\nif(!AlbumSearch)throw new Error('GroovyAlbumSearch must load before app.js');");

if(app.includes('async function searchDiscogs(query)'))throw new Error('searchDiscogs remained in app.js');
if(app.includes('async function saveAlbumFromDiscogs('))throw new Error('saveAlbumFromDiscogs remained in app.js');
if(app.includes('async function searchAppleAlbumArtwork('))throw new Error('searchAppleAlbumArtwork remained in app.js');
if(app.includes('async function getSearchLibraryState('))throw new Error('getSearchLibraryState remained in app.js');
if(!app.includes('async function loadOtherUserCollection(userId)'))throw new Error('Other-user collection loader was moved accidentally');

let html=fs.readFileSync(htmlPath,'utf8');
const appleScript='<script src="/js/apple-search-core.js?v=1"></script>';
if(!html.includes(appleScript))throw new Error('Apple search script marker missing');
if(!html.includes('/js/album-search.js?v='))html=html.replace(appleScript,appleScript+'\n<script src="/js/album-search.js?v=1"></script>');
html=html.replace(/\/js\/app\.js\?v=\d+/, '/js/app.js?v=147');

fs.writeFileSync('js/album-search.js',moduleSource);
fs.writeFileSync(appPath,app);
fs.writeFileSync(htmlPath,html);
console.log('Album search extraction applied');
