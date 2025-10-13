const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';


// ✅ ИСПРАВЛЕНИЕ:
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;  // Теперь email везде!

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email и пароль обязательны'
            });
        }

        const db = getDatabase();

        db.get(
            'SELECT * FROM users WHERE username = ?',  // В БД поле называется username
            [email],  // Но передаем email
            async (err, user) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }

                if (!user) {
                    return res.status(401).json({ message: 'Неверные учетные данные' });
                }

                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    return res.status(401).json({ message: 'Неверные учетные данные' });
                }

                db.run(
                    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [user.id]
                );

                const token = jwt.sign(
                    {
                        userId: user.id,
                        username: user.username,
                        role: user.role
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.json({
                    message: 'Вход выполнен успешно',
                    token,
                    user: {
                        id: user.id,
                        email: user.username,  // Возвращаем как email
                        username: user.username,
                        role: user.role,
                        fullName: user.full_name
                    }
                });
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/register', authenticateToken, async (req, res) => {
    try {
        const { username, password, role, fullName } = req.body;

        // Проверяем права доступа
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Недостаточно прав доступа'
            });
        }

        if (!username || !password) {
            return res.status(400).json({
                message: 'Имя пользователя и пароль обязательны'
            });
        }

        const db = getDatabase();

        // Проверяем, не существует ли уже пользователь
        db.get(
            'SELECT id FROM users WHERE username = ?',
            [username],
            async (err, existingUser) => {
                if (err) {
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }

                if (existingUser) {
                    return res.status(409).json({
                        message: 'Пользователь с таким именем уже существует'
                    });
                }

                // Хешируем пароль
                const hashedPassword = await bcrypt.hash(password, 10);

                // Создаем пользователя
                db.run(
                    'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
                    [username, hashedPassword, role || 'user', fullName || ''],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ message: 'Ошибка создания пользователя' });
                        }

                        res.status(201).json({
                            message: 'Пользователь создан успешно',
                            userId: this.lastID
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Проверка токена
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        message: 'Токен действителен',
        user: {
            id: req.user.userId,
            username: req.user.username,
            role: req.user.role
        }
    });
});

// Выход
router.post('/logout', (req, res) => {
    // В простой реализации с JWT просто отвечаем успехом
    // В продакшене можно добавить черный список токенов
    res.json({ message: 'Выход выполнен успешно' });
});

// Получение списка пользователей (только для админов)
router.get('/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();

    db.all(
        'SELECT id, username, role, full_name, created_at, last_login FROM users ORDER BY created_at DESC',
        [],
        (err, users) => {
            if (err) {
                return res.status(500).json({ message: 'Ошибка получения пользователей' });
            }

            res.json(users);
        }
    );
});

module.exports = router;