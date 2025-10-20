import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const EquipmentContext = createContext();

export const useEquipment = () => {
    const context = useContext(EquipmentContext);
    if (!context) {
        throw new Error('useEquipment должен использоваться внутри EquipmentProvider');
    }
    return context;
};

export const EquipmentProvider = ({ children }) => {
    const [equipment, setEquipment] = useState([]);
    const [stats, setStats] = useState({
        down: 0,
        ready: 0,          // ❌ Убираем (больше не используем)
        ready_today: 0,    // ✅ НОВЫЙ: отремонтировано за сегодня
        delay: 0,
        standby: 0,
        total: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ✅ Загрузка оборудования
    const fetchEquipment = useCallback(async () => {
        try {
            console.log('📥 Загрузка оборудования...');
            setError(null);

            const response = await api.get('/equipment');
            let equipmentData = response.data;

            if (equipmentData === null || equipmentData === undefined) {
                console.error('response.data пустой!');
                setEquipment([]);
                return;
            }

            // Если это массив
            if (Array.isArray(equipmentData)) {
                console.log(`✅ Загружено: ${equipmentData.length} единиц`);
                setEquipment(equipmentData);
                return;
            }

            // Если это объект с вложенным массивом
            if (typeof equipmentData === 'object') {
                const possibleKeys = ['equipment', 'data', 'items', 'records', 'results'];

                for (const key of possibleKeys) {
                    if (equipmentData[key] && Array.isArray(equipmentData[key])) {
                        console.log(`✅ Найден массив в "${key}": ${equipmentData[key].length} записей`);
                        setEquipment(equipmentData[key]);
                        return;
                    }
                }

                console.error('❌ Массив не найден');
            }

            setEquipment([]);

        } catch (error) {
            console.error('❌ Ошибка загрузки оборудования:', error);
            setError(error.response?.data?.message || error.message || 'Ошибка загрузки оборудования');
            setEquipment([]);
        }
    }, []);

    // ✅ Загрузка статистики Dashboard (DOWN + READY TODAY)
    const fetchDashboardStats = useCallback(async () => {
        try {
            console.log('📊 Загрузка статистики dashboard...');
            const response = await api.get('/stats/dashboard');

            if (response.data.success) {
                const { down, ready_today, total } = response.data.stats;

                setStats(prev => ({
                    ...prev,
                    down: down || 0,
                    ready_today: ready_today || 0,
                    total: total || 0
                }));

                console.log(`✅ Stats: DOWN=${down}, READY TODAY=${ready_today}`);
            }

        } catch (error) {
            console.error('❌ Ошибка загрузки stats:', error);

            // Фоллбэк: считаем DOWN локально
            if (Array.isArray(equipment) && equipment.length > 0) {
                const downCount = equipment.filter(
                    item => item.status?.toLowerCase() === 'down'
                ).length;

                setStats(prev => ({
                    ...prev,
                    down: downCount,
                    total: equipment.length
                }));

                console.log(`⚠️ Используем локальный подсчет DOWN: ${downCount}`);
            }
        }
    }, [equipment]);

    // ✅ Проверка на смену дня (обнуление READY в 00:00)
    useEffect(() => {
        const checkMidnight = () => {
            const now = new Date();
            const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

            // Если сейчас 00:00:xx (первая минута нового дня)
            if (seconds < 60) {
                console.log('🕐 Новый день! Обнуляем счетчик READY');
                setStats(prev => ({
                    ...prev,
                    ready_today: 0
                }));
                // Обновляем данные
                refreshData();
            }
        };

        // Проверяем каждую минуту
        const interval = setInterval(checkMidnight, 60000);

        return () => clearInterval(interval);
    }, []);

    // ✅ Объединенная функция обновления
    const refreshData = useCallback(async () => {
        console.log('🔄 Обновление всех данных...');
        setLoading(true);
        try {
            await fetchEquipment();
            // Статистика обновится автоматически через useEffect
        } finally {
            setLoading(false);
        }
    }, [fetchEquipment]);

    // ✅ Первоначальная загрузка
    useEffect(() => {
        console.log('🚀 Инициализация EquipmentProvider');
        refreshData();
    }, []);

    // ✅ Обновление статистики при изменении equipment
    useEffect(() => {
        if (Array.isArray(equipment) && equipment.length >= 0) {
            fetchDashboardStats();
        }
    }, [equipment, fetchDashboardStats]);

    // ✅ Автообновление каждые 30 секунд
    useEffect(() => {
        const interval = setInterval(() => {
            console.log('⏰ Автообновление: оборудование + статистика');
            refreshData();
        }, 30000); // 30 секунд

        return () => clearInterval(interval);
    }, [refreshData]);

    // Остальные методы без изменений
    const updateEquipment = async (id, updateData) => {
        try {
            const response = await api.put(`/equipment/${id}`, updateData);
            setEquipment(prev => {
                if (!Array.isArray(prev)) return [];
                return prev.map(item =>
                    item.id === id ? { ...item, ...response.data.equipment } : item
                );
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Ошибка обновления оборудования' };
        }
    };

    const createEquipment = async (equipmentData) => {
        try {
            const response = await api.post('/equipment', equipmentData);
            await refreshData();
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Ошибка создания оборудования' };
        }
    };

    const deleteEquipment = async (id) => {
        try {
            await api.delete(`/equipment/${id}`);
            setEquipment(prev => {
                if (!Array.isArray(prev)) return [];
                return prev.filter(item => item.id !== id);
            });
            return { message: 'Оборудование удалено успешно' };
        } catch (error) {
            throw error.response?.data || { message: 'Ошибка удаления оборудования' };
        }
    };

    const getEquipmentById = (id) => {
        return Array.isArray(equipment) ? equipment.find(item => item.id === id) : null;
    };

    const getEquipmentByStatus = (status) => {
        return Array.isArray(equipment) ? equipment.filter(item => item.status === status) : [];
    };

    const getEquipmentByType = (type) => {
        return Array.isArray(equipment) ? equipment.filter(item => item.type === type) : [];
    };

   


    const value = {
        equipment: Array.isArray(equipment) ? equipment : [],
        stats,
        loading,
        error,
        refreshData,
        updateEquipment,
        createEquipment,
        deleteEquipment,
        getEquipmentById,
        getEquipmentByStatus,
        getEquipmentByType
    };

    return (
        <EquipmentContext.Provider value={value}>
            {children}
        </EquipmentContext.Provider>
    );
};