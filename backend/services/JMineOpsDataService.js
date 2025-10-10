// backend/services/JMineOpsDataService.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

/**
 * Сервис синхронизации данных из JMineOps
 * 
 * ЛОГИКА РАБОТЫ:
 * ===============
 * 1. Каждые 30 секунд проверяем Down и Ready статусы
 * 2. Down (time_end = NULL) → записываем в equipment_master
 * 3. Ready (time_end != NULL) → АВТОМАТИЧЕСКИ отправляем в архив
 * 4. Данные собираем с 09.10.2025
 * 
 * МАППИНГ:
 * ========
 * JMineOps → SQLite → Frontend
 * e.name → id → ID
 * e.type → equipment_type → Тип
 * et.name → model → Модель  
 * ss.time → actual_start → Факт начало
 * r.descrip → malfunction → Неисправность
 */

const { getPool, sql } = require('../config/mssqlDatabase');
const { getDatabase } = require('../config/database');


const STATUS_MAPPING = {
    331: 'Down',
    332: 'Ready',
    333: 'Standby',
    334: 'Down',
    335: 'Shiftchange',
};

const TYPE_MAPPING = {
    'Shovel': 'Экскаватор',
    'Dozer': 'Бульдозер',
    'Drill': 'Буровая установка',
    'Truck': 'Грузовик',
    'Grader': 'Грейдер',
    'WaterTruck': 'Поливочная машина',
    'AuxE': 'Вспомогательное оборудование'
};

class JMineOpsDataService {
    constructor() {
        this.lastSyncTime = null;
        this.syncInProgress = false;
        this.syncStats = {
            total: 0,
            updated: 0,
            created: 0,
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
            console.log('\n🔄 Синхронизация Down статуса (каждые 30 сек)...');
            console.log(`📅 Текущая дата: ${new Date().toLocaleTimeString('ru-RU')}`);

            // 1. Получаем ТОЛЬКО АКТИВНЫЕ простои (Down) с 09.10.2025
            const mssqlData = await this.fetchFromMSSQL();
            console.log(`📊 Получено Down записей: ${mssqlData.length}`);

            // 2. Обновляем SQLite (БЕЗ автоархивации)
            const result = await this.updateSQLite(mssqlData);

            // 3. Обновляем статистику
            this.syncStats.total = mssqlData.length;
            this.syncStats.updated = result.updated;
            this.syncStats.created = result.created;
            this.lastSyncTime = new Date().toISOString();

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Синхронизация завершена за ${duration}с`);
            console.log(`   - Down записей: ${mssqlData.length}`);
            console.log(`   - Создано: ${result.created}`);
            console.log(`   - Обновлено: ${result.updated}`);

        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            this.syncStats.errors++;
            this.syncStats.lastError = error.message;
        } finally {
            this.syncInProgress = false;
        }
    }

    // backend/services/JMineOpsDataService.js

    async fetchFromMSSQL() {
        try {
            const pool = await getPool();

            const query = `
            -- Получаем ТОЛЬКО сегодняшние активные простои (Down)
            SELECT 
                ss.id as shift_state_id,
                ss.equipment_id,
                ss.status_id,
                ss.reason_id,
                ss.time as down_start_time,
                ss.time_end,
                ss.comment,
                
                -- Название оборудования
                CAST(ss.equipment_id AS VARCHAR(50)) as equipment_name,
                
                -- Тип оборудования (захардкодим, потом можешь добавить JOIN с dbo.equipment)
                'Equipment' as equipment_type_code,
                'Техника' as equipment_type_name,
                'Model-' + CAST(ss.equipment_id AS VARCHAR(50)) as equipment_model,
                
                -- Статус из enum_tables
                status_enum.name as status_name,
                status_enum.symbol as status_symbol,
                
                -- Причина из dbo.reasons
                r.descrip as reason_name,
                r.string_code as reason_code
                
            FROM dbo.shift_states ss
            
            -- JOIN для получения названия статуса
            LEFT JOIN dbo.enum_tables status_enum 
                ON ss.status_id = status_enum.id 
                AND status_enum.type = 'Status'
                
            -- JOIN для получения причины простоя
            LEFT JOIN dbo.reasons r 
                ON ss.reason_id = r.id
                
            WHERE 
                ss.deleted_at IS NULL                      -- Не удаленные
                AND ss.time_end IS NULL                    -- ✅ АКТИВНЫЕ (простой еще не закончен)
                AND ss.status_id = 331                     -- ✅ ТОЛЬКО Down (простой)
                
                -- ✅ ТОЛЬКО СЕГОДНЯ (с 00:00:00 до 23:59:59)
                AND ss.time >= CAST(GETDATE() AS DATE)
                AND ss.time < DATEADD(day, 1, CAST(GETDATE() AS DATE))
                
            ORDER BY ss.time DESC
        `;

            const result = await pool.request().query(query);
            console.log(`📊 Получено АКТИВНЫХ простоев (Down) за СЕГОДНЯ: ${result.recordset.length}`);

            // Логируем первую запись для проверки
            if (result.recordset.length > 0) {
                console.log('📋 Пример записи:', JSON.stringify(result.recordset[0], null, 2));
            }

            return result.recordset;

        } catch (error) {
            console.error('❌ Ошибка запроса к MSSQL:', error.message);
            throw error;
        }
    }

    async fetchReadyEquipment() {
        try {
            const pool = await getPool();

            const query = `
                -- Техника которая ЗАВЕРШИЛА простой (получила Ready)
                -- БЕЗ фильтра по дате - берем все завершенные за последние 30 дней
                SELECT 
                    ss.equipment_id,
                    e.name as equipment_name,
                    ss.time as down_start,
                    ss.time_end as ready_time
                    
                FROM dbo.shift_states ss
                INNER JOIN dbo.equipment e ON ss.equipment_id = e.id
                
                WHERE 
                    ss.deleted_at IS NULL
                    AND ss.time_end IS NOT NULL           -- Простой ЗАВЕРШЕН
                    AND ss.status_id = 331                -- Был в Down
                    
                    -- Завершился в последние 30 дней
                    AND ss.time_end >= DATEADD(day, -30, GETDATE())
                    
                ORDER BY ss.time_end DESC
            `;

            const result = await pool.request().query(query);
            console.log(`📊 Техника перешедшая в Ready сегодня: ${result.recordset.length}`);
            
            return result.recordset;

        } catch (error) {
            console.error('❌ Ошибка запроса Ready техники:', error.message);
            return [];
        }
    }

    async updateSQLite(mssqlData) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            let updated = 0;
            let created = 0;

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                const stmt = db.prepare(`
                INSERT INTO equipment_master (
                    id, 
                    section, 
                    equipment_type, 
                    model,
                    status,
                    malfunction,
                    actual_start,
                    mssql_equipment_id,
                    mssql_status_id,
                    mssql_reason,
                    last_sync_time,
                    is_active,
                    manually_edited,
                    priority
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, 0, ?)
                ON CONFLICT(id) DO UPDATE SET
                    equipment_type = CASE 
                        WHEN manually_edited = 1 THEN equipment_type 
                        ELSE excluded.equipment_type 
                    END,
                    model = CASE 
                        WHEN manually_edited = 1 THEN model 
                        ELSE excluded.model 
                    END,
                    status = CASE 
                        WHEN manually_edited = 1 THEN status 
                        ELSE excluded.status 
                    END,
                    malfunction = CASE 
                        WHEN manually_edited = 1 THEN malfunction 
                        ELSE excluded.malfunction 
                    END,
                    actual_start = excluded.actual_start,
                    mssql_equipment_id = excluded.mssql_equipment_id,
                    mssql_status_id = excluded.mssql_status_id,
                    mssql_reason = excluded.mssql_reason,
                    last_sync_time = CURRENT_TIMESTAMP,
                    priority = excluded.priority
            `);

                mssqlData.forEach(row => {
                    try {
                        // ID оборудования - просто номер из equipment_id
                        const equipmentId = `EQ-${row.equipment_id}`;

                        // Тип - пока захардкодим, потом добавишь JOIN
                        const equipmentType = 'Техника';

                        // Модель
                        const model = row.equipment_model || `Model-${row.equipment_id}`;

                        // Статус - мапим из status_id
                        const status = STATUS_MAPPING[row.status_id] || 'Down';

                        // Неисправность - пока пустая (заполнят диспетчеры)
                        const malfunction = row.reason_name || row.comment || '';

                        // Время начала простоя
                        const actual_start = row.down_start_time
                            ? new Date(row.down_start_time).toISOString().substring(11, 16)
                            : '';

                        // Приоритет - normal по умолчанию
                        const priority = 'normal';

                        // Участок - пустой (заполнят диспетчеры вручную)
                        const section = '';

                        stmt.run([
                            equipmentId,
                            section,
                            equipmentType,
                            model,
                            status,
                            malfunction,
                            actual_start,
                            row.equipment_id,
                            row.status_id,
                            row.reason_name,
                            priority
                        ], function (err) {
                            if (err) {
                                console.error(`❌ Ошибка для ${equipmentId}:`, err.message);
                            } else {
                                if (this.changes > 0) {
                                    if (this.lastID === this.changes) {
                                        created++;
                                        console.log(`✅ Создано: ${equipmentId} (${equipmentType} ${model})`);
                                    } else {
                                        updated++;
                                    }
                                }
                            }
                        });

                    } catch (error) {
                        console.error('❌ Ошибка обработки записи:', error.message);
                    }
                });

                stmt.finalize((err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            return reject(commitErr);
                        }
                        console.log(`✅ Синхронизация завершена: создано ${created}, обновлено ${updated}`);
                        resolve({ updated, created });
                    });
                });
            });
        });
    }

    mapEquipmentType(type) {
        const typeMap = {
            'Shovel': 'Экскаватор',
            'Dozer': 'Бульдозер',
            'Drill': 'Буровая установка',
            'Truck': 'Грузовик',
            'Grader': 'Грейдер',
            'WaterTruck': 'Поливочная машина',
            'AuxE': 'Вспомогательное оборудование'
        };
        return typeMap[type] || type || 'Equipment';
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
        
        // Критический приоритет
        if (reasonUpper.includes('ENGINE') || 
            reasonUpper.includes('TRANSMISSION') ||
            reasonUpper.includes('HYDRAULIC')) {
            return 'high';
        }
        
        // Средний приоритет
        if (reasonUpper.includes('ELECTRICAL') ||
            reasonUpper.includes('WAIT PARTS') ||
            reasonUpper.includes('GEAR BOX')) {
            return 'medium';
        }
        
        return 'normal';
    }

    async autoArchiveReady(readyEquipment) {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            let archived = 0;

            console.log(`🗄️ Начало автоархивации ${readyEquipment.length} единиц техники...`);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                readyEquipment.forEach((item, index) => {
                    const equipmentId = item.equipment_name || `EQ-${item.equipment_id}`;

                    // 1. Получаем данные из equipment_master
                    db.get(
                        'SELECT * FROM equipment_master WHERE id = ? AND is_active = 1',
                        [equipmentId],
                        (err, equipment) => {
                            if (err) {
                                console.error(`❌ Ошибка получения ${equipmentId}:`, err.message);
                                return;
                            }

                            if (!equipment) {
                                console.log(`⚠️ ${equipmentId} не найдена в equipment_master`);
                                return;
                            }

                            // 2. Копируем в архив
                            db.run(`
                                INSERT INTO equipment_archive (
                                    id, section, equipment_type, model, 
                                    status, priority,
                                    planned_start, planned_end, 
                                    actual_start, actual_end,
                                    delay_hours, malfunction, 
                                    mechanic_name, progress,
                                    created_at, updated_at,
                                    completed_date, archive_reason
                                ) VALUES (?, ?, ?, ?, 'Ready', ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'auto_ready')
                            `, [
                                equipment.id,
                                equipment.section || 'не указан',
                                equipment.equipment_type,
                                equipment.model,
                                equipment.priority || 'normal',
                                equipment.planned_start,
                                equipment.planned_end,
                                equipment.actual_start,
                                item.ready_time ? new Date(item.ready_time).toISOString().substring(11, 16) : '',
                                equipment.delay_hours || 0,
                                equipment.malfunction,
                                equipment.mechanic_name,
                                equipment.created_at
                            ], function (archErr) {
                                if (archErr) {
                                    console.error(`❌ Ошибка архивации ${equipmentId}:`, archErr.message);
                                    return;
                                }

                                // 3. Помечаем как неактивное в equipment_master
                                db.run(
                                    'UPDATE equipment_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                    [equipmentId],
                                    function (updateErr) {
                                        if (!updateErr) {
                                            archived++;
                                            console.log(`✅ Автоархивация: ${equipmentId} → Ready (архив ID: ${this.lastID})`);
                                        }

                                        // Проверяем завершение
                                        if (index === readyEquipment.length - 1) {
                                            db.run('COMMIT', (commitErr) => {
                                                if (commitErr) {
                                                    console.error('❌ Ошибка коммита автоархивации:', commitErr);
                                                    reject(commitErr);
                                                } else {
                                                    console.log(`✅ Автоархивация завершена: ${archived} единиц`);
                                                    resolve(archived);
                                                }
                                            });
                                        }
                                    }
                                );
                            });
                        }
                    );
                });
            });
        });
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