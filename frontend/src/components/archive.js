import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Archive = () => {
    const { user } = useAuth();
    const [archives, setArchives] = useState([]);
    const [filteredArchives, setFilteredArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [stats, setStats] = useState({
        total_archived: 0,
        launched: 0,
        completed: 0,
        cancelled: 0
    });

    // Фильтры
    const [filters, setFilters] = useState({
        id: '',
        type: '',
        mechanic: '',
        dateFrom: '',
        dateTo: ''
    });

    useEffect(() => {
        if (user && (user.role === 'admin' || user.role === 'dispatcher')) {
            fetchArchives();
            fetchStats();
        }
    }, [user]);

    useEffect(() => {
        applyFilters();
    }, [archives, filters]);

    const fetchArchives = async () => {
        try {
            setLoading(true);
            console.log('Загрузка архивных данных...');
            const response = await api.get('/archive');
            console.log('Получены архивные данные:', response.data);

            setArchives(response.data.archives || []);
        } catch (error) {
            console.error('Ошибка загрузки архива:', error);
            setArchives([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            console.log('Загрузка статистики архива...');
            const response = await api.get('/archive/stats');
            console.log('Получена статистика:', response.data);

            setStats(response.data.summary || {
                total_archived: 0,
                launched: 0,
                completed: 0,
                cancelled: 0
            });
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    };

    const applyFilters = () => {
        let filtered = [...archives];

        if (filters.id) {
            filtered = filtered.filter(item =>
                item.id.toLowerCase().includes(filters.id.toLowerCase())
            );
        }

        if (filters.type) {
            filtered = filtered.filter(item => item.type === filters.type);
        }

        if (filters.mechanic) {
            filtered = filtered.filter(item =>
                item.mechanic_name &&
                item.mechanic_name.toLowerCase().includes(filters.mechanic.toLowerCase())
            );
        }

        if (filters.dateFrom) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.completed_date);
                const fromDate = new Date(filters.dateFrom);
                return itemDate >= fromDate;
            });
        }

        if (filters.dateTo) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.completed_date);
                const toDate = new Date(filters.dateTo + 'T23:59:59');
                return itemDate <= toDate;
            });
        }

        setFilteredArchives(filtered);
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const clearFilters = () => {
        setFilters({
            id: '',
            type: '',
            mechanic: '',
            dateFrom: '',
            dateTo: ''
        });
    };

    const exportToExcel = async () => {
        setExporting(true);
        try {
            // Подготавливаем данные для экспорта
            const exportData = filteredArchives.map(item => ({
                'ID': item.id,
                'Тип': getEquipmentTypeText(item.type),
                'Модель': item.model,
                'Механик': item.mechanic_name || '-',
                'Прогресс (%)': item.progress || 0,
                'Приоритет': getPriorityText(item.priority),
                'Плановое начало': item.planned_start || '-',
                'Плановое окончание': item.planned_end || '-',
                'Фактическое начало': item.actual_start || '-',
                'Фактическое окончание': item.actual_end || '-',
                'Задержка (часы)': item.delay_hours || 0,
                'Неисправность': item.malfunction || '-',
                'Дата архивирования': formatDateTime(item.completed_date),
                'Причина архивирования': item.archive_reason || 'launched'
            }));

            // Конвертируем в CSV с BOM для корректного отображения в Excel
            const csvContent = convertToCSV(exportData);
            // Добавляем BOM (Byte Order Mark) для UTF-8
            const csvWithBOM = '\uFEFF' + csvContent;

            // Создаем и скачиваем файл
            const blob = new Blob([csvWithBOM], {
                type: 'text/csv;charset=utf-8;'
            });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);

            const today = new Date().toISOString().split('T')[0];
            const filename = `архив_техники_${today}_${filteredArchives.length}_записей.csv`;
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log(`Экспортировано ${filteredArchives.length} записей`);
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            alert('Ошибка при экспорте данных');
        } finally {
            setExporting(false);
        }
    };

    const convertToCSV = (data) => {
        if (!data.length) return '';

        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');

        const csvRows = data.map(row =>
            headers.map(header => {
                const value = row[header];
                // Экранируем кавычки и переносы строк
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',')
        );

        return [csvHeaders, ...csvRows].join('\n');
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const getEquipmentTypeText = (type) => {
        return type === 'excavator' ? 'Экскаватор' : 'Погрузчик';
    };

    const getPriorityText = (priority) => {
        const priorityMap = {
            'low': 'Низкий',
            'normal': 'Обычный',
            'medium': 'Средний',
            'high': 'Высокий',
            'critical': 'Критический'
        };
        return priorityMap[priority] || priority;
    };

    const getUniqueValues = (data, key) => {
        return [...new Set(data.map(item => item[key]).filter(Boolean))];
    };

    // Проверка прав доступа
    if (!user || (user.role !== 'admin' && user.role !== 'dispatcher')) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '50px',
                color: 'rgba(255,255,255,0.7)'
            }}>
                <h3>Доступ запрещен</h3>
                <p>Только администраторы и диспетчеры могут просматривать архив</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px 0' }}>
            {/* Заголовок с кнопкой "Назад к табло" */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '30px',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div>
                    <h2 style={{
                        fontSize: '1.8rem',
                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '10px'
                    }}>
                        Архив Техники
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                        История запущенного и завершенного оборудования
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                            e.target.style.transform = 'translateX(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.target.style.transform = 'translateX(0)';
                        }}
                    >
                        ← Назад к табло
                    </button>

                    <div style={{
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '0.9rem',
                        padding: '8px 15px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        {user?.fullName || user?.username} ({user?.role === 'admin' ? 'Администратор' : 'Диспетчер'})
                    </div>
                </div>
            </div>

            {/* Статистика */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px',
                marginBottom: '30px'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🚀</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4facfe' }}>
                        {stats.launched || 0}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        Запущено
                    </div>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '5px' }}>✅</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                        {stats.completed || 0}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        Завершено
                    </div>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '5px' }}>📁</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6f42c1' }}>
                        {stats.total_archived || 0}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                        Всего в архиве
                    </div>
                </div>
            </div>

            {/* Фильтры */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '25px',
                marginBottom: '25px'
            }}>
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{
                        fontSize: '1.2rem',
                        margin: '0 0 20px 0',
                        color: '#4facfe'
                    }}>
                        Фильтры
                    </h3>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '20px',
                    marginBottom: '20px'
                }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.8)'
                        }}>
                            ID оборудования
                        </label>
                        <input
                            type="text"
                            placeholder="EX001, LD002..."
                            value={filters.id}
                            onChange={(e) => handleFilterChange('id', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.8)'
                        }}>
                            Тип техники
                        </label>
                        <select
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#ffffff',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="">Все типы</option>
                            <option value="excavator">Экскаватор</option>
                            <option value="loader">Погрузчик</option>
                        </select>
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.8)'
                        }}>
                            Механик
                        </label>
                        <input
                            type="text"
                            placeholder="Имя механика..."
                            value={filters.mechanic}
                            onChange={(e) => handleFilterChange('mechanic', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.8)'
                        }}>
                            Дата с
                        </label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.8)'
                        }}>
                            Дата по
                        </label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '15px',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={clearFilters}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Очистить фильтры
                    </button>

                    <button
                        onClick={exportToExcel}
                        disabled={exporting || filteredArchives.length === 0}
                        style={{
                            background: exporting ? 'rgba(40, 167, 69, 0.5)' : 'linear-gradient(135deg, #28a745, #20c997)',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: exporting || filteredArchives.length === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {exporting ? (
                            <>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderLeft: '2px solid white',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }}></div>
                                Экспорт...
                            </>
                        ) : (
                            <>
                                📊 Экспорт в Excel ({filteredArchives.length})
                            </>
                        )}
                    </button>

                    <div style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '0.9rem',
                        fontStyle: 'italic'
                    }}>
                        Найдено записей: {filteredArchives.length} из {archives.length}
                    </div>
                </div>
            </div>

            {/* Содержимое */}
            {loading ? (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: 'rgba(255,255,255,0.7)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid rgba(255, 255, 255, 0.1)',
                        borderLeft: '4px solid #4facfe',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }}></div>
                    <p>Загрузка архивных данных...</p>
                </div>
            ) : filteredArchives.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255,255,255,0.7)'
                }}>
                    <h3 style={{ marginBottom: '10px', color: 'rgba(255,255,255,0.8)' }}>
                        {archives.length === 0 ? 'Архивные записи не найдены' : 'Нет записей по выбранным фильтрам'}
                    </h3>
                    <p>
                        {archives.length === 0
                            ? 'Архив пока пуст. Запустите технику в работу через главное табло.'
                            : 'Попробуйте изменить параметры фильтрации.'
                        }
                    </p>
                    {archives.length === 0 && (
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{
                                background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                marginTop: '15px'
                            }}
                        >
                            Перейти к табло
                        </button>
                    )}
                </div>
            ) : (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600' }}>ID</th>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600' }}>Тип/Модель</th>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600' }}>Механик</th>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600' }}>Прогресс</th>
                                <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600' }}>Дата архивирования</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredArchives.map((item, index) => (
                                <tr key={item.archive_id || index} style={{
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{
                                            fontWeight: 'bold',
                                            color: '#ffd700'
                                        }}>
                                            {item.id}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div>
                                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                                {getEquipmentTypeText(item.type)}
                                            </div>
                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: 'rgba(255,255,255,0.7)'
                                            }}>
                                                {item.model}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        {item.mechanic_name || '-'}
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '50px',
                                                height: '6px',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                borderRadius: '3px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${item.progress || 0}%`,
                                                    background: 'linear-gradient(90deg, #28a745, #20c997)',
                                                    borderRadius: '3px'
                                                }}></div>
                                            </div>
                                            <span>{item.progress || 0}%</span>
                                        </div>
                                    </td>
                                    <td style={{
                                        padding: '15px',
                                        fontSize: '0.85rem',
                                        fontFamily: 'monospace',
                                        color: 'rgba(255,255,255,0.8)'
                                    }}>
                                        {formatDateTime(item.completed_date)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Archive;