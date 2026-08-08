@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 serve-local.py
  exit /b %errorlevel%
)
where python >nul 2>nul
if %errorlevel%==0 (
  python serve-local.py
  exit /b %errorlevel%
)
echo Python 3 was not found. Install Python or serve this folder from any local HTTP server.
pause
exit /b 1
