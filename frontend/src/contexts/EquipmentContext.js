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
        ready: 0,
        delay: 0,
        standby: 0,
        total: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEquipment = useCallback(async () => {
        try {
            console.log('\n' + '='.repeat(50));
            console.log('НАЧАЛО ЗАГРУЗКИ ОБОРУДОВАНИЯ');
            console.log('='.repeat(50));

            setError(null);

            console.log('Отправка запроса: GET /equipment');
            const response = await api.get('/equipment');

            console.log('Ответ получен:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                dataType: typeof response.data,
                dataIsArray: Array.isArray(response.data)
            });

            let equipmentData = response.data;

            // Детальная проверка структуры
            if (equipmentData === null || equipmentData === undefined) {
                console.error('response.data пустой (null/undefined)!');
                setEquipment([]);
                return;
            }

            console.log('Анализ структуры данных:', {
                type: typeof equipmentData,
                isArray: Array.isArray(equipmentData),
                keys: typeof equipmentData === 'object' ? Object.keys(equipmentData) : 'N/A',
                length: Array.isArray(equipmentData) ? equipmentData.length : 'N/A'
            });

            // Если это уже массив
            if (Array.isArray(equipmentData)) {
                console.log(`Это массив! Длина: ${equipmentData.length}`);

                if (equipmentData.length > 0) {
                    console.log('Пример первой записи:', JSON.stringify(equipmentData[0], null, 2));
                }

                setEquipment(equipmentData);
                console.log('equipment state обновлен');
                return;
            }

            // Если это объект с вложенным массивом
            if (typeof equipmentData === 'object') {
                console.log('Это объект, ищем массив внутри...');

                // Проверяем различные возможные ключи
                const possibleKeys = ['equipment', 'data', 'items', 'records', 'results'];

                for (const key of possibleKeys) {
                    if (equipmentData[key] && Array.isArray(equipmentData[key])) {
                        console.log(`Найден массив в ключе "${key}": ${equipmentData[key].length} записей`);
                        setEquipment(equipmentData[key]);
                        return;
                    }
                }

                console.error('❌ Массив не найден ни в одном из ожидаемых ключей');
                console.error('Доступные ключи:', Object.keys(equipmentData));
                console.error('Структура:', JSON.stringify(equipmentData, null, 2).substring(0, 500));
            }

            // Если ничего не подошло
            console.error('❌ НЕИЗВЕСТНЫЙ ФОРМАТ ДАННЫХ');
            console.error('Full response.data:', JSON.stringify(equipmentData, null, 2).substring(0, 1000));
            setEquipment([]);

            console.log('='.repeat(50));
            console.log('❌ КОНЕЦ ЗАГРУЗКИ (ОШИБКА)');
            console.log('='.repeat(50) + '\n');

        } catch (error) {
            console.error('\n' + '='.repeat(50));
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ЗАГРУЗКИ');
            console.error('='.repeat(50));
            console.error('Error type:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);

            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
                console.error('Response headers:', error.response.headers);
            } else if (error.request) {
                console.error('Request made but no response:', error.request);
            }

            setError(error.response?.data?.message || error.message || 'Ошибка загрузки оборудования');
            setEquipment([]);

            console.error('='.repeat(50) + '\n');
        }
    }, []); 

    const fetchStats = useCallback(async () => {
        try {
            console.log('Загрузка статистики...');
            const response = await api.get('/equipment/stats');

            console.log('RAW stats:', response.data);

            // Проверяем формат статистики
            const statsData = response.data;

            // Нормализуем ключи статистики
            const normalizedStats = {
                down: statsData.down || statsData.in_repair || 0,
                ready: statsData.ready || 0,
                delay: statsData.delay || statsData.waiting || 0,
                standby: statsData.standby || statsData.scheduled || 0,
                shiftchange: statsData.shiftchange || 0,
                total: statsData.total || 0,
                by_section: statsData.by_section || {}
            };

            console.log('Normalized stats:', normalizedStats);
            setStats(normalizedStats);

        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);

            // Вычисляем локально если запрос провалился
            if (Array.isArray(equipment) && equipment.length > 0) {
                const localStats = {
                    down: 0,
                    ready: 0,
                    delay: 0,
                    standby: 0,
                    shiftchange: 0,
                    total: equipment.length,
                    by_section: {}
                };

                equipment.forEach(item => {
                    const status = (item.status || '').toLowerCase();

                    if (status === 'down' || status === 'in_repair') {
                        localStats.down++;
                    } else if (status === 'ready') {
                        localStats.ready++;
                    } else if (status === 'delay' || status === 'waiting') {
                        localStats.delay++;
                    } else if (status === 'standby' || status === 'scheduled') {
                        localStats.standby++;
                    } else if (status === 'shiftchange') {
                        localStats.shiftchange++;
                    }
                });

                console.log('Локально вычисленная статистика:', localStats);
                setStats(localStats);
            }
        }
    }, [equipment]);

    const refreshData = useCallback(async () => {
        console.log('Обновление данных...');
        setLoading(true);
        try {
            await fetchEquipment();
            // Статистика будет обновлена автоматически через useEffect
        } finally {
            setLoading(false);
        }
    }, [fetchEquipment]);

    useEffect(() => {
        console.log('Инициализация EquipmentProvider');
        refreshData();
    }, []);

    useEffect(() => {
        // Пересчитываем статистику при изменении оборудования
        if (Array.isArray(equipment) && equipment.length > 0) {
            fetchStats();
        }
    }, [equipment, fetchStats]);



    useEffect(() => {
        console.log('СОСТОЯНИЕ EQUIPMENT CONTEXT:', {
            equipment_count: Array.isArray(equipment) ? equipment.length : 'NOT ARRAY',
            equipment_type: typeof equipment,
            stats: stats,
            loading: loading,
            error: error,
            sample: Array.isArray(equipment) && equipment.length > 0 ? equipment[0] : null
        });
    }, [equipment, stats, loading, error]);

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