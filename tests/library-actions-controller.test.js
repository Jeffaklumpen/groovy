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

test('moveWishlistToCollection inserts at the end then removes wishlist row',async()=>{
  const records=[[1,'A','One',2020,'Prog',0,'cover.jpg',{},99,'wish-1']];
  const operations=[];
  const api={
    auth:{async getUser(){return {data:{user:{id:'user-1'}},error:null};}},
    from(table){
      if(table==='collections'){
        return {
          select(column){
            if(column==='id'){
              return {
                eq(){return this;},
                limit(){operations.push('check-existing');return Promise.resolve({data:[],error:null});}
              };
            }
            if(column==='sort_order'){
              return {
                eq(){return this;},
                order(){return this;},
                limit(){operations.push('last-sort');return Promise.resolve({data:[{sort_order:7}],error:null});}
              };
            }
            throw new Error('unexpected select '+column);
          },
          async insert(payload){operations.push({insert:payload});return {error:null};}
        };
      }
      if(table==='wishlists'){
        return {
          delete(){
            return {
              error:null,
              eq(column,value){operations.push(['delete-eq',column,value]);return this;}
            };
          }
        };
      }
      throw new Error('unexpected table '+table);
    }
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
  assert.deepEqual(operations[0],'check-existing');
  assert.deepEqual(operations[1],'last-sort');
  assert.deepEqual(operations[2],{insert:{
    user_id:'user-1',
    album_id:99,
    cover_url:'cover.jpg',
    discogs_style:'Prog',
    sort_order:8
  }});
  assert.deepEqual(operations.slice(3),[
    ['delete-eq','id','wish-1'],
    ['delete-eq','user_id','user-1']
  ]);
  assert.equal(invalidated,1);
  assert.equal(reloaded,1);
});

test('moveWishlistToCollection does not insert duplicate collection membership',async()=>{
  const records=[[1,'A','One',2020,'Rock',0,'',{},99,'wish-1']];
  let insertCalls=0;
  const api={
    auth:{async getUser(){return {data:{user:{id:'user-1'}},error:null};}},
    from(table){
      if(table==='collections'){
        return {
          select(){
            return {
              eq(){return this;},
              limit(){return Promise.resolve({data:[{id:'already-there'}],error:null});}
            };
          },
          async insert(){insertCalls++;return {error:null};}
        };
      }
      return {
        delete(){return {error:null,eq(){return this;}};}
      };
    }
  };
  const controller=Controller.create({
    api,recordModel:recordModel(),getRecords:()=>records,getViewedUserId:()=>null,
    getLibraryView:()=> 'wishlist',loadCollection:async()=>{}
  });
  assert.equal(await controller.moveWishlistToCollection(0,{textContent:'Move',disabled:false}),true);
  assert.equal(insertCalls,0);
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
