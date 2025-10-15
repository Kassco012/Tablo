import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

console.log('%c🌐 API Configuration', 'color: #4CAF50; font-size: 14px; font-weight: bold;');
console.log('API URL:', API_URL);
console.log('Environment:', process.env.NODE_ENV);

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
        const token = localStorage.getItem('token');

        console.log('%c📤 API REQUEST', 'color: #2196F3; font-weight: bold;');
        console.log('Method:', config.method?.toUpperCase());
        console.log('URL:', `${config.baseURL}${config.url}`);
        console.log('Data:', config.data);

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('✅ Token added');
        } else {
            console.log('ℹ️ No token available');
        }

        return config;
    },
    (error) => {
        console.error('%c❌ REQUEST ERROR', 'color: #f44336; font-weight: bold;', error);
        return Promise.reject(error);
    }
);

// Интерцептор для обработки ответов
api.interceptors.response.use(
    (response) => {
        console.log('%c📥 API RESPONSE', 'color: #4CAF50; font-weight: bold;');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
        return response;
    },
    (error) => {
        console.log('%c❌ API ERROR', 'color: #f44336; font-weight: bold;');

        if (error.response) {
            const { status, data } = error.response;
            console.log('Status Code:', status);
            console.log('Error Data:', data);

            switch (status) {
                case 400:
                    console.log('❌ Bad Request');
                    break;
                case 401:
                    console.log('❌ Unauthorized');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    if (!window.location.pathname.includes('/login')) {
                        window.location.href = '/login';
                    }
                    break;
                case 403:
                    console.log('❌ Forbidden');
                    break;
                case 404:
                    console.log('❌ Not Found');
                    break;
                case 500:
                    console.log('❌ Server Error');
                    break;
                default:
                    console.log('❌ Unknown error');
            }
        } else if (error.request) {
            console.log('❌ No response from server');
            console.log('Possible reasons: Backend not running, CORS issue, Network error');
        } else {
            console.log('❌ Error setting up request:', error.message);
        }

        return Promise.reject(error);
    }
);

// API методы
const apiService = {
    // Health check
    checkHealth: async () => {
        try {
            const response = await api.get('/health');
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Выход
    logout: () => {
        console.log('%c👋 LOGOUT', 'color: #FF9800; font-weight: bold;');
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

    // Универсальные методы
    get: async (url, params = {}) => {
        try {
            const response = await api.get(url, { params });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    post: async (url, data = {}) => {
        try {
            const response = await api.post(url, data);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    put: async (url, data = {}) => {
        try {
            const response = await api.put(url, data);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    delete: async (url) => {
        try {
            const response = await api.delete(url);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

export { api };
export default apiService;