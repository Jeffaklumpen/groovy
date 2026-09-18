(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(
      require('./community-core.js'),
      require('./user-profile-core.js'),
      require('./streaming-links.js')
    );
  }else{
    root.GroovyCommunityView=factory(root.GroovyCommunityCore,root.GroovyUserProfileCore,root.GroovyStreaming);
  }
})(typeof window!=='undefined'?window:null,function(Core,UserProfileCore,Streaming){
'use strict';

function create(options){
  options=options||{};
  var win=options.window||((typeof window!=='undefined')?window:null);
  var doc=options.document||(win&&win.document)||null;
  var elements=options.elements||{};
  var page=elements.page;
  var content=elements.content;
  var escapeHtml=typeof options.escapeHtml==='function'?options.escapeHtml:function(value){
    return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  };

  if(!Core)throw new Error('Community view requires community core');
  if(!UserProfileCore)throw new Error('Community view requires user profile core');
  if(!Streaming)throw new Error('Community view requires streaming links');
  if(!page||!content)throw new Error('Community view DOM is incomplete');

  function icon(name){
    var paths={
      people:'<path d="M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19c.4-3.3 2.2-5 4.5-5s4.1 1.7 4.5 5M12.5 19c.4-3.3 2.2-5 4.5-5s4.1 1.7 4.5 5"/>',
      record:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".7"/>',
      link:'<path d="M9.5 14.5 14.5 9M7.8 16.2l-1 1a3 3 0 0 1-4.2-4.2l3-3a3 3 0 0 1 4.2 0M16.2 7.8l1-1a3 3 0 1 1 4.2 4.2l-3 3a3 3 0 0 1-4.2 0"/>',
      pulse:'<path d="M2 13h4l2-6 4 12 3-8 2 2h5"/>',
      trophy:'<path d="M8 4h8v4a4 4 0 0 1-8 0V4Zm4 8v4m-4 4h8M6 6H3v1a4 4 0 0 0 5 3M18 6h3v1a4 4 0 0 1-5 3"/>',
      chart:'<path d="M5 19V11M10 19V5M15 19v-7M20 19V8"/>',
      heart:'<path d="M12 20 4.8 13a4.7 4.7 0 0 1 6.7-6.6L12 7l.5-.6a4.7 4.7 0 0 1 6.7 6.6L12 20Z"/>'
    };
    return '<svg class="community-icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.record)+'</svg>';
  }

  function albumIdentity(item){
    item=item||{};
    return {
      title:item.title||item.album_title||'Unknown album',
      artist:item.artist_name||'Unknown artist',
      cover:item.cover_url||'',
      apple:item.apple_collection_url||''
    };
  }

  function serviceLinks(item){
    var identity=albumIdentity(item);
    var apple=Streaming.appleMusicSearchUrl(identity.artist,identity.title,identity.apple,'se');
    var spotify=Streaming.spotifySearchUrl(identity.artist,identity.title);
    return '<span class="community-cover-services" aria-label="Listen on streaming services">'+
      '<a class="community-cover-service community-cover-service-apple" href="'+escapeHtml(apple)+'" target="_blank" rel="noopener noreferrer" aria-label="Open '+escapeHtml(identity.title)+' on Apple Music" title="Apple Music"><img src="/assets/brands/apple-music-badge-small.svg" alt=""></a>'+
      '<a class="community-cover-service community-cover-service-spotify" href="'+escapeHtml(spotify)+'" target="_blank" rel="noopener noreferrer" aria-label="Open '+escapeHtml(identity.title)+' on Spotify" title="Spotify"><img src="/assets/brands/spotify-logo.svg" alt=""></a>'+
    '</span>';
  }

  function coverMarkup(item,extraClass){
    var identity=albumIdentity(item);
    return '<span class="community-cover '+(extraClass||'')+'">'+
      '<span class="community-cover-fallback" aria-hidden="true"><span class="record-icon"></span></span>'+
      (identity.cover?'<img src="'+escapeHtml(identity.cover)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+
      serviceLinks(item)+
    '</span>';
  }

  function avatar(item,className){
    return UserProfileCore.avatarMarkup(className||'community-avatar',item&&item.avatar_url,item&&item.username?item.username:'Collector');
  }

  function summaryCard(iconName,label,value,note){
    return '<article class="community-summary-card">'+
      '<span class="community-summary-icon">'+icon(iconName)+'</span>'+
      '<div><strong data-community-metric="'+escapeHtml(label.toLowerCase())+'" data-raw-value="'+escapeHtml(String(Core.number(value)))+'">'+escapeHtml(Core.formatCount(value))+'</strong><span>'+escapeHtml(label)+'</span><small>'+escapeHtml(note)+'</small></div>'+
    '</article>';
  }

  function similarCollectors(items){
    if(!items.length)return '<div class="community-empty"><strong>No taste matches yet</strong><span>Add more records and Groovy will find collectors with albums in common.</span></div>';
    return '<div class="community-similar-list">'+items.map(function(item){
      var following=!!item.is_following;
      return '<article class="community-similar-card">'+
        '<button class="community-person" type="button" data-community-profile="'+escapeHtml(item.username||'')+'">'+
          avatar(item,'community-similar-avatar')+
          '<span><strong>'+escapeHtml(item.username||'Collector')+'</strong><small>'+escapeHtml(Core.formatCount(item.collection_count))+' records</small></span>'+
        '</button>'+
        '<div class="community-taste-score"><strong>'+escapeHtml(Core.formatCount(item.common_count))+'</strong><span>records in common</span><small>'+escapeHtml(Core.formatCount(item.similarity_percent))+'% collection overlap</small></div>'+
        '<div class="community-similar-actions">'+
          '<button class="community-follow-button'+(following?' following':'')+'" type="button" data-community-follow data-user-id="'+escapeHtml(item.user_id||'')+'" data-following="'+(following?'true':'false')+'">'+(following?'Following':'Follow')+'</button>'+
          '<button class="community-secondary-button" type="button" data-community-shelf="'+escapeHtml(item.username||'')+'">View Shelf</button>'+
        '</div>'+
      '</article>';
    }).join('')+'</div>';
  }

  function activityCopy(item){
    var username=escapeHtml(item.username||'Collector');
    var title=escapeHtml(item.album_title||'an album');
    if(item.activity_type==='wishlist_add')return '<button type="button" data-community-profile="'+username+'">'+username+'</button> added <strong>'+title+'</strong> to their wishlist';
    if(item.activity_type==='album_rating')return '<button type="button" data-community-profile="'+username+'">'+username+'</button> rated <strong>'+title+'</strong> <span class="community-feed-rating">'+escapeHtml(String(Core.clampRating(item.rating)))+' ★</span>';
    return '<button type="button" data-community-profile="'+username+'">'+username+'</button> added <strong>'+title+'</strong> to their shelf';
  }

  function activityFeed(items){
    if(!items.length)return '<div class="community-empty compact"><strong>No activity yet</strong><span>New collection, wishlist and rating activity will appear here.</span></div>';
    return '<div class="community-feed-list">'+items.map(function(item){
      return '<article class="community-feed-item">'+
        '<button class="community-feed-avatar-button" type="button" data-community-profile="'+escapeHtml(item.username||'')+'" aria-label="Open '+escapeHtml(item.username||'Collector')+' profile">'+avatar(item,'community-feed-avatar')+'</button>'+
        coverMarkup(item,'community-feed-cover')+
        '<div class="community-feed-copy"><p>'+activityCopy(item)+'</p><small>'+escapeHtml(item.artist_name||'')+'</small></div>'+
        '<time datetime="'+escapeHtml(item.created_at||'')+'">'+escapeHtml(Core.relativeTime(item.created_at))+'</time>'+
      '</article>';
    }).join('')+'</div>';
  }

  function topCollectors(items){
    if(!items.length)return '<div class="community-empty compact"><strong>No collectors yet</strong></div>';
    return '<div class="community-ranking-list">'+items.map(function(item,index){
      return '<button class="community-collector-rank" type="button" data-community-shelf="'+escapeHtml(item.username||'')+'">'+
        '<span class="community-rank-number rank-'+(index+1)+'">'+(index+1)+'</span>'+
        avatar(item,'community-rank-avatar')+
        '<span class="community-rank-name">'+escapeHtml(item.username||'Collector')+'</span>'+
        '<span class="community-rank-value"><strong>'+escapeHtml(Core.formatCount(item.record_count))+'</strong><small>records</small></span>'+
        '<span class="community-chevron" aria-hidden="true">›</span>'+
      '</button>';
    }).join('')+'</div>';
  }

  function albumRows(items,type){
    var metricKey=type==='rating'?'average_rating':'collection_count';
    if(!items.length)return '<div class="community-empty compact"><strong>Not enough data yet</strong></div>';
    return '<div class="community-stat-list">'+items.map(function(item,index){
      var metric=type==='rating'
        ?'<span class="community-stat-rating">★ '+escapeHtml(String(Core.clampRating(item[metricKey])))+'</span>'
        :'<span class="community-stat-count">'+escapeHtml(Core.formatCount(item[metricKey]))+'</span>';
      return '<article class="community-stat-row">'+
        '<span class="community-stat-rank">'+(index+1)+'</span>'+
        coverMarkup(item,'community-mini-cover')+
        '<div class="community-stat-copy"><strong>'+escapeHtml(item.title||'Unknown album')+'</strong><small>'+escapeHtml(item.artist_name||'Unknown artist')+'</small></div>'+
        metric+
      '</article>';
    }).join('')+'</div>';
  }

  function artistRows(items){
    if(!items.length)return '<div class="community-empty compact"><strong>Not enough data yet</strong></div>';
    return '<div class="community-stat-list">'+items.map(function(item,index){
      return '<article class="community-stat-row community-artist-row">'+
        '<span class="community-stat-rank">'+(index+1)+'</span>'+
        '<span class="community-artist-disc" aria-hidden="true"><span></span></span>'+
        '<div class="community-stat-copy"><strong>'+escapeHtml(item.artist_name||'Unknown artist')+'</strong><small>Collected across the community</small></div>'+
        '<span class="community-stat-count">'+escapeHtml(Core.formatCount(item.collection_count))+'</span>'+
      '</article>';
    }).join('')+'</div>';
  }

  function wishlistedAlbums(items){
    if(!items.length)return '<div class="community-empty"><strong>No wishlisted albums yet</strong><span>Albums collectors save for later will appear here.</span></div>';
    return '<div class="community-wishlist-strip">'+items.map(function(item,index){
      return '<article class="community-wishlist-card">'+
        coverMarkup(item,'community-wishlist-cover')+
        '<div class="community-wishlist-copy"><span class="community-wishlist-rank">#'+(index+1)+'</span><strong>'+escapeHtml(item.title||'Unknown album')+'</strong><small>'+escapeHtml(item.artist_name||'Unknown artist')+'</small><span class="community-wishlist-count">'+escapeHtml(Core.formatCount(item.wishlist_count))+' wishlists</span></div>'+
      '</article>';
    }).join('')+'</div>';
  }

  function panel(title,iconName,body,extraClass){
    return '<section class="community-panel '+(extraClass||'')+'"><div class="community-panel-heading"><span class="community-panel-icon">'+icon(iconName)+'</span><h2>'+escapeHtml(title)+'</h2></div>'+body+'</section>';
  }

  function show(){
    page.hidden=false;
    page.setAttribute('aria-hidden','false');
    if(doc&&doc.body)doc.body.classList.add('community-page-open');
  }

  function hide(){
    page.hidden=true;
    page.setAttribute('aria-hidden','true');
    if(doc&&doc.body)doc.body.classList.remove('community-page-open');
  }

  function loading(){
    content.innerHTML='<div class="community-loading"><span class="community-loading-disc" aria-hidden="true"></span><strong>Loading the community...</strong><small>Finding collectors, records and recent activity.</small></div>';
  }

  function error(message){
    content.innerHTML='<div class="community-loading community-error"><span class="community-loading-disc" aria-hidden="true"></span><strong>Community could not be loaded</strong><small>'+escapeHtml(message||'Try again in a moment.')+'</small></div>';
  }

  function render(data){
    data=Core.normalizeOverview(data);
    content.innerHTML=
      '<div class="community-heading"><div><span class="community-kicker">THE GROOVY COMMUNITY</span><h1>Where collections connect.</h1><p>Discover collectors with records in common, see what is happening across Groovy and explore what the community is collecting.</p></div><span class="community-heading-record" aria-hidden="true"><i></i></span></div>'+
      '<div class="community-summary-grid">'+
        summaryCard('people','Collectors',data.summary.collectors,'People building their shelves')+
        summaryCard('record','Records',data.summary.records,'Records in community collections')+
        summaryCard('link','Connections',data.summary.connections,'Collector follows across Groovy')+
      '</div>'+
      '<div class="community-primary-grid">'+
        panel('Collectors with similar taste','people',similarCollectors(data.similar_collectors),'community-similar-panel')+
        panel('Activity Feed','pulse',activityFeed(data.activity),'community-feed-panel')+
      '</div>'+
      '<div class="community-lower-grid">'+
        panel('Top Collectors','trophy',topCollectors(data.top_collectors),'community-top-panel')+
        panel('Community Statistics','chart',
          '<div class="community-stat-grid">'+
            '<section class="community-stat-card"><div class="community-stat-title"><span>★</span><strong>Top rated albums</strong></div>'+albumRows(data.top_rated_albums,'rating')+'</section>'+
            '<section class="community-stat-card"><div class="community-stat-title"><span class="record-icon"></span><strong>Most collected albums</strong></div>'+albumRows(data.most_collected_albums,'collection')+'</section>'+
            '<section class="community-stat-card"><div class="community-stat-title"><span>'+icon('people')+'</span><strong>Most collected artists</strong></div>'+artistRows(data.most_collected_artists)+'</section>'+
          '</div>','community-statistics-panel')+
      '</div>'+
      panel('Most wishlisted albums','heart',wishlistedAlbums(data.most_wishlisted_albums),'community-wishlist-panel');
  }

  function setFollowState(userId,following){
    content.querySelectorAll('[data-community-follow][data-user-id="'+String(userId||'')+'"]').forEach(function(button){
      button.dataset.following=following?'true':'false';
      button.classList.toggle('following',!!following);
      button.textContent=following?'Following':'Follow';
      button.disabled=false;
    });
  }

  function adjustConnections(delta){
    var target=content.querySelector('[data-community-metric="connections"]');
    if(!target)return;
    var current=Number(target.dataset.rawValue);
    if(!Number.isFinite(current))current=0;
    current=Math.max(0,current+Number(delta||0));
    target.dataset.rawValue=String(current);
    target.textContent=Core.formatCount(current);
  }

  return Object.freeze({
    show:show,
    hide:hide,
    loading:loading,
    error:error,
    render:render,
    setFollowState:setFollowState,
    adjustConnections:adjustConnections
  });
}

return Object.freeze({create:create});
});
