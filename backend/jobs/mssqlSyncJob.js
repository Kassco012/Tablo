// backend/jobs/mssqlSyncJob.js - ОБНОВЛЕННАЯ ВЕРСИЯ

const JMineOpsDataService = require('../services/JMineOpsDataService');

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

    console.log('🚀 Запуск фоновой синхронизации с JMineOps');
    console.log(`⏱️ Интервал: ${SYNC_INTERVAL / 1000} секунд`);

    // Первая синхронизация сразу
    JMineOpsDataService.syncEquipment()
        .then(() => {
            console.log('✅ Первая синхронизация завершена');
        })
        .catch((err) => {
            console.error('❌ Ошибка первой синхронизации:', err);
        });

    // Повторяющаяся синхронизация каждые 30 секунд
    syncInterval = setInterval(async () => {
        try {
            await JMineOpsDataService.syncEquipment();
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