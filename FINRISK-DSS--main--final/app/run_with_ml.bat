@echo off
setlocal
cd /d "%~dp0"
if not "%~1"=="" set "FINRISK_SNAPSHOT=%~1"
set "HOST=%~2"
if "%HOST%"=="" set "HOST=127.0.0.1"
rem Optional 2nd argument: 0.0.0.0 lets phones/laptops on the same private network connect (no authentication!).
if not exist ".venv\Scripts\python.exe" (
  echo Run setup_windows.bat first.
  exit /b 1
)

if "%FINRISK_SNAPSHOT%"=="" (
  .venv\Scripts\python.exe qa\w07_environment_check.py
) else (
  .venv\Scripts\python.exe qa\w07_environment_check.py --snapshot "%FINRISK_SNAPSHOT%"
)
if errorlevel 1 (
  echo [FAIL] Runtime/model compatibility gate. ML API startup is blocked.
  echo Run setup_windows.bat and review evidence\w07\environment_check_results.txt.
  exit /b 1
)

rem No machine-specific snapshot default. Without config the UI runs and ML returns 503.
.venv\Scripts\python.exe backend_api\server.py --port 8080 --host %HOST%
