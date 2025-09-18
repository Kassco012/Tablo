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
                <p>Загрузка...</p>
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