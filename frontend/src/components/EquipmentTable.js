// frontend/src/components/EquipmentTable.js - ROLE-BASED EDITING

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './EquipmentTable.css';
import {
    getEquipmentTypeText
    
} from '../components/EquipmentTypes';

const EquipmentTable = ({ equipment, isOpen, onClose, onSave }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        id: '',
        type: '',
        model: '',
        status: '',
        planned_hours: 0,
        malfunction: '',
        mechanic_name: ''
    });
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('edit');
    const [showIdChangeConfirm, setShowIdChangeConfirm] = useState(false);
    const [originalId, setOriginalId] = useState('');

    // ✅ ОПРЕДЕЛЯЕМ ПРАВА ДОСТУПА
    const canEditAllFields = user && (user.role === 'admin' || user.role === 'dispatcher' || user.role === 'programmer');
    const canEditLimitedFields = user && (user.role === 'admin' || user.role === 'dispatcher' || user.role === 'programmer');
    const canViewHistory = user && (user.role === 'admin' || user.role === 'dispatcher' || user.role === 'programmer');

    useEffect(() => {
        if (equipment) {
            const equipmentData = {
                id: equipment.id || '',
                type: equipment.type || '',
                model: equipment.model || '',
                status: equipment.status || '',
                planned_hours: equipment.planned_hours || 0,
                malfunction: equipment.malfunction || '',
                mechanic_name: equipment.mechanic_name || ''
            };

            setFormData(equipmentData);
            setOriginalId(equipment.id);

            if (canViewHistory) {
                loadHistory();
            }
        }
    }, [equipment, user]);

    const loadHistory = async () => {
        setHistoryLoading(true);

        try {
            const response = await api.get(`/equipment/${equipment.id}/history`);

            if (response.data && Array.isArray(response.data)) {
                setHistory(response.data);
            } else {
                console.warn('⚠️ История пришла не в виде массива:', response.data);
                setHistory([]);
            }
        } catch (error) {
            console.error('❌ Error loading history:', error);
            setHistory([]);

            if (error.response?.status === 404) {
                toast.info('История для этого оборудования пока не создана');
            } else if (error.response?.status === 500) {
                toast.error('Ошибка сервера при загрузке истории');
            } else {
                toast.error('Не удалось загрузить историю изменений');
            }
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleIdChange = async () => {
        if (!canEditAllFields) {
            toast.error('Недостаточно прав для изменения ID');
            return;
        }

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
            await api.put(`/equipment/${originalId}/change-id`, {
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

    // ✅ Обработчик изменения планового времени
    const handlePlannedHoursChange = (e) => {
        const value = e.target.value.trim();

        if (value === '' || /^[\d.,]+$/.test(value)) {
            const normalizedValue = value.replace(',', '.');
            const numValue = parseFloat(normalizedValue);

            if (!isNaN(numValue) && numValue >= 0 && numValue <= 1000) {
                setFormData(prev => ({
                    ...prev,
                    planned_hours: numValue
                }));
            } else if (value === '') {
                setFormData(prev => ({
                    ...prev,
                    planned_hours: 0
                }));
            } else {
                if (!isNaN(numValue)) {
                    toast.warning('Плановое время должно быть от 0 до 1000 часов');
                }
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canEditAllFields && !canEditLimitedFields) {
            toast.error('Недостаточно прав для редактирования');
            return;
        }

        // ✅ Валидация планового времени
        const plannedHours = parseFloat(formData.planned_hours);

        if (isNaN(plannedHours) || plannedHours < 0 || plannedHours > 1000) {
            toast.error('Плановое время должно быть числом от 0 до 1000 часов');
            return;
        }

        // ✅ Если изменен ID и это админ
        if (formData.id !== originalId && canEditAllFields) {
            setShowIdChangeConfirm(true);
            return;
        }

        await saveEquipmentData();
    };

    const saveEquipmentData = async () => {
        setLoading(true);

        try {
            const currentId = formData.id || originalId;

            // ✅ ДИСПЕТЧЕР - может менять только 2 поля
            let updateData;

            if (canEditLimitedFields && !canEditAllFields) {
                updateData = {
                    planned_hours: formData.planned_hours,
                    mechanic_name: formData.mechanic_name,
                    malfunction: formData.malfunction // ✅ Добавляем неисправность для диспетчера
                };
                console.log('📝 Диспетчер обновляет planned_hours, mechanic_name и malfunction');
            }
            // ✅ АДМИН - может менять всё
            else if (canEditAllFields) {
                updateData = {
                    type: formData.type,
                    model: formData.model,
                    status: formData.status,
                    planned_hours: formData.planned_hours,
                    malfunction: formData.malfunction,
                    mechanic_name: formData.mechanic_name
                };
                console.log('🔧 Админ обновляет все поля');
            }

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
            [name]: type === 'number' ? parseFloat(value) || 0 : value
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

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleString('ru-RU');
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString;
        }
    };

    const getActionText = (action) => {
        const actionMap = {
            'create': 'Создание',
            'update_status': 'Изменение статуса',
            'update_progress': 'Обновление прогресса',
            'update_mechanic_name': 'Назначение механика',
            'update_type': 'Изменение типа',
            'update_model': 'Изменение модели',
            'update_planned_hours': 'Изменение планового времени',
            'change_id': 'Изменение ID',
            'delete': 'Удаление'
        };
        return actionMap[action] || action;
    };

    const getHoursText = (hours) => {
        if (hours === 1) return 'час';
        if (hours >= 2 && hours <= 4) return 'часа';
        return 'часов';
    };

    // ✅ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: проверка, можно ли редактировать поле
    const canEditField = (fieldName) => {
        if (canEditAllFields) return true; // Админ может всё

        // Диспетчер может только эти 2 поля
        if (canEditLimitedFields) {
            return fieldName === 'planned_hours' || fieldName === 'mechanic_name';
        }

        return false;
    };

    if (!isOpen || !equipment) return null;

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content equipment-modal">
                <div className="modal-header">
                    <div>
                        <h2>Оборудование {originalId}</h2>
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
                    {(canEditAllFields || canEditLimitedFields) && (
                        <button
                            className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
                            onClick={() => setActiveTab('edit')}
                        >
                            Редактирование
                        </button>
                    )}
                    {canViewHistory && (
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
                                    <label>Плановое время:</label>
                                    <span style={{
                                        color: equipment.planned_hours > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                                        fontStyle: equipment.planned_hours > 0 ? 'normal' : 'italic'
                                    }}>
                                        {equipment.planned_hours > 0
                                            ? `${equipment.planned_hours} ${getHoursText(equipment.planned_hours)}`
                                            : 'Не указано'
                                        }
                                    </span>
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

                    {activeTab === 'edit' && (canEditAllFields || canEditLimitedFields) && (
                        <form onSubmit={handleSubmit} className="edit-form">
                            {/* ✅ ИНФОРМАЦИОННЫЙ БЛОК для диспетчера */}
                            {canEditLimitedFields && !canEditAllFields && (
                                <div style={{
                                    background: 'rgba(79, 172, 254, 0.1)',
                                    border: '1px solid rgba(79, 172, 254, 0.3)',
                                    borderRadius: '8px',
                                    padding: '15px',
                                    marginBottom: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#4facfe">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                    </svg>
                                    <div style={{ flex: 1, fontSize: '0.9rem', color: '#4facfe' }}>
                                        <strong>Режим диспетчера:</strong> Вы можете редактировать только плановое время и механика.
                                        Остальные данные синхронизируются из JMineOps.
                                    </div>
                                </div>
                            )}

                            <div className="form-grid">
                                {/* ✅ ID - только для админа */}
                                <div className="form-group">
                                    <label>
                                        ID оборудования
                                        {!canEditField('id') && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '0.85rem',
                                                color: 'rgba(255, 193, 7, 0.8)'
                                            }}>
                                                🔒 Только для чтения
                                            </span>
                                        )}
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            name="id"
                                            value={formData.id}
                                            onChange={handleChange}
                                            disabled={!canEditField('id') || loading}
                                            placeholder="Например: EX001, LD002"
                                            style={{
                                                flex: 1,
                                                background: !canEditField('id') ? 'rgba(255, 255, 255, 0.05)' : undefined,
                                                cursor: !canEditField('id') ? 'not-allowed' : 'text',
                                                opacity: !canEditField('id') ? 0.6 : 1
                                            }}
                                            title={!canEditField('id') ? 'Данные синхронизируются из JMineOps' : ''}
                                        />
                                        {canEditField('id') && formData.id !== originalId && (
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
                                    {canEditField('id') && formData.id !== originalId && (
                                        <small style={{ color: '#ffc107', fontSize: '0.8rem' }}>
                                            ⚠️ ID будет изменен. Нажмите "Изменить ID" для подтверждения.
                                        </small>
                                    )}
                                </div>

                                {/* ✅ ТИП - только для админа */}
                                <div className="form-group">
                                    <label>
                                        Тип
                                        {!canEditField('type') && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '0.85rem',
                                                color: 'rgba(255, 193, 7, 0.8)'
                                            }}>
                                                🔒
                                            </span>
                                        )}
                                    </label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        disabled={!canEditField('type') || loading}
                                        style={{
                                            background: !canEditField('type') ? 'rgba(255, 255, 255, 0.05)' : undefined,
                                            cursor: !canEditField('type') ? 'not-allowed' : 'pointer',
                                            opacity: !canEditField('type') ? 0.6 : 1
                                        }}
                                        title={!canEditField('type') ? 'Данные синхронизируются из JMineOps' : ''}
                                    >
                                        <option value="shovel">Экскаватор</option>
                                        <option value="loader">Погрузчик</option>
                                        <option value="watertruck">Водовоз</option>
                                        <option value="dozer">Бульдозер</option>
                                        <option value="drill">Буровой станок</option>
                                        <option value="grader">Автогрейдер</option>
                                        <option value="truck">Самосвал</option>
                                        <option value="auxequipment">Вспомогательное оборудование</option>
                                    </select>
                                </div>

                                {/* ✅ МОДЕЛЬ - только для админа */}
                                <div className="form-group">
                                    <label>
                                        Модель
                                        {!canEditField('model') && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '0.85rem',
                                                color: 'rgba(255, 193, 7, 0.8)'
                                            }}>
                                                🔒
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        name="model"
                                        value={formData.model}
                                        onChange={handleChange}
                                        disabled={!canEditField('model') || loading}
                                        placeholder="Например: CAT 320D, Volvo L120H"
                                        style={{
                                            background: !canEditField('model') ? 'rgba(255, 255, 255, 0.05)' : undefined,
                                            cursor: !canEditField('model') ? 'not-allowed' : 'text',
                                            opacity: !canEditField('model') ? 0.6 : 1
                                        }}
                                        title={!canEditField('model') ? 'Данные синхронизируются из JMineOps' : ''}
                                    />
                                </div>

                                {/* ✅ СТАТУС - только для админа */}
                                <div className="form-group">
                                    <label>
                                        Статус
                                        {!canEditField('status') && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '0.85rem',
                                                color: 'rgba(255, 193, 7, 0.8)'
                                            }}>
                                                🔒
                                            </span>
                                        )}
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        disabled={!canEditField('status') || loading}
                                        style={{
                                            background: !canEditField('status') ? 'rgba(255, 255, 255, 0.05)' : undefined,
                                            cursor: !canEditField('status') ? 'not-allowed' : 'pointer',
                                            opacity: !canEditField('status') ? 0.6 : 1
                                        }}
                                        title={!canEditField('status') ? 'Данные синхронизируются из JMineOps' : ''}
                                    >
                                        <option value="Ready">Ready</option>
                                        <option value="Down">Down</option>
                                        <option value="Standby">Standby</option>
                                        <option value="Delay">Delay</option>
                                        <option value="Shiftchange">Shiftchange</option>
                                    </select>
                                </div>

                                {/* ✅ ПЛАНОВОЕ ВРЕМЯ - для всех */}
                                <div className="form-group">
                                    <label>
                                        Плановое время (часы)
                                        {canEditField('planned_hours') && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '0.85rem',
                                                color: 'rgba(40, 167, 69, 0.8)'
                                            }}>
                                                ✏️ Можно редактировать
                                            </span>
                                        )}
                                    </label>

                                    {/* Быстрый выбор часто используемых значений */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        marginBottom: '10px',
                                        flexWrap: 'wrap'
                                    }}>
                                        {[1, 2, 4, 6, 8, 12, 24 , 48 , 96].map(hours => (
                                            <button
                                                key={hours}
                                                type="button"
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    planned_hours: hours
                                                }))}
                                                disabled={!canEditField('planned_hours') || loading}
                                                style={{
                                                    background: formData.planned_hours === hours
                                                        ? 'rgba(79, 172, 254, 0.3)'
                                                        : 'rgba(255, 255, 255, 0.1)',
                                                    border: `1px solid ${formData.planned_hours === hours
                                                        ? '#4facfe'
                                                        : 'rgba(255, 255, 255, 0.2)'}`,
                                                    color: '#ffffff',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: (!canEditField('planned_hours') || loading) ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.85rem',
                                                    transition: 'all 0.2s ease',
                                                    fontWeight: formData.planned_hours === hours ? '600' : '400',
                                                    opacity: (!canEditField('planned_hours') || loading) ? 0.5 : 1
                                                }}
                                            >
                                                {hours}ч
                                            </button>
                                        ))}
                                    </div>

                                    {/* Ручной ввод */}
                                    <input
                                        type="text"
                                        name="planned_hours"
                                        value={formData.planned_hours || ''}
                                        onChange={handlePlannedHoursChange}
                                        disabled={!canEditField('planned_hours') || loading}
                                        placeholder="Или введите вручную: 1.5, 6.5, 8..."
                                        style={{
                                            fontFamily: 'monospace',
                                            fontSize: '1rem',
                                            background: !canEditField('planned_hours') ? 'rgba(255, 255, 255, 0.05)' : undefined,
                                            cursor: !canEditField('planned_hours') ? 'not-allowed' : 'text',
                                            opacity: !canEditField('planned_hours') ? 0.6 : 1,
                                            border: canEditField('planned_hours') ? '2px solid rgba(40, 167, 69, 0.3)' : undefined
                                        }}
                                    />
                                </div>

                                {/* ✅ НЕИСПРАВНОСТЬ - только для админа */}
                                <div className="form-group full-width">
                                    <label>
                                        Неисправность
                                        {!canEditField('malfunction') && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '0.85rem',
                                                color: 'rgba(255, 193, 7, 0.8)'
                                            }}>
                                                🔒 Только для чтения
                                            </span>
                                        )}
                                    </label>
                                    <textarea
                                        name="malfunction"
                                        value={formData.malfunction}
                                        onChange={handleChange}
                                        rows="3"
                                        placeholder="Описание неисправности..."
                                        disabled={!canEditField('malfunction') || loading}
                                        style={{
                                            background: !canEditField('malfunction') ? 'rgba(255, 255, 255, 0.05)' : undefined,
                                            cursor: !canEditField('malfunction') ? 'not-allowed' : 'text',
                                            opacity: !canEditField('malfunction') ? 0.6 : 1
                                        }}
                                        title={!canEditField('malfunction') ? 'Данные синхронизируются из JMineOps' : ''}
                                    />
                                </div>

                                {/* ✅ МЕХАНИК - для всех */}
                                <div className="form-group full-width">
                                    <label>
                                        Механик
                                        {canEditField('mechanic_name') && (
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '0.85rem',
                                                color: 'rgba(40, 167, 69, 0.8)'
                                            }}>
                                                ✏️ Можно редактировать
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        name="mechanic_name"
                                        value={formData.mechanic_name}
                                        onChange={handleChange}
                                        placeholder="ФИО механика"
                                        disabled={!canEditField('mechanic_name') || loading}
                                        style={{
                                            background: !canEditField('mechanic_name') ? 'rgba(255, 255, 255, 0.05)' : undefined,
                                            cursor: !canEditField('mechanic_name') ? 'not-allowed' : 'text',
                                            opacity: !canEditField('mechanic_name') ? 0.6 : 1,
                                            border: canEditField('mechanic_name') ? '2px solid rgba(40, 167, 69, 0.3)' : undefined
                                        }}
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
                                    {loading ? 'Сохранение...' : 'Сохранить изменения'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'history' && canViewHistory && (
                        <div className="history-content">
                            {historyLoading ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '40px',
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }}>
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        border: '4px solid rgba(79, 172, 254, 0.2)',
                                        borderTop: '4px solid #4facfe',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        marginBottom: '15px'
                                    }}></div>
                                    <p>Загрузка истории изменений...</p>
                                </div>
                            ) : !history || history.length === 0 ? (
                                <p className="no-history" style={{
                                    textAlign: 'center',
                                    padding: '40px',
                                    color: 'rgba(255, 255, 255, 0.6)'
                                }}>
                                    {!history ? 'История недоступна' : 'История изменений пуста'}
                                </p>
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

                {/* МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ИЗМЕНЕНИЯ ID */}
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
                                    <strong>Новый ID:</strong> {formData.id}
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

                <style jsx>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default EquipmentTable;