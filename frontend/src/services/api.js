import axios from 'axios';

// Базовая конфигурация API
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
    timeout: 10000,
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
            console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
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
            console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
        }

        return response;
    },
    (error) => {
        console.error('❌ Response Error:', error);

        // Обработка различных типов ошибок
        if (error.response) {
            // Сервер ответил с кодом ошибки
            const { status, data } = error.response;

            switch (status) {
                case 401:
                    // Неавторизованный доступ - удаляем токен и перенаправляем
                    localStorage.removeItem('authToken');
                    if (window.location.pathname !== '/') {
                        window.location.href = '/';
                    }
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
                message: 'Сервер недоступен. Проверьте подключение к интернету.'
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

// Функция для загрузки файлов
export const uploadFile = (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
                const percentCompleted = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                );
                onProgress(percentCompleted);
            }
        },
    });
};

// Функция для скачивания файлов
export const downloadFile = (url, filename) => {
    return api.get(url, {
        responseType: 'blob',
    }).then((response) => {
        const blob = new Blob([response.data]);
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(link.href);
    });
};

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