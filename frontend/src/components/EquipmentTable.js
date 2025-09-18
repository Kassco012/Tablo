import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './EquipmentTable.css';

const EquipmentTable = ({ equipment, isOpen, onClose, onSave }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        status: '',
        priority: '',
        planned_start: '',
        planned_end: '',
        actual_start: '',
        actual_end: '',
        delay_hours: 0,
        malfunction: '',
        mechanic_name: '',
        progress: 0
    });
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('edit');

    useEffect(() => {
        if (equipment) {
            setFormData({
                status: equipment.status || '',
                priority: equipment.priority || '',
                planned_start: equipment.planned_start || '',
                planned_end: equipment.planned_end || '',
                actual_start: equipment.actual_start || '',
                actual_end: equipment.actual_end || '',
                delay_hours: equipment.delay_hours || 0,
                malfunction: equipment.malfunction || '',
                mechanic_name: equipment.mechanic_name || '',
                progress: equipment.progress || 0
            });

            // Загружаем историю изменений
            if (user && (user.role === 'admin' || user.role === 'dispatcher')) {
                loadHistory();
            }
        }
    }, [equipment, user]);

    const loadHistory = async () => {
        try {
            const response = await api.get(`/equipment/${equipment.id}/history`);
            setHistory(response.data);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user || (user.role !== 'admin' && user.role !== 'dispatcher')) {
            toast.error('Недостаточно прав для редактирования');
            return;
        }

        setLoading(true);

        try {
            await api.put(`/equipment/${equipment.id}`, formData);
            toast.success('Данные обновлены успешно!');
            onSave();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Ошибка обновления данных');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value) || 0 : value
        }));
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
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

    const getEquipmentTypeText = (type) => {
        return type === 'excavator' ? 'Экскаватор' : 'Погрузчик';
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const getActionText = (action) => {
        const actionMap = {
            'create': 'Создание',
            'update_status': 'Изменение статуса',
            'update_progress': 'Обновление прогресса',
            'update_mechanic_name': 'Назначение механика',
            'delete': 'Удаление'
        };
        return actionMap[action] || action;
    };

    if (!isOpen || !equipment) return null;

    const canEdit = user && (user.role === 'admin' || user.role === 'dispatcher');

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content equipment-modal">
                <div className="modal-header">
                    <div>
                        <h2>Оборудование {equipment.id}</h2>
                        <p className="equipment-subtitle">
                            {getEquipmentTypeText(equipment.type)} {equipment.model}
                        </p>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="modal-tabs">
                    <button
                        className={`tab ${activeTab === 'view' ? 'active' : ''}`}
                        onClick={() => setActiveTab('view')}
                    >
                        Просмотр
                    </button>
                    {canEdit && (
                        <button
                            className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
                            onClick={() => setActiveTab('edit')}
                        >
                            Редактирование
                        </button>
                    )}
                    {canEdit && (
                        <button
                            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                            onClick={() => setActiveTab('history')}
                        >
                            История
                        </button>
                    )}
                </div>

                <div className="modal-body">
                    {activeTab === 'view' && (
                        <div className="view-content">
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Статус:</label>
                                    <span className={`status-badge ${equipment.status}`}>
                                        {getStatusText(equipment.status)}
                                    </span>
                                </div>

                                <div className="info-item">
                                    <label>Приоритет:</label>
                                    <span className={`priority-badge ${equipment.priority}`}>
                                        {equipment.priority}
                                    </span>
                                </div>

                                <div className="info-item">
                                    <label>Плановое время:</label>
                                    <span>{equipment.planned_start} - {equipment.planned_end}</span>
                                </div>

                                <div className="info-item">
                                    <label>Фактическое время:</label>
                                    <span>{equipment.actual_start || '-'} - {equipment.actual_end || '-'}</span>
                                </div>

                                <div className="info-item">
                                    <label>Задержка:</label>
                                    <span>{equipment.delay_hours > 0 ? `+${equipment.delay_hours}ч` : 'Нет'}</span>
                                </div>

                                <div className="info-item">
                                    <label>Прогресс:</label>
                                    <div className="progress-container">
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${equipment.progress}%` }}
                                            />
                                        </div>
                                        <span className="progress-text">{equipment.progress}%</span>
                                    </div>
                                </div>

                                <div className="info-item full-width">
                                    <label>Неисправность:</label>
                                    <span>{equipment.malfunction || 'Не указана'}</span>
                                </div>

                                <div className="info-item full-width">
                                    <label>Механик:</label>
                                    <span>{equipment.mechanic_name || 'Не назначен'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'edit' && canEdit && (
                        <form onSubmit={handleSubmit} className="edit-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Статус</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        disabled={loading}
                                    >
                                        <option value="ready">Готово</option>
                                        <option value="in_repair">В ремонте</option>
                                        <option value="waiting">Ожидание</option>
                                        <option value="scheduled">Запланировано</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Приоритет</label>
                                    <select
                                        name="priority"
                                        value={formData.priority}
                                        onChange={handleChange}
                                        disabled={loading}
                                    >
                                        <option value="low">Низкий</option>
                                        <option value="normal">Обычный</option>
                                        <option value="medium">Средний</option>
                                        <option value="high">Высокий</option>
                                        <option value="critical">Критический</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Плановое начало</label>
                                    <input
                                        type="time"
                                        name="planned_start"
                                        value={formData.planned_start}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Плановое окончание</label>
                                    <input
                                        type="time"
                                        name="planned_end"
                                        value={formData.planned_end}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Фактическое начало</label>
                                    <input
                                        type="time"
                                        name="actual_start"
                                        value={formData.actual_start}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Фактическое окончание</label>
                                    <input
                                        type="time"
                                        name="actual_end"
                                        value={formData.actual_end}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Задержка (часы)</label>
                                    <input
                                        type="number"
                                        name="delay_hours"
                                        value={formData.delay_hours}
                                        onChange={handleChange}
                                        min="0"
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Прогресс (%)</label>
                                    <input
                                        type="number"
                                        name="progress"
                                        value={formData.progress}
                                        onChange={handleChange}
                                        min="0"
                                        max="100"
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label>Неисправность</label>
                                    <textarea
                                        name="malfunction"
                                        value={formData.malfunction}
                                        onChange={handleChange}
                                        rows="3"
                                        placeholder="Описание неисправности..."
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label>Механик</label>
                                    <input
                                        type="text"
                                        name="mechanic_name"
                                        value={formData.mechanic_name}
                                        onChange={handleChange}
                                        placeholder="ФИО механика"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={onClose}
                                    disabled={loading}
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="save-button"
                                    disabled={loading}
                                >
                                    {loading ? 'Сохранение...' : 'Сохранить'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'history' && canEdit && (
                        <div className="history-content">
                            {history.length === 0 ? (
                                <p className="no-history">История изменений пуста</p>
                            ) : (
                                <div className="history-list">
                                    {history.map((item) => (
                                        <div key={item.id} className="history-item">
                                            <div className="history-header">
                                                <span className="history-action">
                                                    {getActionText(item.action)}
                                                </span>
                                                <span className="history-time">
                                                    {formatDateTime(item.timestamp)}
                                                </span>
                                            </div>
                                            <div className="history-user">
                                                Пользователь: {item.full_name || item.username}
                                            </div>
                                            {item.old_value && item.new_value && (
                                                <div className="history-changes">
                                                    <span className="old-value">"{item.old_value}"</span>
                                                    <span className="arrow">→</span>
                                                    <span className="new-value">"{item.new_value}"</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EquipmentTable;














