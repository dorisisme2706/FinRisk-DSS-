@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo FinRisk DSS - Python 3.14 model environment setup
echo ============================================================

where py >nul 2>nul
if errorlevel 1 (
  echo [FAIL] Python Launcher py.exe was not found.
  echo Install 64-bit CPython 3.14, then reopen this terminal.
  exit /b 1
)

py -3.14 -c "import struct,sys; raise SystemExit(0 if sys.implementation.name == 'cpython' and sys.version_info[:2] == (3,14) and struct.calcsize('P') == 8 else 1)" >nul 2>nul
if errorlevel 1 (
  echo [FAIL] The frozen H16 model requires 64-bit CPython 3.14.
  echo Installed Python interpreters:
  py -0p
  echo Install 64-bit CPython 3.14 before continuing.
  exit /b 1
)

if exist ".venv" goto CHECK_EXISTING_VENV
goto CREATE_VENV

:CHECK_EXISTING_VENV
if not exist ".venv\Scripts\python.exe" goto BACKUP_EXISTING_VENV
.venv\Scripts\python.exe -c "import struct,sys; raise SystemExit(0 if sys.implementation.name == 'cpython' and sys.version_info[:2] == (3,14) and struct.calcsize('P') == 8 else 1)" >nul 2>nul
if errorlevel 1 goto BACKUP_EXISTING_VENV
goto INSTALL_LOCK

:BACKUP_EXISTING_VENV
set "BACKUP_DIR=.venv_backup"
set "BACKUP_INDEX=0"
:FIND_BACKUP_NAME
if not exist "%BACKUP_DIR%" goto DO_BACKUP
set /a BACKUP_INDEX+=1
set "BACKUP_DIR=.venv_backup_%BACKUP_INDEX%"
goto FIND_BACKUP_NAME
:DO_BACKUP
ren ".venv" "%BACKUP_DIR%"
if errorlevel 1 (
  echo [FAIL] Could not preserve the existing incompatible .venv.
  echo Close programs using .venv and retry.
  exit /b 1
)
echo [INFO] Existing environment preserved as %BACKUP_DIR%.

:CREATE_VENV
py -3.14 -m venv .venv
if errorlevel 1 exit /b 1

:INSTALL_LOCK
echo.
echo ==== Upgrade pip ====
.venv\Scripts\python.exe -m pip install --upgrade pip
if errorlevel 1 exit /b 1

echo.
echo ==== Install exact H16 runtime lock (binary wheels only) ====
.venv\Scripts\python.exe -m pip install --only-binary=:all: --upgrade -r backend_ml\model\requirements-lock.txt
if errorlevel 1 (
  echo [FAIL] Pinned packages could not be installed.
  echo Confirm internet access to PyPI and use 64-bit CPython 3.14.
  exit /b 1
)

echo.
echo ==== pip dependency consistency ====
.venv\Scripts\python.exe -m pip check
if errorlevel 1 exit /b 1

echo.
echo ==== Strict H16 runtime compatibility gate ====
.venv\Scripts\python.exe qa\w07_environment_check.py
if errorlevel 1 (
  echo [FAIL] Runtime gate did not pass. Do not start the ML API.
  exit /b 1
)

echo.
echo [PASS] Python 3.14 environment and frozen H16 model are compatible.
pause
