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
      people:'<circle cx="12" cy="7" r="2.6"/><circle cx="5.4" cy="9" r="2.1"/><circle cx="18.6" cy="9" r="2.1"/><path d="M7.4 19v-1.1c0-2.7 2-4.5 4.6-4.5s4.6 1.8 4.6 4.5V19M1.8 18.5v-.8c0-2.1 1.5-3.6 3.7-3.6.9 0 1.7.2 2.4.7M22.2 18.5v-.8c0-2.1-1.5-3.6-3.7-3.6-.9 0-1.7.2-2.4.7"/>',
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

  function serviceLinks(item,extraClass){
    var identity=albumIdentity(item);
    var apple=Streaming.appleMusicSearchUrl(identity.artist,identity.title,identity.apple,'se');
    var spotify=Streaming.spotifySearchUrl(identity.artist,identity.title);
    return '<span class="community-streaming-row '+(extraClass||'')+'" aria-label="Listen on streaming services">'+
      '<a class="streaming-link streaming-service apple-service community-streaming-apple" href="'+escapeHtml(apple)+'" target="_blank" rel="noopener noreferrer" aria-label="Listen to '+escapeHtml(identity.title)+' by '+escapeHtml(identity.artist)+' on Apple Music">'+
        '<img class="apple-music-small-badge" src="/assets/brands/apple-music-badge-small.svg" alt="Listen on Apple Music">'+
      '</a>'+
      '<a class="streaming-link streaming-service spotify-service community-streaming-spotify" href="'+escapeHtml(spotify)+'" target="_blank" rel="noopener noreferrer" aria-label="Find '+escapeHtml(identity.title)+' by '+escapeHtml(identity.artist)+' on Spotify">'+
        '<img class="spotify-service-logo" src="/assets/brands/spotify-full-logo-green.svg" alt="Spotify">'+
      '</a>'+
    '</span>';
  }

  function albumTriggerAttributes(item){
    var albumId=Core.number(item&&item.album_id);
    return albumId>0
      ?' data-community-album-id="'+escapeHtml(String(albumId))+'"'
      :'';
  }

  function albumTitleButton(item,label,className){
    var attrs=albumTriggerAttributes(item);
    if(!attrs)return '<strong>'+escapeHtml(label)+'</strong>';
    return '<button class="'+(className||'community-album-title-button')+'" type="button"'+attrs+'>'+escapeHtml(label)+'</button>';
  }

  function coverMarkup(item,extraClass){
    var identity=albumIdentity(item);
    return '<span class="community-cover community-album-trigger '+(extraClass||'')+'"'+albumTriggerAttributes(item)+'>'+

      '<span class="community-cover-fallback" aria-hidden="true"><span class="record-icon"></span></span>'+
      (identity.cover?'<img src="'+escapeHtml(identity.cover)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+
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
        '<div class="community-taste-score">'+
  '<div class="community-taste-metric"><strong>'+escapeHtml(Core.formatCount(item.common_count))+'</strong><span>Records in common</span></div>'+
  '<div class="community-taste-metric"><strong>'+escapeHtml(String(Math.round(Core.number(item.taste_similarity))))+'%</strong><span>Genre overlap</span></div>'+
'</div>'+
        '<div class="community-similar-actions">'+
          '<button class="community-follow-button'+(following?' following':'')+'" type="button" data-community-follow data-user-id="'+escapeHtml(item.user_id||'')+'" data-following="'+(following?'true':'false')+'">'+(following?'Following':'Follow')+'</button>'+
          '<button class="community-secondary-button" type="button" data-community-shelf="'+escapeHtml(item.username||'')+'">View Shelf</button>'+
        '</div>'+
      '</article>';
    }).join('')+'</div>';
  }

  function activityCopy(item){
    var username=escapeHtml(item.username||'Collector');
    var title=item.album_title||'an album';
    var album=albumTitleButton(item,title,'community-inline-album');
    if(item.activity_type==='wishlist_add')return '<button type="button" data-community-profile="'+username+'">'+username+'</button> added '+album+' to their wishlist';
    if(item.activity_type==='album_rating')return '<button type="button" data-community-profile="'+username+'">'+username+'</button> rated '+album+' <span class="community-feed-rating">'+escapeHtml(String(Core.clampRating(item.rating)))+' ★</span>';
    return '<button type="button" data-community-profile="'+username+'">'+username+'</button> added '+album+' to their shelf';
  }

  function activityFeed(items){
    if(!items.length)return '<div class="community-empty compact"><strong>No activity yet</strong><span>New collection, wishlist and rating activity will appear here.</span></div>';
    return '<div class="community-feed-list">'+items.map(function(item){
      return '<article class="community-feed-item">'+
        '<button class="community-feed-avatar-button" type="button" data-community-profile="'+escapeHtml(item.username||'')+'" aria-label="Open '+escapeHtml(item.username||'Collector')+' profile">'+avatar(item,'community-feed-avatar')+'</button>'+
        coverMarkup(item,'community-feed-cover')+
        '<div class="community-feed-copy"><p>'+activityCopy(item)+'</p><small>'+escapeHtml(item.artist_name||'')+'</small>'+serviceLinks(item,'community-streaming-compact')+'</div>'+
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
    var metricKey=type==='rating'?'average_rating':(type==='wishlist'?'wishlist_count':'collection_count');
    if(!items.length)return '<div class="community-empty compact"><strong>Not enough data yet</strong></div>';
    return '<div class="community-stat-list">'+items.map(function(item,index){
      var metric=type==='rating'
        ?'<span class="community-stat-rating">★ '+escapeHtml(String(Core.clampRating(item[metricKey])))+'</span>'
        :'<span class="community-stat-count">'+escapeHtml(Core.formatCount(item[metricKey]))+'</span>';
      return '<article class="community-stat-row">'+
        '<span class="community-stat-rank">'+(index+1)+'</span>'+
        coverMarkup(item,'community-mini-cover')+
        '<div class="community-stat-copy">'+albumTitleButton(item,item.title||'Unknown album')+'<small>'+escapeHtml(item.artist_name||'Unknown artist')+'</small>'+serviceLinks(item,'community-streaming-compact')+'</div>'+
        metric+
      '</article>';
    }).join('')+'</div>';
  }

  function artistRows(items){
    if(!items.length)return '<div class="community-empty compact"><strong>Not enough data yet</strong></div>';
    return '<div class="community-stat-list">'+items.map(function(item,index){
      return '<button class="community-stat-row community-artist-row community-artist-link" type="button" data-community-artist="'+escapeHtml(item.artist_name||'')+'">'+
        '<span class="community-stat-rank">'+(index+1)+'</span>'+
        '<span class="community-artist-disc" aria-hidden="true"><span></span></span>'+
        '<div class="community-stat-copy"><strong>'+escapeHtml(item.artist_name||'Unknown artist')+'</strong><small>Collected across the community</small></div>'+
        '<span class="community-stat-count">'+escapeHtml(Core.formatCount(item.collection_count))+'</span>'+
      '</button>';
    }).join('')+'</div>';
  }

  function topRatedAlbums(items){
    if(!items.length)return '<div class="community-empty"><strong>No rated albums yet</strong><span>Community ratings will appear here as collectors rate their records.</span></div>';
    return '<div class="community-album-strip">'+items.map(function(item,index){
      return '<article class="community-album-card">'+
        coverMarkup(item,'community-album-cover')+
        '<div class="community-album-copy"><span class="community-album-rank">#'+(index+1)+'</span>'+albumTitleButton(item,item.title||'Unknown album')+'<small>'+escapeHtml(item.artist_name||'Unknown artist')+'</small><span class="community-album-rating">★ '+escapeHtml(String(Core.clampRating(item.average_rating)))+' <em>'+escapeHtml(Core.formatCount(item.rating_count))+' rating'+(Core.number(item.rating_count)===1?'':'s')+'</em></span>'+serviceLinks(item,'community-streaming-card')+'</div>'+
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
      '<div class="community-summary-grid">'+
        summaryCard('people','Collectors',data.summary.collectors,'People building their shelves')+
        summaryCard('record','Collected Records',data.summary.records,'Records in community collections')+
        summaryCard('heart','Wishlisted Records',data.summary.wishlisted_records,'Records saved across community wishlists')+
      '</div>'+
      '<div class="community-primary-grid">'+
        panel('Collectors with similar taste','people',similarCollectors(data.similar_collectors),'community-similar-panel')+
        panel('Activity Feed','pulse',activityFeed(data.activity),'community-feed-panel')+
      '</div>'+
      '<div class="community-lower-grid">'+
        panel('Top Collectors','trophy',topCollectors(data.top_collectors),'community-top-panel')+
        panel('Community Statistics','chart',
          '<div class="community-stat-grid">'+
            '<section class="community-stat-card"><div class="community-stat-title"><span class="record-icon"></span><strong>Most collected albums</strong></div>'+albumRows(data.most_collected_albums,'collection')+'</section>'+
            '<section class="community-stat-card"><div class="community-stat-title"><span>'+icon('heart')+'</span><strong>Most wishlisted albums</strong></div>'+albumRows(data.most_wishlisted_albums,'wishlist')+'</section>'+
            '<section class="community-stat-card"><div class="community-stat-title"><span>'+icon('people')+'</span><strong>Most collected artists</strong></div>'+artistRows(data.most_collected_artists)+'</section>'+
          '</div>','community-statistics-panel')+
      '</div>'+
      panel('Top rated albums','trophy',topRatedAlbums(data.top_rated_albums),'community-featured-panel');
  }

  function setFollowState(userId,following){
    content.querySelectorAll('[data-community-follow][data-user-id="'+String(userId||'')+'"]').forEach(function(button){
      button.dataset.following=following?'true':'false';
      button.classList.toggle('following',!!following);
      button.textContent=following?'Following':'Follow';
      button.disabled=false;
    });
  }

  return Object.freeze({
    show:show,
    hide:hide,
    loading:loading,
    error:error,
    render:render,
    setFollowState:setFollowState
  });
}

return Object.freeze({create:create});
});
