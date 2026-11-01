@echo off
setlocal
cd /d "%~dp0"
set PORT=8080
set "SNAPSHOT=%~1"
if "%SNAPSHOT%"=="" set "SNAPSHOT=D:\DSS\FinRisk_CORE4_Snapshot"

echo ======================================================
echo FinRisk DSS - UI + H13 ML API
echo URL: http://127.0.0.1:%PORT%/#result
echo Snapshot: %SNAPSHOT%
echo ======================================================

if not exist "%SNAPSHOT%\data\feature_matrix.parquet" (
  echo [LOI] Khong thay "%SNAPSHOT%\data\feature_matrix.parquet"
  echo Snapshot phai la thu muc CHA cua "data". Dung: run_with_ml.bat "DUONG_DAN_SNAPSHOT"
  pause
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%/#result"
  py backend_api\server.py --snapshot "%SNAPSHOT%" --port %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%/#result"
  python backend_api\server.py --snapshot "%SNAPSHOT%" --port %PORT%
  goto :eof
)

echo Khong tim thay Python trong PATH. Cai Python 64-bit va: pip install -r backend_ml\model\requirements-lock.txt
pause
