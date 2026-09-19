(function(windowObject){
'use strict';
if(!windowObject)return;

function create(options){
  options=options||{};
  var supabaseClient=options.supabaseClient;
  var addAlbumModal=options.addAlbumModal;
  var closeAddAlbum=options.closeAddAlbum;
  var albumSearchInput=options.albumSearchInput;
  var albumSearchResults=options.albumSearchResults;
  var AppleSearchCore=options.appleSearchCore;
  var PressingCore=options.pressingCore;
  var onPreview=typeof options.onPreview==='function'?options.onPreview:function(){};

  if(!supabaseClient)throw new Error('Album search requires Supabase');
  if(!addAlbumModal||!closeAddAlbum||!albumSearchInput||!albumSearchResults)throw new Error('Album search DOM is incomplete');
  if(!AppleSearchCore)throw new Error('Album search requires GroovyAppleSearchCore');
  if(!PressingCore)throw new Error('Album search requires GroovyPressingCore');

let searchTimer=null;

function openAddAlbumSearch(user){
    addAlbumModal.style.display='flex';
    addAlbumModal.scrollTop=0;

    if(user){
        getSearchLibraryState(user).catch(function(error){
            console.warn('Kunde inte förbereda sökstatus:',error);
        });
    }

    window.requestAnimationFrame(function(){
        try{
            albumSearchInput.focus({preventScroll:true});
        }catch(error){
            albumSearchInput.focus();
        }
    });
}

function closeAddAlbumSearch(){
    clearTimeout(searchTimer);
    searchTimer=null;
    musicBrainzSearchNumber++;
    addAlbumModal.style.display='none';
    albumSearchInput.value='';
    albumSearchResults.innerHTML='';
}

closeAddAlbum.addEventListener('click',closeAddAlbumSearch);

addAlbumModal.addEventListener('click',function(event){
    if(event.target===addAlbumModal)closeAddAlbumSearch();
});

albumSearchInput.addEventListener('input',function(){
    const query=albumSearchInput.value.trim();

    clearTimeout(searchTimer);

    if(query.length<2){

        albumSearchResults.innerHTML='';
        return;
    }

    albumSearchResults.innerHTML='<p>Searching...</p>';

    searchTimer=setTimeout(function(){
        searchDiscogs(query);
    },250);
});

function escapeHTML(text){
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

let musicBrainzSearchNumber=0;
const appleAlbumSearchCache=new Map();
const coverArtArchiveCache=new Map();
const appleArtworkPersistentCache=new Map();
const appleArtworkPersistentLoaded=new Set();
const APPLE_RATE_LIMIT_COOLDOWN=65000;
const APPLE_ARTWORK_CACHE_FRESH_MS=90*24*60*60*1000;
let appleSearchBlockedUntil=0;
let appleArtworkPersistentCacheAvailable=true;

function discogsMasterAppleFields(master){
    const title=String(master&&master.title||'');
    const parts=title.split(' - ');
    const artist=
        parts.length>1
            ?parts[0].replace(/\s*\(\d+\)$/,'').trim()
            :'';
    const albumTitle=
        parts.length>1
            ?parts.slice(1).join(' - ').trim()
            :title.trim();

    return {
        masterId:String(master&&master.id||'').trim(),
        artist:artist,
        albumTitle:albumTitle,
        year:master&&master.year?String(master.year):''
    };
}

function appleArtworkCacheIsFresh(row){
    if(!row||!row.matched_at)return false;
    const matchedAt=Date.parse(row.matched_at);
    return Number.isFinite(matchedAt)&&Date.now()-matchedAt<APPLE_ARTWORK_CACHE_FRESH_MS;
}

function cachedAppleAlbumFromRow(row){
    if(!row||!row.artwork_url)return null;

    const artworkUrl100=String(row.artwork_url||'')
        .replace(/\/\d+x\d+bb\./i,'/100x100bb.');

    return {
        artistName:row.artist_name||'',
        collectionName:row.album_title||'',
        releaseDate:row.release_year?String(row.release_year)+'-01-01T00:00:00Z':'',
        artworkUrl100:artworkUrl100,
        collectionViewUrl:row.apple_collection_url||'',
        collectionId:row.apple_collection_id||null
    };
}

async function getPersistentAppleArtworkCache(masters){
    const result=new Map();

    if(!appleArtworkPersistentCacheAvailable)return result;

    const ids=[...new Set(
        (masters||[])
            .map(function(master){
                return String(master&&master.id||'').trim();
            })
            .filter(Boolean)
    )];

    ids.forEach(function(id){
        if(appleArtworkPersistentCache.has(id)){
            result.set(id,appleArtworkPersistentCache.get(id));
        }
    });

    const missingIds=ids.filter(function(id){
        return !appleArtworkPersistentLoaded.has(id);
    });

    if(!missingIds.length)return result;

    try{
        const cacheRequests=await Promise.all([
            supabaseClient
                .from('apple_artwork_cache')
                .select('discogs_master_id,artist_name,album_title,release_year,apple_collection_id,apple_collection_url,artwork_url,matched_at')
                .in('discogs_master_id',missingIds),
            supabaseClient
                .from('albums')
                .select('discogs_master_id,cover_url,apple_collection_url,created_at')
                .in('discogs_master_id',missingIds)
                .not('apple_collection_url','is',null)
        ]);

        const cacheResult=cacheRequests[0];
        const albumResult=cacheRequests[1];
        if(cacheResult.error)throw cacheResult.error;
        if(albumResult.error)throw albumResult.error;

        missingIds.forEach(function(id){
            appleArtworkPersistentLoaded.add(String(id));
        });

        (albumResult.data||[]).forEach(function(row){
            const id=String(row.discogs_master_id||'');
            const artwork=String(row.cover_url||'').trim();
            const collectionUrl=String(row.apple_collection_url||'').trim();
            if(!id||!/mzstatic\.com/i.test(artwork)||!/^https:\/\/(?:music|itunes)\.apple\.com\//i.test(collectionUrl))return;

            const persistedRow={
                discogs_master_id:row.discogs_master_id,
                artist_name:'',
                album_title:'',
                release_year:null,
                apple_collection_id:null,
                apple_collection_url:collectionUrl,
                artwork_url:artwork,
                matched_at:row.created_at||null
            };
            appleArtworkPersistentCache.set(id,persistedRow);
            result.set(id,persistedRow);
        });

        (cacheResult.data||[]).forEach(function(row){
            const id=String(row.discogs_master_id||'');
            if(!id)return;
            appleArtworkPersistentCache.set(id,row);
            result.set(id,row);
        });
    }catch(error){
        appleArtworkPersistentCacheAvailable=false;
        console.warn('Apple artwork cache unavailable:',error);
    }

    return result;
}

async function savePersistentAppleArtworkMatches(){
    // Persistent artwork cache writes are verified server-side when an album is
    // actually saved. Search enrichment remains session-local until then.
}

function persistentMatchFromAppleAlbum(master,appleAlbum){
    if(!master||!appleAlbum||!appleAlbum.artworkUrl100||!appleAlbum.collectionViewUrl)return null;

    const fields=discogsMasterAppleFields(master);

    if(!fields.masterId||!fields.artist||!fields.albumTitle)return null;

    return {
        masterId:fields.masterId,
        artist:fields.artist,
        albumTitle:fields.albumTitle,
        year:fields.year,
        collectionId:appleAlbum.collectionId||null,
        collectionUrl:String(appleAlbum.collectionViewUrl||''),
        artworkUrl100:String(appleAlbum.artworkUrl100||'')
    };
}

function persistentMatchFromAppleData(entry,appleData){
    if(!entry||!entry.master||!appleData||!appleData.artworkUrl100||!appleData.collectionUrl)return null;

    return {
        masterId:String(entry.master.id||''),
        artist:entry.artist||'',
        albumTitle:entry.albumTitle||'',
        year:entry.year||'',
        collectionId:appleData.collectionId||null,
        collectionUrl:appleData.collectionUrl||'',
        artworkUrl100:appleData.artworkUrl100||''
    };
}

const searchLibraryStateCache={
    userId:'',
    loadedAt:0,
    value:null,
    promise:null
};

function emptySearchLibraryState(){
    return {
        existingMasterIds:new Set(),
        wishlistedMasterIds:new Set(),
        existingAlbumKeys:new Set(),
        wishlistedAlbumKeys:new Set()
    };
}

function invalidateSearchLibraryState(){
    searchLibraryStateCache.loadedAt=0;
    searchLibraryStateCache.value=null;
}

async function getSearchLibraryState(user){
    if(!user)return emptySearchLibraryState();

    const fresh=
        searchLibraryStateCache.userId===user.id&&
        searchLibraryStateCache.value&&
        Date.now()-searchLibraryStateCache.loadedAt<60000;

    if(fresh)return searchLibraryStateCache.value;

    if(
        searchLibraryStateCache.userId===user.id&&
        searchLibraryStateCache.promise
    ){
        return searchLibraryStateCache.promise;
    }

    searchLibraryStateCache.userId=user.id;

    searchLibraryStateCache.promise=Promise.all([
        supabaseClient
            .from('collections')
            .select('albums(discogs_master_id,title,artists(name))')
            .eq('user_id',user.id),
        supabaseClient
            .from('wishlists')
            .select('albums(discogs_master_id,title,artists(name))')
            .eq('user_id',user.id)
    ]).then(function(states){
        const collectionState=states[0];
        const wishlistState=states[1];

        if(collectionState.error)throw collectionState.error;
        if(wishlistState.error)throw wishlistState.error;

        const value={
            existingMasterIds:new Set(
                (collectionState.data||[])
                    .map(function(item){
                        return item.albums&&String(item.albums.discogs_master_id||'');
                    })
                    .filter(Boolean)
            ),
            wishlistedMasterIds:new Set(
                (wishlistState.data||[])
                    .map(function(item){
                        return item.albums&&String(item.albums.discogs_master_id||'');
                    })
                    .filter(Boolean)
            ),
            existingAlbumKeys:new Set(
                (collectionState.data||[])
                    .map(function(item){
                        var album=item.albums;
                        return album&&window.albumIdentityKey(
                            album.artists&&album.artists.name,
                            album.title
                        );
                    })
                    .filter(Boolean)
            ),
            wishlistedAlbumKeys:new Set(
                (wishlistState.data||[])
                    .map(function(item){
                        var album=item.albums;
                        return album&&window.albumIdentityKey(
                            album.artists&&album.artists.name,
                            album.title
                        );
                    })
                    .filter(Boolean)
            )
        };

        searchLibraryStateCache.value=value;
        searchLibraryStateCache.loadedAt=Date.now();
        return value;
    }).finally(function(){
        searchLibraryStateCache.promise=null;
    });

    return searchLibraryStateCache.promise;
}

function setSearchResultStatus(button,status){
    var actions=button&&button.closest?button.closest('.mb-actions'):null;
    if(!actions)return;
    var addButton=actions.querySelector('.mb-add-button');
    var wishlistButton=actions.querySelector('.mb-wishlist-button');

    if(status==='collection'){
        addButton.textContent='✓ In collection';
        addButton.classList.add('mb-added');
        addButton.disabled=true;
        wishlistButton.textContent='In collection';
        wishlistButton.classList.add('mb-wishlisted');
        wishlistButton.disabled=true;
    }else if(status==='wishlist'){
        addButton.textContent='On wishlist';
        addButton.classList.add('mb-added');
        addButton.disabled=true;
        wishlistButton.textContent='✓ Wishlisted';
        wishlistButton.classList.add('mb-wishlisted');
        wishlistButton.disabled=true;
    }
}


async function getMusicBrainzCatalogRows(masterIds){
    if(!masterIds.length)return new Map();

    const ids=[...new Set(
        masterIds
            .map(function(id){return String(id||'').trim();})
            .filter(Boolean)
    )];

    const {data,error}=await supabaseClient
        .from('musicbrainz_catalog')
        .select('mbid,discogs_master_id,artist_name,album_title,first_release_year')
        .in('discogs_master_id',ids);

    if(error){
        console.error('Kunde inte läsa musicbrainz_catalog:',error);
        return new Map();
    }

    const result=new Map();

    (data||[]).forEach(function(row){
        result.set(String(row.discogs_master_id),row);
    });

    return result;
}

function imageExists(url){
    return new Promise(function(resolve){
        const image=new Image();
        let finished=false;

        const finish=function(result){
            if(finished)return;
            finished=true;
            clearTimeout(timeout);
            image.onload=null;
            image.onerror=null;
            resolve(result);
        };

        const timeout=setTimeout(function(){
            finish(false);
        },6000);

        image.onload=function(){
            finish(true);
        };

        image.onerror=function(){
            finish(false);
        };

        image.src=url;
    });
}

async function resolveAlbumCover(mbid,discogsFallback){
    const cleanMbid=String(mbid||'').trim();
    const fallback=String(discogsFallback||'').trim();

    if(!cleanMbid){
        return {
            url:fallback,
            source:fallback?'discogs':''
        };
    }

    if(coverArtArchiveCache.has(cleanMbid)){
        const cached=coverArtArchiveCache.get(cleanMbid);

        if(cached){
            return {
                url:cached,
                source:'coverartarchive'
            };
        }

        return {
            url:fallback,
            source:fallback?'discogs':''
        };
    }

    const coverArtUrl=
        'https://coverartarchive.org/release-group/'+
        encodeURIComponent(cleanMbid)+
        '/front-1200';

    const exists=await imageExists(coverArtUrl);

    if(exists){
        coverArtArchiveCache.set(cleanMbid,coverArtUrl);

        return {
            url:coverArtUrl,
            source:'coverartarchive'
        };
    }

    coverArtArchiveCache.set(cleanMbid,'');

    return {
        url:fallback,
        source:fallback?'discogs':''
    };
}


function setSearchResultCover(entry,url,source,previewUrl,appleCollectionUrl){
    if(!entry||!url)return;

    entry.coverState.url=url;
    entry.coverState.source=source||'';

    if(source==='apple'){
        entry.coverState.appleCollectionUrl=appleCollectionUrl||'';
    }

    if(entry.imageElement){
        entry.imageElement.style.display='';
        entry.imageElement.onerror=function(){
            this.style.display='none';
        };
        entry.imageElement.src=previewUrl||url;
    }
}

function startCaaCoverUpgrade(entry,mbid,searchNumber){
    const cleanMbid=String(mbid||'').trim();
    if(!cleanMbid||!entry)return;

    if(coverArtArchiveCache.has(cleanMbid)){
        const cached=coverArtArchiveCache.get(cleanMbid);

        if(
            cached&&
            searchNumber===musicBrainzSearchNumber&&
            entry.coverState.source!=='apple'
        ){
            setSearchResultCover(
                entry,
                cached,
                'coverartarchive',
                cached,
                ''
            );
        }

        return;
    }

    const caaUrl=
        'https://coverartarchive.org/release-group/'+
        encodeURIComponent(cleanMbid)+
        '/front-1200';

    const probe=new Image();

    probe.onload=function(){
        coverArtArchiveCache.set(cleanMbid,caaUrl);

        if(
            searchNumber!==musicBrainzSearchNumber||
            entry.coverState.source==='apple'
        )return;

        setSearchResultCover(
            entry,
            caaUrl,
            'coverartarchive',
            caaUrl,
            ''
        );
    };

    probe.onerror=function(){
        coverArtArchiveCache.set(cleanMbid,'');
    };

    probe.src=caaUrl;
}

async function enrichSearchResultsWithCaa(entries,searchNumber){
    try{
        const masterIds=entries
            .map(function(entry){return entry.master.id;})
            .filter(Boolean);

        const catalogByMaster=
            await getMusicBrainzCatalogRows(masterIds);

        if(searchNumber!==musicBrainzSearchNumber)return;

        entries.forEach(function(entry){
            const catalogRow=
                catalogByMaster.get(String(entry.master.id||''));

            if(!catalogRow||!catalogRow.mbid)return;

            startCaaCoverUpgrade(
                entry,
                catalogRow.mbid,
                searchNumber
            );
        });
    }catch(error){
        console.warn('CAA-bakgrundsuppdatering misslyckades:',error);
    }
}

async function enrichSearchResultsWithApple(query,entries,searchNumber,allMasters){
    try{
        const discogsMasters=
            Array.isArray(allMasters)&&allMasters.length
                ?allMasters
                :(entries||[]).map(function(entry){
                    return entry.master;
                }).filter(Boolean);

        const persistentByMaster=
            await getPersistentAppleArtworkCache(
                discogsMasters
            );

        if(searchNumber!==musicBrainzSearchNumber)return;

        entries.forEach(function(entry){
            const cachedRow=
                persistentByMaster.get(
                    String(entry.master&&entry.master.id||'')
                );

            if(!cachedRow)return;

            const cachedAlbum=
                cachedAppleAlbumFromRow(cachedRow);

            const cachedData=
                appleAlbumData(cachedAlbum);

            if(!cachedData.url)return;

            setSearchResultCover(
                entry,
                cachedData.url,
                'apple',
                cachedData.previewUrl,
                cachedData.collectionUrl
            );
        });

        const needsLiveSearch=
            discogsMasters.some(function(master){
                const row=
                    persistentByMaster.get(
                        String(master&&master.id||'')
                    );

                return !row||!appleArtworkCacheIsFresh(row);
            });

        let appleSearchResults=[];
        const appleQueryKey=normalizeAppleFullTitle(query);

        if(appleAlbumSearchCache.has(appleQueryKey)){
            appleSearchResults=appleAlbumSearchCache.get(appleQueryKey);
        }else if(
            needsLiveSearch&&
            Date.now()>=appleSearchBlockedUntil
        ){
            try{
                const appleResponse=await fetch(
                    'https://itunes.apple.com/search?term='+
                    encodeURIComponent(query)+
                    '&entity=album&limit=100&country=SE'
                );

                if(appleResponse.ok){
                    const appleData=await appleResponse.json();
                    appleSearchResults=appleData.results||[];
                    appleAlbumSearchCache.set(
                        appleQueryKey,
                        appleSearchResults
                    );
                }else{
                    if(
                        appleResponse.status===403||
                        appleResponse.status===429
                    ){
                        appleSearchBlockedUntil=
                            Date.now()+APPLE_RATE_LIMIT_COOLDOWN;
                    }

                    console.warn(
                        'Apple album search status:',
                        appleResponse.status
                    );
                }
            }catch(appleError){
                console.warn(
                    'Apple album search unavailable:',
                    appleError
                );
            }
        }

        if(searchNumber!==musicBrainzSearchNumber)return;

        const persistentMatches=[];

        if(appleSearchResults.length){
            discogsMasters.forEach(function(master){
                const fields=discogsMasterAppleFields(master);

                if(
                    !fields.masterId||
                    !fields.artist||
                    !fields.albumTitle
                )return;

                const appleAlbum=pickBestAppleAlbum(
                    appleSearchResults,
                    fields.artist,
                    fields.albumTitle,
                    fields.year
                );

                if(!appleAlbum)return;

                const persistentMatch=
                    persistentMatchFromAppleAlbum(
                        master,
                        appleAlbum
                    );

                if(persistentMatch){
                    persistentMatches.push(
                        persistentMatch
                    );
                }
            });

            entries.forEach(function(entry){
                const appleAlbum=pickBestAppleAlbum(
                    appleSearchResults,
                    entry.artist,
                    entry.albumTitle,
                    entry.year
                );

                if(!appleAlbum)return;

                const appleData=appleAlbumData(appleAlbum);

                if(appleData.url){
                    setSearchResultCover(
                        entry,
                        appleData.url,
                        'apple',
                        appleData.previewUrl,
                        appleData.collectionUrl
                    );
                }
            });
        }

        if(persistentMatches.length){
            savePersistentAppleArtworkMatches(
                persistentMatches
            );
        }

        const unresolved=entries.filter(function(entry){
            return entry.coverState.source!=='apple';
        });

        let nextIndex=0;

        async function appleWorker(){
            while(nextIndex<unresolved.length){
                const entry=unresolved[nextIndex++];

                if(searchNumber!==musicBrainzSearchNumber)return;

                const appleData=
                    await searchApplePreviewArtwork(
                        entry.artist,
                        entry.albumTitle,
                        entry.year
                    );

                if(searchNumber!==musicBrainzSearchNumber)return;

                if(appleData&&appleData.url){
                    setSearchResultCover(
                        entry,
                        appleData.url,
                        'apple',
                        appleData.previewUrl,
                        appleData.collectionUrl
                    );

                    const persistentMatch=
                        persistentMatchFromAppleData(
                            entry,
                            appleData
                        );

                    if(persistentMatch){
                        savePersistentAppleArtworkMatches([
                            persistentMatch
                        ]);
                    }
                }
            }
        }

        await Promise.all([
            appleWorker(),
            appleWorker()
        ]);
    }catch(error){
        console.warn('Apple-bakgrundsuppdatering misslyckades:',error);
    }
}

async function searchDiscogs(query){
    const searchNumber=++musicBrainzSearchNumber;

    albumSearchResults.innerHTML='<p>Searching...</p>';

    try{
        const {data:{session}}=
            await supabaseClient.auth.getSession();

        const user=session&&session.user;
        if(!user)throw new Error('Du måste vara inloggad.');

        const libraryStatePromise=
            getSearchLibraryState(user);

        const discogsPromise=
            supabaseClient.functions.invoke(
                'discogs-search',
                {body:{query:query}}
            );

        const searchResponses=await Promise.all([
            discogsPromise,
            libraryStatePromise
        ]);

        const discogsResponse=searchResponses[0];
        const libraryState=searchResponses[1];

        if(discogsResponse.error){
            console.error(
                'Discogs error:',
                discogsResponse.error
            );
            throw discogsResponse.error;
        }

        if(searchNumber!==musicBrainzSearchNumber)return;

        const data=discogsResponse.data;
        const seenResults={};

        const results=
            (data&&data.results?data.results:[])
                .filter(function(master){
                    if(
                        /\banniversary\b/i.test(
                            String(master&&master.title||'')
                        )
                    )return false;

                    var title=String(master&&master.title||'');
                    var parts=title.split(' - ');
                    var artist=
                        parts.length>1
                            ?parts[0].replace(/\s*\(\d+\)$/,'')
                            :'';
                    var albumTitle=
                        parts.length>1
                            ?parts.slice(1).join(' - ')
                            :title;

                    var key=
                        window.albumIdentityKey(
                            artist,
                            albumTitle
                        )+
                        '|'+
                        String(master&&master.year||'');

                    if(seenResults[key])return false;

                    seenResults[key]=true;
                    return true;
                });

        if(!results.length){
            albumSearchResults.innerHTML=
                '<p>Inga album hittades.</p>';
            return;
        }

        const searchResults=results.slice(0,10);
        const persistentArtworkByMaster=
            await getPersistentAppleArtworkCache(searchResults);

        if(searchNumber!==musicBrainzSearchNumber)return;

        // Render once with persisted Apple artwork when Groovy already knows it.
        // Discogs remains the fallback; live Apple and CAA can upgrade later.
        albumSearchResults.innerHTML='';

        const entries=searchResults.map(function(master){
            const title=master.title||'Okänd titel';
            const parts=title.split(' - ');

            const artist=
                parts.length>1
                    ?parts[0].replace(/\s*\(\d+\)$/,'')
                    :'Okänd artist';

            const albumTitle=
                parts.length>1
                    ?parts.slice(1).join(' - ')
                    :title;

            const year=master.year||'';
            const resultAlbumKey=
                window.albumIdentityKey(
                    artist,
                    albumTitle
                );

            const isAdded=
                libraryState.existingMasterIds.has(
                    String(master.id)
                )||
                libraryState.existingAlbumKeys.has(
                    resultAlbumKey
                );

            const isWishlisted=
                libraryState.wishlistedMasterIds.has(
                    String(master.id)
                )||
                libraryState.wishlistedAlbumKeys.has(
                    resultAlbumKey
                );

            const discogsFullImage=
                master.cover_image||
                master.thumb||
                '';

            const discogsPreviewImage=
                master.thumb||
                master.cover_image||
                '';

            const cachedArtworkRow=
                persistentArtworkByMaster.get(
                    String(master.id||'')
                );
            const cachedAppleData=
                appleAlbumData(
                    cachedAppleAlbumFromRow(
                        cachedArtworkRow
                    )
                );
            const initialFullImage=
                cachedAppleData.url||
                discogsFullImage;
            const initialPreviewImage=
                cachedAppleData.previewUrl||
                discogsPreviewImage;

            const coverState={
                url:initialFullImage,
                source:cachedAppleData.url
                    ?'apple'
                    :(discogsFullImage?'discogs':''),
                appleCollectionUrl:
                    cachedAppleData.collectionUrl||''
            };

            const div=document.createElement('div');
            div.className='mb-result';
            div.tabIndex=0;
            div.setAttribute('aria-label','Open '+albumTitle+' by '+artist);

            div.innerHTML=
                '<img class="mb-cover" '+
                    (initialPreviewImage
                        ?'src="'+escapeHTML(initialPreviewImage)+'"'
                        :'style="display:none"')+
                    ' alt="">'+

                '<div class="mb-info">'+
                    '<div class="mb-title">'+
                        escapeHTML(albumTitle)+
                    '</div>'+
                    '<div class="mb-artist">'+
                        escapeHTML(artist)+
                    '</div>'+
                    '<div class="mb-year">'+
                        escapeHTML(String(year))+
                    '</div>'+
                '</div>'+

                '<div class="mb-actions">'+
                  (isAdded
                      ?'<button class="mb-add-button mb-added" disabled>✓ In collection</button>'
                      :(isWishlisted
                          ?'<button class="mb-add-button mb-added" disabled>On wishlist</button>'
                          :'<button class="mb-add-button">Add Record</button>'))+
                  (isAdded
                      ?'<button class="mb-wishlist-button mb-wishlisted" disabled>In collection</button>'
                      :(isWishlisted
                          ?'<button class="mb-wishlist-button mb-wishlisted" disabled>✓ Wishlisted</button>'
                          :'<button class="mb-wishlist-button"><span class="wishlist-icon" aria-hidden="true"></span>Wishlist</button>'))+
                '</div>';

            const imageElement=
                div.querySelector('.mb-cover');

            imageElement.onerror=function(){
                this.style.display='none';
            };

            const entry={
                master:master,
                artist:artist,
                albumTitle:albumTitle,
                year:year,
                coverState:coverState,
                imageElement:imageElement,
                element:div
            };

            const addButton=
                div.querySelector('.mb-add-button');

            const wishlistButton=
                div.querySelector('.mb-wishlist-button');
            let resultStatus=isAdded?'collection':(isWishlisted?'wishlist':'');

            async function saveResult(destination,button){
                const status=await saveAlbumFromDiscogs(
                    master,
                    artist,
                    albumTitle,
                    year,
                    coverState,
                    button,
                    destination
                );
                if(status){
                    resultStatus=status;
                    setSearchResultStatus(addButton,status);
                }
                return status;
            }

            function openPreview(){
                var styles=Array.isArray(master&&master.style)?master.style:[];
                var genres=Array.isArray(master&&master.genre)?master.genre:[];
                var genreValues=(styles.length?styles:genres)
                    .map(function(value){return String(value||'').trim();})
                    .filter(Boolean)
                    .slice(0,2);

                onPreview({
                    master:master,
                    artist:artist,
                    albumTitle:albumTitle,
                    year:year,
                    genre:genreValues.join(' · '),
                    coverState:coverState,
                    isAdded:resultStatus==='collection',
                    isWishlisted:resultStatus==='wishlist',
                    save:saveResult
                });
            }

            div.addEventListener('click',function(event){
                var action=event.target&&event.target.closest
                    ?event.target.closest('.mb-actions')
                    :null;
                if(action)return;
                openPreview();
            });

            div.addEventListener('keydown',function(event){
                if(event.key!=='Enter'&&event.key!==' ')return;
                var action=event.target&&event.target.closest
                    ?event.target.closest('.mb-actions')
                    :null;
                if(action)return;
                event.preventDefault();
                openPreview();
            });

            addButton.addEventListener(
                'click',
                async function(event){
                    event.stopPropagation();
                    await saveResult('collection',addButton);
                }
            );

            wishlistButton.addEventListener(
                'click',
                async function(event){
                    event.stopPropagation();
                    await saveResult('wishlist',wishlistButton);
                }
            );

            albumSearchResults.appendChild(div);
            return entry;
        });

        // These do not block the visible results.
        enrichSearchResultsWithCaa(
            entries,
            searchNumber
        );

        enrichSearchResultsWithApple(
            query,
            entries,
            searchNumber,
            searchResults
        );

    }catch(error){
        console.error('Discogs-fel:',error);

        if(searchNumber===musicBrainzSearchNumber){
            albumSearchResults.innerHTML=
                '<p>Kunde inte kontakta Discogs.</p>';
        }
    }
}
function normalizeAppleSearchText(){
    return AppleSearchCore.normalizeAppleSearchText.apply(null,arguments);
}

async function searchApplePreviewArtwork(artist,albumTitle,originalYear){
    var cacheKey=
        'resolved|'+
        normalizeAppleFullTitle(artist)+
        '|'+
        normalizeAppleFullTitle(albumTitle);

    if(appleAlbumSearchCache.has(cacheKey)){
        var cached=appleAlbumSearchCache.get(cacheKey);

        if(
            cached&&
            typeof cached==='object'&&
            !Array.isArray(cached)
        ){
            return cached;
        }
    }

    var empty={
        url:'',
        previewUrl:'',
        collectionUrl:''
    };

    if(Date.now()<appleSearchBlockedUntil)return empty;

    try{
        var response=await fetch(
            'https://itunes.apple.com/search?term='+
            encodeURIComponent(artist+' '+albumTitle)+
            '&entity=album&limit=50&country=SE'
        );

        if(!response.ok){
            if(response.status===403||response.status===429){
                appleSearchBlockedUntil=
                    Date.now()+APPLE_RATE_LIMIT_COOLDOWN;
            }

            return empty;
        }

        var data=await response.json();

        var appleAlbum=pickBestAppleAlbum(
            data.results,
            artist,
            albumTitle,
            originalYear
        );

        var result=appleAlbumData(appleAlbum);

        appleAlbumSearchCache.set(
            cacheKey,
            result
        );

        return result;
    }catch(error){
        console.warn(
            'Apple resolved album search unavailable:',
            error
        );
        return empty;
    }
}
function appleArtistMatches(){
    return AppleSearchCore.appleArtistMatches.apply(null,arguments);
}

function appleAlbumMatches(){
    return AppleSearchCore.appleAlbumMatches.apply(null,arguments);
}
function appleArtworkUrl(){
    return AppleSearchCore.appleArtworkUrl.apply(null,arguments);
}

function applePreviewArtworkUrl(){
    return AppleSearchCore.applePreviewArtworkUrl.apply(null,arguments);
}

function appleAlbumData(){
    return AppleSearchCore.appleAlbumData.apply(null,arguments);
}

function normalizeAppleFullTitle(){
    return AppleSearchCore.normalizeAppleFullTitle.apply(null,arguments);
}

function appleEditionPenalty(){
    return AppleSearchCore.appleEditionPenalty.apply(null,arguments);
}

function appleReleaseIsExcluded(){
    return AppleSearchCore.appleReleaseIsExcluded.apply(null,arguments);
}

function pickBestAppleAlbum(results,artist,albumTitle,originalYear){
    var wantedTitle=normalizeAppleFullTitle(albumTitle);
    var wantedYear=parseInt(originalYear,10)||0;

    return (results||[])
        .filter(function(item){
            return appleArtistMatches(item.artistName,artist)&&
                appleAlbumMatches(item.collectionName,albumTitle,artist)&&
                !appleReleaseIsExcluded(item.collectionName)&&
                item.artworkUrl100;
        })
        .map(function(item,index){
            var candidateTitle=normalizeAppleFullTitle(item.collectionName);
            var score=candidateTitle===wantedTitle?100:70;
            var releaseYear=parseInt(String(item.releaseDate||'').slice(0,4),10)||0;

            score-=appleEditionPenalty(item.collectionName,albumTitle);

            if(wantedYear&&releaseYear){
                score-=Math.min(Math.abs(releaseYear-wantedYear),20);
            }

            return {item:item,score:score,index:index};
        })
        .sort(function(a,b){
            return b.score-a.score||a.index-b.index;
        })
        .map(function(result){
            return result.item;
        })[0];
}

async function searchAppleAlbumArtwork(artist,albumTitle,originalYear){
    var empty={
        url:'',
        previewUrl:'',
        collectionUrl:''
    };

    var cacheKey=
        'resolved|'+
        normalizeAppleFullTitle(artist)+
        '|'+
        normalizeAppleFullTitle(albumTitle);

    if(appleAlbumSearchCache.has(cacheKey)){
        var cached=appleAlbumSearchCache.get(cacheKey);

        if(
            cached&&
            typeof cached==='object'&&
            !Array.isArray(cached)&&
            cached.url
        ){
            return cached;
        }
    }

    function remember(album){
        var result=appleAlbumData(album);

        if(result.url){
            appleAlbumSearchCache.set(
                cacheKey,
                result
            );
        }

        return result;
    }

    try{
        var directTerm=
            encodeURIComponent(
                artist+' '+albumTitle
            );

        var directResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            directTerm+
            '&entity=album&limit=50'
        );

        if(!directResponse.ok){
            throw new Error(
                'Apple album search failed'
            );
        }

        var directData=await directResponse.json();

        var directResult=pickBestAppleAlbum(
            directData.results,
            artist,
            albumTitle,
            originalYear
        );

        if(directResult){
            return remember(directResult);
        }

        var titleResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            encodeURIComponent(albumTitle)+
            '&entity=album&limit=100'
        );

        if(titleResponse.ok){
            var titleData=await titleResponse.json();

            var titleResult=pickBestAppleAlbum(
                titleData.results,
                artist,
                albumTitle,
                originalYear
            );

            if(titleResult){
                return remember(titleResult);
            }
        }

        var songResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            directTerm+
            '&entity=song&limit=100&country=SE'
        );

        if(songResponse.ok){
            var songData=await songResponse.json();

            var songResult=pickBestAppleAlbum(
                songData.results,
                artist,
                albumTitle,
                originalYear
            );

            if(songResult){
                return remember(songResult);
            }
        }

        var artistQuery=
            encodeURIComponent(artist);

        var artistResponse=await fetch(
            'https://itunes.apple.com/search?term='+
            artistQuery+
            '&entity=musicArtist&limit=10'
        );

        if(!artistResponse.ok){
            throw new Error(
                'Apple artist search failed'
            );
        }

        var artistData=await artistResponse.json();

        var artistResult=
            (artistData.results||[])
                .find(function(item){
                    return appleArtistMatches(
                        item.artistName,
                        artist
                    )&&item.artistId;
                });

        if(!artistResult)return empty;

        var lookupResponse=await fetch(
            'https://itunes.apple.com/lookup?id='+
            artistResult.artistId+
            '&entity=album&limit=200'
        );

        if(!lookupResponse.ok){
            throw new Error(
                'Apple album lookup failed'
            );
        }

        var lookupData=await lookupResponse.json();

        var albumResult=pickBestAppleAlbum(
            lookupData.results,
            artist,
            albumTitle,
            originalYear
        );

        return albumResult
            ?remember(albumResult)
            :empty;

    }catch(error){
        console.error(
            'Apple artwork error:',
            error
        );
        return empty;
    }
}
var discogsTrackRows=PressingCore.discogsTrackRows;

function shouldReloadVisibleOwnLibrary(){
    return window.location.pathname==='/';
}

async function saveAlbumFromDiscogs(master,artist,albumTitle,year,coverState,button,destination){
    var isWishlistDestination=destination==='wishlist';
    if(button.classList.contains(isWishlistDestination?'mb-wishlisted':'mb-added'))return;

    button.textContent='Sparar...';
    button.disabled=true;

    try{
        const masterId=master&&master.id;
        if(!masterId)throw new Error('Master Release saknar ID');

        let appleCollectionUrl=coverState&&coverState.appleCollectionUrl
            ?String(coverState.appleCollectionUrl)
            :'';

        if(!appleCollectionUrl){
            const appleDetails=await searchAppleAlbumArtwork(
                artist,
                albumTitle,
                year
            );
            if(appleDetails&&appleDetails.collectionUrl){
                appleCollectionUrl=appleDetails.collectionUrl;
            }
        }

        const {data:saveResult,error:saveError}=await supabaseClient.functions.invoke(
            'discogs-search',
            {
                body:{
                    action:'saveAlbum',
                    masterId:String(masterId),
                    destination:isWishlistDestination?'wishlist':'collection',
                    appleCollectionUrl:appleCollectionUrl||''
                }
            }
        );

        if(saveError)throw saveError;
        if(saveResult&&saveResult.error)throw new Error(saveResult.error);

        const savedStatus=
            saveResult&&saveResult.status==='wishlist'
                ?'wishlist'
                :'collection';

        invalidateSearchLibraryState();
        setSearchResultStatus(button,savedStatus);

        if(savedStatus==='wishlist'){
            if(shouldReloadVisibleOwnLibrary()&&window.libraryView==='wishlist')await window.loadCollection();
            return savedStatus;
        }

        if(!isWishlistDestination&&shouldReloadVisibleOwnLibrary())await window.loadCollection();
        return savedStatus;

    }catch(error){
        console.error(
            'Kunde inte spara Discogs-album:',
            error
        );

        button.innerHTML=isWishlistDestination
            ?'<span class="wishlist-icon" aria-hidden="true"></span>Wishlist'
            :'Add Record';
        button.disabled=false;

        alert(
            'Kunde inte spara albumet.\n\n'+
            (error.message||error)
        );
        return false;
    }
}

async function saveExistingCatalogAlbum(album,destination,button){
    var isWishlistDestination=destination==='wishlist';
    button.textContent='Sparar...';
    button.disabled=true;

    try{
        const {data,error}=await supabaseClient.rpc(
            'add_existing_album_to_library',
            {
                p_album_id:Number(album.id),
                p_destination:isWishlistDestination?'wishlist':'collection'
            }
        );

        if(error)throw error;

        const savedStatus=data&&data.status==='wishlist'?'wishlist':'collection';
        invalidateSearchLibraryState();

        if(savedStatus==='wishlist'){
            if(shouldReloadVisibleOwnLibrary()&&window.libraryView==='wishlist')await window.loadCollection();
            return savedStatus;
        }

        if(!isWishlistDestination&&shouldReloadVisibleOwnLibrary())await window.loadCollection();
        return savedStatus;
    }catch(error){
        console.error('Kunde inte spara befintligt album:',error);
        button.innerHTML=isWishlistDestination
            ?'<span class="wishlist-icon" aria-hidden="true"></span>Wishlist'
            :'Add Record';
        button.disabled=false;
        alert('Kunde inte spara albumet.\n\n'+(error.message||error));
        return false;
    }
}

async function openCatalogAlbumPreview(albumId){
    const numericAlbumId=Number(albumId);
    if(!Number.isFinite(numericAlbumId)||numericAlbumId<=0)return false;

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;
    if(!user)return false;

    const results=await Promise.all([
        supabaseClient
            .from('albums')
            .select('id,title,release_year,genre,cover_url,apple_collection_url,discogs_master_id,artists(name)')
            .eq('id',numericAlbumId)
            .maybeSingle(),
        getSearchLibraryState(user)
    ]);

    const albumResult=results[0];
    const libraryState=results[1];
    if(albumResult.error)throw albumResult.error;
    const album=albumResult.data;
    if(!album)return false;

    const artist=album.artists&&album.artists.name?album.artists.name:'Okänd artist';
    const albumTitle=album.title||'Okänd titel';
    const masterId=String(album.discogs_master_id||'').trim();
    const albumKey=window.albumIdentityKey(artist,albumTitle);
    let resultStatus=
        (masterId&&libraryState.existingMasterIds.has(masterId))||
        libraryState.existingAlbumKeys.has(albumKey)
            ?'collection'
            :(
                (masterId&&libraryState.wishlistedMasterIds.has(masterId))||
                libraryState.wishlistedAlbumKeys.has(albumKey)
                    ?'wishlist'
                    :''
            );

    const coverState={
        url:album.cover_url||'',
        source:'catalog',
        appleCollectionUrl:album.apple_collection_url||''
    };
    const master=masterId
        ?{id:masterId,title:artist+' - '+albumTitle,year:album.release_year||''}
        :null;

    async function saveResult(destination,button){
        const status=masterId
            ?await saveAlbumFromDiscogs(
                master,
                artist,
                albumTitle,
                album.release_year||'',
                coverState,
                button,
                destination
            )
            :await saveExistingCatalogAlbum(album,destination,button);

        if(status)resultStatus=status;
        return status;
    }

    onPreview({
        master:master,
        albumId:album.id,
        artist:artist,
        albumTitle:albumTitle,
        year:album.release_year||'',
        genre:album.genre||'',
        coverState:coverState,
        isAdded:resultStatus==='collection',
        isWishlisted:resultStatus==='wishlist',
        save:saveResult
    });

    return true;
}

function addAlbumFromDiscogs(master,artist,albumTitle,year,coverState,button){
    return saveAlbumFromDiscogs(
        master,
        artist,
        albumTitle,
        year,
        coverState,
        button,
        'collection'
    );
}

function addAlbumToWishlistFromDiscogs(master,artist,albumTitle,year,coverState,button){
    return saveAlbumFromDiscogs(
        master,
        artist,
        albumTitle,
        year,
        coverState,
        button,
        'wishlist'
    );
}

  return Object.freeze({
    open:openAddAlbumSearch,
    close:closeAddAlbumSearch,
    openCatalogPreview:openCatalogAlbumPreview,
    invalidateLibraryState:invalidateSearchLibraryState
  });
}

windowObject.GroovyAlbumSearch=Object.freeze({create:create});
})(typeof window!=='undefined'?window:null);
