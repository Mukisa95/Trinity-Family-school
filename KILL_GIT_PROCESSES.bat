@echo off
echo ========================================
echo   KILLING GIT PROCESSES
echo ========================================
echo.

echo Killing git-related processes...
taskkill /F /IM less.exe 2>nul
taskkill /F /IM git.exe 2>nul
taskkill /F /IM sh.exe 2>nul
taskkill /F /IM bash.exe 2>nul

echo.
echo Removing git lock files...
del /F .git\index.lock 2>nul
del /F .git\config.lock 2>nul
del /F .git\*.lock 2>nul

echo.
echo ========================================
echo   PROCESSES KILLED - LOCKS CLEARED
echo ========================================
echo.
echo You can now run DEPLOY_NOW.bat or push manually
echo.
pause

