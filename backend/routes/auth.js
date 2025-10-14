const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// ============================================
// LOGIN ROUTE - ТОЛЬКО USERNAME
// ============================================
router.post('/login', async (req, res) => {
    try {
        console.log('='.repeat(60));
        console.log('🔑 LOGIN REQUEST RECEIVED');
        console.log('='.repeat(60));
        console.log('Body:', req.body);

        const { username, password } = req.body;

        console.log('Extracted username:', username);
        console.log('Extracted password:', password ? '***' : 'EMPTY');

        // Валидация
        if (!username || !password) {
            console.log('❌ VALIDATION FAILED: Missing credentials');
            return res.status(400).json({
                success: false,
                message: 'Username и пароль обязательны'
            });
        }

        // ✅ ПОИСК ТОЛЬКО ПО USERNAME
        console.log('🔍 Searching for user:', username);

        const user = await db.get(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        console.log('🔍 User found:', user ? 'YES' : 'NO');

        if (!user) {
            console.log('❌ USER NOT FOUND:', username);
            return res.status(401).json({
                success: false,
                message: 'Неверный username или пароль'
            });
        }

        console.log('✅ User found:', user.username);
        console.log('👤 User role:', user.role);

        // Проверка пароля
        const isValidPassword = await bcrypt.compare(password, user.password);

        console.log('🔐 Password check:', isValidPassword ? 'VALID' : 'INVALID');

        if (!isValidPassword) {
            console.log('❌ INVALID PASSWORD for:', username);
            return res.status(401).json({
                success: false,
                message: 'Неверный username или пароль'
            });
        }

        console.log('✅ Password valid');

        // Генерация токена
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '24h' }
        );

        console.log('✅ Token generated');

        // Обновляем last_login
        await db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        console.log('✅ LOGIN SUCCESSFUL for:', username);
        console.log('='.repeat(60));

        // Успешный ответ БЕЗ email
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('='.repeat(60));
        console.error('💥 LOGIN ERROR:', error);
        console.error('Error stack:', error.stack);
        console.error('='.repeat(60));

        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при входе',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// VERIFY TOKEN
// ============================================
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Токен не предоставлен'
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your-secret-key-change-in-production'
        );

        const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ Token verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Недействительный токен'
        });
    }
});

module.exports = router;