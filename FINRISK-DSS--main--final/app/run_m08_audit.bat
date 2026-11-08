@echo off
setlocal
pushd "%~dp0"
set "PY=.venv\Scripts\python.exe"
if not exist "%PY%" (
  py -3.14 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,14) else 1)" >nul 2>&1
  if errorlevel 1 (
    echo [FAIL] CPython 3.14 not found. Run setup_windows.bat first.
    popd
    exit /b 1
  )
  set "PY=py -3.14"
)
echo ============================================================
echo FinRisk DSS - M08.1 core freeze and REAL/MOCK audit
echo ============================================================
%PY% qa\m08_verify_freeze.py
if errorlevel 1 goto fail
%PY% qa\m08_mock_real_audit.py --json-out evidence\m08\M08_MOCK_REAL_AUDIT_20261107.json
if errorlevel 1 goto fail
node --test tests\finrisk-m08-freeze.test.js tests\finrisk-m08-audit.test.js
if errorlevel 1 goto fail
echo.
echo [PASS] M08.1 freeze and audit completed.
popd
exit /b 0
:fail
echo.
echo [FAIL] M08.1 audit did not pass. Review the error output.
popd
exit /b 1
