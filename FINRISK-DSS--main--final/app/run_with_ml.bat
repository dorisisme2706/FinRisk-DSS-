@echo off
setlocal
cd /d "%~dp0"
if not "%~1"=="" set "FINRISK_SNAPSHOT=%~1"
if not defined FINRISK_SNAPSHOT (
  if exist "D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot" (
    set "FINRISK_SNAPSHOT=D:\FinRisk_CORE4_Snapshot_For_GK_20261029\FinRisk_CORE4_Snapshot"
  )
)
set "HOST=%~2"
if "%HOST%"=="" set "HOST= 127.0.0.1"
if not exist ".venv\Scripts\python.exe" (
  echo Run setup_windows.bat first.
  exit /b 1
)

if not defined FINRISK_SNAPSHOT (
  .venv\Scripts\python.exe qa\w07_environment_check.py
) else (
  .venv\Scripts\python.exe qa\w07_environment_check.py --snapshot "%FINRISK_SNAPSHOT%"
)
if errorlevel 1 (
  echo [FAIL] Runtime/model compatibility gate. ML API startup is blocked.
  exit /b 1
)

if not defined FINRISK_SNAPSHOT (
  .venv\Scripts\python.exe backend_api\server.py --port 8080 --host %HOST%
) else (
  .venv\Scripts\python.exe backend_api\server.py --port 8080 --host %HOST% --snapshot "%FINRISK_SNAPSHOT%"
)
