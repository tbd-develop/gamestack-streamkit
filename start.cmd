@echo off
REM Double-clickable launcher for GameStack StreamKit.
REM Builds the overlay if needed, starts the server, and opens the control panel.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
echo.
echo StreamKit has stopped.
pause
