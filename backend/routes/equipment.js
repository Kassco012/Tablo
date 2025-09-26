// backend/routes/equipment.js - ИСПРАВЛЕННАЯ версия (обратно совместимая)

const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Функция для проверки существования колонки section
function checkSectionColumn(callback) {
    const db = getDatabase();
    db.all("PRAGMA table_info(equipment)", [], (err, columns) => {
        if (err) {
            callback(err, false);
        } else {
            const hasSection = columns.some(col => col.name === 'section');
            callback(null, hasSection);
        }
    });
}

// Получение всего оборудования с безопасной обработкой section
router.get('/', (req, res) => {
    const db = getDatabase();
    const { section, status, type } = req.query;

    // Сначала проверяем, есть ли колонка section
    checkSectionColumn((err, hasSection) => {
        if (err) {
            console.error('Error checking section column:', err);
            return res.status(500).json({ message: 'Ошибка проверки структуры БД' });
        }

        let query = 'SELECT * FROM equipment WHERE 1=1';
        const params = [];

        // Если есть колонка section и запрошена фильтрация
        if (hasSection && section) {
            query += ' AND section = ?';
            params.push(section);
        }

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }

        // Сортировка с учетом наличия section
        if (hasSection) {
            query += ' ORDER BY section, priority DESC, id';
        } else {
            query += ' ORDER BY priority DESC, id';
        }

        db.all(query, params, (err, equipment) => {
            if (err) {
                console.error('Error fetching equipment:', err);
                return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
            }

            // Если нет колонки section, добавляем значение по умолчанию
            if (!hasSection) {
                equipment = equipment.map(item => ({
                    ...item,
                    section: item.type === 'excavator' ? 'гусеничные техники' : 'колесные техники'
                }));
            }

            res.json(equipment);
        });
    });
});

// Получение списка участков (безопасно)
router.get('/sections', (req, res) => {
    const db = getDatabase();

    checkSectionColumn((err, hasSection) => {
        if (err) {
            console.error('Error checking section column:', err);
            return res.status(500).json({ message: 'Ошибка проверки структуры БД' });
        }

        if (!hasSection) {
            // Если нет колонки section, возвращаем статистику по типам
            const query = `
                SELECT 
                    CASE 
                        WHEN type = 'excavator' THEN 'гусеничные техники'
                        ELSE 'колесные техники'
                    END as section,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'in_repair' THEN 1 ELSE 0 END) as in_repair,
                    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
                    SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                    SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled
                FROM equipment 
                GROUP BY type
                ORDER BY section
            `;

            db.all(query, [], (err, sections) => {
                if (err) {
                    console.error('Error fetching sections (fallback):', err);
                    return res.status(500).json({ message: 'Ошибка получения участков' });
                }
                res.json(sections);
            });
        } else {
            // Если есть колонка section, используем ее
            const query = `
                SELECT 
                    section,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'in_repair' THEN 1 ELSE 0 END) as in_repair,
                    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
                    SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                    SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled
                FROM equipment 
                GROUP BY section
                ORDER BY section
            `;

            db.all(query, [], (err, sections) => {
                if (err) {
                    console.error('Error fetching sections:', err);
                    return res.status(500).json({ message: 'Ошибка получения участков' });
                }
                res.json(sections);
            });
        }
    });
});

// Получение статистики с безопасной обработкой section
router.get('/stats', (req, res) => {
    const db = getDatabase();

    checkSectionColumn((err, hasSection) => {
        if (err) {
            console.error('Error checking section column:', err);
            return res.status(500).json({ message: 'Ошибка проверки структуры БД' });
        }

        let query;
        if (hasSection) {
            query = `
                SELECT 
                    status,
                    section,
                    COUNT(*) as count
                FROM equipment 
                GROUP BY status, section
            `;
        } else {
            query = `
                SELECT 
                    status,
                    CASE 
                        WHEN type = 'excavator' THEN 'гусеничные техники'
                        ELSE 'колесные техники'
                    END as section,
                    COUNT(*) as count
                FROM equipment 
                GROUP BY status, type
            `;
        }

        db.all(query, [], (err, stats) => {
            if (err) {
                console.error('Error fetching stats:', err);
                return res.status(500).json({ message: 'Ошибка получения статистики' });
            }

            const result = {
                in_repair: 0,
                ready: 0,
                waiting: 0,
                scheduled: 0,
                total: 0,
                by_section: {}
            };

            stats.forEach(stat => {
                result[stat.status] += stat.count;
                result.total += stat.count;

                if (!result.by_section[stat.section]) {
                    result.by_section[stat.section] = {
                        in_repair: 0,
                        ready: 0,
                        waiting: 0,
                        scheduled: 0,
                        total: 0
                    };
                }

                result.by_section[stat.section][stat.status] = stat.count;
                result.by_section[stat.section].total += stat.count;
            });

            res.json(result);
        });
    });
});

// Получение конкретного оборудования
router.get('/:id', (req, res) => {
    const db = getDatabase();
    const { id } = req.params;

    checkSectionColumn((err, hasSection) => {
        if (err) {
            console.error('Error checking section column:', err);
            return res.status(500).json({ message: 'Ошибка проверки структуры БД' });
        }

        db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, equipment) => {
            if (err) {
                console.error('Error fetching equipment:', err);
                return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
            }

            if (!equipment) {
                return res.status(404).json({ message: 'Оборудование не найдено' });
            }

            // Добавляем section если его нет
            if (!hasSection) {
                equipment.section = equipment.type === 'excavator' ? 'гусеничные техники' : 'колесные техники';
            }

            res.json(equipment);
        });
    });
});

// Обновление оборудования (требует авторизации) - безопасное обновление
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
        model,
        section
    } = req.body;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    checkSectionColumn((err, hasSection) => {
        if (err) {
            console.error('Error checking section column:', err);
            return res.status(500).json({ message: 'Ошибка проверки структуры БД' });
        }

        // Получаем старые данные для истории
        db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, oldData) => {
            if (err) {
                return res.status(500).json({ message: 'Ошибка получения данных' });
            }

            if (!oldData) {
                return res.status(404).json({ message: 'Оборудование не найдено' });
            }

            // Формируем запрос в зависимости от наличия колонки section
            let query, params;
            if (hasSection) {
                query = `
                    UPDATE equipment SET 
                        type = COALESCE(?, type),
                        model = COALESCE(?, model),
                        section = COALESCE(?, section),
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
                params = [
                    type, model, section, status, priority, planned_start, planned_end, actual_start,
                    actual_end, delay_hours, malfunction, mechanic_name, progress, id
                ];
            } else {
                query = `
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
                params = [
                    type, model, status, priority, planned_start, planned_end, actual_start,
                    actual_end, delay_hours, malfunction, mechanic_name, progress, id
                ];
            }

            db.run(query, params, function (err) {
                if (err) {
                    console.error('Error updating equipment:', err);
                    return res.status(500).json({ message: 'Ошибка обновления оборудования' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ message: 'Оборудование не найдено' });
                }

                // Получаем обновленные данные
                db.get('SELECT * FROM equipment WHERE id = ?', [id], (err, updatedEquipment) => {
                    if (err) {
                        return res.status(500).json({ message: 'Ошибка получения обновленных данных' });
                    }

                    // Добавляем section если его нет в БД
                    if (!hasSection) {
                        updatedEquipment.section = updatedEquipment.type === 'excavator' ? 'гусеничные техники' : 'колесные техники';
                    }

                    res.json({
                        message: 'Оборудование обновлено успешно',
                        equipment: updatedEquipment
                    });
                });
            });
        });
    });
});

// Создание нового оборудования (только для админов) - безопасное создание
router.post('/', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    const db = getDatabase();
    const {
        id,
        type,
        model,
        section = 'колесные техники',
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

    checkSectionColumn((err, hasSection) => {
        if (err) {
            console.error('Error checking section column:', err);
            return res.status(500).json({ message: 'Ошибка проверки структуры БД' });
        }

        let query, params;
        if (hasSection) {
            query = `
                INSERT INTO equipment 
                (id, type, model, section, status, priority, planned_start, planned_end, 
                 malfunction, mechanic_name, progress) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            params = [id, type, model, section, status, priority, planned_start, planned_end,
                malfunction, mechanic_name, progress];
        } else {
            query = `
                INSERT INTO equipment 
                (id, type, model, status, priority, planned_start, planned_end, 
                 malfunction, mechanic_name, progress) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            params = [id, type, model, status, priority, planned_start, planned_end,
                malfunction, mechanic_name, progress];
        }

        db.run(query, params, function (err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                    return res.status(409).json({
                        message: 'Оборудование с таким ID уже существует'
                    });
                }
                console.error('Error creating equipment:', err);
                return res.status(500).json({ message: 'Ошибка создания оборудования' });
            }

            res.status(201).json({
                message: 'Оборудование создано успешно',
                equipmentId: id
            });
        });
    });
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