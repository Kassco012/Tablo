const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const { initializeDatabase } = require('./config/database');

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
                'http://10.35.3.117:3001',
                'http://10.35.3.117:5001'
            ];

        console.log(`🌐 CORS проверка для origin: ${origin}`);
        console.log(`🌐 Разрешенные origins:`, allowedOrigins);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS заблокирован для origin: ${origin}`);
            callback(null, true); // Временно разрешаем все для отладки
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
            connectSrc: ["'self'", "http://10.35.3.117:5001", "http://localhost:5001"]
        }
    }
}));

app.use(cors(corsOptions));

// Rate limiting - более мягкие ограничения для разработки
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 100, // больше запросов в dev режиме
    message: {
        error: 'Слишком много запросов, попробуйте позже'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов в dev режиме
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url}`);
        if (req.body && Object.keys(req.body).length > 0) {
            console.log(`📦 Body:`, req.body);
        }
        next();
    });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);

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
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        }
    });
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
app.use('*', (req, res) => {
    console.warn(`❓ 404 - Маршрут не найден: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Маршрут не найден',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Initialize database and start server
async function startServer() {
    try {
        await initializeDatabase();
        console.log('✅ База данных инициализирована');

        app.listen(PORT, HOST, () => {
            console.log('='.repeat(60));
            console.log(`🚀 Сервер MMA АКТОГАЙ запущен`);
            console.log(`🌐 Хост: ${HOST}`);
            console.log(`🔌 Порт: ${PORT}`);
            console.log(`🔗 Локальный доступ: http://localhost:${PORT}`);
            console.log(`🔗 Сетевой доступ: http://${HOST}:${PORT}`);
            console.log(`🏥 Health check: http://${HOST}:${PORT}/api/health`);
            console.log(`⚙️ Режим: ${process.env.NODE_ENV}`);
            console.log(`🌍 CORS Origins: ${process.env.CORS_ORIGINS || 'default'}`);
            console.log('='.repeat(60));
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