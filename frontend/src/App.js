import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

import Dashboard from './components/Dashboard';
import LoginModal from './components/LoginModal';
import AdminPanel from './components/AdminPanel';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EquipmentProvider } from './contexts/EquipmentContext';

function AppContent() {
    const { user, loading } = useAuth();
    const [showLogin, setShowLogin] = useState(false);

    useEffect(() => {
        // Автоматически показываем логин если пользователь не авторизован
        if (!loading && !user) {
            setShowLogin(true);
        }
    }, [user, loading]);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Загрузка системы...</p>
            </div>
        );
    }

    return (
        <div className="App">
            <Routes>
                <Route
                    path="/"
                    element={
                        <Dashboard onLoginClick={() => setShowLogin(true)} />
                    }
                />
                <Route
                    path="/admin"
                    element={
                        user && (user.role === 'admin' || user.role === 'dispatcher')
                            ? <AdminPanel />
                            : <Navigate to="/" replace />
                    }
                />
                <Route
                    path="/archive"
                    element={
                        user && (user.role === 'admin' || user.role === 'dispatcher')
                            ? <Archive />
                            : <Navigate to="/" replace />
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {showLogin && (
                <LoginModal
                    isOpen={showLogin}
                    onClose={() => setShowLogin(false)}
                    onSuccess={() => setShowLogin(false)}
                />
            )}

            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
                toastStyle={{
                    background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff'
                }}
            />
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <EquipmentProvider>
                <Router>
                    <AppContent />
                </Router>
            </EquipmentProvider>
        </AuthProvider>
    );
}

export default App;