// backend/routes/equipment.js - ОБНОВЛЕННАЯ версия с equipment_master

const express = require('express');
const { getDatabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const MSSQLSyncService = require('../services/MSSQLSyncService');
const db = require('../config/database');

const router = express.Router();

// Получение всего оборудования из equipment_master
router.get('/', (req, res) => {
    const db = getDatabase();
    const { section, status, type } = req.query;

    let query = 'SELECT * FROM equipment_master WHERE is_active = 1';
    const params = [];

    // Фильтр по статусу
    if (status) {
        query += ' status = ?';
        params.push(status);
    }

    // Фильтр по типу
    if (type) {
        query += ' AND equipment_type = ?';
        params.push(type);
    }

    query += ' ORDER BY section, priority DESC, id';

    db.all(query, params, (err, equipment) => {
        if (err) {
            console.error('Error fetching equipment:', err);
            return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
        }

        res.json(equipment);
    });
});

// Получение статистики
router.get('/stats', (req, res) => {
    const db = getDatabase();

    const query = `
        SELECT 
            status,
            COUNT(*) as count
        FROM equipment_master 
        WHERE is_active = 1
        GROUP BY status, section
    `;

    db.all(query, [], (err, stats) => {
        if (err) {
            console.error('Error fetching stats:', err);
            return res.status(500).json({ message: 'Ошибка получения статистики' });
        }

        const result = {
            down: 0,
            ready: 0,
            delay: 0,
            standby: 0,
            shiftchange: 0,
            total: 0,
            by_section: {}
        };

        stats.forEach(stat => {
            const statusKey = stat.status.toLowerCase();
            result[statusKey] = (result[statusKey] || 0) + stat.count;
            result.total += stat.count;

            if (!result.by_section[stat.section]) {
                result.by_section[stat.section] = {
                    down: 0,
                    ready: 0,
                    delay: 0,
                    standby: 0,
                    shiftchange: 0,
                    total: 0
                };
            }

            result.by_section[stat.section][statusKey] = stat.count;
            result.by_section[stat.section].total += stat.count;
        });

        res.json(result);
    });
});

// Получение конкретного оборудования
router.get('/:id', (req, res) => {
    const db = getDatabase();
    const { id } = req.params;

    db.get('SELECT * FROM equipment_master WHERE id = ? AND is_active = 1', [id], (err, equipment) => {
        if (err) {
            console.error('Error fetching equipment:', err);
            return res.status(500).json({ message: 'Ошибка получения данных оборудования' });
        }

        if (!equipment) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        res.json(equipment);
    });
});

// Обновление оборудования (требует авторизации)
router.put('/:id', authenticateToken, (req, res) => {
    const db = getDatabase();
    const { id } = req.params;
    const {
        model,
        status,
        planned_hours,
        actual_start,
        actual_end,
        delay_hours,
        malfunction,
        mechanic_name
    } = req.body;

    // Проверяем права доступа
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'programmer' ) {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    // Получаем старые данные
    db.get('SELECT * FROM equipment_master WHERE id = ?', [id], (err, oldData) => {
        if (err) {
            return res.status(500).json({ message: 'Ошибка получения данных' });
        }

        if (!oldData) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Обновляем данные
        const query = `
            UPDATE equipment_master 
            SET 
                model = COALESCE(?, model),
                status = COALESCE(?, status),
                planned_hours = COALESCE(?, planned_hours),
                actual_start = COALESCE(?, actual_start),
                actual_end = COALESCE(?, actual_end),
                delay_hours = COALESCE(?, delay_hours),
                malfunction = COALESCE(?, malfunction),
                mechanic_name = COALESCE(?, mechanic_name),
                manually_edited = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        db.run(
            query,
            [
                model, status,
                planned_hours, actual_start, actual_end,
                delay_hours, malfunction, mechanic_name, id
            ],
            function (err) {
                if (err) {
                    console.error('Error updating equipment:', err);
                    return res.status(500).json({ message: 'Ошибка обновления оборудования' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ message: 'Оборудование не найдено' });
                }

                // Получаем обновленные данные
                db.get('SELECT * FROM equipment_master WHERE id = ?', [id], (err, updatedEquipment) => {
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

// Принудительная синхронизация с MSSQL
router.post('/sync', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'programmer' ) {
        return res.status(403).json({ message: 'Недостаточно прав доступа' });
    }

    try {
        await MSSQLSyncService.syncEquipment();
        res.json({
            message: 'Синхронизация запущена',
            status: MSSQLSyncService.getStatus()
        });
    } catch (error) {
        res.status(500).json({
            message: 'Ошибка синхронизации',
            error: error.message
        });
    }
});

// Статус синхронизации
router.get('/sync/status', authenticateToken, (req, res) => {
    res.json(MSSQLSyncService.getStatus());
});

module.exports = router;