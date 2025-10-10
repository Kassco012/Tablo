// frontend/src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import apiService from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Проверка сохраненной авторизации при загрузке
    useEffect(() => {
        checkAuth();
    }, []);

    // frontend/src/contexts/AuthContext.js

    const checkAuth = async () => {
        console.log('🔐 Checking authentication...');

        try {
            const token = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');

            console.log('📦 Saved data:', {
                hasToken: !!token,
                hasUser: !!savedUser,
                token: token ? `${token.substring(0, 20)}...` : 'none'
            });

            if (token && savedUser) {
                console.log('✅ Found saved token and user');

                // Проверяем валидность токена через /api/auth/verify
                try {
                    const response = await api.get('/auth/verify');

                    if (response.status === 200) {
                        const userData = JSON.parse(savedUser);
                        setUser(userData);
                        console.log('✅ User restored:', userData);
                    } else {
                        throw new Error('Token validation failed');
                    }
                } catch (verifyError) {
                    console.log('❌ Token invalid, clearing...', verifyError.message);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } else {
                console.log('ℹ️ No saved authentication found');
                setUser(null);
            }
        } catch (err) {
            console.error('❌ Auth check error:', err);
            setError('Ошибка проверки авторизации');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        console.log('Login attempt for:', email);
        setLoading(true);
        setError(null);

        try {
            const result = await apiService.login(email, password);

            if (result.success) {
                console.log('Login successful:', result.data);
                setUser(result.data.user);
                setError(null);
                return { success: true };
            } else {
                console.log('Login failed:', result.error);
                setError(result.error || 'Ошибка входа');
                return { success: false, error: result.error };
            }
        } catch (err) {
            console.error('Login error:', err);
            const errorMessage = err.response?.data?.message || 'Ошибка соединения с сервером';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        console.log('Logging out...');
        setUser(null);
        setError(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Не делаем редирект здесь, пусть компонент сам решает
    };

    const hasRole = (requiredRoles) => {
        if (!user) return false;
        if (!Array.isArray(requiredRoles)) {
            requiredRoles = [requiredRoles];
        }
        return requiredRoles.includes(user.role);
    };

    const isAuthenticated = () => {
        return !!user && !!localStorage.getItem('token');
    };

    const value = {
        user,
        loading,
        error,
        login,
        logout,
        checkAuth,
        hasRole,
        isAuthenticated: isAuthenticated(),
        setError
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};