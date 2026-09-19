# Groovy Android app

This directory is the source of truth for the Android APK. It keeps the existing package ID `com.groovyshelves.twa` and launches `https://groovyshelves.com/` as a Trusted Web Activity.

Native notifications use Firebase Cloud Messaging. Browser Web Push is intentionally not used.

## Requirements

- JDK 17
- Android SDK Platform 36
- The original Groovy signing keystore
- Firebase config in `app/google-services.json`

## Signed release build on Windows

Set the signing values only in the current PowerShell session. Never commit the keystore or passwords.

```powershell
$env:GROOVY_KEYSTORE_PATH="C:\Users\jeffs\Desktop\GroovyShelves\APK\android.keystore"
$env:GROOVY_KEYSTORE_PASSWORD="YOUR_KEYSTORE_PASSWORD"
$env:GROOVY_KEY_PASSWORD="YOUR_KEY_PASSWORD"
$env:GROOVY_KEY_ALIAS="groovy"

.\gradlew.bat clean assembleRelease
```

The release APK is created under `app\build\outputs\apk\release\`.

The release must be signed with the existing Groovy certificate. Its SHA-256 fingerprint is:

`49:D8:D3:6E:7E:2B:CD:A7:21:7D:B3:18:85:34:3E:5D:79:B7:A9:2A:43:58:D5:77:D4:AE:16:0E:7B:0C:46:D2`

Do not run `bubblewrap update` over this project. The Firebase and native bridge code is intentionally maintained as normal Android source.
