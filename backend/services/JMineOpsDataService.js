// backend/services/JMineOpsDataService.js - ФИНАЛЬНАЯ ВЕРСИЯ

const { getPool, sql } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');

// ✅ Маппинг статусов
const STATUS_MAPPING = {
    331: 'Down',
    332: 'Ready',
    333: 'Standby',
    334: 'Delay',
    335: 'Shiftchange',
};

// ✅ ПРОСТОЙ маппинг типов из equipment.type
const TYPE_MAPPING = {
    'Drill': 'Буровой станок',
    'Dozer': 'Бульдозер',
    'Shovel': 'Экскаватор',
    'Grader': 'Грейдер',
    'Truck': 'Самосвал',
    'Loader': 'Погрузчик',
    'WaterTruck': 'Водовоз',
    'AuxEquipment': 'Вспомогательное оборудование',

    // Для совместимости (lowercase)
    'drill': 'Буровой станок',
    'dozer': 'Бульдозер',
    'shovel': 'Экскаватор',
    'grader': 'Грейдер',
    'truck': 'Самосвал',
    'loader': 'Погрузчик',
    'watertruck': 'Водовоз',
    'auxequipment': 'Вспомогательное оборудование'
};

// ✅ Белый список разрешенных типов техники
const ALLOWED_EQUIPMENT_TYPES = [
    'Drill',
    'Dozer',
    'Shovel',
    'Grader',
    'Truck',
    'Loader',
    'WaterTruck',
    'AuxEquipment'
];

class JMineOpsDataService {
    constructor() {
        this.lastSyncTime = null;
        this.syncInProgress = false;
        this.syncStats = {
            total: 0,
            updated: 0,
            created: 0,
            archived: 0,
            errors: 0,
            lastError: null
        };
    }

    async syncEquipment() {
        if (this.syncInProgress) {
            console.log('⏳ Синхронизация уже выполняется, пропускаем...');
            return;
        }

        this.syncInProgress = true;
        const startTime = Date.now();

        try {
            console.log('\n🔄 Синхронизация техники на ММА...');
            console.log(`📅 Текущая дата: ${new Date().toLocaleTimeString('ru-RU')}`);

            const mssqlData = await this.fetchFromMSSQL();
            console.log(`📊 Получено записей для обработки: ${mssqlData.length}`);

            const result = await this.processSyncData(mssqlData);

            this.syncStats.total = mssqlData.length;
            this.syncStats.updated = result.updated;
            this.syncStats.created = result.created;
            this.syncStats.archived = result.archived;
            this.lastSyncTime = new Date().toISOString();

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Синхронизация завершена за ${duration}с`);
            console.log(`   - На дашборде: ${result.created + result.updated - result.archived}`);
            console.log(`   - В архив: ${result.archived}`);

        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            this.syncStats.errors++;
            this.syncStats.lastError = error.message;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * ✅ SQL запрос с использованием equipment.type
     */
    async fetchFromMSSQL() {
        try {
            const pool = await getPool();

            const query = `
                -- Получаем последний Down для каждой техники
                WITH LastDownPerEquipment AS (
                    SELECT 
                        ss.equipment_id,
                        ss.id as down_shift_id,
                        ss.status_id as down_status_id,
                        ss.reason_id as down_reason_id,
                        ss.time as down_time,
                        ss.comment as down_comment,
                        ROW_NUMBER() OVER (
                            PARTITION BY ss.equipment_id 
                            ORDER BY ss.time DESC
                        ) as rn
                    FROM dbo.shift_states ss
                    WHERE 
                        ss.deleted_at IS NULL
                        AND ss.status_id = 331  -- Down
                        AND ss.time_end IS NULL
                ),
                ReadyAfterDown AS (
                    SELECT 
                        ld.equipment_id,
                        ld.down_shift_id,
                        ld.down_time,
                        MIN(ready_ss.time) as ready_time,
                        MIN(ready_ss.id) as ready_shift_id
                    FROM LastDownPerEquipment ld
                    LEFT JOIN dbo.shift_states ready_ss
                        ON ld.equipment_id = ready_ss.equipment_id
                        AND ready_ss.status_id = 332  -- Ready
                        AND ready_ss.time > ld.down_time
                        AND ready_ss.deleted_at IS NULL
                        AND ready_ss.time_end IS NULL
                    WHERE ld.rn = 1
                    GROUP BY ld.equipment_id, ld.down_shift_id, ld.down_time
                )
                
                SELECT 
                    ld.equipment_id,
                    ld.down_shift_id,
                    ld.down_status_id,
                    ld.down_reason_id,
                    ld.down_time,
                    ld.down_comment,
                    
                    -- ✅ ГЛАВНОЕ: Берём type напрямую из equipment!
                    e.type as equipment_type,
                    e.name as equipment_name,
                    
                    -- Модель техники
                    model_enum.name as equipment_model,
                    model_enum.symbol as equipment_model_symbol,
                    
                    -- Статус
                    status_enum.name as status_name,
                    
                    -- Причина
                    r.descrip as reason_name,
                    
                    -- Ready информация
                    rad.ready_time,
                    rad.ready_shift_id
                    
                FROM LastDownPerEquipment ld
                
                INNER JOIN ReadyAfterDown rad
                    ON ld.equipment_id = rad.equipment_id
                    AND ld.down_shift_id = rad.down_shift_id
                
                -- ✅ Основная таблица техники (ГЛАВНЫЙ ИСТОЧНИК ТИПА!)
                INNER JOIN dbo.equipment e 
                    ON ld.equipment_id = e.id
                
                -- Модель техники
                LEFT JOIN dbo.enum_tables model_enum
                    ON e.equipment_type_id = model_enum.id
                    AND model_enum.type = 'EquipmentType'
                    
                -- Статус
                LEFT JOIN dbo.enum_tables status_enum 
                    ON ld.down_status_id = status_enum.id 
                    AND status_enum.type = 'Status'
                    
                -- Причина
                LEFT JOIN dbo.reasons r 
                    ON ld.down_reason_id = r.id
                    
                WHERE 
                    ld.rn = 1
                    AND e.deleted_at IS NULL
                    AND e.type IS NOT NULL  -- ✅ Пропускаем записи без типа
                    
                ORDER BY ld.down_time DESC
            `;

            const result = await pool.request().query(query);

            // ✅ Фильтруем только разрешённые типы
            const filteredData = result.recordset.filter(row => {
                const equipmentType = row.equipment_type;
                const isAllowed = ALLOWED_EQUIPMENT_TYPES.includes(equipmentType);

                if (!isAllowed) {
                    console.log(`⏭️ Пропущена техника: ${row.equipment_name} (Тип: ${equipmentType || 'NULL'})`);
                }

                return isAllowed;
            });

            console.log(`📊 Всего записей из MSSQL: ${result.recordset.length}`);
            console.log(`✅ После фильтрации: ${filteredData.length}`);

            const onDashboard = filteredData.filter(r => !r.ready_time).length;
            const toArchive = filteredData.filter(r => r.ready_time).length;

            console.log(`   - На дашборде (еще в ремонте): ${onDashboard}`);
            console.log(`   - В архив (уже готовы): ${toArchive}`);

            // Примеры для отладки
            if (filteredData.length > 0) {
                console.log('\n📋 Примеры типов техники:');
                filteredData.slice(0, 5).forEach((record, index) => {
                    console.log(`${index + 1}. ${record.equipment_name}`);
                    console.log(`   Тип из equipment: ${record.equipment_type}`);
                    console.log(`   Модель: ${record.equipment_model || 'НЕТ'}`);
                    console.log(`   Маппится как: ${this.mapEquipmentType(record.equipment_type)}`);
                });
            }

            return filteredData;

        } catch (error) {
            console.error('❌ Ошибка запроса к MSSQL:', error.message);
            throw error;
        }
    }

    /**
     * ✅ Обработка данных: дашборд или архив
     */
    async processSyncData(mssqlData) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            let updated = 0;
            let created = 0;
            let archived = 0;

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                mssqlData.forEach(row => {
                    try {
                        const equipmentId = row.equipment_name;

                        // ✅ ТЕПЕРЬ ПРОСТО ПЕРЕДАЁМ equipment_type из БД
                        const equipmentType = this.mapEquipmentType(row.equipment_type);

                        const model = row.equipment_model || '';
                        const status = row.ready_time ? 'Ready' : 'Down';
                        const malfunction = this.formatReason(row.reason_name) || row.down_comment || '';

                        const actual_start = row.down_time
                            ? this.formatDateTime(row.down_time)
                            : '';

                        const actual_end = row.ready_time
                            ? this.formatDateTime(row.ready_time)
                            : '';

                        if (row.ready_time) {
                            // В архив
                            this.moveToArchive(db, {
                                id: equipmentId,
                                equipment_type: equipmentType,
                                model: model,
                                status: 'Ready',
                                malfunction: malfunction,
                                actual_start: actual_start,
                                actual_end: actual_end
                            });
                            archived++;
                            console.log(`📦 В архив: ${equipmentId} (${equipmentType})`);

                        } else {
                            // На дашборд
                            this.updateOrCreateEquipment(db, {
                                id: equipmentId,
                                equipment_type: equipmentType,
                                model: model,
                                status: 'Down',
                                malfunction: malfunction,
                                actual_start: actual_start,
                                mssql_equipment_id: row.equipment_id,
                                mssql_status_id: row.down_status_id,
                                mssql_reason: row.reason_name
                            });
                            created++;
                            console.log(`✅ На дашборд: ${equipmentId} (${equipmentType})`);
                        }

                    } catch (error) {
                        console.error('❌ Ошибка обработки записи:', error.message);
                    }
                });

                db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                        return reject(commitErr);
                    }
                    console.log(`\n✅ Обработка завершена:`);
                    console.log(`   - Создано/обновлено: ${created}`);
                    console.log(`   - В архив: ${archived}`);
                    resolve({ updated, created, archived });
                });
            });
        });
    }

    /**
     * ✅ УПРОЩЁННАЯ функция маппинга типа
     * Берём тип прямо из таблицы equipment!
     */
    mapEquipmentType(equipmentType) {
        if (!equipmentType) {
            console.warn('⚠️ Тип техники пустой');
            return 'Вспомогательное оборудование';
        }

        const mapped = TYPE_MAPPING[equipmentType];

        if (!mapped) {
            console.warn(`⚠️ Неизвестный тип: "${equipmentType}"`);
            return 'Вспомогательное оборудование';
        }

        return mapped;
    }

    /**
     * ✅ Создание/обновление записи на дашборде
     */
    updateOrCreateEquipment(db, data) {
        const query = `
            INSERT INTO equipment_master (
                id, equipment_type, model, status, malfunction, actual_start,
                mssql_equipment_id, mssql_status_id, mssql_reason,
                is_active, manually_edited
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
            ON CONFLICT(id) DO UPDATE SET
                equipment_type = CASE WHEN manually_edited = 1 THEN equipment_type ELSE excluded.equipment_type END,
                model = CASE WHEN manually_edited = 1 THEN model ELSE excluded.model END,
                status = CASE WHEN manually_edited = 1 THEN status ELSE excluded.status END,
                malfunction = CASE WHEN manually_edited = 1 THEN malfunction ELSE excluded.malfunction END,
                actual_start = excluded.actual_start,
                mssql_equipment_id = excluded.mssql_equipment_id,
                mssql_status_id = excluded.mssql_status_id,
                mssql_reason = excluded.mssql_reason,
                last_sync_time = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `;

        const values = [
            data.id,
            data.equipment_type,
            data.model || '',
            data.status,
            data.malfunction || '',
            data.actual_start || '',
            data.mssql_equipment_id,
            data.mssql_status_id,
            data.mssql_reason || ''
        ];

        db.run(query, values, function (err) {
            if (err) {
                console.error(`❌ Ошибка updateOrCreateEquipment для ${data.id}:`, err.message);
            }
        });
    }


    moveToArchive(db, data) {
        // ✅ ШАГ 1: Проверяем, нет ли уже в архиве
        db.get(
            'SELECT archive_id FROM equipment_archive WHERE id = ? AND actual_start = ? AND actual_end = ?',
            [data.id, data.actual_start, data.actual_end],
            (err, existing) => {
                if (err) {
                    console.error('❌ Ошибка проверки архива:', err.message);
                    return;
                }

                if (existing) {
                    console.log(`⏭️ ${data.id} уже в архиве (пропускаем)`);
                    return;
                }

                // ✅ ШАГ 2: Получаем mechanic_name и planned_hours из equipment_master
                db.get(
                    'SELECT mechanic_name, planned_hours FROM equipment_master WHERE id = ? AND is_active = 1',
                    [data.id],
                    (err, equipment) => {
                        if (err) {
                            console.error(`❌ Ошибка получения данных ${data.id}:`, err.message);
                            return;
                        }

                        // ✅ ШАГ 3: Берём заполненные вручную данные или NULL
                        const mechanicName = equipment?.mechanic_name || null;
                        const plannedHours = equipment?.planned_hours || 0;

                        console.log(`📦 Архивирование ${data.id}:`);
                        console.log(`   Механик: ${mechanicName || 'не указан'}`);
                        console.log(`   План: ${plannedHours}ч`);
                        console.log(`   Факт начала: ${data.actual_start}`);
                        console.log(`   Факт окончания: ${data.actual_end}`);

                        // ✅ ШАГ 4: Вставляем в архив с ПРАВИЛЬНЫМИ данными
                        const insertQuery = `
                        INSERT INTO equipment_archive (
                            id, 
                            equipment_type, 
                            model, 
                            status,
                            actual_start, 
                            actual_end, 
                            planned_hours,
                            malfunction,
                            mechanic_name,
                            completed_date
                        ) VALUES (?, ?, ?, 'Ready', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `;

                        const insertValues = [
                            data.id,
                            data.equipment_type,
                            data.model || '',
                            data.actual_start || '',
                            data.actual_end || '',
                            plannedHours,              // ✅ Из equipment_master
                            data.malfunction || '',
                            mechanicName               // ✅ Из equipment_master
                        ];

                        db.run(insertQuery, insertValues, function (err) {
                            if (err) {
                                console.error(`❌ Ошибка архивирования ${data.id}:`, err.message);
                                return;
                            }

                            console.log(`✅ ${data.id} добавлен в архив (ID: ${this.lastID})`);

                            // ✅ ШАГ 5: Деактивируем на дашборде
                            db.run(
                                'UPDATE equipment_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                [data.id],
                                (err) => {
                                    if (err) {
                                        console.error(`❌ Ошибка деактивации ${data.id}:`, err.message);
                                    } else {
                                        console.log(`✅ ${data.id} деактивирован на дашборде`);
                                    }
                                }
                            );
                        });
                    }
                );
            }
        );
    }


    /**
     * Форматирование причины на русский
     */
    formatReason(reason) {
        if (!reason) return '';

        const reasonMap = {
            'PM SERVICE': 'Плановое техническое обслуживание',
            'WAIT PARTS': 'Ожидание запасных частей',
            'ENGINE': 'Ремонт двигателя',
            'HYDRAULIC': 'Ремонт гидравлической системы',
            'ELECTRICAL': 'Ремонт электрооборудования',
            'TRANSMISSION': 'Ремонт трансмиссии',
            'AIR CONDITIONING': 'Ремонт кондиционера',
            'GEAR BOX': 'Ремонт коробки передач',
            'GET/BUCKET/BLADE': 'Ремонт рабочего оборудования',
            'TIRES': 'Замена/ремонт шин',
            'UNDERCARRIAGE': 'Ремонт ходовой части'
        };

        return reasonMap[reason.toUpperCase()] || reason;
    }

    /**
     * Форматирование даты и времени
     */
    formatDateTime(dateTime) {
        if (!dateTime) return '';

        const date = new Date(dateTime);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    /**
     * Получить статус синхронизации
     */
    getStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            stats: this.syncStats
        };
    }
}

module.exports = new JMineOpsDataService();