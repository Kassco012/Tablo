// backend/services/MSSQLSyncService.js

const { getPool } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');

// Маппинг типов техники из MSSQL в ваш формат
const TYPE_MAPPING = {
    'Shovel': {
        equipment_type: 'Экскаватор',
        section: 'гусеничные техники'
    },
    'Dozer': {
        equipment_type: 'Бульдозер',
        section: 'колесные техники'
    },
    'Drill': {
        equipment_type: 'Буровая установка',
        section: 'легкотоннажные техники'
    },
    'Truck': {
        equipment_type: 'Грузовик',
        section: 'колесные техники'
    },
    'Grader': {
        equipment_type: 'Грейдер',
        section: 'колесные техники'
    },
    'AuxE': {
        equipment_type: 'Вспомогательное оборудование',
        section: 'легкотоннажные техники'
    }
};

// Маппинг статусов (ID → Название)
const STATUS_MAPPING = {
    331: 'Down',
    332: 'Ready',
    333: 'Standby',
    334: 'Delay',
    335: 'Shiftchange'
};

class MSSQLSyncService {
    constructor() {
        this.isRunning = false;
        this.lastSyncTime = null;
        this.syncErrors = [];
    }

    /**
     * Получить данные оборудования из MSSQL
     */
    async fetchEquipmentFromMSSQL() {
        try {
            const pool = await getPool();

            const query = `
                SELECT 
                    e.id as mssql_equipment_id,
                    e.name as equipment_name,
                    e.type as mssql_type,
                    e.status_id,
                    e.updated_at,
                    
                    -- Статус
                    status_enum.name as status_name,
                    status_enum.symbol as status_symbol,
                    
                    -- Причина (если есть)
                    reason_enum.name as reason_name
                    
                FROM dbo.equipment e
                
                -- Присоединяем статус
                LEFT JOIN dbo.enum_tables status_enum 
                    ON e.status_id = status_enum.id 
                    AND status_enum.type = 'Status'
                
                -- Присоединяем причину
                LEFT JOIN dbo.enum_tables reason_enum 
                    ON e.reason_id = reason_enum.id
                
                WHERE 
                    e.deleted_at IS NULL
                    AND e.type IN ('Shovel', 'Dozer', 'Drill', 'Truck', 'Grader', 'AuxE')
                
                ORDER BY e.name;
            `;

            const result = await pool.request().query(query);
            console.log(`📊 Получено ${result.recordset.length} записей из MSSQL`);

            return result.recordset;
        } catch (error) {
            console.error('❌ Ошибка получения данных из MSSQL:', error.message);
            this.syncErrors.push({
                time: new Date(),
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Синхронизировать данные из MSSQL в SQLite
     */
    async syncEquipment() {
        if (this.isRunning) {
            console.log('⚠️ Синхронизация уже выполняется, пропуск...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            console.log('\n🔄 Начало синхронизации с MSSQL...');

            // Получаем данные из MSSQL
            const mssqlEquipment = await this.fetchEquipmentFromMSSQL();

            if (!mssqlEquipment || mssqlEquipment.length === 0) {
                console.log('⚠️ Нет данных из MSSQL для синхронизации');
                return;
            }

            const db = getDatabase();
            let updatedCount = 0;
            let createdCount = 0;
            let errorCount = 0;

            // Обрабатываем каждую единицу оборудования
            for (const equipment of mssqlEquipment) {
                try {
                    const equipmentId = equipment.equipment_name; // EX207, DZ673
                    const mssqlType = equipment.mssql_type; // Shovel, Dozer
                    const statusId = equipment.status_id; // 331, 332, 333

                    // Маппинг типа
                    const typeInfo = TYPE_MAPPING[mssqlType] || {
                        equipment_type: mssqlType,
                        section: 'колесные техники'
                    };

                    // Маппинг статуса
                    const status = STATUS_MAPPING[statusId] || 'Ready';

                    // Проверяем существует ли запись
                    const existingRecord = await this.checkEquipmentExists(db, equipmentId);

                    if (existingRecord) {
                        // ОБНОВЛЯЕМ только статус и тип (НЕ трогаем модель, механика и т.д.)
                        await this.updateEquipment(db, {
                            id: equipmentId,
                            mssql_equipment_id: equipment.mssql_equipment_id,
                            mssql_type: mssqlType,
                            mssql_status_id: statusId,
                            equipment_type: typeInfo.equipment_type,
                            section: typeInfo.section,
                            status: status,
                            mssql_reason: equipment.reason_name,
                            last_sync_time: new Date().toISOString()
                        });
                        updatedCount++;
                    } else {
                        // СОЗДАЕМ новую запись
                        await this.createEquipment(db, {
                            id: equipmentId,
                            mssql_equipment_id: equipment.mssql_equipment_id,
                            mssql_type: mssqlType,
                            mssql_status_id: statusId,
                            equipment_type: typeInfo.equipment_type,
                            model: '', // Пустое - заполнить вручную
                            section: typeInfo.section,
                            status: status,
                            priority: 'normal',
                            planned_start: '',
                            planned_end: '',
                            actual_start: '',
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
     * Проверить существует ли оборудование в SQLite
     */
    async checkEquipmentExists(db, equipmentId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM equipment_master WHERE id = ?',
                [equipmentId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    /**
     * Обновить существующее оборудование (ТОЛЬКО статус и тип)
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
                    section = ?,
                    status = ?,
                    mssql_reason = ?,
                    last_sync_time = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                AND manually_edited = 0
            `;

            db.run(
                query,
                [
                    data.mssql_equipment_id,
                    data.mssql_type,
                    data.mssql_status_id,
                    data.equipment_type,
                    data.section,
                    data.status,
                    data.mssql_reason,
                    data.last_sync_time,
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
                    data.id,
                    data.mssql_equipment_id,
                    data.mssql_type,
                    data.mssql_status_id,
                    data.equipment_type,
                    data.model,
                    data.section,
                    data.status,
                    data.priority,
                    data.planned_start,
                    data.planned_end,
                    data.actual_start,
                    data.actual_end,
                    data.delay_hours,
                    data.malfunction,
                    data.mechanic_name,
                    data.progress,
                    data.mssql_reason,
                    data.last_sync_time,
                    data.is_active,
                    data.manually_edited
                ],
                function (err) {
                    if (err) {
                        console.error(`❌ Ошибка создания ${data.id}:`, err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Создано новое оборудование: ${data.id}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    /**
     * Получить статус синхронизации
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            recentErrors: this.syncErrors.slice(-5) // Последние 5 ошибок
        };
    }
}

module.exports = new MSSQLSyncService();