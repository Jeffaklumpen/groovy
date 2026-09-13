(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyStatistics=api;
})(typeof window!=='undefined'?window:null,function(){
  function clean(value){return String(value||'').trim();}

  function artistName(album){
    var artist=album&&album.artists;
    if(Array.isArray(artist))artist=artist[0];
    return clean(artist&&artist.name).replace(/\s*\(\d+\)$/,'')||'Unknown artist';
  }

  function ranked(counts){
    return Object.keys(counts).map(function(label){return {label:label,count:counts[label]};})
      .sort(function(a,b){return b.count-a.count||a.label.localeCompare(b.label);});
  }

  function increment(counts,label){
    label=clean(label);
    if(label)counts[label]=(counts[label]||0)+1;
  }

  function build(collectionRows,wishlistCount,albumRatings){
    var rows=(collectionRows||[]).filter(function(row){return row&&row.albums;});
    var styles={};
    var artists={};
    var decades={};
    var conditions={};
    var countries={};
    var years=[];
    var identifiedPressings=0;
    var albumIds={};

    rows.forEach(function(row){
      var album=row.albums;
      var year=parseInt(album.release_year,10);
      if(album.id!==undefined&&album.id!==null)albumIds[String(album.id)]=true;

      increment(artists,artistName(album));

      clean(row.discogs_style||album.genre).split(/\s*·\s*|\s*,\s*/).forEach(function(style){
        increment(styles,style);
      });

      if(year>=1800&&year<=new Date().getFullYear()+1){
        years.push({year:year,row:row});
        increment(decades,String(Math.floor(year/10)*10)+'s');
      }

      if(row.discogs_release_id)identifiedPressings++;
      increment(conditions,row.media_condition);
      increment(countries,row.pressing_country);
    });

    years.sort(function(a,b){return a.year-b.year;});
    var ratingValues=(albumRatings||[]).filter(function(item){return item&&albumIds[String(item.album_id)];}).map(function(item){return Number(item.rating)||0;}).filter(function(value){return value>0;});
    var ratingTotal=ratingValues.reduce(function(sum,value){return sum+value;},0);

    function release(entry){
      if(!entry)return null;
      var album=entry.row.albums;
      return {
        year:entry.year,
        title:clean(album.title)||'Untitled',
        artist:artistName(album),
        cover:clean(entry.row.cover_url||album.cover_url)
      };
    }

    return {
      collectionCount:rows.length,
      wishlistCount:Number(wishlistCount)||0,
      artistCount:Object.keys(artists).length,
      oldest:release(years[0]),
      newest:release(years[years.length-1]),
      yearSpan:years.length?years[years.length-1].year-years[0].year:0,
      topStyles:ranked(styles).slice(0,5),
      topArtists:ranked(artists).slice(0,5),
      topDecades:ranked(decades).slice(0,5),
      averageAlbumRating:ratingValues.length?ratingTotal/ratingValues.length:0,
      ratedAlbums:ratingValues.length,
      fiveStarAlbums:ratingValues.filter(function(value){return value===5;}).length,
      identifiedPressings:identifiedPressings,
      pressingCompletion:rows.length?Math.round(identifiedPressings/rows.length*100):0,
      conditions:ranked(conditions),
      topCountries:ranked(countries).slice(0,5)
    };
  }

  return {build:build};
});
