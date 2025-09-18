#!/bin/bash

# Скрипт для запуска MMA Equipment Monitoring System
# на IP адресе 10.35.3.117

echo "🚀 Запуск MMA Equipment Monitoring System"
echo "📍 IP адрес: 10.35.3.117"
echo "🌐 Backend: http://10.35.3.117:5001"
echo "💻 Frontend: http://10.35.3.117:3001"
echo ""

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js версии 14 или выше."
    exit 1
fi

# Проверяем версию Node.js
NODE_VERSION=$(node --version)
echo "✅ Node.js версия: $NODE_VERSION"

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm версия: $NPM_VERSION"
echo ""

# Функция для проверки порта
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Порт $1 уже используется"
        echo "Завершить процесс на порту $1? (y/n)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            kill -9 $(lsof -Pi :$1 -sTCP:LISTEN -t)
            echo "✅ Процесс на порту $1 завершен"
        else
            echo "❌ Отмена запуска"
            exit 1
        fi
    fi
}

# Проверяем порты
echo "🔍 Проверка портов..."
check_port 5001
check_port 3001

# Создаем логи директорию
mkdir -p logs

echo ""
echo "📦 Установка зависимостей..."

# Устанавливаем зависимости backend
echo "📦 Backend зависимости..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "✅ Backend зависимости уже установлены"
fi

# Проверяем .env файл
if [ ! -f ".env" ]; then
    echo "⚠️  Создание .env файла для backend..."
    cat > .env << EOF
NODE_ENV=production
PORT=5001
HOST=0.0.0.0
JWT_SECRET=your-super-secret-key-change-in-production-2024
FRONTEND_URL=http://10.35.3.117:3001
DB_PATH=./database.sqlite
API_RATE_LIMIT=100
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://10.35.3.117:3000,http://10.35.3.117:3001
LOG_LEVEL=info
EOF
    echo "✅ .env файл создан"
fi

cd ..

# Устанавливаем зависимости frontend
echo "📦 Frontend зависимости..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "✅ Frontend зависимости уже установлены"
fi

# Проверяем .env файл
if [ ! -f ".env" ]; then
    echo "⚠️  Создание .env файла для frontend..."
    cat > .env << EOF
REACT_APP_API_URL=http://10.35.3.117:5001
REACT_APP_API_BASE_URL=http://10.35.3.117:5001/api
PORT=3001
HOST=0.0.0.0
REACT_APP_NAME=MMA Актогай - Мониторинг техники
REACT_APP_VERSION=1.0.0
REACT_APP_ENABLE_MOCK=false
REACT_APP_DEBUG=false
GENERATE_SOURCEMAP=false
BROWSER=none
EOF
    echo "✅ .env файл создан"
fi

cd ..

echo ""
echo "🚀 Запуск приложения..."

# Запускаем backend в фоне
echo "🔧 Запуск Backend сервера на http://10.35.3.117:5001..."
cd backend
npm run prod:network > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend запущен (PID: $BACKEND_PID)"

# Ждем 3 секунды для запуска backend
sleep 3

# Проверяем, что backend запустился
if ! ps -p $BACKEND_PID > /dev/null; then
    echo "❌ Ошибка запуска Backend сервера"
    echo "Лог ошибок:"
    tail -20 logs/backend.log
    exit 1
fi

cd ..

# Запускаем frontend в фоне
echo "💻 Запуск Frontend сервера на http://10.35.3.117:3001..."
cd frontend
npm run start:network > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend запущен (PID: $FRONTEND_PID)"

cd ..

# Создаем PID файл для последующего управления
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid

echo ""
echo "🎉 Приложение успешно запущено!"
echo ""
echo "📊 Доступные адреса:"
echo "   🌐 Главная страница: http://10.35.3.117:3001"
echo "   🔧 API сервер: http://10.35.3.117:5001"
echo "   ❤️  Health Check: http://10.35.3.117:5001/api/health"
echo ""
echo "👥 Тестовые пользователи:"
echo "   👑 Администратор: admin / admin123"
echo "   📋 Диспетчер: dispatcher / user123"
echo ""
echo "📝 Логи:"
echo "   Backend: tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo "🛑 Для остановки запустите: ./stop.sh"
echo ""

# Проверяем доступность API
echo "🔍 Проверка API..."
sleep 5
if curl -s http://10.35.3.117:5001/api/health > /dev/null; then
    echo "✅ API работает корректно"
else
    echo "⚠️  API может быть недоступен, проверьте логи"
fi

echo ""
echo "✨ Готово! Откройте браузер и перейдите по адресу:"
echo "   http://10.35.3.117:3001"