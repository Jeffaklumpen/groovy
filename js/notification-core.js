(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GroovyNotificationCore=api;
})(typeof window!=='undefined'?window:null,function(){
  function escapeHtml(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(character){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }

  function safeExternalUrl(value){
    try{
      var url=new URL(String(value||''));
      return url.protocol==='https:'||url.protocol==='http:'?url.href:'';
    }catch(error){
      return '';
    }
  }

  function relativeTime(value,now){
    var time=new Date(value).getTime();
    if(!time)return '';
    var current=now===undefined?Date.now():Number(now);
    var seconds=Math.max(0,Math.floor((current-time)/1000));
    if(seconds<60)return 'now';
    var minutes=Math.floor(seconds/60);
    if(minutes<60)return minutes+'m';
    var hours=Math.floor(minutes/60);
    if(hours<24)return hours+'h';
    var days=Math.floor(hours/24);
    if(days<7)return days+'d';
    return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  }

  function copy(item){
    item=item||{};
    var actor=item.actor&&item.actor.username?item.actor.username:'A collector';
    var payload=item.payload||{};
    if(item.notification_type==='new_follower')return '<strong>'+escapeHtml(actor)+'</strong> started following you.';
    if(item.notification_type==='collection_activity'){
      var count=Math.max(1,parseInt(item.item_count,10)||1);
      var sharedCount=Math.max(0,parseInt(payload.shared_count,10)||0);
      if(count===1&&payload.album_title){
        var single='<strong>'+escapeHtml(actor)+'</strong> added <em>'+escapeHtml(payload.album_title)+'</em> to their collection.';
        if(sharedCount>0)single+=' <b class="notification-shared">You have this too</b>';
        return single;
      }
      var grouped='<strong>'+escapeHtml(actor)+'</strong> added '+count+' records to their collection.';
      if(sharedCount===1)grouped+=' <b class="notification-shared">1 is also in your collection</b>';
      if(sharedCount>1)grouped+=' <b class="notification-shared">'+sharedCount+' are also in your collection</b>';
      return grouped;
    }
    if(item.notification_type==='wishlist_match'){
      var wishlistCount=Math.max(1,parseInt(item.item_count,10)||1);
      if(wishlistCount===1&&payload.album_title){
        return '<strong>'+escapeHtml(actor)+'</strong> added <em>'+escapeHtml(payload.album_title)+'</em> to their wishlist. <b class="notification-shared">It is in your collection</b>';
      }
      return '<strong>'+escapeHtml(actor)+'</strong> added '+wishlistCount+' records to their wishlist that you already own. <b class="notification-shared">Collection match</b>';
    }
    if(item.notification_type==='album_review'){
      if(payload.album_title){
        return '<strong>'+escapeHtml(actor)+'</strong> reviewed <em>'+escapeHtml(payload.album_title)+'</em>.';
      }
      return '<strong>'+escapeHtml(actor)+'</strong> left a new album review.';
    }
    if(item.notification_type==='review_like'){
      if(payload.album_title){
        return '<strong>'+escapeHtml(actor)+'</strong> liked your review of <em>'+escapeHtml(payload.album_title)+'</em>.';
      }
      return '<strong>'+escapeHtml(actor)+'</strong> liked your album review.';
    }
    if(item.notification_type==='price_alert'){
      var matchCount=Math.max(1,parseInt(item.item_count,10)||1);
      var albumTitle=payload.album_title||'A record';
      var amount=Number(payload.matched_price);
      var amountLabel=isFinite(amount)&&amount>0?(Math.round(amount*100)/100)+' '+String(payload.alert_currency||''):'a price below your limit';
      var marketplace=payload.marketplace?String(payload.marketplace):'a marketplace';
      var saleType=payload.sale_type==='auction'?'Auction':'Fixed price';
      if(matchCount===1){
        return '<em>'+escapeHtml(albumTitle)+'</em> matched your price alert at <strong>'+escapeHtml(amountLabel)+'</strong> on '+escapeHtml(marketplace)+'. <b class="notification-shared">'+saleType+'</b>';
      }
      return '<strong>'+matchCount+' new listings</strong> matched your price alert for <em>'+escapeHtml(albumTitle)+'</em>. Latest: '+escapeHtml(amountLabel)+' on '+escapeHtml(marketplace)+'.';
    }
    return '<strong>'+escapeHtml(actor)+'</strong> has new activity.';
  }

  return Object.freeze({escapeHtml:escapeHtml,safeExternalUrl:safeExternalUrl,relativeTime:relativeTime,copy:copy});
});
