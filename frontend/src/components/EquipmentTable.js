// frontend/src/components/EquipmentTable.js - обновленная версия с участками

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './EquipmentTable.css';

const EquipmentTable = ({ equipment, isOpen, onClose, onSave }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        id: '',
        type: '',
        model: '',
        section: '',
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
    const [showIdChangeConfirm, setShowIdChangeConfirm] = useState(false);
    const [originalId, setOriginalId] = useState('');

    // Список участков
    const SECTIONS = [
        'колесные техники',
        'гусеничные техники',
        'шиномонтажные работы',
        'капитальный ремонт',
        'энергоучасток',
        'легкотоннажные техники'
    ];

    useEffect(() => {
        if (equipment) {
            const equipmentData = {
                id: equipment.id || '',
                type: equipment.type || '',
                model: equipment.model || '',
                section: equipment.section || 'колесные техники',
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
            };

            setFormData(equipmentData);
            setOriginalId(equipment.id);

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

    const handleIdChange = async () => {
        if (!formData.id || formData.id.trim() === '') {
            toast.error('ID не может быть пустым');
            return;
        }

        if (formData.id === originalId) {
            toast.info('ID не изменился');
            return;
        }

        try {
            setLoading(true);
            const response = await api.put(`/equipment/${originalId}/change-id`, {
                newId: formData.id.trim()
            });

            toast.success('ID оборудования изменен успешно!');
            setOriginalId(formData.id);
            setShowIdChangeConfirm(false);
            onSave();
        } catch (error) {
            console.error('Error changing ID:', error);
            toast.error(error.response?.data?.message || 'Ошибка изменения ID');
            setFormData(prev => ({ ...prev, id: originalId }));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user || (user.role !== 'admin' && user.role !== 'dispatcher')) {
            toast.error('Недостаточно прав для редактирования');
            return;
        }

        if (formData.id !== originalId) {
            setShowIdChangeConfirm(true);
            return;
        }

        await saveEquipmentData();
    };

    const saveEquipmentData = async () => {
        setLoading(true);

        try {
            const currentId = formData.id || originalId;

            const updateData = {
                type: formData.type,
                model: formData.model,
                section: formData.section,
                status: formData.status,
                priority: formData.priority,
                planned_start: formData.planned_start,
                planned_end: formData.planned_end,
                actual_start: formData.actual_start,
                actual_end: formData.actual_end,
                delay_hours: formData.delay_hours,
                malfunction: formData.malfunction,
                mechanic_name: formData.mechanic_name,
                progress: formData.progress
            };

            await api.put(`/equipment/${currentId}`, updateData);
            toast.success('Данные обновлены успешно!');
            onSave();
            onClose();
        } catch (error) {
            console.error('Error updating equipment:', error);
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
            'Down': 'Не работает',
            'Ready': 'Готова',
            'Standby': 'Ожидание',
            'Delay': 'Задержка',
            'Shiftchange': 'Смена'
        };
        return statusMap[status] || status;
    };

    const getEquipmentTypeText = (type) => {
        return type === 'excavator' ? 'Экскаватор' : 'Погрузчик';
    };

    const getSectionText = (section) => {
        return section || 'Не указан';
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
            'update_type': 'Изменение типа',
            'update_model': 'Изменение модели',
            'update_section': 'Изменение участка',
            'change_id': 'Изменение ID',
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
                        <h2>Оборудование {originalId}</h2>
                        <p className="equipment-subtitle">
                            {getEquipmentTypeText(equipment.type)} {equipment.model}
                        </p>
                        <p className="equipment-subtitle" style={{ color: '#4facfe' }}>
                            Участок: {getSectionText(equipment.section)}
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
                                    <label>ID:</label>
                                    <span className="equipment-id">{equipment.id}</span>
                                </div>

                                <div className="info-item">
                                    <label>Участок:</label>
                                    <span style={{
                                        background: 'rgba(79, 172, 254, 0.1)',
                                        color: '#4facfe',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: '500'
                                    }}>
                                        {getSectionText(equipment.section)}
                                    </span>
                                </div>

                                <div className="info-item">
                                    <label>Тип:</label>
                                    <span>{getEquipmentTypeText(equipment.type)}</span>
                                </div>

                                <div className="info-item">
                                    <label>Модель:</label>
                                    <span>{equipment.model}</span>
                                </div>

                                <div className="info-item">
                                    <label>Статус:</label>
                                    <span className={`status-badge ${equipment.status}`}>
                                        {getStatusText(equipment.status)}
                                    </span>
                                </div>

                                <div className="info-item">
                                    <label>Фактическое время:</label>
                                    <span>{equipment.actual_start || '-'} - {equipment.actual_end || '-'}</span>
                                </div>

                                <div className="info-item">
                                    <label>Плановое время:</label>
                                    <span>{equipment.planned_start} - {equipment.planned_end}</span>
                                </div>

                                <div className="info-item">
                                    <label>Задержка:</label>
                                    <span>{equipment.delay_hours > 0 ? `+${equipment.delay_hours}ч` : 'Нет'}</span>
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
                                    <label>ID оборудования</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            name="id"
                                            value={formData.id}
                                            onChange={handleChange}
                                            disabled={loading}
                                            placeholder="Например: EX001, LD002"
                                            style={{ flex: 1 }}
                                        />
                                        {formData.id !== originalId && (
                                            <button
                                                type="button"
                                                onClick={() => setShowIdChangeConfirm(true)}
                                                disabled={loading}
                                                style={{
                                                    background: '#ffc107',
                                                    color: '#000',
                                                    border: 'none',
                                                    padding: '8px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                Изменить ID
                                            </button>
                                        )}
                                    </div>
                                    {formData.id !== originalId && (
                                        <small style={{ color: '#ffc107', fontSize: '0.8rem' }}>
                                            ⚠️ ID будет изменен. Нажмите "Изменить ID" для подтверждения.
                                        </small>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Участок</label>
                                    <select
                                        name="section"
                                        value={formData.section}
                                        onChange={handleChange}
                                        disabled={loading}
                                    >
                                        {SECTIONS.map(section => (
                                            <option key={section} value={section}>
                                                {getSectionText(section)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Тип</label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        disabled={loading}
                                    >
                                        <option value="excavator">Экскаватор</option>
                                        <option value="loader">Погрузчик</option>
                                      
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Модель</label>
                                    <input
                                        type="text"
                                        name="model"
                                        value={formData.model}
                                        onChange={handleChange}
                                        disabled={loading}
                                        placeholder="Например: CAT 320D, Volvo L120H"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Статус</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        disabled={loading}
                                    >
                                        <option value="Ready">Ready</option>
                                        <option value="Down">Down</option>
                                        <option value="Standby">Standby</option>
                                        <option value="Delay">Delay</option>
                                        <option value="Shiftchange">Shiftchange</option>
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

                {/* Модальное окно подтверждения изменения ID */}
                {showIdChangeConfirm && (
                    <div className="modal-backdrop" onClick={(e) => {
                        if (e.target === e.currentTarget) setShowIdChangeConfirm(false);
                    }}>
                        <div className="modal-content" style={{ maxWidth: '500px' }}>
                            <div className="modal-header">
                                <h3>Изменение ID оборудования</h3>
                                <button
                                    className="close-button"
                                    onClick={() => setShowIdChangeConfirm(false)}
                                >
                                    ×
                                </button>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <p>Вы уверены, что хотите изменить ID оборудования?</p>
                                <div style={{
                                    background: 'rgba(255, 193, 7, 0.1)',
                                    padding: '15px',
                                    borderRadius: '8px',
                                    margin: '15px 0'
                                }}>
                                    <strong>Старый ID:</strong> {originalId}<br />
                                    <strong>Новый ID:</strong> {formData.id}<br />
                                    <strong>Участок:</strong> {getSectionText(formData.section)}
                                </div>
                                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                                    ⚠️ Это действие изменит ID оборудования во всей системе и истории.
                                </p>
                                <div style={{
                                    display: 'flex',
                                    gap: '10px',
                                    justifyContent: 'flex-end',
                                    marginTop: '20px'
                                }}>
                                    <button
                                        type="button"
                                        className="cancel-button"
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, id: originalId }));
                                            setShowIdChangeConfirm(false);
                                        }}
                                        disabled={loading}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleIdChange}
                                        disabled={loading}
                                        style={{
                                            background: '#ffc107',
                                            color: '#000',
                                            border: 'none',
                                            padding: '10px 20px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                        }}
                                    >
                                        {loading ? 'Изменение...' : 'Подтвердить изменение ID'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EquipmentTable;