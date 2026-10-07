param([string[]]$Tasks = @(':app:testDebugUnitTest', ':app:assembleDebug', ':app:assembleDebugAndroidTest'))
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Set JAVA_HOME and ANDROID_HOME to your installed JDK and Android SDK.' }
Push-Location -LiteralPath $taskRoot
try {
    & node scripts/build-android-offline.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Offline interface packaging failed.' }
    & (Join-Path $taskRoot 'android-app/gradlew.bat') -p (Join-Path $taskRoot 'android-app') @Tasks --console=plain --no-daemon --max-workers=2
    if ($LASTEXITCODE -ne 0) { throw 'Android checks/build failed.' }
} finally { Pop-Location }
