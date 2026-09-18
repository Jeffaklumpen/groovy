(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyArtistCore=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  function number(value){
    var parsed=Number(value);
    return Number.isFinite(parsed)?parsed:0;
  }

  function formatCount(value){
    var amount=number(value);
    return amount.toLocaleString('en-US');
  }

  function slugify(value){
    var text=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return text.replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'artist';
  }

  function route(id,name){
    var numericId=number(id);
    if(!numericId)return '';
    return '/artist/'+numericId+'-'+slugify(name);
  }

  function normalizeOverview(raw){
    raw=raw||{};
    var summary=raw.summary||{};
    return {
      summary:{
        artist_id:summary.artist_id||null,
        name:String(summary.name||''),
        discogs_artist_id:summary.discogs_artist_id||null,
        collected_records:number(summary.collected_records),
        collectors:number(summary.collectors),
        wishlisted_records:number(summary.wishlisted_records),
        groovy_albums:number(summary.groovy_albums)
      },
      genres:Array.isArray(raw.genres)?raw.genres.filter(Boolean).slice(0,4):[],
      discography:Array.isArray(raw.discography)?raw.discography:[],
      discography_verified:!!raw.discography_verified,
      discography_source:String(raw.discography_source||'unchecked')
    };
  }

  return Object.freeze({
    number:number,
    formatCount:formatCount,
    slugify:slugify,
    route:route,
    normalizeOverview:normalizeOverview
  });
});
