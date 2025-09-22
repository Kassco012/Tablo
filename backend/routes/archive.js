const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Запуск техники (архивирование)
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

        // Проверяем, можно ли запустить (только готовое или запланированное)
        if (equipment.status !== 'ready' && equipment.status !== 'scheduled') {
            return res.status(400).json({
                message: 'Можно запускать только готовое или запланированное оборудование'
            });
        }

        // Начинаем транзакцию
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Архивируем оборудование
            const archiveQuery = `
                INSERT INTO equipment_archive 
                (id, type, model, status, priority, planned_start, planned_end, 
                 actual_start, actual_end, delay_hours, malfunction, mechanic_name, 
                 progress, created_at, updated_at, completed_date, completion_user, 
                 archive_reason, original_table)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                        CURRENT_TIMESTAMP, ?, ?, 'equipment')
            `;

            db.run(archiveQuery, [
                equipment.id, equipment.type, equipment.model, 'launched', equipment.priority,
                equipment.planned_start, equipment.planned_end, equipment.actual_start,
                equipment.actual_end, equipment.delay_hours, equipment.malfunction,
                equipment.mechanic_name, equipment.progress, equipment.created_at,
                equipment.updated_at, req.user.userId, completion_reason
            ], function (archiveErr) {
                if (archiveErr) {
                    db.run('ROLLBACK');
                    console.error('Error archiving equipment:', archiveErr);
                    return res.status(500).json({ message: 'Ошибка архивирования оборудования' });
                }

                // Добавляем запись в историю
                db.run(
                    'INSERT INTO equipment_history (equipment_id, user_id, action, new_value) VALUES (?, ?, ?, ?)',
                    [id, req.user.userId, 'launch', 'Техника запущена в работу'],
                    function (historyErr) {
                        if (historyErr) {
                            console.error('Error logging launch:', historyErr);
                        }

                        // Удаляем из основной таблицы
                        db.run('DELETE FROM equipment WHERE id = ?', [id], function (deleteErr) {
                            if (deleteErr) {
                                db.run('ROLLBACK');
                                console.error('Error deleting equipment:', deleteErr);
                                return res.status(500).json({ message: 'Ошибка удаления оборудования' });
                            }

                            // Коммитим транзакцию
                            db.run('COMMIT', function (commitErr) {
                                if (commitErr) {
                                    console.error('Error committing transaction:', commitErr);
                                    return res.status(500).json({ message: 'Ошибка сохранения изменений' });
                                }

                                res.json({
                                    message: `Техника ${id} успешно запущена в работу`,
                                    equipment: equipment,
                                    archived: true
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
    const db = getDatabase();
    const {
        page = 1,
        limit = 50,
        start_date,
        end_date,
        type,
        mechanic,
        archive_reason
    } = req.query;

    let query = 'SELECT * FROM equipment_archive WHERE 1=1';
    let params = [];

    // Фильтры
    if (start_date) {
        query += ' AND DATE(completed_date) >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND DATE(completed_date) <= ?';
        params.push(end_date);
    }

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    if (mechanic) {
        query += ' AND mechanic_name LIKE ?';
        params.push(`%${mechanic}%`);
    }

    if (archive_reason) {
        query += ' AND archive_reason = ?';
        params.push(archive_reason);
    }

    // Пагинация
    const offset = (page - 1) * limit;
    query += ' ORDER BY completed_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, archives) => {
        if (err) {
            console.error('Error fetching archives:', err);
            return res.status(500).json({ message: 'Ошибка получения архивных данных' });
        }

        // Получаем общее количество записей для пагинации
        let countQuery = 'SELECT COUNT(*) as total FROM equipment_archive WHERE 1=1';
        let countParams = [];

        if (start_date) {
            countQuery += ' AND DATE(completed_date) >= ?';
            countParams.push(start_date);
        }

        if (end_date) {
            countQuery += ' AND DATE(completed_date) <= ?';
            countParams.push(end_date);
        }

        if (type) {
            countQuery += ' AND type = ?';
            countParams.push(type);
        }

        if (mechanic) {
            countQuery += ' AND mechanic_name LIKE ?';
            countParams.push(`%${mechanic}%`);
        }

        if (archive_reason) {
            countQuery += ' AND archive_reason = ?';
            countParams.push(archive_reason);
        }

        db.get(countQuery, countParams, (countErr, countResult) => {
            if (countErr) {
                console.error('Error counting archives:', countErr);
                return res.status(500).json({ message: 'Ошибка подсчета записей' });
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

// Получение статистики архива
router.get('/stats', authenticateToken, (req, res) => {
    const db = getDatabase();
    const { start_date, end_date } = req.query;

    let query = `
        SELECT 
            archive_reason,
            COUNT(*) as count,
            type
        FROM equipment_archive 
        WHERE 1=1
    `;
    let params = [];

    if (start_date) {
        query += ' AND DATE(completed_date) >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND DATE(completed_date) <= ?';
        params.push(end_date);
    }

    query += ' GROUP BY archive_reason, type ORDER BY count DESC';

    db.all(query, params, (err, stats) => {
        if (err) {
            console.error('Error fetching archive stats:', err);
            return res.status(500).json({ message: 'Ошибка получения статистики архива' });
        }

        // Получаем общую статистику
        let totalQuery = `
            SELECT 
                COUNT(*) as total_archived,
                COUNT(CASE WHEN archive_reason = 'launched' THEN 1 END) as launched,
                COUNT(CASE WHEN archive_reason = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN archive_reason = 'cancelled' THEN 1 END) as cancelled
            FROM equipment_archive 
            WHERE 1=1
        `;
        let totalParams = [];

        if (start_date) {
            totalQuery += ' AND DATE(completed_date) >= ?';
            totalParams.push(start_date);
        }

        if (end_date) {
            totalQuery += ' AND DATE(completed_date) <= ?';
            totalParams.push(end_date);
        }

        db.get(totalQuery, totalParams, (totalErr, totalStats) => {
            if (totalErr) {
                console.error('Error fetching total stats:', totalErr);
                return res.status(500).json({ message: 'Ошибка получения общей статистики' });
            }

            res.json({
                detailed_stats: stats,
                summary: totalStats
            });
        });
    });
});

module.exports = router;