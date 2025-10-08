// backend/services/MSSQLSyncService.js - ОБНОВЛЕННАЯ ВЕРСИЯ

const { getPool } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');

// Маппинг типов техники из MSSQL
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
    'WaterTruck': {
        equipment_type: 'Поливочная машина',
        section: 'колесные техники'
    },
    'AuxE': {
        equipment_type: 'Вспомогательное оборудование',
        section: 'легкотоннажные техники'
    }
};

// РАСШИРЕННЫЙ маппинг статусов - все статусы простоя
const STATUS_MAPPING = {
    // Основные статусы
    331: 'Down',           // Простой (общий)
    332: 'Ready',          // Готова к работе
    333: 'Standby',        // Ожидание
    334: 'Delay',          // Задержка
    335: 'Shiftchange',    // Смена

    // Дополнительные статусы простоя из вашей системы
    336: 'Down',           // PM SERVICE (Плановое ТО)
    337: 'Down',           // WAIT PARTS (Ожидание запчастей)
    338: 'Down',           // ENGINE (Ремонт двигателя)
    339: 'Down',           // HYDRAULIC (Гидравлика)
    340: 'Down',           // ELECTRICAL (Электрика)
    341: 'Down',           // TRANSMISSION (Трансмиссия)
    342: 'Down',           // AIR CONDITIONING (Кондиционер)
    343: 'Down',           // GEAR BOX (Коробка передач)
    344: 'Down',           // GET/BUCKET/BLADE (Ковш/Отвал)
    345: 'Down',           // TIRES (Шины)
    346: 'Down',           // UNDERCARRIAGE (Ходовая часть)
    347: 'Down'            // OTHER (Другое)
};

// Маппинг причин простоя на участки (для более точной категоризации)
const REASON_TO_SECTION = {
    'PM SERVICE': 'капитальный ремонт',
    'WAIT PARTS': 'колесные техники',
    'ENGINE': 'капитальный ремонт',
    'HYDRAULIC': 'гусеничные техники',
    'ELECTRICAL': 'энергоучасток',
    'TRANSMISSION': 'капитальный ремонт',
    'GEAR BOX': 'капитальный ремонт',
    'TIRES': 'шиномонтажные работы',
    'UNDERCARRIAGE': 'гусеничные техники'
};

class MSSQLSyncService {
    constructor() {
        this.isRunning = false;
        this.lastSyncTime = null;
        this.syncErrors = [];
    }

    /**
     * Получить данные оборудования из MSSQL с расширенной информацией
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
                    e.reason_id,
                    e.updated_at,
                    
                    -- Статус
                    status_enum.name as status_name,
                    status_enum.symbol as status_symbol,
                    
                    -- Причина простоя
                    reason_enum.name as reason_name,
                    reason_enum.symbol as reason_symbol,
                    
                    -- Оператор (если есть)
                    op.name as operator_name,
                    
                    -- Часы работы двигателя
                    e.engine_hours
                    
                FROM dbo.equipment e
                
                -- Присоединяем статус
                LEFT JOIN dbo.enum_tables status_enum 
                    ON e.status_id = status_enum.id 
                    AND status_enum.type = 'Status'
                
                -- Присоединяем причину
                LEFT JOIN dbo.enum_tables reason_enum 
                    ON e.reason_id = reason_enum.id
                    AND reason_enum.type = 'Reason'
                
                -- Присоединяем оператора
                LEFT JOIN dbo.operators op
                    ON e.operator_id = op.id
                
                WHERE 
                    e.deleted_at IS NULL
                    AND e.type IN ('Shovel', 'Dozer', 'Drill', 'Truck', 'Grader', 'WaterTruck', 'AuxE')
                
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
     * Определить участок на основе типа и причины
     */
    determineSection(mssqlType, reasonName) {
        // Если есть специфическая причина - используем её
        if (reasonName && REASON_TO_SECTION[reasonName]) {
            return REASON_TO_SECTION[reasonName];
        }

        // Иначе используем базовый маппинг по типу
        const typeInfo = TYPE_MAPPING[mssqlType];
        return typeInfo ? typeInfo.section : 'колесные техники';
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

            const mssqlEquipment = await this.fetchEquipmentFromMSSQL();

            if (!mssqlEquipment || mssqlEquipment.length === 0) {
                console.log('⚠️ Нет данных из MSSQL для синхронизации');
                return;
            }

            const db = getDatabase();
            let updatedCount = 0;
            let createdCount = 0;
            let errorCount = 0;

            for (const equipment of mssqlEquipment) {
                try {
                    const equipmentId = equipment.equipment_name;
                    const mssqlType = equipment.mssql_type;
                    const statusId = equipment.status_id;
                    const reasonName = equipment.reason_name;

                    // Маппинг типа
                    const typeInfo = TYPE_MAPPING[mssqlType] || {
                        equipment_type: mssqlType,
                        section: 'колесные техники'
                    };

                    // Маппинг статуса
                    const status = STATUS_MAPPING[statusId] || 'Ready';

                    // Определяем участок с учетом причины простоя
                    const section = this.determineSection(mssqlType, reasonName);

                    // Формируем описание неисправности
                    let malfunction = '';
                    if (status === 'Down' && reasonName) {
                        malfunction = this.formatReason(reasonName);
                    }

                    const existingRecord = await this.checkEquipmentExists(db, equipmentId);

                    if (existingRecord) {
                        // ОБНОВЛЯЕМ
                        await this.updateEquipment(db, {
                            id: equipmentId,
                            mssql_equipment_id: equipment.mssql_equipment_id,
                            mssql_type: mssqlType,
                            mssql_status_id: statusId,
                            equipment_type: typeInfo.equipment_type,
                            section: section,
                            status: status,
                            malfunction: malfunction,
                            mechanic_name: equipment.operator_name || '',
                            mssql_reason: reasonName,
                            last_sync_time: new Date().toISOString()
                        });
                        updatedCount++;
                    } else {
                        // СОЗДАЕМ
                        await this.createEquipment(db, {
                            id: equipmentId,
                            mssql_equipment_id: equipment.mssql_equipment_id,
                            mssql_type: mssqlType,
                            mssql_status_id: statusId,
                            equipment_type: typeInfo.equipment_type,
                            model: '', // Заполнить вручную или из другой таблицы
                            section: section,
                            status: status,
                            priority: status === 'Down' ? 'high' : 'normal',
                            planned_start: '',
                            planned_end: '',
                            actual_start: '',
                            actual_end: '',
                            delay_hours: 0,
                            malfunction: malfunction,
                            mechanic_name: equipment.operator_name || '',
                            progress: status === 'Ready' ? 100 : 0,
                            mssql_reason: reasonName,
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
     * Форматировать причину простоя для отображения
     */
    formatReason(reason) {
        const reasonMap = {
            'PM SERVICE': 'Плановое техническое обслуживание',
            'WAIT PARTS': 'Ожидание запасных частей',
            'ENGINE': 'Ремонт двигателя',
            'HYDRAULIC': 'Ремонт гидравлической системы',
            'ELECTRICAL': 'Ремонт электрооборудования',
            'TRANSMISSION': 'Ремонт трансмиссии',
            'AIR CONDITIONING': 'Ремонт кондиционера',
            'GEAR BOX': 'Ремонт коробки передач',
            'GET/BUCKET/BLADE': 'Ремонт рабочего оборудования (ковш/отвал)',
            'TIRES': 'Замена/ремонт шин',
            'UNDERCARRIAGE': 'Ремонт ходовой части'
        };
        return reasonMap[reason] || reason;
    }

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
                    malfunction = ?,
                    mechanic_name = ?,
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
                    data.malfunction,
                    data.mechanic_name,
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

    getStatus() {
        return {
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            recentErrors: this.syncErrors.slice(-5)
        };
    }
}

module.exports = new MSSQLSyncService();