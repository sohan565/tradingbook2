@echo off
title TradingBook Server Launcher
echo ===================================================
echo   ⚡ Starting TradingBook Local Server ⚡
echo ===================================================
echo.

:: Navigate to this batch file's directory
cd /d "%~dp0"

:: Open the browser in the background after a brief delay
echo [INFO] Preparing browser launch...
start /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

:: Run the development server in this window
echo [INFO] Launching Next.js development server...
npm run dev

echo.
echo ===================================================
echo   To stop the server, press Ctrl+C or close this window.
echo ===================================================
pause
