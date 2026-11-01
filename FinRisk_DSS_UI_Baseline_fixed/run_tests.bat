@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if not %errorlevel%==0 (
  echo Node.js not found. UI can still run; automated JS tests require Node.js.
  pause
  exit /b 1
)

for %%F in (tests\state.test.js tests\validation-engine.test.js tests\validation-coverage.test.js tests\claims-engine.test.js tests\graph-engine.test.js tests\release-engine.test.js tests\persistence.test.js tests\report-engine.test.js tests\e2e-engine.test.js tests\pipeline.test.js tests\acceptance-catalog.test.js tests\acceptance-engine.test.js tests\formal-d1-d4.test.js tests\finrisk-ui-01-02.test.js tests\finrisk-ui-20.test.js tests\finrisk-ui-03-04.test.js) do (
  echo.
  echo ==== %%F ====
  node %%F || exit /b 1
)

echo.
echo ALL TESTS PASSED.
pause
