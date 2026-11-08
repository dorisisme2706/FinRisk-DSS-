@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [FAIL] Project .venv is missing. Run setup_windows.bat first.
  exit /b 1
)
.venv\Scripts\python.exe qa\w07_environment_check.py
if errorlevel 1 exit /b 1
.venv\Scripts\python.exe -m unittest backend_api.test_server -v
if errorlevel 1 exit /b 1
echo.
echo ALL BACKEND API TESTS PASSED.
pause
