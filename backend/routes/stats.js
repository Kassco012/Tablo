// backend/routes/stats.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

/**
 * ✅ GET /api/stats/dashboard
 * Главная статистика для Dashboard:
 * - DOWN: текущее количество техники в простое
 * - READY_TODAY: количество техники, получившей статус Ready сегодня
 */
router.get('/dashboard', (req, res) => {
    const db = getDatabase();

    // ✅ 1. DOWN - текущее количество из equipment_master
    db.get(
        'SELECT COUNT(*) as count FROM equipment_master WHERE status = "Down" AND is_active = 1',
        [],
        (err, downResult) => {
            if (err) {
                console.error('❌ Ошибка подсчета DOWN:', err.message);
                return res.status(500).json({
                    success: false,
                    error: 'Ошибка получения статистики'
                });
            }

            const downCount = downResult?.count || 0;

            // ✅ 2. READY TODAY - из equipment_history
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowISO = tomorrow.toISOString();

            const query = `
                SELECT COUNT(DISTINCT equipment_id) as count
                FROM equipment_history
                WHERE action = 'update_status'
                AND new_value = 'Ready'
                AND timestamp >= ?
                AND timestamp < ?
            `;

            db.get(query, [todayISO, tomorrowISO], (err, readyResult) => {
                if (err) {
                    console.error('❌ Ошибка подсчета Ready сегодня:', err.message);
                    return res.status(500).json({
                        success: false,
                        error: 'Ошибка получения статистики'
                    });
                }

                const readyTodayCount = readyResult?.count || 0;

                console.log(`📊 Dashboard Stats: DOWN=${downCount}, READY_TODAY=${readyTodayCount}`);

                res.json({
                    success: true,
                    stats: {
                        down: downCount,
                        ready_today: readyTodayCount,
                        total: downCount + readyTodayCount
                    }
                });
            });
        }
    );
});

/**
 * ✅ GET /api/stats/ready-today
 * Получить количество техники, ставшей Ready сегодня
 */
router.get('/ready-today', (req, res) => {
    const db = getDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    const query = `
        SELECT 
            COUNT(DISTINCT equipment_id) as count,
            GROUP_CONCAT(DISTINCT equipment_id) as equipment_ids
        FROM equipment_history
        WHERE action = 'update_status'
        AND new_value = 'Ready'
        AND timestamp >= ?
        AND timestamp < ?
    `;

    db.get(query, [todayISO, tomorrowISO], (err, result) => {
        if (err) {
            console.error('❌ Ошибка подсчета Ready сегодня:', err.message);
            return res.status(500).json({ error: 'Ошибка получения статистики' });
        }

        const equipmentIds = result.equipment_ids
            ? result.equipment_ids.split(',')
            : [];

        res.json({
            count: result.count || 0,
            date: today.toISOString().split('T')[0],
            equipment_ids: equipmentIds
        });
    });
});

/**
 * ✅ GET /api/stats/ready-by-date?date=2025-10-21
 * Получить количество техники, ставшей Ready за определенную дату
 */
router.get('/ready-by-date', (req, res) => {
    const db = getDatabase();
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Параметр date обязателен' });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const startISO = startDate.toISOString();

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const endISO = endDate.toISOString();

    const query = `
        SELECT 
            COUNT(DISTINCT equipment_id) as count,
            GROUP_CONCAT(DISTINCT equipment_id) as equipment_ids
        FROM equipment_history
        WHERE action = 'update_status'
        AND new_value = 'Ready'
        AND timestamp >= ?
        AND timestamp < ?
    `;

    db.get(query, [startISO, endISO], (err, result) => {
        if (err) {
            console.error('❌ Ошибка подсчета Ready по дате:', err.message);
            return res.status(500).json({ error: 'Ошибка получения статистики' });
        }

        const equipmentIds = result.equipment_ids
            ? result.equipment_ids.split(',')
            : [];

        res.json({
            count: result.count || 0,
            date: date,
            equipment_ids: equipmentIds
        });
    });
});

/**
 * ✅ GET /api/stats/status-changes-today
 * Получить детальную историю изменений статусов за сегодня
 */
router.get('/status-changes-today', (req, res) => {
    const db = getDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    const query = `
        SELECT 
            h.*,
            e.equipment_type,
            e.model
        FROM equipment_history h
        LEFT JOIN equipment_master e ON h.equipment_id = e.id
        WHERE h.timestamp >= ?
        AND h.timestamp < ?
        ORDER BY h.timestamp DESC
    `;

    db.all(query, [todayISO, tomorrowISO], (err, rows) => {
        if (err) {
            console.error('❌ Ошибка получения истории:', err.message);
            return res.status(500).json({ error: 'Ошибка получения истории' });
        }

        res.json({
            date: today.toISOString().split('T')[0],
            changes: rows
        });
    });
});

/**
 * ✅ GET /api/stats/ready-by-hour
 * Получить статистику по часам за сегодня
 */
router.get('/ready-by-hour', (req, res) => {
    const db = getDatabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    const query = `
        SELECT 
            strftime('%H', timestamp) as hour,
            COUNT(DISTINCT equipment_id) as count
        FROM equipment_history
        WHERE action = 'update_status'
        AND new_value = 'Ready'
        AND timestamp >= ?
        AND timestamp < ?
        GROUP BY hour
        ORDER BY hour
    `;

    db.all(query, [todayISO, tomorrowISO], (err, rows) => {
        if (err) {
            console.error('❌ Ошибка получения статистики по часам:', err.message);
            return res.status(500).json({ error: 'Ошибка получения статистики' });
        }

        res.json({
            date: today.toISOString().split('T')[0],
            by_hour: rows
        });
    });
});

module.exports = router;