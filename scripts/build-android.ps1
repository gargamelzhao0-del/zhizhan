param([string]$ToolRoot = "$env:USERPROFILE/.techvault-tools", [switch]$Offline, [switch]$AllowUnconfiguredUpdates)
$ErrorActionPreference='Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (!$AllowUnconfiguredUpdates -and !(Test-Path -LiteralPath (Join-Path $projectRoot '.private/update-service.json'))) { throw 'A real update-service profile is required for installation-ready releases. Use -AllowUnconfiguredUpdates only for a clearly marked development build.' }
$appVersion = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
$jdk = Get-ChildItem -LiteralPath (Join-Path $ToolRoot 'java') -Directory | Select-Object -First 1
if (!$jdk) { throw 'JDK 21 not found in ToolRoot/java' }
$env:JAVA_HOME=$jdk.FullName
$env:ANDROID_HOME=Join-Path $ToolRoot 'sdk'
$env:GRADLE_USER_HOME=Join-Path $ToolRoot 'gradle'
# Use a normal long-path temp directory: this Windows host rejects AF_UNIX sockets
# whose temporary name goes through the ADMINI~1 short-path alias.
$javaTemp=Join-Path $ToolRoot 'java-tmp'
New-Item -ItemType Directory -Path $javaTemp -Force | Out-Null
$env:JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$javaTemp -Djava.io.tmpdir=$javaTemp -Dfile.encoding=UTF-8"
$sdkPath=$env:ANDROID_HOME.Replace('\','/')
[IO.File]::WriteAllText((Join-Path $projectRoot 'android/local.properties'),"sdk.dir=$sdkPath`n")
Push-Location $projectRoot
try {
    & node scripts/check-course-integrity.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Course integrity gate failed; release build stopped' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
    $privateDir=Join-Path $projectRoot '.private'
    $keyPath=Join-Path $privateDir 'zhizhan-release.jks'
    $properties=Join-Path $privateDir 'signing.properties'
    if (!(Test-Path -LiteralPath $keyPath)) {
        if (Test-Path -LiteralPath $properties) { throw 'Signing properties exists without key; recover the original signing key first' }
        New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
        $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
        $bytes=New-Object byte[] 32
        $rng.GetBytes($bytes)
        $env:ZHIZHAN_KEYPASS=[Convert]::ToBase64String($bytes)
        & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $keyPath -alias zhizhan -keyalg RSA -keysize 3072 -validity 10000 -storepass:env ZHIZHAN_KEYPASS -keypass:env ZHIZHAN_KEYPASS -dname 'CN=Zhizhan Local, OU=Personal Development, O=Zhizhan, C=CN'
        if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed' }
        [IO.File]::WriteAllText($properties,"storePassword=$env:ZHIZHAN_KEYPASS`nkeyPassword=$env:ZHIZHAN_KEYPASS`nkeyAlias=zhizhan`n")
        Remove-Item Env:ZHIZHAN_KEYPASS
    }
    Push-Location android
    try {
        $gradleArgs=@('--no-daemon','--console=plain','assembleRelease')
        if($Offline){$gradleArgs+='--offline'}
        & ./gradlew.bat @gradleArgs
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
    } finally { Pop-Location }
    New-Item -ItemType Directory -Path release -Force | Out-Null
    $apkPath = "release/zhizhan-$appVersion-android.apk"
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination $apkPath -Force
    & "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose --print-certs $apkPath
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
    Get-FileHash -LiteralPath $apkPath -Algorithm SHA256
} finally { Pop-Location }
