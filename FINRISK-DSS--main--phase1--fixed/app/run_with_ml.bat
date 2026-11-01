@echo off
setlocal
cd /d "%~dp0"
if not "%~1"=="" set "FINRISK_SNAPSHOT=%~1"
if not exist ".venv\Scripts\python.exe" (
  echo Run setup_windows.bat first.
  exit /b 1
)
rem No machine-specific snapshot default. Without config the UI runs and ML returns 503.
.venv\Scripts\python.exe backend_api\server.py --port 8080
