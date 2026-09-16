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

var api={INDEX:INDEX,value:value,setRatings:setRatings};
Object.keys(INDEX).forEach(function(name){
  api[name]=function(record){return value(record,name);};
});

windowObject.GroovyRecord=Object.freeze(api);
})(typeof window!=='undefined'?window:null);
