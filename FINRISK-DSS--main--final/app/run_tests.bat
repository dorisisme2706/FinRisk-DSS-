@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [FAIL] Node.js was not found. Install Node.js LTS and retry.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [FAIL] Project Python environment is missing.
  echo Run setup_windows.bat before the full regression suite.
  exit /b 1
)

echo ==== STRICT PYTHON / MODEL ENVIRONMENT GATE ====
.venv\Scripts\python.exe qa\w07_environment_check.py
if errorlevel 1 (
  echo [FAIL] Runtime compatibility gate. The full regression suite is blocked.
  exit /b 1
)

echo.
echo ==== FULL NODE.JS TEST SUITE ====
node --test "tests/*.test.js"
if errorlevel 1 exit /b 1

echo.
echo ==== BACKEND API TESTS ====
.venv\Scripts\python.exe -m unittest backend_api.test_server -v
if errorlevel 1 exit /b 1

echo.
echo [PASS] FULL NODE.JS AND PYTHON API TEST SUITES COMPLETED.
pause
