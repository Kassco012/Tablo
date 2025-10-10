// backend/migrations/001_create_equipment_master.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

async function runMigration() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
                reject(err);
                return;
            }
            console.log('✅ Подключение к SQLite установлено');
        });

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS equipment_master (
              -- 1. ID
              id TEXT PRIMARY KEY,
              
              -- 2. Участок
              section TEXT NOT NULL DEFAULT 'колесные техники',
              
              -- 3. Тип/Модель
              equipment_type TEXT NOT NULL,
              model TEXT,
              
              -- 4. Факт
              actual_start TEXT,
              actual_end TEXT,

              -- 5 План
              planned_start TEXT,
              planned_end TEXT,
              
              -- 6. Задержка
              delay_hours INTEGER DEFAULT 0,
              
              -- 7. Статус
              status TEXT NOT NULL DEFAULT 'Ready',
              priority TEXT DEFAULT 'normal',
              
              -- 8. Неисправность
              malfunction TEXT,
              
              -- 9. Механик
              mechanic_name TEXT,
              
              -- Связь с MSSQL (для синхронизации)
              mssql_equipment_id INTEGER UNIQUE,
              mssql_type TEXT,
              mssql_status_id INTEGER,
              mssql_reason TEXT,
              last_sync_time DATETIME,
              
              -- Служебные поля
              is_active INTEGER DEFAULT 1,
              manually_edited INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;

        const createIndexesSQL = `
            CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment_master(status);
            CREATE INDEX IF NOT EXISTS idx_equipment_section ON equipment_master(section);
            CREATE INDEX IF NOT EXISTS idx_equipment_active ON equipment_master(is_active);
            CREATE INDEX IF NOT EXISTS idx_equipment_mssql_id ON equipment_master(mssql_equipment_id);
        `;

        db.serialize(() => {
            // Создаем таблицу
            db.run(createTableSQL, (err) => {
                if (err) {
                    console.error('❌ Ошибка создания таблицы equipment_master:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Таблица equipment_master создана');
            });

            // Создаем индексы
            db.exec(createIndexesSQL, (err) => {
                if (err) {
                    console.error('❌ Ошибка создания индексов:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Индексы созданы');
            });

            db.close((err) => {
                if (err) {
                    console.error('❌ Ошибка закрытия БД:', err);
                    reject(err);
                } else {
                    console.log('✅ Миграция завершена успешно');
                    resolve();
                }
            });
        });
    });
}

// Запуск миграции
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('\n🎉 Миграция выполнена успешно!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n💥 Ошибка миграции:', err);
            process.exit(1);
        });
}

module.exports = { runMigration };