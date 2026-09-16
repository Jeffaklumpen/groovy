from pathlib import Path

path=Path('js/app.js')
text=path.read_text(encoding='utf-8')


def replace_once(source,target,label):
    global text
    count=text.count(source)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text=text.replace(source,target,1)


replace_once(
"""    if(data.session){
        await supabaseClient
            .from('profiles')
            .insert({
                id:data.user.id,
                username:username
            });

        await updateAuthUI();
    }else{""",
"""    if(data.session){
        // The auth trigger handle_new_user creates the profile from signup metadata.
        await updateAuthUI();
    }else{""",
'signup profile insert'
)

replace_once(
"""            const {data:collectionRows,error:collectionMatchError}=await supabaseClient
                .from('collections')
                .select('id,album_id,albums(title,artists(name))')
                .eq('user_id',user.id)
                .limit(500);

            if(collectionMatchError)throw collectionMatchError;

            const destinationKey=window.albumIdentityKey(discogsArtist,discogsTitle);
            const collectionMatch=(collectionRows||[]).some(function(item){
                var album=item.albums;
                return item.album_id===albumId||(
                    album&&window.albumIdentityKey(album.artists&&album.artists.name,album.title)===destinationKey
                );
            });""",
"""            const {data:collectionRows,error:collectionMatchError}=await supabaseClient
                .from('collections')
                .select('id')
                .eq('user_id',user.id)
                .eq('album_id',albumId)
                .limit(1);

            if(collectionMatchError)throw collectionMatchError;

            const collectionMatch=!!(collectionRows&&collectionRows.length);""",
'wishlist collection membership check'
)

replace_once(
"""    var {data:existingCollection,error:existingError}=await supabaseClient
      .from('collections')
      .select('id,album_id,albums(title,artists(name))')
      .eq('user_id',user.id)
      .limit(500);
    if(existingError)throw existingError;

    var wantedKey=window.albumIdentityKey(record[1],record[2]);
    var alreadyCollected=(existingCollection||[]).some(function(item){
      var album=item.albums;
      return item.album_id===record[8]||(
        album&&window.albumIdentityKey(album.artists&&album.artists.name,album.title)===wantedKey
      );
    });""",
"""    var {data:existingCollection,error:existingError}=await supabaseClient
      .from('collections')
      .select('id')
      .eq('user_id',user.id)
      .eq('album_id',record[8])
      .limit(1);
    if(existingError)throw existingError;

    var alreadyCollected=!!(existingCollection&&existingCollection.length);""",
'wishlist move membership check'
)

path.write_text(text,encoding='utf-8')
