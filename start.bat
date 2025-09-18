@echo off
echo ========================================
echo Starting Tablo MMA
echo ========================================

echo Starting Backend...
cd /d C:\Tablo\backend
start "Tablo" cmd /k "node server.js"

timeout /t 5

echo Starting Frontend...
cd /d C:\Tablo\frontend
start "Tablo" cmd /k "npm start"

echo ========================================
echo Backend: http://localhost:5001
echo Frontend: http://localhost:3001
echo ========================================
echo Press any key to stop servers...
pause


