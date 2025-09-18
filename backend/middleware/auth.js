const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            message: 'Токен доступа не предоставлен'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification error:', err);

            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    message: 'Токен истек'
                });
            }

            if (err.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    message: 'Недействительный токен'
                });
            }

            return res.status(403).json({
                message: 'Ошибка проверки токена'
            });
        }

        req.user = user;
        next();
    });
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Пользователь не аутентифицирован'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Недостаточно прав доступа'
            });
        }

        next();
    };
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
}

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth
};