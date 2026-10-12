@echo off
setlocal
cd /d "%~dp0"
set PORT=8080

echo ======================================================
echo CarbonGraph MVP v0.6 - Localhost Launcher
echo URL: http://127.0.0.1:%PORT%
echo ======================================================

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%"
  py serve_local.py --port %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%"
  python serve_local.py --port %PORT%
  goto :eof
)

echo Python was not found in PATH.
echo Install Python or run another static HTTP server in this folder.
pause
