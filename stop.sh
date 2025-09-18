#!/bin/bash

echo "🛑 Остановка MMA Equipment Monitoring System..."

# Функция для остановки процесса
stop_process() {
    local pid_file=$1
    local process_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo "🛑 Остановка $process_name (PID: $pid)..."
            kill $pid
            
            # Ждем 5 секунд для graceful shutdown
            sleep 5
            
            # Если процесс все еще работает, принудительно завершаем
            if ps -p $pid > /dev/null 2>&1; then
                echo "⚠️  Принудительная остановка $process_name..."
                kill -9 $pid
            fi
            
            echo "✅ $process_name остановлен"
        else
            echo "⚠️  $process_name уже не работает"
        fi
        rm -f "$pid_file"
    else
        echo "⚠️  PID файл для $process_name не найден"
    fi
}

# Останавливаем процессы
if [ -d "logs" ]; then
    stop_process "logs/frontend.pid" "Frontend"
    stop_process "logs/backend.pid" "Backend"
else
    echo "⚠️  Директория logs не найдена"
fi

# Дополнительная проверка и остановка процессов на портах
echo "🔍 Проверка процессов на портах..."

# Останавливаем процессы на портах 5001 и 3001
for port in 5001 3001; do
    pid=$(lsof -ti :$port)
    if [ ! -z "$pid" ]; then
        echo "🛑 Остановка процесса на порту $port (PID: $pid)..."
        kill -9 $pid
        echo "✅ Процесс на порту $port остановлен"
    else
        echo "✅ Порт $port свободен"
    fi
done

# Останавливаем все процессы node с нашими приложениями
echo "🔍 Поиск связанных Node.js процессов..."
pkill -f "node.*server.js"
pkill -f "react-scripts"

echo ""
echo "✅ Все процессы остановлены"
echo "📝 Логи сохранены в директории logs/"
echo ""
echo "🔄 Для повторного запуска используйте: ./start.sh"