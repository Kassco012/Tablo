@echo off
chcp 65001
cls
echo ========================================
echo   🚀 MMA АКТОГАЙ - Tablo System
echo ========================================
echo.

:: Проверяем существование директорий
if not exist "C:\Tablo\backend" (
    echo ❌ Папка C:\Tablo\backend не найдена!
    pause
    exit /b 1
)

if not exist "C:\Tablo\frontend" (
    echo ❌ Папка C:\Tablo\frontend не найдена!
    pause
    exit /b 1
)

echo ✅ Проверка директорий пройдена
echo.

:: Создаем/обновляем .env файлы
echo 🔧 Настройка конфигурации...

:: Backend .env
cd /d "C:\Tablo\backend"
echo PORT=5001> .env
echo HOST=0.0.0.0>> .env
echo FRONTEND_URL=http://10.35.3.117:3001,http://localhost:3001>> .env
echo CORS_ORIGINS=http://10.35.3.117:3001,http://localhost:3001,http://127.0.0.1:3001,http://10.35.3.117:5001>> .env
echo JWT_SECRET=MMA-Equipment-Aktogay-2025-Prod-Secret-Key-Change-This>> .env
echo NODE_ENV=development>> .env
echo DB_PATH=./database.sqlite>> .env
echo BCRYPT_ROUNDS=10>> .env
echo JWT_EXPIRES_IN=24h>> .env
echo LOG_LEVEL=info>> .env

:: Frontend .env
cd /d "C:\Tablo\frontend"
echo REACT_APP_API_URL=http://10.35.3.117:5001/api> .env
echo HOST=0.0.0.0>> .env
echo PORT=3001>> .env
echo HTTPS=false>> .env
echo BROWSER=none>> .env
echo ESLINT_NO_DEV_ERRORS=true>> .env
echo GENERATE_SOURCEMAP=false>> .env

echo ✅ Конфигурация обновлена
echo.

:: Проверяем и устанавливаем зависимости если нужно
echo 📦 Проверка зависимостей...

cd /d "C:\Tablo\backend"
if not exist "node_modules" (
    echo 🔄 Установка зависимостей backend...
    npm install --silent
)

cd /d "C:\Tablo\frontend"
if not exist "node_modules" (
    echo 🔄 Установка зависимостей frontend...
    npm install --silent
)

echo ✅ Зависимости проверены
echo.

:: Останавливаем существующие процессы
echo 🛑 Остановка существующих процессов...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Запуск Backend
echo 🖥️ Запуск Backend сервера...
cd /d "C:\Tablo\backend"
start "MMA Backend Server" cmd /k "echo MMA АКТОГАЙ - Backend Server && echo Порт: 5001 && echo IP: 10.35.3.117 && echo. && node server.js"

:: Ждем запуска backend
echo ⏳ Ожидание запуска Backend...
timeout /t 8 /nobreak >nul

:: Проверяем что backend запустился
echo 🔍 Проверка Backend...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:5001/api/health' -TimeoutSec 5; Write-Host '✅ Backend работает' } catch { Write-Host '❌ Backend не отвечает' }" 2>nul

:: Запуск Frontend
echo 🌐 Запуск Frontend сервера...
cd /d "C:\Tablo\frontend"
start "MMA Frontend Server" cmd /k "echo MMA АКТОГАЙ - Frontend Server && echo Порт: 3001 && echo IP: 10.35.3.117 && echo. && npm start"

:: Ждем запуска frontend
echo ⏳ Ожидание запуска Frontend...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo ✅ Серверы запущены!
echo ========================================
echo 🖥️ Backend:  http://10.35.3.117:5001
echo 🌐 Frontend: http://10.35.3.117:3001
echo 🏥 Health:   http://10.35.3.117:5001/api/health
echo.
echo 📱 Доступ с других устройств:
echo    http://10.35.3.117:3001
echo.
echo 👥 Тестовые учетные данные:
echo    Администратор: admin / admin123
echo    Диспетчер: dispatcher / user123
echo ========================================
echo.

:: Настройка Windows Firewall
echo 🛡️ Настройка Windows Firewall...
netsh advfirewall firewall delete rule name="MMA Backend Port 5001" >nul 2>&1
netsh advfirewall firewall delete rule name="MMA Frontend Port 3001" >nul 2>&1
netsh advfirewall firewall add rule name="MMA Backend Port 5001" dir=in action=allow protocol=TCP localport=5001 >nul 2>&1
netsh advfirewall firewall add rule name="MMA Frontend Port 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Firewall настроен
) else (
    echo ⚠️ Запустите как администратор для настройки Firewall
)

echo.
echo 🚀 Система готова к работе!
echo 📋 Логи отображаются в отдельных окнах терминала
echo 🛑 Для остановки закройте окна терминалов или нажмите Ctrl+C
echo.
echo Нажмите любую клавишу для выхода из этого меню...
pause >nul