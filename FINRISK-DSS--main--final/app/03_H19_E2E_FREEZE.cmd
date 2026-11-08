@echo off
setlocal
cd /d "%~dp0"
if not "%~1"=="" set "FINRISK_SNAPSHOT=%~1"
if "%FINRISK_SNAPSHOT%"=="" (
  echo Usage: 03_H19_E2E_FREEZE.cmd "D:\DSS\FinRisk_CORE4_Snapshot"
  exit /b 2
)
if not exist ".venv\Scripts\python.exe" (
  echo Chua co .venv. Hay chay setup_windows.bat truoc.
  exit /b 2
)
.venv\Scripts\python.exe qa\w07_environment_check.py --snapshot "%FINRISK_SNAPSHOT%"
if errorlevel 1 exit /b 1
.venv\Scripts\python.exe qa\verify_h19.py --snapshot "%FINRISK_SNAPSHOT%"
if errorlevel 1 exit /b %errorlevel%
echo PASS_M5_FREEZE
