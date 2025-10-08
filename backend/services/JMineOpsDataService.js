// backend/services/JMineOpsDataService.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ - использует shift_states и reasons

const { getPool } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');

// Маппинг типов техники
const TYPE_MAPPING = {
    'Shovel': { equipment_type: 'Экскаватор', section: 'гусеничные техники' },
    'Dozer': { equipment_type: 'Бульдозер', section: 'колесные техники' },
    'Drill': { equipment_type: 'Буровая установка', section: 'легкотоннажные техники' },
    'Truck': { equipment_type: 'Грузовик', section: 'колесные техники' },
    'Grader': { equipment_type: 'Грейдер', section: 'колесные техники' },
    'AuxE': { equipment_type: 'Вспомогательное оборудование', section: 'легкотоннажные техники' }
};

// Маппинг статусов (ID → Название)
const STATUS_MAPPING = {
    331: 'Down',
    332: 'Ready',
    333: 'Standby',
    334: 'Delay',
    335: 'Shiftchange'
};

class JMineOpsDataService {
    constructor() {
        this.isRunning = false;
        this.lastSyncTime = null;
        this.syncErrors = [];
    }

    /**
     * Получить данные о простоях из shift_states за СЕГОДНЯ
     */
    async fetchEquipmentFromJMineOps() {
        try {
            const pool = await getPool();

            // ИСПРАВЛЕННЫЙ ЗАПРОС - берем данные из shift_states за СЕГОДНЯ
            const query = `
                -- Получаем ПОСЛЕДНИЙ простой для каждой техники за СЕГОДНЯ
                WITH LastDowntime AS (
                    SELECT 
                        ss.equipment_id,
                        ss.status_id,
                        ss.reason_id,
                        ss.time,
                        ROW_NUMBER() OVER (
                            PARTITION BY ss.equipment_id 
                            ORDER BY ss.time DESC
                        ) as rn
                    FROM dbo.shift_states ss
                    WHERE 
                        ss.status_id = 331  -- Down
                        AND ss.time >= CAST(GETDATE() AS DATE)  -- с 00:00 сегодня
                        AND ss.time < DATEADD(day, 1, CAST(GETDATE() AS DATE))  -- до 23:59 сегодня
                )
                SELECT 
                    e.id as mssql_equipment_id,
                    e.name as equipment_name,
                    e.type as mssql_type,
                    
                    -- Модель из equipment_type
                    ISNULL(et.name, '') as equipment_model,
                    
                    ld.status_id,
                    
                    -- Статус
                    status_enum.name as status_name,
                    status_enum.symbol as status_symbol,
                    
                    -- ВАЖНО: Причина из таблицы reasons (НЕ enum_tables!)
                    r.descrip as reason_name,
                    
                    -- Точное время простоя из shift_states
                    ld.time as down_start_time,
                    
                    -- Дополнительно
                    e.department_id,
                    e.contractor_id

                FROM LastDowntime ld

                -- Связываем с equipment
                INNER JOIN dbo.equipment e 
                    ON ld.equipment_id = e.id

                -- Получаем название статуса
                LEFT JOIN dbo.enum_tables status_enum 
                    ON ld.status_id = status_enum.id 
                    AND status_enum.type = 'Status'

                -- ВАЖНО: Причина из dbo.reasons (а не enum_tables!)
                LEFT JOIN dbo.reasons r 
                    ON ld.reason_id = r.id

                -- Тип оборудования (для модели)
                LEFT JOIN dbo.enum_tables et
                    ON e.equipment_type_id = et.id

                WHERE 
                    ld.rn = 1  -- Только последняя запись для каждой техники
                    AND e.deleted_at IS NULL
                    AND e.enabled = 1
                    AND e.type IN ('Shovel', 'Dozer', 'Drill', 'Truck', 'Grader', 'AuxE')
                    
                ORDER BY ld.time DESC;
            `;

            console.log('🔍 Запрос данных из JMineOps за СЕГОДНЯ...');
            console.log('📅 Дата:', new Date().toLocaleDateString('ru-RU'));

            const result = await pool.request().query(query);

            console.log(`📊 Получено ${result.recordset.length} записей о простоях за сегодня`);

            return result.recordset;
        } catch (error) {
            console.error('❌ Ошибка получения данных из JMineOps:', error.message);
            this.syncErrors.push({
                time: new Date(),
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Синхронизировать данные из JMineOps в SQLite
     */
    async syncEquipment() {
        if (this.isRunning) {
            console.log('⚠️ Синхронизация уже выполняется, пропуск...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            console.log('\n🔄 Начало синхронизации с JMineOps...');
            console.log('📅 Загружаем данные о простоях за СЕГОДНЯ');

            // Получаем данные из JMineOps
            const jmineopsEquipment = await this.fetchEquipmentFromJMineOps();

            if (!jmineopsEquipment || jmineopsEquipment.length === 0) {
                console.log('✅ Нет простоев за сегодня (это нормально!)');

                // Очищаем старые записи из equipment_master
                await this.cleanupOldRecords();

                return;
            }

            const db = getDatabase();
            let updatedCount = 0;
            let createdCount = 0;
            let errorCount = 0;

            // Получаем список ID техники из shift_states
            const currentEquipmentIds = jmineopsEquipment.map(eq => eq.equipment_name);

            // Деактивируем записи которых нет в сегодняшней выборке
            await this.deactivateOldRecords(db, currentEquipmentIds);

            // Обрабатываем каждую единицу оборудования
            for (const equipment of jmineopsEquipment) {
                try {
                    await this.processEquipment(db, equipment);

                    const existing = await this.checkEquipmentExists(db, equipment.equipment_name);
                    if (existing) {
                        updatedCount++;
                    } else {
                        createdCount++;
                    }
                } catch (itemError) {
                    console.error(`❌ Ошибка обработки ${equipment.equipment_name}:`, itemError.message);
                    errorCount++;
                }
            }

            const duration = Date.now() - startTime;
            this.lastSyncTime = new Date();

            console.log('\n✅ Синхронизация завершена:');
            console.log(`   📥 Создано: ${createdCount}`);
            console.log(`   📝 Обновлено: ${updatedCount}`);
            console.log(`   ❌ Ошибок: ${errorCount}`);
            console.log(`   ⏱️ Время: ${duration}ms`);
            console.log(`   📅 Данные за: ${new Date().toLocaleDateString('ru-RU')}\n`);

        } catch (error) {
            console.error('💥 Критическая ошибка синхронизации:', error);
            this.syncErrors.push({
                time: new Date(),
                error: error.message
            });
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Обработать одну единицу оборудования
     */
    async processEquipment(db, equipment) {
        const equipmentId = equipment.equipment_name;
        const mssqlType = equipment.mssql_type;
        const statusId = equipment.status_id;

        // Маппинг типа
        const typeInfo = TYPE_MAPPING[mssqlType] || {
            equipment_type: mssqlType,
            section: 'колесные техники'
        };

        // Маппинг статуса
        const status = STATUS_MAPPING[statusId] || 'Down';

        // Время начала простоя из shift_states
        let actual_start = null;
        if (equipment.down_start_time) {
            actual_start = this.formatTime(equipment.down_start_time);
        }

        // Проверяем существует ли запись
        const existingRecord = await this.checkEquipmentExists(db, equipmentId);

        if (existingRecord) {
            // ОБНОВЛЯЕМ только если НЕ manually_edited
            if (existingRecord.manually_edited === 0) {
                await this.updateEquipment(db, {
                    id: equipmentId,
                    mssql_equipment_id: equipment.mssql_equipment_id,
                    mssql_type: mssqlType,
                    mssql_status_id: statusId,
                    equipment_type: typeInfo.equipment_type,
                    model: equipment.equipment_model || '',
                    section: typeInfo.section,
                    status: status,
                    malfunction: equipment.reason_name || '',
                    actual_start: actual_start,
                    mssql_reason: equipment.reason_name,
                    last_sync_time: new Date().toISOString(),
                    is_active: 1
                });
            } else {
                // Только обновляем статус и неисправность для ручно отредактированных
                await this.updateEquipmentMinimal(db, {
                    id: equipmentId,
                    status: status,
                    malfunction: equipment.reason_name || '',
                    last_sync_time: new Date().toISOString(),
                    is_active: 1
                });
            }
        } else {
            // СОЗДАЕМ новую запись
            await this.createEquipment(db, {
                id: equipmentId,
                mssql_equipment_id: equipment.mssql_equipment_id,
                mssql_type: mssqlType,
                mssql_status_id: statusId,
                equipment_type: typeInfo.equipment_type,
                model: equipment.equipment_model || '',
                section: typeInfo.section,
                status: status,
                priority: 'high', // Все простои - высокий приоритет
                planned_start: '',
                planned_end: '',
                actual_start: actual_start || '',
                actual_end: '',
                delay_hours: 0,
                malfunction: equipment.reason_name || '',
                mechanic_name: '',
                progress: 0,
                mssql_reason: equipment.reason_name,
                last_sync_time: new Date().toISOString(),
                is_active: 1,
                manually_edited: 0
            });
        }
    }

    /**
     * Деактивировать записи которых нет в текущей выборке
     */
    async deactivateOldRecords(db, currentEquipmentIds) {
        return new Promise((resolve, reject) => {
            if (currentEquipmentIds.length === 0) {
                // Если нет текущих простоев - деактивируем все
                const query = 'UPDATE equipment_master SET is_active = 0 WHERE is_active = 1';
                db.run(query, [], (err) => {
                    if (err) reject(err);
                    else {
                        console.log('   🔄 Деактивированы все записи (нет простоев сегодня)');
                        resolve();
                    }
                });
            } else {
                // Деактивируем только те которых нет в текущей выборке
                const placeholders = currentEquipmentIds.map(() => '?').join(',');
                const query = `
                    UPDATE equipment_master 
                    SET is_active = 0 
                    WHERE is_active = 1 
                      AND id NOT IN (${placeholders})
                `;
                db.run(query, currentEquipmentIds, function (err) {
                    if (err) reject(err);
                    else {
                        if (this.changes > 0) {
                            console.log(`   🔄 Деактивировано ${this.changes} старых записей`);
                        }
                        resolve();
                    }
                });
            }
        });
    }

    /**
     * Очистить старые записи (когда нет простоев)
     */
    async cleanupOldRecords() {
        const db = getDatabase();
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE equipment_master SET is_active = 0 WHERE is_active = 1',
                [],
                function (err) {
                    if (err) reject(err);
                    else {
                        if (this.changes > 0) {
                            console.log(`   🧹 Очищено ${this.changes} записей (нет простоев)`);
                        }
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Проверить существует ли оборудование
     */
    async checkEquipmentExists(db, equipmentId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM equipment_master WHERE id = ?',
                [equipmentId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    /**
     * Обновить оборудование (полное)
     */
    async updateEquipment(db, data) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE equipment_master 
                SET 
                    mssql_equipment_id = ?,
                    mssql_type = ?,
                    mssql_status_id = ?,
                    equipment_type = ?,
                    model = ?,
                    section = ?,
                    status = ?,
                    malfunction = ?,
                    actual_start = COALESCE(?, actual_start),
                    mssql_reason = ?,
                    last_sync_time = ?,
                    is_active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            db.run(
                query,
                [
                    data.mssql_equipment_id,
                    data.mssql_type,
                    data.mssql_status_id,
                    data.equipment_type,
                    data.model,
                    data.section,
                    data.status,
                    data.malfunction,
                    data.actual_start,
                    data.mssql_reason,
                    data.last_sync_time,
                    data.is_active,
                    data.id
                ],
                function (err) {
                    if (err) {
                        console.error(`❌ Ошибка обновления ${data.id}:`, err.message);
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    /**
     * Минимальное обновление (только статус и неисправность)
     */
    async updateEquipmentMinimal(db, data) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE equipment_master 
                SET 
                    status = ?,
                    malfunction = ?,
                    last_sync_time = ?,
                    is_active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            db.run(
                query,
                [data.status, data.malfunction, data.last_sync_time, data.is_active, data.id],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    /**
     * Создать новое оборудование
     */
    async createEquipment(db, data) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO equipment_master (
                    id, mssql_equipment_id, mssql_type, mssql_status_id,
                    equipment_type, model, section, status, priority,
                    planned_start, planned_end, actual_start, actual_end,
                    delay_hours, malfunction, mechanic_name, progress,
                    mssql_reason, last_sync_time, is_active, manually_edited
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(
                query,
                [
                    data.id, data.mssql_equipment_id, data.mssql_type, data.mssql_status_id,
                    data.equipment_type, data.model, data.section, data.status, data.priority,
                    data.planned_start, data.planned_end, data.actual_start, data.actual_end,
                    data.delay_hours, data.malfunction, data.mechanic_name, data.progress,
                    data.mssql_reason, data.last_sync_time, data.is_active, data.manually_edited
                ],
                function (err) {
                    if (err) {
                        console.error(`❌ Ошибка создания ${data.id}:`, err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Создан простой: ${data.id} (${data.status}) - ${data.malfunction || 'нет описания'}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    /**
     * Форматировать время из БД
     */
    formatTime(dateTime) {
        if (!dateTime) return null;

        const date = new Date(dateTime);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${hours}:${minutes}`;
    }

    /**
     * Получить статус синхронизации
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            currentDate: new Date().toLocaleDateString('ru-RU'),
            recentErrors: this.syncErrors.slice(-5)
        };
    }
}

module.exports = new JMineOpsDataService();