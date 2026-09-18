(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyLibraryActionsController=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function create(options){
  options=options||{};

  var api=options.api;
  var recordModel=options.recordModel;
  var getRecords=typeof options.getRecords==='function'?options.getRecords:function(){return [];};
  var getViewedUserId=typeof options.getViewedUserId==='function'?options.getViewedUserId:function(){return null;};
  var getLibraryView=typeof options.getLibraryView==='function'?options.getLibraryView:function(){return 'collection';};
  var invalidateSearchState=typeof options.invalidateSearchState==='function'?options.invalidateSearchState:function(){};
  var loadCollection=typeof options.loadCollection==='function'?options.loadCollection:async function(){};
  var resetPage=typeof options.resetPage==='function'?options.resetPage:function(){};
  var renderShelfStrip=typeof options.renderShelfStrip==='function'?options.renderShelfStrip:function(){};
  var renderGrid=typeof options.renderGrid==='function'?options.renderGrid:function(){};
  var onAlert=typeof options.onAlert==='function'?options.onAlert:function(){};
  var onLog=typeof options.onLog==='function'?options.onLog:function(){};

  if(!api||typeof api.from!=='function')throw new Error('Library actions controller requires Supabase');
  if(!recordModel)throw new Error('Library actions controller requires record model');

  function log(level,message,error){onLog(level,message,error);}

  async function deleteCollection(index){
    if(getViewedUserId()!==null)return false;
    var records=getRecords();
    var record=records[index];
    if(!record)return false;

    var sessionResult=await api.auth.getSession();
    var session=sessionResult&&sessionResult.data&&sessionResult.data.session;
    var user=session&&session.user;

    if(!user){
      onAlert('Du måste vara inloggad.');
      return false;
    }

    var result=await api.rpc('delete_collection_record',{
      p_collection_id:String(recordModel.entryId(record))
    });

    if(result.error){
      log('error','Kunde inte ta bort albumet:',result.error);
      onAlert('Kunde inte ta bort albumet.');
      return false;
    }

    invalidateSearchState();

    var deletedShelfId=recordModel.shelfId(record)||'';
    records.splice(index,1);
    records
      .slice()
      .sort(function(a,b){
        return (parseInt(recordModel.order(a),10)||0)-(parseInt(recordModel.order(b),10)||0);
      })
      .forEach(function(item,position){
        item[recordModel.INDEX.order]=position+1;
      });

    if(deletedShelfId)recordModel.compactShelfOrder(records,deletedShelfId);

    resetPage();
    renderShelfStrip();
    renderGrid();
    return true;
  }

  async function deleteWishlist(index){
    if(getViewedUserId()!==null||getLibraryView()!=='wishlist')return false;
    var records=getRecords();
    var record=records[index];
    if(!record)return false;

    var userResult=await api.auth.getUser();
    var user=userResult&&userResult.data&&userResult.data.user;
    if(userResult.error||!user){
      onAlert('Du måste vara inloggad.');
      return false;
    }

    var result=await api
      .from('wishlists')
      .delete()
      .eq('id',recordModel.entryId(record))
      .eq('user_id',user.id)
      .select('id');

    if(result.error||!result.data||!result.data.length){
      log('error','Kunde inte ta bort albumet från önskelistan:',result.error);
      onAlert('Kunde inte ta bort albumet från önskelistan.');
      return false;
    }

    invalidateSearchState();
    await loadCollection();
    return true;
  }

  function normalizeEntryIds(entryIds){
    var seen={};
    return (Array.isArray(entryIds)?entryIds:[])
      .map(function(value){return String(value==null?'':value).trim();})
      .filter(function(value){
        if(!value||seen[value])return false;
        seen[value]=true;
        return true;
      });
  }

  async function deleteCollectionRecords(entryIds){
    if(getViewedUserId()!==null||getLibraryView()==='wishlist')return false;
    var ids=normalizeEntryIds(entryIds);
    if(!ids.length)return false;

    var sessionResult=await api.auth.getSession();
    var session=sessionResult&&sessionResult.data&&sessionResult.data.session;
    if(!session||!session.user){
      onAlert('Du måste vara inloggad.');
      return false;
    }

    var result=await api.rpc('delete_collection_records',{p_collection_ids:ids});
    if(result.error){
      log('error','Kunde inte ta bort valda album:',result.error);
      onAlert('Kunde inte ta bort de valda albumen.\n\n'+(result.error.message||result.error));
      return false;
    }

    invalidateSearchState();
    await loadCollection();
    return true;
  }

  async function moveCollectionRecordsToShelf(entryIds,shelfId){
    if(getViewedUserId()!==null||getLibraryView()==='wishlist')return false;
    var ids=normalizeEntryIds(entryIds);
    if(!ids.length)return false;

    var sessionResult=await api.auth.getSession();
    var session=sessionResult&&sessionResult.data&&sessionResult.data.session;
    if(!session||!session.user){
      onAlert('Du måste vara inloggad.');
      return false;
    }

    var result=await api.rpc('move_collection_records_to_shelf',{
      p_collection_ids:ids,
      p_shelf_id:shelfId||null
    });
    if(result.error){
      log('error','Kunde inte flytta valda album till shelf:',result.error);
      onAlert('Kunde inte flytta de valda albumen.\n\n'+(result.error.message||result.error));
      return false;
    }

    await loadCollection();
    return true;
  }

  async function moveWishlistToCollection(index,button){
    if(getViewedUserId()!==null||getLibraryView()!=='wishlist')return false;
    var record=getRecords()[index];
    if(!record)return false;

    var originalText=button?button.textContent:'';
    if(button){
      button.textContent='Moving...';
      button.disabled=true;
    }

    try{
      var sessionResult=await api.auth.getSession();
      var session=sessionResult&&sessionResult.data&&sessionResult.data.session;
      if(!session||!session.user)throw new Error('Du måste vara inloggad.');

      var result=await api.rpc('move_wishlist_to_collection',{
        p_wishlist_id:String(recordModel.entryId(record))
      });
      if(result.error)throw result.error;

      invalidateSearchState();
      await loadCollection();
      return true;
    }catch(error){
      log('error','Kunde inte flytta albumet till samlingen:',error);
      if(button){
        button.textContent=originalText;
        button.disabled=false;
      }
      onAlert('Kunde inte flytta albumet till samlingen.\n\n'+(error.message||error));
      return false;
    }
  }

  return Object.freeze({
    deleteCollection:deleteCollection,
    deleteCollectionRecords:deleteCollectionRecords,
    deleteWishlist:deleteWishlist,
    moveCollectionRecordsToShelf:moveCollectionRecordsToShelf,
    moveWishlistToCollection:moveWishlistToCollection
  });
}

return Object.freeze({create:create});
});
