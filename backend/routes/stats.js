// backend/routes/stats.js - API ДЛЯ СТАТИСТИКИ

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

/**
 * ✅ Получить количество техники, ставшей Ready сегодня
 * GET /api/stats/ready-today
 */
router.get('/ready-today', (req, res) => {
    const db = getDatabase();

    // Начало и конец сегодняшнего дня
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
        FROM equipment_status_history
        WHERE 
            new_status = 'Ready'
            AND changed_at >= ?
            AND changed_at < ?
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
 * ✅ Получить количество техники, ставшей Ready за определенную дату
 * GET /api/stats/ready-by-date?date=2025-10-21
 */
router.get('/ready-by-date', (req, res) => {
    const db = getDatabase();
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Параметр date обязателен' });
    }

    // Начало и конец указанного дня
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
        FROM equipment_status_history
        WHERE 
            new_status = 'Ready'
            AND changed_at >= ?
            AND changed_at < ?
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
 * ✅ Получить детальную историю изменений статусов за сегодня
 * GET /api/stats/status-changes-today
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
        FROM equipment_status_history h
        LEFT JOIN equipment_master e ON h.equipment_id = e.id
        WHERE 
            h.changed_at >= ?
            AND h.changed_at < ?
        ORDER BY h.changed_at DESC
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
 * ✅ Получить статистику по часам за сегодня
 * GET /api/stats/ready-by-hour
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
            strftime('%H', changed_at) as hour,
            COUNT(DISTINCT equipment_id) as count
        FROM equipment_status_history
        WHERE 
            new_status = 'Ready'
            AND changed_at >= ?
            AND changed_at < ?
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