# Groovy Android app

This directory is the source of truth for the Android APK. It keeps the existing package ID `com.groovyshelves.twa` and launches `https://groovyshelves.com/` as a Trusted Web Activity.

Native notifications use Firebase Cloud Messaging. Browser Web Push is intentionally not used.

## Build the signed APK on Windows

The easiest path is the included PowerShell helper. It reuses the JDK and Android SDK already configured by Bubblewrap, finds the existing Groovy keystore, prompts for the signing passwords without placing them in the repository, builds the release APK and verifies the signature.

From this `android` directory run:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-release.ps1
```

The finished file is:

```
android\GroovyShelves-release.apk
```

The release must be signed with the existing Groovy certificate. Its SHA-256 fingerprint is:

`49:D8:D3:6E:7E:2B:CD:A7:21:7D:B3:18:85:34:3E:5D:79:B7:A9:2A:43:58:D5:77:D4:AE:16:0E:7B:0C:46:D2`

Do not run `bubblewrap update` over this project. Firebase, FCM and the native TWA bridge are maintained here as normal Android source.
