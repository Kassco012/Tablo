// backend/services/JMineOpsDataService.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

const { getPool, sql } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');

// Маппинг статусов
const STATUS_MAPPING = {
    331: 'Down',
    332: 'Ready',
    333: 'Standby',
    334: 'Delay',
    335: 'Shiftchange',
};

// ✅ Маппинг типов (по symbol из HpEquipmentType)
const TYPE_MAPPING = {
    'hydraulic_excavator': 'Экскаватор',
    'shovel': 'Экскаватор',
    'front_end_loader': 'Погрузчик',
    'loader': 'Погрузчик',
    'drill': 'Буровой станок',
    'track_dozer': 'Бульдозер',
    'tire_dozer': 'Бульдозер',
    'cable_shovel': 'Экскаватор',
    'hydraulic_shovel': 'Экскаватор',
    'grader': 'Грейдер',
    'truck': 'Самосвал',
    'watertruck': 'Водовоз',
    'watertruck': 'Поливочная машина',
};

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
     * ✅ SQL-запрос для получения данных из MSSQL
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
                    
                    -- Имя техники
                    e.name as equipment_name,
                    
                    -- Модель техники
                    model_enum.name as equipment_model,
                    model_enum.symbol as equipment_model_symbol,
                    
                    -- Категория (Drill, Shovel, Loader...)
                    hp_type.name as equipment_category_name,
                    hp_type.symbol as equipment_category_symbol,
                    
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
                
                -- Основная таблица техники
                INNER JOIN dbo.equipment e 
                    ON ld.equipment_id = e.id
                
                -- Модель техники
                LEFT JOIN dbo.enum_tables model_enum
                    ON e.equipment_type_id = model_enum.id
                    AND model_enum.type = 'EquipmentType'
                
                -- Категория техники
                LEFT JOIN dbo.enum_tables hp_type
                    ON e.hp_equipment_type_id = hp_type.id
                    AND hp_type.type = 'HpEquipmentType'
                    
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
                    
                ORDER BY ld.down_time DESC
            `;

            const result = await pool.request().query(query);

            console.log(`📊 Обработано техники: ${result.recordset.length}`);

            const onDashboard = result.recordset.filter(r => !r.ready_time).length;
            const toArchive = result.recordset.filter(r => r.ready_time).length;

            console.log(`   - На дашборде (еще в ремонте): ${onDashboard}`);
            console.log(`   - В архив (уже готовы): ${toArchive}`);

            // Примеры для отладки
            if (result.recordset.length > 0) {
                console.log('\n📋 Примеры типов техники:');
                result.recordset.slice(0, 3).forEach((record, index) => {
                    console.log(`${index + 1}. ${record.equipment_name}`);
                    console.log(`   Категория: ${record.equipment_category_symbol || 'НЕТ'}`);
                    console.log(`   Модель: ${record.equipment_model || 'НЕТ'}`);
                });
            }

            return result.recordset;

        } catch (error) {
            console.error('❌ Ошибка запроса к MSSQL:', error.message);
            throw error;
        }
    }

    /**
     * Обработка данных: дашборд или архив
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
                        const equipmentType = this.mapEquipmentType(row.equipment_category_symbol);
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
                            console.log(`📦 В архив: ${equipmentId} (${equipmentType}) ${actual_start} → ${actual_end}`);

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
                            console.log(`✅ На дашборд: ${equipmentId} (${equipmentType}) ${actual_start}`);
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
     * Маппинг типа по symbol
     */
    mapEquipmentType(symbol) {
        if (!symbol) {
            console.warn('⚠️ Тип техники не указан (symbol пустой)');
            return 'Техника';
        }

        const normalized = symbol.toLowerCase().trim();
        const mapped = TYPE_MAPPING[normalized];

        if (!mapped) {
            console.warn(`⚠️ Неизвестный тип: "${symbol}"`);
            return 'Техника';
        }

        return mapped;
    }

    /**
     * ✅ ИСПРАВЛЕНО: Создание/обновление записи на дашборде
     * Количество плейсхолдеров: 9
     * Количество значений: 9
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
            data.id,                    // 1
            data.equipment_type,        // 2
            data.model || '',           // 3
            data.status,                // 4
            data.malfunction || '',     // 5
            data.actual_start || '',    // 6
            data.mssql_equipment_id,    // 7
            data.mssql_status_id,       // 8
            data.mssql_reason || ''     // 9
        ];

        db.run(query, values, function (err) {
            if (err) {
                console.error(`❌ Ошибка updateOrCreateEquipment для ${data.id}:`, err.message);
                console.error('📦 Values:', values);
            }
        });
    }

    /**
     * ✅ ИСПРАВЛЕНО: Перенос в архив
     * Количество плейсхолдеров: 6
     * Количество значений: 6
     */
    moveToArchive(db, data) {
        db.get(
            'SELECT archive_id FROM equipment_archive WHERE id = ? AND actual_start = ? AND actual_end = ?',
            [data.id, data.actual_start, data.actual_end],
            (err, existing) => {
                if (err) {
                    console.error('❌ Ошибка проверки архива:', err.message);
                    return;
                }

                if (existing) {
                    return; // Уже в архиве
                }

                const insertQuery = `
                    INSERT INTO equipment_archive (
                        id, equipment_type, model, status,
                        actual_start, actual_end, malfunction
                    ) VALUES (?, ?, ?, 'Ready', ?, ?, ?)
                `;

                const insertValues = [
                    data.id,                    // 1
                    data.equipment_type,        // 2
                    data.model || '',           // 3
                    // 'Ready' встроено в SQL   // 4
                    data.actual_start || '',    // 4 (параметр)
                    data.actual_end || '',      // 5
                    data.malfunction || ''      // 6
                ];

                db.run(insertQuery, insertValues, function (err) {
                    if (err) {
                        console.error(`❌ Ошибка архивирования ${data.id}:`, err.message);
                        console.error('📦 Values:', insertValues);
                        return;
                    }

                    // Деактивируем на дашборде
                    db.run('UPDATE equipment_master SET is_active = 0 WHERE id = ?', [data.id], (err) => {
                        if (err) {
                            console.error(`❌ Ошибка деактивации ${data.id}:`, err.message);
                        }
                    });
                });
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