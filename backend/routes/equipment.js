const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Получение всего оборудования
router.get('/', (req, res) => {
    const db = getDatabase();

    db.all(
        'SELECT * FROM equipment ORDER BY id',
        [],
        (err, equipment) => {
            if (err) {
                console.error('Error fetching equipment:', err);
                return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
            }

            res.json(equipment);
        }
    );
});

// Получение статистики
router.get('/stats', (req, res) => {
    const db = getDatabase();

    const query = `
    SELECT 
      status,
      COUNT(*) as count
    FROM equipment 
    GROUP BY status
  `;

    db.all(query, [], (err, stats) => {
        if (err) {
            console.error('Error fetching stats:', err);
            return res.status(500).json({ message: 'Ошибка получения статистики' });
        }

        // Преобразуем в удобный формат
        const result = {
            in_repair: 0,
            ready: 0,
            waiting: 0,
            scheduled: 0,
            total: 0
        };

        stats.forEach(stat => {
            result[stat.status] = stat.count;
            result.total += stat.count;
        });

        res.json(result);
    });
});

// Получение конкретного оборудования
router.get('/:id', (req, res) => {
    const db = getDatabase();
    const { id } = req.params;

    db.get(
        'SELECT * FROM equipment WHERE id = ?',
        [id],
        (err, equipment) => {
            if (err) {
                console.error('Error fetching equipment:', err);
                return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
            }

            if (!equipment) {
                return res.status(404).json({ message: 'Оборудование не найдено' });
            }

            res.json(equipment);
        }
    );
});

// Новый маршрут для изменения ID оборудования
router.put('/:id/change-id', authenticateToken, (req, res) => {
    const db = getDatabase();
    const { id: oldId } = req.params;
    const { newId } = req.body;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    if (!newId || newId.trim() === '') {
        return res.status(400).json({ message: 'Новый ID не может быть пустым' });
    }

    if (oldId === newId) {
        return res.status(400).json({ message: 'Новый ID должен отличаться от текущего' });
    }

    // Проверяем, не существует ли уже оборудование с таким ID
    db.get('SELECT id FROM equipment WHERE id = ?', [newId], (err, existingEquipment) => {
        if (err) {
            return res.status(500).json({ message: 'Ошибка проверки ID' });
        }

        if (existingEquipment) {
            return res.status(409).json({ message: 'Оборудование с таким ID уже существует' });
        }

        // Получаем старые данные для истории
        db.get('SELECT * FROM equipment WHERE id = ?', [oldId], (err, oldData) => {
            if (err) {
                return res.status(500).json({ message: 'Ошибка получения данных' });
            }

            if (!oldData) {
                return res.status(404).json({ message: 'Оборудование не найдено' });
            }

            // Начинаем транзакцию
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Создаем новую запись с новым ID
                const insertQuery = `
                    INSERT INTO equipment 
                    (id, type, model, status, priority, planned_start, planned_end, 
                     actual_start, actual_end, delay_hours, malfunction, mechanic_name, 
                     progress, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `;

                db.run(insertQuery, [
                    newId, oldData.type, oldData.model, oldData.status, oldData.priority,
                    oldData.planned_start, oldData.planned_end, oldData.actual_start, oldData.actual_end,
                    oldData.delay_hours, oldData.malfunction, oldData.mechanic_name,
                    oldData.progress, oldData.created_at
                ], function (insertErr) {
                    if (insertErr) {
                        db.run('ROLLBACK');
                        console.error('Error inserting new equipment:', insertErr);
                        return res.status(500).json({ message: 'Ошибка создания записи с новым ID' });
                    }

                    // Копируем историю с новым equipment_id
                    db.run(`
                        INSERT INTO equipment_history 
                        (equipment_id, user_id, action, old_value, new_value, timestamp)
                        SELECT ?, user_id, action, old_value, new_value, timestamp
                        FROM equipment_history 
                        WHERE equipment_id = ?
                    `, [newId, oldId], function (historyErr) {
                        if (historyErr) {
                            console.error('Error copying history:', historyErr);
                            // Не прерываем транзакцию из-за ошибки копирования истории
                        }

                        // Добавляем запись об изменении ID
                        db.run(
                            'INSERT INTO equipment_history (equipment_id, user_id, action, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
                            [newId, req.user.userId, 'change_id', oldId, newId],
                            function (logErr) {
                                if (logErr) {
                                    console.error('Error logging ID change:', logErr);
                                }

                                // Удаляем старые записи
                                db.run('DELETE FROM equipment_history WHERE equipment_id = ?', [oldId], function (deleteHistoryErr) {
                                    if (deleteHistoryErr) {
                                        console.error('Error deleting old history:', deleteHistoryErr);
                                    }

                                    db.run('DELETE FROM equipment WHERE id = ?', [oldId], function (deleteErr) {
                                        if (deleteErr) {
                                            db.run('ROLLBACK');
                                            console.error('Error deleting old equipment:', deleteErr);
                                            return res.status(500).json({ message: 'Ошибка удаления старой записи' });
                                        }

                                        // Коммитим транзакцию
                                        db.run('COMMIT', function (commitErr) {
                                            if (commitErr) {
                                                console.error('Error committing transaction:', commitErr);
                                                return res.status(500).json({ message: 'Ошибка сохранения изменений' });
                                            }

                                            // Получаем обновленные данные
                                            db.get('SELECT * FROM equipment WHERE id = ?', [newId], (err, updatedEquipment) => {
                                                if (err) {
                                                    return res.status(500).json({ message: 'Ошибка получения обновленных данных' });
                                                }

                                                res.json({
                                                    message: 'ID оборудования изменен успешно',
                                                    equipment: updatedEquipment,
                                                    oldId: oldId,
                                                    newId: newId
                                                });
                                            });
                                        });
                                    });
                                });
                            }
                        );
                    });
                });
            });
        });
    });
});

// Обновление оборудования (требует авторизации)
router.put('/:id', authenticateToken, (req, res) => {
    const db = getDatabase();
    const { id } = req.params;
    const {
        status,
        priority,
        planned_start,
        planned_end,
        actual_start,
        actual_end,
        delay_hours,
        malfunction,
        mechanic_name,
        progress,
        type,
        model
    } = req.body;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    // Получаем старые данные для истории
    db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, oldData) => {
        if (err) {
            return res.status(500).json({ message: 'Ошибка получения данных' });
        }

        if (!oldData) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Обновляем данные (включая type и model)
        const query = `
      UPDATE equipment SET 
        type = COALESCE(?, type),
        model = COALESCE(?, model),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        planned_start = COALESCE(?, planned_start),
        planned_end = COALESCE(?, planned_end),
        actual_start = COALESCE(?, actual_start),
        actual_end = COALESCE(?, actual_end),
        delay_hours = COALESCE(?, delay_hours),
        malfunction = COALESCE(?, malfunction),
        mechanic_name = COALESCE(?, mechanic_name),
        progress = COALESCE(?, progress),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        db.run(
            query,
            [
                type, model, status, priority, planned_start, planned_end, actual_start,
                actual_end, delay_hours, malfunction, mechanic_name, progress, id
            ],
            function (err) {
                if (err) {
                    console.error('Error updating equipment:', err);
                    return res.status(500).json({ message: 'Ошибка обновления оборудования' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ message: 'Оборудование не найдено' });
                }

                // Записываем в историю значимые изменения
                const changes = [];
                if (type && type !== oldData.type) {
                    changes.push({ field: 'type', old: oldData.type, new: type });
                }
                if (model && model !== oldData.model) {
                    changes.push({ field: 'model', old: oldData.model, new: model });
                }
                if (status && status !== oldData.status) {
                    changes.push({ field: 'status', old: oldData.status, new: status });
                }
                if (progress !== undefined && progress !== oldData.progress) {
                    changes.push({ field: 'progress', old: oldData.progress, new: progress });
                }
                if (mechanic_name && mechanic_name !== oldData.mechanic_name) {
                    changes.push({ field: 'mechanic_name', old: oldData.mechanic_name, new: mechanic_name });
                }

                // Сохраняем историю
                const historyStmt = db.prepare(`
          INSERT INTO equipment_history (equipment_id, user_id, action, old_value, new_value) 
          VALUES (?, ?, ?, ?, ?)
        `);

                changes.forEach(change => {
                    historyStmt.run([
                        id,
                        req.user.userId,
                        `update_${change.field}`,
                        change.old,
                        change.new
                    ]);
                });

                historyStmt.finalize();

                // Получаем обновленные данные
                db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, updatedEquipment) => {
                    if (err) {
                        return res.status(500).json({ message: 'Ошибка получения обновленных данных' });
                    }

                    res.json({
                        message: 'Оборудование обновлено успешно',
                        equipment: updatedEquipment
                    });
                });
            }
        );
    });
});

// Остальные маршруты остаются без изменений...
// (создание, удаление, история)

// Создание нового оборудования (только для админов)
router.post('/', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();
    const {
        id,
        type,
        model,
        status = 'ready',
        priority = 'normal',
        planned_start,
        planned_end,
        malfunction = '',
        mechanic_name = '',
        progress = 0
    } = req.body;

    if (!id || !type || !model) {
        return res.status(400).json({
            message: 'ID, тип и модель оборудования обязательны'
        });
    }

    const query = `
    INSERT INTO equipment 
    (id, type, model, status, priority, planned_start, planned_end, 
     malfunction, mechanic_name, progress) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    db.run(
        query,
        [id, type, model, status, priority, planned_start, planned_end,
            malfunction, mechanic_name, progress],
        function (err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                    return res.status(409).json({
                        message: 'Оборудование с таким ID уже существует'
                    });
                }
                console.error('Error creating equipment:', err);
                return res.status(500).json({ message: 'Ошибка создания оборудования' });
            }

            // Записываем в историю
            db.run(
                'INSERT INTO equipment_history (equipment_id, user_id, action, new_value) VALUES (?, ?, ?, ?)',
                [id, req.user.userId, 'create', JSON.stringify(req.body)]
            );

            res.status(201).json({
                message: 'Оборудование создано успешно',
                equipmentId: id
            });
        }
    );
});

// Удаление оборудования (только для админов)
router.delete('/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();
    const { id } = req.params;

    db.run('DELETE FROM equipment WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('Error deleting equipment:', err);
            return res.status(500).json({ message: 'Ошибка удаления оборудования' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Записываем в историю
        db.run(
            'INSERT INTO equipment_history (equipment_id, user_id, action) VALUES (?, ?, ?)',
            [id, req.user.userId, 'delete']
        );

        res.json({ message: 'Оборудование удалено успешно' });
    });
});

// Получение истории изменений
router.get('/:id/history', authenticateToken, (req, res) => {
    const db = getDatabase();
    const { id } = req.params;

    const query = `
    SELECT 
      h.*,
      u.username,
      u.full_name
    FROM equipment_history h
    LEFT JOIN users u ON h.user_id = u.id
    WHERE h.equipment_id = ?
    ORDER BY h.timestamp DESC
    LIMIT 50
  `;

    db.all(query, [id], (err, history) => {
        if (err) {
            console.error('Error fetching history:', err);
            return res.status(500).json({ message: 'Ошибка получения истории' });
        }

        res.json(history);
    });
});

module.exports = router;