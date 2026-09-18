const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/library-actions-controller.js');

function recordModel(){
  const INDEX={order:0};
  return {
    INDEX,
    order(record){return record[0];},
    albumId(record){return record[8];},
    entryId(record){return record[9];},
    shelfId(record){return record[13];},
    coverUrl(record){return record[6];},
    genre(record){return record[4];},
    compactShelfOrder(records,shelfId){
      records
        .filter(record=>record[13]===shelfId)
        .sort((a,b)=>(a[14]||0)-(b[14]||0))
        .forEach((record,index)=>{record[14]=index+1;});
    }
  };
}

function queryResult(result){
  return {
    _eqs:[],
    eq(column,value){this._eqs.push([column,value]);return this;},
    order(){return this;},
    limit(){return Promise.resolve(result);},
    select(){return Promise.resolve(result);}
  };
}

test('deleteCollection removes the record, compacts order and rerenders',async()=>{
  const records=[
    [1,'A','One',2020,'Rock',0,'',{},1,'entry-1',null,{},null,'shelf-1',1],
    [2,'A','Two',2021,'Rock',0,'',{},2,'entry-2',null,{},null,'shelf-1',2]
  ];
  const calls={invalidated:0,page:0,shelves:0,grid:0};
  const api={
    auth:{async getSession(){return {data:{session:{user:{id:'user-1'}}}};}},
    from(){throw new Error('not used');},
    async rpc(name,payload){
      assert.equal(name,'delete_collection_record');
      assert.deepEqual(payload,{p_collection_id:'entry-1'});
      return {error:null};
    }
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>records,getViewedUserId:()=>null,
    invalidateSearchState:()=>calls.invalidated++,resetPage:()=>calls.page++,
    renderShelfStrip:()=>calls.shelves++,renderGrid:()=>calls.grid++
  });

  assert.equal(await controller.deleteCollection(0),true);
  assert.equal(records.length,1);
  assert.equal(records[0][0],1);
  assert.equal(records[0][14],1);
  assert.deepEqual(calls,{invalidated:1,page:1,shelves:1,grid:1});
});

test('deleteWishlist removes only the current users wishlist row then reloads',async()=>{
  const records=[[1,'A','One',2020,'Rock',0,'',{},1,'wish-1']];
  let deleted=null;
  let invalidated=0;
  let reloaded=0;
  const api={
    auth:{async getUser(){return {data:{user:{id:'user-1'}},error:null};}},
    from(table){
      assert.equal(table,'wishlists');
      return {
        delete(){
          const chain=queryResult({data:[{id:'wish-1'}],error:null});
          const originalSelect=chain.select.bind(chain);
          chain.select=async function(){
            deleted=this._eqs.slice();
            return originalSelect();
          };
          return chain;
        }
      };
    }
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>records,getViewedUserId:()=>null,
    getLibraryView:()=> 'wishlist',invalidateSearchState:()=>invalidated++,
    loadCollection:async()=>{reloaded++;}
  });

  assert.equal(await controller.deleteWishlist(0),true);
  assert.deepEqual(deleted,[['id','wish-1'],['user_id','user-1']]);
  assert.equal(invalidated,1);
  assert.equal(reloaded,1);
});

test('moveWishlistToCollection delegates the whole transition to one atomic RPC',async()=>{
  const records=[[1,'A','One',2020,'Prog',0,'cover.jpg',{},99,'wish-1']];
  const calls=[];
  const api={
    auth:{async getSession(){return {data:{session:{user:{id:'user-1'}}}};}},
    from(){throw new Error('move must not issue direct table writes');},
    async rpc(name,payload){calls.push({name,payload});return {data:{status:'collection',inserted:true},error:null};}
  };
  let invalidated=0;
  let reloaded=0;
  const button={textContent:'Move to collection',disabled:false};
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>records,getViewedUserId:()=>null,
    getLibraryView:()=> 'wishlist',invalidateSearchState:()=>invalidated++,
    loadCollection:async()=>{reloaded++;}
  });

  assert.equal(await controller.moveWishlistToCollection(0,button),true);
  assert.deepEqual(calls,[{name:'move_wishlist_to_collection',payload:{p_wishlist_id:'wish-1'}}]);
  assert.equal(invalidated,1);
  assert.equal(reloaded,1);
});

test('moveWishlistToCollection restores the button when the atomic RPC fails',async()=>{
  const records=[[1,'A','One',2020,'Rock',0,'',{},99,'wish-1']];
  const alerts=[];
  const api={
    auth:{async getSession(){return {data:{session:{user:{id:'user-1'}}}};}},
    from(){throw new Error('not used');},
    async rpc(){return {error:new Error('move failed')};}
  };
  const button={textContent:'Move',disabled:false};
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>records,getViewedUserId:()=>null,
    getLibraryView:()=> 'wishlist',loadCollection:async()=>{},onAlert:message=>alerts.push(message)
  });
  assert.equal(await controller.moveWishlistToCollection(0,button),false);
  assert.equal(button.textContent,'Move');
  assert.equal(button.disabled,false);
  assert.equal(alerts.length,1);
});

test('mutations are blocked while viewing another users library',async()=>{
  const api={
    auth:{getSession(){throw new Error('should not authenticate');},getUser(){throw new Error('should not authenticate');}},
    from(){throw new Error('should not query');}
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>[[1]],getViewedUserId:()=> 'other-user',
    getLibraryView:()=> 'wishlist'
  });
  assert.equal(await controller.deleteCollection(0),false);
  assert.equal(await controller.deleteWishlist(0),false);
  assert.equal(await controller.moveWishlistToCollection(0,{textContent:'Move',disabled:false}),false);
});


test('bulk collection delete delegates to one atomic RPC and reloads',async()=>{
  const calls=[];let reloads=0;let invalidated=0;
  const api={
    auth:{async getSession(){return {data:{session:{user:{id:'user-1'}}}};}},
    from(){throw new Error('not used');},
    async rpc(name,payload){calls.push({name,payload});return {data:2,error:null};}
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>[],getViewedUserId:()=>null,getLibraryView:()=> 'collection',
    invalidateSearchState:()=>invalidated++,loadCollection:async()=>{reloads++;}
  });
  assert.equal(await controller.deleteCollectionRecords(['entry-2','entry-1','entry-2']),true);
  assert.deepEqual(calls,[{name:'delete_collection_records',payload:{p_collection_ids:['entry-2','entry-1']}}]);
  assert.equal(invalidated,1);
  assert.equal(reloads,1);
});

test('bulk shelf move delegates to one atomic RPC and reloads',async()=>{
  const calls=[];let reloads=0;
  const api={
    auth:{async getSession(){return {data:{session:{user:{id:'user-1'}}}};}},
    from(){throw new Error('not used');},
    async rpc(name,payload){calls.push({name,payload});return {data:2,error:null};}
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>[],getViewedUserId:()=>null,getLibraryView:()=> 'collection',
    loadCollection:async()=>{reloads++;}
  });
  assert.equal(await controller.moveCollectionRecordsToShelf(['entry-1','entry-2'],'shelf-9'),true);
  assert.deepEqual(calls,[{name:'move_collection_records_to_shelf',payload:{p_collection_ids:['entry-1','entry-2'],p_shelf_id:'shelf-9'}}]);
  assert.equal(reloads,1);
});

test('bulk collection mutations are blocked outside the owners collection',async()=>{
  const api={
    auth:{getSession(){throw new Error('should not authenticate');}},
    from(){throw new Error('should not query');}
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>[],getViewedUserId:()=> 'other-user',getLibraryView:()=> 'collection'
  });
  assert.equal(await controller.deleteCollectionRecords(['entry-1']),false);
  assert.equal(await controller.moveCollectionRecordsToShelf(['entry-1'],'shelf-1'),false);
});


test('bulk wishlist delete delegates to one atomic RPC and reloads',async()=>{
  const calls=[];let reloads=0;let invalidated=0;
  const api={
    auth:{async getSession(){return {data:{session:{user:{id:'user-1'}}}};}},
    from(){throw new Error('not used');},
    async rpc(name,payload){calls.push({name,payload});return {data:2,error:null};}
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>[],getViewedUserId:()=>null,getLibraryView:()=> 'wishlist',
    invalidateSearchState:()=>invalidated++,loadCollection:async()=>{reloads++;}
  });
  assert.equal(await controller.deleteWishlistRecords(['wish-2','wish-1','wish-2']),true);
  assert.deepEqual(calls,[{name:'delete_wishlist_records',payload:{p_wishlist_ids:['wish-2','wish-1']}}]);
  assert.equal(invalidated,1);
  assert.equal(reloads,1);
});

test('bulk wishlist add-to-collection delegates to one atomic RPC and reloads',async()=>{
  const calls=[];let reloads=0;let invalidated=0;
  const api={
    auth:{async getSession(){return {data:{session:{user:{id:'user-1'}}}};}},
    from(){throw new Error('not used');},
    async rpc(name,payload){calls.push({name,payload});return {data:2,error:null};}
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>[],getViewedUserId:()=>null,getLibraryView:()=> 'wishlist',
    invalidateSearchState:()=>invalidated++,loadCollection:async()=>{reloads++;}
  });
  assert.equal(await controller.moveWishlistRecordsToCollection(['wish-1','wish-2']),true);
  assert.deepEqual(calls,[{name:'move_wishlist_records_to_collection',payload:{p_wishlist_ids:['wish-1','wish-2']}}]);
  assert.equal(invalidated,1);
  assert.equal(reloads,1);
});

test('bulk wishlist mutations are blocked outside the owners wishlist',async()=>{
  const api={
    auth:{getSession(){throw new Error('should not authenticate');}},
    from(){throw new Error('should not query');}
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>[],getViewedUserId:()=> 'other-user',getLibraryView:()=> 'wishlist'
  });
  assert.equal(await controller.deleteWishlistRecords(['wish-1']),false);
  assert.equal(await controller.moveWishlistRecordsToCollection(['wish-1']),false);
});
