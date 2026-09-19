(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(
      require('./user-profile-core.js'),
      require('./rating-core.js')
    );
  }else{
    root.GroovyAlbumReviewController=factory(
      root.GroovyUserProfileCore,
      root.GroovyRatingCore
    );
  }
})(typeof window!=='undefined'?window:null,function(UserProfileCore,RatingCore){
  'use strict';

  function create(options){
    options=options||{};

    var api=options.api;
    var recordModel=options.recordModel;
    var rootElement=options.rootElement||null;
    var win=options.window||((typeof window!=='undefined')?window:null);
    var doc=options.document||(win&&win.document)||null;
    var getCurrentUser=typeof options.getCurrentUser==='function'
      ?options.getCurrentUser
      :async function(){return null;};
    var getOpenRecordIndex=typeof options.getOpenRecordIndex==='function'
      ?options.getOpenRecordIndex
      :function(){return -1;};
    var onNavigate=typeof options.onNavigate==='function'
      ?options.onNavigate
      :function(){};
    var onRatingChanged=typeof options.onRatingChanged==='function'
      ?options.onRatingChanged
      :async function(){};
    var onLog=typeof options.onLog==='function'
      ?options.onLog
      :function(){};

    var requestVersion=0;
    var currentAlbumId=0;
    var currentRecord=null;
    var currentIndex=-1;
    var currentUser=null;
    var reviews=[];
    var totalCount=0;
    var showAll=false;
    var editor=null;
    var editorRating=0;
    var editorReviewId=0;
    var bound=false;

    if(!api||typeof api.from!=='function')throw new Error('Album review controller requires Supabase');
    if(!recordModel)throw new Error('Album review controller requires record model');
    if(!UserProfileCore)throw new Error('Album review controller requires user profile core');
    if(!RatingCore)throw new Error('Album review controller requires rating core');

    function log(level,message,error){onLog(level,message,error);}

    function escapeHtml(value){
      return String(value==null?'':value).replace(/[&<>"']/g,function(char){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
      });
    }

    function formatDate(value){
      var date=new Date(value);
      if(!isFinite(date.getTime()))return '';
      try{
        return date.toLocaleDateString(undefined,{
          year:'numeric',
          month:'short',
          day:'numeric'
        });
      }catch(error){
        return date.toISOString().slice(0,10);
      }
    }

    function renderStars(value){
      var rating=Math.round(RatingCore.clamp(value));
      var html='<span class="review-stars" aria-label="'+escapeHtml(String(rating))+' out of 5">';
      for(var i=1;i<=5;i++){
        html+='<span class="'+(i<=rating?'filled':'empty')+'" aria-hidden="true">★</span>';
      }
      return html+'</span>';
    }

    function reviewById(id){
      var numeric=Number(id)||0;
      return reviews.find(function(review){return Number(review.id)===numeric;})||null;
    }

    function ownReview(){
      if(!currentUser)return null;
      return reviews.find(function(review){return review.user_id===currentUser.id;})||null;
    }

    function hide(){
      if(!rootElement)return;
      rootElement.hidden=true;
      rootElement.innerHTML='';
    }

    function renderLoading(){
      if(!rootElement)return;
      rootElement.hidden=false;
      rootElement.innerHTML=
        '<div class="album-reviews-heading">'+
          '<div><span class="album-reviews-kicker">COMMUNITY</span><h2>Reviews</h2></div>'+
        '</div>'+
        '<div class="album-reviews-loading" aria-live="polite">'+
          '<span></span><span></span><span></span>'+
        '</div>';
    }

    function reviewBody(review){
      var text=String(review.body||'');
      var escaped=escapeHtml(text).replace(/\n/g,'<br>');
      var long=text.length>220||text.split('\n').length>3;
      return '<div class="album-review-body'+(long?' is-collapsible':'')+'" data-review-body="'+review.id+'">'+
        '<p>'+escaped+'</p>'+
      '</div>'+
      (long?'<button class="album-review-expand" type="button" data-review-expand="'+review.id+'" aria-expanded="false">Read more</button>':'');
    }

    function heartIcon(filled){
      return '<svg viewBox="0 0 24 24" aria-hidden="true"'+(filled?' class="filled"':'')+'><path d="M20.8 4.9a5.4 5.4 0 0 0-7.6 0L12 6.1l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.5a5.4 5.4 0 0 0 0-7.6Z"></path></svg>';
    }

    function moreIcon(){
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg>';
    }

    function pencilIcon(){
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.7-10.7-3.2-3.2L5 15.8 4 20Z"></path><path d="m14.8 6 3.2 3.2"></path></svg>';
    }

    function renderReview(review){
      var username=review.username||'Collector';
      var mine=!!(currentUser&&review.user_id===currentUser.id);
      var edited=review.updated_at&&review.created_at&&
        Math.abs(new Date(review.updated_at).getTime()-new Date(review.created_at).getTime())>30000;

      return '<article class="album-review'+(mine?' is-own':'')+'" data-review-id="'+review.id+'">'+
        '<div class="album-review-author">'+
          '<button class="album-review-author-button" type="button" data-review-user="'+escapeHtml(username)+'" aria-label="View '+escapeHtml(username)+' profile">'+
            UserProfileCore.avatarMarkup('album-review-avatar',review.avatar_url,username)+
            '<span class="album-review-author-copy"><strong>'+escapeHtml(username)+'</strong><small>'+escapeHtml(formatDate(review.created_at))+(edited?' · Edited':'')+'</small></span>'+
          '</button>'+
        '</div>'+
        '<div class="album-review-rating">'+renderStars(review.rating)+'</div>'+
        '<div class="album-review-copy">'+reviewBody(review)+'</div>'+
        '<div class="album-review-social">'+
          '<button class="album-review-like'+(review.liked?' liked':'')+'" type="button" data-review-like="'+review.id+'" aria-label="'+(mine?'You cannot like your own review':(review.liked?'Remove helpful vote':'Mark review helpful'))+'" '+(mine?'disabled':'')+'>'+
            heartIcon(review.liked)+
            '<span>'+escapeHtml(String(review.likes_count||0))+'</span>'+
          '</button>'+
        '</div>'+
        (mine?'<div class="album-review-actions">'+
          '<button class="album-review-more" type="button" data-review-menu="'+review.id+'" aria-label="Review options" aria-expanded="false">'+moreIcon()+'</button>'+
          '<div class="album-review-menu" data-review-menu-panel="'+review.id+'" hidden>'+
            '<button type="button" data-review-edit="'+review.id+'">Edit review</button>'+
            '<button type="button" class="danger" data-review-delete="'+review.id+'">Delete review</button>'+
          '</div>'+
        '</div>':'')+
      '</article>';
    }

    function render(){
      if(!rootElement||!currentAlbumId)return;

      var mine=ownReview();
      var count=Number(totalCount)||reviews.length;
      var visible=showAll?reviews:reviews.slice(0,3);
      var buttonLabel=mine?'Edit Review':'Write a Review';

      rootElement.hidden=false;
      rootElement.innerHTML=
        '<div class="album-reviews-heading">'+
          '<div class="album-reviews-title-wrap">'+
            '<span class="album-reviews-kicker">COMMUNITY</span>'+
            '<h2>Reviews <span>'+escapeHtml(String(count))+'</span></h2>'+
          '</div>'+
          '<button class="album-review-write" type="button" data-review-write>'+
            pencilIcon()+'<span>'+buttonLabel+'</span>'+
          '</button>'+
        '</div>'+
        (reviews.length
          ?'<div class="album-review-list">'+visible.map(renderReview).join('')+'</div>'+
            (reviews.length>3?'<button class="album-reviews-more" type="button" data-review-show-all aria-expanded="'+(showAll?'true':'false')+'">'+
              (showAll?'Show fewer reviews':'Show all '+escapeHtml(String(count))+' reviews')+
            '</button>':'')
          :'<div class="album-reviews-empty"><strong>No reviews yet</strong><span>Be the first collector to share your thoughts on this album.</span></div>');
    }

    function normalizeReviewRows(rows,profiles,ratings,likes){
      var profileMap=new Map();
      (profiles||[]).forEach(function(profile){profileMap.set(profile.id,profile);});

      var ratingMap=new Map();
      (ratings||[]).forEach(function(row){
        ratingMap.set(row.user_id,RatingCore.clamp(row.rating));
      });

      var likeCounts=new Map();
      var likedIds=new Set();
      (likes||[]).forEach(function(row){
        var id=Number(row.review_id)||0;
        likeCounts.set(id,(likeCounts.get(id)||0)+1);
        if(currentUser&&row.user_id===currentUser.id)likedIds.add(id);
      });

      return (rows||[]).map(function(row){
        var profile=profileMap.get(row.user_id)||{};
        return {
          id:Number(row.id)||0,
          album_id:Number(row.album_id)||0,
          user_id:row.user_id,
          body:String(row.body||''),
          created_at:row.created_at,
          updated_at:row.updated_at,
          username:String(profile.username||'Collector'),
          avatar_url:String(profile.avatar_url||''),
          rating:ratingMap.get(row.user_id)||0,
          likes_count:likeCounts.get(Number(row.id)||0)||0,
          liked:likedIds.has(Number(row.id)||0)
        };
      });
    }

    async function load(albumId,user){
      var response=await api
        .from('album_reviews')
        .select('id,album_id,user_id,body,created_at,updated_at',{count:'exact'})
        .eq('album_id',albumId)
        .order('created_at',{ascending:false})
        .limit(50);

      if(response.error)throw response.error;

      var rows=(response.data||[]).slice();
      var count=Number(response.count)||rows.length;

      if(user&&!rows.some(function(row){return row.user_id===user.id;})){
        var ownResult=await api
          .from('album_reviews')
          .select('id,album_id,user_id,body,created_at,updated_at')
          .eq('album_id',albumId)
          .eq('user_id',user.id)
          .maybeSingle();
        if(ownResult.error)throw ownResult.error;
        if(ownResult.data)rows.push(ownResult.data);
      }

      var userIds=Array.from(new Set(rows.map(function(row){return row.user_id;}).filter(Boolean)));
      var reviewIds=rows.map(function(row){return Number(row.id)||0;}).filter(Boolean);

      var profilePromise=userIds.length
        ?api.from('profiles').select('id,username,avatar_url').in('id',userIds)
        :Promise.resolve({data:[],error:null});
      var ratingPromise=userIds.length
        ?api.from('album_ratings').select('user_id,rating').eq('album_id',albumId).in('user_id',userIds)
        :Promise.resolve({data:[],error:null});
      var likePromise=reviewIds.length
        ?api.from('album_review_likes').select('review_id,user_id').in('review_id',reviewIds)
        :Promise.resolve({data:[],error:null});

      var results=await Promise.all([profilePromise,ratingPromise,likePromise]);
      if(results[0].error)throw results[0].error;
      if(results[1].error)throw results[1].error;
      if(results[2].error)throw results[2].error;

      return {
        rows:normalizeReviewRows(rows,results[0].data,results[1].data,results[2].data),
        count:count
      };
    }

    async function openForRecord(record,index){
      var albumId=Number(record&&recordModel.albumId(record))||0;
      var request=++requestVersion;

      currentRecord=record||null;
      currentIndex=Number.isInteger(index)?index:-1;
      currentAlbumId=albumId;
      currentUser=null;
      reviews=[];
      totalCount=0;
      showAll=false;
      closeMenus();

      if(!albumId){
        hide();
        return false;
      }

      renderLoading();

      try{
        var user=await getCurrentUser();
        if(request!==requestVersion||albumId!==currentAlbumId)return false;
        if(!user){
          hide();
          return false;
        }

        currentUser=user;
        var payload=await load(albumId,user);
        if(request!==requestVersion||albumId!==currentAlbumId)return false;

        reviews=payload.rows||[];
        totalCount=payload.count||0;
        render();
        return true;
      }catch(error){
        log('warn','Could not load album reviews:',error);
        if(request===requestVersion&&albumId===currentAlbumId){
          rootElement.hidden=false;
          rootElement.innerHTML=
            '<div class="album-reviews-heading"><div><span class="album-reviews-kicker">COMMUNITY</span><h2>Reviews</h2></div></div>'+
            '<div class="album-reviews-error">Reviews could not be loaded right now.</div>';
        }
        return false;
      }
    }

    function ensureEditor(){
      if(editor||!doc)return editor;

      editor=doc.createElement('div');
      editor.className='album-review-editor';
      editor.setAttribute('aria-hidden','true');
      editor.innerHTML=
        '<div class="album-review-editor-backdrop" data-review-editor-close></div>'+
        '<section class="album-review-editor-panel" role="dialog" aria-modal="true" aria-labelledby="albumReviewEditorTitle">'+
          '<button class="album-review-editor-close" type="button" data-review-editor-close aria-label="Close">×</button>'+
          '<div class="album-review-editor-heading">'+
            '<span>YOUR TAKE</span>'+
            '<h2 id="albumReviewEditorTitle">Write a Review</h2>'+
            '<p>Rate the album and share what stood out to you.</p>'+
          '</div>'+
          '<div class="album-review-editor-rating" role="group" aria-label="Album rating">'+
            [1,2,3,4,5].map(function(value){
              return '<button type="button" data-review-rating="'+value+'" aria-label="'+value+' out of 5">★</button>';
            }).join('')+
          '</div>'+
          '<label class="album-review-editor-field"><span>Your review</span>'+
            '<textarea maxlength="2000" rows="7" placeholder="What did you think of this album?"></textarea>'+
          '</label>'+
          '<div class="album-review-editor-meta"><span data-review-char-count>0 / 2000</span><span data-review-editor-status aria-live="polite"></span></div>'+
          '<div class="album-review-editor-actions">'+
            '<button class="album-review-editor-cancel" type="button" data-review-editor-close>Cancel</button>'+
            '<button class="album-review-editor-save" type="button" data-review-editor-save disabled>Save Review</button>'+
          '</div>'+
        '</section>';

      doc.body.appendChild(editor);
      editor.addEventListener('click',handleEditorClick);
      editor.querySelector('textarea').addEventListener('input',updateEditorState);
      editor.querySelector('textarea').addEventListener('keydown',function(event){
        if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){
          event.preventDefault();
          saveEditor();
        }
      });

      var stars=editor.querySelectorAll('[data-review-rating]');
      for(var i=0;i<stars.length;i++){
        stars[i].addEventListener('mouseenter',function(){
          previewEditorRating(Number(this.getAttribute('data-review-rating'))||0);
        });
        stars[i].addEventListener('mouseleave',function(){
          paintEditorRating(editorRating);
        });
      }

      return editor;
    }

    function paintEditorRating(value){
      if(!editor)return;
      var stars=editor.querySelectorAll('[data-review-rating]');
      for(var i=0;i<stars.length;i++){
        var starValue=Number(stars[i].getAttribute('data-review-rating'))||0;
        stars[i].classList.toggle('selected',starValue<=value);
      }
    }

    function previewEditorRating(value){
      paintEditorRating(value);
    }

    function updateEditorState(){
      if(!editor)return;
      var textarea=editor.querySelector('textarea');
      var text=String(textarea.value||'');
      var count=editor.querySelector('[data-review-char-count]');
      var save=editor.querySelector('[data-review-editor-save]');
      if(count)count.textContent=text.length+' / 2000';
      if(save)save.disabled=!(editorRating>=1&&editorRating<=5&&text.trim().length);
    }

    function openEditor(review){
      var modal=ensureEditor();
      if(!modal||!currentAlbumId)return;

      editorReviewId=review?Number(review.id)||0:0;
      editorRating=review
        ?Math.round(RatingCore.clamp(review.rating))
        :Math.round(RatingCore.clamp(recordModel.ownRating(currentRecord)));

      var title=modal.querySelector('#albumReviewEditorTitle');
      var textarea=modal.querySelector('textarea');
      var status=modal.querySelector('[data-review-editor-status]');
      var save=modal.querySelector('[data-review-editor-save]');

      if(title)title.textContent=review?'Edit Your Review':'Write a Review';
      if(textarea)textarea.value=review?String(review.body||''):'';
      if(status)status.textContent='';
      if(save){save.disabled=false;save.textContent=review?'Save Changes':'Save Review';}

      paintEditorRating(editorRating);
      updateEditorState();

      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
      if(win&&typeof win.requestAnimationFrame==='function'){
        win.requestAnimationFrame(function(){
          if(textarea)textarea.focus();
        });
      }
    }

    function closeEditor(){
      if(!editor)return;
      editor.classList.remove('open');
      editor.setAttribute('aria-hidden','true');
      editorReviewId=0;
      editorRating=0;
    }

    async function saveEditor(){
      if(!editor||!currentAlbumId||!currentUser)return false;

      var textarea=editor.querySelector('textarea');
      var status=editor.querySelector('[data-review-editor-status]');
      var save=editor.querySelector('[data-review-editor-save]');
      var body=String(textarea&&textarea.value||'').trim();

      if(!body||editorRating<1||editorRating>5)return false;

      if(save){save.disabled=true;save.textContent='Saving…';}
      if(status)status.textContent='';

      var result=await api.rpc('save_album_review',{
        p_album_id:currentAlbumId,
        p_rating:editorRating,
        p_body:body
      });

      if(result.error){
        log('error','Could not save album review:',result.error);
        if(status)status.textContent='Could not save. Try again.';
        if(save){save.disabled=false;save.textContent=editorReviewId?'Save Changes':'Save Review';}
        return false;
      }

      var albumId=currentAlbumId;
      var index=currentIndex;
      var record=currentRecord;
      var rating=editorRating;

      closeEditor();

      try{
        await onRatingChanged({
          albumId:albumId,
          rating:rating,
          index:index,
          record:record
        });
      }catch(error){
        log('warn','Could not refresh album rating after review save:',error);
      }

      if(albumId===currentAlbumId&&record===currentRecord){
        await openForRecord(record,index);
      }
      return true;
    }

    async function deleteReview(review){
      if(!review||!currentUser)return;
      if(win&&typeof win.confirm==='function'&&!win.confirm('Delete your review? Your album rating will stay.'))return;

      var result=await api
        .from('album_reviews')
        .delete()
        .eq('id',review.id)
        .eq('user_id',currentUser.id);

      if(result.error){
        log('error','Could not delete album review:',result.error);
        return;
      }

      await openForRecord(currentRecord,currentIndex);
    }

    async function toggleLike(review){
      if(!review||!currentUser||review.user_id===currentUser.id)return;

      var result;
      if(review.liked){
        result=await api
          .from('album_review_likes')
          .delete()
          .eq('review_id',review.id)
          .eq('user_id',currentUser.id);
      }else{
        result=await api
          .from('album_review_likes')
          .insert({review_id:review.id,user_id:currentUser.id});
      }

      if(result.error){
        log('warn','Could not update review helpful vote:',result.error);
        return;
      }

      review.liked=!review.liked;
      review.likes_count=Math.max(0,(Number(review.likes_count)||0)+(review.liked?1:-1));
      render();
    }

    function closeMenus(exceptId){
      if(!rootElement)return;
      var panels=rootElement.querySelectorAll('[data-review-menu-panel]');
      for(var i=0;i<panels.length;i++){
        var id=Number(panels[i].getAttribute('data-review-menu-panel'))||0;
        if(exceptId&&id===exceptId)continue;
        panels[i].hidden=true;
      }
      var buttons=rootElement.querySelectorAll('[data-review-menu]');
      for(var b=0;b<buttons.length;b++){
        var buttonId=Number(buttons[b].getAttribute('data-review-menu'))||0;
        if(exceptId&&buttonId===exceptId)continue;
        buttons[b].setAttribute('aria-expanded','false');
      }
    }

    function handleRootClick(event){
      var write=event.target.closest('[data-review-write]');
      if(write){
        event.preventDefault();
        openEditor(ownReview());
        return;
      }

      var show=event.target.closest('[data-review-show-all]');
      if(show){
        event.preventDefault();
        showAll=!showAll;
        render();
        return;
      }

      var userButton=event.target.closest('[data-review-user]');
      if(userButton){
        event.preventDefault();
        var username=userButton.getAttribute('data-review-user');
        if(username)onNavigate(username);
        return;
      }

      var like=event.target.closest('[data-review-like]');
      if(like){
        event.preventDefault();
        toggleLike(reviewById(like.getAttribute('data-review-like')));
        return;
      }

      var expand=event.target.closest('[data-review-expand]');
      if(expand){
        event.preventDefault();
        var id=expand.getAttribute('data-review-expand');
        var body=rootElement.querySelector('[data-review-body="'+id+'"]');
        if(!body)return;
        var expanded=body.classList.toggle('expanded');
        expand.setAttribute('aria-expanded',expanded?'true':'false');
        expand.textContent=expanded?'Show less':'Read more';
        return;
      }

      var menuButton=event.target.closest('[data-review-menu]');
      if(menuButton){
        event.preventDefault();
        event.stopPropagation();
        var id=Number(menuButton.getAttribute('data-review-menu'))||0;
        var panel=rootElement.querySelector('[data-review-menu-panel="'+id+'"]');
        if(!panel)return;
        var opening=panel.hidden;
        closeMenus();
        panel.hidden=!opening;
        menuButton.setAttribute('aria-expanded',opening?'true':'false');
        return;
      }

      var edit=event.target.closest('[data-review-edit]');
      if(edit){
        event.preventDefault();
        closeMenus();
        openEditor(reviewById(edit.getAttribute('data-review-edit')));
        return;
      }

      var remove=event.target.closest('[data-review-delete]');
      if(remove){
        event.preventDefault();
        closeMenus();
        deleteReview(reviewById(remove.getAttribute('data-review-delete')));
      }
    }

    function handleEditorClick(event){
      if(event.target.closest('[data-review-editor-close]')){
        event.preventDefault();
        closeEditor();
        return;
      }

      var star=event.target.closest('[data-review-rating]');
      if(star){
        event.preventDefault();
        editorRating=Number(star.getAttribute('data-review-rating'))||0;
        paintEditorRating(editorRating);
        updateEditorState();
        return;
      }

      if(event.target.closest('[data-review-editor-save]')){
        event.preventDefault();
        saveEditor();
      }
    }

    function handleDocumentClick(event){
      if(rootElement&&rootElement.contains(event.target))return;
      closeMenus();
    }

    function handleEscape(){
      if(!editor||!editor.classList.contains('open'))return false;
      closeEditor();
      return true;
    }

    function close(){
      requestVersion++;
      currentAlbumId=0;
      currentRecord=null;
      currentIndex=-1;
      currentUser=null;
      reviews=[];
      totalCount=0;
      showAll=false;
      closeEditor();
      hide();
    }

    function refresh(){
      if(!currentRecord||!currentAlbumId)return Promise.resolve(false);
      return openForRecord(currentRecord,currentIndex);
    }

    function bind(){
      if(bound)return;
      bound=true;
      if(rootElement)rootElement.addEventListener('click',handleRootClick);
      if(doc)doc.addEventListener('click',handleDocumentClick);
    }

    bind();

    return Object.freeze({
      openForRecord:openForRecord,
      refresh:refresh,
      handleEscape:handleEscape,
      close:close,
      state:function(){
        return {
          albumId:currentAlbumId,
          count:totalCount,
          loaded:reviews.length,
          showAll:showAll
        };
      }
    });
  }

  return Object.freeze({create:create});
});
