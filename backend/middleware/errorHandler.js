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
