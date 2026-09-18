const test=require('node:test');
const assert=require('node:assert/strict');
const Controller=require('../js/album-rating-controller.js');
const RatingCore=require('../js/rating-core.js');

function makeRecordModel(){
  return {
    albumId(record){return record.albumId;},
    ownRating(record){return record.ownRating||0;},
    communityRating(record){return record.communityRating||0;},
    communityCount(record){return record.communityCount||0;},
    setRatings(record,own,community,count){
      record.ownRating=own;
      record.communityRating=community;
      record.communityCount=count;
      return record;
    }
  };
}

function makeDetailElement(){
  return {
    innerHTML:'',
    querySelectorAll(){return [];}
  };
}

test('loads own and community album ratings in one query',async()=>{
  const calls=[];
  const api={
    from(table){
      assert.equal(table,'album_ratings');
      return {
        select(columns){
          assert.equal(columns,'album_id,user_id,rating');
          return {
            async in(column,ids){
              calls.push({column,ids});
              return {data:[
                {album_id:1,user_id:'me',rating:4},
                {album_id:1,user_id:'other',rating:5},
                {album_id:2,user_id:'other',rating:3}
              ],error:null};
            }
          };
        }
      };
    }
  };
  const controller=Controller.create({api,ratingCore:RatingCore,recordModel:makeRecordModel()});
  const result=await controller.loadData([1,2,1],'me');
  assert.deepEqual(calls,[{column:'album_id',ids:[1,2]}]);
  assert.deepEqual(result[1],{ownRating:4,communityAverage:4.5,communityCount:2});
  assert.deepEqual(result[2],{ownRating:0,communityAverage:3,communityCount:1});
});

test('renders detail rating panels from named record fields',()=>{
  const record={albumId:1,ownRating:3,communityRating:4.5,communityCount:2};
  const detailElement=makeDetailElement();
  const controller=Controller.create({
    api:{from(){throw new Error('not used');}},
    ratingCore:RatingCore,
    recordModel:makeRecordModel(),
    detailElement,
    getRecords:()=>[record]
  });
  controller.renderDetail(0);
  assert.match(detailElement.innerHTML,/Your rating/);
  assert.match(detailElement.innerHTML,/Community rating/);
  assert.match(detailElement.innerHTML,/data-rating="3"/);
  assert.match(detailElement.innerHTML,/4\.5/);
  assert.match(detailElement.innerHTML,/groovy-score-max/);
  assert.match(detailElement.innerHTML,/>\/5<\/span>/);
  assert.match(detailElement.innerHTML,/2 ratings/);
});

test('saving a rating updates matching records and emits one rating event',async()=>{
  const records=[
    {albumId:10,ownRating:0,communityRating:4,communityCount:2},
    {albumId:10,ownRating:0,communityRating:4,communityCount:2},
    {albumId:11,ownRating:2,communityRating:2,communityCount:1}
  ];
  const upserts=[];
  const events=[];
  const api={
    auth:{async getUser(){return {data:{user:{id:'me'}},error:null};}},
    from(table){
      assert.equal(table,'album_ratings');
      return {
        async upsert(payload,options){
          upserts.push({payload,options});
          return {error:null};
        }
      };
    }
  };
  const controller=Controller.create({
    api,
    ratingCore:RatingCore,
    recordModel:makeRecordModel(),
    detailElement:makeDetailElement(),
    getRecords:()=>records,
    onRatingUpdated:detail=>events.push(detail)
  });

  assert.equal(await controller.save(0,5),true);
  assert.equal(records[0].ownRating,5);
  assert.equal(records[1].ownRating,5);
  assert.equal(records[0].communityRating,4.3);
  assert.equal(records[0].communityCount,3);
  assert.equal(records[2].ownRating,2);
  assert.deepEqual(upserts,[{
    payload:{user_id:'me',album_id:10,rating:5},
    options:{onConflict:'user_id,album_id'}
  }]);
  assert.deepEqual(events,[{albumId:10,index:0,source:'save'}]);
});

test('existing own rating changes average without increasing community count',async()=>{
  const records=[{albumId:10,ownRating:2,communityRating:3,communityCount:4}];
  const api={
    auth:{async getUser(){return {data:{user:{id:'me'}},error:null};}},
    from(){return {async upsert(){return {error:null};}};}
  };
  const controller=Controller.create({
    api,
    ratingCore:RatingCore,
    recordModel:makeRecordModel(),
    detailElement:makeDetailElement(),
    getRecords:()=>records
  });
  await controller.save(0,4);
  assert.equal(records[0].communityCount,4);
  assert.equal(records[0].communityRating,3.5);
});

test('static star meter preserves compact fill markup',()=>{
  const controller=Controller.create({
    api:{from(){throw new Error('not used');}},
    ratingCore:RatingCore,
    recordModel:makeRecordModel()
  });
  const html=controller.renderStaticStarMeter(2.5,'is-compact');
  assert.match(html,/--rating-fill:50\.0%/);
  assert.match(html,/is-compact/);
  assert.match(html,/2\.5 out of 5/);
});
