// frontend/src/components/AdminPanel.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useEquipment } from '../contexts/EquipmentContext';
import EquipmentTable from './EquipmentTable';
import Archive from './archive';
import './AdminPanel.css';
import {
    getEquipmentTypeText
} from '../components/EquipmentTypes';

const AdminPanel = () => {
    const { user, logout } = useAuth();
    const {
        equipment,
        stats,
        loading,
        refreshData,
        createEquipment,
        deleteEquipment
    } = useEquipment();

    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // ✅ ИСПРАВЛЕНО: используем equipment_type вместо type
    const [newEquipment, setNewEquipment] = useState({
        id: '',
        equipment_type: '',  // ← БЫЛО: type
        model: '',
        status: '',
        planned_start: '',
        planned_end: '',
        malfunction: '',
        mechanic_name: ''
    });

    const [activeTab, setActiveTab] = useState('equipment');

    useEffect(() => {
        const interval = setInterval(refreshData, 60000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const handleCreateEquipment = async (e) => {
        e.preventDefault();

        // ✅ ИСПРАВЛЕНО: проверяем equipment_type
        if (!newEquipment.id || !newEquipment.equipment_type || !newEquipment.model) {
            toast.error('Заполните обязательные поля: ID, тип и модель');
            return;
        }

        try {
            await createEquipment(newEquipment);
            toast.success('Оборудование создано успешно!');
            setShowCreateModal(false);
            setNewEquipment({
                id: '',
                equipment_type: '',  
                model: '',
                status: '',
                planned_start: '',
                planned_end: '',
                malfunction: '',
                mechanic_name: ''
            });
        } catch (error) {
            toast.error(error.message || 'Ошибка создания оборудования');
        }
    };

    const handleDeleteEquipment = async (id) => {
        if (!window.confirm('Вы уверены, что хотите удалить это оборудование?')) {
            return;
        }

        try {
            await deleteEquipment(id);
            toast.success('Оборудование удалено успешно!');
        } catch (error) {
            toast.error(error.message || 'Ошибка удаления оборудования');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'Down': '#dc3545',
            'Ready': '#28a745',
            'Delay': '#c9dc35',
            'Standby': '#ffc107',
            'Shiftchange': '#17a2b8'
        };
        return colors[status] || '#6c757d';
    };

    const formatTime = (timeString) => {
        if (!timeString) return '-';
        return timeString;
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="loading-spinner"></div>
                <p>Загрузка панели администратора...</p>
            </div>
        );
    }

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <div className="admin-title">
                    <h1>Панель Администратора</h1>
                    <p>Управление системой мониторинга техники</p>
                </div>

                <div className="admin-actions">
                    <Link to="/" className="back-button">
                        ← Назад к табло
                    </Link>
                    <span className="user-info">
                        {user?.fullName || user?.username} ({user?.role})
                    </span>
                    <button className="logout-button" onClick={logout}>
                        Выход
                    </button>
                </div>
            </div>

            <div className="admin-tabs">
                <button
                    className={`tab ${activeTab === 'equipment' ? 'active' : ''}`}
                    onClick={() => setActiveTab('equipment')}
                >
                    Оборудование ({equipment.length})
                </button>
                <button
                    className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    Статистика
                </button>
                <button
                    className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    Настройки
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'equipment' && (
                    <div className="equipment-management">
                        <div className="equipment-actions">
                            <button
                                className="create-button"
                                onClick={() => setShowCreateModal(true)}
                            >
                                + Добавить оборудование
                            </button>
                            <button
                                className="refresh-button"
                                onClick={refreshData}
                            >
                                🔄 Обновить
                            </button>
                        </div>

                        <div className="equipment-table-container">
                            <table className="admin-equipment-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Тип</th>        
                                        <th>Модель</th>      
                                        <th>Статус</th>
                                        <th>Время</th>
                                        <th>Механик</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipment.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <span className="equipment-id">{item.id}</span>
                                            </td>

                                            {/* ✅ ТИП (отдельная колонка) */}
                                            <td>
                                                <span style={{
                                                    background: 'rgba(79, 172, 254, 0.15)',
                                                    color: '#4facfe',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600'
                                                }}>
                                                    {getEquipmentTypeText(item.equipment_type)}
                                                </span>
                                            </td>

                                            {/* ✅ МОДЕЛЬ (отдельная колонка) */}
                                            <td>
                                                <span className="model" style={{
                                                    fontSize: '0.9rem',
                                                    fontFamily: 'Courier New, monospace'
                                                }}>
                                                    {item.model}
                                                </span>
                                            </td>

                                            <td>
                                                <span
                                                    className="status-indicator"
                                                    style={{ backgroundColor: getStatusColor(item.status) }}
                                                >
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="time-display">
                                                    {/* ✅ ПЛАН (плановое время в часах) */}
                                                    {item.planned_hours > 0 ? (
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem' }}>
                                                                План:
                                                            </span>
                                                            <span style={{ color: '#4facfe', fontWeight: '600', marginLeft: '5px', fontSize: '0.9rem' }}>
                                                                {item.planned_hours}ч
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                                                План: не указан
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* ✅ ФАКТ (время начала) */}
                                                    <div>
                                                        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem' }}>
                                                            Факт:
                                                        </span>
                                                        <span style={{ color: '#ffffff', fontWeight: '500', marginLeft: '5px', fontSize: '0.85rem' }}>
                                                            {item.actual_start || '-'}
                                                        </span>
                                                    </div>

                                                    {/* ✅ ЗАДЕРЖКА (если есть и если указан план) */}
                                                    {item.planned_hours > 0 && item.delay_hours > 0 && (
                                                        <div style={{
                                                            color: '#dc3545',
                                                            fontWeight: '600',
                                                            fontSize: '0.75rem',
                                                            background: 'rgba(220, 53, 69, 0.1)',
                                                            padding: '3px 8px',
                                                            borderRadius: '4px',
                                                            marginTop: '5px',
                                                            display: 'inline-block'
                                                        }}>
                                                            Задержка: +{item.delay_hours}ч
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{item.mechanic_name || '-'}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="edit-button"
                                                        onClick={() => setSelectedEquipment(item)}
                                                        title="Редактировать"
                                                    >
                                                        ✏️
                                                    </button>
                                                    {user?.role === 'admin' && (
                                                        <button
                                                            className="delete-button"
                                                            onClick={() => handleDeleteEquipment(item.id)}
                                                            title="Удалить"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {equipment.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                color: 'rgba(255,255,255,0.6)'
                            }}>
                                <p>Оборудование не найдено</p>
                                <button
                                    className="create-button"
                                    onClick={() => setShowCreateModal(true)}
                                    style={{ marginTop: '20px' }}
                                >
                                    + Добавить первое оборудование
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div className="stats-dashboard">
                        <div className="stats-cards">
                            <div className="stat-card-admin repair">
                                <div className="stat-icon"></div>
                                <div className="stat-info">
                                    <div className="stat-number">{stats.down || 0}</div>
                                    <div className="stat-label">Down</div>
                                </div>
                            </div>

                            <div className="stat-card-admin ready">
                                <div className="stat-icon"></div>
                                <div className="stat-info">
                                    <div className="stat-number">{stats.ready || 0}</div>
                                    <div className="stat-label">Ready</div>
                                </div>
                            </div>

                            <div className="stat-card-admin waiting">
                                <div className="stat-icon"></div>
                                <div className="stat-info">
                                    <div className="stat-number">{stats.delay || 0}</div>
                                    <div className="stat-label">Delay</div>
                                </div>
                            </div>

                            <div className="stat-card-admin total">
                                <div className="stat-icon"></div>
                                <div className="stat-info">
                                    <div className="stat-number">{stats.total}</div>
                                    <div className="stat-label">Total</div>
                                </div>
                            </div>
                        </div>

                        <div className="stats-details">
                            <h3>Общая статистика</h3>
                            <div className="stats-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Статус</th>
                                            <th>Количество</th>
                                            <th>Процент</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Down</td>
                                            <td>{stats.down || 0}</td>
                                            <td>{stats.total ? Math.round(((stats.down || 0) / stats.total) * 100) : 0}%</td>
                                        </tr>
                                        <tr>
                                            <td>Ready</td>
                                            <td>{stats.ready || 0}</td>
                                            <td>{stats.total ? Math.round(((stats.ready || 0) / stats.total) * 100) : 0}%</td>
                                        </tr>
                                        <tr>
                                            <td>Delay</td>
                                            <td>{stats.delay || 0}</td>
                                            <td>{stats.total ? Math.round(((stats.delay || 0) / stats.total) * 100) : 0}%</td>
                                        </tr>
                                        <tr>
                                            <td>Standby</td>
                                            <td>{stats.standby || 0}</td>
                                            <td>{stats.total ? Math.round(((stats.standby || 0) / stats.total) * 100) : 0}%</td>
                                        </tr>
                                        <tr>
                                            <td>Shiftchange</td>
                                            <td>{stats.shiftchange || 0}</td>
                                            <td>{stats.total ? Math.round(((stats.shiftchange || 0) / stats.total) * 100) : 0}%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'archive' && (
                    <div className="archive-tab-content">
                        <Archive />
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="settings-panel">
                        <h3>Настройки системы</h3>

                        <div className="settings-section">
                            <h4>Редактирование оборудования</h4>
                            <p>Диспетчеры и администраторы могут изменять:</p>
                            <ul style={{ color: 'rgba(255,255,255,0.8)', marginLeft: '20px' }}>
                                <li>ID оборудования (с подтверждением)</li>
                                <li>Тип и модель</li>
                                <li>Статус</li>
                                <li>Время планового и фактического ремонта</li>
                                <li>Назначение механиков</li>
                            </ul>
                        </div>

                        <div className="settings-section">
                            <h4>Автообновление</h4>
                            <p>Данные обновляются автоматически каждые 60 секунд</p>
                            <button onClick={refreshData}>Обновить сейчас</button>
                        </div>

                        <div className="settings-section">
                            <h4>Резервное копирование</h4>
                            <p>Последнее обновление: {new Date().toLocaleString('ru-RU')}</p>
                            <button disabled>Создать резервную копию</button>
                        </div>

                        <div className="settings-section">
                            <h4>Пользователи</h4>
                            <p>Управление пользователями доступно только администраторам</p>
                            {user?.role === 'admin' && (
                                <button disabled>Управление пользователями</button>
                            )}
                        </div>

                        <div className="settings-section">
                            <h4>Архив техники</h4>
                            <p>Архив содержит записи о запущенной и завершенной технике</p>
                            <button onClick={() => setActiveTab('archive')}>Перейти к архиву</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Модальное окно создания оборудования */}
            {showCreateModal && (
                <div className="modal-backdrop" onClick={(e) => {
                    if (e.target === e.currentTarget) setShowCreateModal(false);
                }}>
                    <div className="modal-content create-equipment-modal">
                        <div className="modal-header">
                            <h2>Добавить новое оборудование</h2>
                            <button className="close-button" onClick={() => setShowCreateModal(false)}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCreateEquipment} className="create-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>ID оборудования*</label>
                                    <input
                                        type="text"
                                        value={newEquipment.id}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, id: e.target.value })}
                                        placeholder="EX001, LD001, ..."
                                        required
                                    />
                                </div>

                                {/* ✅ ИСПРАВЛЕНО: используем equipment_type */}
                                <div className="form-group">
                                    <label>Тип*</label>
                                    <select
                                        value={newEquipment.equipment_type}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, equipment_type: e.target.value })}
                                        required
                                    >
                                        <option value="">Выберите тип</option>
                                        <option value="Экскаватор">Экскаватор</option>
                                        <option value="Погрузчик">Погрузчик</option>
                                        <option value="Водовоз">Водовоз</option>
                                        <option value="Бульдозер">Бульдозер</option>
                                        <option value="Буровой станок">Буровой станок</option>
                                        <option value="Грейдер">Грейдер</option>
                                        <option value="Самосвал">Самосвал</option>
                                        <option value="Вспомогательное оборудование">Вспомогательное оборудование</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Модель*</label>
                                    <input
                                        type="text"
                                        value={newEquipment.model}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                                        placeholder="CAT 320D, Volvo L120H, ..."
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Статус</label>
                                    <select
                                        value={newEquipment.status}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, status: e.target.value })}
                                    >
                                        <option value="Ready">Ready</option>
                                        <option value="Down">Down</option>
                                        <option value="Delay">Delay</option>
                                        <option value="Standby">Standby</option>
                                        <option value="Shiftchange">Shiftchange</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Плановое начало</label>
                                    <input
                                        type="time"
                                        value={newEquipment.planned_start}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, planned_start: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Плановое окончание</label>
                                    <input
                                        type="time"
                                        value={newEquipment.planned_end}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, planned_end: e.target.value })}
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label>Неисправность</label>
                                    <textarea
                                        value={newEquipment.malfunction}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, malfunction: e.target.value })}
                                        placeholder="Описание неисправности..."
                                        rows="3"
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label>Механик</label>
                                    <input
                                        type="text"
                                        value={newEquipment.mechanic_name}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, mechanic_name: e.target.value })}
                                        placeholder="ФИО механика"
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Отмена
                                </button>
                                <button type="submit" className="create-submit-button">
                                    Создать
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Модальное окно редактирования */}
            {selectedEquipment && (
                <EquipmentTable
                    equipment={selectedEquipment}
                    isOpen={!!selectedEquipment}
                    onClose={() => setSelectedEquipment(null)}
                    onSave={() => {
                        refreshData();
                        setSelectedEquipment(null);
                    }}
                />
            )}
        </div>
    );
};

export default AdminPanel;