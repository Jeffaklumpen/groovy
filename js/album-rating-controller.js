(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyAlbumRatingController=api;
})(typeof window!=='undefined'?window:null,function(){
  function create(options){
    options=options||{};

    var api=options.api;
    var ratingCore=options.ratingCore;
    var recordModel=options.recordModel;
    var detailElement=options.detailElement||null;
    var collectionElement=options.collectionElement||null;
    var getRecords=typeof options.getRecords==='function'?options.getRecords:function(){return [];};
    var escapeHtml=typeof options.escapeHtml==='function'?options.escapeHtml:function(value){
      return String(value==null?'':value)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    };
    var onAlert=typeof options.onAlert==='function'?options.onAlert:function(){};
    var onRatingUpdated=typeof options.onRatingUpdated==='function'?options.onRatingUpdated:function(){};
    var onLog=typeof options.onLog==='function'?options.onLog:function(){};

    if(!api||typeof api.from!=='function')throw new Error('Album rating controller requires Supabase');
    if(!ratingCore)throw new Error('Album rating controller requires rating core');
    if(!recordModel)throw new Error('Album rating controller requires record model');

    function log(level,message,error){onLog(level,message,error);}

    function formatCommunityRating(value){
      return ratingCore.format(value);
    }

    function renderDetailStars(value,interactive){
      var numeric=ratingCore.clamp(value);
      var stars='';
      for(var i=1;i<=5;i++){
        var fill=Math.max(0,Math.min(1,numeric-(i-1)))*100;
        var inner=
          '<span class="groovy-rating-star-base" aria-hidden="true"><span class="groovy-rating-star-glyph">★</span></span>'+
          '<span class="groovy-rating-star-fill" aria-hidden="true"><span class="groovy-rating-star-glyph">★</span></span>';
        if(interactive){
          stars+='<button class="album-rating-star groovy-rating-star-cell '+(fill>0?'filled':'empty')+'" style="--star-fill:'+fill.toFixed(1)+'%;" type="button" data-rating="'+i+'" aria-label="Rate '+i+' out of 5">'+inner+'</button>';
        }else{
          stars+='<span class="groovy-rating-star-cell" style="--star-fill:'+fill.toFixed(1)+'%;" aria-hidden="true">'+inner+'</span>';
        }
      }
      var label=(numeric||0).toFixed(1)+' out of 5';
      return '<div class="groovy-rating-stars'+(interactive?' is-interactive':' is-community')+'" aria-label="'+escapeHtml(label)+'">'+stars+'</div>';
    }

    function renderStaticStarMeter(value,extraClass){
      if(extraClass==='is-community')return renderDetailStars(value,false);
      var label=(ratingCore.clamp(value)||0).toFixed(1)+' out of 5';
      return '<span class="groovy-star-meter'+(extraClass?' '+extraClass:'')+'" style="--rating-fill:'+ratingCore.fillPercent(value)+';" aria-label="'+escapeHtml(label)+'">'+
        '<span class="groovy-star-meter-base" aria-hidden="true">★★★★★</span>'+
        '<span class="groovy-star-meter-fill" aria-hidden="true">★★★★★</span>'+
      '</span>';
    }

    function renderScore(value){
      var text=formatCommunityRating(value);
      return '<strong class="groovy-rating-score" data-score="'+escapeHtml(text)+'">'+
        '<span class="groovy-score-main">'+escapeHtml(text)+'</span>'+
        (text==='—'?'':'<span class="groovy-score-max">/5</span>')+
      '</strong>';
    }

    function renderGridRating(value){
      var text=formatCommunityRating(value);
      var empty=text==='—';
      var shown=empty?'-':text;
      return '<span class="cover-rating-inner">'+renderStaticStarMeter(value,'is-compact')+
        '<span class="cover-rating-number"><span class="cover-rating-value'+(empty?' is-empty':'')+'">'+escapeHtml(shown)+'</span>'+
        (empty?'':'<span class="cover-rating-max">/5</span>')+
        '</span></span>';
    }

    function trashIcon(){
      return '<svg class="groovy-remove-rating-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path></svg>';
    }

    function renderOwnFooter(ownRating){
      if(ownRating){
        return '<button class="groovy-remove-rating" type="button">'+trashIcon()+'<span>Remove Rating</span></button>';
      }
      return '<span class="rating-panel-empty-note">Not rated yet</span>';
    }

    async function loadData(albumIds,ownUserId){
      var ids=Array.from(new Set((albumIds||[]).filter(Boolean)));
      if(!ids.length)return {};

      var map={};
      ids.forEach(function(id){
        map[id]={ownRating:0,communityAverage:0,communityCount:0};
      });

      var response=await api
        .from('album_ratings')
        .select('album_id,user_id,rating')
        .in('album_id',ids);

      if(response.error){
        log('error','Kunde inte hämta albumratings:',response.error);
        return map;
      }

      (response.data||[]).forEach(function(row){
        var entry=map[row.album_id]||(map[row.album_id]={ownRating:0,communityAverage:0,communityCount:0});
        var rating=ratingCore.clamp(row.rating);
        if(!rating)return;
        entry.communityTotal=(entry.communityTotal||0)+rating;
        entry.communityCount=(entry.communityCount||0)+1;
        if(ownUserId&&row.user_id===ownUserId)entry.ownRating=rating;
      });

      Object.keys(map).forEach(function(id){
        var entry=map[id];
        entry.communityAverage=entry.communityCount?Math.round((entry.communityTotal||0)/entry.communityCount*10)/10:0;
        delete entry.communityTotal;
      });

      return map;
    }

    function renderDetail(index){
      if(!detailElement)return;
      var records=getRecords();
      var record=records[index];
      if(!record)return;

      var ownRating=ratingCore.clamp(recordModel.ownRating(record));
      var communityAverage=ratingCore.clamp(recordModel.communityRating(record));
      var communityCount=parseInt(recordModel.communityCount(record),10)||0;
      var personIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"></circle><path d="M5.8 19.3c.4-4 2.8-6.2 6.2-6.2s5.8 2.2 6.2 6.2"></path></svg>';
      var communityIcon='<svg viewBox="0 0 28 24" aria-hidden="true"><circle cx="14" cy="6.2" r="2.8"></circle><circle cx="6.6" cy="8.1" r="2.3"></circle><circle cx="21.4" cy="8.1" r="2.3"></circle><path d="M8.4 19.4c.35-4.1 2.45-6.4 5.6-6.4s5.25 2.3 5.6 6.4"></path><path d="M1.9 19.4c.25-3.2 1.9-5.1 4.7-5.1 1.1 0 2 .25 2.8.75M26.1 19.4c-.25-3.2-1.9-5.1-4.7-5.1-1.1 0-2 .25-2.8.75"></path></svg>';

      detailElement.innerHTML='<div class="rating-panels">'+
        '<section class="rating-panel rating-panel-your">'+
          '<div class="rating-panel-label"><span class="rating-panel-icon rating-panel-icon-user">'+personIcon+'</span><span>Your Rating</span></div>'+
          '<div class="groovy-rating-value-row">'+renderDetailStars(ownRating,true)+renderScore(ownRating)+'</div>'+
          '<div class="rating-panel-footer">'+renderOwnFooter(ownRating)+'</div>'+
        '</section>'+
        '<section class="rating-panel rating-panel-community">'+
          '<div class="rating-panel-label"><span class="rating-panel-icon rating-panel-icon-group">'+communityIcon+'</span><span>Community Rating</span></div>'+
          '<div class="groovy-rating-value-row">'+renderDetailStars(communityAverage,false)+renderScore(communityAverage)+'</div>'+
          '<div class="rating-panel-footer"><span class="rating-panel-meta">'+escapeHtml(String(communityCount||0))+' rating'+(communityCount===1?'':'s')+'</span></div>'+
        '</section>'+
      '</div>';

      var ratingButtons=detailElement.querySelectorAll('.album-rating-star');
      for(var r=0;r<ratingButtons.length;r++){
        ratingButtons[r].addEventListener('mouseenter',function(){
          var hoverRating=parseInt(this.getAttribute('data-rating'),10);
          for(var i=0;i<ratingButtons.length;i++)ratingButtons[i].classList.toggle('hover-filled',i<hoverRating);
        });
        ratingButtons[r].addEventListener('mouseleave',function(){
          for(var i=0;i<ratingButtons.length;i++)ratingButtons[i].classList.remove('hover-filled');
        });
        ratingButtons[r].addEventListener('click',function(event){
          event.preventDefault();
          event.stopPropagation();
          save(index,parseInt(this.getAttribute('data-rating'),10));
        });
        ratingButtons[r].addEventListener('touchend',function(event){
          event.preventDefault();
          event.stopPropagation();
          save(index,parseInt(this.getAttribute('data-rating'),10));
        },{passive:false});
      }
    }

    async function save(index,rating){
      var records=getRecords();
      var record=records[index];
      if(!record)return false;

      var userResult=await api.auth.getUser();
      var user=userResult&&userResult.data?userResult.data.user:null;
      if((userResult&&userResult.error)||!user){
        onAlert('Du måste vara inloggad.');
        return false;
      }

      var albumId=recordModel.albumId(record);
      var previousOwnRating=ratingCore.clamp(recordModel.ownRating(record));
      var previousAverage=ratingCore.clamp(recordModel.communityRating(record));
      var previousCount=parseInt(recordModel.communityCount(record),10)||0;

      var result=await api
        .from('album_ratings')
        .upsert({
          user_id:user.id,
          album_id:albumId,
          rating:rating
        },{
          onConflict:'user_id,album_id'
        });

      if(result.error){
        log('error','Kunde inte spara albumrating:',result.error);
        onAlert('Kunde inte spara ratingen.\n\n'+result.error.message);
        return false;
      }

      var nextCount=previousCount;
      var nextAverage=previousAverage;
      if(previousOwnRating>0&&previousCount>0){
        nextAverage=((previousAverage*previousCount)-previousOwnRating+rating)/previousCount;
      }else if(rating>0){
        nextCount=previousCount+1;
        nextAverage=((previousAverage*previousCount)+rating)/Math.max(1,nextCount);
      }
      nextAverage=Math.round(ratingCore.clamp(nextAverage)*10)/10;

      for(var r=0;r<records.length;r++){
        if(recordModel.albumId(records[r])!==albumId)continue;
        recordModel.setRatings(records[r],rating,nextAverage,nextCount);
      }

      renderDetail(index);

      if(collectionElement){
        var cards=collectionElement.querySelectorAll('.record');
        for(var c=0;c<cards.length;c++){
          var cardIndex=parseInt(cards[c].getAttribute('data-index'),10);
          var cardRecord=records[cardIndex];
          if(!cardRecord||recordModel.albumId(cardRecord)!==albumId)continue;
          var coverRating=cards[c].querySelector('.cover-rating');
          if(coverRating){
            coverRating.innerHTML=renderGridRating(nextAverage);
          }
        }
      }

      onRatingUpdated({albumId:albumId,index:index,source:'save'});
      return true;
    }

    return Object.freeze({
      loadData:loadData,
      renderDetail:renderDetail,
      save:save,
      renderStaticStarMeter:renderStaticStarMeter,
      renderGridRating:renderGridRating,
      formatCommunityRating:formatCommunityRating
    });
  }

  return Object.freeze({create:create});
});
