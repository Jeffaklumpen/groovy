(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyRatingCore=api;
})(typeof window!=='undefined'?window:null,function(){
  function clamp(value){
    var numeric=Number(value);
    if(!isFinite(numeric))numeric=0;
    return Math.max(0,Math.min(5,numeric));
  }

  function format(value){
    var numeric=clamp(value);
    if(!numeric)return '—';
    var rounded=Math.round(numeric*10)/10;
    return Number.isInteger(rounded)?String(rounded.toFixed(0)):String(rounded.toFixed(1));
  }

  function fillPercent(value){
    return (clamp(value)/5*100).toFixed(1)+'%';
  }

  return Object.freeze({clamp:clamp,format:format,fillPercent:fillPercent});
});
