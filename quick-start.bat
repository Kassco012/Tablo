@echo off
echo 🚀 MMA Табло - Быстрый запуск
echo.

cd /d "%~dp0"

:: Установка зависимостей backend
echo 📦 Проверка backend...
cd backend
if not exist "node_modules" (
    echo Установка зависимостей backend...
    npm install
)

:: Создаем .env файл для Windows
echo PORT=5001> .env
echo HOST=localhost>> .env
echo FRONTEND_URL=http://localhost:3001>> .env
echo CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001>> .env
echo JWT_SECRET=local-development-secret-key-2024>> .env
echo NODE_ENV=development>> .env
echo DB_PATH=./database.sqlite>> .env

cd..

:: Установка зависимостей frontend
echo 📦 Проверка frontend...
cd frontend
if not exist "node_modules" (
    echo Установка зависимостей frontend...
    npm install
)

:: Создаем .env файл для frontend
echo REACT_APP_API_URL=http://localhost:5001/api> .env
echo HOST=localhost>> .env
echo PORT=3001>> .env
echo BROWSER=chrome>> .env
echo ESLINT_NO_DEV_ERRORS=true>> .env

cd..

:: Очистка портов
echo 🔧 Очистка портов...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5001" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

:: Запуск backend
echo 🖥️ Запуск Backend...
cd backend
start "Backend" cmd /k "echo Backend Server && node server.js"

:: Ждем 5 секунд
echo ⏳ Ожидание...
timeout /t 5 /nobreak >nul

:: Запуск frontend  
echo 🌐 Запуск Frontend...
cd ../frontend
start "Frontend" cmd /k "echo Frontend Server && npm start"

echo.
echo ✅ Запущено!
echo 🌐 Frontend: http://localhost:3001
echo 🖥️ Backend: http://localhost:5001
echo.
pause