import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await login(formData.username, formData.password);
            toast.success('Вход выполнен успешно!');
            onSuccess();
            setFormData({ username: '', password: '' });
        } catch (error) {
            toast.error(error.message || 'Ошибка входа');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Вход в систему</h2>
                    <button className="close-button" onClick={onClose}>
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="username">Имя пользователя</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="Введите имя пользователя"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Пароль</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Введите пароль"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            className="submit-button"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="button-spinner"></div>
                                    Вход...
                                </>
                            ) : (
                                'Войти'
                            )}
                        </button>
                    </div>
                </form>

                <div className="login-info">
                    <h3>Тестовые учетные данные:</h3>
                    <div className="test-accounts">
                        <div className="account-info">
                            <strong>Администратор:</strong>
                            <br />
                            Логин: admin
                            <br />
                            Пароль: admin123
                        </div>
                        <div className="account-info">
                            <strong>Диспетчер:</strong>
                            <br />
                            Логин: dispatcher
                            <br />
                            Пароль: user123
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;