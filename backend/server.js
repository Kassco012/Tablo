const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const archiveRoutes = require('./routes/archive');
const { initializeDatabase } = require('./config/database');
const { startSyncJob } = require('./jobs/mssqlSyncJob');

const app = express();
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

// CORS настройка
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

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

        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS заблокирован для origin: ${origin}`);
            callback(null, process.env.NODE_ENV === 'development');
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
};

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

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 1000 : 100,
    message: { error: 'Слишком много запросов, попробуйте позже' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование в dev режиме
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/archive', archiveRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        host: HOST,
        port: PORT,
        database: 'SQLite (Connected)',
        features: {
            equipment_management: true,
            archive_system: true,
            user_authentication: true,
            mssql_sync: true
        }
    });
});

// Простая проверка
app.get('/ping', (req, res) => {
    res.json({ message: 'pong', timestamp: new Date().toISOString() });
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
                'GET /ping': 'Простая проверка соединения'
            },
            authentication: {
                'POST /api/auth/login': 'Авторизация пользователя',
                'GET /api/auth/verify': 'Проверка токена',
                'GET /api/auth/users': 'Список пользователей (admin)'
            },
            equipment: {
                'GET /api/equipment': 'Список оборудования',
                'GET /api/equipment/sections': 'Список участков',
                'GET /api/equipment/stats': 'Статистика',
                'GET /api/equipment/:id': 'Информация об оборудовании',
                'PUT /api/equipment/:id': 'Обновление (auth)',
                'POST /api/equipment/sync': 'Синхронизация с MSSQL (auth)',
                'GET /api/equipment/sync/status': 'Статус синхронизации (auth)'
            },
            archive: {
                'POST /api/archive/launch/:id': 'Запуск техники (auth)',
                'GET /api/archive': 'Список архива (auth)',
                'GET /api/archive/stats': 'Статистика архива (auth)'
            }
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('💥 Ошибка сервера:', err.stack);
    res.status(500).json({
        message: 'Внутренняя ошибка сервера',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({
        message: 'API маршрут не найден',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Запуск сервера
async function startServer() {
    try {
        // 1. Инициализация базы данных
        console.log('🔄 Инициализация базы данных...');
        await initializeDatabase();
        console.log('✅ База данных инициализирована');

        // 2. Запуск синхронизации с MSSQL
        console.log('🔄 Запуск синхронизации с JMineOps...');
        startSyncJob();
        console.log('✅ Синхронизация запущена');

        // 3. Запуск HTTP сервера
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

// Запуск
startServer();

module.exports = app;