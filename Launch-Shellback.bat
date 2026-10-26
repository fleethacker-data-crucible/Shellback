@echo off
rem Starts Shellback in the browser. Options: --stay (keep running after the tab closes), --replace (stop a running server without asking), -Port 8765, -NoBrowser
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0" || exit /b 1
echo [SHELLBACK] Offline synthetic pilot. No smart card, no backend, no installation.
echo [SHELLBACK] Do not enter real personnel, qualification, or sensitive workforce data.
if not exist "%~dp0dist\index.html" (
  echo [SHELLBACK] dist\index.html is missing. Build off-workstation with "npm run build" and copy dist\ next to this file.
  echo [SHELLBACK] Alternatively double-click dist\Shellback-Standalone.html if it is present.
  exit /b 1
)
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [SHELLBACK] powershell.exe not found. Opening the single-file edition instead.
  start "" "%~dp0dist\Shellback-Standalone.html"
  exit /b 0
)
powershell.exe -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%~dp0tools\Start-Shellback.ps1" %*
exit /b %errorlevel%
