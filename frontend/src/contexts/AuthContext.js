// frontend/src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import apiService, { api } from '../services/api';

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

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        console.log('🔐 Checking authentication...');

        try {
            const token = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');

            if (token && savedUser) {
                const userData = JSON.parse(savedUser);
                setUser(userData);
                console.log('✅ User restored:', userData);
            } else {
                console.log('ℹ️ No saved authentication');
                setUser(null);
            }
        } catch (err) {
            console.error('❌ Auth check error:', err);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {  // Изменил email -> username
        console.log('Login attempt for:', username);
        setLoading(true);
        setError(null);

        try {
            const response = await api.post('/auth/login', { username, password });

            console.log('✅ Login response:', response.data);

            // Сохраняем токен и пользователя
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                setUser(response.data.user);
                setError(null);
                console.log('✅ Token saved successfully'); // ✅ ИСПРАВЛЕНО: не логируем сам токен
                return { success: true };
            } else {
                throw new Error('Токен не получен от сервера');
            }
        } catch (err) {
            console.error('❌ Login error:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Ошибка входа';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        console.log('👋 Logout');
        setUser(null);
        setError(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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