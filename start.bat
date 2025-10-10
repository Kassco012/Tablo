@echo off
chcp 65001
cls
echo ========================================
echo   🚀 MMA АКТОГАЙ - Tablo System
echo ========================================
echo.

:: Получаем текущую директорию
set "CURRENT_DIR=%~dp0"
set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

echo 📍 Рабочая директория: %CURRENT_DIR%

:: Проверяем существование директорий
if not exist "%CURRENT_DIR%\backend" (
    echo ❌ Папка backend не найдена в %CURRENT_DIR%!
    pause
    exit /b 1
)

if not exist "%CURRENT_DIR%\frontend" (
    echo ❌ Папка frontend не найдена в %CURRENT_DIR%!
    pause
    exit /b 1
)

echo ✅ Проверка директорий пройдена
echo.

:: Создаем/обновляем .env файлы
echo 🔧 Настройка конфигурации...

:: Backend .env
cd /d "%CURRENT_DIR%\backend"
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
cd /d "%CURRENT_DIR%\frontend"
echo REACT_APP_API_URL=http://10.35.3.117:5001/api> .env
echo HOST=0.0.0.0>> .env
echo PORT=3001>> .env
echo HTTPS=false>> .env
echo BROWSER=none>> .env
echo ESLINT_NO_DEV_ERRORS=true>> .env
echo GENERATE_SOURCEMAP=false>> .env

echo ✅ Конфигурация обновлена
echo.

:: Определяем Node.js и npm
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден в PATH!
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm не найден в PATH!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% и npm %NPM_VERSION% найдены

:: Проверяем и устанавливаем зависимости если нужно
echo 📦 Проверка зависимостей...

cd /d "%CURRENT_DIR%\backend"
if not exist "node_modules" (
    echo 🔄 Установка зависимостей backend...
    npm install --silent --no-audit
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки зависимостей backend
        pause
        exit /b 1
    )
) else (
    echo ✅ Зависимости backend найдены
)

cd /d "%CURRENT_DIR%\frontend"
if not exist "node_modules" (
    echo 🔄 Установка зависимостей frontend...
    npm install --silent --no-audit
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки зависимостей frontend
        pause
        exit /b 1
    )
) else (
    echo ✅ Зависимости frontend найдены
)

echo ✅ Зависимости проверены
echo.

:: Останавливаем существующие процессы
echo 🛑 Остановка существующих процессов...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Запуск Backend
echo 🖥️ Запуск Backend сервера...
cd /d "%CURRENT_DIR%\backend"
start "MMA Backend Server" cmd /k "echo MMA АКТОГАЙ - Backend Server && echo Порт: 5001 && echo IP: 10.35.3.117 && echo Локально: http://localhost:5002 && echo Сеть: http://10.35.3.117:5002 && echo. && node server.js"

:: Ждем запуска backend
echo ⏳ Ожидание запуска Backend...
timeout /t 8 /nobreak >nul

:: Проверяем что backend запустился
echo 🔍 Проверка Backend...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:5001/api/health' -TimeoutSec 10; Write-Host '✅ Backend работает на localhost:5001' -ForegroundColor Green } catch { Write-Host '❌ Backend не отвечает на localhost:5001' -ForegroundColor Red }" 2>nul

:: Также проверяем на сетевом IP
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://10.35.3.117:5001/api/health' -TimeoutSec 5; Write-Host '✅ Backend доступен на 10.35.3.117:5001' -ForegroundColor Green } catch { Write-Host '⚠️ Backend может быть недоступен на 10.35.3.117:5001' -ForegroundColor Yellow }" 2>nul

:: Запуск Frontend
echo 🌐 Запуск Frontend сервера...
cd /d "%CURRENT_DIR%\frontend"
start "MMA Frontend Server" cmd /k "echo MMA АКТОГАЙ - Frontend Server && echo Порт: 3001 && echo IP: 10.35.3.117 && echo Локально: http://localhost:3001 && echo Сеть: http://10.35.3.117:3001 && echo. && npm start"

:: Ждем запуска frontend
echo ⏳ Ожидание запуска Frontend...
timeout /t 15 /nobreak >nul

echo.
echo ========================================
echo ✅ Серверы запущены!
echo ========================================
echo 🖥️ Backend API:
echo    Локально:  http://localhost:5001
echo    По сети:   http://10.35.3.117:5001
echo    Health:    http://10.35.3.117:5001/api/health
echo.
echo 🌐 Frontend App:
echo    Локально:  http://localhost:3001
echo    По сети:   http://10.35.3.117:3001
echo.
echo 📱 Доступ с других устройств в сети:
echo    http://10.35.3.117:3001
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
echo 📋 Логи отображаются в отдельных окнах терминалов
echo 🛑 Для остановки закройте окна терминалов или запустите stop.bat
echo.
echo 🔧 Отладка:
echo    Если не работает - проверьте:
echo    1. Порты 5001 и 3001 свободны
echo    2. Firewall не блокирует соединения
echo    3. Антивирус не блокирует Node.js
echo.
echo Нажмите любую клавишу для выхода из этого меню...
pause >nul