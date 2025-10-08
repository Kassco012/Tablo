// backend/scripts/exploreMSSQLDatabase.js
// Скрипт для автоматического исследования структуры MSSQL базы

const { getPool } = require('./config/mssqlDatabase');
const fs = require('fs').promises;
const path = require('path');

class DatabaseExplorer {
    constructor() {
        this.results = {};
    }

    /**
     * ГЛАВНАЯ ФУНКЦИЯ - запускает все проверки
     */
    async explore() {
        console.log('🔍 Начинаю исследование базы данных MSSQL...\n');

        try {
            const pool = await getPool();

            // 1. Находим все таблицы
            console.log('📊 1. Получение списка всех таблиц...');
            this.results.allTables = await this.getAllTables(pool);
            console.log(`   Найдено таблиц: ${this.results.allTables.length}\n`);

            // 2. Находим таблицы связанные с оборудованием
            console.log('🚜 2. Поиск таблиц связанных с оборудованием...');
            this.results.equipmentTables = await this.findEquipmentTables(pool);
            console.log(`   Найдено: ${this.results.equipmentTables.length}\n`);

            // 3. Анализируем таблицу equipment
            console.log('🔧 3. Анализ основной таблицы equipment...');
            this.results.equipmentStructure = await this.analyzeEquipmentTable(pool);
            console.log(`   Колонок: ${this.results.equipmentStructure.columns.length}`);
            console.log(`   Foreign Keys: ${this.results.equipmentStructure.foreignKeys.length}\n`);

            // 4. Получаем статусы
            console.log('📋 4. Получение всех статусов...');
            this.results.statuses = await this.getStatuses(pool);
            console.log(`   Найдено статусов: ${this.results.statuses.length}\n`);

            // 5. Получаем причины (reasons)
            console.log('📝 5. Получение всех причин...');
            this.results.reasons = await this.getReasons(pool);
            console.log(`   Найдено причин: ${this.results.reasons.length}\n`);

            // 6. Ищем таблицы с моделями
            console.log('🏷️ 6. Поиск таблиц с моделями оборудования...');
            this.results.modelTables = await this.findModelTables(pool);
            console.log(`   Найдено: ${this.results.modelTables.length}\n`);

            // 7. Ищем таблицы с операторами/механиками
            console.log('👷 7. Поиск таблиц с операторами/механиками...');
            this.results.operatorTables = await this.findOperatorTables(pool);
            console.log(`   Найдено: ${this.results.operatorTables.length}\n`);

            // 8. Анализируем пример данных из equipment
            console.log('📄 8. Получение примеров данных из equipment...');
            this.results.sampleData = await this.getSampleEquipment(pool);
            console.log(`   Получено примеров: ${this.results.sampleData.length}\n`);

            // 9. Получаем связи между таблицами
            console.log('🔗 9. Анализ связей между таблицами...');
            this.results.relationships = await this.getRelationships(pool);
            console.log(`   Найдено связей: ${this.results.relationships.length}\n`);

            // 10. Сохраняем результаты
            console.log('💾 10. Сохранение результатов...');
            await this.saveResults();
            console.log('   ✅ Результаты сохранены в database_exploration.json\n');

            // Выводим рекомендации
            this.printRecommendations();

        } catch (error) {
            console.error('❌ Ошибка при исследовании:', error);
            throw error;
        }
    }

    async getAllTables(pool) {
        const query = `
            SELECT 
                t.name AS table_name,
                s.name AS schema_name,
                p.rows AS row_count
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.partitions p ON t.object_id = p.object_id
            WHERE p.index_id IN (0,1)
            ORDER BY p.rows DESC
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    }

    async findEquipmentTables(pool) {
        const query = `
            SELECT 
                t.name AS table_name,
                s.name AS schema_name,
                p.rows AS row_count
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.partitions p ON t.object_id = p.object_id
            WHERE (
                t.name LIKE '%equipment%' OR 
                t.name LIKE '%machine%' OR
                t.name LIKE '%vehicle%' OR
                t.name LIKE '%asset%' OR
                t.name LIKE '%unit%'
            )
            AND p.index_id IN (0,1)
            ORDER BY p.rows DESC
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    }

    async analyzeEquipmentTable(pool) {
        // Колонки
        const columnsQuery = `
            SELECT 
                c.name AS column_name,
                t.name AS data_type,
                c.max_length,
                c.is_nullable
            FROM sys.columns c
            INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
            WHERE c.object_id = OBJECT_ID('dbo.equipment')
            ORDER BY c.column_id
        `;
        const columns = await pool.request().query(columnsQuery);

        // Foreign Keys
        const fkQuery = `
            SELECT 
                fk.name AS fk_name,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
                OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            WHERE fk.parent_object_id = OBJECT_ID('dbo.equipment')
        `;
        const foreignKeys = await pool.request().query(fkQuery);

        return {
            columns: columns.recordset,
            foreignKeys: foreignKeys.recordset
        };
    }

    async getStatuses(pool) {
        try {
            const query = `
                SELECT 
                    id,
                    type,
                    name,
                    symbol,
                    description
                FROM dbo.enum_tables
                WHERE type = 'Status'
                ORDER BY id
            `;
            const result = await pool.request().query(query);
            return result.recordset;
        } catch (error) {
            console.warn('   ⚠️ Не удалось получить статусы:', error.message);
            return [];
        }
    }

    async getReasons(pool) {
        try {
            const query = `
                SELECT 
                    id,
                    type,
                    name,
                    symbol,
                    description
                FROM dbo.enum_tables
                WHERE type = 'Reason'
                ORDER BY id
            `;
            const result = await pool.request().query(query);
            return result.recordset;
        } catch (error) {
            console.warn('   ⚠️ Не удалось получить причины:', error.message);
            return [];
        }
    }

    async findModelTables(pool) {
        const query = `
            SELECT 
                t.name AS table_name,
                s.name AS schema_name,
                p.rows AS row_count
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.partitions p ON t.object_id = p.object_id
            WHERE (
                t.name LIKE '%model%' OR 
                t.name LIKE '%type%' OR
                t.name LIKE '%category%'
            )
            AND p.index_id IN (0,1)
            ORDER BY p.rows DESC
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    }

    async findOperatorTables(pool) {
        const query = `
            SELECT 
                t.name AS table_name,
                s.name AS schema_name,
                p.rows AS row_count
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.partitions p ON t.object_id = p.object_id
            WHERE (
                t.name LIKE '%operator%' OR 
                t.name LIKE '%mechanic%' OR
                t.name LIKE '%employee%' OR
                t.name LIKE '%worker%'
            )
            AND p.index_id IN (0,1)
            ORDER BY p.rows DESC
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    }

    async getSampleEquipment(pool) {
        try {
            const query = `
                SELECT TOP 10 * 
                FROM dbo.equipment
                WHERE deleted_at IS NULL
                ORDER BY updated_at DESC
            `;
            const result = await pool.request().query(query);
            return result.recordset;
        } catch (error) {
            console.warn('   ⚠️ Не удалось получить примеры:', error.message);
            return [];
        }
    }

    async getRelationships(pool) {
        const query = `
            SELECT 
                OBJECT_NAME(f.parent_object_id) AS from_table,
                COL_NAME(fc.parent_object_id, fc.parent_column_id) AS from_column,
                OBJECT_NAME(f.referenced_object_id) AS to_table,
                COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS to_column
            FROM sys.foreign_keys AS f
            INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id
            WHERE 
                OBJECT_NAME(f.parent_object_id) = 'equipment' OR
                OBJECT_NAME(f.referenced_object_id) = 'equipment'
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    }

    async saveResults() {
        const outputPath = path.join(__dirname, '../database_exploration.json');
        const json = JSON.stringify(this.results, null, 2);
        await fs.writeFile(outputPath, json, 'utf8');
    }

    printRecommendations() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 РЕКОМЕНДАЦИИ НА ОСНОВЕ АНАЛИЗА');
        console.log('='.repeat(70) + '\n');

        // 1. Статусы
        if (this.results.statuses.length > 0) {
            console.log('✅ СТАТУСЫ (найдено):\n');
            this.results.statuses.forEach(status => {
                console.log(`   ${status.id}: ${status.name} (${status.symbol || '-'})`);
            });
            console.log('');
        }

        // 2. Причины
        if (this.results.reasons.length > 0) {
            console.log('✅ ПРИЧИНЫ ПРОСТОЯ (найдено):\n');
            this.results.reasons.forEach(reason => {
                console.log(`   ${reason.id}: ${reason.name} (${reason.symbol || '-'})`);
            });
            console.log('');
        }

        // 3. Foreign Keys
        if (this.results.equipmentStructure.foreignKeys.length > 0) {
            console.log('🔗 СВЯЗИ ТАБЛИЦЫ equipment:\n');
            this.results.equipmentStructure.foreignKeys.forEach(fk => {
                console.log(`   ${fk.column_name} -> ${fk.referenced_table}.${fk.referenced_column}`);
            });
            console.log('');
        }

        // 4. Таблицы с моделями
        if (this.results.modelTables.length > 0) {
            console.log('🏷️ ВОЗМОЖНЫЕ ТАБЛИЦЫ С МОДЕЛЯМИ:\n');
            this.results.modelTables.slice(0, 5).forEach(table => {
                console.log(`   ${table.table_name} (${table.row_count} записей)`);
            });
            console.log('');
        }

        // 5. Таблицы с операторами
        if (this.results.operatorTables.length > 0) {
            console.log('👷 ВОЗМОЖНЫЕ ТАБЛИЦЫ С ОПЕРАТОРАМИ:\n');
            this.results.operatorTables.slice(0, 5).forEach(table => {
                console.log(`   ${table.table_name} (${table.row_count} записей)`);
            });
            console.log('');
        }

        console.log('💡 СЛЕДУЮЩИЕ ШАГИ:\n');
        console.log('   1. Откройте файл database_exploration.json');
        console.log('   2. Проверьте структуру данных в sampleData');
        console.log('   3. Найдите таблицу с моделями в modelTables');
        console.log('   4. Обновите маппинг в MSSQLSyncService.js');
        console.log('\n' + '='.repeat(70) + '\n');
    }
}

// Запуск
async function main() {
    const explorer = new DatabaseExplorer();
    try {
        await explorer.explore();
        console.log('✅ Исследование завершено успешно!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    }
}

// Экспорт для использования в других скриптах
if (require.main === module) {
    main();
}

module.exports = DatabaseExplorer;