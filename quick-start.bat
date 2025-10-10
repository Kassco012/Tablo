:: ============================================
:: УЛУЧШЕННЫЙ quick-start.bat
:: С детальной диагностикой ошибок
:: ============================================

@echo off
chcp 65001 >nul 2>&1
cls
echo 🚀 MMA Tablo - Быстрый запуск с диагностикой
echo ========================================
echo.

:: Переходим в директорию скрипта
cd /d "%~dp0"
set "ROOT_DIR=%CD%"

:: Функция проверки Node.js
echo [1/7] 🔍 Проверка окружения...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден!
    echo.
    echo Решение:
    echo 1. Установите Node.js с https://nodejs.org/
    echo 2. Перезапустите командную строку после установки
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION% найден

:: Проверка npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm не найден в PATH!
    pause
    exit /b 1
)

:: Проверяем структуру проекта
echo [2/7] 📂 Проверка структуры проекта...
if not exist "backend" (
    echo ❌ Папка backend не найдена!
    echo Текущая директория: %CD%
    echo.
    echo Решение:
    echo 1. Убедитесь, что запускаете скрипт из корня проекта
    echo 2. Проверьте наличие папок backend и frontend
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ❌ Папка frontend не найдена!
    pause
    exit /b 1
)

echo ✅ Структура проекта корректна

:: Проверка портов перед остановкой
echo [3/7] 🔌 Проверка занятых портов...
netstat -an | find ":5001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Порт 5001 занят, будет освобожден
)

netstat -an | find ":3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Порт 3001 занят, будет освобожден
)

:: Останавливаем предыдущие процессы
echo [4/7] 🛑 Остановка старых процессов...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Старые процессы Node.js остановлены
    timeout /t 3 /nobreak >nul
) else (
    echo ℹ️  Нет активных процессов Node.js
)

:: ============================================
:: BACKEND SETUP
:: ============================================
echo [5/7] 📦 Настройка Backend...
cd backend

:: Проверяем package.json
if not exist "package.json" (
    echo ❌ package.json не найден в backend!
    echo.
    echo Решение:
    echo 1. Проверьте целостность проекта
    echo 2. Убедитесь, что все файлы скопированы
    pause
    exit /b 1
)

:: Устанавливаем зависимости если нужно
if not exist "node_modules" (
    echo 🔄 Установка зависимостей backend...
    echo Это может занять несколько минут...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки зависимостей backend!
        echo.
        echo Возможные причины:
        echo 1. Нет подключения к интернету
        echo 2. Проблемы с npm registry
        echo 3. Конфликты версий пакетов
        echo.
        echo Попробуйте:
        echo npm cache clean --force
        echo npm install
        pause
        exit /b 1
    )
    echo ✅ Зависимости backend установлены
) else (
    echo ✅ Зависимости backend найдены
)

:: Создаем .env файл с улучшенной конфигурацией
echo 🔧 Создание конфигурации backend...
(
    echo # Backend Configuration
    echo PORT=5001
    echo HOST=localhost
    echo NODE_ENV=development
    echo.
    echo # CORS Settings - ВАЖНО для синхронизации!
    echo CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,http://localhost:3000
    echo.
    echo # Security
    echo JWT_SECRET=local-dev-secret-2024-change-in-production
    echo JWT_EXPIRES_IN=24h
    echo BCRYPT_ROUNDS=10
    echo.
    echo # Database
    echo DB_PATH=./database.sqlite
    echo.
    echo # Logging
    echo LOG_LEVEL=debug
    echo LOG_FILE=./logs/app.log
    echo.
    echo # Error Tracking
    echo ENABLE_ERROR_DETAILS=true
    echo ERROR_STACK_TRACES=true
) > .env

:: Создаем папку для логов
if not exist "logs" mkdir logs

echo ✅ Backend настроен

:: Запуск Backend с улучшенным выводом
echo [6/7] 🖥️ Запуск Backend на localhost:5001...
start "MMA Backend" cmd /k "title MMA Backend - localhost:5001 && color 0A && echo ========================================= && echo    MMA BACKEND SERVER && echo ========================================= && echo. && echo 📍 URL: http://localhost:5001 && echo 📍 API: http://localhost:5001/api && echo 📍 Health: http://localhost:5001/api/health && echo. && echo 📝 Логи сохраняются в backend/logs/ && echo ========================================= && echo. && node server.js || (echo. && echo ❌ ОШИБКА ЗАПУСКА СЕРВЕРА! && echo Проверьте логи выше && pause)"

:: Ждем запуска backend
echo ⏳ Ожидание запуска Backend...
timeout /t 5 /nobreak >nul

:: Проверяем backend с повторными попытками
echo 🔍 Проверка Backend...
set BACKEND_OK=0
for /l %%i in (1,1,3) do (
    if !BACKEND_OK! equ 0 (
        timeout /t 2 /nobreak >nul
        curl -s http://localhost:5001/api/health >nul 2>&1
        if !errorlevel! equ 0 (
            set BACKEND_OK=1
            echo ✅ Backend работает!
        ) else (
            echo ⏳ Попытка %%i/3...
        )
    )
)

if %BACKEND_OK% equ 0 (
    echo ⚠️ Backend еще запускается или есть ошибки
    echo Проверьте окно "MMA Backend" для деталей
)

:: ============================================
:: FRONTEND SETUP
:: ============================================
echo [7/7] 📦 Настройка Frontend...
cd ../frontend

:: Проверяем package.json
if not exist "package.json" (
    echo ❌ package.json не найден в frontend!
    pause
    exit /b 1
)

:: Устанавливаем зависимости если нужно
if not exist "node_modules" (
    echo 🔄 Установка зависимостей frontend...
    echo Это может занять несколько минут...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки зависимостей frontend!
        echo.
        echo Попробуйте:
        echo npm cache clean --force
        echo npm install
        pause
        exit /b 1
    )
    echo ✅ Зависимости frontend установлены
) else (
    echo ✅ Зависимости frontend найдены
)

:: Создаем .env файл для frontend с проверкой ошибок
echo 🔧 Создание конфигурации frontend...
(
    echo # Frontend Configuration
    echo REACT_APP_API_URL=http://localhost:5001/api
    echo.
    echo # Server Settings
    echo HOST=localhost
    echo PORT=3001
    echo HTTPS=false
    echo.
    echo # Browser Settings
    echo BROWSER=default
    echo BROWSER_ARGS=--new-window
    echo.
    echo # Development Settings
    echo ESLINT_NO_DEV_ERRORS=true
    echo SKIP_PREFLIGHT_CHECK=true
    echo FAST_REFRESH=true
    echo.
    echo # Error Handling
    echo REACT_APP_ENABLE_ERROR_BOUNDARY=true
    echo REACT_APP_LOG_ERRORS=true
    echo REACT_APP_ENV=development
) > .env

echo ✅ Frontend настроен

:: Запуск Frontend с улучшенным выводом
echo 🌐 Запуск Frontend на localhost:3001...
start "MMA Frontend" cmd /k "title MMA Frontend - localhost:3001 && color 0B && echo ========================================= && echo    MMA FRONTEND SERVER && echo ========================================= && echo. && echo 🌐 URL: http://localhost:3001 && echo 🔗 API: http://localhost:5001/api && echo. && echo ⏳ Компиляция может занять 30-60 секунд... && echo ========================================= && echo. && npm start || (echo. && echo ❌ ОШИБКА ЗАПУСКА FRONTEND! && echo Проверьте логи выше && pause)"

:: Возвращаемся в корень
cd "%ROOT_DIR%"

:: ============================================
:: ФИНАЛЬНАЯ ИНФОРМАЦИЯ
:: ============================================
echo.
echo ========================================
echo ✅ СЕРВЕРЫ ЗАПУСКАЮТСЯ!
echo ========================================
echo.
echo 📡 АДРЕСА СЕРВЕРОВ:
echo    🖥️  Backend:  http://localhost:5001
echo    🌐 Frontend: http://localhost:3001
echo    🏥 Health:   http://localhost:5001/api/health
echo.
echo ⏱️  ВРЕМЯ ЗАПУСКА:
echo    Backend:  ~5-10 секунд
echo    Frontend: ~30-60 секунд (компиляция React)
echo.
echo 📋 ДИАГНОСТИКА:
echo    1. Окна серверов открыты в отдельных терминалах
echo    2. Проверьте логи в окнах при ошибках
echo    3. Backend логи: backend/logs/
echo.
echo 🛑 ДЛЯ ОСТАНОВКИ:
echo    Закройте окна терминалов или запустите stop.bat
echo ========================================

:: Ждем полного запуска
timeout /t 10 /nobreak >nul

:: Финальная проверка
echo.
echo 🔍 ФИНАЛЬНАЯ ПРОВЕРКА...
echo.

:: Проверка Backend
curl -s http://localhost:5001/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend API: Работает
) else (
    echo ❌ Backend API: Не отвечает
    echo    Проверьте окно "MMA Backend"
)

:: Проверка Frontend (может еще компилироваться)
curl -s http://localhost:3001 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend: Работает
) else (
    echo ⏳ Frontend: Еще компилируется (подождите ~30 сек)
)

:: Проверка CORS
echo.
echo 🔐 Проверка CORS конфигурации...
findstr /C:"CORS_ORIGINS" backend\.env >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ CORS настроен для http://localhost:3001
) else (
    echo ⚠️  CORS может быть не настроен
)

echo.
echo ========================================
echo 🎉 ГОТОВО! 
echo.
echo 🚀 Откройте браузер: http://localhost:3001
echo.
echo Если страница не загружается:
echo 1. Подождите еще 20-30 секунд
echo 2. Обновите страницу (F5)
echo 3. Проверьте консоль браузера (F12)
echo ========================================
echo.
pause