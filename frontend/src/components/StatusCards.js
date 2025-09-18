import React from 'react';
import './StatusCards.css';

const StatusCards = ({ stats, loading }) => {
    if (loading) {
        return (
            <div className="stats-grid">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="stat-card loading">
                        <div className="loading-shimmer"></div>
                    </div>
                ))}
            </div>
        );
    }

    const cards = [
        {
            key: 'in_repair',
            title: 'В РЕМОНТЕ',
            value: stats.in_repair || 0,
            className: 'repair',
            icon: '🔧'
        },
        {
            key: 'ready',
            title: 'ГОТОВО',
            value: stats.ready || 0,
            className: 'ready',
            icon: '✅'
        },
        {
            key: 'waiting',
            title: 'ОЖИДАНИЕ',
            value: stats.waiting || 0,
            className: 'waiting',
            icon: '⏳'
        },
        {
            key: 'total',
            title: 'ВСЕГО',
            value: stats.total || 0,
            className: 'total',
            icon: '📊'
        }
    ];

    return (
        <div className="stats-grid">
            {cards.map((card) => (
                <div key={card.key} className={`stat-card ${card.className}`}>
                    <div className="card-icon">{card.icon}</div>
                    <div className="card-content">
                        <h3>{card.title}</h3>
                        <div className="number">{card.value}</div>
                        <div className="label">единиц техники</div>
                    </div>
                    <div className="card-decoration"></div>
                </div>
            ))}
        </div>
    );
};

export default StatusCards;