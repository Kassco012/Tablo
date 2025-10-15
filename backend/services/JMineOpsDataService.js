// backend/services/JMineOpsDataService.js - ПРАВИЛЬНАЯ ЛОГИКА

/**
 * Сервис синхронизации данных из JMineOps
 * 
 * ЛОГИКА РАБОТЫ:
 * ===============
 * 1. Берем ПОСЛЕДНИЙ Down для каждой техники
 * 2. Проверяем: есть ли Ready ПОСЛЕ этого Down?
 *    - Если НЕТ Ready → показываем на дашборде
 *    - Если ЕСТЬ Ready → автоматически в архив
 * 3. Техника может приходить несколько раз в день - каждый раз новая запись
 * 4. actual_start = время прихода на ММА (из Down)
 * 5. actual_end = время ухода с ММА (из Ready)
 * 
 * ПРИМЕРЫ:
 * ========
 * 08:00 Down → 09:00 Ready = В архив (ушла с ММА)
 * 11:00 Down → еще Down = На дашборде (все еще на ММА)
 * 11:00 Down → 13:00 Ready = В архив (ушла с ММА)
 */

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

// Маппинг типов техники
const TYPE_MAPPING = {
    'Shovel': 'Экскаватор',
    'Dozer': 'Бульдозер',
    'Drill': 'Буровая установка',
    'Truck': 'Грузовик',
    'Grader': 'Грейдер',
    'WaterTruck': 'Поливочная машина',
    'Loader': 'Погрузчик',
    'AuxE': 'Вспомогательное оборудование',
    'CrusherBay': 'Дробилка'
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

            // 1. Получаем данные из MSSQL (Down + последующий Ready)
            const mssqlData = await this.fetchFromMSSQL();
            console.log(`📊 Получено записей для обработки: ${mssqlData.length}`);

            // 2. Обрабатываем данные (дашборд или архив)
            const result = await this.processSyncData(mssqlData);

            // 3. Обновляем статистику
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
     * Получение данных из MSSQL
     * Берем ПОСЛЕДНИЙ Down для каждой техники + проверяем Ready после него
     */
    async fetchFromMSSQL() {
        try {
            const pool = await getPool();

            const query = `
            -- Получаем последний Down для каждой техники + проверяем Ready после него
            WITH LastDownPerEquipment AS (
                -- Последний Down для каждой техники
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
                -- Проверяем: есть ли Ready ПОСЛЕ последнего Down
                SELECT 
                    ld.equipment_id,
                    ld.down_shift_id,
                    ld.down_time,
                    
                    -- Ищем первый Ready ПОСЛЕ этого Down
                    MIN(ready_ss.time) as ready_time,
                    MIN(ready_ss.id) as ready_shift_id
                    
                FROM LastDownPerEquipment ld
                
                LEFT JOIN dbo.shift_states ready_ss
                    ON ld.equipment_id = ready_ss.equipment_id
                    AND ready_ss.status_id = 332  -- Ready
                    AND ready_ss.time > ld.down_time  -- ПОСЛЕ Down
                    AND ready_ss.deleted_at IS NULL
                    AND ready_ss.time_end IS NULL
                    
                WHERE ld.rn = 1  -- Только последний Down для каждой техники
                
                GROUP BY ld.equipment_id, ld.down_shift_id, ld.down_time
            )
            
            -- Основной SELECT с реальными данными
            SELECT 
                ld.equipment_id,
                ld.down_shift_id,
                ld.down_status_id,
                ld.down_reason_id,
                ld.down_time,
                ld.down_comment,
                
                -- Реальные данные из equipment
                e.name as equipment_name,
                e.type as equipment_type_code,
                et.name as equipment_model,
                
                -- Статус
                status_enum.name as status_name,
                
                -- Причина
                r.descrip as reason_name,
                
                -- Ready информация (если есть)
                rad.ready_time,
                rad.ready_shift_id
                
            FROM LastDownPerEquipment ld
            
            INNER JOIN ReadyAfterDown rad
                ON ld.equipment_id = rad.equipment_id
                AND ld.down_shift_id = rad.down_shift_id
            
            INNER JOIN dbo.equipment e 
                ON ld.equipment_id = e.id
                
            LEFT JOIN dbo.enum_tables et
                ON e.equipment_type_id = et.id
                
            LEFT JOIN dbo.enum_tables status_enum 
                ON ld.down_status_id = status_enum.id 
                AND status_enum.type = 'Status'
                
            LEFT JOIN dbo.reasons r 
                ON ld.down_reason_id = r.id
                
            WHERE 
                ld.rn = 1
                AND e.deleted_at IS NULL
                
            ORDER BY ld.down_time DESC
        `;

            const result = await pool.request().query(query);
            console.log(`📊 Обработано техники: ${result.recordset.length}`);

            // Статистика: сколько на дашборде, сколько в архив
            const onDashboard = result.recordset.filter(r => !r.ready_time).length;
            const toArchive = result.recordset.filter(r => r.ready_time).length;
            
            console.log(`   - На дашборде (еще в ремонте): ${onDashboard}`);
            console.log(`   - В архив (уже готовы): ${toArchive}`);

            // Примеры
            if (result.recordset.length > 0) {
                console.log('\n📋 Примеры:');
                result.recordset.slice(0, 3).forEach((record, index) => {
                    const status = record.ready_time ? '→ В АРХИВ' : '→ НА ДАШБОРДЕ';
                    console.log(`\n${index + 1}. ${record.equipment_name} ${status}`);
                    console.log(`   Down: ${new Date(record.down_time).toLocaleTimeString('ru-RU')}`);
                    if (record.ready_time) {
                        console.log(`   Ready: ${new Date(record.ready_time).toLocaleTimeString('ru-RU')}`);
                    }
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
                        const equipmentType = this.mapEquipmentType(row.equipment_type_code);
                        const model = row.equipment_model || '';
                        const status = row.ready_time ? 'Ready' : 'Down';
                        const malfunction = this.formatReason(row.reason_name) || row.down_comment || '';
                        const priority = this.determinePriority(row.reason_name);

                        // Время Down (когда пришла на ММА) - ПОЛНЫЙ ФОРМАТ
                        const actual_start = row.down_time
                            ? this.formatDateTime(row.down_time)
                            : '';

                        // Время Ready (когда ушла с ММА) - ПОЛНЫЙ ФОРМАТ
                        const actual_end = row.ready_time
                            ? this.formatDateTime(row.ready_time)
                            : '';

                        // Проверяем: есть ли Ready?
                        if (row.ready_time) {
                            // ✅ ЕСТЬ Ready → В АРХИВ
                            this.moveToArchive(db, {
                                id: equipmentId,
                                equipment_type: equipmentType,
                                model: model,
                                status: 'Ready',
                                malfunction: malfunction,
                                actual_start: actual_start,
                                actual_end: actual_end,
                                priority: priority
                            });
                            archived++;
                            console.log(`📦 В архив: ${equipmentId} (${actual_start} → ${actual_end})`);
                            
                        } else {
                            // ✅ НЕТ Ready → НА ДАШБОРД
                            this.updateOrCreateEquipment(db, {
                                id: equipmentId,
                                equipment_type: equipmentType,
                                model: model,
                                status: 'Down',
                                malfunction: malfunction,
                                actual_start: actual_start,
                                actual_end: '',
                                priority: priority,
                                mssql_equipment_id: row.equipment_id,
                                mssql_status_id: row.down_status_id,
                                mssql_reason: row.reason_name
                            });
                            created++;
                            console.log(`✅ На дашборд: ${equipmentId} (${actual_start})`);
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
     * Создание/обновление записи на дашборде
     */
    updateOrCreateEquipment(db, data) {
        const query = `
            INSERT INTO equipment_master (
                id, section, equipment_type, model, status, malfunction,
                actual_start, actual_end, planned_start, planned_end,
                delay_hours, mechanic_name, progress,
                mssql_equipment_id, mssql_status_id, mssql_reason,
                last_sync_time, is_active, manually_edited, priority
            ) VALUES (?, '', ?, ?, ?, ?, ?, '', '', '', 0, '', 0, ?, ?, ?, CURRENT_TIMESTAMP, 1, 0, ?)
            ON CONFLICT(id) DO UPDATE SET
                equipment_type = CASE WHEN manually_edited = 1 THEN equipment_type ELSE excluded.equipment_type END,
                model = CASE WHEN manually_edited = 1 THEN model ELSE excluded.model END,
                status = CASE WHEN manually_edited = 1 THEN status ELSE excluded.status END,
                malfunction = CASE WHEN manually_edited = 1 THEN malfunction ELSE excluded.malfunction END,
                actual_start = excluded.actual_start,
                last_sync_time = CURRENT_TIMESTAMP,
                is_active = 1
        `;

        db.run(query, [
            data.id, data.equipment_type, data.model, data.status, data.malfunction,
            data.actual_start, data.mssql_equipment_id, data.mssql_status_id,
            data.mssql_reason, data.priority
        ]);
    }

    /**
     * Перенос в архив
     */
    moveToArchive(db, data) {
        // Проверяем: есть ли уже в архиве
        db.get(
            'SELECT archive_id FROM equipment_archive WHERE id = ? AND actual_start = ? AND actual_end = ?',
            [data.id, data.actual_start, data.actual_end],
            (err, existing) => {
                if (existing) {
                    return; // Уже в архиве
                }

                // Добавляем в архив
                db.run(`
                    INSERT INTO equipment_archive (
                        id, section, equipment_type, model, status, priority,
                        planned_start, planned_end, actual_start, actual_end,
                        delay_hours, malfunction, mechanic_name, progress,
                        created_at, updated_at, completed_date, archive_reason
                    ) VALUES (?, '', ?, ?, 'Ready', ?, '', '', ?, ?, 0, ?, '', 100, 
                              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'auto_ready')
                `, [
                    data.id, data.equipment_type, data.model, data.priority,
                    data.actual_start, data.actual_end, data.malfunction
                ]);

                // Удаляем с дашборда
                db.run('UPDATE equipment_master SET is_active = 0 WHERE id = ?', [data.id]);
            }
        );
    }

    mapEquipmentType(type) {
        return TYPE_MAPPING[type] || type || 'Техника';
    }

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

    determinePriority(reason) {
        if (!reason) return 'normal';
        const reasonUpper = reason.toUpperCase();
        if (reasonUpper.includes('ENGINE') || reasonUpper.includes('TRANSMISSION') || reasonUpper.includes('HYDRAULIC')) {
            return 'high';
        }
        if (reasonUpper.includes('ELECTRICAL') || reasonUpper.includes('WAIT PARTS') || reasonUpper.includes('GEAR BOX')) {
            return 'medium';
        }
        return 'normal';
    }

    /**
     * Форматирование даты и времени в формате: ДД.ММ.ГГГГ ЧЧ:ММ
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

    getStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            stats: this.syncStats
        };
    }
}

module.exports = new JMineOpsDataService();