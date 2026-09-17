(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyShelfCore=api;
})(typeof window!=='undefined'?window:null,function(){
  function palette(colors){
    return Array.isArray(colors)&&colors.length?colors:['#E85301'];
  }

  function normalizeColor(value,colors){
    var list=palette(colors);
    var candidate=String(value||'').toUpperCase();
    for(var i=0;i<list.length;i++){
      if(String(list[i]).toUpperCase()===candidate)return list[i];
    }
    return list[0];
  }

  function colorRgb(value,colors){
    var color=normalizeColor(value,colors).replace('#','');
    return parseInt(color.slice(0,2),16)+','+parseInt(color.slice(2,4),16)+','+parseInt(color.slice(4,6),16);
  }

  function colorStyle(shelf,colors){
    var color=normalizeColor(shelf&&shelf.color,colors);
    return '--shelf-color:'+color+';--shelf-rgb:'+colorRgb(color,colors)+';';
  }

  function findById(shelves,id){
    return (shelves||[]).find(function(shelf){return String(shelf.id)===String(id);})||null;
  }

  function recordCount(records,id){
    var list=records||[];
    if(id==='all')return list.length;
    return list.filter(function(record){return String(record&&record[13]||'')===String(id);}).length;
  }

  return Object.freeze({
    normalizeColor:normalizeColor,
    colorRgb:colorRgb,
    colorStyle:colorStyle,
    findById:findById,
    recordCount:recordCount
  });
});
