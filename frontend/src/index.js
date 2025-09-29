import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// ==========================================
// ЗАЩИТА ОТ МАСШТАБИРОВАНИЯ
// ==========================================

console.log('%c🔒 ЗАЩИТА ТАБЛО АКТИВНА', 'color: #4facfe; font-size: 16px; font-weight: bold;');

// 1. Блокировка Ctrl/Cmd + колесико мыши
document.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        console.warn('🚫 Масштабирование колесиком заблокировано');
        return false;
    }
}, { passive: false });

// 2. Блокировка горячих клавиш масштабирования
document.addEventListener('keydown', function (e) {
    // Ctrl/Cmd + (+, -, 0, =)
    if ((e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0' ||
            e.key === 'Add' || e.key === 'Subtract')) {
        e.preventDefault();
        e.stopPropagation();
        console.warn('🚫 Масштабирование клавишами заблокировано');
        return false;
    }
}, false);

// 3. Блокировка контекстного меню (правая кнопка)
document.addEventListener('contextmenu', function (e) {
    // Разрешаем только для input/textarea
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        return false;
    }
});

// 4. Блокировка жестов на touch-экранах
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
}, false);

document.addEventListener('gesturechange', function (e) {
    e.preventDefault();
}, false);

document.addEventListener('gestureend', function (e) {
    e.preventDefault();
}, false);

// 5. Автоматический сброс zoom
let lastZoom = 1;
function resetZoom() {
    const currentZoom = window.devicePixelRatio || 1;

    if (Math.abs(currentZoom - lastZoom) > 0.01) {
        console.warn('⚠️ Обнаружена попытка масштабирования!');
        document.body.style.zoom = '1';
        document.documentElement.style.zoom = '1';
        lastZoom = currentZoom;
    }
}

// Проверяем каждые 500мс
setInterval(resetZoom, 500);

// 6. Блокировка перетаскивания изображений
document.addEventListener('dragstart', function (e) {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
    }
});

// 7. Информация о запуске
console.log(`
📊 Размер окна: ${window.innerWidth}×${window.innerHeight}
🔍 Масштаб: ${Math.round((window.devicePixelRatio || 1) * 100)}%

✅ Заблокировано:
   • Ctrl + колесико мыши
   • Ctrl + Plus/Minus
   • Правая кнопка мыши (кроме полей ввода)
   • Touch жесты масштабирования
   • Перетаскивание изображений
`);

// ==========================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================

// Создаем корневой элемент для React 18
const root = ReactDOM.createRoot(document.getElementById('root'));

// Рендерим приложение
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Если вы хотите измерить производительность в приложении, передайте функцию
// для логирования результатов (например: reportWebVitals(console.log))
// или отправьте на аналитический эндпоинт. Узнать больше: https://bit.ly/CRA-vitals
// reportWebVitals();