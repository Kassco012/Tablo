const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const archiveRoutes= require('./routes/archive');
const { initializeDatabase } = require('./config/database');
const { startSyncJob } = require('./jobs/mssqlSyncJob'); 

const app = express();
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

// CORS настройка с поддержкой множественных origins
const corsOptions = {
    origin: function (origin, callback) {
        // Разрешаем запросы без origin (например, из мобильных приложений)
        if (!origin) return callback(null, true);

        // Список разрешенных origins
        const allowedOrigins = process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',').map(url => url.trim())
            : [
                'http://localhost:3001',
                'http://127.0.0.1:3001',
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://10.35.3.117:3001',
                'http://10.35.3.117:3000',
                'http://10.35.3.117:5001'
            ];

        console.log(`🌐 CORS проверка для origin: ${origin}`);

        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS заблокирован для origin: ${origin}`);
            // В разработке разрешаем все
            callback(null, process.env.NODE_ENV === 'development');
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
};



async function startServer() {
    try {
        await initializeDatabase();
        console.log('✅ База данных инициализирована');

        // ДОБАВИТЬ ЭТИ СТРОКИ:
        // Запуск фоновой синхронизации с MSSQL
        console.log('🔄 Запуск синхронизации с MSSQL...');
        startSyncJob();

        app.listen(PORT, HOST, () => {
            // ... существующий код вывода ...
        });
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

// Middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'",
                "http://10.35.3.117:5001",
                "http://localhost:5001",
                "http://127.0.0.1:5001"
            ]
        }
    }
}));

app.use(cors(corsOptions));

// Rate limiting - более мягкие ограничения для разработки
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 100,
    message: {
        error: 'Слишком много запросов, попробуйте позже'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter); // Применяем только к API маршрутам

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов в dev режиме
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'}`);
        next();
    });
}

// Статические файлы для продакшена (если frontend собран в backend/public)
if (process.env.NODE_ENV === 'production') {
    const path = require('path');

    // Проверяем, существует ли папка с фронтендом
    const publicPath = path.join(__dirname, 'public');
    if (require('fs').existsSync(publicPath)) {
        app.use(express.static(publicPath));

        // Все неизвестные маршруты направляем на index.html (для React Router)
        app.get('*', (req, res, next) => {
            // Пропускаем API маршруты
            if (req.path.startsWith('/api/')) {
                return next();
            }

            res.sendFile(path.join(publicPath, 'index.html'));
        });
    }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/archive', archiveRoutes);

// Health check с подробной информацией
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        host: HOST,
        port: PORT,
        cors_origins: process.env.CORS_ORIGINS?.split(',') || ['default'],
        database: 'SQLite (Connected)',
        features: {
            equipment_management: true,
            archive_system: true,
            user_authentication: true,
            real_time_updates: true
        },
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        }
    });
});

// Простая проверка соединения
app.get('/ping', (req, res) => {
    res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Статистика сервера
app.get('/api/server-stats', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        uptime_seconds: process.uptime(),
        uptime_human: formatUptime(process.uptime()),
        memory: process.memoryUsage(),
        platform: process.platform,
        node_version: process.version,
        pid: process.pid
    });
});

// API документация
app.get('/api/docs', (req, res) => {
    res.json({
        title: 'MMA Equipment Monitoring API',
        version: '1.0.0',
        description: 'API для системы мониторинга техники MMA Актогай',
        endpoints: {
            health: {
                'GET /api/health': 'Проверка состояния сервера',
                'GET /ping': 'Простая проверка соединения',
                'GET /api/server-stats': 'Статистика сервера'
            },
            authentication: {
                'POST /api/auth/login': 'Авторизация пользователя',
                'GET /api/auth/verify': 'Проверка токена',
                'POST /api/auth/logout': 'Выход из системы',
                'GET /api/auth/users': 'Список пользователей (admin only)'
            },
            equipment: {
                'GET /api/equipment': 'Список всего оборудования',
                'GET /api/equipment/:id': 'Информация об оборудовании',
                'GET /api/equipment/stats': 'Статистика оборудования',
                'PUT /api/equipment/:id': 'Обновление оборудования (auth)',
                'POST /api/equipment': 'Создание оборудования (admin)',
                'DELETE /api/equipment/:id': 'Удаление оборудования (admin)',
                'PUT /api/equipment/:id/change-id': 'Изменение ID оборудования (auth)',
                'GET /api/equipment/:id/history': 'История изменений (auth)'
            },
            archive: {
                'POST /api/archive/launch/:id': 'Запуск техники (архивирование) (auth)',
                'GET /api/archive': 'Список архивных записей (auth)',
                'GET /api/archive/stats': 'Статистика архива (auth)'
            }
        },
        authentication: {
            type: 'Bearer Token',
            header: 'Authorization: Bearer <token>',
            note: 'Токен получается при логине через /api/auth/login'
        }
    });
});

// Форматирование времени работы сервера
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}ч ${minutes}м ${secs}с`;
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Ошибка сервера:', err.stack);
    res.status(500).json({
        message: 'Что-то пошло не так!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Внутренняя ошибка сервера',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('/api/*', (req, res) => {
    console.warn(`❓ 404 API - Маршрут не найден: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'API маршрут не найден',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        available_endpoints: [
            '/api/health',
            '/api/docs',
            '/api/auth/*',
            '/api/equipment/*',
            '/api/archive/*'
        ]
    });
});

// Initialize database and start server
async function startServer() {
    try {
        await initializeDatabase();
        console.log('✅ База данных инициализирована');

        app.listen(PORT, HOST, () => {
            console.log('='.repeat(70));
            console.log(`🚀 Сервер MMA АКТОГАЙ запущен`);
            console.log(`🌐 Хост: ${HOST}`);
            console.log(`🔌 Порт: ${PORT}`);
            console.log(`🔗 Локальный доступ: http://localhost:${PORT}`);
            if (HOST !== 'localhost' && HOST !== '127.0.0.1') {
                console.log(`🔗 Сетевой доступ: http://${HOST}:${PORT}`);
            }
            console.log(`🏥 Health check: http://${HOST}:${PORT}/api/health`);
            console.log(`📚 API docs: http://${HOST}:${PORT}/api/docs`);
            console.log(`⚙️ Режим: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🌍 CORS Origins: ${process.env.CORS_ORIGINS || 'default'}`);
            console.log(`🗂️ Архивная система: включена`);
            console.log(`📊 База данных: SQLite`);
            console.log('='.repeat(70));
        });
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Получен сигнал SIGTERM, завершение работы...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Получен сигнал SIGINT, завершение работы...');
    process.exit(0);
});

startServer();

module.exports = app;