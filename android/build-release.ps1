$ErrorActionPreference = 'Stop'

function Convert-SecureStringToPlainText {
    param([Security.SecureString]$SecureValue)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

$androidDir = $PSScriptRoot
$bubblewrapConfigPath = Join-Path $env:USERPROFILE '.bubblewrap\config.json'

if (-not (Test-Path $bubblewrapConfigPath)) {
    throw "Bubblewrap config was not found at $bubblewrapConfigPath"
}

$bubblewrap = Get-Content $bubblewrapConfigPath -Raw | ConvertFrom-Json
if (-not $bubblewrap.jdkPath -or -not (Test-Path $bubblewrap.jdkPath)) {
    throw "Bubblewrap JDK path is missing or invalid."
}
if (-not $bubblewrap.androidSdkPath -or -not (Test-Path $bubblewrap.androidSdkPath)) {
    throw "Bubblewrap Android SDK path is missing or invalid."
}

$env:JAVA_HOME = $bubblewrap.jdkPath
$env:ANDROID_HOME = $bubblewrap.androidSdkPath
$env:Path = "$($env:JAVA_HOME)\bin;$($env:ANDROID_HOME)\platform-tools;$($env:Path)"

$sdkForGradle = ($bubblewrap.androidSdkPath -replace '\\','/')
"sdk.dir=$sdkForGradle" | Set-Content (Join-Path $androidDir 'local.properties') -Encoding ASCII

$platformPath = Join-Path $bubblewrap.androidSdkPath 'platforms\android-36'
$buildToolsPath = Join-Path $bubblewrap.androidSdkPath 'build-tools\35.0.0'
if (-not (Test-Path $platformPath) -or -not (Test-Path $buildToolsPath)) {
    $sdkManager = Get-ChildItem $bubblewrap.androidSdkPath -Recurse -Filter sdkmanager.bat -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $sdkManager) {
        throw "sdkmanager.bat could not be found inside the Bubblewrap Android SDK."
    }
    Write-Host "Installing Android SDK components needed by Groovy..."
    & $sdkManager 'platforms;android-36' 'build-tools;35.0.0'
    if ($LASTEXITCODE -ne 0) {
        throw "Android SDK component installation failed."
    }
}

$defaultKeystore = Join-Path $env:USERPROFILE 'Desktop\GroovyShelves\APK\android.keystore'
$keystorePath = $defaultKeystore
if (-not (Test-Path $keystorePath)) {
    $keystorePath = Read-Host 'Full path to android.keystore'
}
if (-not (Test-Path $keystorePath)) {
    throw "The signing keystore could not be found."
}

Write-Host ""
Write-Host "Signing Groovy with alias: groovy"
$storeSecure = Read-Host 'Keystore password' -AsSecureString
$keySecure = Read-Host 'Key password (leave empty if it is the same as the keystore password)' -AsSecureString

$storePassword = Convert-SecureStringToPlainText $storeSecure
$keyPassword = Convert-SecureStringToPlainText $keySecure
if ([string]::IsNullOrEmpty($keyPassword)) {
    $keyPassword = $storePassword
}

try {
    $env:GROOVY_KEYSTORE_PATH = $keystorePath
    $env:GROOVY_KEYSTORE_PASSWORD = $storePassword
    $env:GROOVY_KEY_PASSWORD = $keyPassword
    $env:GROOVY_KEY_ALIAS = 'groovy'

    Push-Location $androidDir
    try {
        & .\gradlew.bat clean assembleRelease --no-daemon
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle release build failed."
        }
    }
    finally {
        Pop-Location
    }

    $apk = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
    if (-not (Test-Path $apk)) {
        throw "The release APK was not created at the expected path."
    }

    $apkSigner = Get-ChildItem (Join-Path $bubblewrap.androidSdkPath 'build-tools') -Recurse -Filter apksigner.bat -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName

    if (-not $apkSigner) {
        throw "apksigner.bat could not be found."
    }

    $verification = & $apkSigner verify --print-certs $apk 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "APK signature verification failed."
    }

    $expectedFingerprint = '49D8D36E7E2BCDA7217DB31885343E5D79B7A92A4358D577D4AE160E7B0C46D2'
    $verificationText = ($verification | Out-String)
    $normalized = ($verificationText -replace '[^0-9A-Fa-f]','').ToUpperInvariant()
    if (-not $normalized.Contains($expectedFingerprint)) {
        Write-Warning 'The APK was built, but the expected Groovy certificate fingerprint was not found in apksigner output.'
    }

    $output = Join-Path $androidDir 'GroovyShelves-release.apk'
    Copy-Item $apk $output -Force

    Write-Host ""
    Write-Host "Groovy Android release build completed."
    Write-Host "APK: $output"
    Write-Host ""
    $verification | ForEach-Object { Write-Host $_ }
}
finally {
    Remove-Item Env:GROOVY_KEYSTORE_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:GROOVY_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:GROOVY_KEY_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:GROOVY_KEY_ALIAS -ErrorAction SilentlyContinue
    $storePassword = $null
    $keyPassword = $null
    $storeSecure = $null
    $keySecure = $null
}
