// frontend/components/DataManagement.js - Компонент управления данными

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

const DataManagement = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncSettings, setSyncSettings] = useState(null);
    const [cleanupDays, setCleanupDays] = useState(30);
    const [dateFilter, setDateFilter] = useState({
        dateFrom: '',
        dateTo: ''
    });
    const [filteredData, setFilteredData] = useState([]);

    useEffect(() => {
        loadStats();
        loadSyncSettings();
    }, []);

    const loadStats = async () => {
        try {
            const response = await api.get('/equipment/stats/periods');
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    };

    const loadSyncSettings = async () => {
        try {
            const response = await api.get('/equipment/sync-settings');
            if (response.data.success) {
                setSyncSettings(response.data.data);
            }
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
        }
    };

    const handleCleanup = async () => {
        if (!window.confirm(`Деактивировать все записи старше ${cleanupDays} дней?`)) {
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/equipment/cleanup', { daysOld: cleanupDays });

            if (response.data.success) {
                toast.success(response.data.message);
                loadStats();
            }
        } catch (error) {
            console.error('Ошибка очистки:', error);
            toast.error('Ошибка при очистке данных');
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('⚠️ ВНИМАНИЕ! Это деактивирует ВСЕ записи на дашборде. Продолжить?')) {
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/equipment/clear-all');

            if (response.data.success) {
                toast.success(response.data.message);
                loadStats();
            }
        } catch (error) {
            console.error('Ошибка очистки:', error);
            toast.error('Ошибка при очистке дашборда');
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = async () => {
        if (!dateFilter.dateFrom && !dateFilter.dateTo) {
            toast.warning('Укажите хотя бы одну дату');
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFilter.dateFrom) params.append('dateFrom', dateFilter.dateFrom);
            if (dateFilter.dateTo) params.append('dateTo', dateFilter.dateTo);

            const response = await api.get(`/equipment/filter?${params.toString()}`);

            if (response.data.success) {
                setFilteredData(response.data.data);
                toast.info(`Найдено записей: ${response.data.count}`);
            }
        } catch (error) {
            console.error('Ошибка фильтрации:', error);
            toast.error('Ошибка при фильтрации данных');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelected = async (equipmentIds) => {
        if (!equipmentIds.length) {
            toast.warning('Выберите записи для удаления');
            return;
        }

        if (!window.confirm(`Удалить ${equipmentIds.length} записей?`)) {
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/equipment/delete', { equipmentIds });

            if (response.data.success) {
                toast.success(response.data.message);
                loadStats();
                handleFilter(); // Обновляем отфильтрованные данные
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
            toast.error('Ошибка при удалении записей');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            padding: '30px',
            background: 'linear-gradient(135deg, #1e272e 0%, #2d3436 100%)',
            minHeight: '100vh',
            color: '#ffffff'
        }}>
            <h1 style={{ marginBottom: '30px', fontSize: '2rem' }}>
                🛠️ Управление данными
            </h1>

            {/* Статистика */}
            {stats && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '20px',
                    marginBottom: '30px'
                }}>
                    <StatCard
                        title="Всего записей"
                        value={stats.total}
                        color="#4facfe"
                    />
                    <StatCard
                        title="Активных"
                        value={stats.active}
                        color="#28a745"
                    />
                    <StatCard
                        title="За сегодня"
                        value={stats.today}
                        color="#ffc107"
                    />
                    <StatCard
                        title="За 7 дней"
                        value={stats.last_7_days}
                        color="#17a2b8"
                    />
                    <StatCard
                        title="За 30 дней"
                        value={stats.last_30_days}
                        color="#6c757d"
                    />
                </div>
            )}

            {/* Настройки синхронизации */}
            {syncSettings && (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    marginBottom: '30px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <h3 style={{ marginBottom: '15px' }}>⚙️ Настройки синхронизации</h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                            <strong>Период загрузки данных:</strong> {syncSettings.syncPeriodDays} дней
                        </div>
                        <div>
                            <strong>Последняя синхронизация:</strong> {
                                syncSettings.lastSyncTime
                                    ? new Date(syncSettings.lastSyncTime).toLocaleString('ru-RU')
                                    : 'Не выполнялась'
                            }
                        </div>
                        <div>
                            <strong>Статус:</strong> {
                                syncSettings.syncInProgress
                                    ? '🔄 Выполняется'
                                    : '✅ Готов'
                            }
                        </div>
                    </div>
                    <div style={{
                        marginTop: '15px',
                        padding: '15px',
                        background: 'rgba(79, 172, 254, 0.1)',
                        borderRadius: '8px',
                        fontSize: '0.9rem'
                    }}>
                        💡 <strong>Подсказка:</strong> Для изменения периода синхронизации измените
                        константу <code>SYNC_PERIOD_DAYS</code> в файле <code>JMineOpsDataService.js</code>
                    </div>
                </div>
            )}

            {/* Управление */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '25px',
                borderRadius: '12px',
                marginBottom: '30px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <h3 style={{ marginBottom: '20px' }}>🧹 Очистка данных</h3>

                {/* Очистка по возрасту */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px' }}>
                        Деактивировать записи старше (дней):
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="number"
                            value={cleanupDays}
                            onChange={(e) => setCleanupDays(parseInt(e.target.value))}
                            min="1"
                            max="365"
                            style={{
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                width: '100px'
                            }}
                        />
                        <button
                            onClick={handleCleanup}
                            disabled={loading}
                            style={{
                                background: 'linear-gradient(135deg, #f39c12, #e67e22)',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                opacity: loading ? 0.6 : 1
                            }}
                        >
                            {loading ? '⏳ Очистка...' : '🧹 Очистить старые'}
                        </button>
                    </div>
                </div>

                {/* Полная очистка */}
                <div>
                    <button
                        onClick={handleClearAll}
                        disabled={loading}
                        style={{
                            background: 'linear-gradient(135deg, #dc3545, #c82333)',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        {loading ? '⏳ Очистка...' : '⚠️ Очистить весь дашборд'}
                    </button>
                    <p style={{
                        marginTop: '10px',
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                        Деактивирует все записи на дашборде (не удаляет из базы данных)
                    </p>
                </div>
            </div>

            {/* Фильтрация по датам */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '25px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <h3 style={{ marginBottom: '20px' }}>🔍 Фильтрация по датам</h3>

                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                            От:
                        </label>
                        <input
                            type="date"
                            value={dateFilter.dateFrom}
                            onChange={(e) => setDateFilter({ ...dateFilter, dateFrom: e.target.value })}
                            style={{
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#ffffff'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                            До:
                        </label>
                        <input
                            type="date"
                            value={dateFilter.dateTo}
                            onChange={(e) => setDateFilter({ ...dateFilter, dateTo: e.target.value })}
                            style={{
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#ffffff'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                            onClick={handleFilter}
                            disabled={loading}
                            style={{
                                background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                opacity: loading ? 0.6 : 1
                            }}
                        >
                            {loading ? '⏳ Загрузка...' : '🔍 Показать'}
                        </button>
                    </div>
                </div>

                {/* Результаты фильтрации */}
                {filteredData.length > 0 && (
                    <div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '15px'
                        }}>
                            <h4>Найдено записей: {filteredData.length}</h4>
                            <button
                                onClick={() => {
                                    const ids = filteredData.map(item => item.id);
                                    handleDeleteSelected(ids);
                                }}
                                style={{
                                    background: 'rgba(220, 53, 69, 0.2)',
                                    border: '1px solid #dc3545',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    color: '#dc3545',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                🗑️ Удалить все отфильтрованные
                            </button>
                        </div>
                        <div style={{
                            maxHeight: '400px',
                            overflow: 'auto',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '8px',
                            padding: '15px'
                        }}>
                            {filteredData.map(item => (
                                <div key={item.id} style={{
                                    padding: '10px',
                                    marginBottom: '8px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <strong>{item.id}</strong> - {item.equipment_type} ({item.model})
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                            Создано: {new Date(item.created_at).toLocaleString('ru-RU')}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteSelected([item.id])}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid rgba(220, 53, 69, 0.5)',
                                            padding: '5px 10px',
                                            borderRadius: '4px',
                                            color: '#dc3545',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        Удалить
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Компонент карточки статистики
const StatCard = ({ title, value, color }) => (
    <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '20px',
        borderRadius: '12px',
        border: `1px solid ${color}30`,
        textAlign: 'center'
    }}>
        <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: color,
            marginBottom: '8px'
        }}>
            {value}
        </div>
        <div style={{
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.7)'
        }}>
            {title}
        </div>
    </div>
);

export default DataManagement;