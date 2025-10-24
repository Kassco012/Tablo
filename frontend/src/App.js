import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 20000,
            cacheTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
            retryDelay: 1000,
        },
        mutations: {
            retry: false,
        },
    },
});

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
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <EquipmentProvider>
                    <Router>
                        <div className="App">
                            <Routes>
                                <Route
                                    path="/"
                                    element={<Dashboard onLoginClick={() => setShowLogin(true)} />}
                                />

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

                                <Route
                                    path="/admin"
                                    element={
                                        <ProtectedRoute requiredRoles={['admin', 'dispatcher', 'programmer']}>
                                            <AdminPanel />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route
                                    path="/archive"
                                    element={
                                        <ProtectedRoute requiredRoles={['admin', 'dispatcher', 'programmer']}>
                                            <Archive />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>

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
                </EquipmentProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;