// frontend/src/services/api.js
import axios from 'axios';

// Получаем URL из переменной окружения или используем дефолтный
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

console.log('API URL configured:', API_URL);

// Создаем экземпляр axios
const api = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Интерцептор для добавления токена к запросам
api.interceptors.request.use(
    (config) => {
        // Получаем токен из localStorage
        const token = localStorage.getItem('token');

        // Логирование для отладки
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('Token added to request');
        } else {
            console.log('No token available');
        }

        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Интерцептор для обработки ответов
api.interceptors.response.use(
    (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`, response.data);
        return response;
    },
    (error) => {
        console.error('Response error:', error);

        if (error.response) {
            const { status, data } = error.response;

            console.log(`Error ${status}:`, data);

            // Обработка различных статусов ошибок
            switch (status) {
                case 401:
                    console.log('Unauthorized - clearing token');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    // Редирект на login только если мы не на странице логина
                    if (!window.location.pathname.includes('/login')) {
                        window.location.href = '/login';
                    }
                    break;

                case 403:
                    console.log('Forbidden - insufficient permissions');
                    break;

                case 404:
                    console.log('Not found');
                    break;

                case 500:
                    console.log('Server error');
                    break;

                default:
                    console.log('Unknown error');
            }
        } else if (error.request) {
            console.error('No response from server:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }

        return Promise.reject(error);
    }
);

// Публичные endpoints (не требуют авторизации)
const publicEndpoints = ['/health', '/auth/login', '/auth/register'];

// API методы
const apiService = {
    // Health check - не требует авторизации
    checkHealth: async () => {
        try {
            const response = await api.get('/health');
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Авторизация
    login: async (email, password) => {
        try {
            console.log('Attempting login for:', email);
            const response = await api.post('/auth/login', { email, password });

            // Сохраняем токен и данные пользователя
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                console.log('Login successful, token saved');
            }

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Login failed:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Ошибка авторизации'
            };
        }
    },

    // Выход
    logout: () => {
        console.log('Logging out...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    },

    // Получение данных dashboard
    getDashboard: async () => {
        try {
            const response = await api.get('/dashboard');
            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Ошибка загрузки данных'
            };
        }
    },

    // Получение архива
    getArchive: async (params = {}) => {
        try {
            const response = await api.get('/archive', { params });
            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Ошибка загрузки архива'
            };
        }
    },

    // Универсальный метод для GET запросов
    get: async (url, params = {}) => {
        try {
            const response = await api.get(url, { params });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Универсальный метод для POST запросов
    post: async (url, data = {}) => {
        try {
            const response = await api.post(url, data);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Универсальный метод для PUT запросов
    put: async (url, data = {}) => {
        try {
            const response = await api.put(url, data);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Универсальный метод для DELETE запросов
    delete: async (url) => {
        try {
            const response = await api.delete(url);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Экспортируем и api instance и сервис
export { api };
export default apiService;