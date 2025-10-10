// ============================================
// 1. УЛУЧШЕННЫЙ ERROR MANAGER
// frontend/src/services/errorManager.js
// ============================================

class ErrorManager {
    constructor() {
        this.listeners = new Set();
    }

    // Подписка на ошибки
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // Уведомление всех слушателей
    notify(error) {
        this.listeners.forEach(callback => callback(error));
    }

    // Обработка различных типов ошибок
    handleError(error, context = '') {
        const errorInfo = this.parseError(error, context);

        // Логирование в консоль для разработки
        if (process.env.NODE_ENV === 'development') {
            console.error(`[${context}]`, errorInfo);
        }

        // Уведомление UI компонентов
        this.notify(errorInfo);

        return errorInfo;
    }

    // Парсинг ошибки в удобный формат
    parseError(error, context) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            context,
            code: error.code || error.response?.status || 'UNKNOWN',
            message: '',
            userMessage: '',
            action: null,
            severity: 'error', // 'info', 'warning', 'error', 'critical'
            details: {}
        };

        // Обработка различных типов ошибок
        if (error.response) {
            // Ошибки от сервера
            const status = error.response.status;
            const data = error.response.data;

            errorInfo.code = status;
            errorInfo.message = data?.message || error.message;
            errorInfo.details = data?.details || {};

            switch (status) {
                case 401:
                    errorInfo.userMessage = 'Сессия истекла. Необходимо войти заново.';
                    errorInfo.action = 'REDIRECT_TO_LOGIN';
                    errorInfo.severity = 'warning';
                    break;
                case 403:
                    errorInfo.userMessage = `Доступ запрещен. ${data?.reason || 'У вас недостаточно прав для выполнения этого действия.'}`;
                    errorInfo.severity = 'warning';
                    break;
                case 404:
                    errorInfo.userMessage = 'Запрашиваемые данные не найдены.';
                    errorInfo.severity = 'warning';
                    break;
                case 422:
                    errorInfo.userMessage = 'Неверные данные. Проверьте введенную информацию.';
                    errorInfo.details = data?.errors || {};
                    break;
                case 500:
                case 502:
                case 503:
                    errorInfo.userMessage = 'Ошибка сервера. Попробуйте позже или обратитесь к администратору.';
                    errorInfo.severity = 'critical';
                    errorInfo.action = 'RETRY';
                    break;
                default:
                    errorInfo.userMessage = `Произошла ошибка: ${data?.message || 'Неизвестная ошибка'}`;
            }
        } else if (error.request) {
            // Запрос был отправлен, но ответ не получен
            errorInfo.code = 'NETWORK_ERROR';
            errorInfo.message = 'Нет ответа от сервера';
            errorInfo.userMessage = 'Не удалось связаться с сервером. Проверьте подключение к интернету.';
            errorInfo.severity = 'critical';
            errorInfo.action = 'RETRY';
        } else if (error.code === 'ECONNABORTED') {
            // Таймаут запроса
            errorInfo.code = 'TIMEOUT';
            errorInfo.message = 'Превышено время ожидания';
            errorInfo.userMessage = 'Сервер не отвечает. Попробуйте позже.';
            errorInfo.action = 'RETRY';
        } else {
            // Другие ошибки
            errorInfo.message = error.message || 'Неизвестная ошибка';
            errorInfo.userMessage = 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.';
        }

        return errorInfo;
    }

    // Проверка CORS ошибок
    isCORSError(error) {
        return error.message?.toLowerCase().includes('cors') ||
            error.message?.toLowerCase().includes('cross-origin');
    }

    // Получение рекомендаций для пользователя
    getRecommendation(errorCode) {
        const recommendations = {
            401: 'Войдите в систему заново',
            403: 'Обратитесь к администратору для получения доступа',
            404: 'Проверьте правильность запроса',
            NETWORK_ERROR: 'Проверьте подключение к интернету',
            TIMEOUT: 'Попробуйте позже или обновите страницу'
        };

        return recommendations[errorCode] || 'Попробуйте обновить страницу';
    }
}

export default new ErrorManager();

// ============================================
// 2. УЛУЧШЕННЫЙ API SERVICE
// frontend/src/services/api.js
// ============================================

import axios from 'axios';
import errorManager from './errorManager';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Создание экземпляра axios с настройками
const api = axios.create({
    baseURL: API_URL,
    timeout: 15000, // 15 секунд таймаут
    headers: {
        'Content-Type': 'application/json',
    },
});

// Интерцептор для добавления токена
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Логирование запросов в dev режиме
        if (process.env.NODE_ENV === 'development') {
            console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Интерцептор для обработки ответов
api.interceptors.response.use(
    (response) => {
        // Логирование успешных ответов в dev режиме
        if (process.env.NODE_ENV === 'development') {
            console.log(`[API Response] ${response.status} ${response.config.url}`);
        }
        return response;
    },
    (error) => {
        // Обработка ошибки через ErrorManager
        const errorInfo = errorManager.handleError(error, 'API');

        // Специальная обработка для 401
        if (errorInfo.code === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Перенаправление на страницу входа
            if (window.location.pathname !== '/login') {
                window.location.href = '/login?expired=true';
            }
        }

        return Promise.reject(errorInfo);
    }
);

// API методы с улучшенной обработкой ошибок
const apiService = {
    // Проверка доступности сервера
    async checkHealth() {
        try {
            const response = await api.get('/health');
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error };
        }
    },

    // Авторизация
    async login(email, password) {
        try {
            const response = await api.post('/auth/login', { email, password });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error };
        }
    },

    // Получение данных с retry логикой
    async fetchWithRetry(url, maxRetries = 3, delay = 1000) {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await api.get(url);
                return { success: true, data: response.data };
            } catch (error) {
                lastError = error;

                // Не повторять при ошибках авторизации
                if (error.code === 401 || error.code === 403) {
                    break;
                }

                // Задержка перед повторной попыткой
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                }
            }
        }

        return { success: false, error: lastError };
    },

    // Методы для работы с данными
    async getDashboardData() {
        return this.fetchWithRetry('/dashboard');
    },

    async getArchiveData(params) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetchWithRetry(`/archive?${queryString}`);
    },
};

export default apiService;

// ============================================
// 3. NOTIFICATION COMPONENT
// frontend/src/components/ErrorNotification.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import errorManager from '../services/errorManager';
import './ErrorNotification.css';

const ErrorNotification = () => {
    const [errors, setErrors] = useState([]);

    useEffect(() => {
        // Подписка на ошибки
        const unsubscribe = errorManager.subscribe((error) => {
            const id = Date.now();
            const newError = { ...error, id };

            setErrors(prev => [...prev, newError]);

            // Автоматическое удаление через 10 секунд
            setTimeout(() => {
                setErrors(prev => prev.filter(e => e.id !== id));
            }, 10000);
        });

        return unsubscribe;
    }, []);

    const handleDismiss = (id) => {
        setErrors(prev => prev.filter(e => e.id !== id));
    };

    const handleAction = (error) => {
        switch (error.action) {
            case 'REDIRECT_TO_LOGIN':
                window.location.href = '/login';
                break;
            case 'RETRY':
                window.location.reload();
                break;
            default:
                break;
        }
        handleDismiss(error.id);
    };

    if (errors.length === 0) return null;

    return (
        <div className="error-notification-container">
            {errors.map(error => (
                <div
                    key={error.id}
                    className={`error-notification error-notification--${error.severity}`}
                >
                    <div className="error-notification__content">
                        <div className="error-notification__icon">
                            {error.severity === 'critical' && '🔴'}
                            {error.severity === 'error' && '❌'}
                            {error.severity === 'warning' && '⚠️'}
                            {error.severity === 'info' && 'ℹ️'}
                        </div>
                        <div className="error-notification__text">
                            <div className="error-notification__message">
                                {error.userMessage}
                            </div>
                            {error.code && (
                                <div className="error-notification__code">
                                    Код: {error.code}
                                </div>
                            )}
                            {error.action && (
                                <button
                                    className="error-notification__action"
                                    onClick={() => handleAction(error)}
                                >
                                    {error.action === 'RETRY' ? 'Повторить' : 'Войти'}
                                </button>
                            )}
                        </div>
                        <button
                            className="error-notification__close"
                            onClick={() => handleDismiss(error.id)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ErrorNotification;

// ============================================
// 4. УЛУЧШЕННЫЙ AUTH CONTEXT
// frontend/src/contexts/AuthContext.jsx
// ============================================

import React, { createContext, useState, useContext, useEffect } from 'react';
import apiService from '../services/api';
import errorManager from '../services/errorManager';

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
    const [authError, setAuthError] = useState(null);

    // Проверка токена при загрузке
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            try {
                // Проверка валидности токена
                const result = await apiService.checkHealth();
                if (result.success) {
                    setUser(JSON.parse(savedUser));
                } else {
                    handleAuthError('Сессия истекла');
                }
            } catch (error) {
                handleAuthError('Ошибка проверки авторизации');
            }
        }

        setLoading(false);
    };

    const handleAuthError = (message) => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setAuthError(message);

        errorManager.handleError(
            { message, code: 401 },
            'Authentication'
        );
    };

    const login = async (email, password) => {
        setLoading(true);
        setAuthError(null);

        const result = await apiService.login(email, password);

        if (result.success) {
            const { token, user } = result.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);
            setLoading(false);
            return { success: true };
        } else {
            setAuthError(result.error.userMessage);
            setLoading(false);
            return { success: false, error: result.error };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setAuthError(null);
    };

    const hasRole = (requiredRoles) => {
        if (!user) return false;
        if (!Array.isArray(requiredRoles)) {
            requiredRoles = [requiredRoles];
        }
        return requiredRoles.includes(user.role);
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            authError,
            login,
            logout,
            checkAuth,
            hasRole,
            isAuthenticated: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// ============================================
// 5. PROTECTED ROUTE COMPONENT
// frontend/src/components/ProtectedRoute.jsx
// ============================================

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRoles, fallback }) => {
    const { user, loading, hasRole } = useAuth();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Проверка авторизации...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ message: 'Необходима авторизация' }} />;
    }

    if (requiredRoles && !hasRole(requiredRoles)) {
        return fallback || (
            <div className="access-denied">
                <h2>Доступ запрещен</h2>
                <p>У вас недостаточно прав для просмотра этой страницы.</p>
                <p>Ваша роль: <strong>{user.role}</strong></p>
                <p>Требуемые роли: <strong>{requiredRoles.join(', ')}</strong></p>
                <button onClick={() => window.history.back()}>Вернуться</button>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;

// ============================================
// 6. CONNECTION STATUS COMPONENT
// frontend/src/components/ConnectionStatus.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import './ConnectionStatus.css';

const ConnectionStatus = () => {
    const [status, setStatus] = useState('checking');
    const [lastCheck, setLastCheck] = useState(null);

    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 30000); // Каждые 30 секунд
        return () => clearInterval(interval);
    }, []);

    const checkConnection = async () => {
        const result = await apiService.checkHealth();
        setStatus(result.success ? 'online' : 'offline');
        setLastCheck(new Date());
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'online':
                return '🟢';
            case 'offline':
                return '🔴';
            case 'checking':
                return '🟡';
            default:
                return '⚪';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'online':
                return 'Подключено';
            case 'offline':
                return 'Нет связи с сервером';
            case 'checking':
                return 'Проверка...';
            default:
                return 'Неизвестно';
        }
    };

    return (
        <div className={`connection-status connection-status--${status}`}>
            <span className="connection-status__icon">{getStatusIcon()}</span>
            <span className="connection-status__text">{getStatusText()}</span>
            {status === 'offline' && (
                <button
                    className="connection-status__retry"
                    onClick={checkConnection}
                >
                    Повторить
                </button>
            )}
        </div>
    );
};