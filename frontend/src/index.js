import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

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