(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyAppleSearchCore=api;
})(typeof window!=='undefined'?window:null,function(){
function normalizeAppleSearchText(value){
    var text=String(value||'').toLowerCase();

    if(text.normalize){
        text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    }

    return text
        .replace(/\([^)]*\)/g,' ')
        .replace(/[^a-z0-9]+/g,' ')
        .trim()
        .replace(/\s+/g,' ');
}

function appleArtistMatches(candidate,artist){
    var candidateText=normalizeAppleSearchText(candidate);
    var artistText=normalizeAppleSearchText(artist);

    if(!candidateText||!artistText)return false;

    // Ignorera ett inledande "The" vid artistmatchning.
    var candidateWithoutThe=candidateText.replace(/^the\s+/,'');
    var artistWithoutThe=artistText.replace(/^the\s+/,'');

    return candidateText===artistText||
        candidateWithoutThe===artistWithoutThe||
        candidateText.indexOf(artistText+' ')===0||
        artistText.indexOf(candidateText+' ')===0||
        candidateWithoutThe.indexOf(artistWithoutThe+' ')===0||
        artistWithoutThe.indexOf(candidateWithoutThe+' ')===0;
}

function appleAlbumMatches(candidate,albumTitle,artist){
    var candidateText=normalizeAppleSearchText(candidate);
    var albumText=normalizeAppleSearchText(albumTitle);
    var artistText=normalizeAppleSearchText(artist);

    if(!candidateText||!albumText)return false;

    // Vanlig exakt titel.
    if(candidateText===albumText)return true;

    // Apple kan ibland skriva:
    // "ABBA: The Album"
    // när vår titel bara är:
    // "The Album"
    //
    // Tillåt detta ENDAST när prefixet är samma artist.
    if(artistText){
        var artistWithoutThe=artistText.replace(/^the\s+/,'');
        var candidateWithoutThe=candidateText.replace(/^the\s+/,'');

        var possiblePrefixes=[
            artistText,
            artistWithoutThe
        ];

        for(var i=0;i<possiblePrefixes.length;i+=1){
            var prefix=possiblePrefixes[i];

            if(!prefix)continue;

            if(candidateText.indexOf(prefix+' ')===0){
                var remaining=candidateText
                    .slice(prefix.length)
                    .trim();

                if(remaining===albumText){
                    return true;
                }
            }

            if(candidateWithoutThe.indexOf(prefix+' ')===0){
                var remainingWithoutThe=candidateWithoutThe
                    .slice(prefix.length)
                    .trim();

                if(remainingWithoutThe===albumText){
                    return true;
                }
            }
        }
    }

    // Behåll den gamla säkra remaster-regeln.
    if(candidateText.indexOf(albumText+' ')!==0)return false;

    var suffix=candidateText
        .slice(albumText.length)
        .trim();

    return /^(?:\d{4}\s+)?remaster(?:ed)?(?:\s+edition)?$/.test(suffix);
}

function appleArtworkUrl(album){
    return album&&album.artworkUrl100
        ?album.artworkUrl100.replace('100x100bb','1200x1200bb')
        :'';
}

function applePreviewArtworkUrl(album){
    return album&&album.artworkUrl100
        ?album.artworkUrl100.replace('100x100bb','300x300bb')
        :'';
}

function appleAlbumData(album){
    return {
        url:appleArtworkUrl(album),
        previewUrl:applePreviewArtworkUrl(album),
        collectionUrl:album&&album.collectionViewUrl
            ?String(album.collectionViewUrl)
            :'',
        collectionId:album&&album.collectionId
            ?String(album.collectionId)
            :'',
        artworkUrl100:album&&album.artworkUrl100
            ?String(album.artworkUrl100)
            :'',
        artistName:album&&album.artistName
            ?String(album.artistName)
            :'',
        collectionName:album&&album.collectionName
            ?String(album.collectionName)
            :'',
        releaseDate:album&&album.releaseDate
            ?String(album.releaseDate)
            :''
    };
}

function normalizeAppleFullTitle(value){
    var text=String(value||'').toLowerCase();

    if(text.normalize){
        text=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    }

    return text
        .replace(/[^a-z0-9]+/g,' ')
        .trim()
        .replace(/\s+/g,' ');
}

function appleEditionPenalty(candidate,albumTitle){
    var candidateText=normalizeAppleFullTitle(candidate);
    var albumText=normalizeAppleFullTitle(albumTitle);
    var editionTerms=[
        'super deluxe','deluxe','remaster','remastered','anniversary',
        'expanded','special edition','collector edition','bonus track',
        'reissue','live'
    ];
    var penalty=0;

    editionTerms.forEach(function(term){
        if(candidateText.indexOf(term)!==-1&&albumText.indexOf(term)===-1){
            penalty+=term==='super deluxe'?40:20;
        }
    });

    return penalty;
}

function appleReleaseIsExcluded(candidate){
    var text=normalizeAppleFullTitle(candidate);
    var excludedPatterns=[
        /\bsuper deluxe\b/,
        /\bdeluxe\b/,
        /\bspecial edition\b/,
        /\bcollectors? edition\b/,
        /\bbonus tracks?\b/,
        /\breissue\b/,
        /\banniversary\b/,
        /\bremix(?:ed)?\b/,
        /\b\d{4} mix\b/,
        /\bsingle\b/,
        /\bep\b/,
        /\blive\b/
    ];

    return excludedPatterns.some(function(pattern){
        return pattern.test(text);
    });
}

  return Object.freeze({
    normalizeAppleSearchText:normalizeAppleSearchText,
    appleArtistMatches:appleArtistMatches,
    appleAlbumMatches:appleAlbumMatches,
    appleArtworkUrl:appleArtworkUrl,
    applePreviewArtworkUrl:applePreviewArtworkUrl,
    appleAlbumData:appleAlbumData,
    normalizeAppleFullTitle:normalizeAppleFullTitle,
    appleEditionPenalty:appleEditionPenalty,
    appleReleaseIsExcluded:appleReleaseIsExcluded
  });
});
