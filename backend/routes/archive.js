const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Запуск техники в работу (архивирование)
router.post('/launch/:id', authenticateToken, (req, res) => {
    const db = getDatabase();
    const { id } = req.params;
    const { completion_reason = 'launched' } = req.body;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    // Получаем данные оборудования
    db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, equipment) => {
        if (err) {
            console.error('Error fetching equipment:', err);
            return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
        }

        if (!equipment) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Проверяем, что техника готова к запуску
        if (equipment.status !== 'ready' && equipment.status !== 'scheduled') {
            return res.status(400).json({
                message: 'Можно запускать только готовую или запланированную технику'
            });
        }

        // Начинаем транзакцию
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Переносим в архив
            const archiveQuery = `
                INSERT INTO equipment_archive 
                (id, type, model, status, priority, planned_start, planned_end, 
                 actual_start, actual_end, delay_hours, malfunction, mechanic_name, 
                 progress, created_at, updated_at, completed_date, completion_user, archive_reason) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
            `;

            db.run(archiveQuery, [
                equipment.id, equipment.type, equipment.model, 'launched', equipment.priority,
                equipment.planned_start, equipment.planned_end, equipment.actual_start, equipment.actual_end,
                equipment.delay_hours, equipment.malfunction, equipment.mechanic_name,
                equipment.progress, equipment.created_at, equipment.updated_at,
                req.user.userId, completion_reason
            ], function (archiveErr) {
                if (archiveErr) {
                    db.run('ROLLBACK');
                    console.error('Error archiving equipment:', archiveErr);
                    return res.status(500).json({ message: 'Ошибка архивирования оборудования' });
                }

                // Добавляем запись в историю
                db.run(
                    'INSERT INTO equipment_history (equipment_id, user_id, action, new_value) VALUES (?, ?, ?, ?)',
                    [equipment.id, req.user.userId, 'launch', completion_reason],
                    function (historyErr) {
                        if (historyErr) {
                            console.error('Error logging launch:', historyErr);
                        }

                        // Удаляем из активной таблицы
                        db.run('DELETE FROM equipment WHERE id = ?', [id], function (deleteErr) {
                            if (deleteErr) {
                                db.run('ROLLBACK');
                                console.error('Error deleting equipment:', deleteErr);
                                return res.status(500).json({ message: 'Ошибка удаления из активной таблицы' });
                            }

                            // Коммитим транзакцию
                            db.run('COMMIT', function (commitErr) {
                                if (commitErr) {
                                    console.error('Error committing transaction:', commitErr);
                                    return res.status(500).json({ message: 'Ошибка сохранения изменений' });
                                }

                                res.json({
                                    message: 'Техника успешно запущена в работу',
                                    equipment_id: equipment.id,
                                    archive_id: this.lastID
                                });
                            });
                        });
                    }
                );
            });
        });
    });
});

// Получение архивных записей
router.get('/', authenticateToken, (req, res) => {
    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();
    const {
        page = 1,
        limit = 50,
        type,
        mechanic,
        date_from,
        date_to
    } = req.query;

    let query = `
        SELECT 
            ea.*,
            u.username as completion_username,
            u.full_name as completion_user_name
        FROM equipment_archive ea
        LEFT JOIN users u ON ea.completion_user = u.id
    `;

    const conditions = [];
    const params = [];

    // Фильтры
    if (type) {
        conditions.push('ea.type = ?');
        params.push(type);
    }

    if (mechanic) {
        conditions.push('ea.mechanic_name LIKE ?');
        params.push(`%${mechanic}%`);
    }

    if (date_from) {
        conditions.push('DATE(ea.completed_date) >= ?');
        params.push(date_from);
    }

    if (date_to) {
        conditions.push('DATE(ea.completed_date) <= ?');
        params.push(date_to);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ea.completed_date DESC';

    // Пагинация
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, archives) => {
        if (err) {
            console.error('Error fetching archives:', err);
            return res.status(500).json({ message: 'Ошибка получения архивных данных' });
        }

        // Получаем общее количество для пагинации
        let countQuery = 'SELECT COUNT(*) as total FROM equipment_archive ea';
        const countParams = [];

        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
            // Убираем последние два параметра (limit и offset)
            countParams.push(...params.slice(0, -2));
        }

        db.get(countQuery, countParams, (countErr, countResult) => {
            if (countErr) {
                console.error('Error counting archives:', countErr);
                return res.status(500).json({ message: 'Ошибка подсчета архивных данных' });
            }

            res.json({
                archives,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult.total,
                    pages: Math.ceil(countResult.total / limit)
                }
            });
        });
    });
});

// Статистика архива
router.get('/stats', authenticateToken, (req, res) => {
    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();
    const { date_from, date_to } = req.query;

    let query = `
        SELECT 
            COUNT(*) as total_archived,
            SUM(CASE WHEN archive_reason = 'launched' THEN 1 ELSE 0 END) as launched,
            SUM(CASE WHEN archive_reason = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN archive_reason = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            AVG(progress) as avg_progress,
            type,
            COUNT(*) as type_count
        FROM equipment_archive
    `;

    const conditions = [];
    const params = [];

    if (date_from) {
        conditions.push('DATE(completed_date) >= ?');
        params.push(date_from);
    }

    if (date_to) {
        conditions.push('DATE(completed_date) <= ?');
        params.push(date_to);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY type';

    db.all(query, params, (err, typeStats) => {
        if (err) {
            console.error('Error fetching archive stats:', err);
            return res.status(500).json({ message: 'Ошибка получения статистики архива' });
        }

        // Получаем общую статистику
        let summaryQuery = `
            SELECT 
                COUNT(*) as total_archived,
                SUM(CASE WHEN archive_reason = 'launched' THEN 1 ELSE 0 END) as launched,
                SUM(CASE WHEN archive_reason = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN archive_reason = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                AVG(progress) as avg_progress
            FROM equipment_archive
        `;

        if (conditions.length > 0) {
            summaryQuery += ' WHERE ' + conditions.join(' AND ');
        }

        db.get(summaryQuery, params, (summaryErr, summary) => {
            if (summaryErr) {
                console.error('Error fetching archive summary:', summaryErr);
                return res.status(500).json({ message: 'Ошибка получения сводной статистики' });
            }

            res.json({
                summary: {
                    total_archived: summary.total_archived || 0,
                    launched: summary.launched || 0,
                    completed: summary.completed || 0,
                    cancelled: summary.cancelled || 0,
                    avg_progress: Math.round(summary.avg_progress || 0)
                },
                by_type: typeStats
            });
        });
    });
});

module.exports = router;