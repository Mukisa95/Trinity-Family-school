param([string[]]$Tasks = @(':app:testDebugUnitTest', ':app:assembleDebug', ':app:assembleDebugAndroidTest'), [string]$School = 'trinity-live', [switch]$Signed)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Set JAVA_HOME and ANDROID_HOME to your installed JDK and Android SDK.' }
$env:TRINITY_ANDROID_SCHOOL = $School
if ($Signed) {
    $credentialsPath = Join-Path $env:USERPROFILE ".codex/android-signing/$School/credentials.json"
    if (-not (Test-Path -LiteralPath $credentialsPath)) { throw "Missing permanent signing credentials for $School. Create and back up the school key first." }
    $credentials = Get-Content -LiteralPath $credentialsPath -Raw | ConvertFrom-Json
    $env:TRINITY_ANDROID_KEYSTORE = $credentials.keystore
    $env:TRINITY_ANDROID_STORE_PASSWORD = $credentials.storePassword
    $env:TRINITY_ANDROID_KEY_ALIAS = $credentials.keyAlias
    $env:TRINITY_ANDROID_KEY_PASSWORD = $credentials.keyPassword
}
Push-Location -LiteralPath $taskRoot
try {
    & node scripts/build-android-offline.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Offline interface packaging failed.' }
    & (Join-Path $taskRoot 'android-app/gradlew.bat') -p (Join-Path $taskRoot 'android-app') @Tasks "-Pschool=$School" --console=plain --no-daemon --max-workers=2
    if ($LASTEXITCODE -ne 0) { throw 'Android checks/build failed.' }
} finally {
    Pop-Location
    foreach ($name in @('TRINITY_ANDROID_KEYSTORE','TRINITY_ANDROID_STORE_PASSWORD','TRINITY_ANDROID_KEY_ALIAS','TRINITY_ANDROID_KEY_PASSWORD')) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
}
