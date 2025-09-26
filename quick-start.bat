@echo off
chcp 65001 >nul 2>&1
cls
echo 🚀 MMA Tablo - Быстрый запуск
echo.

:: Переходим в директорию скрипта
cd /d "%~dp0"

:: Проверяем Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден! Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js найден

:: Проверяем структуру проекта
if not exist "backend" (
    echo ❌ Папка backend не найдена!
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ❌ Папка frontend не найдена!
    pause
    exit /b 1
)

echo ✅ Структура проекта корректна

:: Останавливаем предыдущие процессы
echo 🛑 Остановка старых процессов Node.js...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Backend
echo 📦 Настройка Backend...
cd backend

:: Устанавливаем зависимости если нужно
if not exist "node_modules" (
    echo 🔄 Установка зависимостей backend...
    npm install --silent --no-audit
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки зависимостей backend
        pause
        exit /b 1
    )
)

:: Создаем .env файл (не .env.local!)
echo PORT=5001> .env
echo HOST=localhost>> .env
echo NODE_ENV=development>> .env
echo CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001>> .env
echo JWT_SECRET=local-dev-secret-2024>> .env
echo DB_PATH=./database.sqlite>> .env

echo ✅ Backend настроен

:: Запуск Backend
echo 🖥️ Запуск Backend на localhost:5001...
start "MMA Backend" cmd /k "title MMA Backend && echo ========================================= && echo    MMA Backend Server && echo ========================================= && echo URL: http://localhost:5001 && echo API: http://localhost:5001/api && echo Health: http://localhost:5001/api/health && echo ========================================= && echo. && node server.js"

:: Ждем запуска backend
echo ⏳ Ожидание запуска Backend...
timeout /t 8 /nobreak >nul

:: Проверяем backend
echo 🔍 Проверка Backend...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:5001/api/health' -TimeoutSec 10; Write-Host '✅ Backend работает!' -ForegroundColor Green } catch { Write-Host '⚠️ Backend еще запускается или есть ошибки' -ForegroundColor Yellow }"

:: Frontend
echo 📦 Настройка Frontend...
cd ../frontend

:: Устанавливаем зависимости если нужно
if not exist "node_modules" (
    echo 🔄 Установка зависимостей frontend...
    npm install --silent --no-audit
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки зависимостей frontend
        pause
        exit /b 1
    )
)

:: Создаем .env файл для frontend
echo REACT_APP_API_URL=http://localhost:5001/api> .env
echo HOST=localhost>> .env
echo PORT=3001>> .env
echo BROWSER=chrome>> .env
echo ESLINT_NO_DEV_ERRORS=true>> .env

echo ✅ Frontend настроен

:: Запуск Frontend
echo 🌐 Запуск Frontend на localhost:3001...
start "MMA Frontend" cmd /k "title MMA Frontend && echo ========================================= && echo    MMA Frontend Server && echo ========================================= && echo URL: http://localhost:3001 && echo API: http://localhost:5001/api && echo ========================================= && echo. && npm start"

:: Возвращаемся в корень
cd..

echo.
echo ========================================
echo ✅ Серверы запускаются!
echo ========================================
echo 🖥️ Backend:  http://localhost:5001
echo 🌐 Frontend: http://localhost:3001
echo 🏥 Health:   http://localhost:5001/api/health
echo.
echo 👥 Тестовые данные для входа:
echo    Администратор: admin / admin123
echo    Диспетчер: dispatcher / user123
echo.
echo ⏳ Подождите ~30-60 секунд для полного запуска
echo 📋 Окна серверов откроются в отдельных терминалах
echo 🛑 Для остановки закройте окна терминалов
echo ========================================

:: Финальная проверка через 15 секунд
timeout /t 15 /nobreak >nul
echo.
echo 🔍 Финальная проверка серверов...
powershell -Command "try { Invoke-RestMethod -Uri 'http://localhost:5001/api/health' -TimeoutSec 5 | Out-Null; Write-Host '✅ Backend API работает' -ForegroundColor Green } catch { Write-Host '❌ Backend недоступен' -ForegroundColor Red }"

powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001' -TimeoutSec 5; if($response.StatusCode -eq 200) { Write-Host '✅ Frontend работает' -ForegroundColor Green } } catch { Write-Host '⚠️ Frontend еще загружается' -ForegroundColor Yellow }"

echo.
echo 🎉 Готово! Откройте браузер и перейдите на http://localhost:3001
echo.
pause