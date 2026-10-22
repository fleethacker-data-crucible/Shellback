@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0" || exit /b 1
echo [SYNAPSE LOCAL DEV] Offline synthetic pilot; no CAC or backend required.
echo Do not enter real personnel or sensitive workforce data.
if not exist "%~dp0Synapse-Standalone.html" (echo Missing offline application. & exit /b 1)
start "" "%~dp0Synapse-Standalone.html"
exit /b 0
