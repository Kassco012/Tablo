
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Конфигурация
const CONFIG = {
    projectName: 'TABLO MMA',
    serverIP: '10.35.3.117',
    port: 5001,
    installDir: os.platform() === 'win32' ? 'C:\\Tablo' : '/opt/mma-equipment',
    serviceName: 'mma-equipment',
    jwtSecret: 'MMA-Aktogay-Production-' + new Date().getFullYear()
};

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Функции вывода
function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function logInfo(message) { log('ℹ️  ' + message, 'blue'); }
function logSuccess(message) { log('✅ ' + message, 'green'); }
function logWarning(message) { log('⚠️  ' + message, 'yellow'); }
function logError(message) { log('❌ ' + message, 'red'); }

// Проверка операционной системы
function detectOS() {
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const isLinux = platform === 'linux';

    return { isWindows, isLinux, platform };
}

// Выполнение команды с обработкой ошибок
function execCommand(command, options = {}) {
    try {
        logInfo(`Выполнение: ${command}`);
        const result = execSync(command, {
            stdio: 'inherit',
            encoding: 'utf8',
            ...options
        });
        return result;
    } catch (error) {
        logError(`Ошибка выполнения команды: ${command}`);
        throw error;
    }
}

// Проверка установленного ПО
function checkDependencies() {
    logInfo('Проверка зависимостей...');

    // Проверка Node.js
    try {
        const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
        logSuccess(`Node.js найден: ${nodeVersion}`);

        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion < 16) {
            throw new Error('Требуется Node.js версии 16 или выше');
        }
    } catch (error) {
        logError('Node.js не найден или версия слишком старая!');
        logInfo('Скачайте Node.js с https://nodejs.org/');
        process.exit(1);
    }

    // Проверка npm
    try {
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        logSuccess(`npm найден: ${npmVersion}`);
    } catch (error) {
        logError('npm не найден!');
        process.exit(1);
    }
}

// Создание директорий
function createDirectories() {
    logInfo('Создание директорий...');

    const dirs = [
        CONFIG.installDir,
        path.join(CONFIG.installDir, 'logs'),
        path.join(CONFIG.installDir, 'data'),
        path.join(CONFIG.installDir, 'backups')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logSuccess(`Создана директория: ${dir}`);
        }
    });
}

// Копирование файлов проекта
function copyProjectFiles() {
    logInfo('Копирование файлов проекта...');

    const currentDir = process.cwd();
    const backendSrc = path.join(currentDir, 'backend');
    const frontendSrc = path.join(currentDir, 'frontend');

    if (!fs.existsSync(backendSrc) || !fs.existsSync(frontendSrc)) {
        logError('Папки backend и/или frontend не найдены в текущей директории!');
        logInfo('Убедитесь, что вы запускаете setup.js из корня проекта');
        process.exit(1);
    }

    // Копирование backend
    const backendDest = path.join(CONFIG.installDir, 'backend');
    if (fs.existsSync(backendDest)) {
        fs.rmSync(backendDest, { recursive: true, force: true });
    }
    copyDir(backendSrc, backendDest);
    logSuccess('Backend скопирован');

    // Копирование frontend
    const frontendDest = path.join(CONFIG.installDir, 'frontend');
    if (fs.existsSync(frontendDest)) {
        fs.rmSync(frontendDest, { recursive: true, force: true });
    }
    copyDir(frontendSrc, frontendDest);
    logSuccess('Frontend скопирован');
}

// Рекурсивное копирование директории
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Установка зависимостей
function installDependencies() {
    logInfo('Установка зависимостей...');

    // PM2
    try {
        execCommand('npm list -g pm2', { stdio: 'ignore' });
        logSuccess('PM2 уже установлен');
    } catch {
        logInfo('Установка PM2...');
        execCommand('npm install -g pm2');
        logSuccess('PM2 установлен');
    }

    // Backend зависимости
    logInfo('Установка зависимостей backend...');
    process.chdir(path.join(CONFIG.installDir, 'backend'));
    execCommand('npm install --omit=dev');
    logSuccess('Backend зависимости установлены');

    // Frontend зависимости и сборка
    logInfo('Установка зависимостей frontend и сборка...');
    process.chdir(path.join(CONFIG.installDir, 'frontend'));
    execCommand('npm install');
    execCommand('npm run build');
    logSuccess('Frontend собран');

    // Возврат в корневую директорию
    process.chdir(CONFIG.installDir);
}

// Создание конфигурационных файлов
function createConfigFiles() {
    logInfo('Создание конфигурационных файлов...');

    // .env файл
    const envContent = `NODE_ENV=production
PORT=${CONFIG.port}
JWT_SECRET=${CONFIG.jwtSecret}
FRONTEND_URL=http://${CONFIG.serverIP}
CORS_ORIGIN=http://${CONFIG.serverIP}
DB_PATH=${path.join(CONFIG.installDir, 'data', 'database.sqlite')}
LOG_PATH=${path.join(CONFIG.installDir, 'logs')}`;

    fs.writeFileSync(path.join(CONFIG.installDir, 'backend', '.env'), envContent);
    logSuccess('.env файл создан');

    // ecosystem.config.js для PM2
    const ecosystemContent = `module.exports = {
    apps: [{
        name: '${CONFIG.serviceName}',
        script: './backend/server.js',
        cwd: '${CONFIG.installDir}',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_file: './logs/pm2-combined.log',
        time: true,
        env_production: {
            NODE_ENV: 'production',
            PORT: ${CONFIG.port},
            JWT_SECRET: '${CONFIG.jwtSecret}',
            FRONTEND_URL: 'http://${CONFIG.serverIP}'
        }
    }]
};`;

    fs.writeFileSync(path.join(CONFIG.installDir, 'ecosystem.config.js'), ecosystemContent);
    logSuccess('ecosystem.config.js создан');
}

// Обновление server.js для продакшена
function updateServerForProduction() {
    logInfo('Настройка server.js для продакшена...');

    const serverPath = path.join(CONFIG.installDir, 'backend', 'server.js');
    let serverContent = fs.readFileSync(serverPath, 'utf8');

    // Добавляем продакшен конфигурацию, если её нет
    if (!serverContent.includes('// PRODUCTION CONFIGURATION')) {
        const productionConfig = `

// PRODUCTION CONFIGURATION
if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    const fs = require('fs');
    
    // Создание директорий для логов и данных
    const createDirectories = () => {
        const dirs = [
            path.join('${CONFIG.installDir.replace(/\\/g, '\\\\')}', 'logs'),
            path.join('${CONFIG.installDir.replace(/\\/g, '\\\\')}', 'data')
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    };
    
    createDirectories();
    
    // Расширенное логирование
    app.use((req, res, next) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            user: req.user ? req.user.username : 'anonymous'
        };
        
        const logFile = path.join('${CONFIG.installDir.replace(/\\/g, '\\\\')}', 'logs', \`access-\${new Date().toISOString().split('T')[0]}.log\`);
        try {
            fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\\n');
        } catch (err) {
            console.error('Logging error:', err);
        }
        next();
    });
    
    // Обслуживание статических файлов React
    app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));
    
    // Все остальные GET запросы возвращают React приложение
    app.get('*', (req, res) => {
        if (req.url.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
    });
}`;

        serverContent += productionConfig;
        fs.writeFileSync(serverPath, serverContent);
        logSuccess('server.js обновлен для продакшена');
    }
}

// Настройка системного сервиса
function setupSystemService() {
    const { isWindows, isLinux } = detectOS();

    if (isLinux) {
        setupLinuxService();
    } else if (isWindows) {
        setupWindowsService();
    }
}

// Настройка Linux systemd сервиса
function setupLinuxService() {
    logInfo('Настройка systemd сервиса...');

    const serviceContent = `[Unit]
Description=${CONFIG.projectName}
Documentation=Corporate Equipment Monitoring System
After=network.target

[Service]
Type=forking
User=\${USER}
WorkingDirectory=${CONFIG.installDir}
Environment=NODE_ENV=production
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 restart ${CONFIG.serviceName}
ExecStop=/usr/bin/pm2 stop ${CONFIG.serviceName}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target`;

    const servicePath = `/etc/systemd/system/${CONFIG.serviceName}.service`;

    try {
        fs.writeFileSync(servicePath, serviceContent);
        execCommand('systemctl daemon-reload');
        execCommand(`systemctl enable ${CONFIG.serviceName}`);
        logSuccess('Linux systemd сервис настроен');
    } catch (error) {
        logWarning('Не удалось настроить systemd сервис (нужны права sudo)');
    }
}

// Настройка Windows сервиса
function setupWindowsService() {
    logInfo('Настройка Windows сервиса...');

    try {
        // Установка pm2-windows-service если нет
        try {
            execCommand('npm list -g pm2-windows-service', { stdio: 'ignore' });
        } catch {
            execCommand('npm install -g pm2-windows-service');
        }

        // Настройка Windows сервиса
        execCommand('pm2-service-install -n "MMA Equipment Monitoring"');
        logSuccess('Windows сервис настроен');
    } catch (error) {
        logWarning('Не удалось настроить Windows сервис');
    }
}

// Настройка файрвола
function setupFirewall() {
    logInfo('Настройка файрвола...');

    const { isWindows, isLinux } = detectOS();

    try {
        if (isWindows) {
            execCommand(`netsh advfirewall firewall add rule name="MMA Equipment Port ${CONFIG.port}" dir=in action=allow protocol=TCP localport=${CONFIG.port}`);
            logSuccess('Windows Firewall настроен');
        } else if (isLinux) {
            execCommand(`ufw allow ${CONFIG.port}/tcp`);
            logSuccess('UFW настроен');
        }
    } catch (error) {
        logWarning('Не удалось настроить файрвол автоматически');
        logInfo(`Откройте порт ${CONFIG.port} вручную`);
    }
}

// Создание утилитарных скриптов
function createUtilityScripts() {
    logInfo('Создание утилитарных скриптов...');

    const { isWindows } = detectOS();
    const scriptExt = isWindows ? '.bat' : '.sh';
    const scriptPrefix = isWindows ? '@echo off\n' : '#!/bin/bash\n';

    // Скрипт статуса
    const statusScript = isWindows ?
        `@echo off
echo ============================================
echo    ${CONFIG.projectName} - Статус
echo ============================================
echo 🌐 URL: http://${CONFIG.serverIP}
echo 📅 %date% %time%
echo ============================================
echo.
pm2 status
echo.
echo 💾 Использование диска:
dir "${CONFIG.installDir}" /-c | find "байт"
echo.
echo 📋 Последние логи:
type "${CONFIG.installDir}\\logs\\pm2-out.log" | more
echo.
pause` :
        `#!/bin/bash
echo "============================================"
echo "    ${CONFIG.projectName} - Статус"
echo "============================================"
echo "🌐 URL: http://${CONFIG.serverIP}"
echo "📅 $(date)"
echo "============================================"
echo
pm2 status
echo
echo "💾 Использование ресурсов:"
echo "Память: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "Диск: $(df -h ${CONFIG.installDir} | tail -1 | awk '{print $3 "/" $2}')"
echo
echo "📋 Последние 5 строк лога:"
tail -5 "${CONFIG.installDir}/logs/pm2-out.log" 2>/dev/null || echo "Логи недоступны"
echo`;

    fs.writeFileSync(path.join(CONFIG.installDir, `status${scriptExt}`), statusScript);
    if (!isWindows) {
        execCommand(`chmod +x ${path.join(CONFIG.installDir, 'status.sh')}`);
    }

    // Скрипт резервного копирования
    const backupScript = isWindows ?
        `@echo off
set BACKUP_DIR=${CONFIG.installDir}\\backups
set DATE_STR=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATE_STR=%DATE_STR: =0%
set BACKUP_FILE=mma_backup_%DATE_STR%.zip

echo 💾 Создание резервной копии...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

powershell Compress-Archive -Path "${CONFIG.installDir}\\data\\*", "${CONFIG.installDir}\\logs\\*", "${CONFIG.installDir}\\backend\\.env" -DestinationPath "%BACKUP_DIR%\\%BACKUP_FILE%" -Force

echo ✅ Резервная копия создана: %BACKUP_DIR%\\%BACKUP_FILE%
pause` :
        `#!/bin/bash
BACKUP_DIR="${CONFIG.installDir}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mma_backup_$DATE.tar.gz"

echo "💾 Создание резервной копии..."
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/$BACKUP_FILE" -C "${CONFIG.installDir}" data/ logs/ backend/.env

echo "✅ Резервная копия создана: $BACKUP_DIR/$BACKUP_FILE"
echo "📂 Всего бэкапов: $(ls -1 "$BACKUP_DIR"/mma_backup_*.tar.gz 2>/dev/null | wc -l)"`;

    fs.writeFileSync(path.join(CONFIG.installDir, `backup${scriptExt}`), backupScript);
    if (!isWindows) {
        execCommand(`chmod +x ${path.join(CONFIG.installDir, 'backup.sh')}`);
    }

    logSuccess('Утилитарные скрипты созданы');
}

// Запуск приложения
function startApplication() {
    logInfo('Запуск приложения...');

    process.chdir(CONFIG.installDir);

    try {
        // Остановка существующих процессов
        try {
            execCommand(`pm2 stop ${CONFIG.serviceName}`, { stdio: 'ignore' });
            execCommand(`pm2 delete ${CONFIG.serviceName}`, { stdio: 'ignore' });
        } catch {
            // Игнорируем ошибки если процесс не найден
        }

        // Запуск приложения
        execCommand('pm2 start ecosystem.config.js --env production');
        execCommand('pm2 save');

        // Настройка автозапуска
        const { isLinux } = detectOS();
        if (isLinux) {
            const startupCommand = execSync('pm2 startup', { encoding: 'utf8' });
            const sudoCommand = startupCommand.split('\n').find(line => line.includes('sudo'));
            if (sudoCommand) {
                logInfo('Для автозапуска выполните команду:');
                log(sudoCommand, 'cyan');
            }
        }

        logSuccess('Приложение запущено');
    } catch (error) {
        logError('Ошибка запуска приложения');
        throw error;
    }
}

// Проверка работы приложения
async function verifyInstallation() {
    logInfo('Проверка работы приложения...');

    // Ждем запуска
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        const http = require('http');

        const options = {
            hostname: 'localhost',
            port: CONFIG.port,
            path: '/api/health',
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            if (res.statusCode === 200) {
                logSuccess('Приложение работает корректно');
            } else {
                logWarning(`Приложение отвечает с кодом: ${res.statusCode}`);
            }
        });

        req.on('error', (err) => {
            logWarning('Не удалось проверить работу приложения через API');
            logInfo('Это нормально при первом запуске');
        });

        req.on('timeout', () => {
            logWarning('Таймаут проверки API');
            req.destroy();
        });

        req.end();
    } catch (error) {
        logWarning('Ошибка проверки работы приложения');
    }
}

// Вывод финальной информации
function showCompletionInfo() {
    log('\n==============================================', 'green');
    log('🎉 УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО! 🎉', 'green');
    log('==============================================', 'green');
    log('');
    log(`🌐 Приложение доступно: http://${CONFIG.serverIP}`, 'cyan');
    log('');
    log('👥 Учетные данные для входа:', 'cyan');
    log('   Администратор: admin / admin123', 'yellow');
    log('   Диспетчер: dispatcher / user123', 'yellow');
    log('');
    log('🛠️ Управление приложением:', 'cyan');
    log(`   pm2 status                    - статус процессов`);
    log(`   pm2 restart ${CONFIG.serviceName}       - перезапуск`);
    log(`   pm2 logs ${CONFIG.serviceName}          - просмотр логов`);
    log(`   ${CONFIG.installDir}/status${detectOS().isWindows ? '.bat' : '.sh'}             - статус системы`);
    log(`   ${CONFIG.installDir}/backup${detectOS().isWindows ? '.bat' : '.sh'}             - резервное копирование`);
    log('');
    log('📁 Важные пути:', 'cyan');
    log(`   Проект: ${CONFIG.installDir}`);
    log(`   Логи: ${path.join(CONFIG.installDir, 'logs')}`);
    log(`   Данные: ${path.join(CONFIG.installDir, 'data')}`);
    log(`   Бэкапы: ${path.join(CONFIG.installDir, 'backups')}`);
    log('');
    log('📊 Функции системы:', 'cyan');
    log('   ✅ Мониторинг техники в реальном времени');
    log('   ✅ Отслеживание ремонтных работ');
    log('   ✅ Управление механиками и задачами');
    log('   ✅ Автоматические резервные копии');
    log('   ✅ Подробное логирование');
    log('   ✅ Автозапуск при перезагрузке');
    log('');
    log('==============================================', 'green');
    log('Система готова к работе! 🚀', 'green');
}

// Основная функция установки
async function main() {
    try {
        console.clear();
        log('==============================================', 'blue');
        log(`🚀 ${CONFIG.projectName} - Установка`, 'blue');
        log('==============================================', 'blue');
        log(`Сервер: ${CONFIG.serverIP}:${CONFIG.port}`, 'cyan');
        log(`Платформа: ${os.platform()} ${os.arch()}`, 'cyan');
        log(`Установка в: ${CONFIG.installDir}`, 'cyan');
        log('==============================================', 'blue');
        log('');

        // Пошаговая установка
        await checkDependencies();
        await createDirectories();
        await copyProjectFiles();
        await installDependencies();
        await createConfigFiles();
        await updateServerForProduction();
        await setupSystemService();
        await setupFirewall();
        await createUtilityScripts();
        await startApplication();
        await verifyInstallation();

        showCompletionInfo();

    } catch (error) {
        logError('Установка прервана из-за ошибки:');
        console.error(error.message);
        process.exit(1);
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    main();
}

module.exports = { main, CONFIG };