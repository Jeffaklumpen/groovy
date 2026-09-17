const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Notifications=require('../js/notification-core.js');

const root=path.resolve(__dirname,'..');

test('escapes notification HTML',function(){
  assert.equal(
    Notifications.escapeHtml('A&B <C> "D" \'E\''),
    'A&amp;B &lt;C&gt; &quot;D&quot; &#39;E&#39;'
  );
});

test('formats relative notification time deterministically',function(){
  const now=Date.parse('2026-09-17T07:00:00Z');
  assert.equal(Notifications.relativeTime('2026-09-17T06:59:40Z',now),'now');
  assert.equal(Notifications.relativeTime('2026-09-17T06:55:00Z',now),'5m');
  assert.equal(Notifications.relativeTime('2026-09-17T05:00:00Z',now),'2h');
  assert.equal(Notifications.relativeTime('2026-09-15T07:00:00Z',now),'2d');
});

test('builds safe follower notification copy',function(){
  assert.equal(
    Notifications.copy({notification_type:'new_follower',actor:{username:'<Jeff>'}}),
    '<strong>&lt;Jeff&gt;</strong> started following you.'
  );
});

test('highlights a shared record in collection activity',function(){
  assert.equal(
    Notifications.copy({notification_type:'collection_activity',item_count:1,actor:{username:'Anna'},payload:{album_title:'The Wall',shared_count:1}}),
    '<strong>Anna</strong> added <em>The Wall</em> to their collection. <b class="notification-shared">You have this too</b>'
  );
});

test('builds grouped wishlist match copy',function(){
  assert.equal(
    Notifications.copy({notification_type:'wishlist_match',item_count:3,actor:{username:'Anna'},payload:{}}),
    '<strong>Anna</strong> added 3 records to their wishlist that you already own. <b class="notification-shared">Collection match</b>'
  );
});

test('notification core and controller load before app and keep responsibilities separated',function(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8');
  const controller=fs.readFileSync(path.join(root,'js','notification-controller.js'),'utf8');
  const corePosition=html.search(/\/js\/notification-core\.js\?v=\d+/);
  const controllerPosition=html.search(/\/js\/notification-controller\.js\?v=\d+/);
  const appPosition=html.indexOf('/js/app.js?v=');
  assert.ok(corePosition>=0&&controllerPosition>corePosition&&appPosition>controllerPosition);
  assert.match(app,/var NotificationCore=window\.GroovyNotificationCore/);
  assert.match(app,/var escapeSocialHtml=NotificationCore\.escapeHtml/);
  assert.match(app,/var NotificationController=window\.GroovyNotificationController/);
  assert.match(controller,/Core\.escapeHtml/);
  assert.match(controller,/Core\.relativeTime/);
  assert.match(controller,/Core\.copy/);
  assert.doesNotMatch(app,/relativeNotificationTime|notificationCopy|function renderNotifications|function loadNotifications|syncNotificationSubscription/);
});
