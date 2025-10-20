import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            console.log('🔑 Attempting login with:', formData.username);
            const result = await login(formData.username, formData.password);

            if (result.success) {
                console.log('✅ Login successful!');
                toast.success('Вход выполнен успешно!');

                if (onSuccess) {
                    onSuccess();
                }

                setTimeout(() => {
                    navigate('/');
                    window.location.reload();
                }, 100);
            } else {
                console.error('❌ Login failed:', result.error);
                toast.error(result.error || 'Ошибка входа');
            }
        } catch (error) {
            console.error('❌ Login exception:', error);
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

    const handleAccountClick = (username) => {
        setFormData(prev => ({
            ...prev,
            username: username
        }));
        setTimeout(() => {
            const passwordField = document.getElementById('password');
            if (passwordField) passwordField.focus();
        }, 100);
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
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="kassymzhan.nuraliyev@kazminerals.com"
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
            </div>
        </div>
    );
};

export default LoginModal;