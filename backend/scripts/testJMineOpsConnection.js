// backend/scripts/testSQLQuery.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ - тестирует запрос к shift_states

require('dotenv').config();
const { getPool, closePool } = require('../config/mssqlDatabase');

/**
 * ГЛАВНЫЙ ЗАПРОС - берет простои за СЕГОДНЯ из shift_states
 */
const YOUR_SQL_QUERY = `
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
        ld.time as down_start_time

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

async function testQuery() {
    console.log('═══════════════════════════════════════════════');
    console.log('🔍 ТЕСТ SQL ЗАПРОСА (shift_states за СЕГОДНЯ)');
    console.log('═══════════════════════════════════════════════\n');
    console.log('📅 Дата запроса:', new Date().toLocaleDateString('ru-RU'));
    console.log('🕐 Время запроса:', new Date().toLocaleTimeString('ru-RU'));
    console.log();

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
            console.log('🔍 Все записи:\n');

            result.recordset.forEach((row, index) => {
                console.log(`═══ Запись ${index + 1} ═══`);

                // Выводим все поля
                Object.keys(row).forEach(key => {
                    let value = row[key];

                    // Форматируем даты
                    if (value instanceof Date) {
                        value = value.toLocaleString('ru-RU');
                    }

                    // Подсветка пустых значений
                    if (value === null || value === undefined || value === '') {
                        value = '(пусто)';
                    }

                    console.log(`  ${key}: ${value}`);
                });

                console.log();
            });

            // Статистика
            console.log('📊 Статистика:');

            // По типам
            const typeCount = {};
            result.recordset.forEach(row => {
                const type = row.mssql_type || 'Неизвестно';
                typeCount[type] = (typeCount[type] || 0) + 1;
            });

            console.log('\n  По типам техники:');
            Object.keys(typeCount).forEach(type => {
                console.log(`    ${type}: ${typeCount[type]}`);
            });

            // По причинам
            const reasonCount = {};
            result.recordset.forEach(row => {
                const reason = row.reason_name || 'Не указана';
                reasonCount[reason] = (reasonCount[reason] || 0) + 1;
            });

            console.log('\n  По причинам:');
            Object.keys(reasonCount).forEach(reason => {
                console.log(`    ${reason}: ${reasonCount[reason]}`);
            });

            // Временной диапазон
            const times = result.recordset
                .map(row => new Date(row.down_start_time))
                .sort((a, b) => a - b);

            if (times.length > 0) {
                console.log('\n  Временной диапазон:');
                console.log(`    Первый простой: ${times[0].toLocaleTimeString('ru-RU')}`);
                console.log(`    Последний простой: ${times[times.length - 1].toLocaleTimeString('ru-RU')}`);
            }

            // Проверка обязательных полей
            console.log('\n✅ Проверка обязательных полей:');
            const requiredFields = [
                'equipment_name',
                'mssql_type',
                'status_id',
                'status_name',
                'down_start_time'
            ];

            const firstRow = result.recordset[0];
            let allFieldsOk = true;

            requiredFields.forEach(field => {
                const hasField = field in firstRow;
                const hasValue = firstRow[field] !== null && firstRow[field] !== undefined && firstRow[field] !== '';

                if (hasField && hasValue) {
                    console.log(`  ✅ ${field}: OK`);
                } else if (hasField) {
                    console.log(`  ⚠️ ${field}: Поле есть, но значение пустое`);
                    allFieldsOk = false;
                } else {
                    console.log(`  ❌ ${field}: Поле отсутствует!`);
                    allFieldsOk = false;
                }
            });

            // Проверка дополнительных полей
            console.log('\n📝 Проверка дополнительных полей:');
            const optionalFields = [
                'equipment_model',
                'reason_name'
            ];

            optionalFields.forEach(field => {
                const hasField = field in firstRow;
                const hasValue = firstRow[field] !== null && firstRow[field] !== undefined && firstRow[field] !== '';

                if (hasField && hasValue) {
                    console.log(`  ✅ ${field}: ${firstRow[field]}`);
                } else if (hasField) {
                    console.log(`  ⚠️ ${field}: Пусто (это нормально если данных нет)`);
                } else {
                    console.log(`  ❌ ${field}: Поле отсутствует`);
                }
            });

            // Итоговая оценка
            console.log('\n' + '═'.repeat(50));
            if (allFieldsOk) {
                console.log('✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!');
                console.log('\n🚀 ЗАПРОС ГОТОВ К ИСПОЛЬЗОВАНИЮ');
                console.log('   Скопируйте его в JMineOpsDataService.js');
            } else {
                console.log('⚠️ ЕСТЬ ПРОБЛЕМЫ С ПОЛЯМИ');
                console.log('   Проверьте структуру БД и исправьте запрос');
            }

        } else {
            console.log('⚠️ Запрос не вернул ни одной записи!\n');
            console.log('🔍 Возможные причины:');
            console.log('  1. Сегодня нет простоев (это нормально!)');
            console.log('  2. Нет данных в shift_states за сегодня');
            console.log('  3. Все записи отфильтрованы (deleted_at, enabled, type)');
            console.log('\n💡 Попробуйте:');
            console.log('  1. Проверить есть ли данные вообще:');
            console.log('     SELECT COUNT(*) FROM shift_states WHERE status_id = 331;');
            console.log('  2. Посмотреть последние записи:');
            console.log('     SELECT TOP 10 * FROM shift_states ORDER BY time DESC;');
            console.log('  3. Подождать до появления простоя');
        }

        console.log('\n═══════════════════════════════════════════════');
        console.log('✅ ТЕСТ ЗАВЕРШЕН');
        console.log('═══════════════════════════════════════════════\n');

        console.log('📝 СЛЕДУЮЩИЕ ШАГИ:');
        if (result.recordset.length > 0) {
            console.log('1. ✅ Запрос работает корректно');
            console.log('2. ✅ Данные получены успешно');
            console.log('3. 🚀 Запустите backend: npm start');
            console.log('4. 🌐 Откройте frontend: http://localhost:3001');
        } else {
            console.log('1. ⏳ Дождитесь появления простоя');
            console.log('2. 🔄 Запустите тест снова');
            console.log('3. 🚀 Или запустите систему - она будет ждать данные');
        }

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
        console.error('  1. Таблица shift_states не существует');
        console.error('  2. Таблица reasons не существует');
        console.error('  3. Неправильное название колонки');
        console.error('  4. Нет прав на чтение таблиц');

        console.error('\n🔧 Рекомендации:');
        console.error('  1. Проверьте структуру таблиц:');
        console.error('     SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = \'shift_states\';');
        console.error('  2. Проверьте что таблицы существуют:');
        console.error('     SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES;');
        console.error('  3. Упростите запрос и тестируйте по частям');
        console.error('  4. Запустите testJMineOpsConnection.js для диагностики');

    } finally {
        await closePool();
    }
}

// Запуск
console.log('🚀 Запуск теста SQL запроса...\n');
testQuery();