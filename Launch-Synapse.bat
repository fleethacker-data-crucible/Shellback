@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0" || exit /b 1
echo [SYNAPSE] Offline synthetic pilot. No CAC, no backend, no installation.
echo [SYNAPSE] Do not enter real personnel, qualification, or sensitive workforce data.
if not exist "%~dp0dist\index.html" (
  echo [SYNAPSE] dist\index.html is missing. Build off-workstation with "npm run build" and copy dist\ next to this file.
  echo [SYNAPSE] Alternatively double-click dist\Synapse-Standalone.html if it is present.
  exit /b 1
)
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [SYNAPSE] powershell.exe not found. Opening the single-file edition instead.
  start "" "%~dp0dist\Synapse-Standalone.html"
  exit /b 0
)
powershell.exe -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%~dp0tools\Serve-Synapse.ps1" %*
exit /b %errorlevel%
