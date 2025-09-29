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

      -- Таблица оборудования (активного)
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

      -- Новая таблица архива оборудования
      CREATE TABLE IF NOT EXISTS equipment_archive (
        id TEXT NOT NULL,
        type TEXT NOT NULL,
        model TEXT NOT NULL,
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
        original_table TEXT DEFAULT 'equipment',
        archive_id INTEGER PRIMARY KEY AUTOINCREMENT,
        FOREIGN KEY (completion_user) REFERENCES users(id)
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
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Индексы для оптимизации
      CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
      CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
      CREATE INDEX IF NOT EXISTS idx_equipment_priority ON equipment(priority);
      
      -- Индексы для архива
      CREATE INDEX IF NOT EXISTS idx_archive_completed_date ON equipment_archive(completed_date);
      CREATE INDEX IF NOT EXISTS idx_archive_reason ON equipment_archive(archive_reason);
      CREATE INDEX IF NOT EXISTS idx_archive_type ON equipment_archive(type);
      CREATE INDEX IF NOT EXISTS idx_archive_mechanic ON equipment_archive(mechanic_name);
      CREATE INDEX IF NOT EXISTS idx_archive_id ON equipment_archive(id);
      
      -- Индексы для истории
      CREATE INDEX IF NOT EXISTS idx_history_equipment ON equipment_history(equipment_id);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON equipment_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_history_action ON equipment_history(action);
    `;

        database.exec(createTables, async (err) => {
            if (err) {
                reject(err);
                return;
            }

            // Создаем пользователя по умолчанию и тестовые данные
            await createDefaultData(database);
            resolve();
        });
    });
}

async function createDefaultData(database) {
    return new Promise((resolve, reject) => {
        const bcrypt = require('bcryptjs');

        // Создаем реальных пользователей
        const adminPassword = bcrypt.hashSync('Kazmin2025', 10);
        const dispatcherPassword = bcrypt.hashSync('Kazmin2025', 10);

        database.run(
            `INSERT OR IGNORE INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)`,
            ['timur.abitov@kazminerals.com', adminPassword, 'admin', 'Тимур Абитов'],
            function (err) {
                if (err) console.error('Ошибка создания админа:', err);
            }
        );

        database.run(
            `INSERT OR IGNORE INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)`,
            ['kassymzhan.nuraliyev@kazminerals.com', dispatcherPassword, 'dispatcher', 'Касымжан Нуралиев'],
            function (err) {
                if (err) console.error('Ошибка создания диспетчера:', err);
            }
        );

        // Создаем тестовое оборудование (больше данных)
        const equipment = [
            {
                id: 'EX001',
                type: 'excavator',
                model: 'CAT 320D',
                status: 'Down',
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
                status: 'Ready',
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
                status: 'Delay',
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
                status: 'Standby',
                priority: 'low',
                planned_start: '13:00',
                planned_end: '17:00',
                delay_hours: 0,
                malfunction: 'Плановое ТО',
                mechanic_name: 'Назарбаев',
                progress: 0
            },
            // Добавляем больше техники для демонстрации
            {
                id: 'EX003',
                type: 'excavator',
                model: 'JCB JS220',
                status: 'Ready',
                priority: 'normal',
                planned_start: '14:00',
                planned_end: '16:00',
                delay_hours: 0,
                malfunction: '',
                mechanic_name: 'Алимов К.Т.',
                progress: 100
            },
            {
                id: 'LD003',
                type: 'loader',
                model: 'Liebherr L580',
                status: 'Standby',
                priority: 'medium',
                planned_start: '07:00',
                planned_end: '12:00',
                delay_hours: 0,
                malfunction: 'Плановая диагностика',
                mechanic_name: 'Жанибеков А.М.',
                progress: 0
            },
            {
                id: 'EX004',
                type: 'excavator',
                model: 'Hitachi ZX350',
                status: 'Ready',
                priority: 'normal',
                planned_start: '15:00',
                planned_end: '17:30',
                delay_hours: 0,
                malfunction: '',
                mechanic_name: 'Искаков Д.С.',
                progress: 100
            },
            {
                id: 'LD004',
                type: 'loader',
                model: 'CAT 980K',
                status: 'Standby',
                priority: 'high',
                planned_start: '06:00',
                planned_end: '11:00',
                delay_hours: 0,
                malfunction: 'Замена масла',
                mechanic_name: 'Токтарбаев Н.К.',
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

        // Создаем несколько архивных записей для демонстрации
        const archiveEquipment = [
            {
                id: 'EX100',
                type: 'excavator',
                model: 'CAT 325D',
                status: 'launched',
                priority: 'normal',
                planned_start: '08:00',
                planned_end: '12:00',
                actual_start: '08:15',
                actual_end: '11:45',
                delay_hours: 0,
                malfunction: 'Замена фильтров',
                mechanic_name: 'Иванов А.С.',
                progress: 100,
                created_at: '2025-09-20 08:00:00',
                updated_at: '2025-09-20 11:45:00',
                completed_date: '2025-09-20 11:45:00',
                completion_user: 1,
                archive_reason: 'launched'
            },
            {
                id: 'LD100',
                type: 'loader',
                model: 'Volvo L110F',
                status: 'launched',
                priority: 'high',
                planned_start: '13:00',
                planned_end: '16:00',
                actual_start: '13:10',
                actual_end: '15:50',
                delay_hours: 0,
                malfunction: 'Ремонт гидравлики',
                mechanic_name: 'Петров В.И.',
                progress: 100,
                created_at: '2025-09-19 13:00:00',
                updated_at: '2025-09-19 15:50:00',
                completed_date: '2025-09-19 15:50:00',
                completion_user: 2,
                archive_reason: 'launched'
            }
        ];

        const archiveStmt = database.prepare(`
      INSERT OR REPLACE INTO equipment_archive 
      (id, type, model, status, priority, planned_start, planned_end, 
       actual_start, actual_end, delay_hours, malfunction, mechanic_name, 
       progress, created_at, updated_at, completed_date, completion_user, archive_reason) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        archiveEquipment.forEach(eq => {
            archiveStmt.run([
                eq.id, eq.type, eq.model, eq.status, eq.priority,
                eq.planned_start, eq.planned_end, eq.actual_start, eq.actual_end,
                eq.delay_hours, eq.malfunction, eq.mechanic_name, eq.progress,
                eq.created_at, eq.updated_at, eq.completed_date, eq.completion_user, eq.archive_reason
            ]);
        });

        archiveStmt.finalize();
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