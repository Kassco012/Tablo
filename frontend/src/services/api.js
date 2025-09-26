import axios from 'axios';

// Определяем базовый URL API с правильной логикой для разных сред
const getApiUrl = () => {
    // Проверяем специальную переменную для принудительного localhost (для разработки)
    if (process.env.REACT_APP_FORCE_LOCAL === 'true') {
        return 'http://localhost:5001/api';
    }

    // В продакшене используем текущий хост
    if (process.env.NODE_ENV === 'production') {
        return `${window.location.protocol}//${window.location.host}/api`;
    }

    // В разработке используем заданный URL или localhost
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    // Автоматическое определение для локальной разработки
    const currentHost = window.location.hostname;
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        return 'http://localhost:5001/api';
    } else {
        // Для сетевого доступа (например 10.35.3.117)
        return `http://${currentHost}:5001/api`;
    }
};

console.log('API Configuration:', {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    REACT_APP_FORCE_LOCAL: process.env.REACT_APP_FORCE_LOCAL,
    window_hostname: window.location.hostname,
    computed_url: getApiUrl()
});

// Базовая конфигурация API
const api = axios.create({
    baseURL: getApiUrl(),
    timeout: 15000,
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
            console.log('🔄 API Request:', config.method?.toUpperCase(), config.url, config.data);
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
            console.log('✅ API Response:', response.status, response.config.url, response.data);
        }

        return response;
    },
    (error) => {
        console.error('❌ API Error:', error);

        // Обработка различных типов ошибок
        if (error.response) {
            // Сервер ответил с кодом ошибки
            const { status, data } = error.response;

            switch (status) {
                case 401:
                    // Неавторизованный доступ - удаляем токен
                    localStorage.removeItem('authToken');
                    console.warn('🔐 Токен недействителен, удален из localStorage');
                    break;

                case 403:
                    console.warn('🚫 Доступ запрещен');
                    break;

                case 404:
                    console.warn('🔍 Ресурс не найден');
                    break;

                case 409:
                    console.warn('⚠️ Конфликт данных (например, дублирующийся ID)');
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
        console.log('✅ API Health Check успешен:', response.data);
        return true;
    } catch (error) {
        console.error('❌ API Health Check неуспешен:', error);
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
        changeId: (oldId, newId) => api.put(`/equipment/${oldId}/change-id`, { newId }),
    },

    // Архив
    archive: {
        launch: (id, data) => api.post(`/archive/launch/${id}`, data),
        getAll: (params) => api.get('/archive', { params }),
        getStats: (params) => api.get('/archive/stats', { params }),
        restore: (id) => api.post(`/archive/restore/${id}`), // для будущего использования
    }
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

// Утилиты для валидации
export const validation = {
    isValidEquipmentId: (id) => {
        return /^[A-Z]{2}\d{3}$/.test(id); // Например: EX001, LD002
    },

    isValidTime: (time) => {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    },

    isValidProgress: (progress) => {
        const num = parseInt(progress);
        return !isNaN(num) && num >= 0 && num <= 100;
    }
};

// Утилиты для форматирования
export const formatters = {
    equipmentId: (id) => id?.toUpperCase(),

    time: (timeString) => {
        if (!timeString) return '';
        const parts = timeString.split(':');
        if (parts.length === 2) {
            const hours = parts[0].padStart(2, '0');
            const minutes = parts[1].padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return timeString;
    },

    status: (status) => {
        const statusMap = {
            'in_repair': 'В ремонте',
            'ready': 'Готово',
            'waiting': 'Ожидание',
            'scheduled': 'Запланировано'
        };
        return statusMap[status] || status;
    },

    priority: (priority) => {
        const priorityMap = {
            'low': 'Низкий',
            'normal': 'Обычный',
            'medium': 'Средний',
            'high': 'Высокий',
            'critical': 'Критический'
        };
        return priorityMap[priority] || priority;
    },

    equipmentType: (type) => {
        const typeMap = {
            'excavator': 'Экскаватор',
            'loader': 'Погрузчик'
        };
        return typeMap[type] || type;
    }
};

export default api;