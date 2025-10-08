const { getPool, sql } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');

class JMineOpsDataService {
    constructor() {
        this.lastSyncTime = null;
        this.syncInProgress = false;
        this.syncStats = {
            total: 0,
            updated: 0,
            archived: 0,
            errors: 0,
            lastError: null
        };
    }

    /**
     * Основной метод синхронизации
     */
    async syncEquipment() {
        if (this.syncInProgress) {
            console.log('⏳ Синхронизация уже выполняется, пропускаем...');
            return;
        }

        this.syncInProgress = true;
        const startTime = Date.now();

        try {
            console.log('🔄 Начало синхронизации с JMineOps...');

            // 1. Получаем данные из MSSQL
            const mssqlData = await this.fetchFromMSSQL();
            console.log(`📊 Получено записей из MSSQL: ${mssqlData.length}`);

            // 2. Обновляем SQLite и архивируем Ready
            const result = await this.updateSQLite(mssqlData);

            // 3. Обновляем статистику
            this.syncStats.total = mssqlData.length;
            this.syncStats.updated = result.updated;
            this.syncStats.archived = result.archived;
            this.lastSyncTime = new Date().toISOString();

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Синхронизация завершена за ${duration}с`);
            console.log(`   - Обработано: ${mssqlData.length}`);
            console.log(`   - Обновлено: ${result.updated}`);
            console.log(`   - Архивировано (Ready): ${result.archived}`);

        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            this.syncStats.errors++;
            this.syncStats.lastError = error.message;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Получение данных из MSSQL
     */
    async fetchFromMSSQL() {
        try {
            const pool = await getPool();

            const query = `
                SELECT 
                    ss.id,
                    ss.equipment_id,
                    ss.status_id,
                    ss.reason_id,
                    ss.time,
                    ss.time_end,
                    ss.comment,
                    ss.work_order,
                    ss.work_scheduled,
                    ss.work_completed,
                    ss.estimated_return,
                    r.descrip as reason_descrip,
                    r.string_code as reason_code
                FROM dbo.shift_states ss
                LEFT JOIN dbo.reasons r ON ss.reason_id = r.id
                WHERE ss.deleted_at IS NULL 
                  AND ss.time_end IS NULL
                ORDER BY ss.time DESC
            `;

            const result = await pool.request().query(query);
            return result.recordset;

        } catch (error) {
            console.error('❌ Ошибка запроса к MSSQL:', error.message);
            throw error;
        }
    }

    /**
     * Обновление данных в SQLite + автоархивация Ready
     */
    async updateSQLite(mssqlData) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            let updated = 0;
            let archived = 0;

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // 1. Получаем старые данные для отслеживания изменений
                db.all('SELECT id, status FROM equipment_master WHERE is_active = 1', [], (err, oldRecords) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    const oldStatusMap = {};
                    oldRecords.forEach(r => {
                        oldStatusMap[r.id] = r.status;
                    });

                    const stmt = db.prepare(`
                        INSERT INTO equipment_master (
                            id, 
                            section, 
                            equipment_type, 
                            model,
                            status,
                            malfunction,
                            planned_start,
                            planned_end,
                            mssql_equipment_id,
                            mssql_status_id,
                            mssql_reason,
                            last_sync_time,
                            is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
                        ON CONFLICT(id) DO UPDATE SET
                            status = CASE 
                                WHEN manually_edited = 1 THEN status 
                                ELSE excluded.status 
                            END,
                            malfunction = CASE 
                                WHEN manually_edited = 1 THEN malfunction 
                                ELSE excluded.malfunction 
                            END,
                            planned_start = excluded.planned_start,
                            planned_end = excluded.planned_end,
                            mssql_equipment_id = excluded.mssql_equipment_id,
                            mssql_status_id = excluded.mssql_status_id,
                            mssql_reason = excluded.mssql_reason,
                            last_sync_time = CURRENT_TIMESTAMP
                    `);

                    const toArchive = [];

                    mssqlData.forEach(row => {
                        try {
                            const equipmentId = `EQ-${row.equipment_id}`;
                            const status = this.mapStatus(row.reason_code);
                            const oldStatus = oldStatusMap[equipmentId];

                            // Проверяем переход Down → Ready
                            if (oldStatus === 'Down' && status === 'Ready') {
                                toArchive.push(equipmentId);
                                console.log(`🎯 Обнаружен переход Down→Ready: ${equipmentId}`);
                            }

                            // Только Down записи идут в таблицу
                            if (status === 'Down') {
                                stmt.run([
                                    equipmentId,
                                    'колесные техники', // По умолчанию
                                    'Equipment',
                                    `Equipment ${row.equipment_id}`,
                                    status,
                                    row.reason_descrip || row.comment || '',
                                    row.time ? new Date(row.time).toISOString() : null,
                                    row.estimated_return ? new Date(row.estimated_return).toISOString() : null,
                                    row.equipment_id,
                                    row.status_id,
                                    row.reason_descrip
                                ], function (err) {
                                    if (err) {
                                        console.error(`❌ Ошибка обновления ${equipmentId}:`, err.message);
                                    } else {
                                        updated++;
                                    }
                                });
                            }

                        } catch (error) {
                            console.error('❌ Ошибка обработки записи:', error.message);
                        }
                    });

                    stmt.finalize((err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        // 2. Архивируем Ready записи
                        if (toArchive.length > 0) {
                            this.archiveReadyEquipment(db, toArchive, (archErr, archCount) => {
                                if (archErr) {
                                    console.error('⚠️ Ошибка архивации:', archErr);
                                } else {
                                    archived = archCount;
                                }

                                db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        return reject(commitErr);
                                    }
                                    resolve({ updated, archived });
                                });
                            });
                        } else {
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    return reject(commitErr);
                                }
                                resolve({ updated, archived });
                            });
                        }
                    });
                });
            });
        });
    }

    /**
     * Архивация техники при переходе в Ready
     */
    archiveReadyEquipment(db, equipmentIds, callback) {
        let archived = 0;
        let processed = 0;

        equipmentIds.forEach(equipmentId => {
            db.get('SELECT * FROM equipment_master WHERE id = ? AND is_active = 1', [equipmentId], (err, equipment) => {
                if (err || !equipment) {
                    processed++;
                    if (processed === equipmentIds.length) {
                        callback(null, archived);
                    }
                    return;
                }

                // Вставляем в архив
                db.run(`
                    INSERT INTO equipment_archive 
                    (id, section, equipment_type, model, status, priority, 
                     planned_start, planned_end, malfunction, mechanic_name, 
                     progress, created_at, updated_at, archive_reason) 
                    VALUES (?, ?, ?, ?, 'Ready', 'normal', ?, ?, ?, ?, 100, ?, CURRENT_TIMESTAMP, 'auto_ready')
                `, [
                    equipment.id,
                    equipment.section,
                    equipment.equipment_type,
                    equipment.model,
                    equipment.planned_start,
                    equipment.planned_end,
                    equipment.malfunction,
                    equipment.mechanic_name,
                    equipment.created_at
                ], function (archErr) {
                    if (!archErr) {
                        // Помечаем как неактивное
                        db.run('UPDATE equipment_master SET is_active = 0 WHERE id = ?', [equipmentId], () => {
                            archived++;
                            processed++;
                            if (processed === equipmentIds.length) {
                                callback(null, archived);
                            }
                        });
                    } else {
                        processed++;
                        if (processed === equipmentIds.length) {
                            callback(null, archived);
                        }
                    }
                });
            });
        });
    }

    /**
     * Маппинг статуса из reason_code
     */
    mapStatus(reasonCode) {
        if (!reasonCode) return 'Down';

        const code = reasonCode.toLowerCase();

        if (code === 'ready' || code === 'operation') {
            return 'Ready';
        }

        return 'Down'; // Все остальное = Down
    }

    /**
     * Получение статуса синхронизации
     */
    getStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            stats: this.syncStats
        };
    }
}

// Экспортируем синглтон
module.exports = new JMineOpsDataService();