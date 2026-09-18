(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyCommunityCore=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';

function number(value){
  var parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

function formatCount(value){
  var numeric=number(value);
  if(Math.abs(numeric)<1000)return String(Math.round(numeric));
  try{
    return new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:numeric>=10000?0:1}).format(numeric);
  }catch(error){
    if(numeric>=1000000)return (numeric/1000000).toFixed(numeric>=10000000?0:1).replace(/\.0$/,'')+'M';
    return (numeric/1000).toFixed(numeric>=10000?0:1).replace(/\.0$/,'')+'K';
  }
}

function relativeTime(value,nowValue){
  var timestamp=Date.parse(value||'');
  if(!Number.isFinite(timestamp))return '';
  var now=nowValue==null?Date.now():Number(nowValue);
  var seconds=Math.max(0,Math.floor((now-timestamp)/1000));
  if(seconds<60)return 'Just now';
  var minutes=Math.floor(seconds/60);
  if(minutes<60)return minutes+'m ago';
  var hours=Math.floor(minutes/60);
  if(hours<24)return hours+'h ago';
  var days=Math.floor(hours/24);
  if(days<7)return days+'d ago';
  try{return new Date(timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  catch(error){return '';}
}

function clampRating(value){
  var numeric=number(value);
  if(numeric<1)return 0;
  if(numeric>5)return 5;
  return Math.round(numeric*10)/10;
}

function normalizeOverview(data){
  data=data&&typeof data==='object'?data:{};
  var summary=data.summary&&typeof data.summary==='object'?data.summary:{};
  return {
    summary:{
      collectors:number(summary.collectors),
      records:number(summary.records),
      connections:number(summary.connections)
    },
    similar_collectors:Array.isArray(data.similar_collectors)?data.similar_collectors:[],
    activity:Array.isArray(data.activity)?data.activity:[],
    top_collectors:Array.isArray(data.top_collectors)?data.top_collectors:[],
    top_rated_albums:Array.isArray(data.top_rated_albums)?data.top_rated_albums:[],
    most_collected_albums:Array.isArray(data.most_collected_albums)?data.most_collected_albums:[],
    most_collected_artists:Array.isArray(data.most_collected_artists)?data.most_collected_artists:[],
    most_wishlisted_albums:Array.isArray(data.most_wishlisted_albums)?data.most_wishlisted_albums:[]
  };
}

return Object.freeze({
  number:number,
  formatCount:formatCount,
  relativeTime:relativeTime,
  clampRating:clampRating,
  normalizeOverview:normalizeOverview
});
});
