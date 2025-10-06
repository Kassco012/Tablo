// backend/config/mssqlDatabase.js

const sql = require('mssql');

const mssqlConfig = {
    server: '10.35.4.10',
    user: 'ics_ro',
    password: 'ics_ro',
    database: 'jmineops',
    port: 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 30000,
        connectionTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise;

/**
 * Получить пул подключений к MSSQL
 */
const getPool = () => {
    if (!poolPromise) {
        console.log('🔌 Подключение к MSSQL...');
        poolPromise = new sql.ConnectionPool(mssqlConfig)
            .connect()
            .then(pool => {
                console.log('✅ Подключение к MSSQL установлено');
                console.log(`   Сервер: ${mssqlConfig.server}`);
                console.log(`   База данных: ${mssqlConfig.database}`);
                console.log(`   Пользователь: ${mssqlConfig.user}`);

                // Обработка ошибок подключения
                pool.on('error', err => {
                    console.error('❌ Ошибка пула MSSQL:', err);
                    poolPromise = null; // Сбросить пул для переподключения
                });

                return pool;
            })
            .catch(err => {
                console.error('❌ Ошибка подключения к MSSQL:', err.message);
                console.error('   Сервер:', mssqlConfig.server);
                console.error('   База данных:', mssqlConfig.database);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
};

/**
 * Проверить подключение к MSSQL
 */
const testConnection = async () => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT @@VERSION as version');
        console.log('✅ MSSQL доступен');
        console.log('   Версия:', result.recordset[0].version.split('\n')[0]);
        return true;
    } catch (err) {
        console.error('❌ MSSQL недоступен:', err.message);
        return false;
    }
};

/**
 * Закрыть все подключения
 */
const closePool = async () => {
    try {
        if (poolPromise) {
            const pool = await poolPromise;
            await pool.close();
            poolPromise = null;
            console.log('🔌 Пул MSSQL закрыт');
        }
    } catch (err) {
        console.error('❌ Ошибка закрытия пула MSSQL:', err);
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
});

module.exports = {
    sql,
    getPool,
    testConnection,
    closePool
};