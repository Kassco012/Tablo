// backend/services/MSSQLSyncService.js - ОБНОВЛЕННАЯ ВЕРСИЯ

const { getPool } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');

// Маппинг типов техники из MSSQL
const TYPE_MAPPING = {
    'Shovel': {
        equipment_type: 'Экскаватор'
    },
    'Dozer': {
        equipment_type: 'Бульдозер'
    },
    'Drill': {
        equipment_type: 'Буровой станок'
    },
    'Truck': {
        equipment_type: 'Самосвал'
    },
    'Grader': {
        equipment_type: 'Грейдер'
    },
    'WaterTruck': {
        equipment_type: 'Поливочная машина'
    },
    'AuxE': {
        equipment_type: 'Вспомогательное оборудование'
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



class MSSQLSyncService {
    constructor() {
        this.isRunning = false;
        this.lastSyncTime = null;
        this.syncErrors = [];
    }


    async fetchEquipmentFromMSSQL() {
        try {
            const pool = await getPool();

            const query = `
            -- Получаем ПОСЛЕДНИЙ простой для каждой техники за СЕГОДНЯ
            WITH LastDowntime AS (
                SELECT 
                    ss.equipment_id,
                    ss.status_id,
                    ss.reason_id,
                    ss.time as down_start_time,
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
                ld.down_start_time

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
                
            ORDER BY ld.down_start_time DESC;
        `;

            const result = await pool.request().query(query);
            console.log(`📊 Получено ${result.recordset.length} записей из MSSQL (простои за сегодня)`);

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



    async syncEquipment() {
        if (this.isRunning) {
            console.log('⚠️ Синхронизация уже выполняется, пропуск...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            console.log('\n🔄 Начало синхронизации с MSSQL (shift_states за сегодня)...');

            const mssqlEquipment = await this.fetchEquipmentFromMSSQL();

            if (!mssqlEquipment || mssqlEquipment.length === 0) {
                console.log('⚠️ Нет данных из MSSQL для синхронизации (возможно сегодня нет простоев)');
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

                    // ✅ ИСПРАВЛЕНО: Добавляем маппинг типа оборудования
                    const typeInfo = TYPE_MAPPING[mssqlType] || { equipment_type: 'Неизвестный тип' };

                    // Маппинг статуса
                    const status = STATUS_MAPPING[statusId] || 'Down';

                    // Формируем описание неисправности
                    let malfunction = '';
                    if (status === 'Down' && reasonName) {
                        malfunction = this.formatReason(reasonName);
                    }

                    // Время начала простоя из shift_states
                    const actual_start = equipment.down_start_time
                        ? new Date(equipment.down_start_time).toISOString().substring(11, 16)
                        : '';

                    const existingRecord = await this.checkEquipmentExists(db, equipmentId);

                    if (existingRecord) {
                        // ОБНОВЛЯЕМ (сохраняем ручные поля)
                        await this.updateEquipment(db, {
                            id: equipmentId,
                            mssql_equipment_id: equipment.mssql_equipment_id,
                            mssql_type: mssqlType,
                            mssql_status_id: statusId,
                            equipment_type: typeInfo.equipment_type,
                            model: equipment.equipment_model || '',
                            status: status,
                            malfunction: malfunction,
                            actual_start: actual_start,
                            mechanic_name: existingRecord.mechanic_name || '', // Сохраняем механика
                            planned_hours: existingRecord.planned_hours || 0, // ✅ ИСПРАВЛЕНО: было planned_start/planned_end
                            delay_hours: existingRecord.delay_hours || 0, // Сохраняем задержку
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
                            model: equipment.equipment_model || '',
                            status: status,
                            planned_hours: 0, // ✅ ИСПРАВЛЕНО: было пустая строка, теперь 0
                            actual_start: actual_start,
                            actual_end: '',
                            delay_hours: 0, // Ручной
                            malfunction: malfunction,
                            mechanic_name: '', // Ручной
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
            // ✅ ИСПРАВЛЕНО: SQL теперь совпадает с параметрами
            const query = `
            UPDATE equipment_master
            SET
                mssql_equipment_id = ?,
                mssql_type = ?,
                mssql_status_id = ?,
                equipment_type = ?,
                model = ?,
                status = ?,
                malfunction = ?,
                actual_start = ?,
                mechanic_name = ?,
                planned_hours = ?,
                delay_hours = ?,
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
                    data.model,
                    data.status,
                    data.malfunction,
                    data.actual_start,
                    data.mechanic_name,
                    data.planned_hours,
                    data.delay_hours,
                    data.mssql_reason,
                    data.last_sync_time,
                    data.id  // WHERE id = ?
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
            // ✅ ИСПРАВЛЕНО: 17 полей = 17 плейсхолдеров = 17 параметров
            const query = `
                INSERT INTO equipment_master (
                    id, mssql_equipment_id, mssql_type, mssql_status_id,
                    equipment_type, model, status,
                    planned_hours, actual_start, actual_end,
                    delay_hours, malfunction, mechanic_name,
                    mssql_reason, last_sync_time, is_active, manually_edited
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    data.status,
                    data.planned_hours,
                    data.actual_start,
                    data.actual_end,
                    data.delay_hours,
                    data.malfunction,
                    data.mechanic_name,
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