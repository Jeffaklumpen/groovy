const loginEmail=document.getElementById('loginEmail');
const loginPassword=document.getElementById('loginPassword');
const loginButton=document.getElementById('loginButton');
const logoutButton=document.getElementById('logoutButton');
const loginStatus=document.getElementById('loginStatus');

async function updateAuthUI(){
    const {data:{user}}=await supabaseClient.auth.getUser();

    if(user){
        loginEmail.style.display='none';
        loginPassword.style.display='none';
        loginButton.style.display='none';
        logoutButton.style.display='inline-block';
        loginStatus.textContent='Inloggad';
    }else{
        loginEmail.style.display='inline-block';
        loginPassword.style.display='inline-block';
        loginButton.style.display='inline-block';
        logoutButton.style.display='none';
        loginStatus.textContent='Ej inloggad';
    }
}

loginButton.addEventListener('click',async function(){
    const email=loginEmail.value.trim();
    const password=loginPassword.value;

    if(!email||!password){
        alert('Fyll i e-post och lösenord.');
        return;
    }

    loginButton.disabled=true;
    loginStatus.textContent='Loggar in...';

    const {data,error}=await supabaseClient.auth.signInWithPassword({
        email:email,
        password:password
    });

    if(error){
        console.error('Login error:',error);
        loginStatus.textContent='Inloggningen misslyckades';
        alert(error.message);
        loginButton.disabled=false;
        return;
    }

    console.log('Inloggad användare:',data.user);
    loginButton.disabled=false;

    await updateAuthUI();

});

logoutButton.addEventListener('click',async function(){
    await supabaseClient.auth.signOut();
    await updateAuthUI();
});

supabaseClient.auth.onAuthStateChange(async function(){
    await updateAuthUI();

    if(typeof window.loadCollection==='function'){
        await window.loadCollection();
    }
});

updateAuthUI();

(function(){

var records = [];

window.loadCollection=async function(){
  var {data:{user},error:userError}=await supabaseClient.auth.getUser();

  if(userError){
    console.error(userError);
    return;
  }

  if(!user){
    records=[];
    buildGrid();
    return;
  }

  var {data:collectionData,error:collectionError}=await supabaseClient
    .from('collections')
    .select(`
      id,
      collection_number,
      sort_order,
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
    .eq('user_id',user.id)
    .order('sort_order',{ascending:true});

    if(collectionError){
        console.error('Kunde inte hämta samlingen:',collectionError);
        return;
    }
    
    console.log('SUPABASE COLLECTION:', collectionData);

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

  records=collectionData
    .filter(function(item){
      return item.albums;
    })
    .map(function(item,index){
      var album=item.albums;
      var artist=
        album.artists&&album.artists.name
          ?album.artists.name
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

            sides[side].push(
              (track.title||'Okänd låt')+'|0'
            );
          });
      }

        return [
          index+1,
          artist,
          album.title||'Okänd titel',
          album.release_year||'',
          album.genre||'',
          ratings[album.id]||0,
          album.cover_url||'',
          sides,
          album.id,
          item.id
        ];
    });

  console.log('RECORDS:', records);
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

function esc(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function recordHTML(record, className){
  var smallSrc=record[6];

  var html='<article class="record '+(className||'')+'" draggable="'+(view==='grid'?'true':'false')+'" data-index="'+(parseInt(record[0],10)-1)+'">'+
    '<div class="cover-wrapper">'+
      '<img class="cover" loading="lazy" decoding="async" src="" data-src="'+smallSrc+'" alt="'+esc(record[1]+' - '+record[2])+'">'+
      '<div class="number">'+record[0]+'</div>'+
      '<div class="cover-rating">';

  for(var r=1;r<=5;r++){
    html+=r<=record[5]?'★':'<span class="empty">★</span>';
  }

  html+='</div>'+
    '<button class="delete-cover-button" type="button" aria-label="Ta bort album">🗑</button>'+
    '</div>'+
    '<div class="info">'+
      '<div class="artist">'+esc(record[1])+'</div>'+
      '<div class="album">'+esc(record[2])+'</div>'+
      '<div class="year">'+esc(record[3])+'</div>'+
    '</div>'+
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

  detailNumber.innerHTML=esc(record[0]);
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
  for(var i=1;i<=5;i++){
    stars+=i<=rating?'★':'<span class="empty">★</span>';
  }
  detailRating.innerHTML=stars;

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
      var track=String(tracks[j]);
      var parts=track.split('|');
      var title=parts[0];
      var rating=parseInt(parts[1],10);

      if(isNaN(rating))rating=0;
      rating=Math.max(0,Math.min(5,rating));

      var trackStars='';
      for(var s=1;s<=5;s++){
        trackStars+=s<=rating?'★':'<span class="empty">☆</span>';
      }

      html+='<li><span class="track-title">'+esc(title)+'</span><span class="track-rating">'+trackStars+'</span></li>';
    }

    html+='</ol></section>';
  }

  detailTracks.innerHTML=html||
    '<div style="color:#666;font-size:13px">Ingen låtlista tillagd</div>';

  albumOverlay.className='album-overlay visible';
  document.body.style.overflow='hidden';
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

function attachAlbumClicks(){
  if(collection._albumClickAttached)return;
  collection._albumClickAttached=true;

  collection.addEventListener('click',async function(event){
    var target=event.target||event.srcElement;

    var deleteButton=target.closest
      ?target.closest('.delete-cover-button')
      :null;

    if(deleteButton){
      event.preventDefault();
      event.stopPropagation();

      var recordElement=deleteButton.closest('.record');

      if(!recordElement)return;

      var index=parseInt(recordElement.getAttribute('data-index'),10);

      if(isNaN(index))return;

      if(!confirm('Vill du ta bort albumet från din samling?'))return;

      await deleteCollectionAlbum(index);
      return;
    }

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

function enableGridSorting(){
  if(view!=='grid'||selectedRating!=='all')return;

  var dragged=null;
  var touchTimer=null;
  var touchDragging=false;
  var suppressAlbumClick=false;

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
    var record=event.target.closest('.record');

    if(!record)return;

    dragged=record;
    record.classList.add('dragging');

    if(event.dataTransfer){
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',record.getAttribute('data-index'));
    }
  };

  collection.ondragover=function(event){
    if(!dragged)return;

    event.preventDefault();

    var target=event.target.closest('.record');

    if(!target||target===dragged)return;

    moveDragged(target,event.clientX,event.clientY);
  };

  collection.ondrop=async function(event){
    if(!dragged)return;

    event.preventDefault();

    await finishDrag();

    if(dragged){
      dragged.classList.remove('dragging');
    }

    dragged=null;
  };

  collection.ondragend=function(){
    if(dragged){
      dragged.classList.remove('dragging');
    }

    dragged=null;
  };

  var cards=collection.querySelectorAll('.record');

  for(var i=0;i<cards.length;i++){
    cards[i].ontouchstart=function(event){
      if(event.touches.length!==1)return;

      var card=this;

      touchTimer=setTimeout(function(){
        dragged=card;
        touchDragging=true;
        card.classList.add('dragging');
      },350);
    };

    cards[i].ontouchmove=function(event){
      if(!touchDragging||!dragged)return;

      event.preventDefault();

      var touch=event.touches[0];
      var target=document.elementFromPoint(touch.clientX,touch.clientY);

      if(!target)return;

      var card=target.closest
        ?target.closest('.record')
        :null;

      if(!card||card===dragged)return;

      moveDragged(card,touch.clientX,touch.clientY);
    };

    cards[i].ontouchend=async function(){
      clearTimeout(touchTimer);

      if(!touchDragging||!dragged){
        touchDragging=false;
        return;
      }

      suppressAlbumClick=true;

      await finishDrag();

      if(dragged){
        dragged.classList.remove('dragging');
      }

      dragged=null;
      touchDragging=false;

      setTimeout(function(){
        suppressAlbumClick=false;
      },300);
    };

    cards[i].ontouchcancel=function(){
      clearTimeout(touchTimer);

      if(dragged){
        dragged.classList.remove('dragging');
      }

      dragged=null;
      touchDragging=false;
    };
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

    var {data,error}=await supabaseClient
      .from('collections')
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
      console.error('Ingen collection uppdaterades:',record[9]);
      alert('Supabase uppdaterade ingen rad. Kontrollera RLS-policyn för collections.');
      return false;
    }
  }

  await window.loadCollection();
  return true;
}
    
function buildGrid(){
  collection.className='collection grid';

  var html='';

  for(var i=0;i<records.length;i++){
    var rating=parseInt(records[i][5],10);

    if(selectedRating==='all'||rating===parseInt(selectedRating,10)){
      html+=recordHTML(records[i],'');
    }
  }

  collection.innerHTML=html;
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

loadCollection();

})();

// ========================================
// ADD ALBUM / MUSICBRAINZ
// ========================================

const addAlbumButton=document.getElementById('addAlbumButton');
const addAlbumModal=document.getElementById('addAlbumModal');
const closeAddAlbum=document.getElementById('closeAddAlbum');
const albumSearchInput=document.getElementById('albumSearchInput');
const albumSearchResults=document.getElementById('albumSearchResults');

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

addAlbumButton.addEventListener('click',function(){
    addAlbumModal.style.display='flex';
    albumSearchInput.focus();
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
        if(musicBrainzController){
            musicBrainzController.abort();
        }

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

let musicBrainzController=null;
let musicBrainzSearchNumber=0;




async function searchDiscogs(query){
    const searchNumber=++musicBrainzSearchNumber;

    albumSearchResults.innerHTML='<p>Söker...</p>';

    try{
        const {data,error}=await supabaseClient.functions.invoke('discogs-search',{
            body:{query:query}
        });

        if(error){
            console.error('Discogs error:',error);
            throw error;
        }

        console.log('Discogs Master Release results:',data);

        if(searchNumber!==musicBrainzSearchNumber)return;

        albumSearchResults.innerHTML='';

        const results=data&&data.results?data.results:[];

        if(!results.length){
            albumSearchResults.innerHTML='<p>Inga album hittades.</p>';
            return;
        }
        results.slice(0,10).forEach(function(master){

            const title=master.title||'Okänd titel';
            const parts=title.split(' - ');
            const artist=parts.length>1
                ?parts[0]
                :'Okänd artist';
            const albumTitle=parts.length>1
                ?parts.slice(1).join(' - ')
                :title;


            const year=master.year||'';

            const imageUrl=master.thumb||'';

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

                '<button class="mb-add-button">Add</button>';


            const addButton=
                div.querySelector('.mb-add-button');


            addButton.addEventListener(
                'click',
                function(event){

                    event.stopPropagation();


                    console.log(
                        'Vald Discogs Master Release:',
                        master
                    );


                    addAlbumFromDiscogs(
                        master,
                        artist,
                        albumTitle,
                        year,
                        addButton
                    );
                }
            );


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

async function addAlbumFromDiscogs(master,artist,albumTitle,year,button){
    if(button.classList.contains('mb-added'))return;

    button.textContent='Sparar...';
    button.disabled=true;

    try{
        const masterId=master.id;

        if(!masterId){
            throw new Error('Master Release saknar ID');
        }

        console.log('Discogs Master Release ID:',masterId);

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

        console.log('Discogs Master Release:',data);

        const discogsTitle=data.title||albumTitle;
        const discogsYear=data.year||year;

        const discogsGenre=
            data.genres &&
            data.genres.length
                ?data.genres[0]
                :'';

        const discogsArtist=
            data.artists &&
            data.artists.length &&
            data.artists[0].name
                ?data.artists[0].name
                :artist;

        const tracklist=
            data &&
            Array.isArray(data.tracklist)
                ?data.tracklist
                :[];

        let coverUrl='';

        if(
            data.images &&
            data.images.length &&
            data.images[0].uri
        ){
            coverUrl=data.images[0].uri;
        }

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
                cover_url:coverUrl
            })
            .select('id')
            .single();

        if(albumError){
            throw albumError;
        }

        const albumId=newAlbum.id;

        if(tracklist.length){
            const tracks=tracklist
                .filter(function(track){
                    return track.type_==='track';
                })
                .map(function(track){
                    const position=track.position||'';

                    let discSide='';
                    
                    if(position.startsWith('A')){
                        discSide='A';
                    }else if(position.startsWith('B')){
                        discSide='B';
                    }else if(position.startsWith('C')){
                        discSide='C';
                    }else if(position.startsWith('D')){
                        discSide='D';
                    }

                    const trackNumber=parseInt(
                        position.substring(1),
                        10
                    );

                    return {
                        album_id:albumId,
                        disc_side:discSide,
                        track_number:
                            Number.isNaN(trackNumber)
                                ?null
                                :trackNumber,
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
                sort_order:nextSortOrder
            });
        
        if(collectionError){
            throw collectionError;
        }

        console.log(
            'Album sparat i samlingen:',
            discogsArtist,
            discogsTitle
        );
        
        button.textContent='✓ Added';
        button.classList.add('mb-added');
        
        await window.loadCollection();

    }catch(error){
        console.error(
            'Kunde inte spara Discogs-album:',
            error
        );

        button.textContent='Add';
        button.disabled=false;

        alert(
            'Kunde inte spara albumet.\n\n'+
            (error.message||error)
        );
    }
}
