// backend/scripts/clearDatabase.js

const { getDatabase } = require('../config/database');

const db = getDatabase();

console.log('='.repeat(70));
console.log('🗑️ ОЧИСТКА СТАРЫХ ДАННЫХ ИЗ SQLite');
console.log('='.repeat(70));

db.serialize(() => {
    // 1. Показываем, что будет удалено
    console.log('\n📊 Текущее состояние базы данных:\n');

    db.get('SELECT COUNT(*) as count FROM equipment_master WHERE is_active = 1', (err, row) => {
        if (!err) {
            console.log(`   equipment_master (активные): ${row.count}`);
        }
    });

    db.get('SELECT COUNT(*) as count FROM equipment_archive', (err, row) => {
        if (!err) {
            console.log(`   equipment_archive: ${row.count}`);
        }
    });

    db.get('SELECT COUNT(*) as count FROM equipment_history', (err, row) => {
        if (!err) {
            console.log(`   equipment_history: ${row.count}\n`);
        }

        // Ждем немного, чтобы показать статистику
        setTimeout(() => {
            console.log('🔄 Начинаем очистку...\n');
            performCleanup();
        }, 100);
    });
});

function performCleanup() {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Очистка основной таблицы
        db.run('DELETE FROM equipment_master', function (err) {
            if (err) {
                console.error('❌ Ошибка очистки equipment_master:', err);
                db.run('ROLLBACK');
                return;
            }
            console.log(`✅ equipment_master очищена (удалено: ${this.changes})`);
        });

        // 2. Очистка архива
        db.run('DELETE FROM equipment_archive', function (err) {
            if (err) {
                console.error('❌ Ошибка очистки equipment_archive:', err);
                db.run('ROLLBACK');
                return;
            }
            console.log(`✅ equipment_archive очищена (удалено: ${this.changes})`);
        });

        // 3. Очистка истории
        db.run('DELETE FROM equipment_history', function (err) {
            if (err) {
                console.error('❌ Ошибка очистки equipment_history:', err);
                db.run('ROLLBACK');
                return;
            }
            console.log(`✅ equipment_history очищена (удалено: ${this.changes})`);
        });

        // 4. Сброс счетчиков
        db.run(
            'DELETE FROM sqlite_sequence WHERE name IN ("equipment_archive", "equipment_history")',
            function (err) {
                if (err) {
                    console.error('❌ Ошибка сброса счетчиков:', err);
                } else {
                    console.log('✅ Счетчики автоинкремента сброшены');
                }
            }
        );

        // 5. Коммит транзакции
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('❌ Ошибка коммита:', err);
                return;
            }

            console.log('\n🔄 Оптимизация базы данных...');

            // 6. Оптимизация (освобождение места)
            db.run('VACUUM', (err) => {
                if (err) {
                    console.error('❌ Ошибка оптимизации:', err);
                } else {
                    console.log('✅ База данных оптимизирована');
                }

                // 7. Проверяем результат
                console.log('\n' + '='.repeat(70));
                console.log('✅ ОЧИСТКА ЗАВЕРШЕНА');
                console.log('='.repeat(70));

                console.log('\n📊 Состояние базы данных после очистки:\n');

                db.get('SELECT COUNT(*) as count FROM equipment_master', (err, row) => {
                    if (!err) {
                        console.log(`   equipment_master: ${row.count}`);
                    }
                });

                db.get('SELECT COUNT(*) as count FROM equipment_archive', (err, row) => {
                    if (!err) {
                        console.log(`   equipment_archive: ${row.count}`);
                    }
                });

                db.get('SELECT COUNT(*) as count FROM equipment_history', (err, row) => {
                    if (!err) {
                        console.log(`   equipment_history: ${row.count}\n`);
                    }

                    console.log('✅ База данных готова к синхронизации!');
                    console.log('   Запустите сервер: npm run dev\n');

                    db.close();
                    process.exit(0);
                });
            });
        });
    });
}