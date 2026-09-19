const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');

test('Android app keeps Groovy identity and Firebase configuration',()=>{
  const gradle=fs.readFileSync(path.join(root,'android','app','build.gradle'),'utf8');
  const manifest=fs.readFileSync(path.join(root,'android','app','src','main','AndroidManifest.xml'),'utf8');
  const firebase=JSON.parse(fs.readFileSync(path.join(root,'android','app','google-services.json'),'utf8'));

  assert.match(gradle,/applicationId 'com\.groovyshelves\.twa'/);
  assert.match(gradle,/versionCode 3/);
  assert.match(gradle,/firebase-bom:34\.19\.0/);
  assert.match(gradle,/firebase-messaging/);
  assert.equal(firebase.client[0].client_info.android_client_info.package_name,'com.groovyshelves.twa');
  assert.match(manifest,/android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest,/GroovyFirebaseMessagingService/);
  assert.match(manifest,/androidx\.browser\.customtabs\.PostMessageService/);
});

test('Android TWA bridges the FCM token to the authenticated web app',()=>{
  const launcher=fs.readFileSync(path.join(root,'android','app','src','main','java','com','groovyshelves','twa','LauncherActivity.java'),'utf8');
  const bridge=fs.readFileSync(path.join(root,'js','native-app-bridge.js'),'utf8');
  const assetlinks=JSON.parse(fs.readFileSync(path.join(root,'.well-known','assetlinks.json'),'utf8'));

  assert.match(launcher,/RELATION_USE_AS_ORIGIN/);
  assert.match(launcher,/requestPostMessageChannel\(APP_ORIGIN, APP_ORIGIN/);
  assert.match(launcher,/groovy:native-push-token/);
  assert.match(bridge,/register_native_push_device/);
  assert.match(bridge,/android:\/\/com\.groovyshelves\.twa/);
  assert.ok(assetlinks[0].relation.includes('delegate_permission/common.handle_all_urls'));
  assert.ok(assetlinks[0].relation.includes('delegate_permission/common.use_as_origin'));
});

test('native notification service renders Price Alert pushes inside the APK',()=>{
  const service=fs.readFileSync(path.join(root,'android','app','src','main','java','com','groovyshelves','twa','GroovyFirebaseMessagingService.java'),'utf8');
  assert.match(service,/extends FirebaseMessagingService/);
  assert.match(service,/NotificationCompat\.Builder/);
  assert.match(service,/R\.drawable\.ic_notification/);
  assert.match(service,/groovyshelves\.com\/price-alerts/);
});


test('Android release helper reuses Bubblewrap tooling without committing signing secrets',()=>{
  const script=fs.readFileSync(path.join(root,'android','build-release.ps1'),'utf8');
  assert.match(script,/\.bubblewrap\\config\.json/);
  assert.match(script,/android\.keystore/);
  assert.match(script,/Read-Host 'Keystore password' -AsSecureString/);
  assert.match(script,/gradlew\.bat clean assembleRelease/);
  assert.match(script,/apksigner\.bat/);
  assert.match(script,/49D8D36E7E2BCDA7217DB31885343E5D79B7A92A4358D577D4AE160E7B0C46D2/);
  assert.doesNotMatch(script,/GROOVY_KEYSTORE_PASSWORD\s*=\s*['"][^'"]+['"]/);
});


test('web Supabase client is exposed to the native bridge',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const bridge=fs.readFileSync(path.join(root,'js','native-app-bridge.js'),'utf8');
  assert.match(html,/window\.supabaseClient=supabaseClient/);
  assert.match(html,/\/js\/native-app-bridge\.js\?v=2/);
  assert.match(bridge,/window\.supabaseClient/);
  assert.match(bridge,/register_native_push_device/);
});
