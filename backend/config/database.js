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
            -- Таблица пользователей (БЕЗ email)
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
                equipment_type TEXT NOT NULL,
                model TEXT,
                actual_start TEXT,
                actual_end TEXT,
                planned_hours REAL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'Ready',
                malfunction TEXT,
                mechanic_name TEXT,
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
                equipment_type TEXT NOT NULL,
                model TEXT,
                status TEXT NOT NULL,
                actual_start TEXT,
                actual_end TEXT,
                planned_hours REAL DEFAULT 0,
                malfunction TEXT,
                mechanic_name TEXT,
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

            // ✅ МИГРАЦИЯ: Добавляем колонку planned_hours если её нет
            await migrateDatabase(database);

            await createDefaultUsers(database);
            resolve();
        });
    });
}

// ✅ НОВАЯ ФУНКЦИЯ: Миграция БД для добавления planned_hours
async function migrateDatabase(database) {
    return new Promise((resolve) => {
        console.log('🔄 Проверка миграций...');

        // Проверяем, есть ли колонка planned_hours в equipment_master
        database.all("PRAGMA table_info(equipment_master)", [], (err, columns) => {
            if (err) {
                console.error('❌ Ошибка проверки структуры таблицы:', err);
                resolve();
                return;
            }

            const hasPlannedHours = columns.some(col => col.name === 'planned_hours');

            if (!hasPlannedHours) {
                console.log('🔄 Добавление колонки planned_hours в equipment_master...');
                database.run(
                    'ALTER TABLE equipment_master ADD COLUMN planned_hours REAL DEFAULT 0',
                    (err) => {
                        if (err) {
                            console.error('❌ Ошибка добавления planned_hours в equipment_master:', err);
                        } else {
                            console.log('✅ Колонка planned_hours добавлена в equipment_master');
                        }

                        // Добавляем в таблицу архива
                        database.all("PRAGMA table_info(equipment_archive)", [], (err, archiveColumns) => {
                            if (err) {
                                console.error('❌ Ошибка проверки структуры таблицы архива:', err);
                                resolve();
                                return;
                            }

                            const archiveHasPlannedHours = archiveColumns.some(col => col.name === 'planned_hours');

                            if (!archiveHasPlannedHours) {
                                console.log('🔄 Добавление колонки planned_hours в equipment_archive...');
                                database.run(
                                    'ALTER TABLE equipment_archive ADD COLUMN planned_hours REAL DEFAULT 0',
                                    (err) => {
                                        if (err) {
                                            console.error('❌ Ошибка добавления planned_hours в equipment_archive:', err);
                                        } else {
                                            console.log('✅ Колонка planned_hours добавлена в equipment_archive');
                                        }
                                        resolve();
                                    }
                                );
                            } else {
                                console.log('✅ Колонка planned_hours уже существует в equipment_archive');
                                resolve();
                            }
                        });
                    }
                );
            } else {
                console.log('✅ Колонка planned_hours уже существует в equipment_master');

                // Проверяем архив
                database.all("PRAGMA table_info(equipment_archive)", [], (err, archiveColumns) => {
                    if (err) {
                        console.error('❌ Ошибка проверки структуры таблицы архива:', err);
                        resolve();
                        return;
                    }

                    const archiveHasPlannedHours = archiveColumns.some(col => col.name === 'planned_hours');

                    if (!archiveHasPlannedHours) {
                        console.log('🔄 Добавление колонки planned_hours в equipment_archive...');
                        database.run(
                            'ALTER TABLE equipment_archive ADD COLUMN planned_hours REAL DEFAULT 0',
                            (err) => {
                                if (err) {
                                    console.error('❌ Ошибка добавления planned_hours в equipment_archive:', err);
                                } else {
                                    console.log('✅ Колонка planned_hours добавлена в equipment_archive');
                                }
                                resolve();
                            }
                        );
                    } else {
                        console.log('✅ Колонка planned_hours уже существует в equipment_archive');
                        resolve();
                    }
                });
            }
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
                role: 'programmer',
                full_name: 'Касымжан Нуралиев'
            },
            {
                username: 'yelnur.Zhumagaliyev@Kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Елнур Жумагалиев'
            },
            {
                username: 'iliyas.sagyndyk@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Ильяс Сагындык'
            },
            {
                username: 'anna.demakova@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Анна Демакова'
            },
            {
                username: 'ualikhan.belgibay@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Уалихан Белгибай'
            },
            {
                username: 'assel.zhumadilova@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Асель Жумадилова'
            },
            {
                username: 'dias.mukhamedbekov@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Диас Мухамедбеков'
            },
            {
                username: 'nurtay.oraltayev@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Нұртай Оралтаев'
            },
            {
                username: 'tamara.borisenko@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Тамара Борисенко'
            },
            {
                username: 'aidyn.sarsembinov@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Айдын Сәрсембинов'
            },
            {
                username: 'anuar.alibay@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Әнуар Әлібай'
            },
            {
                username: 'aizada.kabidenova@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Айзада Кабиденова'
            },
            {
                username: 'adilet.oskenbayev@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Адилет Оскинбаев'
            },
            {
                username: 'temirlan.kaidar@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Кайдар Темирлан'
            },
            {
                username: 'nikita.zabarin@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Никита Забарин'
            },
            {
                username: 'akmaral.bakchakova@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Акмарал Бакчакова'
            },
            {
                username: 'alimzhan.nurtazin@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Алимжан Нуртазин'
            },
            {
                username: 'ansar.rysbayev@kazminerals.com',
                password: bcrypt.hashSync('KAL2025', 10),
                role: 'dispatcher',
                full_name: 'Ансар Рысбаев'
            },
        ];

        let completed = 0;
        users.forEach(user => {
            database.run(
                `INSERT OR IGNORE INTO users (username, password, role, full_name) 
                 VALUES (?, ?, ?, ?)`,
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

// ============================================
// ПРОМИСИФИЦИРОВАННЫЕ МЕТОДЫ
// ============================================

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        database.get(sql, params, (err, row) => {
            if (err) {
                console.error('❌ DB GET Error:', err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        database.all(sql, params, (err, rows) => {
            if (err) {
                console.error('❌ DB ALL Error:', err);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        const database = getDatabase();
        database.run(sql, params, function (err) {
            if (err) {
                console.error('❌ DB RUN Error:', err);
                reject(err);
            } else {
                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        });
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
});

module.exports = {
    getDatabase,
    initializeDatabase,
    closeDatabase,
    get,
    all,
    run
};