import axios from 'axios';

// Определяем базовый URL API
const getApiUrl = () => {
    // В продакшене используем текущий хост
    if (process.env.NODE_ENV === 'production') {
        return `${window.location.protocol}//${window.location.host}/api`;
    }

    // В разработке используем заданный URL или локальный
    return process.env.REACT_APP_API_URL || 'http://10.35.3.117:5001/api';
};

console.log('API Configuration:', {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    computed_url: getApiUrl()
});

// Базовая конфигурация API
const api = axios.create({
    baseURL: getApiUrl(),
    timeout: 15000, // Увеличиваем таймаут
    headers: {
        'Content-Type': 'application/json',
    },
});

// Интерсептор запросов - добавляем токен авторизации
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Логирование запросов в режиме разработки
        if (process.env.NODE_ENV === 'development') {
            console.log('API Request:', config.method?.toUpperCase(), config.url, config.data);
        }

        return config;
    },
    (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
    }
);

// Интерсептор ответов - обработка ошибок
api.interceptors.response.use(
    (response) => {
        // Логирование успешных ответов в режиме разработки
        if (process.env.NODE_ENV === 'development') {
            console.log('API Response:', response.status, response.config.url, response.data);
        }

        return response;
    },
    (error) => {
        console.error('API Error:', error);

        // Обработка различных типов ошибок
        if (error.response) {
            // Сервер ответил с кодом ошибки
            const { status, data } = error.response;

            switch (status) {
                case 401:
                    // Неавторизованный доступ - удаляем токен
                    localStorage.removeItem('authToken');
                    // Не перенаправляем автоматически, позволяем компоненту обработать
                    break;

                case 403:
                    console.warn('🚫 Доступ запрещен');
                    break;

                case 404:
                    console.warn('🔍 Ресурс не найден');
                    break;

                case 422:
                    console.warn('📝 Ошибка валидации данных');
                    break;

                case 500:
                    console.error('🔥 Внутренняя ошибка сервера');
                    break;

                default:
                    console.error(`🐛 HTTP Error ${status}:`, data?.message || 'Неизвестная ошибка');
            }

            // Возвращаем обработанную ошибку
            return Promise.reject({
                status,
                message: data?.message || `Ошибка HTTP ${status}`,
                data
            });
        } else if (error.request) {
            // Запрос был отправлен, но ответ не получен
            console.error('🌐 Сеть недоступна или сервер не отвечает');
            return Promise.reject({
                message: 'Сервер недоступен. Проверьте подключение к сети.',
                network: true
            });
        } else {
            // Что-то пошло не так при настройке запроса
            console.error('⚙️ Ошибка конфигурации запроса:', error.message);
            return Promise.reject({
                message: error.message || 'Произошла неожиданная ошибка'
            });
        }
    }
);

// Функция проверки здоровья API
export const checkApiHealth = async () => {
    try {
        const response = await api.get('/health');
        console.log('API Health Check успешен:', response.data);
        return true;
    } catch (error) {
        console.error('API Health Check неуспешен:', error);
        return false;
    }
};

// Вспомогательные функции для различных типов запросов
export const apiHelpers = {
    // Проверка здоровья API
    healthCheck: () => api.get('/health'),

    // Аутентификация
    auth: {
        login: (credentials) => api.post('/auth/login', credentials),
        register: (userData) => api.post('/auth/register', userData),
        verify: () => api.get('/auth/verify'),
        logout: () => api.post('/auth/logout'),
        getUsers: () => api.get('/auth/users'),
    },

    // Оборудование
    equipment: {
        getAll: () => api.get('/equipment'),
        getById: (id) => api.get(`/equipment/${id}`),
        getStats: () => api.get('/equipment/stats'),
        create: (data) => api.post('/equipment', data),
        update: (id, data) => api.put(`/equipment/${id}`, data),
        delete: (id) => api.delete(`/equipment/${id}`),
        getHistory: (id) => api.get(`/equipment/${id}/history`),
    },
};

// Функция для создания отмены запроса
export const createCancelToken = () => axios.CancelToken.source();

// Функция проверки отмены запроса
export const isCancel = (error) => axios.isCancel(error);

// Функция для повторных попыток запроса
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await requestFn();
        } catch (error) {
            lastError = error;

            // Не повторяем запрос для клиентских ошибок (4xx)
            if (error.status >= 400 && error.status < 500) {
                throw error;
            }

            // Ждем перед следующей попыткой
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }

    throw lastError;
};

export default api;