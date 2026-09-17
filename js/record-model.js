(function(windowObject){
'use strict';
if(!windowObject)return;

var INDEX=Object.freeze({
  order:0, artist:1, title:2, year:3, genre:4,
  ownRating:5, coverUrl:6, sides:7, albumId:8, entryId:9,
  discogsMasterId:10, pressing:11, appleUrl:12, shelfId:13,
  shelfSortOrder:14, communityRating:15, communityCount:16
});

function value(record,name){
  var index=INDEX[name];
  return record&&index!==undefined?record[index]:undefined;
}

function setRatings(record,own,community,count){
  if(!record)return record;
  record[INDEX.ownRating]=own;
  record[INDEX.communityRating]=community;
  record[INDEX.communityCount]=count;
  return record;
}

function emptySides(){
  return {A:[],B:[],C:[],D:[],E:[],F:[],G:[],H:[]};
}

function fromWishlist(item,index){
  item=item||{};
  var album=item.albums||{};
  var sides=emptySides();
  if(Array.isArray(album.tracks)){
    album.tracks.sort(function(a,b){
      var sideCompare=String(a.disc_side||'').localeCompare(String(b.disc_side||''));
      return sideCompare||((a.track_number||0)-(b.track_number||0))||((a.id||0)-(b.id||0));
    }).forEach(function(track){
      if(!sides[track.disc_side])return;
      sides[track.disc_side].push({id:track.id,title:track.title||'Okänd låt',rating:0});
    });
  }
  return [
    (index||0)+1,
    album.artists&&album.artists.name?album.artists.name.replace(/\s*\(\d+\)$/,''):'Okänd artist',
    album.title||'Okänd titel',
    album.release_year||'',
    item.discogs_style||album.genre||'',
    0,
    item.cover_url||album.cover_url||'',
    sides,
    album.id,
    item.id,
    album.discogs_master_id||'',
    {},
    album.apple_collection_url||'',
    '',
    null
  ];
}

function fromCollection(item,index,pressingDetails){
  item=item||{};
  var album=item.albums||{};
  var sides=emptySides();
  if(Array.isArray(album.tracks)){
    album.tracks.sort(function(a,b){
      var sideCompare=String(a.disc_side||'').localeCompare(String(b.disc_side||''));
      return sideCompare||((a.track_number||0)-(b.track_number||0))||((a.id||0)-(b.id||0));
    }).forEach(function(track){
      var side=track.disc_side;
      if(!sides[side])return;
      sides[side].push({
        id:track.id,
        title:track.title||'Okänd låt',
        trackNumber:track.track_number==null?null:track.track_number,
        duration:track.duration||''
      });
    });
  }
  return [
    (index||0)+1,
    album.artists&&album.artists.name?album.artists.name.replace(/\s*\(\d+\)$/,''):'Okänd artist',
    album.title||'Okänd titel',
    album.release_year||'',
    item.discogs_style||album.genre||'',
    0,
    item.cover_url||album.cover_url||'',
    sides,
    album.id,
    item.id,
    album.discogs_master_id||'',
    pressingDetails||{},
    album.apple_collection_url||'',
    item.shelf_id||'',
    item.shelf_sort_order==null?null:item.shelf_sort_order,
    0,
    0
  ];
}

function applyRatingMeta(record,ratingMap){
  if(!record)return record;
  var albumId=value(record,'albumId');
  var meta=ratingMap&&ratingMap[albumId]?ratingMap[albumId]:{};
  return setRatings(
    record,
    meta&&meta.ownRating?meta.ownRating:0,
    meta&&meta.communityAverage?meta.communityAverage:0,
    meta&&meta.communityCount?meta.communityCount:0
  );
}

function trackDurationCacheKey(record){
  var album=value(record,'albumId');
  if(!album)return '';
  return 'groovy-track-durations:'+String(value(record,'discogsMasterId')||album);
}

function normalizedTrackTitle(value){
  return String(value||'')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[’‘]/g,"'")
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function applyTrackDurations(record,incomingTracks,overwriteExisting){
  var sides=value(record,'sides');
  if(!record||!sides||!Array.isArray(incomingTracks))return false;
  var changed=false;
  var byKey={};
  var bySideTitle={};
  var byTitle={};

  incomingTracks.forEach(function(track,index){
    var side=String(track.disc_side||'').toUpperCase();
    var number=track.track_number==null?'':String(track.track_number);
    var titleKey=normalizedTrackTitle(track.title);
    var indexed=Object.assign({__index:index},track);

    byKey[side+'|'+number]=indexed;
    if(titleKey){
      var sideTitleKey=side+'|'+titleKey;
      if(!bySideTitle[sideTitleKey])bySideTitle[sideTitleKey]=[];
      bySideTitle[sideTitleKey].push(indexed);
      if(!byTitle[titleKey])byTitle[titleKey]=[];
      byTitle[titleKey].push(indexed);
    }
  });

  Object.keys(sides).forEach(function(side){
    var tracks=sides[side];
    if(!Array.isArray(tracks))return;
    tracks.forEach(function(track,idx){
      var sideKey=String(side).toUpperCase();
      var key=sideKey+'|'+String(track.trackNumber==null?'':track.trackNumber);
      var titleKey=normalizedTrackTitle(track.title);
      var sameSideTitle=titleKey?bySideTitle[sideKey+'|'+titleKey]:null;
      var globalTitle=titleKey?byTitle[titleKey]:null;
      var match=byKey[key]||incomingTracks.find(function(candidate){
        return String(candidate.disc_side||'').toUpperCase()===sideKey&&
          Number(candidate.track_number||idx+1)===Number(track.trackNumber||idx+1);
      });

      if(!match&&sameSideTitle&&sameSideTitle.length===1)match=sameSideTitle[0];
      if(!match&&globalTitle&&globalTitle.length===1)match=globalTitle[0];
      if(!match)return;

      if(overwriteExisting||!track.duration){
        var nextDuration=String(match.duration||'').trim();
        if(nextDuration&&track.duration!==nextDuration){
          track.duration=nextDuration;
          changed=true;
        }
      }
    });
  });
  return changed;
}

function hasMissingTrackDurations(record){
  var sides=value(record,'sides')||{};
  return Object.keys(sides).some(function(side){
    return (sides[side]||[]).some(function(track){return !String(track&&track.duration||'').trim();});
  });
}

function compactShelfOrder(records,shelfId){
  if(!shelfId||!Array.isArray(records))return records;
  records
    .filter(function(record){return String(value(record,'shelfId')||'')===String(shelfId);})
    .sort(function(a,b){
      var aOrder=parseInt(value(a,'shelfSortOrder'),10);
      var bOrder=parseInt(value(b,'shelfSortOrder'),10);
      if(isNaN(aOrder))aOrder=2147483647;
      if(isNaN(bOrder))bOrder=2147483647;
      return aOrder-bOrder||(parseInt(value(a,'order'),10)||0)-(parseInt(value(b,'order'),10)||0);
    })
    .forEach(function(record,index){record[INDEX.shelfSortOrder]=index+1;});
  return records;
}

function nextShelfOrder(records,shelfId,excludedRecord){
  var highest=0;
  (records||[]).forEach(function(record){
    if(record===excludedRecord)return;
    if(String(value(record,'shelfId')||'')!==String(shelfId||''))return;
    highest=Math.max(highest,parseInt(value(record,'shelfSortOrder'),10)||0);
  });
  return highest+1;
}

var api={INDEX:INDEX,value:value,setRatings:setRatings,emptySides:emptySides,fromWishlist:fromWishlist,fromCollection:fromCollection,applyRatingMeta:applyRatingMeta,trackDurationCacheKey:trackDurationCacheKey,applyTrackDurations:applyTrackDurations,hasMissingTrackDurations:hasMissingTrackDurations,compactShelfOrder:compactShelfOrder,nextShelfOrder:nextShelfOrder};
Object.keys(INDEX).forEach(function(name){
  api[name]=function(record){return value(record,name);};
});

windowObject.GroovyRecord=Object.freeze(api);
})(typeof window!=='undefined'?window:null);
