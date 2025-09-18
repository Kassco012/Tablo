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
        in_repair: 0,
        ready: 0,
        waiting: 0,
        scheduled: 0,
        total: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEquipment = useCallback(async () => {
        try {
            console.log('🔄 Загрузка оборудования...');
            setError(null);
            const response = await api.get('/equipment');

            // Проверяем что данные приходят в правильном формате
            let equipmentData = response.data;
            console.log('📦 Получены данные оборудования:', equipmentData);

            // Если данные не массив, пытаемся извлечь массив
            if (!Array.isArray(equipmentData)) {
                if (equipmentData && Array.isArray(equipmentData.equipment)) {
                    equipmentData = equipmentData.equipment;
                } else if (equipmentData && Array.isArray(equipmentData.data)) {
                    equipmentData = equipmentData.data;
                } else {
                    console.error('❌ Данные оборудования не являются массивом:', equipmentData);
                    equipmentData = [];
                }
            }

            setEquipment(equipmentData);
            console.log('✅ Оборудование обновлено, количество:', equipmentData.length);

        } catch (error) {
            console.error('❌ Ошибка загрузки оборудования:', error);
            setError(error.response?.data?.message || 'Ошибка загрузки оборудования');
            // Устанавливаем пустой массив при ошибке
            setEquipment([]);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            console.log('📊 Загрузка статистики...');
            const response = await api.get('/equipment/stats');
            setStats(response.data);
            console.log('✅ Статистика обновлена:', response.data);
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            // Если статистика не загрузилась, вычисляем её локально
            const localStats = {
                in_repair: 0,
                ready: 0,
                waiting: 0,
                scheduled: 0,
                total: Array.isArray(equipment) ? equipment.length : 0
            };

            if (Array.isArray(equipment)) {
                equipment.forEach(item => {
                    if (localStats[item.status] !== undefined) {
                        localStats[item.status]++;
                    }
                });
            }

            setStats(localStats);
            console.log('📊 Статистика вычислена локально:', localStats);
        }
    }, [equipment]);

    const refreshData = useCallback(async () => {
        console.log('🔄 Обновление данных...');
        setLoading(true);
        try {
            await fetchEquipment();
            // Статистика будет обновлена автоматически через useEffect
        } finally {
            setLoading(false);
        }
    }, [fetchEquipment]);

    useEffect(() => {
        console.log('📊 Инициализация EquipmentProvider');
        refreshData();
    }, []);

    useEffect(() => {
        // Пересчитываем статистику при изменении оборудования
        if (Array.isArray(equipment) && equipment.length > 0) {
            fetchStats();
        }
    }, [equipment, fetchStats]);

    const updateEquipment = async (id, updateData) => {
        try {
            const response = await api.put(`/equipment/${id}`, updateData);

            // Обновляем локальное состояние
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
            await refreshData(); // Перезагружаем данные
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

    const getEquipmentByPriority = (priority) => {
        return Array.isArray(equipment) ? equipment.filter(item => item.priority === priority) : [];
    };

    const getCriticalEquipment = () => {
        if (!Array.isArray(equipment)) return [];
        return equipment.filter(item =>
            item.priority === 'critical' ||
            (item.status === 'waiting' && item.delay_hours > 4)
        );
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
        getEquipmentByType,
        getEquipmentByPriority,
        getCriticalEquipment
    };

    return (
        <EquipmentContext.Provider value={value}>
            {children}
        </EquipmentContext.Provider>
    );
};