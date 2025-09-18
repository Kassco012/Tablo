@echo off
chcp 65001
cls
echo ========================================
echo   🛑 MMA АКТОГАЙ - Остановка системы
echo ========================================
echo.

echo 🔍 Поиск процессов Node.js...
tasklist /fi "imagename eq node.exe" | find /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo ✅ Найдены процессы Node.js
    echo 🛑 Остановка всех процессов Node.js...
    taskkill /f /im node.exe >nul 2>&1
    
    if %errorlevel% equ 0 (
        echo ✅ Процессы Node.js остановлены
    ) else (
        echo ❌ Ошибка остановки процессов
    )
) else (
    echo ℹ️ Процессы Node.js не найдены
)

echo.
echo 🔍 Очистка портов...

:: Освобождаем порты если заняты
for /f "tokens=5" %%a in ('netstat -an ^| find ":5001"') do (
    echo 🔧 Освобождение порта 5001...
)

for /f "tokens=5" %%a in ('netstat -an ^| find ":3001"') do (
    echo 🔧 Освобождение порта 3001...
)

:: Дополнительная очистка процессов React
tasklist /fi "imagename eq cmd.exe" | find /i "MMA" >nul
if %errorlevel% equ 0 (
    echo 🔄 Закрытие окон терминалов MMA...
    taskkill /f /fi "windowtitle eq MMA*" >nul 2>&1
)

echo.
echo 🧹 Очистка временных файлов...
if exist "C:\Tablo\backend\.env.backup" del "C:\Tablo\backend\.env.backup" >nul 2>&1
if exist "C:\Tablo\frontend\.env.backup" del "C:\Tablo\frontend\.env.backup" >nul 2>&1

echo.
echo ========================================
echo ✅ Система остановлена
echo ========================================
echo 💡 Порты 3001 и 5001 освобождены
echo 🔄 Можно запустить start.bat снова
echo ========================================
echo.
pause