(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory();
  }else{
    root.GroovyDetailTracklistController=factory();
  }
})(typeof window!=='undefined'?window:null,function(){
  function create(options){
    options=options||{};

    var api=options.api;
    var recordModel=options.recordModel;
    var pressingCore=options.pressingCore;
    var element=options.element||null;
    var storage=options.storage||((typeof localStorage!=='undefined')?localStorage:null);
    var escapeHtml=typeof options.escapeHtml==='function'?options.escapeHtml:function(value){
      return String(value==null?'':value)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    };
    var getOpenRecordIndex=typeof options.getOpenRecordIndex==='function'?options.getOpenRecordIndex:function(){return -1;};
    var now=typeof options.now==='function'?options.now:Date.now;
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};

    if(!api||!api.functions||typeof api.functions.invoke!=='function')throw new Error('Detail tracklist controller requires Supabase functions');
    if(!recordModel)throw new Error('Detail tracklist controller requires a record model');
    if(!pressingCore||typeof pressingCore.discogsTrackRows!=='function')throw new Error('Detail tracklist controller requires pressing core');

    function log(level,message,error){onLog(level,message,error);}

    function mergeDurationRows(existing,incoming){
      var merged={};

      function remember(track){
        if(!track)return;
        var side=String(track.disc_side||'').toUpperCase();
        var number=track.track_number==null?'':String(track.track_number);
        if(!side||!number)return;
        var key=side+'|'+number;
        var current=merged[key];
        var duration=String(track.duration||'').trim();

        if(!current){
          merged[key]=Object.assign({},track,{duration:duration});
          return;
        }

        if(!String(current.duration||'').trim()&&duration){
          merged[key]=Object.assign({},current,track,{duration:duration});
        }
      }

      (Array.isArray(existing)?existing:[]).forEach(remember);
      (Array.isArray(incoming)?incoming:[]).forEach(remember);
      return Object.keys(merged).map(function(key){return merged[key];});
    }

    function loadCachedDurations(record){
      var key=recordModel.trackDurationCacheKey(record);
      if(!key||!storage)return [];
      try{
        var raw=storage.getItem(key);
        if(!raw)return [];
        var parsed=JSON.parse(raw);
        if(!parsed||!Array.isArray(parsed.tracks))return [];
        recordModel.applyTrackDurations(record,parsed.tracks,false);
        return parsed.tracks;
      }catch(error){}
      return [];
    }

    function persistDurations(record,tracks){
      var key=recordModel.trackDurationCacheKey(record);
      if(!key||!storage||!Array.isArray(tracks)||!tracks.length)return;
      try{
        storage.setItem(key,JSON.stringify({savedAt:now(),tracks:tracks}));
      }catch(error){}
    }

    function exactReleaseId(record){
      var pressing=typeof recordModel.pressing==='function'?recordModel.pressing(record):null;
      return String(pressing&&pressing.discogsReleaseId||'').trim();
    }

    async function fetchTracklist(action,id){
      try{
        var body={action:action};
        if(action==='release')body.releaseId=id;
        else body.masterId=id;
        var result=await api.functions.invoke('discogs-search',{body:body});
        if(result&&result.error)throw result.error;
        var data=result&&result.data?result.data:null;
        return Array.isArray(data&&data.tracklist)?data.tracklist:[];
      }catch(error){
        log('warn','Could not load Discogs '+action+' tracklist:',error);
        return [];
      }
    }

    function applyTracklist(record,tracklist,rows){
      if(!Array.isArray(tracklist)||!tracklist.length)return {changed:false,rows:rows};
      var incoming=pressingCore.discogsTrackRows(recordModel.albumId(record),tracklist,true);
      if(!incoming.length)return {changed:false,rows:rows};
      return {
        changed:recordModel.applyTrackDurations(record,incoming,false),
        rows:mergeDurationRows(rows,incoming)
      };
    }

    function render(record){
      if(!element)return;
      var sides=recordModel.sides(record)||{};
      var sideNames=['A','B','C','D','E','F','G','H'];
      var html='';

      for(var i=0;i<sideNames.length;i++){
        var side=sideNames[i];
        var tracks=sides[side];
        if(!tracks||!tracks.length)continue;

        html+='<section class="track-side">'+
          '<div class="side-title"><span>SIDE</span>'+side+'</div>'+
          '<ol class="tracks-list">';

        for(var j=0;j<tracks.length;j++){
          var track=tracks[j]||{};
          var title=track.title||'Okänd låt';
          var number=track.trackNumber==null?String(j+1).padStart(2,'0'):String(track.trackNumber).padStart(2,'0');
          var duration=String(track.duration||'').trim();
          html+='<li data-track-id="'+escapeHtml(track.id||'')+'">'+
            '<span class="track-index">'+escapeHtml(number)+'</span>'+
            '<span class="track-title">'+escapeHtml(title)+'</span>'+
            '<span class="track-duration">'+escapeHtml(duration||'—')+'</span>'+
          '</li>';
        }

        html+='</ol></section>';
      }

      element.innerHTML=html||'<div style="color:#666;font-size:13px">Ingen låtlista tillagd</div>';
    }

    async function openForRecord(record,index){
      render(record);
      if(!recordModel.albumId(record))return;

      var durationRows=loadCachedDurations(record);
      if(getOpenRecordIndex()===index)render(record);
      if(!recordModel.hasMissingTrackDurations(record))return;

      var releaseId=exactReleaseId(record);
      var masterId=String(recordModel.discogsMasterId(record)||'').trim();

      if(releaseId){
        var releaseTracklist=await fetchTracklist('release',releaseId);
        var releaseResult=applyTracklist(record,releaseTracklist,durationRows);
        durationRows=releaseResult.rows;
        if(releaseResult.changed&&getOpenRecordIndex()===index)render(record);
      }

      if(recordModel.hasMissingTrackDurations(record)&&masterId){
        var masterTracklist=await fetchTracklist('master',masterId);
        var masterResult=applyTracklist(record,masterTracklist,durationRows);
        durationRows=masterResult.rows;
        if(masterResult.changed&&getOpenRecordIndex()===index)render(record);
      }

      if(recordModel.hasMissingTrackDurations(record)&&masterId){
        var vinylTracklist=await fetchTracklist('vinylRelease',masterId);
        var vinylResult=applyTracklist(record,vinylTracklist,durationRows);
        durationRows=vinylResult.rows;
        if(vinylResult.changed&&getOpenRecordIndex()===index)render(record);
      }

      if(durationRows.length)persistDurations(record,durationRows);
    }

    return Object.freeze({
      openForRecord:openForRecord,
      render:render
    });
  }

  return Object.freeze({create:create});
});
