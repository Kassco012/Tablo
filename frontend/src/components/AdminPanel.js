// frontend/src/components/AdminPanel.js - БЕЗ УЧАСТКОВ

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
    const [newEquipment, setNewEquipment] = useState({
        id: '',
        type: '',
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

        if (!newEquipment.id || !newEquipment.type || !newEquipment.model) {
            toast.error('Заполните обязательные поля: ID, тип и модель');
            return;
        }

        try {
            await createEquipment(newEquipment);
            toast.success('Оборудование создано успешно!');
            setShowCreateModal(false);
            setNewEquipment({
                id: '',
                type: '',
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
            'Delay': ' #4facfe',
            'Standby': '#ffc107',
            'Shiftchange': '#17a2b8'
        };
        return colors[status] || '#6c757d';
    };

    const getPriorityColor = (priority) => {
        const colors = {
            'low': '#28a745',
            'normal': '#6c757d',
            'medium': '#fd7e14',
            'high': '#dc3545',
            'critical': '#8B0000'
        };
        return colors[priority] || '#6c757d';
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
                                        <th>Тип/Модель</th>
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
                                            <td>
                                                <div className="type-model">
                                                    <span className="type">
                                                        {item.type === 'excavator' ? 'Экскаватор' : 'Погрузчик'}
                                                    </span>
                                                    <span className="model">{item.model}</span>
                                                </div>
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
                                                    <div>План: {formatTime(item.planned_start)} - {formatTime(item.planned_end)}</div>
                                                    <div>Факт: {formatTime(item.actual_start)} - {formatTime(item.actual_end)}</div>
                                                    {item.delay_hours > 0 && (
                                                        <div className="delay-info">+{item.delay_hours}ч</div>
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

                                <div className="form-group">
                                    <label>Тип*</label>
                                    <select
                                        value={newEquipment.type}
                                        onChange={(e) => setNewEquipment({ ...newEquipment, type: e.target.value })}
                                        required
                                    >
                                        <option value="excavator">Экскаватор</option>
                                        <option value="loader">Погрузчик</option>
                                        <option value="watertruck">Водовоз</option>
                                        <option value="dozer">Бульдозер</option>
                                        <option value="drill">Буровой станок</option>
                                        <option value="grader">Автогрейдер</option>
                                        <option value="truck">Самосвал</option>
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
                                        <option value="ready">Ready</option>
                                        <option value="down">Down</option>
                                        <option value="delay">Delay</option>
                                        <option value="standby">Standby</option>
                                        <option value="shiftchange">Shiftchange</option>
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