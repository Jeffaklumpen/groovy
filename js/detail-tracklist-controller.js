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

    function loadCachedDurations(record){
      var key=recordModel.trackDurationCacheKey(record);
      if(!key||!storage)return;
      try{
        var raw=storage.getItem(key);
        if(!raw)return;
        var parsed=JSON.parse(raw);
        if(!parsed||!Array.isArray(parsed.tracks))return;
        recordModel.applyTrackDurations(record,parsed.tracks,false);
      }catch(error){}
    }

    function persistDurations(record,tracks){
      var key=recordModel.trackDurationCacheKey(record);
      if(!key||!storage||!Array.isArray(tracks)||!tracks.length)return;
      try{
        storage.setItem(key,JSON.stringify({savedAt:now(),tracks:tracks}));
      }catch(error){}
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

      loadCachedDurations(record);
      if(getOpenRecordIndex()===index)render(record);

      if(!recordModel.hasMissingTrackDurations(record))return;
      var masterId=String(recordModel.discogsMasterId(record)||'').trim();
      if(!masterId)return;

      try{
        var result=await api.functions.invoke('discogs-search',{body:{action:'master',masterId:masterId}});
        var discogsData=result&&result.data?result.data:null;
        var discogsError=result&&result.error?result.error:null;
        if(discogsError)throw discogsError;

        var finalTracklist=Array.isArray(discogsData&&discogsData.tracklist)?discogsData.tracklist:[];
        var hasDiscSides=finalTracklist.some(function(track){
          var position=String(track&&track.position||'').toUpperCase();
          return /^[A-H]\d/.test(position);
        });

        if(!hasDiscSides){
          var vinylResult=await api.functions.invoke('discogs-search',{body:{action:'vinylRelease',masterId:masterId}});
          if(vinylResult&&vinylResult.data&&Array.isArray(vinylResult.data.tracklist)&&vinylResult.data.tracklist.length){
            finalTracklist=vinylResult.data.tracklist;
          }
        }

        var incoming=pressingCore.discogsTrackRows(recordModel.albumId(record),finalTracklist,true);
        if(!incoming.length)return;
        var changed=recordModel.applyTrackDurations(record,incoming,false);
        persistDurations(record,incoming);
        if(changed&&getOpenRecordIndex()===index)render(record);
      }catch(error){
        log('warn','Could not hydrate track durations:',error);
      }
    }

    return Object.freeze({
      openForRecord:openForRecord,
      render:render
    });
  }

  return Object.freeze({create:create});
});
