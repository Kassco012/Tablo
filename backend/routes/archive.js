const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/launch/:id', authenticateToken, (req, res) => {
    const db = getDatabase();
    const { id } = req.params;
    const { completion_reason = 'launched' } = req.body;

    // Проверяем права доступа
    if (req.user.role !== 'programmer' && req.user.role !== 'dispatcher' && req.user.role !== 'admin'  ) {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    // Получаем данные оборудования из equipment_master
    db.get('SELECT * FROM equipment_master WHERE id = ? AND is_active = 1', [id], (err, equipment) => {
        if (err) {
            console.error('❌ Ошибка получения оборудования:', err);
            return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
        }

        if (!equipment) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Проверяем, что техника готова к запуску
        if (equipment.status !== 'Ready' && equipment.status !== 'Standby') {
            return res.status(400).json({
                message: 'Можно запускать только готовую технику (Ready или Standby)'
            });
        }

        // Начинаем транзакцию
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Переносим в архив
            const archiveQuery = `
                INSERT INTO equipment_archive 
                (id, equipment_type, model, status, actual_start, actual_end, 
                 delay_hours, malfunction, mechanic_name,
                 created_at, updated_at, completed_date, completion_user, archive_reason) 
                VALUES (?, ?, ?, ?, 'launched', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
            `;

            db.run(archiveQuery, [
                equipment.id,
                equipment.equipment_type,
                equipment.model,
                equipment.planned_hours, 
                equipment.actual_start,
                equipment.actual_end,
                equipment.delay_hours || 0,
                equipment.malfunction,
                equipment.mechanic_name,
                equipment.created_at,
                equipment.updated_at,
                req.user.userId,
                completion_reason
            ], function (archiveErr) {
                if (archiveErr) {
                    db.run('ROLLBACK');
                    console.error('❌ Ошибка архивирования:', archiveErr);
                    return res.status(500).json({ message: 'Ошибка архивирования оборудования' });
                }

                const archiveId = this.lastID;

                // Добавляем запись в историю
                db.run(
                    `INSERT INTO equipment_history (equipment_id, user_id, action, new_value) 
                     VALUES (?, ?, ?, ?)`,
                    [equipment.id, req.user.userId, 'launch', completion_reason],
                    function (historyErr) {
                        if (historyErr) {
                            console.error('⚠️ Ошибка записи в историю:', historyErr);
                        }

                        // Помечаем как неактивное (вместо удаления)
                        db.run(
                            'UPDATE equipment_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [id],
                            function (updateErr) {
                                if (updateErr) {
                                    db.run('ROLLBACK');
                                    console.error('❌ Ошибка обновления статуса:', updateErr);
                                    return res.status(500).json({ message: 'Ошибка обновления статуса' });
                                }

                                // Коммитим транзакцию
                                db.run('COMMIT', function (commitErr) {
                                    if (commitErr) {
                                        console.error('❌ Ошибка коммита:', commitErr);
                                        return res.status(500).json({ message: 'Ошибка сохранения изменений' });
                                    }

                                    console.log(`✅ Техника ${equipment.id} запущена в работу`);

                                    res.json({
                                        message: 'Техника успешно запущена в работу',
                                        equipment_id: equipment.id,
                                        archive_id: archiveId
                                    });
                                });
                            }
                        );
                    }
                );
            });
        });
    });
});


router.get('/', authenticateToken, (req, res) => {
    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'programmer' ) {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();
    const {
        page = 1,
        limit = 50,
        equipment_type,
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
        WHERE 1=1
    `;

    const params = [];

    

    if (equipment_type) {
        query += ' AND ea.equipment_type LIKE ?';
        params.push(`%${equipment_type}%`);
    }

    if (mechanic) {
        query += ' AND ea.mechanic_name LIKE ?';
        params.push(`%${mechanic}%`);
    }

    if (date_from) {
        query += ' AND DATE(ea.completed_date) >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND DATE(ea.completed_date) <= ?';
        params.push(date_to);
    }

    query += ' ORDER BY ea.completed_date DESC';

    // Пагинация
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, archives) => {
        if (err) {
            console.error('❌ Ошибка получения архива:', err);
            return res.status(500).json({ message: 'Ошибка получения архивных данных' });
        }

        // Получаем общее количество для пагинации
        let countQuery = 'SELECT COUNT(*) as total FROM equipment_archive ea WHERE 1=1';
        const countParams = params.slice(0, -2); // Убираем LIMIT и OFFSET

        // Добавляем те же условия фильтрации
        if (equipment_type) countQuery += ' AND ea.equipment_type LIKE ?';
        if (mechanic) countQuery += ' AND ea.mechanic_name LIKE ?';
        if (date_from) countQuery += ' AND DATE(ea.completed_date) >= ?';
        if (date_to) countQuery += ' AND DATE(ea.completed_date) <= ?';

        db.get(countQuery, countParams, (countErr, countResult) => {
            if (countErr) {
                console.error('❌ Ошибка подсчета архива:', countErr);
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

router.get('/stats', authenticateToken, (req, res) => {
    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'programmer' ) {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();
    const { date_from, date_to } = req.query;

    // Статистика по типам оборудования
    let query = `
        SELECT 
            COUNT(*) as total_archived,
            SUM(CASE WHEN archive_reason = 'launched' THEN 1 ELSE 0 END) as launched,
            SUM(CASE WHEN archive_reason = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN archive_reason = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            AVG(progress) as avg_progress,
            equipment_type
        FROM equipment_archive
        WHERE 1=1
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
        query += ' AND ' + conditions.join(' AND ');
    }

    query += ' GROUP BY equipment_type';

    db.all(query, params, (err, typeStats) => {
        if (err) {
            console.error('❌ Ошибка получения статистики:', err);
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
            WHERE 1=1
        `;

        if (conditions.length > 0) {
            summaryQuery += ' AND ' + conditions.join(' AND ');
        }

        db.get(summaryQuery, params, (summaryErr, summary) => {
            if (summaryErr) {
                console.error('❌ Ошибка получения сводки:', summaryErr);
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