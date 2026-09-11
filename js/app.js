const profileButton=document.getElementById('profileButton');
const profileMenu=document.getElementById('profileMenu');
const profileUsername=document.getElementById('profileUsername');
const profileAvatarButton=document.getElementById('profileAvatarButton');
const profileImageInput=document.getElementById('profileImageInput');
const profileImageMenu=document.getElementById('profileImageMenu');
const profileImage=document.getElementById('profileImage');
const loginPanel=document.getElementById('loginPanel');
const loginEmail=document.getElementById('loginEmail');
const loginPassword=document.getElementById('loginPassword');
const loginButton=document.getElementById('loginButton');
const logoutButton=document.getElementById('logoutButton');
const loginClose=document.getElementById('loginClose');

const authTitle=document.getElementById('authTitle');
const authKicker=document.getElementById('authKicker');
const authDescription=document.getElementById('authDescription');
const authSwitchPrompt=document.getElementById('authSwitchPrompt');
const registerFields=document.getElementById('registerFields');
const registerUsername=document.getElementById('registerUsername');
const registerButton=document.getElementById('registerButton');
const authSwitchButton=document.getElementById('authSwitchButton');

let registerMode=false;

loginClose.addEventListener('click',function(){
    loginPanel.classList.remove('open');
});

profileButton.addEventListener('click',async function(event){
    event.stopPropagation();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(user){
        loginPanel.classList.remove('open');
        profileMenu.classList.toggle('open');
    }else{
        profileMenu.classList.remove('open');
        loginPanel.classList.toggle('open');

        if(loginPanel.classList.contains('open')){
            loginEmail.focus();
        }
    }
});

loginPanel.addEventListener('click',function(event){
    event.stopPropagation();
});

profileMenu.addEventListener('click',function(event){
    event.stopPropagation();
});

document.addEventListener('click',function(){
    profileMenu.classList.remove('open');
    loginPanel.classList.remove('open');
});

authSwitchButton.addEventListener('click',function(){
    registerMode=!registerMode;

    if(registerMode){
        authKicker.textContent='Join the groove';
        authTitle.textContent='Create your account';
        authDescription.textContent='Start building and sharing your vinyl collection.';
        registerFields.style.display='block';
        loginButton.style.display='none';
        registerButton.style.display='block';
        authSwitchPrompt.textContent='Already have an account?';
        authSwitchButton.textContent='Log in';
        loginPassword.setAttribute('autocomplete','new-password');
        registerUsername.focus();
    }else{
        authKicker.textContent='Your collection awaits';
        authTitle.textContent='Welcome back';
        authDescription.textContent='Sign in and pick up exactly where you left off.';
        registerFields.style.display='none';
        loginButton.style.display='block';
        registerButton.style.display='none';
        authSwitchPrompt.textContent='New to Groovy?';
        authSwitchButton.textContent='Create account';
        loginPassword.setAttribute('autocomplete','current-password');
        loginEmail.focus();
    }
});

async function updateAuthUI(){
    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(user){
        profileButton.style.display='flex';
        profileMenu.classList.remove('open');
        loginPanel.classList.remove('open');

        const {data:profile,error:profileError}=await supabaseClient
            .from('profiles')
            .select('username,avatar_url')
            .eq('id',user.id)
            .maybeSingle();

        if(profileError){
            console.error('Kunde inte hämta profil:',profileError);
        }

        const username=
            profile&&profile.username
                ?profile.username
                :user.email
                    ?user.email.split('@')[0]
                    :'användare';

        profileUsername.textContent=username;

        if(profile&&profile.avatar_url){
            profileImage.style.backgroundImage='url("'+profile.avatar_url+'")';
            profileImage.style.backgroundSize='cover';
            profileImage.style.backgroundPosition='center';

            profileImageMenu.style.backgroundImage='url("'+profile.avatar_url+'")';
            profileImageMenu.style.backgroundSize='cover';
            profileImageMenu.style.backgroundPosition='center';
        }else{
            profileImage.style.backgroundImage='url("/groovy/avatar_placeholder.png")';
            profileImage.style.backgroundSize='cover';
            profileImage.style.backgroundPosition='center';
        
            profileImageMenu.style.backgroundImage='url("/groovy/avatar_placeholder.png")';
            profileImageMenu.style.backgroundSize='cover';
            profileImageMenu.style.backgroundPosition='center';
        }

        loginEmail.value='';
        loginPassword.value='';
        registerUsername.value='';
    }else{
        profileButton.style.display='flex';
        profileMenu.classList.remove('open');
        loginPanel.classList.remove('open');

        profileImage.style.backgroundImage='url("/groovy/avatar_placeholder.png")';
        profileImage.style.backgroundSize='cover';
        profileImage.style.backgroundPosition='center';
        
        profileImageMenu.style.backgroundImage='url("/groovy/avatar_placeholder.png")';
        profileImageMenu.style.backgroundSize='cover';
        profileImageMenu.style.backgroundPosition='center';
    }
}

profileAvatarButton.addEventListener('click',function(){
    profileImageInput.click();
});

profileImageInput.addEventListener('change',async function(){
    const file=profileImageInput.files[0];

    if(!file)return;

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user){
        alert('Du måste vara inloggad.');
        return;
    }

    if(!file.type.startsWith('image/')){
        alert('Välj en bildfil.');
        profileImageInput.value='';
        return;
    }

    if(file.size>5*1024*1024){
        alert('Bilden får vara högst 5 MB.');
        profileImageInput.value='';
        return;
    }

    profileAvatarButton.disabled=true;

    try{
        const extension=file.name.split('.').pop().toLowerCase();
        const filePath=user.id+'/avatar.'+extension;

        const {error:uploadError}=await supabaseClient
            .storage
            .from('profile-images')
            .upload(filePath,file,{
                upsert:true,
                contentType:file.type,
                cacheControl:'3600'
            });

        if(uploadError)throw uploadError;

        const {data:publicUrlData}=supabaseClient
            .storage
            .from('profile-images')
            .getPublicUrl(filePath);

        const avatarUrl=publicUrlData.publicUrl+'?t='+Date.now();

        const {error:updateError}=await supabaseClient
            .from('profiles')
            .update({
                avatar_url:avatarUrl
            })
            .eq('id',user.id)
            .select('id,avatar_url');
        
        if(updateError)throw updateError;

        profileImage.style.backgroundImage='url("'+avatarUrl+'")';
        profileImage.style.backgroundSize='cover';
        profileImage.style.backgroundPosition='center';
        
        profileImageMenu.style.backgroundImage='url("'+avatarUrl+'")';
        profileImageMenu.style.backgroundSize='cover';
        profileImageMenu.style.backgroundPosition='center';

    }catch(error){
        console.error('Profilbild kunde inte laddas upp:',error);
        alert('Kunde inte ladda upp profilbilden.\n\n'+error.message);
    }

    profileAvatarButton.disabled=false;
    profileImageInput.value='';
});

loginButton.addEventListener('click',async function(){
    const email=loginEmail.value.trim();
    const password=loginPassword.value;

    if(!email||!password){
        alert('Fyll i e-post och lösenord.');
        return;
    }

    loginButton.disabled=true;
    loginButton.textContent='Logging in...';

    const {data,error}=await supabaseClient.auth.signInWithPassword({
        email:email,
        password:password
    });

    if(error){
        console.error('Login error:',error);
        alert(error.message);
        loginButton.disabled=false;
        loginButton.textContent='Log in';
        return;
    }

    loginButton.disabled=false;
    loginButton.textContent='Log in';

    await updateAuthUI();
});

registerButton.addEventListener('click',async function(){
    const username=registerUsername.value.trim();
    const email=loginEmail.value.trim();
    const password=loginPassword.value;

    if(!username||!email||!password){
        alert('Fyll i användarnamn, e-post och lösenord.');
        return;
    }

    if(username.length<3){
        alert('Användarnamnet måste vara minst 3 tecken.');
        return;
    }

    if(password.length<6){
        alert('Lösenordet måste vara minst 6 tecken.');
        return;
    }

    registerButton.disabled=true;
    registerButton.textContent='Creating account...';

    const {data,error}=await supabaseClient.auth.signUp({
        email:email,
        password:password,
        options:{
            data:{
                username:username
            }
        }
    });

    if(error){
        console.error('Registration error:',error);
        alert(error.message);
        registerButton.disabled=false;
        registerButton.textContent='Create account';
        return;
    }

    if(data.session){
        await supabaseClient
            .from('profiles')
            .insert({
                id:data.user.id,
                username:username
            });

        await updateAuthUI();
    }else{
        alert('Kontot är skapat. Kontrollera din e-post för att bekräfta kontot.');
    }

    registerButton.disabled=false;
    registerButton.textContent='Create account';
});

logoutButton.addEventListener('click',async function(){
    const {error}=await supabaseClient.auth.signOut();

    if(error){
        console.error('Logout error:',error);
        alert(error.message);
        return;
    }

    profileMenu.classList.remove('open');

    records=[];
    collection.innerHTML='';

    await updateAuthUI();
});

supabaseClient.auth.onAuthStateChange(function(){
    setTimeout(function(){
        renderCurrentRoute();
    },0);
});

(function(){

window.records = [];
window.viewedUserId=null;
window.hasAuthenticatedUser=false;
window.loginRequiredForViewedCollection=false;
window.profileNotFound=false;
window.collectionLoadVersion=0;
window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);

window.albumIdentityKey=GroovyRouteState.albumIdentityKey;

function wishlistRecord(item,index){
  var album=item.albums;
  var sides={A:[],B:[],C:[],D:[]};

  if(Array.isArray(album.tracks)){
    album.tracks
      .sort(function(a,b){
        var sideCompare=String(a.disc_side||'').localeCompare(String(b.disc_side||''));
        return sideCompare||((a.track_number||0)-(b.track_number||0))||((a.id||0)-(b.id||0));
      })
      .forEach(function(track){
        if(!sides[track.disc_side])return;
        sides[track.disc_side].push({
          id:track.id,
          title:track.title||'Okänd låt',
          rating:0
        });
      });
  }

  return [
    index+1,
    album.artists&&album.artists.name
      ?album.artists.name.replace(/\s*\(\d+\)$/,'')
      :'Okänd artist',
    album.title||'Okänd titel',
    album.release_year||'',
    album.genre||'',
    0,
    item.cover_url||album.cover_url||'',
    sides,
    album.id,
    item.id,
    album.discogs_master_id||''
  ];
}

window.loadWishlist=async function(userId){
  var loadVersion=++window.collectionLoadVersion;
  var {data,error}=await supabaseClient
    .from('wishlists')
    .select(`
      id,
      added_at,
      sort_order,
      cover_url,
      albums(
        id,
        title,
        release_year,
        genre,
        cover_url,
        discogs_master_id,
        artists(id,name),
        tracks(id,disc_side,track_number,title)
      )
    `)
    .eq('user_id',userId)
    .order('sort_order',{ascending:true,nullsFirst:false})
    .order('added_at',{ascending:true});

  if(error){
    console.error('Kunde inte hämta önskelistan:',error);
    return;
  }

  if(loadVersion!==window.collectionLoadVersion)return;

  records=(data||[])
    .filter(function(item){return item.albums;})
    .map(wishlistRecord);

  document.getElementById('collectionCount').textContent=records.length+' RECORDS ON WISHLIST';
  buildGrid();
}

window.loadCollection=async function(){
  var loadVersion=++window.collectionLoadVersion;
  var path=window.location.pathname;

  if(/^\/groovy\/user\/[^\/]+\/?$/.test(path)){
    return;
  }

  viewedUserId=null;
  window.loginRequiredForViewedCollection=false;
  window.profileNotFound=false;
  document.getElementById('viewedUserHeader').style.display='none';
  document.getElementById('backToMyCollectionMobileButton').classList.remove('active');
    
  var {data:{session}}=await supabaseClient.auth.getSession();
  window.hasAuthenticatedUser=!!(session&&session.user);

  if(!session||!session.user){
    records=[];
    buildGrid();
    return;
  }

  var user=session.user;

  if(window.libraryView==='wishlist'){
    await window.loadWishlist(user.id);
    return;
  }

  var {data:collectionData,error:collectionError}=await supabaseClient
    .from('collections')
    .select(`
      id,
      collection_number,
      sort_order,
      cover_url,
      albums(
        id,
        title,
        release_year,
        genre,
        cover_url,
        discogs_master_id,
        artists(
          id,
          name
        ),
        tracks(
          id,
          disc_side,
          track_number,
          title
        )
      )
    `)
    .eq('user_id',user.id)
    .order('sort_order',{ascending:true});

    if(collectionError){
        console.error('Kunde inte hämta samlingen:',collectionError);
        return;
    }
    
  var albumIds=collectionData.map(function(item){
    return item.albums&&item.albums.id;
  }).filter(Boolean);

  var ratings={};

  if(albumIds.length){
    var {data:ratingData,error:ratingError}=await supabaseClient
      .from('album_ratings')
      .select('album_id,rating')
      .eq('user_id',user.id)
      .in('album_id',albumIds);

    if(ratingError){
      console.error('Kunde inte hämta albumratings:',ratingError);
    }else{
      ratingData.forEach(function(item){
        ratings[item.album_id]=item.rating||0;
      });
    }
  }

  var trackIds=[];

  collectionData.forEach(function(item){
    if(item.albums&&Array.isArray(item.albums.tracks)){
      item.albums.tracks.forEach(function(track){
        if(track.id)trackIds.push(track.id);
      });
    }
  });

  var trackRatings={};

  if(trackIds.length){
    var {data:trackRatingData,error:trackRatingError}=await supabaseClient
      .from('track_ratings')
      .select('track_id,rating')
      .eq('user_id',user.id)
      .in('track_id',trackIds);

    if(trackRatingError){
      console.error('Kunde inte hämta låtratings:',trackRatingError);
    }else{
      trackRatingData.forEach(function(item){
        trackRatings[item.track_id]=item.rating||0;
      });
    }
  }

  if(loadVersion!==window.collectionLoadVersion)return;

  records=collectionData
    .filter(function(item){
      return item.albums;
    })
    .map(function(item,index){
      var album=item.albums;
      var artist=
        album.artists&&album.artists.name
          ?album.artists.name.replace(/\s*\(\d+\)$/,'')
          :'Okänd artist';

      var sides={
        A:[],
        B:[],
        C:[],
        D:[]
      };

      if(Array.isArray(album.tracks)){
        album.tracks
          .sort(function(a,b){
            return (a.id||0)-(b.id||0);
          })
          .forEach(function(track){
            var side=track.disc_side;

            if(!sides[side])return;

            sides[side].push({
              id:track.id,
              title:track.title||'Okänd låt',
              rating:trackRatings[track.id]||0
            });
          });
      }

        return [
          index+1,
          artist,
          album.title||'Okänd titel',
          album.release_year||'',
          album.genre||'',
          ratings[album.id]||0,
          item.cover_url||album.cover_url||'',
          sides,
          album.id,
          item.id,
          album.discogs_master_id||''
        ];
    });

  document.getElementById('collectionCount').textContent=records.length+' RECORDS IN COLLECTION';
  buildGrid();
}

var collection=document.getElementById('collection');
var filterButton=document.getElementById('filterButton');
var filterMenu=document.getElementById('filterMenu');
var viewButton=document.getElementById('viewButton');
var viewMenu=document.getElementById('viewMenu');
var albumOverlay=document.getElementById('albumOverlay');
var albumClose=document.getElementById('albumClose');
var detailCover=document.getElementById('detailCover');
var detailNumber=document.getElementById('detailNumber');
var detailArtist=document.getElementById('detailArtist');
var detailAlbum=document.getElementById('detailAlbum');
var detailYear=document.getElementById('detailYear');
var detailGenre=document.getElementById('detailGenre');
var detailRating=document.getElementById('detailRating');
var detailTracks=document.getElementById('detailTracks');

var view='grid';
var activeIndex=0;
var drag=false;
var selectedRating='all';
var startX=0;
var startY=0;
var startScroll=0;
var scrollTimer=null;
var suppressAlbumClick=false;

function esc(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function recordHTML(record, className){
  var smallSrc=record[6];
  var isWishlist=window.libraryView==='wishlist';

  var html='<article class="record '+(isWishlist?'wishlist-record ':'')+(className||'')+'" draggable="false" data-index="'+(parseInt(record[0],10)-1)+'">'+
    '<div class="cover-wrapper">'+
      '<img class="cover" draggable="false" loading="lazy" decoding="async" src="" data-src="'+esc(smallSrc)+'" alt="'+esc(record[1]+' - '+record[2])+'">'+
      '<div class="number">'+record[0]+'</div>'+
      '<div class="cover-rating">';

  if(isWishlist){
    html+='<span class="wishlist-cover-label"><span class="wishlist-icon" aria-hidden="true"></span>Wishlisted</span>';
  }else{
    for(var r=1;r<=5;r++){
      html+=r<=record[5]?'★':'<span class="empty">★</span>';
    }
  }

  html+='</div>'+
    (viewedUserId===null&&isWishlist
      ?'<button class="wishlist-remove-button" type="button" aria-label="Remove from wishlist">×</button>'
      :(viewedUserId===null?'<button class="delete-cover-button" type="button" aria-label="Ta bort album">×</button>':''))+
    '</div>'+
    '<div class="info">'+
      '<div class="artist">'+esc(record[1])+'</div>'+
      '<div class="album">'+esc(record[2])+'</div>'+
      '<div class="year">'+esc(record[3])+'</div>'+
    '</div>'+
    (isWishlist&&viewedUserId===null
      ?'<button class="move-to-collection-button" type="button"><span class="record-icon" aria-hidden="true"></span>Add to collection</button>'
      :'')+
  '</article>';

  return html;
}

function loadVisibleImages(){
  var images=document.querySelectorAll('.cover');
  var height=window.innerHeight||600;
  var width=window.innerWidth||1024;
  var verticalMargin=450;
  var horizontalMargin=500;

  for(var i=0;i<images.length;i++){
    var img=images[i];
    var dataSrc=img.getAttribute('data-src');
    if(!dataSrc)continue;

    var rect=img.getBoundingClientRect();
    if(rect.top<height+verticalMargin&&rect.bottom>-verticalMargin&&
       rect.left<width+horizontalMargin&&rect.right>-horizontalMargin){
      img.src=dataSrc;
      img.removeAttribute('data-src');
    }
  }
}

function openAlbum(index){
  var record=records[index];
  if(!record)return;

  var isWishlist=window.libraryView==='wishlist';
  detailNumber.innerHTML=isWishlist?'Wishlisted':esc(record[0]);
  detailArtist.innerHTML=esc(record[1]);
  detailAlbum.innerHTML=esc(record[2]);
  detailYear.innerHTML=esc(record[3]);
  detailGenre.innerHTML=esc(record[4]||'Genre saknas');

  detailCover.src=record[6];
  detailCover.alt=record[1]+' - '+record[2];

  var rating=parseInt(record[5],10);
  if(isNaN(rating))rating=0;
  rating=Math.max(0,Math.min(5,rating));

  var stars='';

  if(isWishlist){
    detailRating.innerHTML=viewedUserId===null
      ?'<button class="detail-move-to-collection" type="button"><span class="record-icon" aria-hidden="true"></span>Add to collection</button>'
      :'';
  }else{
    for(var i=1;i<=5;i++){
      stars+='<button class="album-rating-star '+(i<=rating?'filled':'empty')+'" type="button" data-rating="'+i+'">★</button>';
    }

    detailRating.innerHTML=stars;
  }

  var detailMoveButton=detailRating.querySelector('.detail-move-to-collection');
  if(detailMoveButton){
    detailMoveButton.addEventListener('click',async function(event){
      event.preventDefault();
      event.stopPropagation();
      var moved=await moveWishlistAlbumToCollection(index,detailMoveButton);
      if(moved)closeAlbum();
    });
  }

  var ratingButtons=detailRating.querySelectorAll('.album-rating-star');

  for(var r=0;r<ratingButtons.length;r++){
    ratingButtons[r].addEventListener('mouseenter',function(){
      if(viewedUserId!==null)return;

      var hoverRating=parseInt(this.getAttribute('data-rating'),10);

      for(var i=0;i<ratingButtons.length;i++){
        ratingButtons[i].classList.toggle(
          'hover-filled',
          i<hoverRating
        );
      }
    });

    ratingButtons[r].addEventListener('mouseleave',function(){
      for(var i=0;i<ratingButtons.length;i++){
        ratingButtons[i].classList.remove('hover-filled');
      }
    });

    ratingButtons[r].addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();

      if(viewedUserId!==null)return;

      var newRating=parseInt(
        this.getAttribute('data-rating'),
        10
      );

      saveAlbumRating(index,newRating);
    });

    ratingButtons[r].addEventListener('touchend',function(event){
      event.preventDefault();
      event.stopPropagation();

      if(viewedUserId!==null)return;

      var newRating=parseInt(
        this.getAttribute('data-rating'),
        10
      );

      saveAlbumRating(index,newRating);
    },{passive:false});
  }

  var sides=record[7]||{};
  var sideNames=['A','B','C','D'];
  var html='';

  for(i=0;i<sideNames.length;i++){
    var side=sideNames[i];
    var tracks=sides[side];

    if(!tracks||!tracks.length)continue;

    html+='<section class="track-side">'+
      '<div class="side-title"><span>SIDA</span>'+side+'</div>'+
      '<ol class="tracks-list">';

    for(var j=0;j<tracks.length;j++){
      var track=tracks[j];

      var title=track.title||'Okänd låt';
      var trackRating=parseInt(track.rating,10);

      if(isNaN(trackRating))trackRating=0;
      trackRating=Math.max(0,Math.min(5,trackRating));

      var trackStars='';

      if(!isWishlist){
        for(var s=1;s<=5;s++){
          trackStars+='<button class="track-rating-star '+(s<=trackRating?'filled':'empty')+'" type="button" data-track-id="'+track.id+'" data-rating="'+s+'">★</button>';
        }
      }

      html+='<li data-track-id="'+track.id+'">'+
        '<span class="track-title">'+esc(title)+'</span>'+
        '<span class="track-rating">'+trackStars+'</span>'+
      '</li>';
    }

    html+='</ol></section>';
  }

  detailTracks.innerHTML=html||
    '<div style="color:#666;font-size:13px">Ingen låtlista tillagd</div>';

  var trackRatingButtons=detailTracks.querySelectorAll('.track-rating-star');

  for(var t=0;t<trackRatingButtons.length;t++){
    trackRatingButtons[t].addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();

      if(viewedUserId!==null)return;

      var trackId=parseInt(
        this.getAttribute('data-track-id'),
        10
      );

      var newRating=parseInt(
        this.getAttribute('data-rating'),
        10
      );

      saveTrackRating(trackId,newRating);
    });

    trackRatingButtons[t].addEventListener('touchend',function(event){
      event.preventDefault();
      event.stopPropagation();

      if(viewedUserId!==null)return;

      var trackId=parseInt(
        this.getAttribute('data-track-id'),
        10
      );

      var newRating=parseInt(
        this.getAttribute('data-rating'),
        10
      );

      saveTrackRating(trackId,newRating);
    },{passive:false});
  }

  for(var h=0;h<trackRatingButtons.length;h++){
    trackRatingButtons[h].addEventListener('mouseenter',function(){
      if(viewedUserId!==null)return;

      var buttons=detailTracks.querySelectorAll(
        '.track-rating-star[data-track-id="'+this.getAttribute('data-track-id')+'"]'
      );

      var hoverRating=parseInt(this.getAttribute('data-rating'),10);

      for(var i=0;i<buttons.length;i++){
        buttons[i].style.color=buttons[i].classList.contains('filled')?'#E85301':(i<hoverRating?'#aaa':'#555');
      }
    });

    trackRatingButtons[h].addEventListener('mouseleave',function(){
      var buttons=detailTracks.querySelectorAll(
        '.track-rating-star[data-track-id="'+this.getAttribute('data-track-id')+'"]'
      );

      for(var i=0;i<buttons.length;i++){
        buttons[i].style.color=buttons[i].classList.contains('filled')?'#E85301':'#555';
      }
    });
  }

  albumOverlay.className='album-overlay visible';
  document.body.style.overflow='hidden';
}

async function saveAlbumRating(index,rating){
  if(viewedUserId!==null)return;  
  var record=records[index];

  if(!record)return;

  var {data:{user},error:userError}=await supabaseClient.auth.getUser();

  if(userError||!user){
    alert('Du måste vara inloggad.');
    return;
  }

  var albumId=record[8];

  var {error}=await supabaseClient
    .from('album_ratings')
    .upsert({
      user_id:user.id,
      album_id:albumId,
      rating:rating
    },{
      onConflict:'user_id,album_id'
    });

  if(error){
    console.error('Kunde inte spara albumrating:',error);
    alert('Kunde inte spara ratingen.\n\n'+error.message);
    return;
  }

  record[5]=rating;

  var ratingButtons=detailRating.querySelectorAll('.album-rating-star');

  for(var i=0;i<ratingButtons.length;i++){
    var starRating=i+1;

    ratingButtons[i].classList.remove('hover-filled');
    ratingButtons[i].classList.toggle(
      'filled',
      starRating<=rating
    );
    ratingButtons[i].classList.toggle(
      'empty',
      starRating>rating
    );
  }

  var cards=collection.querySelectorAll('.record');

  for(var c=0;c<cards.length;c++){
    var cardIndex=parseInt(
      cards[c].getAttribute('data-index'),
      10
    );

    if(cardIndex!==index)continue;

    var coverRating=cards[c].querySelector('.cover-rating');

    if(!coverRating)continue;

    var coverStars='';

    for(var s=1;s<=5;s++){
      coverStars+=s<=rating
        ?'★'
        :'<span class="empty">★</span>';
    }

    coverRating.innerHTML=coverStars;
    break;
  }
}

async function saveTrackRating(trackId,rating){
  if(viewedUserId!==null)return;  
  var {data:{user},error:userError}=await supabaseClient.auth.getUser();

  if(userError||!user){
    alert('Du måste vara inloggad.');
    return;
  }

  var {error}=await supabaseClient
    .from('track_ratings')
    .upsert({
      user_id:user.id,
      track_id:trackId,
      rating:rating
    },{
      onConflict:'user_id,track_id'
    });

  if(error){
    console.error('Kunde inte spara låtrating:',error);
    alert('Kunde inte spara ratingen.\n\n'+error.message);
    return;
  }

  var trackButtons=detailTracks.querySelectorAll(
    '.track-rating-star[data-track-id="'+trackId+'"]'
  );

  for(var i=0;i<trackButtons.length;i++){
    var starRating=i+1;

    trackButtons[i].classList.toggle(
      'filled',
      starRating<=rating
    );

    trackButtons[i].classList.toggle(
      'empty',
      starRating>rating
    );
  }

  for(var i=0;i<trackButtons.length;i++){
    trackButtons[i].style.color=trackButtons[i].classList.contains('filled')?'#E85301':'#555';
  }

  for(var r=0;r<records.length;r++){
    var sides=records[r][7]||{};

    for(var side in sides){
      if(!sides.hasOwnProperty(side))continue;

      for(var j=0;j<sides[side].length;j++){
        if(sides[side][j].id===trackId){
          sides[side][j].rating=rating;
        }
      }
    }
  }
}
    
function closeAlbum(){
  albumOverlay.className='album-overlay';
  document.body.style.overflow='';

  setTimeout(function(){
    if(albumOverlay.className.indexOf('visible')===-1){
      detailCover.src='';
    }
  },350);
}

async function deleteCollectionAlbum(index){
  if(viewedUserId!==null)return;  
  var record=records[index];

  if(!record)return;

  var {data:{user},error:userError}=await supabaseClient.auth.getUser();

  if(userError||!user){
    alert('Du måste vara inloggad.');
    return;
  }

  var albumId=record[8];

  var {error}=await supabaseClient
    .from('collections')
    .delete()
    .eq('user_id',user.id)
    .eq('album_id',albumId);

  if(error){
    console.error('Kunde inte ta bort albumet:',error);
    alert('Kunde inte ta bort albumet.');
    return;
  }

  await window.loadCollection();
}

async function deleteWishlistAlbum(index){
  if(viewedUserId!==null||window.libraryView!=='wishlist')return;
  var record=records[index];
  if(!record)return;

  var {data:{user},error:userError}=await supabaseClient.auth.getUser();
  if(userError||!user){
    alert('Du måste vara inloggad.');
    return;
  }

  var {error}=await supabaseClient
    .from('wishlists')
    .delete()
    .eq('id',record[9])
    .eq('user_id',user.id);

  if(error){
    console.error('Kunde inte ta bort albumet från önskelistan:',error);
    alert('Kunde inte ta bort albumet från önskelistan.');
    return;
  }

  await window.loadCollection();
}

async function moveWishlistAlbumToCollection(index,button){
  if(viewedUserId!==null||window.libraryView!=='wishlist')return false;
  var record=records[index];
  if(!record)return false;

  var originalText=button.textContent;
  button.textContent='Moving...';
  button.disabled=true;

  try{
    var {data:{user},error:userError}=await supabaseClient.auth.getUser();
    if(userError||!user)throw new Error('Du måste vara inloggad.');

    var {data:existingCollection,error:existingError}=await supabaseClient
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
    });

    if(!alreadyCollected){
      var {data:lastCollection,error:lastError}=await supabaseClient
        .from('collections')
        .select('sort_order')
        .eq('user_id',user.id)
        .order('sort_order',{ascending:false})
        .limit(1);
      if(lastError)throw lastError;

      var nextSortOrder=lastCollection&&lastCollection.length
        ?lastCollection[0].sort_order+1
        :1;
      var {error:insertError}=await supabaseClient
        .from('collections')
        .insert({
          user_id:user.id,
          album_id:record[8],
          cover_url:record[6]||null,
          sort_order:nextSortOrder
        });
      if(insertError)throw insertError;
    }

    var {error:deleteError}=await supabaseClient
      .from('wishlists')
      .delete()
      .eq('id',record[9])
      .eq('user_id',user.id);
    if(deleteError)throw deleteError;

    await window.loadCollection();
    return true;
  }catch(error){
    console.error('Kunde inte flytta albumet till samlingen:',error);
    button.textContent=originalText;
    button.disabled=false;
    alert('Kunde inte flytta albumet till samlingen.\n\n'+(error.message||error));
    return false;
  }
}

function attachAlbumClicks(){
  if(collection._albumClickAttached)return;
  collection._albumClickAttached=true;

  collection.addEventListener('click',async function(event){
    var target=event.target||event.srcElement;

    var wishlistRemoveButton=target.closest
      ?target.closest('.wishlist-remove-button')
      :null;

    if(wishlistRemoveButton){
      if(viewedUserId!==null)return;
      event.preventDefault();
      event.stopPropagation();

      var wishlistRecordElement=wishlistRemoveButton.closest('.record');
      if(!wishlistRecordElement)return;
      var wishlistIndex=parseInt(wishlistRecordElement.getAttribute('data-index'),10);
      if(isNaN(wishlistIndex)||!records[wishlistIndex])return;

      removeAlbumIndex=wishlistIndex;
      document.getElementById('removeAlbumMessage').textContent='Remove "'+records[wishlistIndex][2]+'" from your wishlist?';
      document.getElementById('removeAlbumModal').style.display='flex';
      return;
    }

    var moveButton=target.closest
      ?target.closest('.move-to-collection-button')
      :null;

    if(moveButton){
      event.preventDefault();
      event.stopPropagation();
      var moveRecordElement=moveButton.closest('.record');
      if(!moveRecordElement)return;
      var moveIndex=parseInt(moveRecordElement.getAttribute('data-index'),10);
      if(isNaN(moveIndex))return;
      await moveWishlistAlbumToCollection(moveIndex,moveButton);
      return;
    }

    var deleteButton=target.closest
      ?target.closest('.delete-cover-button')
      :null;

    if(deleteButton){
      if(viewedUserId!==null)return;
        
      event.preventDefault();
      event.stopPropagation();

      var recordElement=deleteButton.closest('.record');

      if(!recordElement)return;

      var index=parseInt(recordElement.getAttribute('data-index'),10);

      if(isNaN(index))return;

        const record=records[index];
        
        if(!record)return;
        
        removeAlbumIndex=index;
        
        const removeAlbumModal=document.getElementById('removeAlbumModal');
        const removeAlbumMessage=document.getElementById('removeAlbumMessage');
        
        removeAlbumMessage.textContent='Are you sure you want to remove "'+record[2]+'" from your collection?';
        
        removeAlbumModal.style.display='flex';
        
        return;
    }
      
    if(suppressAlbumClick)return;
    if(deleteMode)return;

    var recordElement=target.closest
      ?target.closest('.record')
      :null;

    if(!recordElement)return;

    var index=parseInt(recordElement.getAttribute('data-index'),10);

    if(isNaN(index))return;

    if(view==='carousel'&&drag)return;

    openAlbum(index);
  });
}

const removeAlbumModal=document.getElementById('removeAlbumModal');
const cancelRemoveAlbum=document.getElementById('cancelRemoveAlbum');
const confirmRemoveAlbum=document.getElementById('confirmRemoveAlbum');

let removeAlbumIndex=null;

cancelRemoveAlbum.addEventListener('click',function(){
    removeAlbumModal.style.display='none';
    removeAlbumIndex=null;
});

removeAlbumModal.addEventListener('click',function(event){
    if(event.target===removeAlbumModal){
        removeAlbumModal.style.display='none';
        removeAlbumIndex=null;
    }
});

confirmRemoveAlbum.addEventListener('click',async function(){
    if(removeAlbumIndex===null)return;

    const index=removeAlbumIndex;

    removeAlbumModal.style.display='none';
    removeAlbumIndex=null;

    if(window.libraryView==='wishlist'){
      await deleteWishlistAlbum(index);
    }else{
      await deleteCollectionAlbum(index);
    }
});

function enableGridSorting(){
    if(view!=='grid'||selectedRating!=='all'){
      collection.classList.remove('grid-sort-enabled');
      return;
    }
    
    if(viewedUserId!==null){
      collection.classList.remove('grid-sort-enabled');
      collection.ondragstart=null;
      collection.ondragover=null;
      collection.ondrop=null;
      collection.ondragend=null;
      collection.oncontextmenu=null;
      return;
    }

  // Mark the editable grid so touch-action can be limited to the sortable cards.
  // This prevents the browser from stealing a long-press as a scroll gesture.
  collection.classList.add('grid-sort-enabled');

  var dragged=null;
  var touchTimer=null;
  var touchDragging=false;
  var touchX=0;
  var touchY=0;
  var autoScrollFrame=null;
  var dragPreview=null;
  var dragPreviewOffsetX=0;
  var dragPreviewOffsetY=0;

  collection.oncontextmenu=function(event){
    event.preventDefault();
    return false;
  };

  function animateCards(moveFunction){
    var cards=collection.querySelectorAll('.record');
    var positions=new Map();

    for(var i=0;i<cards.length;i++){
      if(cards[i]!==dragged){
        positions.set(cards[i],cards[i].getBoundingClientRect());
      }
    }

    moveFunction();

    requestAnimationFrame(function(){
      for(var i=0;i<cards.length;i++){
        var card=cards[i];

        if(card===dragged)continue;

        var oldRect=positions.get(card);

        if(!oldRect)continue;

        var newRect=card.getBoundingClientRect();
        var x=oldRect.left-newRect.left;
        var y=oldRect.top-newRect.top;

        if(x||y){
          card.style.transition='none';
          card.style.transform='translate3d('+x+'px,'+y+'px,0)';

          (function(card){
            requestAnimationFrame(function(){
              card.style.transition='transform .24s cubic-bezier(.2,.8,.2,1)';
              card.style.transform='translate3d(0,0,0)';

              setTimeout(function(){
                card.style.transition='';
                card.style.transform='';
              },260);
            });
          })(card);
        }
      }
    });
  }

  function moveDragged(target,pointerX,pointerY){
    if(!dragged||!target||target===dragged)return;

    var rect=target.getBoundingClientRect();
    var after;

    if(pointerX<rect.left||pointerX>rect.right){
      after=pointerX>rect.left+rect.width/2;
    }else{
      after=pointerY>rect.top+rect.height/2;
    }

    if(after){
      if(target.nextSibling!==dragged){
        animateCards(function(){
          target.parentNode.insertBefore(dragged,target.nextSibling);
        });
      }
    }else{
      if(target!==dragged.nextSibling){
        animateCards(function(){
          target.parentNode.insertBefore(dragged,target);
        });
      }
    }
  }

  function stopAutoScroll(){
    if(autoScrollFrame){
      cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame=null;
    }
  }

  function createDragPreview(card,pointerX,pointerY){
    removeDragPreview();

    var rect=card.getBoundingClientRect();

    dragPreview=card.cloneNode(true);
    dragPreview.classList.remove('dragging');
    dragPreview.classList.add('drag-preview');
    dragPreview.removeAttribute('draggable');
    dragPreview.style.width=rect.width+'px';
    dragPreview.style.height=rect.height+'px';
    dragPreview.style.left=(pointerX-rect.width/2)+'px';
    dragPreview.style.top=(pointerY-rect.height/2)+'px';

    dragPreviewOffsetX=rect.width/2;
    dragPreviewOffsetY=rect.height/2;

    document.body.appendChild(dragPreview);
  }

  function updateDragPreview(pointerX,pointerY){
    if(!dragPreview)return;

    dragPreview.style.left=(pointerX-dragPreviewOffsetX)+'px';
    dragPreview.style.top=(pointerY-dragPreviewOffsetY)+'px';
  }

  function removeDragPreview(){
    var previews=document.querySelectorAll('.drag-preview');

    for(var i=0;i<previews.length;i++){
      if(previews[i].parentNode){
        previews[i].parentNode.removeChild(previews[i]);
      }
    }

    dragPreview=null;
  }

  function autoScroll(){
    if(!touchDragging||!dragged){
      stopAutoScroll();
      return;
    }

    var edge=100;
    var maxSpeed=14;
    var height=window.innerHeight;
    var speed=0;

    if(touchY<edge){
      speed=-maxSpeed*(1-touchY/edge);
    }else if(touchY>height-edge){
      speed=maxSpeed*(1-(height-touchY)/edge);
    }

    if(speed){
      window.scrollBy(0,speed);

      var target=document.elementFromPoint(touchX,touchY);

      if(target){
        var card=target.closest
          ?target.closest('.record')
          :null;

        if(card&&card!==dragged){
          moveDragged(card,touchX,touchY);
        }
      }
    }

    autoScrollFrame=requestAnimationFrame(autoScroll);
  }

  function finishDrag(){
    var orderedCards=collection.querySelectorAll('.record');
    var newRecords=[];

    for(var i=0;i<orderedCards.length;i++){
      var index=parseInt(orderedCards[i].getAttribute('data-index'),10);
      var record=records[index];

      if(!record)continue;

      record[0]=i+1;

      var numberElement=orderedCards[i].querySelector('.number');

      if(numberElement){
        numberElement.textContent=i+1;
      }

      newRecords.push(record);
    }

    records=newRecords;

    return saveGridOrder();
  }

    collection.ondragstart=function(event){
      if(viewedUserId!==null){
        event.preventDefault();
        return;
      }
    
      var record=event.target.closest('.record');
    
      if(!record)return;

    dragged=record;
    record.classList.add('dragging');
    createDragPreview(record,event.clientX,event.clientY);

    if(event.dataTransfer){
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',record.getAttribute('data-index'));

      if(dragPreview){
        // Dölj webbläsarens halvtransparenta standard-ghost. Vår egen
        // kopia följer musen och förblir helt ogenomskinlig.
        var transparentDragImage=document.createElement('canvas');
        transparentDragImage.width=1;
        transparentDragImage.height=1;
        event.dataTransfer.setDragImage(transparentDragImage,0,0);
      }
    }
  };

  collection.ondragover=function(event){
    if(viewedUserId!==null)return;
    if(!dragged)return;

    event.preventDefault();
    event.dataTransfer.dropEffect='move';

    updateDragPreview(event.clientX,event.clientY);

    var target=event.target.closest('.record');

    if(!target||target===dragged)return;

    moveDragged(target,event.clientX,event.clientY);
  };

  collection.ondragenter=function(event){
    if(viewedUserId===null&&dragged){
      event.preventDefault();
      event.dataTransfer.dropEffect='move';
    }
  };

  collection.ondrop=async function(event){
    if(viewedUserId!==null)return;  
    if(!dragged)return;

    event.preventDefault();

    var releasedDragged=dragged;

    releasedDragged.classList.remove('dragging');
    removeDragPreview();
    dragged=null;

    await finishDrag();
  };

  collection.ondragend=function(){
    if(dragged){
      dragged.classList.remove('dragging');
    }

    removeDragPreview();
    dragged=null;
  };

  window.addEventListener('dragend',removeDragPreview);
  window.addEventListener('blur',function(){
    if(dragged){
      dragged.classList.remove('dragging');
      dragged=null;
    }

    removeDragPreview();
    touchDragging=false;
    resetPointerState();
    resetTouchState();
  });

  collection.ondragstart=null;
  collection.ondragover=null;
  collection.ondragenter=null;
  collection.ondrop=null;
  collection.ondragend=null;

  var cards=collection.querySelectorAll('.record');
  var pointerId=null;
  var pointerCard=null;
  var pointerStartX=0;
  var pointerStartY=0;
  var touchId=null;
  var touchCard=null;
  var touchStartX=0;
  var touchStartY=0;

  function resetPointerState(){
    clearTimeout(touchTimer);
    stopAutoScroll();

    if(pointerCard&&pointerCard.releasePointerCapture&&pointerId!==null){
      try{pointerCard.releasePointerCapture(pointerId);}catch(error){}
    }

    pointerId=null;
    pointerCard=null;
  }

  function resetTouchState(){
    clearTimeout(touchTimer);
    touchId=null;
    touchCard=null;
  }

  function findTouch(touchList,id){
    for(var i=0;i<touchList.length;i++){
      if(touchList[i].identifier===id)return touchList[i];
    }

    return null;
  }

  function startPointerDrag(card,event){
    dragged=card;
    touchDragging=true;
    suppressAlbumClick=true;
    touchX=event.clientX;
    touchY=event.clientY;
    card.classList.add('dragging');
    createDragPreview(card,touchX,touchY);

    if(card.setPointerCapture&&event.pointerId!==undefined){
      try{card.setPointerCapture(event.pointerId);}catch(error){}
    }

    autoScroll();
  }

  function updatePointerDrag(event){
    if(!touchDragging||!dragged)return;

    event.preventDefault();

    touchX=event.clientX;
    touchY=event.clientY;
    updateDragPreview(touchX,touchY);

    var target=document.elementFromPoint(touchX,touchY);
    var card=target&&target.closest
      ?target.closest('.record')
      :null;

    if(card&&card!==dragged){
      moveDragged(card,touchX,touchY);
    }
  }

  async function finishPointerDrag(){
    clearTimeout(touchTimer);
    stopAutoScroll();

    if(!touchDragging||!dragged){
      removeDragPreview();
      resetPointerState();
      resetTouchState();
      touchDragging=false;
      dragged=null;
      suppressAlbumClick=false;
      return;
    }

    var releasedDragged=dragged;

    releasedDragged.classList.remove('dragging');
    removeDragPreview();
    dragged=null;
    touchDragging=false;
    resetPointerState();
    resetTouchState();

    suppressAlbumClick=true;
    await finishDrag();

    setTimeout(function(){
      suppressAlbumClick=false;
    },300);
  }

  function cancelPointerDrag(){
    clearTimeout(touchTimer);
    stopAutoScroll();

    if(dragged){
      dragged.classList.remove('dragging');
    }

    removeDragPreview();
    dragged=null;
    touchDragging=false;
    suppressAlbumClick=false;
    resetPointerState();
    resetTouchState();
  }

  for(var i=0;i<cards.length;i++){
    cards[i].onpointerdown=function(event){
      if(pointerId!==null)return;
      if(event.button!==undefined&&event.button!==0)return;
      if(event.pointerType==='touch')return;
      if(event.target.closest&&event.target.closest('.delete-cover-button'))return;

      pointerId=event.pointerId;
      pointerCard=this;
      pointerStartX=event.clientX;
      pointerStartY=event.clientY;
      touchX=event.clientX;
      touchY=event.clientY;

      clearTimeout(touchTimer);

      // Keep receiving pointer events even when the pointer moves off the card.
      if(this.setPointerCapture){
        try{this.setPointerCapture(event.pointerId);}catch(error){}
      }

    };

    cards[i].onpointermove=function(event){
      if(pointerId===null||event.pointerId!==pointerId)return;

      if(!touchDragging){
        var movedX=Math.abs(event.clientX-pointerStartX);
        var movedY=Math.abs(event.clientY-pointerStartY);

        if(movedX>6||movedY>6){
          startPointerDrag(this,event);
          updatePointerDrag(event);
        }

        return;
      }

      updatePointerDrag(event);
    };

    cards[i].onpointerup=function(event){
      if(pointerId===null||event.pointerId!==pointerId)return;
      finishPointerDrag();
    };

    cards[i].onpointercancel=function(event){
      if(pointerId===null||event.pointerId!==pointerId)return;
      cancelPointerDrag();
    };

    cards[i].addEventListener('touchstart',function(event){
      if(touchId!==null||!event.changedTouches.length)return;
      if(event.target.closest&&event.target.closest('.delete-cover-button'))return;

      var touch=event.changedTouches[0];
      touchId=touch.identifier;
      touchCard=this;
      touchStartX=touch.clientX;
      touchStartY=touch.clientY;
      touchX=touch.clientX;
      touchY=touch.clientY;

      clearTimeout(touchTimer);
      touchTimer=setTimeout(function(){
        if(touchId===null||touchDragging||!touchCard)return;

        startPointerDrag(touchCard,{
          clientX:touchX,
          clientY:touchY
        });
      },350);
    },{passive:true});

    cards[i].addEventListener('touchmove',function(event){
      if(touchId===null)return;

      var touch=findTouch(event.touches,touchId);

      if(!touch)return;

      touchX=touch.clientX;
      touchY=touch.clientY;

      if(!touchDragging){
        var movedX=Math.abs(touchX-touchStartX);
        var movedY=Math.abs(touchY-touchStartY);

        if(movedX>8||movedY>8){
          clearTimeout(touchTimer);
        }

        return;
      }

      event.preventDefault();
      updateDragPreview(touchX,touchY);

      var target=document.elementFromPoint(touchX,touchY);
      var card=target&&target.closest
        ?target.closest('.record')
        :null;

      if(card&&card!==dragged){
        moveDragged(card,touchX,touchY);
      }
    },{passive:false});

    cards[i].addEventListener('touchend',function(event){
      if(touchId===null)return;

      var touch=findTouch(event.changedTouches,touchId);

      if(!touch)return;

      if(touchDragging){
        event.preventDefault();
        finishPointerDrag();
      }else{
        resetTouchState();
      }
    },{passive:false});

    cards[i].addEventListener('touchcancel',function(){
      if(touchId===null)return;
      cancelPointerDrag();
    },{passive:true});
  }
}

function attachWishlistRemoveControls(){
  var buttons=collection.querySelectorAll('.wishlist-remove-button');

  function stopCardInteraction(event){
    event.stopPropagation();
  }

  for(var i=0;i<buttons.length;i++){
    var button=buttons[i];

    button.addEventListener('pointerdown',stopCardInteraction);
    button.addEventListener('mousedown',stopCardInteraction);
    button.addEventListener('touchstart',stopCardInteraction,{passive:true});
    button.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if(viewedUserId!==null)return;

      var recordElement=this.closest('.record');
      if(!recordElement)return;

      var index=parseInt(recordElement.getAttribute('data-index'),10);
      if(isNaN(index)||!records[index])return;

      removeAlbumIndex=index;
      document.getElementById('removeAlbumMessage').textContent='Remove "'+records[index][2]+'" from your wishlist?';
      document.getElementById('removeAlbumModal').style.display='flex';
    });
  }
}

async function saveGridOrder(){
  var {data:{user},error:userError}=await supabaseClient.auth.getUser();

  if(userError||!user){
    alert('Du måste vara inloggad.');
    return false;
  }

  for(var i=0;i<records.length;i++){
    var record=records[i];

    if(!record||!record[9]){
      console.error('Saknar collection-id:',record);
      alert('Kunde inte hitta albumets collection-id.');
      return false;
    }

    var tableName=window.libraryView==='wishlist'?'wishlists':'collections';
    var {data,error}=await supabaseClient
      .from(tableName)
      .update({
        sort_order:i+1
      })
      .eq('id',record[9])
      .eq('user_id',user.id)
      .select('id,sort_order');

    if(error){
      console.error('Kunde inte spara sorteringen:',error);
      alert('Kunde inte spara sorteringen.\n\n'+error.message);
      return false;
    }

    if(!data||!data.length){
      console.error('Ingen rad uppdaterades:',record[9]);
      alert('Supabase uppdaterade ingen rad. Kontrollera RLS-policyn för '+tableName+'.');
      return false;
    }
  }

  await window.loadCollection();
  return true;
}

function addCoverTilt(){
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;

  document.querySelectorAll('.record').forEach(function(cover){
    cover.addEventListener('mousemove',function(event){
      var rect=cover.getBoundingClientRect();
      var x=(event.clientX-rect.left)/rect.width-.5;
      var y=(event.clientY-rect.top)/rect.height-.5;

      cover.querySelector('.cover-wrapper').style.transform='perspective(800px) rotateX('+(-y*10)+'deg) rotateY('+(x*10)+'deg)';
    });

    cover.addEventListener('mouseleave',function(){
      cover.querySelector('.cover-wrapper').style.transform='';
    });
  });
}
    
window.buildGrid=function(){
    
  collection.className='collection grid';

  var emptyCollection=document.getElementById('emptyCollection');
  var profileNotFound=document.getElementById('profileNotFound');
  var hasBlockingState=window.loginRequiredForViewedCollection||window.profileNotFound;
  var isViewingProfile=viewedUserId!==null;
  var isOwnCollection=!isViewingProfile&&!hasBlockingState;
  var isWishlist=window.libraryView==='wishlist';
  var canShowAddAlbumCard=isOwnCollection&&window.hasAuthenticatedUser&&records.length>0;
  var emptyWishlist=document.getElementById('emptyWishlist');
  var libraryTabs=document.getElementById('libraryTabs');

  emptyCollection.style.display=(isOwnCollection&&!isWishlist&&records.length===0)?'flex':'none';
  loginToViewCollection.style.display=window.loginRequiredForViewedCollection?'flex':'none';
  profileNotFound.style.display=window.profileNotFound?'flex':'none';
  emptyViewedCollection.style.display=(isViewingProfile&&!isWishlist&&records.length===0&&!hasBlockingState)?'flex':'none';
  emptyWishlist.style.display=(isWishlist&&records.length===0&&!hasBlockingState)?'flex':'none';
  document.getElementById('emptyWishlistTitle').textContent=isViewingProfile?'Wishlist is empty':'Your wishlist is empty';
  document.getElementById('emptyWishlistText').textContent=isViewingProfile
    ?"This user hasn't added any records yet."
    :'Save records you want to add next.';
  document.getElementById('emptyWishlistAddButton').style.display=isViewingProfile?'none':'';
  libraryTabs.style.display=(window.hasAuthenticatedUser&&!hasBlockingState)?'flex':'none';
  document.getElementById('collectionTabButton').classList.toggle('active',!isWishlist);
  document.getElementById('wishlistTabButton').classList.toggle('active',isWishlist);
  document.getElementById('addAlbumButton').style.display=isViewingProfile?'none':'';
  document.getElementById('deleteModeButton').style.display=(isViewingProfile||isWishlist)?'none':'';
  document.getElementById('filterButton').parentElement.style.display=isWishlist?'none':'';

  var html='';

  for(var i=0;i<records.length;i++){
    var rating=parseInt(records[i][5],10);

    if(isWishlist||selectedRating==='all'||rating===parseInt(selectedRating,10)){
      html+=recordHTML(records[i],'');
    }
  }

  if(canShowAddAlbumCard){
    html+='<button class="add-album-card" type="button" aria-label="Add album">'+
      '<span class="add-album-card-icon" aria-hidden="true">+</span>'+
      '<span class="add-album-card-title">Add Album</span>'+
      '<span class="add-album-card-text">'+(isWishlist?'The wishlist must grow':'The collection must grow')+'</span>'+
    '</button>';
  }

  collection.innerHTML=html;

  var addAlbumCard=collection.querySelector('.add-album-card');

  if(addAlbumCard){
    addAlbumCard.addEventListener('click',function(){
      document.getElementById('addAlbumButton').click();
    });
  }

  addCoverTilt();
  attachWishlistRemoveControls();
  attachAlbumClicks();
  enableGridSorting();
  loadVisibleImages();
}

function setActive(index){
  activeIndex=index;

  var cards=document.getElementsByClassName('carousel-card');

  for(var i=0;i<cards.length;i++){
    cards[i].className=cards[i].className.replace(/\sactive\b/g,'');

    if(i===index){
      cards[i].className+=' active';
    }
  }
}

function animateScroll(element,to,smooth){
  if(!smooth){
    element.scrollLeft=to;
    return;
  }

  if(element.scrollTo){
    try{
      element.scrollTo({left:to,behavior:'smooth'});
      return;
    }catch(e){}
  }

  var from=element.scrollLeft;
  var change=to-from;
  var duration=420;
  var start=new Date().getTime();

  function step(){
    var time=new Date().getTime();
    var progress=Math.min(1,(time-start)/duration);
    var easing=progress*(2-progress);
    element.scrollLeft=from+change*easing;
    if(progress<1)setTimeout(step,16);
  }
  step();
}

function centerCard(index,smooth){
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');
  var card=cards[index];

  if(!viewport||!card)return;

  var target=card.offsetLeft-(viewport.clientWidth-card.offsetWidth)/2;
  var max=viewport.scrollWidth-viewport.clientWidth;

  target=Math.max(0,Math.min(target,max));

  setActive(index);
  animateScroll(viewport,target,smooth);
}

function nearest(){
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');
  var center=viewport.scrollLeft+viewport.clientWidth/2;

  var best=0;
  var distance=Infinity;

  for(var i=0;i<cards.length;i++){
    var card=cards[i];
    var cardCenter=card.offsetLeft+card.offsetWidth/2;
    var currentDistance=Math.abs(cardCenter-center);

    if(currentDistance<distance){
      distance=currentDistance;
      best=i;
    }
  }

  return best;
}

function buildCarousel(){
  collection.className='collection carousel';

  var html=
    '<div class="carousel-viewport" id="carouselViewport">'+
      '<div class="carousel-track" id="carouselTrack">';

  for(var i=0;i<records.length;i++){
    var rating=parseInt(records[i][5],10);
  
    if(selectedRating==='all'||rating===parseInt(selectedRating,10)){
      html+=recordHTML(records[i],'carousel-card');
    }
  }

  html+='</div></div>';
  collection.innerHTML=html;
  loadVisibleImages();
  
  var viewport=document.getElementById('carouselViewport');
  var cards=document.getElementsByClassName('carousel-card');

  attachWishlistRemoveControls();
  attachAlbumClicks();

  function scheduleSettle(){
    if(scrollTimer)clearTimeout(scrollTimer);

    scrollTimer=setTimeout(function(){
      setActive(nearest());
    },180);
  }

  viewport.onscroll=function(){
    scheduleImageLoad();
    scheduleSettle();
  };

  viewport.ontouchstart=function(event){
    if(!event.touches||!event.touches.length)return;

    drag=false;
    startX=event.touches[0].pageX;
    startY=event.touches[0].pageY;
    startScroll=viewport.scrollLeft;

    if(scrollTimer)clearTimeout(scrollTimer);
  };

  viewport.ontouchmove=function(event){
    if(!event.touches||!event.touches.length)return;

    var dx=event.touches[0].pageX-startX;

    if(Math.abs(dx)>8)drag=true;
  };

  viewport.ontouchend=function(){
    scheduleSettle();

    setTimeout(function(){
      drag=false;
    },120);
  };

  setTimeout(function(){
    centerCard(activeIndex,false);
    scheduleImageLoad();
  },30);
}

function setView(nextView){
  view=nextView;

  viewButton.textContent=(view==='grid'?'Grid':'Carousel')+' ▾';

  if(view==='grid'){
    buildGrid();
  }else{
    buildCarousel();
  }
}

albumClose.onclick=function(){
  closeAlbum();
};

albumOverlay.onclick=function(event){
  if((event||window.event).target===albumOverlay){
    closeAlbum();
  }
};

document.onkeydown=function(event){
  event=event||window.event;

  if(event.keyCode===27){
    if(albumOverlay.className.indexOf('visible')!==-1){
      closeAlbum();
    }
    return;
  }

  if(view!=='carousel')return;

  if(event.keyCode===39&&activeIndex<records.length-1){
    centerCard(activeIndex+1,true);
  }else if(event.keyCode===37&&activeIndex>0){
    centerCard(activeIndex-1,true);
  }
};

filterButton.onclick=function(event){
  event.stopPropagation();
  viewMenu.classList.remove('open');
  filterMenu.classList.toggle('open');
  filterButton.setAttribute('aria-expanded',filterMenu.classList.contains('open')?'true':'false');
  viewButton.setAttribute('aria-expanded','false');
};

viewButton.onclick=function(event){
  event.stopPropagation();
  filterMenu.classList.remove('open');
  viewMenu.classList.toggle('open');
  viewButton.setAttribute('aria-expanded',viewMenu.classList.contains('open')?'true':'false');
  filterButton.setAttribute('aria-expanded','false');
};

var filterButtons=filterMenu.querySelectorAll('button');

for(var f=0;f<filterButtons.length;f++){
  filterButtons[f].onclick=function(event){
    event.stopPropagation();

    selectedRating=this.getAttribute('data-rating');

    for(var i=0;i<filterButtons.length;i++){
      filterButtons[i].className='';
    }

    this.className='active';
    filterButton.textContent=this.textContent+' ▾';

    filterMenu.classList.remove('open');
    filterButton.setAttribute('aria-expanded','false');

    activeIndex=0;

    if(view==='grid'){
      buildGrid();
    }else{
      buildCarousel();
    }
  };
}

var viewButtons=viewMenu.querySelectorAll('button');

for(var v=0;v<viewButtons.length;v++){
  viewButtons[v].onclick=function(event){
    event.stopPropagation();

    for(var i=0;i<viewButtons.length;i++){
      viewButtons[i].className='';
    }

    this.className='active';

    var nextView=this.getAttribute('data-view');

    viewButton.textContent=this.textContent+' ▾';

    viewMenu.classList.remove('open');
    viewButton.setAttribute('aria-expanded','false');

    setView(nextView);
  };
}

document.addEventListener('click',function(){
  filterMenu.classList.remove('open');
  viewMenu.classList.remove('open');
  filterButton.setAttribute('aria-expanded','false');
  viewButton.setAttribute('aria-expanded','false');
});

var imageLoadScheduled=false;
function scheduleImageLoad(){
  if(imageLoadScheduled)return;
  imageLoadScheduled=true;
  var run=window.requestAnimationFrame||function(fn){return setTimeout(fn,50);};
  run(function(){imageLoadScheduled=false;loadVisibleImages();});
}

window.onscroll=scheduleImageLoad;

})();

// ========================================
// ADD ALBUM / MUSICBRAINZ
// ========================================

const addAlbumButton=document.getElementById('addAlbumButton');
const addAlbumModal=document.getElementById('addAlbumModal');
const closeAddAlbum=document.getElementById('closeAddAlbum');
const albumSearchInput=document.getElementById('albumSearchInput');
const albumSearchResults=document.getElementById('albumSearchResults');

const searchUserButton=document.getElementById('searchUserButton');
const searchUserModal=document.getElementById('searchUserModal');
const closeSearchUser=document.getElementById('closeSearchUser');

const userSearchInput=document.getElementById('userSearchInput');
const userSearchResults=document.getElementById('userSearchResults');

let userSearchTimer=null;

userSearchInput.addEventListener('input',function(){
    const query=userSearchInput.value.trim();

    clearTimeout(userSearchTimer);

    if(query.length<2){
        loadTopUsers();
        return;
    }

    userSearchResults.innerHTML='<p>Searching...</p>';

    userSearchTimer=setTimeout(function(){
        searchUsers(query);
    },250);
});

async function loadTopUsers(){
    const {data:users,error}=await supabaseClient
        .from('profiles')
        .select('id,username,avatar_url');

    if(error){
        console.error('Top users error:',error);
        userSearchResults.innerHTML='<p>Could not load users.</p>';
        return;
    }

    if(!users||!users.length){
        userSearchResults.innerHTML='<p>No users found.</p>';
        return;
    }

    const userCollectionCounts=await Promise.all(
        users.map(async function(user){
            const {count,error}=await supabaseClient
                .from('collections')
                .select('id',{count:'exact',head:true})
                .eq('user_id',user.id);

            return {
                id:user.id,
                count:error?0:(count||0)
            };
        })
    );

    userCollectionCounts.sort(function(a,b){
        return b.count-a.count;
    });

    const topUsers=userCollectionCounts.slice(0,10);

    userSearchResults.innerHTML='';

    topUsers.forEach(function(item){
        const user=users.find(function(user){
            return user.id===item.id;
        });

        if(!user)return;

        const div=document.createElement('div');

        div.className='user-search-result';
        div.dataset.userId=user.id;
        div.style.cursor='pointer';

        const avatar=document.createElement('div');
        avatar.className='user-search-avatar';

        avatar.style.backgroundImage='url("'+
            (user.avatar_url||'/groovy/avatar_placeholder.png')+
            '")';

        avatar.style.backgroundSize='cover';
        avatar.style.backgroundPosition='center';

        const userInfo=document.createElement('div');
        userInfo.className='user-search-info';

        const username=document.createElement('span');
        username.className='user-search-username';
        username.textContent=user.username;

        const collectionCount=document.createElement('span');
        collectionCount.className='user-search-count';
        collectionCount.textContent=item.count+' collected records';

        userInfo.appendChild(username);
        userInfo.appendChild(collectionCount);

        div.appendChild(avatar);
        div.appendChild(userInfo);

        userSearchResults.appendChild(div);

        div.addEventListener('click',function(){
            searchUserModal.style.display='none';
            history.pushState({},'','/groovy/user/'+encodeURIComponent(user.username));
            renderCurrentRoute();
        });
    });
}

async function searchUsers(query){
    const {data,error}=await supabaseClient
        .from('profiles')
        .select('id,username,avatar_url')
        .ilike('username','%'+query+'%')
        .limit(10);

    if(error){
        console.error('User search error:',error);
        userSearchResults.innerHTML='<p>Could not search users.</p>';
        return;
    }

    userSearchResults.innerHTML='';

    if(!data||!data.length){
        userSearchResults.innerHTML='<p>No users found.</p>';
        return;
    }

    const userCollectionCounts=await Promise.all(
        data.map(async function(user){
            const {count,error}=await supabaseClient
                .from('collections')
                .select('id',{count:'exact',head:true})
                .eq('user_id',user.id);
    
            return {
                id:user.id,
                count:error?0:(count||0)
            };
        })
    );
    
    const collectionCountMap={};
    
    userCollectionCounts.forEach(function(item){
        collectionCountMap[item.id]=item.count;
    });

    data.forEach(function(user){
        const div=document.createElement('div');

        div.className='user-search-result';
        div.dataset.userId=user.id;
        div.style.cursor='pointer';
        
        const avatar=document.createElement('div');
        avatar.className='user-search-avatar';
    
        avatar.style.backgroundImage='url("'+
            (user.avatar_url||'/groovy/avatar_placeholder.png')+
            '")';
    
        avatar.style.backgroundSize='cover';
        avatar.style.backgroundPosition='center';
    
        const userInfo=document.createElement('div');
        userInfo.className='user-search-info';
        
        const username=document.createElement('span');
        username.className='user-search-username';
        username.textContent=user.username;
        
        const collectionCount=document.createElement('span');
        collectionCount.className='user-search-count';
        collectionCount.textContent=(collectionCountMap[user.id]||0)+' collected records';
        
        userInfo.appendChild(username);
        userInfo.appendChild(collectionCount);
        
        div.appendChild(avatar);
        div.appendChild(userInfo);
    
        userSearchResults.appendChild(div);

        div.addEventListener('click',function(){
            searchUserModal.style.display='none';
            history.pushState({},'','/groovy/user/'+encodeURIComponent(user.username));
            renderCurrentRoute();
        });
    });
}

searchUserButton.addEventListener('click',async function(event){
    event.preventDefault();
    event.stopPropagation();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user)return;

    searchUserModal.style.display='flex';
    userSearchInput.value='';
    loadTopUsers();
    userSearchInput.focus();
});

closeSearchUser.addEventListener('click',function(){
    searchUserModal.style.display='none';
});

searchUserModal.addEventListener('click',function(event){
    if(event.target===searchUserModal){
        searchUserModal.style.display='none';
    }
});

const myCollectionButton=document.getElementById('myCollectionButton');
const backToMyCollectionButton=document.getElementById('backToMyCollectionButton');
const backToMyCollectionMobileButton=document.getElementById('backToMyCollectionMobileButton');
const collectionTabButton=document.getElementById('collectionTabButton');
const wishlistTabButton=document.getElementById('wishlistTabButton');
const emptyWishlistAddButton=document.getElementById('emptyWishlistAddButton');

const logo=document.querySelector('.logo');

logo.addEventListener('click',function(){
    myCollectionButton.click();
});

myCollectionButton.addEventListener('click',async function(){
    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user)return;

    history.pushState({},'','/groovy/');

    deleteMode=false;
    deleteModeButton.classList.remove('active');
    document.body.classList.remove('delete-mode-active');

    document.getElementById('viewedUserHeader').style.display='none';
    await window.loadCollection();
});

backToMyCollectionButton.addEventListener('click',function(){
    myCollectionButton.click();
});

backToMyCollectionMobileButton.addEventListener('click',function(){
    myCollectionButton.click();
});

function navigateLibrary(nextView){
    var url=window.location.pathname;
    if(nextView==='wishlist')url+='?view=wishlist';
    history.pushState({},'',url);
    renderCurrentRoute();
}

collectionTabButton.addEventListener('click',function(){
    if(window.libraryView!=='collection')navigateLibrary('collection');
});

wishlistTabButton.addEventListener('click',function(){
    if(window.libraryView!=='wishlist')navigateLibrary('wishlist');
});

emptyWishlistAddButton.addEventListener('click',function(){
    addAlbumButton.click();
});

const deleteModeButton=document.getElementById('deleteModeButton');

let deleteMode=false;

deleteModeButton.addEventListener('click',function(event){
  event.preventDefault();
  event.stopPropagation();

  deleteMode=!deleteMode;

  deleteModeButton.classList.toggle('active',deleteMode);
  document.body.classList.toggle('delete-mode-active',deleteMode);
});

let searchTimer=null;

addAlbumButton.addEventListener('click',async function(event){
    if(viewedUserId!==null)return;
    event.preventDefault();
    event.stopPropagation();

    const {data:{session}}=await supabaseClient.auth.getSession();

    if(!session||!session.user){
        loginPanel.classList.add('open');
        loginEmail.focus();
        return;
    }

    addAlbumModal.style.display='flex';
    albumSearchInput.focus();
});

const emptyCollectionAddButton=document.getElementById('emptyCollectionAddButton');
const loginToViewCollection=document.getElementById('loginToViewCollection');
const loginToViewCollectionButton=document.getElementById('loginToViewCollectionButton');
const emptyViewedCollection=document.getElementById('emptyViewedCollection');

emptyCollectionAddButton.addEventListener('click',async function(event){
    event.preventDefault();
    event.stopPropagation();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const user=session&&session.user;

    if(!user){
        loginPanel.classList.add('open');
        return;
    }

    addAlbumModal.style.display='flex';
});

loginToViewCollectionButton.addEventListener('click',function(event){
    event.preventDefault();
    event.stopPropagation();

    loginPanel.classList.add('open');
    loginEmail.focus();
});

closeAddAlbum.addEventListener('click',function(){
    addAlbumModal.style.display='none';
    albumSearchInput.value='';
    albumSearchResults.innerHTML='';
});

addAlbumModal.addEventListener('click',function(event){
    if(event.target===addAlbumModal){
        addAlbumModal.style.display='none';
        albumSearchInput.value='';
        albumSearchResults.innerHTML='';
    }
});

albumSearchInput.addEventListener('input',function(){
    const query=albumSearchInput.value.trim();

    clearTimeout(searchTimer);

    if(query.length<2){

        albumSearchResults.innerHTML='';
        return;
    }

    albumSearchResults.innerHTML='<p>Söker...</p>';

    searchTimer=setTimeout(function(){
        searchDiscogs(query);
    },250);
});

function escapeHTML(text){
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

let musicBrainzSearchNumber=0;
const appleAlbumSearchCache=new Map();
const theAudioDBAlbumSearchCache=new Map();
const THEAUDIODB_FREE_KEY='123';
const THEAUDIODB_RATE_LIMIT_COOLDOWN=65000;
let theAudioDBBlockedUntil=0;

async function loadOtherUserCollection(userId){
    var loadVersion=++window.collectionLoadVersion;
    viewedUserId=userId;

    deleteMode=false;
    deleteModeButton.classList.remove('active');
    document.body.classList.remove('delete-mode-active');
    
    const {data:profile,error:profileError}=await supabaseClient
        .from('profiles')
        .select('username,avatar_url')
        .eq('id',userId)
        .maybeSingle();

    if(profileError){
        console.error('Kunde inte hämta användarprofil:',profileError);
        return;
    }

    const viewedUserHeader=document.getElementById('viewedUserHeader');
    const viewedUserAvatar=document.getElementById('viewedUserAvatar');
    const viewedUserName=document.getElementById('viewedUserName');

    viewedUserHeader.style.display='flex';
    backToMyCollectionMobileButton.classList.add('active');

    viewedUserAvatar.style.backgroundImage='url("'+
        (profile&&profile.avatar_url
            ?profile.avatar_url
            :'/groovy/avatar_placeholder.png')+
        '")';

    viewedUserAvatar.style.backgroundSize='cover';
    viewedUserAvatar.style.backgroundPosition='center';

    viewedUserName.textContent=(profile&&profile.username
        ?profile.username
        :'Unknown user')+(window.libraryView==='wishlist'?"'s wishlist":"'s collection");

    if(window.libraryView==='wishlist'){
        await window.loadWishlist(userId);
        return;
    }

    const {data,error}=await supabaseClient
        .from('collections')
        .select(`
            id,
            collection_number,
            sort_order,
            cover_url,
            albums(
                id,
                title,
                release_year,
                genre,
                cover_url,
                artists(
                    id,
                    name
                ),
                tracks(
                    id,
                    disc_side,
                    track_number,
                    title
                )
            )
        `)
        .eq('user_id',userId)
        .order('sort_order',{ascending:true});

    if(error){
        console.error('Kunde inte hämta användarens samling:',error);
        return;
    }

    var albumIds=data
        .map(function(item){
            return item.albums&&item.albums.id;
        })
        .filter(Boolean);

    var albumRatings={};

    if(albumIds.length){
        var {data:albumRatingData,error:albumRatingError}=await supabaseClient
            .from('album_ratings')
            .select('album_id,rating')
            .eq('user_id',userId)
            .in('album_id',albumIds);

        if(albumRatingError){
            console.error('Kunde inte hämta användarens albumratings:',albumRatingError);
        }else{
            albumRatingData.forEach(function(item){
                albumRatings[item.album_id]=item.rating||0;
            });
        }
    }

    var trackIds=[];

    data.forEach(function(item){
        if(item.albums&&Array.isArray(item.albums.tracks)){
            item.albums.tracks.forEach(function(track){
                if(track.id)trackIds.push(track.id);
            });
        }
    });

    var trackRatings={};

    if(trackIds.length){
        var {data:trackRatingData,error:trackRatingError}=await supabaseClient
            .from('track_ratings')
            .select('track_id,rating')
            .eq('user_id',userId)
            .in('track_id',trackIds);

        if(trackRatingError){
            console.error('Kunde inte hämta användarens låtratings:',trackRatingError);
        }else{
            trackRatingData.forEach(function(item){
                trackRatings[item.track_id]=item.rating||0;
            });
        }
    }

     if(loadVersion!==window.collectionLoadVersion)return;

    records=data
        .filter(function(item){
            return item.albums;
        })
        .map(function(item,index){
            var album=item.albums;

            var artist=
                album.artists&&album.artists.name
                    ?album.artists.name.replace(/\s*\(\d+\)$/,'')
                    :'Okänd artist';

            var sides={
                A:[],
                B:[],
                C:[],
                D:[]
            };

            if(Array.isArray(album.tracks)){
                album.tracks
                    .sort(function(a,b){
                        return (a.id||0)-(b.id||0);
                    })
                    .forEach(function(track){
                        var side=track.disc_side;

                        if(!sides[side])return;

                        sides[side].push({
                            id:track.id,
                            title:track.title||'Okänd låt',
                            rating:trackRatings[track.id]||0
                        });
                    });
            }

            return [
                index+1,
                artist,
                album.title||'Okänd titel',
                album.release_year||'',
                album.genre||'',
                albumRatings[album.id]||0,
                item.cover_url||album.cover_url||'',
                sides,
                album.id,
                item.id
            ];
        });

    document.getElementById('collectionCount').textContent=records.length+' RECORDS IN COLLECTION';

    buildGrid();
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


async function searchDiscogs(query){
    const searchNumber=++musicBrainzSearchNumber;

    albumSearchResults.innerHTML='<p>Söker...</p>';

    try{
        const {data:{user}}=await supabaseClient.auth.getUser();
        if(!user)throw new Error('Du måste vara inloggad.');

        const [collectionState,wishlistState]=await Promise.all([
            supabaseClient
                .from('collections')
                .select('albums(discogs_master_id,title,artists(name))')
                .eq('user_id',user.id),
            supabaseClient
                .from('wishlists')
                .select('albums(discogs_master_id,title,artists(name))')
                .eq('user_id',user.id)
        ]);

        if(collectionState.error)throw collectionState.error;
        if(wishlistState.error)throw wishlistState.error;

        const existingMasterIds=(collectionState.data||[])
            .map(function(item){return item.albums&&String(item.albums.discogs_master_id||'');})
            .filter(Boolean);
        const wishlistedMasterIds=(wishlistState.data||[])
            .map(function(item){return item.albums&&String(item.albums.discogs_master_id||'');})
            .filter(Boolean);
        const existingAlbumKeys=(collectionState.data||[])
            .map(function(item){
                var album=item.albums;
                return album&&window.albumIdentityKey(album.artists&&album.artists.name,album.title);
            })
            .filter(Boolean);
        const wishlistedAlbumKeys=(wishlistState.data||[])
            .map(function(item){
                var album=item.albums;
                return album&&window.albumIdentityKey(album.artists&&album.artists.name,album.title);
            })
            .filter(Boolean);

        const {data,error}=await supabaseClient.functions.invoke('discogs-search',{
            body:{query:query}
        });

        if(error){
            console.error('Discogs error:',error);
            throw error;
        }

        if(searchNumber!==musicBrainzSearchNumber)return;

        albumSearchResults.innerHTML='';

        const results=data&&data.results?data.results:[];

        if(!results.length){
            albumSearchResults.innerHTML='<p>Inga album hittades.</p>';
            return;
        }
        const searchResults=results.slice(0,10);
        
        // Prefer TheAudioDB for a stable, canonical album cover. Queries run
        // sequentially so one search cannot create a burst of ten requests.
        const theAudioDBArtworkResults=[];

        for(let resultIndex=0;resultIndex<searchResults.length;resultIndex+=1){
            if(searchNumber!==musicBrainzSearchNumber)return;

            const resultTitle=searchResults[resultIndex].title||'Okänd titel';
            const resultParts=resultTitle.split(' - ');
            const resultArtist=resultParts.length>1
                ?resultParts[0].replace(/\s*\(\d+\)$/,'')
                :'Okänd artist';
            const resultAlbumTitle=resultParts.length>1
                ?resultParts.slice(1).join(' - ')
                :resultTitle;
            const theAudioDBResult=await searchTheAudioDBAlbumArtwork(
                resultArtist,
                resultAlbumTitle
            );

            theAudioDBArtworkResults.push(theAudioDBResult.url);

            if(theAudioDBResult.rateLimited){
                while(theAudioDBArtworkResults.length<searchResults.length){
                    theAudioDBArtworkResults.push('');
                }
                break;
            }
        }

        // Apple is a temporary fallback when TheAudioDB has no match, is
        // unavailable or has returned 429. A short circuit breaker prevents
        // repeated calls to TheAudioDB throughout its cooldown minute.
        let appleSearchResults=[];
        const appleQueryKey=normalizeAppleFullTitle(query);
        const needsAppleFallback=theAudioDBArtworkResults.some(function(url){
            return !url;
        });

        if(needsAppleFallback&&appleAlbumSearchCache.has(appleQueryKey)){
            appleSearchResults=appleAlbumSearchCache.get(appleQueryKey);
        }else if(needsAppleFallback){
            try{
                const appleResponse=await fetch(
                    'https://itunes.apple.com/search?term='+
                    encodeURIComponent(query)+
                    '&entity=album&limit=100&country=SE'
                );

                if(appleResponse.ok){
                    const appleData=await appleResponse.json();
                    appleSearchResults=appleData.results||[];
                    appleAlbumSearchCache.set(appleQueryKey,appleSearchResults);
                }else{
                    console.warn('Apple album search status:',appleResponse.status);
                }
            }catch(appleError){
                console.warn('Apple album search unavailable:',appleError);
            }
        }

        const appleArtworkResults=searchResults.map(function(master){
            const title=master.title||'Okänd titel';
            const parts=title.split(' - ');
            const artist=parts.length>1
                ?parts[0].replace(/\s*\(\d+\)$/,'')
                :'Okänd artist';
            const albumTitle=parts.length>1?parts.slice(1).join(' - '):title;
            const appleAlbum=pickBestAppleAlbum(
                appleSearchResults,
                artist,
                albumTitle,
                master.year
            );

            return appleArtworkUrl(appleAlbum);
        });
        
        searchResults.forEach(function(master,index){
        
            const title=master.title||'Okänd titel';
            const parts=title.split(' - ');
        
            const artist=parts.length>1
                ?parts[0].replace(/\s*\(\d+\)$/,'')
                :'Okänd artist';
        
            const albumTitle=parts.length>1
                ?parts.slice(1).join(' - ')
                :title;
            const resultAlbumKey=window.albumIdentityKey(artist,albumTitle);
            const isAdded=existingMasterIds.includes(String(master.id))||existingAlbumKeys.includes(resultAlbumKey);
            const isWishlisted=wishlistedMasterIds.includes(String(master.id))||wishlistedAlbumKeys.includes(resultAlbumKey);
        
            const year=master.year||'';
        
            const theAudioDBImageUrl=theAudioDBArtworkResults[index]||'';
            const appleImageUrl=appleArtworkResults[index]||'';
            const discogsImageUrl=master.cover_image||master.thumb||'';
            const imageUrl=theAudioDBImageUrl||appleImageUrl||discogsImageUrl;
            const imageSource=theAudioDBImageUrl
                ?'theaudiodb'
                :(appleImageUrl?'apple':(discogsImageUrl?'discogs':''));
        
            const masterId=master.id||'';
        
            const div=document.createElement('div');
        
            div.className='mb-result';
        
            div.innerHTML=
                (imageUrl
                    ?'<img class="mb-cover" src="'+
                        escapeHTML(imageUrl)+
                        '" alt="" onerror="this.style.display=\'none\'">'
                    :'')+
        
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
                          :'<button class="mb-add-button">Add</button>'))+
                  (isAdded
                      ?'<button class="mb-wishlist-button mb-wishlisted" disabled>In collection</button>'
                      :(isWishlisted
                          ?'<button class="mb-wishlist-button mb-wishlisted" disabled>✓ Wishlisted</button>'
                          :'<button class="mb-wishlist-button"><span class="wishlist-icon" aria-hidden="true"></span>Wishlist</button>'))+
                '</div>';
        
            const addButton=
                div.querySelector('.mb-add-button');
            const wishlistButton=div.querySelector('.mb-wishlist-button');
        
            addButton.addEventListener(
                'click',
                function(event){
        
                    event.stopPropagation();
        
                    addAlbumFromDiscogs(
                        master,
                        artist,
                        albumTitle,
                        year,
                        imageUrl,
                        imageSource,
                        addButton
                    );
                }
            );

            wishlistButton.addEventListener('click',function(event){
                event.stopPropagation();
                addAlbumToWishlistFromDiscogs(
                    master,
                    artist,
                    albumTitle,
                    year,
                    imageUrl,
                    imageSource,
                    wishlistButton
                );
            });
        
            albumSearchResults.appendChild(div);
        });


    }catch(error){

        console.error('Discogs-fel:',error);

        if(searchNumber===musicBrainzSearchNumber){

            albumSearchResults.innerHTML=
                '<p>Kunde inte kontakta Discogs.</p>';
        }
    }
}

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

async function searchTheAudioDBAlbumArtwork(artist,albumTitle){
    var cacheKey=normalizeAppleFullTitle(artist)+'|'+normalizeAppleFullTitle(albumTitle);

    if(theAudioDBAlbumSearchCache.has(cacheKey)){
        return {url:theAudioDBAlbumSearchCache.get(cacheKey),rateLimited:false};
    }

    if(Date.now()<theAudioDBBlockedUntil){
        return {url:'',rateLimited:true};
    }

    try{
        var response=await fetch(
            'https://www.theaudiodb.com/api/v1/json/'+THEAUDIODB_FREE_KEY+
            '/searchalbum.php?s='+encodeURIComponent(artist)+
            '&a='+encodeURIComponent(albumTitle)
        );

        if(response.status===429){
            theAudioDBBlockedUntil=Date.now()+THEAUDIODB_RATE_LIMIT_COOLDOWN;
            console.warn('TheAudioDB rate limit reached; using Apple temporarily.');
            return {url:'',rateLimited:true};
        }

        if(!response.ok){
            console.warn('TheAudioDB album search status:',response.status);
            return {url:'',rateLimited:false};
        }

        var data=await response.json();
        var wantedArtist=normalizeAppleFullTitle(artist);
        var wantedAlbum=normalizeAppleFullTitle(albumTitle);
        var match=(data.album||[]).find(function(item){
            return normalizeAppleFullTitle(item.strArtist)===wantedArtist&&
                normalizeAppleFullTitle(item.strAlbum)===wantedAlbum&&
                item.strAlbumThumb;
        });
        var imageUrl=match&&match.strAlbumThumb?match.strAlbumThumb:'';

        theAudioDBAlbumSearchCache.set(cacheKey,imageUrl);
        return {url:imageUrl,rateLimited:false};
    }catch(error){
        console.warn('TheAudioDB album search unavailable:',error);
        return {url:'',rateLimited:false};
    }
}

function appleArtistMatches(candidate,artist){
    var candidateText=normalizeAppleSearchText(candidate);
    var artistText=normalizeAppleSearchText(artist);

    return candidateText===artistText||
        candidateText.indexOf(artistText+' ')===0||
        artistText.indexOf(candidateText+' ')===0;
}

function appleAlbumMatches(candidate,albumTitle){
    var candidateText=normalizeAppleSearchText(candidate);
    var albumText=normalizeAppleSearchText(albumTitle);

    // Accept the exact title and Apple edition suffixes. The separate edition
    // filter below still blocks deluxe, single, remix and live releases.
    return candidateText===albumText||
        candidateText.indexOf(albumText+' ')===0;
}

function appleArtworkUrl(album){
    return album&&album.artworkUrl100
        ?album.artworkUrl100.replace('100x100bb','1200x1200bb')
        :'';
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

function pickBestAppleAlbum(results,artist,albumTitle,originalYear){
    var wantedTitle=normalizeAppleFullTitle(albumTitle);
    var wantedYear=parseInt(originalYear,10)||0;

    return (results||[])
        .filter(function(item){
            return appleArtistMatches(item.artistName,artist)&&
                appleAlbumMatches(item.collectionName,albumTitle)&&
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
    try{
        var directTerm=encodeURIComponent(artist+' '+albumTitle);
        var directResponse=await fetch(
            'https://itunes.apple.com/search?term='+directTerm+'&entity=album&limit=50'
        );

        if(!directResponse.ok){
            throw new Error('Apple album search failed');
        }

        var directData=await directResponse.json();
        var directResult=pickBestAppleAlbum(
            directData.results,
            artist,
            albumTitle,
            originalYear
        );

        if(directResult){
            return appleArtworkUrl(directResult);
        }

        // A combined artist/title search occasionally fails to surface an
        // exact album even though it exists in Apple's catalogue. Retry with
        // the title alone and keep the same strict artist/title validation.
        var titleResponse=await fetch(
            'https://itunes.apple.com/search?term='+encodeURIComponent(albumTitle)+'&entity=album&limit=100'
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
                return appleArtworkUrl(titleResult);
            }
        }

        // Vissa album finns i Apple-katalogen men returneras inte av
        // albumsökningen. Låtsökningen innehåller då fortfarande albumets
        // collectionName och samma omslag, vilket ger en säker andra chans.
        var songResponse=await fetch(
            'https://itunes.apple.com/search?term='+directTerm+'&entity=song&limit=100&country=SE'
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
                return appleArtworkUrl(songResult);
            }
        }

        // Behåll artist-lookup som andra chans för album som Apple inte
        // returnerar från den kombinerade sökningen.
        var artistQuery=encodeURIComponent(artist);
        var artistResponse=await fetch(
            'https://itunes.apple.com/search?term='+artistQuery+'&entity=musicArtist&limit=10'
        );

        if(!artistResponse.ok){
            throw new Error('Apple artist search failed');
        }

        var artistData=await artistResponse.json();
        var artistResult=(artistData.results||[]).find(function(item){
            return appleArtistMatches(item.artistName,artist)&&item.artistId;
        });

        if(!artistResult){
            return '';
        }

        var lookupResponse=await fetch(
            'https://itunes.apple.com/lookup?id='+artistResult.artistId+'&entity=album&limit=200'
        );

        if(!lookupResponse.ok){
            throw new Error('Apple album lookup failed');
        }

        var lookupData=await lookupResponse.json();
        var albumResult=pickBestAppleAlbum(
            lookupData.results,
            artist,
            albumTitle,
            originalYear
        );

        return appleArtworkUrl(albumResult);

    }catch(error){
        console.error('Apple artwork error:',error);
        return '';
    }
}

async function saveAlbumFromDiscogs(master,artist,albumTitle,year,previewCoverUrl,previewCoverSource,button,destination){
    var isWishlistDestination=destination==='wishlist';
    if(button.classList.contains(isWishlistDestination?'mb-wishlisted':'mb-added'))return;

    button.textContent='Sparar...';
    button.disabled=true;

    try{
        const masterId=master.id;

        if(!masterId){
            throw new Error('Master Release saknar ID');
        }

        const {data,error}=await supabaseClient.functions.invoke(
            'discogs-search',
            {
                body:{
                    action:'master',
                    masterId:masterId
                }
            }
        );

        if(error){
            console.error('Discogs master error:',error);
            throw error;
        }

        const discogsTitle=data.title||albumTitle;
        const discogsYear=parseInt(data.year||year,10)||null;

        const discogsGenre=
            data.genres &&
            data.genres.length
                ?data.genres[0]
                :'';

        const discogsArtist=
            data.artists &&
            data.artists.length &&
            data.artists[0].name
                ?data.artists[0].name.replace(/\s*\(\d+\)$/,'')
                :artist;

        const tracklist=
            data &&
            Array.isArray(data.tracklist)
                ?data.tracklist
                :[];

        let finalTracklist=tracklist;
        
        const hasDiscSides=tracklist.some(function(track){
            const position=String(track.position||'').toUpperCase();
            return /^[A-D]\d/.test(position);
        });
        
        if(!hasDiscSides){
            const {
                data:vinylData,
                error:vinylError
            }=await supabaseClient.functions.invoke(
                'discogs-search',
                {
                    body:{
                        action:'vinylRelease',
                        masterId:masterId
                    }
                }
            );
        
            if(vinylError){
                console.error(
                    'Kunde inte hämta vinyl-release:',
                    vinylError
                );
            }else if(
                vinylData &&
                Array.isArray(vinylData.tracklist) &&
                vinylData.tracklist.length
            ){
                finalTracklist=vinylData.tracklist;
        
            }
        }

        // Preserve exactly the cover shown in the search result. The cover is
        // also stored on the user's collection/wishlist row below, so a shared
        // album record cannot silently replace it with an older image.
        let coverUrl=previewCoverUrl||'';

        // Discogs search results may use a small thumbnail. The master
        // response contains the original image for the same release, so use
        // that when Discogs supplied the preview.
        if(previewCoverSource==='discogs'&&data.images&&data.images.length&&data.images[0].uri){
            coverUrl=data.images[0].uri;
        }

        if(!coverUrl){
            coverUrl=await searchAppleAlbumArtwork(
                discogsArtist,
                discogsTitle,
                discogsYear
            );
        }

        if(!coverUrl&&data.images&&data.images.length&&data.images[0].uri){
            coverUrl=data.images[0].uri;
        }

        let albumId=null;
        const {data:existingAlbums,error:existingAlbumError}=await supabaseClient
            .from('albums')
            .select('id')
            .eq('discogs_master_id',String(masterId))
            .limit(1);

        if(existingAlbumError)throw existingAlbumError;
        if(existingAlbums&&existingAlbums.length){
            albumId=existingAlbums[0].id;

        }

        if(!albumId){
        let artistId=null;

        const {
            data:existingArtists,
            error:artistSearchError
        }=await supabaseClient
            .from('artists')
            .select('id,name')
            .eq('name',discogsArtist)
            .limit(1);

        if(artistSearchError){
            throw artistSearchError;
        }

        if(existingArtists && existingArtists.length){
            artistId=existingArtists[0].id;
        }else{
            const {
                data:newArtist,
                error:newArtistError
            }=await supabaseClient
                .from('artists')
                .insert({
                    name:discogsArtist
                })
                .select('id')
                .single();

            if(newArtistError){
                throw newArtistError;
            }

            artistId=newArtist.id;
        }

        const {
            data:newAlbum,
            error:albumError
        }=await supabaseClient
            .from('albums')
            .insert({
                artist_id:artistId,
                title:discogsTitle,
                release_year:discogsYear,
                genre:discogsGenre,
                cover_url:coverUrl,
                discogs_master_id:String(masterId)
            })
            .select('id')
            .single();

        if(albumError){
            throw albumError;
        }

        albumId=newAlbum.id;

        if(finalTracklist.length){
        const rawTracks=[];
        
        finalTracklist.forEach(function(track){
            if(track.type_==='track'){
                rawTracks.push(track);
            }
        
            if(Array.isArray(track.sub_tracks)){
                track.sub_tracks.forEach(function(subTrack){
                    if(subTrack.type_==='track'){
                        rawTracks.push(subTrack);
                    }
                });
            }
        });
            
            const hasDiscSides=rawTracks.some(function(track){
                const position=String(track.position||'').toUpperCase();
                return /^[A-D]\d/.test(position);
            });
            
            const tracks=rawTracks.map(function(track,index){
                const position=String(track.position||'').toUpperCase();
            
                let discSide='';
                let trackNumber=null;
            
                if(hasDiscSides){
                    if(position.startsWith('A')){
                        discSide='A';
                    }else if(position.startsWith('B')){
                        discSide='B';
                    }else if(position.startsWith('C')){
                        discSide='C';
                    }else if(position.startsWith('D')){
                        discSide='D';
                    }
            
                    trackNumber=parseInt(position.substring(1),10);
                }else{
                    const middle=Math.ceil(rawTracks.length/2);
            
                    if(index<middle){
                        discSide='A';
                        trackNumber=index+1;
                    }else{
                        discSide='B';
                        trackNumber=index-middle+1;
                    }
                }
            
                return {
                    album_id:albumId,
                    disc_side:discSide,
                    track_number:Number.isNaN(trackNumber)?null:trackNumber,
                    title:track.title||'Okänd låt'
                };
            });

            if(tracks.length){
                const {
                    error:tracksError
                }=await supabaseClient
                    .from('tracks')
                    .insert(tracks);

                if(tracksError){
                    throw tracksError;
                }
            }
        }
        }

        const {
            data:{
                user
            }
        }=await supabaseClient.auth.getUser();

        if(!user){
            throw new Error(
                'Du måste vara inloggad för att lägga till album.'
            );
        }

        if(isWishlistDestination){
            const {data:collectionRows,error:collectionMatchError}=await supabaseClient
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
            });

            if(collectionMatch){
                setSearchResultStatus(button,'collection');
                return;
            }

            const {data:lastWishlist,error:lastWishlistError}=await supabaseClient
                .from('wishlists')
                .select('sort_order')
                .eq('user_id',user.id)
                .order('sort_order',{ascending:false,nullsFirst:false})
                .limit(1);

            if(lastWishlistError)throw lastWishlistError;

            const nextWishlistSortOrder=lastWishlist&&lastWishlist.length&&lastWishlist[0].sort_order
                ?lastWishlist[0].sort_order+1
                :1;

            const {error:wishlistError}=await supabaseClient
                .from('wishlists')
                .insert({
                    user_id:user.id,
                    album_id:albumId,
                    cover_url:coverUrl,
                    sort_order:nextWishlistSortOrder
                });

            if(wishlistError&&wishlistError.code!=='23505')throw wishlistError;

            setSearchResultStatus(button,'wishlist');
            if(window.libraryView==='wishlist')await window.loadCollection();
            return;
        }

        const {data:lastCollection,error:lastCollectionError}=await supabaseClient
            .from('collections')
            .select('sort_order')
            .eq('user_id',user.id)
            .order('sort_order',{ascending:false})
            .limit(1);
        
        if(lastCollectionError){
            throw lastCollectionError;
        }
        
        const nextSortOrder=
            lastCollection&&lastCollection.length
                ?lastCollection[0].sort_order+1
                :1;
        
        const {
            error:collectionError
        }=await supabaseClient
            .from('collections')
            .insert({
                user_id:user.id,
                album_id:albumId,
                cover_url:coverUrl,
                sort_order:nextSortOrder
            });
        
        if(collectionError){
            throw collectionError;
        }

        setSearchResultStatus(button,'collection');
        
        await window.loadCollection();

    }catch(error){
        console.error(
            'Kunde inte spara Discogs-album:',
            error
        );

        button.innerHTML=isWishlistDestination
            ?'<span class="wishlist-icon" aria-hidden="true"></span>Wishlist'
            :'Add';
        button.disabled=false;

        alert(
            'Kunde inte spara albumet.\n\n'+
            (error.message||error)
        );
    }
}

function addAlbumFromDiscogs(master,artist,albumTitle,year,previewCoverUrl,previewCoverSource,button){
    return saveAlbumFromDiscogs(master,artist,albumTitle,year,previewCoverUrl,previewCoverSource,button,'collection');
}

function addAlbumToWishlistFromDiscogs(master,artist,albumTitle,year,previewCoverUrl,previewCoverSource,button){
    return saveAlbumFromDiscogs(master,artist,albumTitle,year,previewCoverUrl,previewCoverSource,button,'wishlist');
}

async function loadUserFromUrl(){
    var username=GroovyRouteState.profileUsernameFromPath(window.location.pathname);

    if(!username)return window.loadCollection();

    const {data:{session}}=await supabaseClient.auth.getSession();
    const sessionUser=session&&session.user;
    window.hasAuthenticatedUser=!!sessionUser;
    const unresolvedState=GroovyRouteState.resolveProfileView(sessionUser,null);

    if(unresolvedState==='login-required'){
        viewedUserId='profile-route';
        records=[];
        window.loginRequiredForViewedCollection=true;
        window.profileNotFound=false;
        document.getElementById('viewedUserHeader').style.display='none';
        backToMyCollectionMobileButton.classList.remove('active');
        document.getElementById('collectionCount').textContent='0 RECORDS';
        buildGrid();
        return;
    }

    const {data:user,error}=await supabaseClient
        .from('profiles')
        .select('id')
        .ilike('username',username)
        .maybeSingle();

    if(error){
        console.error('Kunde inte hitta användaren:',error);
        return;
    }

    if(!user){
        viewedUserId='profile-route';
        records=[];
        window.loginRequiredForViewedCollection=false;
        window.profileNotFound=true;
        document.getElementById('viewedUserHeader').style.display='none';
        backToMyCollectionMobileButton.classList.remove('active');
        document.getElementById('collectionCount').textContent='0 RECORDS';
        buildGrid();
        return;
    }

    const resolvedState=GroovyRouteState.resolveProfileView(sessionUser,user);

    if(resolvedState==='own'){
        history.replaceState({},'','/groovy/'+(window.libraryView==='wishlist'?'?view=wishlist':''));
        await window.loadCollection();
        return;
    }

    window.loginRequiredForViewedCollection=false;
    window.profileNotFound=false;
    await loadOtherUserCollection(user.id);
}

window.addEventListener('popstate',function(){
    renderCurrentRoute();
});

async function renderCurrentRoute(){
    window.libraryView=GroovyRouteState.libraryViewFromSearch(window.location.search);
    await updateAuthUI();
    await loadUserFromUrl();
}

renderCurrentRoute();
