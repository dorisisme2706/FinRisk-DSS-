@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_finrisk_chat.ps1"
set "FINRISK_EXIT=%ERRORLEVEL%"
if not "%FINRISK_EXIT%"=="0" pause
exit /b %FINRISK_EXIT%
