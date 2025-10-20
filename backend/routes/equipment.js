// backend/routes/equipment.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ

const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const MSSQLSyncService = require('../services/MSSQLSyncService');
const db = require('../config/database');

const router = express.Router();

// ==========================================
// GET / - Получение всего оборудования
// ==========================================
router.get('/', (req, res) => {
    const database = getDatabase();
    const { status, type } = req.query;

    let query = 'SELECT * FROM equipment_master WHERE is_active = 1';
    const params = [];

    // Фильтр по статусу
    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    // Фильтр по типу
    if (type) {
        query += ' AND equipment_type = ?';
        params.push(type);
    }

    query += ' ORDER BY id';

    database.all(query, params, (err, equipment) => {
        if (err) {
            console.error('❌ Error fetching equipment:', err);
            return res.status(500).json({
                success: false,
                message: 'Ошибка получения данных оборудования'
            });
        }

        console.log(`✅ Найдено оборудования: ${equipment.length}`);
        res.json(equipment);
    });
});

// ==========================================
// GET /stats - Получение статистики
// ==========================================
router.get('/stats', (req, res) => {
    const database = getDatabase();

    const query = `
        SELECT 
            status,
            COUNT(*) as count
        FROM equipment_master 
        WHERE is_active = 1
        GROUP BY status
    `;

    database.all(query, [], (err, stats) => {
        if (err) {
            console.error('❌ Error fetching stats:', err);
            return res.status(500).json({
                success: false,
                message: 'Ошибка получения статистики'
            });
        }

        const result = {
            down: 0,
            ready: 0,
            delay: 0,
            standby: 0,
            shiftchange: 0,
            total: 0
        };

        stats.forEach(stat => {
            const status = stat.status?.toLowerCase();
            const count = stat.count || 0;

            if (status === 'down') result.down = count;
            else if (status === 'ready') result.ready = count;
            else if (status === 'delay') result.delay = count;
            else if (status === 'standby') result.standby = count;
            else if (status === 'shiftchange') result.shiftchange = count;

            result.total += count;
        });

        res.json(result);
    });
});

// ==========================================
// GET /:id - Получение конкретного оборудования
// ==========================================
router.get('/:id', (req, res) => {
    const database = getDatabase();
    const { id } = req.params;

    console.log(`📥 GET /api/equipment/${id}`);

    database.get(
        'SELECT * FROM equipment_master WHERE id = ? AND is_active = 1',
        [id],
        (err, equipment) => {
            if (err) {
                console.error('❌ Error fetching equipment:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка получения данных оборудования'
                });
            }

            if (!equipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Оборудование не найдено'
                });
            }

            res.json(equipment);
        }
    );
});

// ==========================================
// PUT /:id - Обновление оборудования
// ==========================================
router.put('/:id', authenticateToken, (req, res) => {
    const database = getDatabase();
    const { id } = req.params;
    const {
        equipment_type,
        model,
        status,
        planned_hours,
        malfunction,
        mechanic_name
    } = req.body;

    console.log('📥 PUT /api/equipment/' + id);
    console.log('📦 Полученные данные:', JSON.stringify(req.body, null, 2));

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'programmer') {
        console.log('❌ Недостаточно прав:', req.user.role);
        return res.status(403).json({
            success: false,
            message: 'Недостаточно прав доступа'
        });
    }

    // ✅ Преобразуем planned_hours в число
    const plannedHoursNumber = parseFloat(planned_hours) || 0;
    console.log('📊 Преобразовано planned_hours:', plannedHoursNumber);

    // Получаем старые данные для истории
    database.get('SELECT * FROM equipment_master WHERE id = ?', [id], (err, oldData) => {
        if (err) {
            console.error('❌ Ошибка получения старых данных:', err);
            return res.status(500).json({
                success: false,
                message: 'Ошибка получения данных',
                error: err.message
            });
        }

        if (!oldData) {
            console.log('❌ Оборудование не найдено:', id);
            return res.status(404).json({
                success: false,
                message: 'Оборудование не найдено'
            });
        }

        console.log('✅ Старые данные найдены:', oldData.id);

        // ✅ ПРОСТОЙ UPDATE без COALESCE
        const query = `
            UPDATE equipment_master 
            SET 
                equipment_type = ?,
                model = ?,
                status = ?,
                planned_hours = ?,
                malfunction = ?,
                mechanic_name = ?,
                manually_edited = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const params = [
            equipment_type || oldData.equipment_type,
            model || oldData.model,
            status || oldData.status,
            plannedHoursNumber,
            malfunction || '',
            mechanic_name || '',
            id
        ];

        console.log('🔄 Параметры обновления:', params);

        database.run(query, params, function (err) {
            if (err) {
                console.error('❌ Ошибка SQL UPDATE:', err);
                console.error('❌ SQL Query:', query);
                console.error('❌ SQL Params:', params);
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка обновления оборудования',
                    error: err.message
                });
            }

            console.log(`✅ Обновлено записей: ${this.changes}`);

            if (this.changes === 0) {
                console.log('⚠️ Ни одна запись не была обновлена');
                return res.status(404).json({
                    success: false,
                    message: 'Оборудование не найдено или не обновлено'
                });
            }

            // Получаем обновленные данные
            database.get('SELECT * FROM equipment_master WHERE id = ?', [id], (err, updatedEquipment) => {
                if (err) {
                    console.error('❌ Ошибка получения обновленных данных:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Ошибка получения обновленных данных',
                        error: err.message
                    });
                }

                console.log('✅ Обновленные данные получены:', updatedEquipment);

                // ✅ Записываем в историю
                const historyQuery = `
                    INSERT INTO equipment_history 
                    (equipment_id, user_id, action, old_value, new_value, timestamp)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `;

                database.run(
                    historyQuery,
                    [
                        id,
                        req.user.id,
                        'update',
                        JSON.stringify(oldData),
                        JSON.stringify(updatedEquipment)
                    ],
                    (historyErr) => {
                        if (historyErr) {
                            console.warn('⚠️ Ошибка записи истории:', historyErr);
                        } else {
                            console.log('✅ История обновлена');
                        }

                        // Отправляем успешный ответ
                        console.log('✅ Отправка успешного ответа');
                        res.json({
                            success: true,
                            message: 'Оборудование обновлено успешно',
                            equipment: updatedEquipment
                        });
                    }
                );
            });
        });
    });
});

// ==========================================
// GET /:id/history - История изменений
// ==========================================
router.get('/:id/history', authenticateToken, (req, res) => {
    const database = getDatabase();
    const { id } = req.params;

    console.log(`📥 GET /api/equipment/${id}/history`);

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

    database.all(query, [id], (err, history) => {
        if (err) {
            console.error('❌ Error fetching history:', err);
            return res.status(500).json({
                success: false,
                message: 'Ошибка получения истории',
                error: err.message
            });
        }

        console.log(`✅ Найдено записей истории: ${history.length}`);

        res.json(history);
    });
});

// ==========================================
// POST /sync - Принудительная синхронизация
// ==========================================
router.post('/sync', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'programmer') {
        return res.status(403).json({
            success: false,
            message: 'Недостаточно прав доступа'
        });
    }

    try {
        await MSSQLSyncService.syncEquipment();
        res.json({
            success: true,
            message: 'Синхронизация запущена',
            status: MSSQLSyncService.getStatus()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Ошибка синхронизации',
            error: error.message
        });
    }
});

// ==========================================
// GET /sync/status - Статус синхронизации
// ==========================================
router.get('/sync/status', authenticateToken, (req, res) => {
    res.json(MSSQLSyncService.getStatus());
});

module.exports = router;