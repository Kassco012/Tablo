
const sql = require('mssql');

const mssqlConfig = {
    server: '10.35.4.10',
    user: 'ics_ro',
    password: 'ics_ro',
    database: 'ICS_Database', // уточнить название
    port: 1433, // стандартный порт MSSQL
    options: {
        encrypt: false, // для локальных подключений
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

const getPool = () => {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(mssqlConfig)
            .connect()
            .then(pool => {
                console.log('📊 Подключение к MSSQL установлено');
                return pool;
            })
            .catch(err => {
                console.error('❌ Ошибка подключения к MSSQL:', err);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
};

module.exports = {
    sql,
    getPool
};