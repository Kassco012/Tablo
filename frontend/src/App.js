import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { EquipmentProvider } from './contexts/EquipmentContext';

// Components
import Dashboard from './components/Dashboard';
import Archive from './components/archive';
import LoginModal from './components/LoginModal';
import AdminPanel from './components/AdminPanel';

// Styles
import './App.css';

// ProtectedRoute компонент
const ProtectedRoute = ({ children, requiredRoles }) => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user || !user.role) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRoles && !requiredRoles.includes(user.role)) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                color: 'white'
            }}>
                <h2>Доступ запрещен</h2>
                <p>У вас недостаточно прав для просмотра этой страницы</p>
                <button
                    onClick={() => window.history.back()}
                    style={{
                        marginTop: '20px',
                        padding: '10px 20px',
                        background: '#4facfe',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                >
                    Назад
                </button>
            </div>
        );
    }

    return children;
};

function App() {
    const [showLogin, setShowLogin] = useState(false);

    return (
        <AuthProvider>
            <EquipmentProvider>  {/* ✅ ОБЕРНУЛИ ВСЁ ПРИЛОЖЕНИЕ */}
                <Router>
                    <div className="App">
                        <Routes>
                            {/* Главная страница */}
                            <Route
                                path="/"
                                element={
                                    <Dashboard onLoginClick={() => setShowLogin(true)} />
                                }
                            />

                            {/* Страница входа */}
                            <Route
                                path="/login"
                                element={
                                    <LoginModal
                                        isOpen={true}
                                        onClose={() => window.history.back()}
                                        onSuccess={() => window.location.href = '/'}
                                    />
                                }
                            />

                            {/* Админ-панель */}
                            <Route
                                path="/admin"
                                element={
                                    <ProtectedRoute requiredRoles={['admin', 'dispatcher']}>
                                        <AdminPanel />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Архив */}
                            <Route
                                path="/archive"
                                element={
                                    <ProtectedRoute requiredRoles={['admin', 'dispatcher']}>
                                        <Archive />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Несуществующие маршруты */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>

                        {/* Toast уведомления */}
                        <ToastContainer
                            position="top-right"
                            autoClose={3000}
                            hideProgressBar={false}
                            newestOnTop
                            closeOnClick
                            rtl={false}
                            pauseOnFocusLoss
                            draggable
                            pauseOnHover
                            theme="dark"
                        />

                        {/* Модальное окно входа */}
                        {showLogin && (
                            <LoginModal
                                isOpen={showLogin}
                                onClose={() => setShowLogin(false)}
                                onSuccess={() => {
                                    setShowLogin(false);
                                    window.location.reload();
                                }}
                            />
                        )}
                    </div>
                </Router>
            </EquipmentProvider>  {/* ✅ ЗАКРЫЛИ ПРОВАЙДЕР */}
        </AuthProvider>
    );
}

export default App;