(function(root,factory){
  var api=factory(root&&root.GroovyArtistCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyArtistView=api;
})(typeof window!=='undefined'?window:null,function(Core){
  'use strict';

  function create(options){
    options=options||{};
    var doc=options.document||document;
    var page=options.page;
    var content=options.content;
    var escapeHtml=typeof options.escapeHtml==='function'?options.escapeHtml:function(value){
      return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    };
    if(!Core)throw new Error('Artist view requires GroovyArtistCore');
    if(!page||!content)throw new Error('Artist view DOM is incomplete');

    function show(){
      page.hidden=false;
      page.setAttribute('aria-hidden','false');
      if(doc.body)doc.body.classList.add('artist-page-open');
    }

    function hide(){
      page.hidden=true;
      page.setAttribute('aria-hidden','true');
      if(doc.body)doc.body.classList.remove('artist-page-open');
    }

    function loading(){
      content.innerHTML='<div class="artist-loading"><span class="artist-loading-disc" aria-hidden="true"></span><strong>Loading artist...</strong><small>Building the artist profile and discography.</small></div>';
    }

    function error(message){
      content.innerHTML='<div class="artist-loading artist-error"><strong>Artist could not be loaded</strong><small>'+escapeHtml(message||'Try again in a moment.')+'</small></div>';
    }

    function metric(value,label){
      return '<article class="artist-metric"><strong>'+escapeHtml(Core.formatCount(value))+'</strong><span>'+escapeHtml(label)+'</span></article>';
    }

    function photo(wiki,name){
      var image=wiki&&wiki.image;
      if(!image||!image.url){
        return '<div class="artist-photo-shell artist-photo-placeholder" aria-label="'+escapeHtml(name)+'"><span class="record-icon" aria-hidden="true"></span></div>';
      }
      return '<div class="artist-photo-wrap"><div class="artist-photo-shell"><img src="'+escapeHtml(image.url)+'" alt="'+escapeHtml(name)+'" referrerpolicy="no-referrer"></div>'+
        (image.page_url?'<a class="artist-photo-credit" href="'+escapeHtml(image.page_url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(image.credit||'Wikimedia Commons')+' · '+escapeHtml(image.license||'')+'</a>':'')+
      '</div>';
    }

    function members(title,items){
      if(!Array.isArray(items)||!items.length)return '';
      return '<section class="artist-panel artist-members-panel"><h2>'+escapeHtml(title)+'</h2><div class="artist-member-list">'+items.map(function(item){
        return '<span class="artist-member">'+escapeHtml(item.name||'')+'</span>';
      }).join('')+'</div></section>';
    }

    function discography(items,artistName){
      if(!Array.isArray(items)||!items.length){
        return '<div class="artist-empty">No main discography found.</div>';
      }
      return '<div class="artist-discography-grid">'+items.map(function(item){
        var albumId=Core.number(item.album_id);
        var masterId=Core.number(item.discogs_master_id);
        var cover=item.cover_url||('https://coverartarchive.org/release-group/'+encodeURIComponent(item.mbid||'')+'/front-500');
        var status=item.is_collected?'In collection':(item.is_wishlisted?'Wishlisted':'');
        var attrs=(albumId?' data-artist-album-id="'+albumId+'"':'')+(masterId?' data-artist-master-id="'+masterId+'"':'');
        return '<button class="artist-discography-card" type="button"'+attrs+' aria-label="Open '+escapeHtml(item.title||'album')+' by '+escapeHtml(artistName)+'">'+
          '<span class="artist-discography-cover"><span class="artist-discography-fallback"><span class="record-icon"></span></span>'+
            '<img src="'+escapeHtml(cover)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">'+
            (status?'<span class="artist-discography-status">'+escapeHtml(status)+'</span>':'')+
          '</span>'+
          '<span class="artist-discography-copy"><strong>'+escapeHtml(item.title||'Unknown album')+'</strong><small>'+escapeHtml(String(item.year||''))+(item.secondary_types?' · '+escapeHtml(item.secondary_types):'')+'</small></span>'+
        '</button>';
      }).join('')+'</div>';
    }

    function about(wiki){
      if(!wiki||!wiki.introduction)return '';
      var sections=Array.isArray(wiki.sections)?wiki.sections:[];
      return '<section class="artist-panel artist-about-panel"><div class="artist-section-heading"><div><span>FROM WIKIPEDIA</span><h2>About</h2></div><a href="'+escapeHtml(wiki.url||'https://en.wikipedia.org/')+'" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a></div>'+
        '<div class="artist-about-copy"><p>'+escapeHtml(wiki.introduction)+'</p>'+
        sections.map(function(section){
          return '<h3>'+escapeHtml(section.heading||'')+'</h3>'+
            (Array.isArray(section.paragraphs)?section.paragraphs:[]).map(function(paragraph){return '<p>'+escapeHtml(paragraph)+'</p>';}).join('');
        }).join('')+
        '</div><div class="artist-about-source">Wikipedia contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></div></section>';
    }

    function render(data){
      var profile=data.profile||{};
      var overview=Core.normalizeOverview(data.overview||{});
      var wiki=data.wikipedia||null;
      var nav=data.navigation||{};
      var genres=[];
      [].concat(overview.genres||[],profile.genres||[]).forEach(function(genre){
        var value=String(genre||'').trim();
        if(!value)return;
        if(genres.some(function(existing){return existing.toLowerCase()===value.toLowerCase();}))return;
        genres.push(value);
      });
      genres=genres.slice(0,4);
      var current=Array.isArray(profile.current_members)?profile.current_members:[];
      var past=Array.isArray(profile.past_members)?profile.past_members:[];
      var official=profile.official_url||'';

      content.innerHTML=
        (nav.backToAlbum?'<button class="artist-context-back" type="button" data-artist-back-album>← Back to '+escapeHtml(nav.backLabel||'album')+'</button>':'')+
        '<section class="artist-hero">'+
          photo(wiki,profile.name||'Artist')+
          '<div class="artist-hero-copy"><span class="artist-kicker">ARTIST</span><h1>'+escapeHtml(profile.name||'Unknown artist')+'</h1>'+
            (genres.length?'<div class="artist-genres">'+genres.map(function(genre){return '<span>'+escapeHtml(genre)+'</span>';}).join('')+'</div>':'')+
            (official?'<a class="artist-official-link" href="'+escapeHtml(official)+'" target="_blank" rel="noopener noreferrer">Official website ↗</a>':'')+
          '</div>'+
        '</section>'+
        '<div class="artist-metrics">'+
          metric(overview.summary.collected_records,'Collected Records')+
          metric(overview.summary.collectors,'Collectors')+
          metric(overview.summary.wishlisted_records,'Wishlisted Records')+
        '</div>'+
        ((current.length||past.length)?'<div class="artist-members-grid">'+members('Current members',current)+members('Past members',past)+'</div>':'')+
        '<section class="artist-panel artist-discography-panel"><div class="artist-section-heading"><div><span>CATALOG</span><h2>Main Discography</h2></div><small>'+escapeHtml(String(overview.discography.length))+' albums</small></div>'+discography(overview.discography,profile.name||'Artist')+'</section>'+
        about(wiki);
    }

    return Object.freeze({show:show,hide:hide,loading:loading,error:error,render:render});
  }

  return Object.freeze({create:create});
});
