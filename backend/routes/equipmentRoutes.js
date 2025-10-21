// backend/routes/equipmentRoutes.js - с ROLE-BASED обновлением

const express = require('express');
const router = express.Router();
const { all, run, get } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ✅ Middleware для проверки прав на полное редактирование
const requireFullEditAccess = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'programmer') {
        return res.status(403).json({
            message: 'Недостаточно прав для редактирования этих полей'
        });
    }
    next();
};

// ✅ Middleware для проверки прав на ограниченное редактирование
const requireLimitedEditAccess = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'dispatcher' && req.user.role !== 'programmer') {
        return res.status(403).json({
            message: 'Недостаточно прав для редактирования'
        });
    }
    next();
};

// ======================================
// ПОЛУЧЕНИЕ СПИСКА ОБОРУДОВАНИЯ
// ======================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const equipment = await all(
            `SELECT * FROM equipment_master 
             WHERE is_active = 1 
             ORDER BY created_at DESC`
        );

        res.json(equipment);
    } catch (error) {
        console.error('❌ Error fetching equipment:', error);
        res.status(500).json({ message: 'Ошибка получения списка оборудования' });
    }
});

// ======================================
// ПОЛУЧЕНИЕ ОДНОЙ ЕДИНИЦЫ ОБОРУДОВАНИЯ
// ======================================
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const equipment = await get(
            'SELECT * FROM equipment_master WHERE id = ? AND is_active = 1',
            [id]
        );

        if (!equipment) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        res.json(equipment);
    } catch (error) {
        console.error('❌ Error fetching equipment:', error);
        res.status(500).json({ message: 'Ошибка получения данных оборудования' });
    }
});

// ======================================
// ОБНОВЛЕНИЕ ОБОРУДОВАНИЯ (ROLE-BASED)
// ======================================
router.put('/:id', authenticateToken, requireLimitedEditAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Проверяем существование оборудования
        const existing = await get(
            'SELECT * FROM equipment_master WHERE id = ? AND is_active = 1',
            [id]
        );

        if (!existing) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // ✅ ОПРЕДЕЛЯЕМ КАКИЕ ПОЛЯ МОЖНО ОБНОВЛЯТЬ
        let updateFields = [];
        let updateValues = [];
        let history = [];

        // ✅ ДИСПЕТЧЕР - может редактировать только 2 поля
        if (userRole === 'dispatcher') {
            const { planned_hours, mechanic_name } = req.body;

            // Planned hours
            if (planned_hours !== undefined && planned_hours !== existing.planned_hours) {
                updateFields.push('planned_hours = ?');
                updateValues.push(planned_hours);
                history.push({
                    action: 'update_planned_hours',
                    old_value: existing.planned_hours?.toString() || '0',
                    new_value: planned_hours.toString()
                });
            }

            // Mechanic name
            if (mechanic_name !== undefined && mechanic_name !== existing.mechanic_name) {
                updateFields.push('mechanic_name = ?');
                updateValues.push(mechanic_name);
                history.push({
                    action: 'update_mechanic_name',
                    old_value: existing.mechanic_name || '',
                    new_value: mechanic_name
                });
            }

            console.log(`📝 Диспетчер ${req.user.username} обновляет ${id}: planned_hours и mechanic_name`);
        }
        // ✅ АДМИН/ПРОГРАММИСТ - может редактировать всё
        else if (userRole === 'admin' || userRole === 'programmer') {
            const { type, model, status, planned_hours, malfunction, mechanic_name } = req.body;

            // Type
            if (type !== undefined && type !== existing.type) {
                updateFields.push('equipment_type = ?');
                updateValues.push(type);
                history.push({
                    action: 'update_type',
                    old_value: existing.type || '',
                    new_value: type
                });
            }

            // Model
            if (model !== undefined && model !== existing.model) {
                updateFields.push('model = ?');
                updateValues.push(model);
                history.push({
                    action: 'update_model',
                    old_value: existing.model || '',
                    new_value: model
                });
            }

            // Status
            if (status !== undefined && status !== existing.status) {
                updateFields.push('status = ?');
                updateValues.push(status);
                history.push({
                    action: 'update_status',
                    old_value: existing.status || '',
                    new_value: status
                });
            }

            // Planned hours
            if (planned_hours !== undefined && planned_hours !== existing.planned_hours) {
                updateFields.push('planned_hours = ?');
                updateValues.push(planned_hours);
                history.push({
                    action: 'update_planned_hours',
                    old_value: existing.planned_hours?.toString() || '0',
                    new_value: planned_hours.toString()
                });
            }

            // Malfunction
            if (malfunction !== undefined && malfunction !== existing.malfunction) {
                updateFields.push('malfunction = ?');
                updateValues.push(malfunction);
                history.push({
                    action: 'update_progress',
                    old_value: existing.malfunction || '',
                    new_value: malfunction
                });
            }

            // Mechanic name
            if (mechanic_name !== undefined && mechanic_name !== existing.mechanic_name) {
                updateFields.push('mechanic_name = ?');
                updateValues.push(mechanic_name);
                history.push({
                    action: 'update_mechanic_name',
                    old_value: existing.mechanic_name || '',
                    new_value: mechanic_name
                });
            }

            // ✅ Устанавливаем флаг ручного редактирования
            updateFields.push('manually_edited = 1');

            console.log(`🔧 Админ ${req.user.username} обновляет ${id}: все поля`);
        }

        // Если нет изменений
        if (updateFields.length === 0 || (updateFields.length === 1 && updateFields[0] === 'manually_edited = 1')) {
            return res.json({ message: 'Нет изменений для сохранения' });
        }

        // Обновляем timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // Формируем SQL запрос
        const updateSQL = `
            UPDATE equipment_master 
            SET ${updateFields.join(', ')}
            WHERE id = ?
        `;

        updateValues.push(id);

        // Выполняем обновление
        await run(updateSQL, updateValues);

        // ✅ Записываем историю изменений
        for (const historyItem of history) {
            await run(
                `INSERT INTO equipment_history 
                 (equipment_id, user_id, action, old_value, new_value, timestamp)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [id, userId, historyItem.action, historyItem.old_value, historyItem.new_value]
            );
        }

        // Получаем обновленные данные
        const updated = await get(
            'SELECT * FROM equipment_master WHERE id = ?',
            [id]
        );

        console.log(`✅ Оборудование ${id} обновлено пользователем ${req.user.username} (${userRole})`);

        res.json({
            message: 'Данные успешно обновлены',
            equipment: updated
        });

    } catch (error) {
        console.error('❌ Error updating equipment:', error);
        res.status(500).json({ message: 'Ошибка обновления данных' });
    }
});

// ======================================
// ИЗМЕНЕНИЕ ID ОБОРУДОВАНИЯ (ТОЛЬКО АДМИН)
// ======================================
router.put('/:id/change-id', authenticateToken, requireFullEditAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { newId } = req.body;
        const userId = req.user.id;

        // Валидация
        if (!newId || newId.trim() === '') {
            return res.status(400).json({ message: 'Новый ID не может быть пустым' });
        }

        if (newId === id) {
            return res.status(400).json({ message: 'Новый ID совпадает со старым' });
        }

        // Проверяем существование старого ID
        const existing = await get(
            'SELECT * FROM equipment_master WHERE id = ?',
            [id]
        );

        if (!existing) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Проверяем, не занят ли новый ID
        const duplicate = await get(
            'SELECT id FROM equipment_master WHERE id = ?',
            [newId]
        );

        if (duplicate) {
            return res.status(400).json({ message: 'ID уже используется другим оборудованием' });
        }

        // Начинаем транзакцию
        await run('BEGIN TRANSACTION');

        try {
            // 1. Обновляем ID в основной таблице
            await run(
                'UPDATE equipment_master SET id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newId, id]
            );

            // 2. Обновляем ID в архиве
            await run(
                'UPDATE equipment_archive SET id = ? WHERE id = ?',
                [newId, id]
            );

            // 3. Обновляем ID в истории
            await run(
                'UPDATE equipment_history SET equipment_id = ? WHERE equipment_id = ?',
                [newId, id]
            );

            // 4. Записываем в историю
            await run(
                `INSERT INTO equipment_history 
                 (equipment_id, user_id, action, old_value, new_value, timestamp)
                 VALUES (?, ?, 'change_id', ?, ?, CURRENT_TIMESTAMP)`,
                [newId, userId, id, newId]
            );

            await run('COMMIT');

            console.log(`✅ ID изменен: ${id} → ${newId} (пользователь: ${req.user.username})`);

            res.json({
                message: 'ID успешно изменен',
                oldId: id,
                newId: newId
            });

        } catch (error) {
            await run('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('❌ Error changing equipment ID:', error);
        res.status(500).json({ message: 'Ошибка изменения ID оборудования' });
    }
});

// ======================================
// ПОЛУЧЕНИЕ ИСТОРИИ ИЗМЕНЕНИЙ
// ======================================
router.get('/:id/history', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверяем существование оборудования
        const equipment = await get(
            'SELECT id FROM equipment_master WHERE id = ?',
            [id]
        );

        if (!equipment) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Получаем историю с данными пользователей
        const history = await all(
            `SELECT 
                h.id,
                h.equipment_id,
                h.action,
                h.old_value,
                h.new_value,
                h.timestamp,
                u.username,
                u.full_name
             FROM equipment_history h
             LEFT JOIN users u ON h.user_id = u.id
             WHERE h.equipment_id = ?
             ORDER BY h.timestamp DESC
             LIMIT 100`,
            [id]
        );

        res.json(history);

    } catch (error) {
        console.error('❌ Error fetching history:', error);
        res.status(500).json({ message: 'Ошибка получения истории' });
    }
});

// ======================================
// УДАЛЕНИЕ ОБОРУДОВАНИЯ (ТОЛЬКО АДМИН)
// ======================================
router.delete('/:id', authenticateToken, requireFullEditAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const existing = await get(
            'SELECT * FROM equipment_master WHERE id = ?',
            [id]
        );

        if (!existing) {
            return res.status(404).json({ message: 'Оборудование не найдено' });
        }

        // Деактивируем вместо удаления
        await run(
            'UPDATE equipment_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        // Записываем в историю
        await run(
            `INSERT INTO equipment_history 
             (equipment_id, user_id, action, timestamp)
             VALUES (?, ?, 'delete', CURRENT_TIMESTAMP)`,
            [id, userId]
        );

        console.log(`✅ Оборудование ${id} деактивировано пользователем ${req.user.username}`);

        res.json({ message: 'Оборудование успешно удалено' });

    } catch (error) {
        console.error('❌ Error deleting equipment:', error);
        res.status(500).json({ message: 'Ошибка удаления оборудования' });
    }
});

module.exports = router;