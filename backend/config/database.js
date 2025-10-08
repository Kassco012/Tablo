const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db = null;

function getDatabase() {
    if (!db) {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
            } else {
                console.log('📦 Подключение к SQLite установлено');
            }
        });
    }
    return db;
}

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const database = getDatabase();

        const createTables = `
            -- Таблица пользователей
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                full_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            );

            -- Основная таблица оборудования
            CREATE TABLE IF NOT EXISTS equipment_master (
                id TEXT PRIMARY KEY,
                section TEXT NOT NULL DEFAULT 'колесные техники',
                equipment_type TEXT NOT NULL,
                model TEXT,
                planned_start TEXT,
                planned_end TEXT,
                actual_start TEXT,
                actual_end TEXT,
                delay_hours INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'Ready',
                priority TEXT DEFAULT 'normal',
                malfunction TEXT,
                mechanic_name TEXT,
                progress INTEGER DEFAULT 0,
                mssql_equipment_id INTEGER,
                mssql_type TEXT,
                mssql_status_id INTEGER,
                mssql_reason TEXT,
                last_sync_time DATETIME,
                is_active INTEGER DEFAULT 1,
                manually_edited INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Таблица архива
            CREATE TABLE IF NOT EXISTS equipment_archive (
                archive_id INTEGER PRIMARY KEY AUTOINCREMENT,
                id TEXT NOT NULL,
                section TEXT NOT NULL,
                equipment_type TEXT NOT NULL,
                model TEXT,
                status TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'normal',
                planned_start TEXT,
                planned_end TEXT,
                actual_start TEXT,
                actual_end TEXT,
                delay_hours INTEGER DEFAULT 0,
                malfunction TEXT,
                mechanic_name TEXT,
                progress INTEGER DEFAULT 0,
                created_at DATETIME,
                updated_at DATETIME,
                completed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                completion_user INTEGER,
                archive_reason TEXT DEFAULT 'launched',
                FOREIGN KEY (completion_user) REFERENCES users(id)
            );

            -- Таблица истории
            CREATE TABLE IF NOT EXISTS equipment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipment_id TEXT NOT NULL,
                user_id INTEGER,
                action TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            -- Индексы для equipment_master
            CREATE INDEX IF NOT EXISTS idx_master_status ON equipment_master(status);
            CREATE INDEX IF NOT EXISTS idx_master_section ON equipment_master(section);
            CREATE INDEX IF NOT EXISTS idx_master_active ON equipment_master(is_active);
            CREATE INDEX IF NOT EXISTS idx_master_mssql_id ON equipment_master(mssql_equipment_id);
            
            -- Индексы для архива
            CREATE INDEX IF NOT EXISTS idx_archive_completed ON equipment_archive(completed_date);
            CREATE INDEX IF NOT EXISTS idx_archive_id ON equipment_archive(id);
            
            -- Индексы для истории
            CREATE INDEX IF NOT EXISTS idx_history_equipment ON equipment_history(equipment_id);
            CREATE INDEX IF NOT EXISTS idx_history_timestamp ON equipment_history(timestamp);
        `;

        database.exec(createTables, async (err) => {
            if (err) {
                console.error('❌ Ошибка создания таблиц:', err);
                reject(err);
                return;
            }

            console.log('✅ Таблицы созданы успешно');
            await createDefaultUsers(database);
            resolve();
        });
    });
}

async function createDefaultUsers(database) {
    return new Promise((resolve) => {
        const bcrypt = require('bcryptjs');

        const users = [
            {
                username: 'timur.abitov@kazminerals.com',
                password: bcrypt.hashSync('Kazmin2025', 10),
                role: 'admin',
                full_name: 'Тимур Абитов'
            },
            {
                username: 'kassymzhan.nuraliyev@kazminerals.com',
                password: bcrypt.hashSync('Kazmin2025', 10),
                role: 'dispatcher',
                full_name: 'Касымжан Нуралиев'
            }
        ];

        let completed = 0;
        users.forEach(user => {
            database.run(
                `INSERT OR IGNORE INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)`,
                [user.username, user.password, user.role, user.full_name],
                function (err) {
                    if (err) {
                        console.error(`❌ Ошибка создания пользователя ${user.full_name}:`, err);
                    } else if (this.changes > 0) {
                        console.log(`✅ Пользователь создан: ${user.full_name}`);
                    }

                    completed++;
                    if (completed === users.length) {
                        resolve();
                    }
                }
            );
        });
    });
}

function closeDatabase() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('❌ Ошибка закрытия БД:', err);
            } else {
                console.log('📦 Соединение с БД закрыто');
            }
        });
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
});

module.exports = {
    getDatabase,
    initializeDatabase,
    closeDatabase
};