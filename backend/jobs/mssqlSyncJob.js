// backend/jobs/mssqlSyncJob.js

const MSSQLSyncService = require('../services/MSSQLSyncService');

const SYNC_INTERVAL = 30000; // 30 секунд

let syncInterval = null;

/**
 * Запустить фоновую синхронизацию
 */
function startSyncJob() {
    if (syncInterval) {
        console.log('⚠️ Синхронизация уже запущена');
        return;
    }

    console.log('🚀 Запуск фоновой синхронизации с MSSQL');
    console.log(`⏱️ Интервал: ${SYNC_INTERVAL / 1000} секунд`);

    // Первая синхронизация сразу
    MSSQLSyncService.syncEquipment()
        .then(() => {
            console.log('✅ Первая синхронизация завершена');
        })
        .catch((err) => {
            console.error('❌ Ошибка первой синхронизации:', err);
        });

    // Повторяющаяся синхронизация каждые 30 секунд
    syncInterval = setInterval(async () => {
        try {
            await MSSQLSyncService.syncEquipment();
        } catch (err) {
            console.error('❌ Ошибка синхронизации:', err);
        }
    }, SYNC_INTERVAL);

    console.log('✅ Фоновая синхронизация запущена');
}

/**
 * Остановить фоновую синхронизацию
 */
function stopSyncJob() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('🛑 Фоновая синхронизация остановлена');
    }
}

module.exports = {
    startSyncJob,
    stopSyncJob
};