// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Импортируем существующие компоненты с правильными именами файлов
import Dashboard from './components/Dashboard'; // Dashboard.js существует
import Archive from './components/archive';     // archive.js (с маленькой буквы!)
import Login from './components/LoginModal';    // LoginModal.js (не Login!)

// Компоненты для обработки ошибок - нужно создать или использовать существующие
// import ErrorNotification from './components/ErrorNotification'; // ErrorNotification.css существует
import StatusCards from './components/StatusCards'; // StatusCards.js существует (можно использовать вместо ConnectionStatus)

// Если ProtectedRoute не существует, создадим простую версию ниже
import './App.css';

// Простой компонент ProtectedRoute (создайте файл components/ProtectedRoute.js)
const ProtectedRoute = ({ children, requiredRoles }) => {
    // Временная заглушка - замените на полную версию с проверкой авторизации
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!user || !user.token) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRoles && !requiredRoles.includes(user.role)) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh'
            }}>
                <h2>Доступ запрещен</h2>
                <p>У вас недостаточно прав для просмотра этой страницы</p>
                <button onClick={() => window.history.back()}>Назад</button>
            </div>
        );
    }

    return children;
};

// Временный компонент ErrorNotification (если ErrorNotification.js не существует)
const ErrorNotificationComponent = () => {
    // Используем существующие стили из ErrorNotification.css
    return null; // Временно пустой
};

// Временный компонент ConnectionStatus на основе StatusCards
const ConnectionStatus = () => {
    return null; // Или можно использовать <StatusCards />
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="App">
                    {/* Глобальные компоненты */}
                    <ErrorNotificationComponent />
                    <ConnectionStatus />

                    <Routes>
                        {/* Страница входа - используем LoginModal */}
                        <Route path="/login" element={<Login />} />

                        {/* Dashboard - только для admin и dispatcher */}
                        <Route path="/dashboard" element={
                            <ProtectedRoute requiredRoles={['admin', 'dispatcher']}>
                                <Dashboard />
                            </ProtectedRoute>
                        } />

                        {/* Archive - для admin, dispatcher и viewer */}
                        <Route path="/archive" element={
                            <ProtectedRoute requiredRoles={['admin', 'dispatcher', 'viewer']}>
                                <Archive />
                            </ProtectedRoute>
                        } />

                        {/* Главная страница - редирект на dashboard */}
                        <Route path="/" element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        } />

                        {/* Обработка несуществующих роутов */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;