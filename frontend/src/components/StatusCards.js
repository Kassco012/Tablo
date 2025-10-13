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
            key: 'down',
            title: 'DOWN',
            value: stats.down || 0,
            className: 'down',
            icon: ''
        },
        {
            key: 'ready',
            title: 'READY',
            value: stats.ready || 0,
            className: 'ready',
            icon: ''
        },
        {
            key: 'delay',
            title: 'DELAY',
            value: stats.delay || 0,
            className: 'delay',
            icon: ''
        },
        {
            key: 'standby',
            title: 'STANDBY',
            value: stats.standby || 0,
            className: 'standby',
            icon: ''
        },
        {
            key: 'shiftchange',
            title: 'SHIFTCHANGE',
            value: stats.shiftchange || 0,
            className: 'shiftchange',
            icon: ''
        },
        {
            key: 'total',
            title: 'ВСЕГО',
            value: stats.total || 0,
            className: 'total',
            icon: ''
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