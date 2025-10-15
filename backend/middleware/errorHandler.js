// ============================================
// ERROR HANDLER MIDDLEWARE
// backend/middleware/errorHandler.js
// ============================================

const winston = require('winston');

// Настройка логгера
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        new winston.transports.File({
            filename: 'logs/combined.log'
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Класс для кастомных ошибок
class AppError extends Error {
    constructor(message, statusCode, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Middleware для обработки ошибок
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Логирование ошибки
    logger.error({
        message: error.message,
        statusCode: error.statusCode || 500,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        user: req.user?.id || 'anonymous',
        timestamp: new Date().toISOString()
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        error = new AppError('Неверный формат ID', 400);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        error = new AppError(
            `Значение поля ${field} уже существует`,
            400
        );
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        error = new AppError('Ошибка валидации', 422, { errors });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AppError('Недействительный токен', 401);
    }

    if (err.name === 'TokenExpiredError') {
        error = new AppError('Токен истек', 401, {
            expiredAt: err.expiredAt
        });
    }

    // Отправка ответа
    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Внутренняя ошибка сервера',
        details: error.details || {},
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// Middleware для несуществующих роутов
const notFound = (req, res, next) => {
    const error = new AppError(
        `Не найден маршрут ${req.originalUrl}`,
        404
    );
    next(error);
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    errorHandler,
    notFound,
    asyncHandler,
    logger
};

// ============================================
// IMPROVED AUTH MIDDLEWARE
// backend/middleware/auth.js
// ============================================

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

// Middleware для проверки токена
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            throw new AppError('Токен не предоставлен', 401, {
                reason: 'missing_token'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.token = token;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            next(new AppError('Недействительный токен', 401, {
                reason: 'invalid_token'
            }));
        } else if (error.name === 'TokenExpiredError') {
            next(new AppError('Токен истек', 401, {
                reason: 'token_expired',
                expiredAt: error.expiredAt
            }));
        } else {
            next(error);
        }
    }
};

// Middleware для проверки ролей
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Необходима авторизация', 401, {
                reason: 'not_authenticated'
            }));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError('Недостаточно прав для выполнения операции', 403, {
                reason: 'insufficient_permissions',
                userRole: req.user.role,
                requiredRoles: allowedRoles
            }));
        }

        next();
    };
};

module.exports = {
    authenticate,
    authorize
};

// ============================================
// IMPROVED CORS CONFIGURATION
// backend/config/cors.js
// ============================================

const corsOptions = {
    origin: function (origin, callback) {
        // Разрешенные источники из переменных окружения
        const allowedOrigins = process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',').map(url => url.trim())
            : ['http://localhost:3000', 'http://localhost:3001'];

        // Логирование для отладки
        if (process.env.NODE_ENV === 'development') {
            console.log('Request from origin:', origin);
            console.log('Allowed origins:', allowedOrigins);
        }

        // Разрешить запросы без origin (например, Postman)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin ${origin} не разрешен`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400 // 24 часа
};

module.exports = corsOptions;

// ============================================
// IMPROVED MAIN SERVER FILE
// backend/server.js
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const { errorHandler, notFound, logger } = require('./middleware/errorHandler');
const corsOptions = require('./config/cors');
const connectDB = require('./config/db');

const app = express();

// Подключение к БД
connectDB();

// Security middleware
app.use(helmet());
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // максимум 100 запросов
    message: 'Слишком много запросов с этого IP, попробуйте позже',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// CORS
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    logger.info({
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/archive', require('./routes/archive'));
app.use('/api/users', require('./routes/users'));

// Error handling
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
    });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// ============================================
// EXAMPLE ROUTE WITH ERROR HANDLING
// backend/routes/dashboard.js
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Получение данных дашборда
router.get('/',
    authenticate,
    authorize('programmer', 'admin' , 'dispatcher'),
    asyncHandler(async (req, res) => {
        try {
            // Имитация загрузки данных
            const dashboardData = await DashboardService.getData(req.user);

            if (!dashboardData) {
                throw new AppError('Данные не найдены', 404, {
                    userId: req.user.id
                });
            }

            res.status(200).json({
                success: true,
                data: dashboardData,
                user: {
                    id: req.user.id,
                    role: req.user.role,
                    email: req.user.email
                }
            });
        } catch (error) {
            throw new AppError(
                'Ошибка при загрузке данных дашборда',
                500,
                {
                    originalError: error.message,
                    userId: req.user.id
                }
            );
        }
    })
);

module.exports = router;