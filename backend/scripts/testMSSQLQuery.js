// backend/scripts/testMSSQLQuery.js - ДИАГНОСТИКА БАЗЫ ДАННЫХ

const { getPool } = require('../config/mssqlDatabase');

async function testQueries() {
    try {
        console.log('='.repeat(70));
        console.log('🔍 ДИАГНОСТИКА БАЗЫ ДАННЫХ JMINEOPS');
        console.log('='.repeat(70));

        const pool = await getPool();

        // ========================================
        // ТЕСТ 1: Проверяем таблицу shift_states
        // ========================================
        console.log('\n📋 ТЕСТ 1: Общая статистика shift_states');
        console.log('-'.repeat(70));

        const test1 = await pool.request().query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(CASE WHEN time_end IS NULL THEN 1 END) as active_records,
                COUNT(CASE WHEN time_end IS NOT NULL THEN 1 END) as completed_records,
                COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as not_deleted,
                MIN(time) as earliest_time,
                MAX(time) as latest_time
            FROM dbo.shift_states
        `);
        console.log('Результат:', test1.recordset[0]);

        // ========================================
        // ТЕСТ 2: Проверяем статусы
        // ========================================
        console.log('\n📋 ТЕСТ 2: Статусы в shift_states');
        console.log('-'.repeat(70));

        const test2 = await pool.request().query(`
            SELECT 
                status_id,
                COUNT(*) as count,
                COUNT(CASE WHEN time_end IS NULL THEN 1 END) as active_count
            FROM dbo.shift_states
            WHERE deleted_at IS NULL
            GROUP BY status_id
            ORDER BY count DESC
        `);
        console.log('Статусы:');
        test2.recordset.forEach(row => {
            console.log(`  Status ${row.status_id}: всего ${row.count}, активных ${row.active_count}`);
        });

        // ========================================
        // ТЕСТ 3: Статус 331 (Down)
        // ========================================
        console.log('\n📋 ТЕСТ 3: Активные простои (status_id = 331, time_end IS NULL)');
        console.log('-'.repeat(70));

        const test3 = await pool.request().query(`
            SELECT 
                COUNT(*) as down_count,
                COUNT(CASE WHEN time >= CAST(GETDATE() AS DATE) THEN 1 END) as today_down,
                COUNT(CASE WHEN time >= DATEADD(day, -7, GETDATE()) THEN 1 END) as week_down
            FROM dbo.shift_states
            WHERE 
                deleted_at IS NULL
                AND status_id = 331
                AND time_end IS NULL
        `);
        console.log('Результат:', test3.recordset[0]);

        // ========================================
        // ТЕСТ 4: Проверяем таблицу equipment
        // ========================================
        console.log('\n📋 ТЕСТ 4: Статистика таблицы equipment');
        console.log('-'.repeat(70));

        const test4 = await pool.request().query(`
            SELECT 
                COUNT(*) as total_equipment,
                COUNT(CASE WHEN enabled = 1 THEN 1 END) as enabled_equipment,
                COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as not_deleted
            FROM dbo.equipment
        `);
        console.log('Результат:', test4.recordset[0]);

        // ========================================
        // ТЕСТ 5: Типы техники
        // ========================================
        console.log('\n📋 ТЕСТ 5: Типы техники в equipment');
        console.log('-'.repeat(70));

        const test5 = await pool.request().query(`
            SELECT 
                type,
                COUNT(*) as count
            FROM dbo.equipment
            WHERE deleted_at IS NULL AND enabled = 1
            GROUP BY type
            ORDER BY count DESC
        `);
        console.log('Типы техники:');
        test5.recordset.forEach(row => {
            console.log(`  ${row.type}: ${row.count}`);
        });

        // ========================================
        // ТЕСТ 6: Проверяем JOIN
        // ========================================
        console.log('\n📋 ТЕСТ 6: Тест JOIN shift_states + equipment');
        console.log('-'.repeat(70));

        const test6 = await pool.request().query(`
            SELECT 
                COUNT(*) as joined_records
            FROM dbo.shift_states ss
            INNER JOIN dbo.equipment e ON ss.equipment_id = e.id
            WHERE 
                ss.deleted_at IS NULL
                AND e.deleted_at IS NULL
                AND e.enabled = 1
                AND ss.status_id = 331
                AND ss.time_end IS NULL
        `);
        console.log('Количество записей после JOIN:', test6.recordset[0].joined_records);

        // ========================================
        // ТЕСТ 7: Первые 5 активных Down записей
        // ========================================
        console.log('\n📋 ТЕСТ 7: Первые 5 активных Down записей (если есть)');
        console.log('-'.repeat(70));

        const test7 = await pool.request().query(`
            SELECT TOP 5
                ss.id,
                ss.equipment_id,
                ss.status_id,
                ss.time,
                ss.time_end,
                e.name as equipment_name,
                e.type as equipment_type,
                e.enabled,
                e.deleted_at as equipment_deleted
            FROM dbo.shift_states ss
            LEFT JOIN dbo.equipment e ON ss.equipment_id = e.id
            WHERE 
                ss.deleted_at IS NULL
                AND ss.status_id = 331
                AND ss.time_end IS NULL
            ORDER BY ss.time DESC
        `);

        if (test7.recordset.length > 0) {
            console.log(`Найдено ${test7.recordset.length} записей:`);
            test7.recordset.forEach((row, index) => {
                console.log(`\n${index + 1}. Shift State ID: ${row.id}`);
                console.log(`   Equipment ID: ${row.equipment_id}`);
                console.log(`   Equipment Name: ${row.equipment_name || 'NULL'}`);
                console.log(`   Equipment Type: ${row.equipment_type || 'NULL'}`);
                console.log(`   Enabled: ${row.enabled}`);
                console.log(`   Deleted: ${row.equipment_deleted || 'NO'}`);
                console.log(`   Time: ${row.time}`);
                console.log(`   Time End: ${row.time_end || 'NULL (активный)'}`);
            });
        } else {
            console.log('❌ НЕТ активных Down записей!');
        }

        // ========================================
        // ТЕСТ 8: Последние записи (любой статус)
        // ========================================
        console.log('\n📋 ТЕСТ 8: Последние 10 записей shift_states (любой статус)');
        console.log('-'.repeat(70));

        const test8 = await pool.request().query(`
            SELECT TOP 10
                ss.id,
                ss.equipment_id,
                ss.status_id,
                ss.time,
                ss.time_end,
                status_enum.name as status_name,
                e.name as equipment_name,
                e.type as equipment_type
            FROM dbo.shift_states ss
            LEFT JOIN dbo.equipment e ON ss.equipment_id = e.id
            LEFT JOIN dbo.enum_tables status_enum ON ss.status_id = status_enum.id
            WHERE ss.deleted_at IS NULL
            ORDER BY ss.time DESC
        `);

        console.log(`Найдено ${test8.recordset.length} последних записей:`);
        test8.recordset.forEach((row, index) => {
            console.log(`\n${index + 1}. Equipment: ${row.equipment_name || `ID ${row.equipment_id}`}`);
            console.log(`   Type: ${row.equipment_type || 'N/A'}`);
            console.log(`   Status: ${row.status_name || row.status_id}`);
            console.log(`   Time: ${row.time}`);
            console.log(`   Time End: ${row.time_end || 'NULL (активный)'}`);
        });

        console.log('\n' + '='.repeat(70));
        console.log('✅ ДИАГНОСТИКА ЗАВЕРШЕНА');
        console.log('='.repeat(70));

        process.exit(0);

    } catch (error) {
        console.error('❌ Ошибка диагностики:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testQueries();