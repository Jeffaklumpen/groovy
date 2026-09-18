(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyLibraryData=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

var COLLECTION_SELECT=`
  id,
  collection_number,
  sort_order,
  shelf_id,
  shelf_sort_order,
  cover_url,
  discogs_style,
  discogs_release_id,
  media_condition,
  sleeve_condition,
  pressing_country,
  pressing_year,
  pressing_label,
  catalog_number,
  matrix_runout_a,
  matrix_runout_b,
  matrix_runout_c,
  matrix_runout_d,
  matrix_runout_e,
  matrix_runout_f,
  matrix_runout_g,
  matrix_runout_h,
  pressing_match_status,
  albums(
    id,
    title,
    release_year,
    genre,
    cover_url,
    apple_collection_url,
    discogs_master_id,
    artists(
      id,
      name
    ),
    tracks(
      id,
      disc_side,
      track_number,
      title,
      duration
    )
  )
`;

var WISHLIST_SELECT=`
  id,
  added_at,
  sort_order,
  cover_url,
  discogs_style,
  albums(
    id,
    title,
    release_year,
    genre,
    cover_url,
    apple_collection_url,
    discogs_master_id,
    artists(id,name),
    tracks(id,disc_side,track_number,title,duration)
  )
`;

function create(options){
  options=options||{};
  var api=options.api;
  var recordModel=options.recordModel;

  if(!api||typeof api.from!=='function')throw new Error('Library data requires Supabase');
  if(!recordModel||typeof recordModel.fromCollection!=='function')throw new Error('Library data requires record model');

  function copyDetailsFromRow(item){
    item=item||{};
    return {
      discogsReleaseId:item.discogs_release_id||null,
      mediaCondition:item.media_condition||'',
      sleeveCondition:item.sleeve_condition||'',
      country:item.pressing_country||'',
      year:item.pressing_year||'',
      label:item.pressing_label||'',
      catalogNumber:item.catalog_number||'',
      matrixA:item.matrix_runout_a||'',
      matrixB:item.matrix_runout_b||'',
      matrixC:item.matrix_runout_c||'',
      matrixD:item.matrix_runout_d||'',
      matrixE:item.matrix_runout_e||'',
      matrixF:item.matrix_runout_f||'',
      matrixG:item.matrix_runout_g||'',
      matrixH:item.matrix_runout_h||'',
      matchStatus:item.pressing_match_status||''
    };
  }

  async function fetchCollection(userId){
    var result=await api
      .from('collections')
      .select(COLLECTION_SELECT)
      .eq('user_id',userId)
      .order('sort_order',{ascending:true});

    return {
      data:result&&Array.isArray(result.data)?result.data:[],
      error:result?result.error:null
    };
  }

  async function fetchWishlist(userId){
    var result=await api
      .from('wishlists')
      .select(WISHLIST_SELECT)
      .eq('user_id',userId)
      .order('sort_order',{ascending:true,nullsFirst:false})
      .order('added_at',{ascending:true});

    return {
      data:result&&Array.isArray(result.data)?result.data:[],
      error:result?result.error:null
    };
  }

  function mapWishlistRows(rows,ratingMeta){
    return (rows||[])
      .filter(function(item){return item&&item.albums;})
      .map(function(item,index){
        return recordModel.applyRatingMeta(
          recordModel.fromWishlist(item,index),
          ratingMeta
        );
      });
  }

  function albumIds(rows){
    return (rows||[])
      .map(function(item){return item&&item.albums&&item.albums.id;})
      .filter(Boolean);
  }

  function mapCollectionRows(rows,ratingMeta){
    return (rows||[])
      .filter(function(item){return item&&item.albums;})
      .map(function(item,index){
        return recordModel.applyRatingMeta(
          recordModel.fromCollection(item,index,copyDetailsFromRow(item)),
          ratingMeta
        );
      });
  }

  return Object.freeze({
    fetchCollection:fetchCollection,
    fetchWishlist:fetchWishlist,
    mapWishlistRows:mapWishlistRows,
    albumIds:albumIds,
    mapCollectionRows:mapCollectionRows,
    copyDetailsFromRow:copyDetailsFromRow
  });
}

return Object.freeze({
  create:create,
  COLLECTION_SELECT:COLLECTION_SELECT,
  WISHLIST_SELECT:WISHLIST_SELECT
});
});
