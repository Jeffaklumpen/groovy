(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyLibraryStyleRefresh=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function create(options){
  options=options||{};

  var api=options.api;
  var storage=options.storage;
  var recordModel=options.recordModel;
  var discogsStyleLabel=options.discogsStyleLabel;
  var getRecords=typeof options.getRecords==='function'?options.getRecords:function(){return [];};
  var getLibraryView=typeof options.getLibraryView==='function'?options.getLibraryView:function(){return 'collection';};
  var getViewedUserId=typeof options.getViewedUserId==='function'?options.getViewedUserId:function(){return null;};
  var getLoadVersion=typeof options.getLoadVersion==='function'?options.getLoadVersion:function(){return 0;};
  var renderGrid=typeof options.renderGrid==='function'?options.renderGrid:function(){};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};
  var now=typeof options.now==='function'?options.now:Date.now;
  var refreshedStyleMasters=new Set();

  if(!api||!api.functions||typeof api.functions.invoke!=='function'||typeof api.from!=='function'){
    throw new Error('Library style refresh requires Supabase');
  }
  if(!recordModel||typeof recordModel.albumId!=='function'||typeof recordModel.genre!=='function'){
    throw new Error('Library style refresh requires record model');
  }
  if(typeof discogsStyleLabel!=='function'){
    throw new Error('Library style refresh requires Discogs style parser');
  }

  function log(level,message,error){
    onLog(level,message,error);
  }

  function cacheKey(refreshKey){
    return 'groovy-style-v2-refresh-'+refreshKey;
  }

  function wasRecentlyRefreshed(refreshKey){
    if(!storage||typeof storage.getItem!=='function')return false;
    try{
      var refreshedAt=parseInt(storage.getItem(cacheKey(refreshKey)),10)||0;
      return now()-refreshedAt<30*24*60*60*1000;
    }catch(error){
      return false;
    }
  }

  function markRefreshed(refreshKey){
    if(!storage||typeof storage.setItem!=='function')return;
    try{
      storage.setItem(cacheKey(refreshKey),String(now()));
    }catch(error){}
  }

  function setRecordGenre(record,style){
    if(!record)return;
    if(typeof recordModel.setValue==='function'){
      recordModel.setValue(record,'genre',style);
      return;
    }
    if(recordModel.INDEX&&recordModel.INDEX.genre!==undefined){
      record[recordModel.INDEX.genre]=style;
    }
  }

  async function refresh(rows,loadVersion){
    var styleTableAtLoad=getLibraryView()==='wishlist'?'wishlists':'collections';
    var canPersistStyles=getViewedUserId()===null;
    var candidates=(rows||[]).filter(function(item){
      var album=item&&item.albums;
      var masterId=album&&String(album.discogs_master_id||'');
      var refreshKey=styleTableAtLoad+':'+String(item&&item.id||'');
      if(!album||!masterId||!item.id||refreshedStyleMasters.has(refreshKey))return false;

      if(wasRecentlyRefreshed(refreshKey)){
        refreshedStyleMasters.add(refreshKey);
        return false;
      }

      refreshedStyleMasters.add(refreshKey);
      return true;
    });

    if(!candidates.length)return false;

    var changed=false;
    var nextIndex=0;

    async function refreshNext(){
      while(nextIndex<candidates.length){
        var item=candidates[nextIndex++];
        var album=item.albums;
        var masterId=String(album.discogs_master_id||'');
        var refreshKey=styleTableAtLoad+':'+String(item.id);
        var shouldCache=true;

        try{
          var response=await api.functions.invoke('discogs-search',{body:{action:'master',masterId:masterId}});
          if(response.error)throw response.error;

          var style=discogsStyleLabel(response.data||{});
          if(style){
            if(style!==item.discogs_style&&canPersistStyles){
              var updateResult=await api
                .from(styleTableAtLoad)
                .update({discogs_style:style})
                .eq('id',item.id);

              if(updateResult.error){
                shouldCache=false;
                log('warn','Could not refresh Discogs styles:',updateResult.error);
              }else{
                item.discogs_style=style;
              }
            }

            if(loadVersion===getLoadVersion()){
              getRecords().forEach(function(record){
                if(recordModel.albumId(record)===album.id&&recordModel.genre(record)!==style){
                  setRecordGenre(record,style);
                  changed=true;
                }
              });
            }
          }

          if(shouldCache)markRefreshed(refreshKey);
        }catch(error){
          log('warn','Could not load updated Discogs styles for '+masterId+':',error);
        }
      }
    }

    await Promise.all([refreshNext(),refreshNext(),refreshNext()]);

    if(changed&&loadVersion===getLoadVersion())renderGrid();
    return changed;
  }

  return Object.freeze({
    refresh:refresh
  });
}

return Object.freeze({
  create:create
});
});
