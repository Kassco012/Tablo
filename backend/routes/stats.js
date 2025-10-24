// backend/routes/stats.js - ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

/**
 * Получить текущую дату в формате YYYY-MM-DD (Астана)
 */
function getTodayDateString() {
    const now = new Date();
    // Преобразуем в время Астаны
    const almatyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Almaty' }));

    const year = almatyTime.getFullYear();
    const month = String(almatyTime.getMonth() + 1).padStart(2, '0');
    const day = String(almatyTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * ✅ GET /api/stats/dashboard
 */
router.get('/dashboard', (req, res) => {
    const db = getDatabase();

    // DOWN
    db.get(
        'SELECT COUNT(*) as count FROM equipment_master WHERE status = "Down" AND is_active = 1',
        [],
        (err, downResult) => {
            if (err) {
                console.error('❌ Ошибка подсчета DOWN:', err.message);
                return res.status(500).json({ success: false, error: 'Ошибка получения статистики' });
            }

            const downCount = downResult?.count || 0;
            const todayISO = getTodayDateString(); // "2025-10-24"

            console.log(`🕐 Текущая дата (Астана): ${todayISO}`);

            // READY TODAY из equipment_master (actual_end сегодня)
            const todayDDMMYYYY = todayISO.split('-').reverse().join('.'); // "24.10.2025"
            const tomorrowDate = new Date(todayISO);
            tomorrowDate.setDate(tomorrowDate.getDate() + 1);
            const tomorrowDDMMYYYY = tomorrowDate.toISOString().split('T')[0].split('-').reverse().join('.');

            db.get(
                `SELECT COUNT(*) as count
                 FROM equipment_master
                 WHERE actual_end IS NOT NULL
                 AND actual_end >= ?
                 AND actual_end < ?`,
                [todayDDMMYYYY, tomorrowDDMMYYYY],
                (err, activeResult) => {
                    if (err) {
                        console.error('❌ Ошибка подсчета active Ready:', err.message);
                        return res.status(500).json({ success: false, error: 'Ошибка получения статистики' });
                    }

                    const activeCount = activeResult?.count || 0;
                    console.log(`   📊 Active Ready сегодня: ${activeCount}`);

                    // READY TODAY из архива (запущенные сегодня)
                    db.get(
                        `SELECT COUNT(*) as count
                         FROM equipment_archive
                         WHERE SUBSTR(completed_date, 1, 10) = ?
                         AND archive_reason = 'launched'`,
                        [todayISO],
                        (err, archiveResult) => {
                            if (err) {
                                console.error('❌ Ошибка подсчета archived Ready:', err.message);
                                return res.status(500).json({ success: false, error: 'Ошибка получения статистики' });
                            }

                            const archivedCount = archiveResult?.count || 0;
                            const totalReadyToday = activeCount + archivedCount;

                            console.log(`   📦 Archived (launched) сегодня: ${archivedCount}`);
                            console.log(`📊 Dashboard Stats: DOWN=${downCount}, READY_TODAY=${totalReadyToday} (${activeCount} active + ${archivedCount} launched)\n`);

                            res.json({
                                success: true,
                                stats: {
                                    down: downCount,
                                    ready_today: totalReadyToday,
                                    total: downCount + totalReadyToday
                                }
                            });
                        }
                    );
                }
            );
        }
    );
});

/**
 * ✅ GET /api/stats/ready-today
 */
router.get('/ready-today', (req, res) => {
    const db = getDatabase();
    const todayISO = getTodayDateString();

    const todayDDMMYYYY = todayISO.split('-').reverse().join('.');
    const tomorrowDate = new Date(todayISO);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDDMMYYYY = tomorrowDate.toISOString().split('T')[0].split('-').reverse().join('.');

    const query = `
        SELECT 
            id,
            'active' as source
        FROM equipment_master
        WHERE actual_end IS NOT NULL
        AND actual_end >= ?
        AND actual_end < ?
        
        UNION ALL
        
        SELECT 
            id,
            'archived' as source
        FROM equipment_archive
        WHERE SUBSTR(completed_date, 1, 10) = ?
        AND archive_reason = 'launched'
    `;

    db.all(query, [todayDDMMYYYY, tomorrowDDMMYYYY, todayISO], (err, results) => {
        if (err) {
            console.error('❌ Ошибка подсчета Ready сегодня:', err.message);
            return res.status(500).json({ error: 'Ошибка получения статистики' });
        }

        const equipmentIds = results.map(r => r.id);

        res.json({
            count: results.length,
            date: todayISO,
            equipment_ids: equipmentIds,
            details: results
        });
    });
});

/**
 * ✅ GET /api/stats/ready-by-date?date=2025-10-21
 */
router.get('/ready-by-date', (req, res) => {
    const db = getDatabase();
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Параметр date обязателен' });
    }

    const [year, month, day] = date.split('-');
    const startDateStr = `${day}.${month}.${year}`;

    const nextDay = new Date(year, month - 1, Number(day) + 1);
    const endDateStr = `${String(nextDay.getDate()).padStart(2, '0')}.${String(nextDay.getMonth() + 1).padStart(2, '0')}.${nextDay.getFullYear()}`;

    const query = `
        SELECT 
            id,
            'active' as source
        FROM equipment_master
        WHERE actual_end IS NOT NULL
        AND actual_end >= ?
        AND actual_end < ?
        
        UNION ALL
        
        SELECT 
            id,
            'archived' as source
        FROM equipment_archive
        WHERE SUBSTR(completed_date, 1, 10) = ?
        AND archive_reason = 'launched'
    `;

    db.all(query, [startDateStr, endDateStr, date], (err, results) => {
        if (err) {
            console.error('❌ Ошибка подсчета Ready по дате:', err.message);
            return res.status(500).json({ error: 'Ошибка получения статистики' });
        }

        const equipmentIds = results.map(r => r.id);

        res.json({
            count: results.length,
            date: date,
            equipment_ids: equipmentIds,
            details: results
        });
    });
});

/**
 * ✅ GET /api/stats/status-changes-today
 */
router.get('/status-changes-today', (req, res) => {
    const db = getDatabase();
    const todayISO = getTodayDateString();

    const todayDDMMYYYY = todayISO.split('-').reverse().join('.');
    const tomorrowDate = new Date(todayISO);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDDMMYYYY = tomorrowDate.toISOString().split('T')[0].split('-').reverse().join('.');

    const query = `
        SELECT 
            id,
            equipment_type,
            model,
            status,
            actual_start,
            actual_end,
            malfunction,
            mechanic_name,
            'active' as source
        FROM equipment_master
        WHERE actual_end IS NOT NULL
        AND actual_end >= ?
        AND actual_end < ?
        
        UNION ALL
        
        SELECT 
            id,
            equipment_type,
            model,
            status,
            actual_start,
            actual_end,
            malfunction,
            mechanic_name,
            'archived' as source
        FROM equipment_archive
        WHERE SUBSTR(completed_date, 1, 10) = ?
        AND archive_reason = 'launched'
        
        ORDER BY actual_end DESC
    `;

    db.all(query, [todayDDMMYYYY, tomorrowDDMMYYYY, todayISO], (err, rows) => {
        if (err) {
            console.error('❌ Ошибка получения информации:', err.message);
            return res.status(500).json({ error: 'Ошибка получения информации' });
        }

        res.json({
            date: todayISO,
            changes: rows
        });
    });
});

/**
 * ✅ GET /api/stats/ready-by-hour
 */
router.get('/ready-by-hour', (req, res) => {
    const db = getDatabase();
    const todayISO = getTodayDateString();

    const todayDDMMYYYY = todayISO.split('-').reverse().join('.');
    const tomorrowDate = new Date(todayISO);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDDMMYYYY = tomorrowDate.toISOString().split('T')[0].split('-').reverse().join('.');

    const query = `
        SELECT 
            hour,
            SUM(count) as count
        FROM (
            SELECT 
                SUBSTR(actual_end, 12, 2) as hour,
                COUNT(*) as count
            FROM equipment_master
            WHERE actual_end IS NOT NULL
            AND actual_end >= ?
            AND actual_end < ?
            GROUP BY hour
            
            UNION ALL
            
            SELECT 
                SUBSTR(completed_date, 12, 2) as hour,
                COUNT(*) as count
            FROM equipment_archive
            WHERE SUBSTR(completed_date, 1, 10) = ?
            AND archive_reason = 'launched'
            GROUP BY hour
        )
        GROUP BY hour
        ORDER BY hour
    `;

    db.all(query, [todayDDMMYYYY, tomorrowDDMMYYYY, todayISO], (err, rows) => {
        if (err) {
            console.error('❌ Ошибка получения статистики по часам:', err.message);
            return res.status(500).json({ error: 'Ошибка получения статистики' });
        }

        res.json({
            date: todayISO,
            by_hour: rows
        });
    });
});

module.exports = router;