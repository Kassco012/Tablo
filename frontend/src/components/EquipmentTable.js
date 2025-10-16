// frontend/src/components/EquipmentTable.js - с улучшенным вводом планового времени

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './EquipmentTable.css';
import {
    getEquipmentTypeText,
    getEquipmentTypeOptions
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

            if (user && (user.role === 'admin' || user.role === 'dispatcher' || user.role === 'programmer')) {
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

        // Разрешаем пустое поле, цифры, точку и запятую
        if (value === '' || /^[\d.,]+$/.test(value)) {
            // Заменяем запятую на точку для корректной работы
            const normalizedValue = value.replace(',', '.');

            // Парсим значение
            const numValue = parseFloat(normalizedValue);

            // Если значение корректное число
            if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                setFormData(prev => ({
                    ...prev,
                    planned_hours: numValue
                }));
            } else if (value === '') {
                // Если поле пустое, устанавливаем 0
                setFormData(prev => ({
                    ...prev,
                    planned_hours: 0
                }));
            } else {
                // Показываем предупреждение только если число вне диапазона
                if (!isNaN(numValue)) {
                    toast.warning('Плановое время должно быть от 0 до 100 часов');
                }
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user || (user.role !== 'admin' && user.role !== 'dispatcher')) {
            toast.error('Недостаточно прав для редактирования');
            return;
        }

        // ✅ Валидация планового времени
        const plannedHours = parseFloat(formData.planned_hours);

        if (isNaN(plannedHours) || plannedHours < 0 || plannedHours > 100) {
            toast.error('Плановое время должно быть числом от 0 до 100 часов');
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
                status: formData.status,
                planned_hours: formData.planned_hours,
                malfunction: formData.malfunction,
                mechanic_name: formData.mechanic_name
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

    // ✅ Функция для правильного склонения слова "час"
    const getHoursText = (hours) => {
        if (hours === 1) return 'час';
        if (hours >= 2 && hours <= 4) return 'часа';
        return 'часов';
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
                                    <label>Тип:</label>
                                    <span>{getEquipmentTypeText(equipment.type)}</span>
                                    <span>{getEquipmentTypeOptions(equipment.type)}</span>
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

                                {/* ✅ Показываем плановое время с правильным склонением */}
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
                                    <label>Тип</label>
                                    <select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        disabled={loading}
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

                                {/* ✅ УЛУЧШЕННОЕ ПОЛЕ: Плановое время с текстовым вводом */}
                                <div className="form-group">
                                    <label>Плановое время (часы)</label>

                                    {/* Быстрый выбор часто используемых значений */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        marginBottom: '10px',
                                        flexWrap: 'wrap'
                                    }}>
                                        {[1, 2, 4, 6, 8, 12, 24].map(hours => (
                                            <button
                                                key={hours}
                                                type="button"
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    planned_hours: hours
                                                }))}
                                                disabled={loading}
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
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.85rem',
                                                    transition: 'all 0.2s ease',
                                                    fontWeight: formData.planned_hours === hours ? '600' : '400'
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
                                        disabled={loading}
                                        placeholder="Или введите вручную: 1.5, 6.5, 8..."
                                        style={{
                                            fontFamily: 'monospace',
                                            fontSize: '1rem'
                                        }}
                                    />
                                    <small style={{
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        fontSize: '0.8rem',
                                        display: 'block',
                                        marginTop: '5px'
                                    }}>
                                        💡 Введите количество часов (0-100). Можно использовать десятичные: 1.5, 6, 8.5
                                    </small>
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
                                        width: '40px',
                                        height: '40px',
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