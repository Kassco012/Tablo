import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEquipment } from '../contexts/EquipmentContext';
import EquipmentTable from './EquipmentTable';
import { toast } from 'react-toastify';
import api from '../services/api';

const Dashboard = ({ onLoginClick }) => {
    const { user, logout } = useAuth();
    const { equipment, stats, loading, error, refreshData } = useEquipment();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [launchingIds, setLaunchingIds] = useState(new Set()); // Для отслеживания процесса запуска
    const [showLaunchConfirm, setShowLaunchConfirm] = useState(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Обновляем данные каждые 30 секунд
        const interval = setInterval(refreshData, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const handleLaunchEquipment = async (equipmentItem) => {
        // Проверяем права доступа
        if (!user || (user.role !== 'admin' && user.role !== 'dispatcher')) {
            toast.error('Недостаточно прав для запуска техники');
            return;
        }

        // Проверяем статус (можно запускать только готовую или запланированную технику)
        if (equipmentItem.status !== 'ready' && equipmentItem.status !== 'scheduled') {
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
            const response = await api.post(`/archive/launch/${equipmentId}`, {
                completion_reason: 'launched'
            });

            toast.success(`Техника ${equipmentId} успешно запущена в работу!`);
            setShowLaunchConfirm(null);

            // Обновляем данные
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
            'in_repair': 'В ремонте',
            'ready': 'Готово',
            'waiting': 'Ожидание',
            'scheduled': 'Запланировано'
        };
        return statusMap[status] || status;
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

    const getEquipmentTypeText = (type) => {
        return type === 'excavator' ? 'Экскаватор' : 'Погрузчик';
    };

    const canLaunch = (equipmentItem) => {
        return equipmentItem.status === 'ready' || equipmentItem.status === 'scheduled';
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
                <div className="header-left">
                    <h1>MMA АКТОГАЙ - МОНИТОРИНГ ТЕХНИКИ</h1>
                    <p>Ремонт экскаваторов и погрузчиков</p>
                </div>

                <div className="header-right">
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
                                minute: '2-digit'
                            })}
                        </div>
                    </div>

                    <div className="system-status">
                        <div className="status-dot"></div>
                        <span>Система активна</span>
                    </div>

                    {user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                                {user.fullName || user.username}
                            </span>
                            {(user.role === 'admin' || user.role === 'dispatcher') && (
                                <>
                                    <button
                                        className="login-button"
                                        onClick={() => window.location.href = '/admin'}
                                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                    >
                                        Админка
                                    </button>
                                    <button
                                        className="login-button"
                                        onClick={() => window.location.href = '/archive'}
                                        style={{
                                            padding: '8px 16px',
                                            fontSize: '0.9rem',
                                            background: 'rgba(108, 117, 125, 0.8)'
                                        }}
                                    >
                                        Архив
                                    </button>
                                </>
                            )}
                            <button
                                className="login-button"
                                onClick={logout}
                                style={{
                                    background: 'rgba(220, 53, 69, 0.8)',
                                    padding: '8px 16px',
                                    fontSize: '0.9rem'
                                }}
                            >
                                Выход
                            </button>
                        </div>
                    ) : (
                        <button className="login-button" onClick={onLoginClick}>
                            Вход для диспетчера
                        </button>
                    )}
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card repair">
                    <h3>В РЕМОНТЕ</h3>
                    <div className="number">{stats.in_repair || 0}</div>
                    <div className="label">единиц техники</div>
                </div>

                <div className="stat-card ready">
                    <h3>ГОТОВО</h3>
                    <div className="number">{stats.ready || 0}</div>
                    <div className="label">единиц техники</div>
                </div>

                <div className="stat-card waiting">
                    <h3>ОЖИДАНИЕ</h3>
                    <div className="number">{stats.waiting || 0}</div>
                    <div className="label">единиц техники</div>
                </div>

                <div className="stat-card total">
                    <h3>ВСЕГО</h3>
                    <div className="number">{stats.total || 0}</div>
                    <div className="label">единиц техники</div>
                </div>
            </div>

            <div className="equipment-section">
                <table className="equipment-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Тип/Модель</th>
                            <th>План/Факт</th>
                            <th>Доп. время</th>
                            <th>Окончание</th>
                            <th>Статус</th>
                            <th>Приоритет</th>
                            <th>Неисправность</th>
                            <th>Механик</th>
                            <th>Прогресс</th>
                            <th>Действие</th>
                        </tr>
                    </thead>
                    <tbody>
                        {equipment.map((item) => (
                            <tr
                                key={item.id}
                                onClick={() => user ? setSelectedEquipment(item) : null}
                                style={{ cursor: user ? 'pointer' : 'default' }}
                            >
                                <td>
                                    <span className="equipment-id">{item.id}</span>
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
                                <td>{formatTime(item.planned_end)}</td>
                                <td>
                                    <span className={`status-badge ${item.status}`}>
                                        {getStatusText(item.status)}
                                    </span>
                                </td>
                                <td>
                                    <span className={`priority-badge ${item.priority}`}>
                                        {getPriorityText(item.priority)}
                                    </span>
                                </td>
                                <td>{item.malfunction || '-'}</td>
                                <td>{item.mechanic_name || '-'}</td>
                                <td>
                                    <div className="progress-container">
                                        <div className="progress-text">{item.progress}%</div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${item.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {user && (user.role === 'admin' || user.role === 'dispatcher') && (
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            {canLaunch(item) ? (
                                                <button
                                                    className="launch-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Предотвращаем открытие модального окна
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
                                                        <>
                                                            ▶️ ЗАПУСК
                                                        </>
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
                    </tbody>
                </table>
            </div>

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
                padding: '10px 15px',
                borderRadius: '20px'
            }}>
                <div className="status-dot"></div>
                <span>Готовую технику можно запустить в работу</span>
                <span style={{ marginLeft: '10px' }}>
                    Обновлено: {currentTime.toLocaleTimeString('ru-RU')}
                    | Автообновление каждые 30 сек
                </span>
            </div>

            {/* Модальное окно подтверждения запуска */}
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
                                ⚠️ После запуска техника переместится в архив и исчезнет из списка.
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
                                    🚀 Запустить в работу
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