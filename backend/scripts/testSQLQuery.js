// backend/scripts/testSQLQuery.js
// Скрипт для тестирования и отладки SQL запросов к JMineOps

require('dotenv').config();
const { getPool, closePool } = require('../config/mssqlDatabase');

/**
 * Тестовый запрос - замените на свой
 */
const YOUR_SQL_QUERY = `
    SELECT 
        e.id as mssql_equipment_id,
        e.name as equipment_name,
        e.type as mssql_type,
        e.model as equipment_model,
        e.status_id,
        e.updated_at,
        
        -- Статус
        status_enum.name as status_name,
        status_enum.symbol as status_symbol,
        
        -- Причина простоя
        reason_enum.name as reason_name,
        
        -- Если есть поле для времени смены статуса - раскомментируйте:
        -- e.status_changed_at as down_start_time
        -- Если нет - используем updated_at:
        e.updated_at as down_start_time
        
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
        AND e.status_id IN (331, 332)  -- Down и Ready
    
    ORDER BY 
        CASE WHEN e.status_id = 331 THEN 0 ELSE 1 END,
        e.name;
`;

async function testQuery() {
    console.log('═══════════════════════════════════════════════');
    console.log('🔍 ТЕСТ SQL ЗАПРОСА');
    console.log('═══════════════════════════════════════════════\n');

    try {
        const pool = await getPool();

        console.log('📝 Выполняемый запрос:');
        console.log('─'.repeat(50));
        console.log(YOUR_SQL_QUERY);
        console.log('─'.repeat(50));
        console.log();

        const startTime = Date.now();
        const result = await pool.request().query(YOUR_SQL_QUERY);
        const duration = Date.now() - startTime;

        console.log(`✅ Запрос выполнен успешно за ${duration}ms`);
        console.log(`📊 Получено записей: ${result.recordset.length}\n`);

        if (result.recordset.length > 0) {
            console.log('🔍 Первые 5 записей:\n');

            result.recordset.slice(0, 5).forEach((row, index) => {
                console.log(`═══ Запись ${index + 1} ═══`);

                // Выводим все поля
                Object.keys(row).forEach(key => {
                    let value = row[key];

                    // Форматируем даты
                    if (value instanceof Date) {
                        value = value.toISOString().replace('T', ' ').substring(0, 19);
                    }

                    // Подсветка пустых значений
                    if (value === null || value === undefined || value === '') {
                        value = '(пусто)';
                    }

                    console.log(`  ${key}: ${value}`);
                });

                console.log();
            });

            // Статистика по статусам
            console.log('📊 Статистика по статусам:');
            const statusCounts = {};
            result.recordset.forEach(row => {
                const status = row.status_name || 'Неизвестно';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });

            Object.keys(statusCounts).forEach(status => {
                console.log(`  ${status}: ${statusCounts[status]} единиц`);
            });
            console.log();

            // Проверка обязательных полей
            console.log('✅ Проверка обязательных полей:');
            const requiredFields = [
                'equipment_name',
                'mssql_type',
                'status_id',
                'status_name'
            ];

            const firstRow = result.recordset[0];
            requiredFields.forEach(field => {
                const hasField = field in firstRow;
                const hasValue = firstRow[field] !== null && firstRow[field] !== undefined;

                if (hasField && hasValue) {
                    console.log(`  ✅ ${field}: OK (${firstRow[field]})`);
                } else if (hasField) {
                    console.log(`  ⚠️ ${field}: Поле есть, но значение пустое`);
                } else {
                    console.log(`  ❌ ${field}: Поле отсутствует в результате!`);
                }
            });
            console.log();

            // Проверка необязательных но важных полей
            console.log('📝 Проверка дополнительных полей:');
            const optionalFields = [
                'equipment_model',
                'reason_name',
                'down_start_time'
            ];

            optionalFields.forEach(field => {
                const hasField = field in firstRow;
                const hasValue = firstRow[field] !== null && firstRow[field] !== undefined && firstRow[field] !== '';

                if (hasField && hasValue) {
                    console.log(`  ✅ ${field}: ${firstRow[field]}`);
                } else if (hasField) {
                    console.log(`  ⚠️ ${field}: Пусто (это нормально если данных нет)`);
                } else {
                    console.log(`  ❌ ${field}: Поле отсутствует - проверьте SQL запрос!`);
                }
            });
            console.log();

            // Рекомендации
            console.log('💡 Рекомендации:');

            if (!('down_start_time' in firstRow)) {
                console.log('  ⚠️ Поле down_start_time отсутствует');
                console.log('     Добавьте в SELECT одно из:');
                console.log('     - e.status_changed_at as down_start_time');
                console.log('     - e.updated_at as down_start_time');
            }

            if (!('equipment_model' in firstRow) || !firstRow.equipment_model) {
                console.log('  ⚠️ Модель техники отсутствует или пустая');
                console.log('     Добавьте в SELECT: e.model as equipment_model');
            }

            if (!('reason_name' in firstRow)) {
                console.log('  ⚠️ Причина простоя не получена');
                console.log('     Проверьте JOIN с таблицей reason/enum_tables');
            }

        } else {
            console.log('⚠️ Запрос не вернул ни одной записи!');
            console.log('\n🔍 Возможные причины:');
            console.log('  1. В БД нет техники с status_id IN (331, 332)');
            console.log('  2. Все записи помечены как deleted (deleted_at IS NOT NULL)');
            console.log('  3. Фильтр по типам техники слишком строгий');
            console.log('\n💡 Попробуйте упростить запрос:');
            console.log('  - Уберите фильтр по deleted_at');
            console.log('  - Уберите фильтр по типу техники');
            console.log('  - Уберите фильтр по статусам');
        }

        console.log('\n═══════════════════════════════════════════════');
        console.log('✅ ТЕСТ ЗАВЕРШЕН');
        console.log('═══════════════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ ОШИБКА ВЫПОЛНЕНИЯ ЗАПРОСА:');
        console.error('─'.repeat(50));
        console.error(error.message);

        if (error.number) {
            console.error(`\n🔢 Код ошибки MSSQL: ${error.number}`);
        }

        if (error.lineNumber) {
            console.error(`📍 Строка: ${error.lineNumber}`);
        }

        console.error('\n💡 Возможные причины:');
        console.error('  1. Неправильное название таблицы или колонки');
        console.error('  2. Нет прав на чтение таблицы');
        console.error('  3. Синтаксическая ошибка в SQL');
        console.error('  4. Таблица или колонка не существует');

        console.error('\n🔧 Рекомендации:');
        console.error('  1. Проверьте названия таблиц и колонок в БД');
        console.error('  2. Упростите запрос - уберите JOIN и сложные условия');
        console.error('  3. Проверьте права пользователя ics_ro');

    } finally {
        await closePool();
    }
}

// Запуск
console.log('🚀 Запуск теста SQL запроса...\n');
testQuery();