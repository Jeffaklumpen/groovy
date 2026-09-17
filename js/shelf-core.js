(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyShelfCore=api;
})(typeof window!=='undefined'?window:null,function(){
  var SHELF_ICON_OPTIONS=[
    {id:'record',label:'Vinyl'},
    {id:'heart',label:'Heart'},
    {id:'music',label:'Music note'},
    {id:'star',label:'Star'},
    {id:'bookmark',label:'Bookmark'},
    {id:'headphones',label:'Headphones'},
    {id:'guitar',label:'Electric guitar'},
    {id:'bolt',label:'Lightning'},
    {id:'flame',label:'Fire'},
    {id:'crown',label:'Crown'},
    {id:'coffee',label:'Coffee'},
    {id:'leaf',label:'Cannabis leaf'},
    {id:'smiley',label:'Smiley'},
    {id:'diamond',label:'Diamond'},
    {id:'radio',label:'Radio'},
    {id:'skull',label:'Skull'},
    {id:'mushroom',label:'Mushroom'},
    {id:'rocket',label:'Rocket'},
    {id:'microphone',label:'Microphone'},
    {id:'eye',label:'Eye'},
    {id:'ufo',label:'UFO'}
  ];

  var SHELF_ICON_ALIASES={film:'radio',sun:'star',moon:'eye',vinyl:'record',lightning:'bolt',fire:'flame',party:'leaf'};

  var SHELF_ICON_PATHS={
    record:'<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 3.5a8.5 8.5 0 0 1 7.4 4.3M4.6 16.2A8.5 8.5 0 0 0 12 20.5"></path>',
    heart:'<path d="M20.8 4.7a5.6 5.6 0 0 0-7.9 0L12 5.6l-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.4a5.6 5.6 0 0 0 0-7.9Z"></path>',
    music:'<path d="M9 18V5l10-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="16" cy="16" r="3"></circle>',
    star:'<path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9L12 2.8Z"></path>',
    bookmark:'<path d="M6 3.5h12v17l-6-4-6 4v-17Z"></path>',
    headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><path d="M4 14h3v6H5.5A1.5 1.5 0 0 1 4 18.5V14Zm16 0h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5V14Z"></path>',
    guitar:'<path d="m13.8 10.2 5.8-5.8"></path><path d="m18.2 2.8 3 3-1.6 1.6-3-3 1.6-1.6Z"></path><path d="M14.2 9.8c-1.2-1.2-3.1-1.2-4.3 0l-1 1-2.1-.7-2.7 2.7 1.6 1.6-.7 2.2 2.4 2.4 2.2-.7 1.6 1.6 2.7-2.7-.7-2.1 1-1c1.2-1.2 1.2-3.1 0-4.3Z"></path><path d="m8.4 13.8 2 2"></path><circle cx="9.4" cy="14.8" r=".7"></circle>',
    bolt:'<path d="M13.5 2.5 5.8 13h5.6l-.9 8.5L18.2 11h-5.6l.9-8.5Z"></path>',
    flame:'<path d="M12 22c4.4 0 8-3.2 8-7.5 0-2.5-1.2-4.7-3.4-6.5.1 2.5-1.2 4-2.6 4.5.2-4.3-2-7.8-5.3-10.5.3 3.8-1.7 6.1-3.2 8.2C4.6 11.6 4 13 4 14.8 4 18.8 7.6 22 12 22Z"></path><path d="M9.2 18.2c0-1.8 1.1-3.3 2.8-5 1.7 1.7 2.8 3.2 2.8 5"></path>',
    crown:'<path d="m3.5 7 4.2 4 4.3-6 4.3 6 4.2-4-1.5 11H5L3.5 7Z"></path><path d="M6 21h12"></path>',
    coffee:'<path d="M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"></path><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2"></path><path d="M8 4c0 1 1 1 1 2M12 3c0 1 1 1 1 2"></path>',
    leaf:'<path d="M12 21v-8"></path><path d="M12 14c-1.7-2.6-3.7-5.7-2.7-10.6 1.9 1.2 2.8 3.6 2.7 6.7.2-3.3.8-6.1 2.9-8.1.9 3.7-.2 6.6-2.3 9.3 2.1-2.4 4.5-4.1 7.4-4.1-.4 2.8-2.6 4.8-6.2 6.2 2.7-.5 5-.1 6.6 1.3-2.1 2-4.7 2-7.5 1.1 1.7 1 2.8 2.2 3.1 3.6-2 .1-3.5-1-4.2-2.7-.7 1.7-2.2 2.8-4.2 2.7.3-1.4 1.4-2.6 3.1-3.6-2.8.9-5.4.9-7.5-1.1 1.6-1.4 3.9-1.8 6.6-1.3-3.6-1.4-5.8-3.4-6.2-6.2 2.9 0 5.3 1.7 7.4 4.1Z"></path>',
    smiley:'<circle cx="12" cy="12" r="9"></circle><path d="M8.5 14.5c.9 1.3 2 2 3.5 2s2.6-.7 3.5-2"></path><path d="M9 9h.01M15 9h.01"></path>',
    diamond:'<path d="m12 2.8 7.5 7.1L12 21.2 4.5 9.9 12 2.8Z"></path><path d="M4.5 9.9h15M9.1 9.9 12 2.8l2.9 7.1L12 21.2 9.1 9.9Z"></path>',
    radio:'<rect x="3" y="6" width="18" height="14" rx="2"></rect><path d="m7 6 10-3"></path><circle cx="15.5" cy="13" r="3"></circle><path d="M6.5 11h3M6.5 14h3M6.5 17h3"></path>',
    skull:'<path d="M5 11a7 7 0 1 1 14 0c0 3-1.4 4.7-3.2 5.7V20H8.2v-3.3C6.4 15.7 5 14 5 11Z"></path><circle cx="9" cy="11" r="1.2"></circle><circle cx="15" cy="11" r="1.2"></circle><path d="M10.5 15h3M10 20v-2M14 20v-2"></path>',
    mushroom:'<path d="M4 11a8 8 0 0 1 16 0H4Z"></path><path d="M10 11v4.3c0 1.6-.8 2.7-2 3.7h8c-1.2-1-2-2.1-2-3.7V11"></path><path d="M8 7h.01M15 8h.01"></path>',
    rocket:'<path d="M12 2.5c3 2.3 4.5 5.4 4.5 8.8V15h-9v-3.7C7.5 7.9 9 4.8 12 2.5Z"></path><circle cx="12" cy="8.8" r="1.6"></circle><path d="M7.5 12.3 5 15.2V18l2.5-1.2M16.5 12.3l2.5 2.9V18l-2.5-1.2"></path><path d="M9.7 15c.1 2.2 1 4.3 2.3 6 1.3-1.7 2.2-3.8 2.3-6"></path>',
    microphone:'<rect x="8" y="3" width="8" height="12" rx="4"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"></path>',
    eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.8"></circle>',
    ufo:'<path d="M8 10a4 4 0 0 1 8 0"></path><path d="M5 11.5c1.6-1 4-1.5 7-1.5s5.4.5 7 1.5c1.1.7 1.1 1.8 0 2.5-1.6 1-4 1.5-7 1.5S6.6 15 5 14c-1.1-.7-1.1-1.8 0-2.5Z"></path><path d="M8 17.5 6.5 20M12 17.5V21M16 17.5l1.5 2.5"></path>'
  };

  function normalizeIcon(icon){
    var key=String(icon||'record');
    key=SHELF_ICON_ALIASES[key]||key;
    return SHELF_ICON_PATHS[key]?key:'record';
  }

  function iconSvg(icon){
    var key=normalizeIcon(icon);
    return '<svg class="shelf-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+SHELF_ICON_PATHS[key]+'</svg>';
  }

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
    ICON_OPTIONS:SHELF_ICON_OPTIONS,
    ICON_ALIASES:SHELF_ICON_ALIASES,
    ICON_PATHS:SHELF_ICON_PATHS,
    normalizeIcon:normalizeIcon,
    iconSvg:iconSvg,
    normalizeColor:normalizeColor,
    colorRgb:colorRgb,
    colorStyle:colorStyle,
    findById:findById,
    recordCount:recordCount
  });
});
