(function(){
  var page=document.getElementById('statisticsPage');
  var content=document.getElementById('statisticsContent');
  var closeButton=document.getElementById('closeStatisticsPage');
  var ownButton=document.getElementById('statisticsButton');
  var viewedButton=document.getElementById('viewedUserStatsButton');
  var copyProfileButton=document.getElementById('copyProfileLinkButton');
  var requestVersion=0;
  var previousOverflow='';
  var openedWithHistory=false;

  function escapeHtml(value){
    return String(value===undefined||value===null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
  }

  function coverUrl(value){
    return value||'/avatar_placeholder.png';
  }

  function spotifySearchUrl(release){
    return 'https://open.spotify.com/search/'+encodeURIComponent([release.artist,release.title].filter(Boolean).join(' '));
  }

  function appleSearchUrl(release){
    if(release&&release.appleUrl)return release.appleUrl;
    return 'https://music.apple.com/us/search?term='+encodeURIComponent([release.artist,release.title].filter(Boolean).join(' '));
  }

  function hideStatistics(){
    requestVersion++;
    page.classList.remove('visible');
    page.setAttribute('aria-hidden','true');
    document.body.style.overflow=previousOverflow;
  }

  function statisticsUrl(active){
    var url=new URL(window.location.href);
    if(active)url.searchParams.set('stats','1');
    else url.searchParams.delete('stats');
    return url.pathname+url.search+url.hash;
  }

  function closeStatistics(){
    if(!page.classList.contains('visible'))return;
    if(GroovyRouteState.statisticsFromSearch(window.location.search)){
      if(openedWithHistory){
        openedWithHistory=false;
        history.back();
        return;
      }
      history.replaceState({},'',statisticsUrl(false));
    }
    hideStatistics();
  }

  function metric(label,value,note,accent){
    return '<article class="stats-metric'+(accent?' stats-metric-accent':'')+'"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong><small>'+escapeHtml(note||'')+'</small></article>';
  }

  function rankedBars(title,items,emptyText){
    var max=items.length?items[0].count:1;
    return '<section class="stats-panel stats-ranked"><div class="stats-section-heading"><span>Explore</span><h3>'+escapeHtml(title)+'</h3></div>'+
      (items.length?'<div class="stats-bars">'+items.map(function(item,index){
        var width=Math.max(8,Math.round(item.count/max*100));
        return '<div class="stats-bar-row"><div class="stats-bar-label"><span>'+(index+1)+'. '+escapeHtml(item.label)+'</span><strong>'+item.count+'</strong></div><div class="stats-bar-track"><i style="width:'+width+'%"></i></div></div>';
      }).join('')+'</div>':'<p class="stats-empty">'+escapeHtml(emptyText)+'</p>')+'</section>';
  }

  function releaseStreaming(release){
    return '<div class="stats-release-streaming">'+
      '<a class="stats-release-service stats-release-apple" href="'+escapeHtml(appleSearchUrl(release))+'" target="_blank" rel="noopener noreferrer" aria-label="Listen to '+escapeHtml(release.title)+' on Apple Music"><img src="/apple_wide.svg" alt="Listen on Apple Music"></a>'+
      '<a class="stats-release-service stats-release-spotify" href="'+escapeHtml(spotifySearchUrl(release))+'" target="_blank" rel="noopener noreferrer" aria-label="Find '+escapeHtml(release.title)+' on Spotify"><img src="/spotify_logo.svg" alt="Spotify"></a>'+
    '</div>';
  }

  function releaseCard(label,release){
    if(!release)return '<article class="stats-release stats-release-empty"><span>'+label+'</span><strong>No dated records yet</strong></article>';
    return '<article class="stats-release"><img src="'+escapeHtml(coverUrl(release.cover))+'" alt="" onerror="this.src=\'/avatar_placeholder.png\'"><div class="stats-release-copy"><span>'+label+'</span><strong>'+escapeHtml(release.title)+'</strong><small>'+escapeHtml(release.artist)+' · '+release.year+'</small>'+releaseStreaming(release)+'</div></article>';
  }

  function followingComparisonCard(label,item,type){
    if(!item){
      return '<article class="stats-community-card stats-community-empty"><strong>No comparison yet</strong><small>Follow collectors with records in their shelves to unlock this statistic.</small></article>';
    }
    var value=type==='taste'?Math.round(Number(item.taste_similarity)||0)+'%':Number(item.common_count||0);
    var valueLabel=type==='taste'?'genre match':'records in common';
    var note=type==='taste'?'Closest music taste among collectors you follow':'Most shared collected albums among collectors you follow';
    return '<article class="stats-community-card'+(type==='taste'?' stats-community-card-accent':'')+'">'+
      '<img class="stats-community-avatar" src="'+escapeHtml(item.avatar_url||'/avatar_placeholder.png')+'" alt="" onerror="this.src=\'/avatar_placeholder.png\'">'+
      '<div class="stats-community-copy"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(item.username||'Collector')+'</strong><small>'+escapeHtml(note)+'</small></div>'+
      '<div class="stats-community-value"><strong>'+escapeHtml(value)+'</strong><span>'+escapeHtml(valueLabel)+'</span></div>'+
    '</article>';
  }

  function followingComparisonPanel(social){
    if(!social||!social.isOwn)return '';
    var hasFollowing=social.followingCount>0;
    return '<section class="stats-panel stats-community"><div class="stats-section-heading"><span>Your community</span><h3>Collectors you connect with</h3></div>'+
      '<div class="stats-community-grid">'+
        followingComparisonCard('Most records in common',hasFollowing?social.mostCommon:null,'common')+
        followingComparisonCard('Closest music taste',hasFollowing?social.closestTaste:null,'taste')+
      '</div>'+
      (hasFollowing?'<p class="stats-community-note">Music taste match compares the full genre mix across both collections. 100% means the genre distributions are identical; genres that do not overlap lower the score.</p>':'')+
    '</section>';
  }

  async function fetchFollowingComparisons(userId){
    var sessionResult=await supabaseClient.auth.getSession();
    var sessionUser=sessionResult.data&&sessionResult.data.session&&sessionResult.data.session.user;
    if(!sessionUser||String(sessionUser.id)!==String(userId))return {isOwn:false,followingCount:0,mostCommon:null,closestTaste:null};

    var response=await supabaseClient.rpc('get_following_statistics');
    if(response.error){
      console.warn('Could not load following statistics:',response.error);
      return {isOwn:true,followingCount:0,mostCommon:null,closestTaste:null};
    }

    var rows=(response.data||[]).slice();
    var mostCommon=rows.slice().sort(function(a,b){
      return Number(b.common_count||0)-Number(a.common_count||0)||String(a.username||'').localeCompare(String(b.username||''));
    })[0]||null;
    var closestTaste=rows.slice().sort(function(a,b){
      return Number(b.taste_similarity||0)-Number(a.taste_similarity||0)||Number(b.common_count||0)-Number(a.common_count||0)||String(a.username||'').localeCompare(String(b.username||''));
    })[0]||null;

    return {isOwn:true,followingCount:rows.length,mostCommon:mostCommon,closestTaste:closestTaste};
  }

  function render(profile,stats,social){
    var topStyle=stats.topStyles[0];
    var topArtist=stats.topArtists[0];
    var topDecade=stats.topDecades[0];
    var topCountry=stats.topCountries[0];
    var rating=stats.averageAlbumRating?stats.averageAlbumRating.toFixed(1):'—';
    var avatar=profile.avatar_url||'/avatar_placeholder.png';

    content.innerHTML=
      '<section class="stats-hero"><div class="stats-hero-profile"><img src="'+escapeHtml(avatar)+'" alt=""><div><span class="stats-kicker">Collection insights</span><h1>'+escapeHtml(profile.username||'Groovy listener')+'</h1><p>A snapshot of the records, eras and sounds that shape this collection.</p></div></div><div class="stats-hero-groove" aria-hidden="true"></div></section>'+
      '<section class="stats-metric-grid">'+
        metric('Collection',stats.collectionCount,'records on the shelf',true)+
        metric('Wishlist',stats.wishlistCount,'records wanted next')+
        metric('Artists',stats.artistCount,'different artists')+
        metric('Average rating',rating,stats.ratedAlbums?stats.ratedAlbums+' rated records':'No ratings yet')+
      '</section>'+
      '<section class="stats-panel stats-years"><div class="stats-section-heading"><span>Across the years</span><h2>'+escapeHtml(stats.yearSpan?stats.yearSpan+' years of music':'Release timeline')+'</h2></div><div class="stats-release-grid">'+releaseCard('Oldest release',stats.oldest)+releaseCard('Newest release',stats.newest)+'</div></section>'+
      '<section class="stats-feature-grid">'+
        '<article class="stats-feature stats-feature-main"><span>Signature sound</span><strong>'+escapeHtml(topStyle?topStyle.label:'Not enough data')+'</strong><small>'+(topStyle?topStyle.count+' records share this style':'Styles appear as records are added')+'</small></article>'+
        '<article class="stats-feature"><span>Most collected artist</span><strong>'+escapeHtml(topArtist?topArtist.label:'—')+'</strong><small>'+(topArtist?topArtist.count+' records':'No artist data yet')+'</small></article>'+
        '<article class="stats-feature"><span>Strongest decade</span><strong>'+escapeHtml(topDecade?topDecade.label:'—')+'</strong><small>'+(topDecade?topDecade.count+' releases':'No dated releases yet')+'</small></article>'+
      '</section>'+
      followingComparisonPanel(social)+
      '<section class="stats-split">'+rankedBars('Top styles',stats.topStyles,'Add records to reveal the collection’s sound.')+rankedBars('Decades',stats.topDecades,'Release years will build this timeline.')+'</section>'+
      '<section class="stats-panel"><div class="stats-section-heading"><span>The collection</span><h3>More in the grooves</h3></div><div class="stats-detail-grid">'+
        metric('Five-star records',stats.fiveStarAlbums,'personal essentials')+
        metric('Pressings identified',stats.identifiedPressings,stats.pressingCompletion+'% of the collection')+
        metric('Top pressing country',topCountry?topCountry.label:'—',topCountry?topCountry.count+' identified pressings':'No pressing countries yet')+
        metric('Graded records',stats.conditions.reduce(function(sum,item){return sum+item.count;},0),stats.conditions.length?stats.conditions.slice(0,3).map(function(item){return item.label+' '+item.count;}).join(' · '):'No conditions added yet')+
      '</div></section>';
  }

  async function fetchStatistics(userId){
    var results=await Promise.all([
      supabaseClient.from('profiles').select('username,avatar_url').eq('id',userId).maybeSingle(),
      supabaseClient.from('collections').select('id,cover_url,discogs_style,discogs_release_id,media_condition,pressing_country,albums(id,title,release_year,genre,cover_url,apple_collection_url,artists(name))').eq('user_id',userId),
      supabaseClient.from('wishlists').select('id').eq('user_id',userId),
      supabaseClient.from('album_ratings').select('album_id,rating').eq('user_id',userId)
    ]);

    if(results[0].error)throw results[0].error;
    if(results[1].error)throw results[1].error;
    if(results[2].error)throw results[2].error;

    var social=await fetchFollowingComparisons(userId);

    return {
      profile:results[0].data||{},
      stats:window.GroovyStatistics.build(results[1].data||[],(results[2].data||[]).length,results[3].error?[]:results[3].data),
      social:social
    };
  }

  async function openStatistics(userId,profileHint,updateUrl){
    if(updateUrl!==false&&!GroovyRouteState.statisticsFromSearch(window.location.search)){
      history.pushState({groovyStatistics:true},'',statisticsUrl(true));
      openedWithHistory=true;
    }
    var version=++requestVersion;
    previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    page.classList.add('visible');
    page.setAttribute('aria-hidden','false');
    content.innerHTML='<div class="stats-loading"><span></span><strong>Dropping the needle...</strong><small>Building the collection story</small></div>';
    closeButton.focus();

    try{
      var result=await fetchStatistics(userId);
      if(version!==requestVersion)return;
      result.profile.username=result.profile.username||(profileHint&&profileHint.username)||'';
      result.profile.avatar_url=result.profile.avatar_url||(profileHint&&profileHint.avatar_url)||'';
      render(result.profile,result.stats,result.social);
    }catch(error){
      console.error('Could not load statistics:',error);
      if(version!==requestVersion)return;
      content.innerHTML='<div class="stats-loading stats-error"><strong>Statistics could not be loaded</strong><small>Please try again in a moment.</small></div>';
    }
  }

  ownButton.addEventListener('click',async function(){
    profileMenu.classList.remove('open');
    var result=await supabaseClient.auth.getSession();
    var user=result.data&&result.data.session&&result.data.session.user;
    if(user)openStatistics(user.id,{username:profileUsername.textContent});
  });

  viewedButton.addEventListener('click',function(){
    var profile=window.groovyViewedStatisticsProfile;
    if(profile)openStatistics(profile.id,profile);
  });

  copyProfileButton.addEventListener('click',async function(){
    var profile=window.groovyViewedStatisticsProfile;
    if(!profile||!profile.username)return;
    var profileUrl=window.location.origin+'/profile/'+encodeURIComponent(profile.username);
    try{
      await navigator.clipboard.writeText(profileUrl);
      var label=copyProfileButton.querySelector('.viewed-action-label');
      copyProfileButton.classList.add('copied');
      copyProfileButton.setAttribute('aria-label','Profile link copied');
      label.textContent='Copied';
      setTimeout(function(){
        copyProfileButton.classList.remove('copied');
        copyProfileButton.setAttribute('aria-label','Copy profile link');
        label.textContent='Copy link';
      },1600);
    }catch(error){
      window.prompt('Copy profile link:',profileUrl);
    }
  });

  async function openStatisticsFromUrl(){
    if(!GroovyRouteState.statisticsFromSearch(window.location.search))return;
    var sessionResult=await supabaseClient.auth.getSession();
    var sessionUser=sessionResult.data&&sessionResult.data.session&&sessionResult.data.session.user;
    if(!sessionUser)return;
    var username=GroovyRouteState.profileUsernameFromPath(window.location.pathname);

    if(!username){
      openStatistics(sessionUser.id,{username:profileUsername.textContent},false);
      return;
    }

    var profileResult=await supabaseClient.from('profiles').select('id,username,avatar_url').ilike('username',username).maybeSingle();
    if(!profileResult.error&&profileResult.data)openStatistics(profileResult.data.id,profileResult.data,false);
  }

  closeButton.addEventListener('click',closeStatistics);
  page.addEventListener('click',function(event){if(event.target===page)closeStatistics();});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&page.classList.contains('visible'))closeStatistics();});
  window.addEventListener('popstate',function(){
    if(GroovyRouteState.statisticsFromSearch(window.location.search))openStatisticsFromUrl();
    else hideStatistics();
  });

  supabaseClient.auth.onAuthStateChange(function(){
    if(GroovyRouteState.statisticsFromSearch(window.location.search))setTimeout(openStatisticsFromUrl,0);
  });

  openStatisticsFromUrl();
})();
