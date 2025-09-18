const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db = null;

function getDatabase() {
    if (!db) {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Ошибка подключения к БД:', err);
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

      -- Таблица оборудования
      CREATE TABLE IF NOT EXISTS equipment (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        priority TEXT NOT NULL DEFAULT 'normal',
        planned_start TEXT,
        planned_end TEXT,
        actual_start TEXT,
        actual_end TEXT,
        delay_hours INTEGER DEFAULT 0,
        malfunction TEXT,
        mechanic_name TEXT,
        progress INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Таблица истории изменений
      CREATE TABLE IF NOT EXISTS equipment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id TEXT NOT NULL,
        user_id INTEGER,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (equipment_id) REFERENCES equipment(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Индексы для оптимизации
      CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
      CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
      CREATE INDEX IF NOT EXISTS idx_history_equipment ON equipment_history(equipment_id);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON equipment_history(timestamp);
    `;

        database.exec(createTables, async (err) => {
            if (err) {
                reject(err);
                return;
            }

            // Создаем пользователя по умолчанию
            await createDefaultData(database);
            resolve();
        });
    });
}

async function createDefaultData(database) {
    return new Promise((resolve, reject) => {
        const bcrypt = require('bcryptjs');

        // Создаем администратора
        const adminPassword = bcrypt.hashSync('admin123', 10);
        const userPassword = bcrypt.hashSync('user123', 10);

        database.run(
            `INSERT OR IGNORE INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)`,
            ['admin', adminPassword, 'admin', 'Главный диспетчер'],
            function (err) {
                if (err) console.error('Ошибка создания админа:', err);
            }
        );

        database.run(
            `INSERT OR IGNORE INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)`,
            ['dispatcher', userPassword, 'dispatcher', 'Диспетчер смены'],
            function (err) {
                if (err) console.error('Ошибка создания диспетчера:', err);
            }
        );

        // Создаем тестовое оборудование
        const equipment = [
            {
                id: 'EX001',
                type: 'excavator',
                model: 'CAT 320D',
                status: 'in_repair',
                priority: 'high',
                planned_start: '08:00',
                planned_end: '08:15',
                delay_hours: 2,
                malfunction: 'Замена гусениц',
                mechanic_name: 'Иванов А.С.',
                progress: 65
            },
            {
                id: 'LD001',
                type: 'loader',
                model: 'CAT 966K',
                status: 'ready',
                priority: 'medium',
                planned_start: '09:30',
                planned_end: '09:30',
                delay_hours: 0,
                malfunction: '',
                mechanic_name: 'Петров В.И.',
                progress: 100
            },
            {
                id: 'EX002',
                type: 'excavator',
                model: 'Komatsu PC400',
                status: 'waiting',
                priority: 'critical',
                planned_start: '10:00',
                planned_end: '10:30',
                delay_hours: 4,
                malfunction: 'Ремонт двигателя',
                mechanic_name: 'Сидоров М.Н.',
                progress: 25
            },
            {
                id: 'LD002',
                type: 'loader',
                model: 'Volvo L120H',
                status: 'scheduled',
                priority: 'low',
                planned_start: '13:00',
                planned_end: '17:00',
                delay_hours: 0,
                malfunction: 'Плановое ТО',
                mechanic_name: 'Назарбаев',
                progress: 0
            }
        ];

        const stmt = database.prepare(`
      INSERT OR REPLACE INTO equipment 
      (id, type, model, status, priority, planned_start, planned_end, 
       delay_hours, malfunction, mechanic_name, progress) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        equipment.forEach(eq => {
            stmt.run([
                eq.id, eq.type, eq.model, eq.status, eq.priority,
                eq.planned_start, eq.planned_end, eq.delay_hours,
                eq.malfunction, eq.mechanic_name, eq.progress
            ]);
        });

        stmt.finalize();
        resolve();
    });
}

function closeDatabase() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Ошибка закрытия БД:', err);
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