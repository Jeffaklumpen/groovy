(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyPressingCore=api;
})(typeof window!=='undefined'?window:null,function(){
function cleanVersionValue(value,fallback){
  var text=String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  return text||fallback||'';
}

function normalizeVersion(version){
  var rawYear=cleanVersionValue(version.released||version.year||'','');
  var year=rawYear.slice(0,4);
  if(!/^\d{4}$/.test(year)||year==='0000')year='';
  var label=Array.isArray(version.label)?version.label.join(', '):version.label;
  var format=Array.isArray(version.format)?version.format.join(', '):version.format;
  return {
    id:version.id||version.release_id,
    title:cleanVersionValue(version.title,''),
    country:cleanVersionValue(version.country,'Unknown'),
    year:year,
    label:cleanVersionValue(label,'Unknown'),
    catalogNumber:cleanVersionValue(version.catno||version.catalog_number,'Unknown'),
    format:cleanVersionValue(format,'Vinyl')
  };
}

function uniqueVersionValues(list,key){
  var seen={};
  return list.map(function(item){return cleanVersionValue(item[key],'');})
    .filter(function(value){
      if(!value)return false;
      var normalized=value.toLocaleLowerCase().replace(/\s*([,;:/-])\s*/g,'$1');
      if(seen[normalized])return false;
      seen[normalized]=true;
      return true;
    })
    .sort(function(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});});
}

function pressingChoiceMatches(left,right){
  return cleanVersionValue(left,'').toLocaleLowerCase()===cleanVersionValue(right,'').toLocaleLowerCase();
}

function pressingYearMatches(versionYear,selectedYear){
  // Some Discogs releases have a blank Released field even when the physical
  // copy carries a copyright year. Keep those candidates until the matrix is
  // checked instead of silently filtering out the correct pressing.
  return !selectedYear||!versionYear||pressingChoiceMatches(versionYear,selectedYear);
}

function pressingCatalogMatches(left,right){
  return cleanVersionValue(left,'').toLocaleLowerCase().replace(/[^a-z0-9]/g,'')===
    cleanVersionValue(right,'').toLocaleLowerCase().replace(/[^a-z0-9]/g,'');
}

function normalizedMatrix(value){
  return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^a-z0-9]/g,'');
}

function matrixValues(release){
  return (Array.isArray(release&&release.identifiers)?release.identifiers:[])
    .filter(function(item){return /matrix|runout/i.test(String(item&&item.type||''));})
    .map(function(item){return String(item.value||'').trim();})
    .filter(Boolean);
}

function matrixChoices(release){
  var identifiers=Array.isArray(release.identifiers)?release.identifiers.filter(function(item){
    return /matrix|runout/i.test(String(item.type||''));
  }):[];
  var sides={a:[],b:[],c:[],d:[],e:[],f:[],g:[],h:[]};

  function detectedSide(description,value){
    var descriptionMatch=String(description||'').match(/side\s*([a-h])|([a-h])[- ]?side/i);
    if(descriptionMatch)return (descriptionMatch[1]||descriptionMatch[2]).toLowerCase();
    var valueMatch=String(value||'').match(/(?:^|[\s-])([a-h])(?:\s*[-:]\s*\d|\s*$)/i);
    return valueMatch?valueMatch[1].toLowerCase():'';
  }

  identifiers.forEach(function(item,index){
    var value=String(item.value||'').trim();
    if(!value)return;
    var description=String(item.description||'');
    var side=detectedSide(description,value);
    if(side&&sides[side])sides[side].push(value);
    else sides[index%2===0?'a':'b'].push(value);
  });

  Object.keys(sides).forEach(function(side){
    sides[side]=uniqueVersionValues(sides[side].map(function(value){return {value:value};}),'value');
  });
  return sides;
}

function vinylDiscCount(release){
  var formats=Array.isArray(release&&release.formats)?release.formats:[];
  var vinyl=formats.find(function(format){return /vinyl|lp/i.test(String(format&&format.name||''));});
  if(!vinyl)return 1;
  var qty=parseInt(vinyl.qty,10)||1;
  var descriptions=Array.isArray(vinyl.descriptions)?vinyl.descriptions.join(' '):'';
  var multiplier=descriptions.match(/\b([2-9])\s*x\s*lp\b/i);
  return Math.max(qty,multiplier?parseInt(multiplier[1],10):1);
}


function filterVersions(versions,filters){
  filters=filters||{};
  return (Array.isArray(versions)?versions:[]).filter(function(version){
    return (!filters.country||pressingChoiceMatches(version.country,filters.country))&&
      pressingYearMatches(version.year,filters.year)&&
      (!filters.label||pressingChoiceMatches(version.label,filters.label))&&
      (!filters.catalogNumber||pressingCatalogMatches(version.catalogNumber,filters.catalogNumber));
  });
}

function dedupeMatrixMatches(versions){
  var seen={};
  return (Array.isArray(versions)?versions:[]).filter(function(version){
    var key=[
      normalizedMatrix(version&&version.matrixMatch),
      cleanVersionValue(version&&version.country,'').toLocaleLowerCase(),
      cleanVersionValue(version&&version.label,'').toLocaleLowerCase(),
      normalizedMatrix(version&&version.catalogNumber)
    ].join('|');
    if(seen[key])return false;
    seen[key]=true;
    return true;
  });
}

function selectReleaseDetails(releaseId,data,version){
  data=data||{};
  version=version||{};
  var label=Array.isArray(data.labels)&&data.labels.length?data.labels[0]:{};
  return {
    id:releaseId,
    country:data.country||version.country||'',
    year:String(data.released||data.year||version.year||'').slice(0,4),
    label:label.name||version.label||'',
    catalogNumber:label.catno||version.catalogNumber||'',
    format:version.format||'Vinyl'
  };
}

function matrixSideNames(release){
  var count=Math.min(8,Math.max(2,vinylDiscCount(release||{})*2));
  return ['a','b','c','d','e','f','g','h'].slice(0,count);
}

  return Object.freeze({
    cleanVersionValue:cleanVersionValue,
    normalizeVersion:normalizeVersion,
    uniqueVersionValues:uniqueVersionValues,
    pressingChoiceMatches:pressingChoiceMatches,
    pressingYearMatches:pressingYearMatches,
    pressingCatalogMatches:pressingCatalogMatches,
    normalizedMatrix:normalizedMatrix,
    matrixValues:matrixValues,
    matrixChoices:matrixChoices,
    vinylDiscCount:vinylDiscCount,
    filterVersions:filterVersions,
    dedupeMatrixMatches:dedupeMatrixMatches,
    selectReleaseDetails:selectReleaseDetails,
    matrixSideNames:matrixSideNames
  });
});
