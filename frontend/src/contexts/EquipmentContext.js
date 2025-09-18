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
            setError(null);
            const response = await api.get('/equipment');
            setEquipment(response.data);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            setError(error.response?.data?.message || 'Ошибка загрузки оборудования');
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/equipment/stats');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
            // Если статистика не загрузилась, вычисляем её локально
            const localStats = {
                in_repair: 0,
                ready: 0,
                waiting: 0,
                scheduled: 0,
                total: equipment.length
            };

            equipment.forEach(item => {
                if (localStats[item.status] !== undefined) {
                    localStats[item.status]++;
                }
            });

            setStats(localStats);
        }
    }, [equipment]);

    const refreshData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchEquipment(),
                fetchStats()
            ]);
        } finally {
            setLoading(false);
        }
    }, [fetchEquipment, fetchStats]);

    useEffect(() => {
        refreshData();
    }, []);

    useEffect(() => {
        // Пересчитываем статистику при изменении оборудования
        if (equipment.length > 0) {
            fetchStats();
        }
    }, [equipment, fetchStats]);

    const updateEquipment = async (id, updateData) => {
        try {
            const response = await api.put(`/equipment/${id}`, updateData);

            // Обновляем локальное состояние
            setEquipment(prev =>
                prev.map(item =>
                    item.id === id ? { ...item, ...response.data.equipment } : item
                )
            );

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
            setEquipment(prev => prev.filter(item => item.id !== id));
            return { message: 'Оборудование удалено успешно' };
        } catch (error) {
            throw error.response?.data || { message: 'Ошибка удаления оборудования' };
        }
    };

    const getEquipmentById = (id) => {
        return equipment.find(item => item.id === id);
    };

    const getEquipmentByStatus = (status) => {
        return equipment.filter(item => item.status === status);
    };

    const getEquipmentByType = (type) => {
        return equipment.filter(item => item.type === type);
    };

    const getEquipmentByPriority = (priority) => {
        return equipment.filter(item => item.priority === priority);
    };

    const getCriticalEquipment = () => {
        return equipment.filter(item =>
            item.priority === 'critical' ||
            (item.status === 'waiting' && item.delay_hours > 4)
        );
    };

    const value = {
        equipment,
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