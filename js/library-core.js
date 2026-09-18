(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyLibraryCore=api;
})(typeof window!=='undefined'?window:null,function(){
  function filterRecords(records,options){
    var list=Array.isArray(records)?records:[];
    var opts=options||{};
    var query=String(opts.query||'').toLocaleLowerCase();
    var selectedRating=opts.selectedRating==null?'all':String(opts.selectedRating);
    var isWishlist=!!opts.isWishlist;

    return list.filter(function(record){
      var rating=parseInt(record[5],10);
      var matchesRating=isWishlist||selectedRating==='all'||rating===parseInt(selectedRating,10);
      var matchesSearch=!query||[record[1],record[2],record[3],record[4]].join(' ').toLocaleLowerCase().indexOf(query)!==-1;
      return matchesRating&&matchesSearch;
    });
  }

  function sortRecords(records,options){
    var list=Array.isArray(records)?records.slice():[];
    var opts=options||{};
    var sort=String(opts.sort||'standard');
    var isWishlist=!!opts.isWishlist;
    var activeShelfId=opts.activeShelfId==null?'all':opts.activeShelfId;

    return list.sort(function(a,b){
      if(sort==='album-asc')return String(a[2]||'').localeCompare(String(b[2]||''),undefined,{sensitivity:'base'});
      if(sort==='album-desc')return String(b[2]||'').localeCompare(String(a[2]||''),undefined,{sensitivity:'base'});
      if(sort==='artist-asc')return String(a[1]||'').localeCompare(String(b[1]||''),undefined,{sensitivity:'base'});
      if(sort==='artist-desc')return String(b[1]||'').localeCompare(String(a[1]||''),undefined,{sensitivity:'base'});
      if(sort==='year-desc')return (parseInt(b[3],10)||0)-(parseInt(a[3],10)||0);
      if(sort==='year-asc')return (parseInt(a[3],10)||9999)-(parseInt(b[3],10)||9999);
      if(sort==='date-added'){
        var aAdded=Date.parse(a[17]||'')||0;
        var bAdded=Date.parse(b[17]||'')||0;
        return bAdded-aAdded||(parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);
      }
      if(!isWishlist&&activeShelfId!=='all'){
        var aShelfOrder=parseInt(a[14],10);
        var bShelfOrder=parseInt(b[14],10);
        if(isNaN(aShelfOrder))aShelfOrder=2147483647;
        if(isNaN(bShelfOrder))bShelfOrder=2147483647;
        return aShelfOrder-bShelfOrder||(parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);
      }
      return (parseInt(a[0],10)||0)-(parseInt(b[0],10)||0);
    });
  }

  return Object.freeze({
    filterRecords:filterRecords,
    sortRecords:sortRecords
  });
});
