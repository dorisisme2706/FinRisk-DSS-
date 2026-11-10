@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo [BLOCKED] app\.env is missing. Copy database\.env.example to .env and configure local credentials.
  exit /b 2
)
if not exist ".venv\Scripts\python.exe" (
  echo [BLOCKED] Python virtual environment not found. Run setup_windows.bat first.
  exit /b 2
)
".venv\Scripts\python.exe" backend_api\migrate.py --status
if errorlevel 1 exit /b %errorlevel%
echo.
echo Apply the pending M08.3 PostgreSQL migrations now?
choice /C YN /N /M "Y = apply, N = cancel: "
if errorlevel 2 exit /b 0
".venv\Scripts\python.exe" backend_api\migrate.py
exit /b %errorlevel%
