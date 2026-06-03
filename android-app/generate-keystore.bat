@echo off
echo Generating keystore for Trinity Online app...

REM Try to find keytool in common locations
set KEYTOOL_PATH=

REM Check if JAVA_HOME is set
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\keytool.exe" (
        set KEYTOOL_PATH="%JAVA_HOME%\bin\keytool.exe"
    )
)

REM Check Android SDK
if defined ANDROID_HOME (
    if exist "%ANDROID_HOME%\build-tools\34.0.0\keytool.exe" (
        set KEYTOOL_PATH="%ANDROID_HOME%\build-tools\34.0.0\keytool.exe"
    ) else if exist "%ANDROID_HOME%\build-tools\33.0.0\keytool.exe" (
        set KEYTOOL_PATH="%ANDROID_HOME%\build-tools\33.0.0\keytool.exe"
    ) else if exist "%ANDROID_HOME%\build-tools\32.0.0\keytool.exe" (
        set KEYTOOL_PATH="%ANDROID_HOME%\build-tools\32.0.0\keytool.exe"
    )
)

REM Check if keytool was found
if "%KEYTOOL_PATH%"=="" (
    echo ERROR: keytool not found. Please ensure Java or Android SDK is installed.
    echo You can manually create the keystore using Android Studio:
    echo 1. Open Android Studio
    echo 2. Go to Build -^> Generate Signed Bundle / APK
    echo 3. Create a new keystore
    echo 4. Save it as "release-key.jks" in the app folder
    pause
    exit /b 1
)

echo Using keytool: %KEYTOOL_PATH%

REM Generate the keystore
%KEYTOOL_PATH% -genkey -v -keystore app/release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias trinityonline -storepass trinityonline2024 -keypass trinityonline2024 -dname "CN=Trinity Online, OU=Development, O=Trinity Family School, L=Kampala, S=Uganda, C=UG"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: Keystore generated successfully!
    echo File: app/release-key.jks
    echo.
    echo You can now build a signed release APK using:
    echo ./gradlew assembleRelease
) else (
    echo.
    echo ERROR: Failed to generate keystore.
    echo Please try manually creating it in Android Studio.
)

pause
