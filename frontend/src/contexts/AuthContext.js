import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { checkApiHealth } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth должен использоваться внутри AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [apiAvailable, setApiAvailable] = useState(false);

    useEffect(() => {
        initializeAuth();
    }, []);

    const initializeAuth = async () => {
        try {
            // Сначала проверяем доступность API
            const isApiHealthy = await checkApiHealth();
            setApiAvailable(isApiHealthy);

            if (isApiHealthy) {
                console.log('✅ API доступен');
                await checkAuth();
            } else {
                console.error('❌ API недоступен');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            setApiAvailable(false);
        } finally {
            setLoading(false);
        }
    };

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('🔐 Токен не найден');
                return;
            }

            console.log('🔐 Проверка токена...');
            const response = await api.get('/auth/verify');
            setUser(response.data.user);
            console.log('✅ Токен валиден, пользователь:', response.data.user);
        } catch (error) {
            console.error('❌ Токен недействителен:', error);
            localStorage.removeItem('authToken');
            setUser(null);
        }
    };

    const login = async (username, password) => {
        try {
            console.log('🔐 Попытка входа для пользователя:', username);

            const response = await api.post('/auth/login', {
                username,
                password
            });

            const { token, user: userData } = response.data;

            localStorage.setItem('authToken', token);
            setUser(userData);
            console.log('✅ Успешная авторизация через API:', userData);

            return userData;
        } catch (error) {
            console.error('❌ Ошибка авторизации:', error);

            // Обрабатываем различные типы ошибок
            if (error.network) {
                throw { message: 'Нет соединения с сервером' };
            } else if (error.status === 401) {
                throw { message: 'Неверные учетные данные' };
            } else {
                throw { message: error.message || 'Ошибка входа' };
            }
        }
    };

    const logout = () => {
        console.log('🔐 Выход из системы');
        localStorage.removeItem('authToken');
        setUser(null);
    };

    const register = async (userData) => {
        try {
            const response = await api.post('/auth/register', userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Ошибка регистрации' };
        }
    };

    const value = {
        user,
        loading,
        apiAvailable,
        login,
        logout,
        register,
        checkAuth,
        initializeAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};