// backend/routes/stats.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/stats/ready-today
 * Возвращает количество техники, отремонтированной и запущенной СЕГОДНЯ
 */
router.get('/ready-today', async (req, res) => {
    try {
        // Получаем начало сегодняшнего дня в формате SQLite
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartStr = todayStart.toISOString();

        console.log(`📊 Запрос READY TODAY с ${todayStartStr}`);

        // Считаем записи в архиве, созданные сегодня
        const query = `
            SELECT COUNT(*) as count
            FROM equipment_archive
            WHERE completed_date >= ?
        `;

        const result = await db.get(query, [todayStartStr]);
        const readyCount = result?.count || 0;

        console.log(`✅ READY сегодня: ${readyCount}`);

        res.json({
            success: true,
            ready_today: readyCount,
            date: todayStart.toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Ошибка получения READY TODAY:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            ready_today: 0
        });
    }
});

/**
 * GET /api/stats/dashboard
 * Возвращает все статистики для dashboard (DOWN + READY TODAY)
 */
router.get('/dashboard', async (req, res) => {
    try {
        // Начало сегодняшнего дня
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartStr = todayStart.toISOString();

        // DOWN - текущие активные простои
        const downQuery = `
            SELECT COUNT(*) as count
            FROM equipment_master
            WHERE status = 'Down' AND is_active = 1
        `;
        const downResult = await db.get(downQuery);
        const downCount = downResult?.count || 0;

        // READY TODAY - из архива за сегодня
        const readyQuery = `
            SELECT COUNT(*) as count
            FROM equipment_archive
            WHERE completed_date >= ?
        `;
        const readyResult = await db.get(readyQuery, [todayStartStr]);
        const readyToday = readyResult?.count || 0;

        // Всего активной техники
        const totalQuery = `
            SELECT COUNT(*) as count
            FROM equipment_master
            WHERE is_active = 1
        `;
        const totalResult = await db.get(totalQuery);
        const totalCount = totalResult?.count || 0;

        console.log(`📊 Dashboard stats: DOWN=${downCount}, READY TODAY=${readyToday}, TOTAL=${totalCount}`);

        res.json({
            success: true,
            stats: {
                down: downCount,
                ready_today: readyToday,
                total: totalCount
            },
            date: todayStart.toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Ошибка получения dashboard stats:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stats: {
                down: 0,
                ready_today: 0,
                total: 0
            }
        });
    }
});

module.exports = router;