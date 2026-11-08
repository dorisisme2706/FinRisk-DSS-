@echo off
setlocal
pushd "%~dp0"
set "PY=.venv\Scripts\python.exe"
if not exist "%PY%" (
  py -3.14 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,14) and sys.maxsize > 2**32 else 1)" >nul 2>&1
  if errorlevel 1 (
    echo [FAIL] CPython 3.14 x64 not found. Run setup_windows.bat first.
    popd
    exit /b 1
  )
  set "PY=py -3.14"
)
echo ============================================================
echo FinRisk DSS - M08.2 Data Contract and PostgreSQL Design Audit
echo ============================================================
%PY% qa\m08_verify_freeze.py
if errorlevel 1 goto fail
%PY% qa\m08_mock_real_audit.py --json-out evidence\m08\M08_MOCK_REAL_AUDIT_20261107.json
if errorlevel 1 goto fail
%PY% qa\m08_database_design_audit.py
if errorlevel 1 goto fail
node --test tests\finrisk-m08-database-design.test.js
if errorlevel 1 goto fail
echo.
echo [PASS] M08.2 design artifacts and protected baseline verified.
echo [INFO] PostgreSQL SQL is a draft and has NOT been applied.
popd
exit /b 0
:fail
echo.
echo [FAIL] M08.2 design audit did not pass. Review the error output above.
popd
exit /b 1
