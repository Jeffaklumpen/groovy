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
    return '<strong>'+escapeHtml(actor)+'</strong> has new activity.';
  }

  return Object.freeze({escapeHtml:escapeHtml,relativeTime:relativeTime,copy:copy});
});
