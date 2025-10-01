Write-Host "Generating keystore for Trinity Online app..." -ForegroundColor Green

# Try to find keytool
$keytoolPath = $null

# Check if JAVA_HOME is set
if ($env:JAVA_HOME) {
    $javaKeytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
    if (Test-Path $javaKeytool) {
        $keytoolPath = $javaKeytool
    }
}

# Check Android SDK
if ($env:ANDROID_HOME) {
    $androidKeytool = Join-Path $env:ANDROID_HOME "build-tools\34.0.0\keytool.exe"
    if (Test-Path $androidKeytool) {
        $keytoolPath = $androidKeytool
    } else {
        $androidKeytool = Join-Path $env:ANDROID_HOME "build-tools\33.0.0\keytool.exe"
        if (Test-Path $androidKeytool) {
            $keytoolPath = $androidKeytool
        }
    }
}

if (-not $keytoolPath) {
    Write-Host "ERROR: keytool not found. Please ensure Java or Android SDK is installed." -ForegroundColor Red
    Write-Host "You can manually create the keystore using Android Studio:" -ForegroundColor Yellow
    Write-Host "1. Open Android Studio" -ForegroundColor Yellow
    Write-Host "2. Go to Build -> Generate Signed Bundle / APK" -ForegroundColor Yellow
    Write-Host "3. Create a new keystore" -ForegroundColor Yellow
    Write-Host "4. Save it as 'release-key.jks' in the app folder" -ForegroundColor Yellow
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "Using keytool: $keytoolPath" -ForegroundColor Cyan

# Generate the keystore
$arguments = @(
    "-genkey",
    "-v",
    "-keystore", "app/release-key.jks",
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-alias", "trinityonline",
    "-storepass", "trinityonline2024",
    "-keypass", "trinityonline2024",
    "-dname", "CN=Trinity Online, OU=Development, O=Trinity Family School, L=Kampala, S=Uganda, C=UG"
)

try {
    & $keytoolPath @arguments
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS: Keystore generated successfully!" -ForegroundColor Green
        Write-Host "File: app/release-key.jks" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "You can now build a signed release APK using:" -ForegroundColor Yellow
        Write-Host "./gradlew assembleRelease" -ForegroundColor White
    } else {
        Write-Host "ERROR: Failed to generate keystore." -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: Failed to generate keystore: $_" -ForegroundColor Red
    Write-Host "Please try manually creating it in Android Studio." -ForegroundColor Yellow
}

Read-Host "Press Enter to continue"
