import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEquipment } from '../contexts/EquipmentContext';
import EquipmentTable from './EquipmentTable';
import { toast } from 'react-toastify';
import api from '../services/api';

// Компонент пользовательского dropdown
const UserProfileDropdown = ({ user }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getRoleText = (role) => {
        const roleMap = {
            'admin': 'Администратор',
            'dispatcher': 'Диспетчер',
            'mechanic': 'Механик',
            'viewer': 'Наблюдатель'
        };
        return roleMap[role] || role;
    };

    const getRoleColor = (role) => {
        const colorMap = {
            'admin': '#dc3545',
            'dispatcher': '#ffc107',
            'mechanic': '#28a745',
            'viewer': '#6c757d'
        };
        return colorMap[role] || '#6c757d';
    };

    return (
        <div
            ref={dropdownRef}
            style={{
                position: 'relative',
                display: 'inline-block'
            }}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    color: 'white'
                }}
                onMouseOver={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                    e.target.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.transform = 'scale(1)';
                }}
                title="Информация о пользователе"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: '45px',
                        right: '0',
                        background: 'rgba(30, 39, 46, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '15px',
                        minWidth: '220px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(10px)',
                        zIndex: 1000,
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        paddingBottom: '12px',
                        marginBottom: '12px'
                    }}>
                        <div style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            marginBottom: '4px'
                        }}>
                            Авторизован как:
                        </div>
                        <div style={{
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: '#ffffff',
                            marginBottom: '6px'
                        }}>
                            {user.fullName || user.username}
                        </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px'
                        }}>
                            <span style={{
                                fontSize: '0.85rem',
                                color: 'rgba(255, 255, 255, 0.7)'
                            }}>
                                Роль:
                            </span>
                            <span style={{
                                background: getRoleColor(user.role),
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                            }}>
                                {getRoleText(user.role)}
                            </span>
                        </div>

                        {user.email && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '6px'
                            }}>
                                <span style={{
                                    fontSize: '0.85rem',
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }}>
                                    Email:
                                </span>
                                <span style={{
                                    fontSize: '0.85rem',
                                    color: '#4facfe'
                                }}>
                                    {user.email}
                                </span>
                            </div>
                        )}

                        <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(255, 255, 255, 0.5)',
                            marginTop: '8px'
                        }}>
                            Сессия активна с {new Date().toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'rgba(40, 167, 69, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(40, 167, 69, 0.2)'
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#28a745',
                            animation: 'pulse 2s infinite'
                        }}></div>
                        <span style={{
                            fontSize: '0.8rem',
                            color: '#28a745',
                            fontWeight: '500'
                        }}>
                            Подключение активно
                        </span>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.2);
                        opacity: 0.7;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .compact-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }
            `}</style>
        </div>
    );
};

const Dashboard = ({ onLoginClick }) => {
    const { user, logout } = useAuth();
    const { equipment, stats, loading, error, refreshData } = useEquipment();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [launchingIds, setLaunchingIds] = useState(new Set());
    const [showLaunchConfirm, setShowLaunchConfirm] = useState(null);

    // ПАГИНАЦИЯ
    const ITEMS_PER_PAGE = 5;
    const AUTO_SWITCH_INTERVAL = 10000;

    const [currentPage, setCurrentPage] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Состояния для фильтрации
    const [selectedSection, setSelectedSection] = useState('');
    const [sections, setSections] = useState([]);
    const [filteredEquipment, setFilteredEquipment] = useState([]);

    const SECTIONS = [
        'колесные техники',
        'гусеничные техники',
        'шиномонтажные работы',
        'капитальный ремонт',
        'энергоучасток',
        'легкотоннажные техники'
    ];

    const totalPages = Math.ceil(filteredEquipment.length / ITEMS_PER_PAGE);
    const currentEquipment = filteredEquipment.slice(
        currentPage * ITEMS_PER_PAGE,
        (currentPage + 1) * ITEMS_PER_PAGE
    );

    // Автоматическое переключение страниц
    useEffect(() => {
        if (isPaused || totalPages <= 1) return;

        const interval = setInterval(() => {
            setCurrentPage(prev => (prev + 1) % totalPages);
        }, AUTO_SWITCH_INTERVAL);

        return () => clearInterval(interval);
    }, [totalPages, isPaused]);

    // Сброс на первую страницу при изменении фильтров
    useEffect(() => {
        setCurrentPage(0);
    }, [selectedSection, filteredEquipment.length]);

    // ОБНОВЛЕНИЕ ВРЕМЕНИ КАЖДУЮ СЕКУНДУ
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000); // Обновляем каждую секунду

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const interval = setInterval(refreshData, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    useEffect(() => {
        loadSections();
    }, []);

    useEffect(() => {
        if (selectedSection) {
            setFilteredEquipment(equipment.filter(item => item.section === selectedSection));
        } else {
            setFilteredEquipment(equipment);
        }
    }, [equipment, selectedSection]);

    const loadSections = async () => {
        try {
            const response = await api.get('/equipment/sections');
            setSections(response.data);
        } catch (error) {
            console.error('Error loading sections:', error);
        }
    };

    const handleLaunchEquipment = async (equipmentItem) => {
        if (!user || (user.role !== 'admin' && user.role !== 'dispatcher')) {
            toast.error('Недостаточно прав для запуска техники');
            return;
        }

        if (equipmentItem.status !== 'Ready' && equipmentItem.status !== 'Standby') {
            toast.error('Можно запускать только готовую или запланированную технику');
            return;
        }

        setShowLaunchConfirm(equipmentItem);
    };

    const confirmLaunch = async () => {
        if (!showLaunchConfirm) return;

        const equipmentId = showLaunchConfirm.id;
        setLaunchingIds(prev => new Set(prev.add(equipmentId)));

        try {
            await api.post(`/archive/launch/${equipmentId}`, {
                completion_reason: 'launched'
            });

            toast.success(`Техника ${equipmentId} успешно запущена в работу!`);
            setShowLaunchConfirm(null);
            await refreshData();

        } catch (error) {
            console.error('Error launching equipment:', error);
            toast.error(error.message || 'Ошибка запуска техники');
        } finally {
            setLaunchingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(equipmentId);
                return newSet;
            });
        }
    };

    const formatTime = (timeString) => {
        if (!timeString) return '-';
        return timeString;
    };

    const getStatusText = (status) => {
        const statusMap = {
            'Down': 'Down',
            'Ready': 'Ready',
            'Standby': 'Standby',
            'Delay': 'Delay',
            'Shiftchange': 'Shiftchange'
        };
        return statusMap[status] || status;
    };

    const getEquipmentTypeText = (type) => {
        return type === 'excavator' ? 'Экскаватор' : 'Погрузчик';
    };

    const getSectionText = (section) => {
        return section || 'Не указан';
    };

    const canLaunch = (equipmentItem) => {
        return equipmentItem.status === 'Ready' || equipmentItem.status === 'Standby';
    };

    const clearFilter = () => {
        setSelectedSection('');
    };

    const togglePause = () => {
        setIsPaused(!isPaused);
    };

    const goToPage = (page) => {
        setCurrentPage(page);
        setIsPaused(true);
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Загрузка данных...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard">
                <div className="error-message">
                    <h2>Ошибка загрузки данных</h2>
                    <p>{error}</p>
                    <button onClick={refreshData} className="login-button">
                        Попробовать снова
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                {/* ВРЕМЯ ОТДЕЛЬНО СЛЕВА */}
                <div className="header-left">
                    <div className="current-time">
                        <div className="date">
                            {currentTime.toLocaleDateString('ru-RU', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                        <div className="time">
                            {currentTime.toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit' // ДОБАВИЛИ СЕКУНДЫ
                            })}
                        </div>
                    </div>
                </div>

                <div className="header-right">
                    {/* ФИЛЬТР УЧАСТКОВ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.8)',
                            whiteSpace: 'nowrap'
                        }}>
                            Фильтр по участкам:
                        </span>
                        <select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                minWidth: '160px',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">Все участки</option>
                            {SECTIONS.map(section => (
                                <option key={section} value={section}>
                                    {getSectionText(section)}
                                    {sections.find(s => s.section === section) &&
                                        ` (${sections.find(s => s.section === section).total})`
                                    }
                                </option>
                            ))}
                        </select>
                        {selectedSection && (
                            <button
                                onClick={clearFilter}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseOver={(e) => {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* КНОПКИ И ПОЛЬЗОВАТЕЛЬ */}
                    {user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {(user.role === 'admin' || user.role === 'dispatcher') && (
                                    <>
                                        <button
                                            className="compact-button"
                                            onClick={() => window.location.href = '/admin'}
                                            title="Панель администратора"
                                            style={{
                                                background: 'rgba(0, 123, 255, 0.8)',
                                                border: 'none',
                                                color: 'white',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            Админка
                                        </button>
                                        <button
                                            className="compact-button"
                                            onClick={() => window.location.href = '/archive'}
                                            title="Архив техники"
                                            style={{
                                                background: 'rgba(108, 117, 125, 0.8)',
                                                border: 'none',
                                                color: 'white',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            Архив
                                        </button>
                                    </>
                                )}
                                <button
                                    className="compact-button"
                                    onClick={logout}
                                    title="Выйти из системы"
                                    style={{
                                        background: 'rgba(220, 53, 69, 0.8)',
                                        border: 'none',
                                        color: 'white',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    Выход
                                </button>
                            </div>
                            <UserProfileDropdown user={user} />
                        </div>
                    ) : (
                        <button className="login-button" onClick={onLoginClick}>
                            Вход для диспетчера
                        </button>
                    )}
                </div>
            </div>

            {/* Остальной код остается без изменений */}
            <div className="stats-grid">
                <div className="stat-card repair">
                    <h3>DOWN</h3>
                    <div className="number">
                        {selectedSection
                            ? filteredEquipment.filter(item => item.status === 'Down').length
                            : stats.down || 0
                        }
                    </div>
                    <div className="label">единиц техники</div>
                </div>

                <div className="stat-card ready">
                    <h3>READY</h3>
                    <div className="number">
                        {selectedSection
                            ? filteredEquipment.filter(item => item.status === 'Ready').length
                            : stats.ready || 0
                        }
                    </div>
                    <div className="label">единиц техники</div>
                </div>

                <div className="stat-card waiting">
                    <h3>DELAY</h3>
                    <div className="number">
                        {selectedSection
                            ? filteredEquipment.filter(item => item.status === 'Delay').length
                            : stats.delay || 0
                        }
                    </div>
                    <div className="label">единиц техники</div>
                </div>

                <div className="stat-card standby">
                    <h3>STANDBY</h3>
                    <div className="number">
                        {selectedSection
                            ? filteredEquipment.filter(item => item.status === 'Standby').length
                            : stats.standby || 0
                        }
                    </div>
                    <div className="label">единиц техники</div>
                </div>

                <div className="stat-card shiftchange">
                    <h3>SHIFTCHANGE</h3>
                    <div className="number">
                        {selectedSection
                            ? filteredEquipment.filter(item => item.status === 'Shiftchange').length
                            : stats.shiftchange || 0
                        }
                    </div>
                    <div className="label">единиц техники</div>
                </div>
            </div>

            <div className="equipment-section">
                <table className="equipment-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Участок</th>
                            <th>Тип/Модель</th>
                            <th>План/Факт</th>
                            <th>Доп. время</th>
                            <th>Статус</th>
                            <th>Неисправность</th>
                            <th>Механик</th>
                            <th>Действие</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentEquipment.map((item) => (
                            <tr
                                key={item.id}
                                onClick={() => user ? setSelectedEquipment(item) : null}
                                style={{
                                    cursor: user ? 'pointer' : 'default',
                                    animation: 'fadeInUp 0.5s ease-out'
                                }}
                            >
                                <td>
                                    <span className="equipment-id">{item.id}</span>
                                </td>
                                <td>
                                    <div style={{
                                        fontSize: '0.85rem',
                                        fontWeight: '500',
                                        color: '#4facfe',
                                        background: 'rgba(79, 172, 254, 0.1)',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {getSectionText(item.section)}
                                    </div>
                                </td>
                                <td>
                                    <div className="equipment-type">
                                        <span className="type">
                                            {getEquipmentTypeText(item.type)}
                                        </span>
                                        <span className="model">{item.model}</span>
                                    </div>
                                </td>
                                <td>
                                    <div className="time-info">
                                        <div className="planned">
                                            План: {formatTime(item.planned_start)} - {formatTime(item.planned_end)}
                                        </div>
                                        <div className="actual">
                                            Факт: {formatTime(item.actual_start)} - {formatTime(item.actual_end)}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`delay ${item.delay_hours > 0 ? 'positive' : 'zero'}`}>
                                        {item.delay_hours > 0 ? `+${item.delay_hours}ч` : '-'}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-badge ${item.status}`}>
                                        {getStatusText(item.status)}
                                    </span>
                                </td>
                                <td>{item.malfunction || '-'}</td>
                                <td>{item.mechanic_name || '-'}</td>
                                <td>
                                    {user && (user.role === 'admin' || user.role === 'dispatcher') && (
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            {canLaunch(item) ? (
                                                <button
                                                    className="launch-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLaunchEquipment(item);
                                                    }}
                                                    disabled={launchingIds.has(item.id)}
                                                    style={{
                                                        background: launchingIds.has(item.id)
                                                            ? 'rgba(40, 167, 69, 0.5)'
                                                            : 'linear-gradient(135deg, #28a745, #20c997)',
                                                        border: 'none',
                                                        color: 'white',
                                                        padding: '8px 16px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: '600',
                                                        cursor: launchingIds.has(item.id) ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        minWidth: '80px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '5px'
                                                    }}
                                                    title="Запустить технику в работу"
                                                >
                                                    {launchingIds.has(item.id) ? (
                                                        <>
                                                            <div style={{
                                                                width: '12px',
                                                                height: '12px',
                                                                border: '2px solid rgba(255,255,255,0.3)',
                                                                borderLeft: '2px solid white',
                                                                borderRadius: '50%',
                                                                animation: 'spin 1s linear infinite'
                                                            }}></div>
                                                            Запуск...
                                                        </>
                                                    ) : (
                                                        <>ЗАПУСК</>
                                                    )}
                                                </button>
                                            ) : (
                                                <span
                                                    style={{
                                                        color: 'rgba(255,255,255,0.5)',
                                                        fontSize: '0.8rem',
                                                        fontStyle: 'italic'
                                                    }}
                                                    title="Нельзя запустить в текущем статусе"
                                                >
                                                    -
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {currentEquipment.length < ITEMS_PER_PAGE &&
                            Array.from({ length: ITEMS_PER_PAGE - currentEquipment.length }, (_, i) => (
                                <tr key={`empty-${i}`} style={{ opacity: 0.3 }}>
                                    <td colSpan="9" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                        -
                                    </td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    marginTop: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <div style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#4facfe'
                    }}>
                        Страница {currentPage + 1} из {totalPages}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {Array.from({ length: totalPages }, (_, i) => (
                            <div
                                key={i}
                                onClick={() => user && (user.role === 'admin' || user.role === 'dispatcher') ? goToPage(i) : null}
                                style={{
                                    width: currentPage === i ? '32px' : '12px',
                                    height: '12px',
                                    borderRadius: '6px',
                                    background: currentPage === i
                                        ? 'linear-gradient(135deg, #4facfe, #00f2fe)'
                                        : 'rgba(255, 255, 255, 0.3)',
                                    cursor: user && (user.role === 'admin' || user.role === 'dispatcher') ? 'pointer' : 'default',
                                    transition: 'all 0.3s ease',
                                    boxShadow: currentPage === i ? '0 0 15px rgba(79, 172, 254, 0.5)' : 'none',
                                    opacity: user && (user.role === 'admin' || user.role === 'dispatcher') ? 1 : 0.5
                                }}
                            />
                        ))}
                    </div>

                    {user && (user.role === 'admin' || user.role === 'dispatcher') ? (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button
                                onClick={togglePause}
                                style={{
                                    background: isPaused ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255, 193, 7, 0.2)',
                                    border: `1px solid ${isPaused ? 'rgba(40, 167, 69, 0.5)' : 'rgba(255, 193, 7, 0.5)'}`,
                                    color: isPaused ? '#28a745' : '#ffc107',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '500',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {isPaused ? '▶ Продолжить' : '⏸ Пауза'}
                            </button>

                            <div style={{
                                fontSize: '0.85rem',
                                color: 'rgba(255, 255, 255, 0.6)',
                                fontStyle: 'italic'
                            }}>
                                {isPaused ? 'На паузе' : `Автосмена через ${AUTO_SWITCH_INTERVAL / 1000}с`}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontStyle: 'italic'
                        }}>
                            {isPaused ? 'На паузе' : `Автосмена через ${AUTO_SWITCH_INTERVAL / 1000}с`}
                        </div>
                    )}
                </div>
            )}

            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.6)',
                background: 'rgba(0,0,0,0.5)',
                padding: '8px 12px',
                borderRadius: '16px'
            }}>
                <div className="status-dot"></div>
                <span>Показано: {currentEquipment.length} из {filteredEquipment.length}</span>
                {totalPages > 1 && (
                    <span style={{
                        marginLeft: '5px',
                        padding: '2px 6px',
                        background: 'rgba(79, 172, 254, 0.2)',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                    }}>
                        Стр. {currentPage + 1}/{totalPages}
                    </span>
                )}
                {selectedSection && (
                    <span style={{
                        marginLeft: '5px',
                        padding: '2px 6px',
                        background: 'rgba(79, 172, 254, 0.2)',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                    }}>
                        {getSectionText(selectedSection)}
                    </span>
                )}
            </div>

            <style jsx>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>

            {showLaunchConfirm && (
                <div className="modal-backdrop" onClick={() => setShowLaunchConfirm(null)}>
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>🚀 Подтверждение запуска</h3>
                            <button
                                className="close-button"
                                onClick={() => setShowLaunchConfirm(null)}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ padding: '25px' }}>
                            <p style={{ fontSize: '1.1rem', marginBottom: '15px' }}>
                                Отправить технику <strong>{showLaunchConfirm.id}</strong> в работу?
                            </p>
                            <div style={{
                                background: 'rgba(40, 167, 69, 0.1)',
                                padding: '15px',
                                borderRadius: '8px',
                                marginBottom: '20px'
                            }}>
                                <div><strong>Участок:</strong> {getSectionText(showLaunchConfirm.section)}</div>
                                <div><strong>Тип:</strong> {getEquipmentTypeText(showLaunchConfirm.type)}</div>
                                <div><strong>Модель:</strong> {showLaunchConfirm.model}</div>
                                <div><strong>Статус:</strong> {getStatusText(showLaunchConfirm.status)}</div>
                                <div><strong>Механик:</strong> {showLaunchConfirm.mechanic_name || 'Не назначен'}</div>
                            </div>
                            <p style={{
                                fontSize: '0.9rem',
                                color: 'rgba(255,255,255,0.7)',
                                marginBottom: '25px'
                            }}>
                                После запуска техника переместится в архив и исчезнет из списка.
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: '15px',
                                justifyContent: 'flex-end'
                            }}>
                                <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={() => setShowLaunchConfirm(null)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: 'rgba(255, 255, 255, 0.8)',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Отмена
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmLaunch}
                                    style={{
                                        background: 'linear-gradient(135deg, #28a745, #20c997)',
                                        border: 'none',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    Запустить в работу
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedEquipment && (
                <EquipmentTable
                    equipment={selectedEquipment}
                    isOpen={!!selectedEquipment}
                    onClose={() => setSelectedEquipment(null)}
                    onSave={refreshData}
                />
            )}
        </div>
    );
};

export default Dashboard;