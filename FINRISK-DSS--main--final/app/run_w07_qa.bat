@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [FAIL] Project Python environment is missing.
  echo Run setup_windows.bat first.
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [FAIL] Node.js was not found. Install Node.js LTS and retry.
  exit /b 1
)

if not exist "evidence\w07" mkdir "evidence\w07"

echo ============================================================
echo FinRisk DSS - W07 OVERALL QA / RELEASE GATE
echo ============================================================

echo.
echo ==== 0/4 STRICT PYTHON / MODEL COMPATIBILITY GATE ====
if not "%~1"=="" (
  .venv\Scripts\python.exe qa\w07_environment_check.py --snapshot "%~1"
) else (
  .venv\Scripts\python.exe qa\w07_environment_check.py
)
if errorlevel 1 (
  echo [FAIL] Python/model runtime gate. Tests and ML server are blocked.
  echo Run setup_windows.bat and review evidence\w07\environment_check_results.txt.
  exit /b 1
)

echo.
echo ==== 1/4 FULL NODE.JS REGRESSION ====
node --test "tests/*.test.js" > "evidence\w07\node_tests.txt" 2>&1
if errorlevel 1 (
  type "evidence\w07\node_tests.txt"
  exit /b 1
)
type "evidence\w07\node_tests.txt"

echo.
echo ==== 2/4 PYTHON API REGRESSION ====
.venv\Scripts\python.exe -m unittest backend_api.test_server -v > "evidence\w07\api_tests.txt" 2>&1
if errorlevel 1 (
  type "evidence\w07\api_tests.txt"
  exit /b 1
)
type "evidence\w07\api_tests.txt"

echo.
echo ==== 3/4 W07 SOURCE / RELEASE AUDIT ====
.venv\Scripts\python.exe qa\w07_overall_qa.py
if errorlevel 1 exit /b 1

echo.
echo ==== 4/4 OPTIONAL BROWSER QA ====
if exist ".qa_venv\Scripts\python.exe" (
  .qa_venv\Scripts\python.exe -c "import playwright" >nul 2>nul
  if errorlevel 1 (
    echo [SKIP] Playwright is not installed in .qa_venv.
  ) else (
    .qa_venv\Scripts\python.exe qa\w07_browser_qa.py
    if errorlevel 1 exit /b 1
  )
) else (
  echo [SKIP] Optional .qa_venv not found; use the manual Windows browser checklist.
  echo See FINRISK_W07_HANDOFF_20261107.md.
)

echo.
echo [PASS] W07 automated release gate completed.
echo Live CORE4 inference must be confirmed with run_with_ml.bat and the supplied snapshot.
pause
