import React from 'react';
import './HealthMonitor.css';

const HealthMonitor = ({ data }) => {
    if (!data) return null;

    const getStatusClass = (value, warn = 70, danger = 90) => {
        if (value >= danger) return 'status-danger';
        if (value >= warn) return 'status-warn';
        return 'status-good';
    };

    return (
        <div className="health-monitor">
            <div className="health-grid">
                {/* CPU */}
                <div className="health-group">
                    <div className="health-item">
                        <span className="health-icon">🧠</span>
                        <span>CPU: <span className="health-value">{data.cpu}%</span></span>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className={`progress-bar ${getStatusClass(data.cpu)}`}
                            style={{ width: `${data.cpu}%` }}
                        ></div>
                    </div>
                </div>

                {/* RAM */}
                <div className="health-group">
                    <div className="health-item">
                        <span className="health-icon">💾</span>
                        <span>RAM: <span className="health-value">{data.ramUsed}G</span></span>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className={`progress-bar ${getStatusClass((data.ramUsed / data.ramTotal) * 100)}`}
                            style={{ width: `${(data.ramUsed / data.ramTotal) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* Battery */}
                <div className="health-group">
                    <div className="health-item">
                        <span className="health-icon">{data.isCharging ? '🔌' : '🔋'}</span>
                        <span>Batt: <span className="health-value">{data.battery}%</span></span>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className={`progress-bar ${getStatusClass(100 - data.battery, 70, 85)}`} // Warn when battery is low
                            style={{ width: `${data.battery}%` }}
                        ></div>
                    </div>
                </div>

                {/* Network */}
                <div className="health-group">
                    <div className="health-item">
                        <span className="health-icon">📡</span>
                        <span>Net: <span className="health-value">↓{data.network.down}K</span></span>
                    </div>
                    <div className="health-item" style={{ fontSize: '0.7rem', marginTop: '-5px' }}>
                        <span style={{ marginLeft: '25px', color: 'rgba(255,255,255,0.5)' }}>↑{data.network.up}K/s</span>
                    </div>
                </div>
            </div>

            {/* Top Processes */}
            {data.topApps && data.topApps.length > 0 && (
                <div className="top-apps">
                    <h4>Top Processes (SOTA Tracking)</h4>
                    {data.topApps.map((app, i) => (
                        <div key={i} className="app-row">
                            <span className="app-name">{app.name}</span>
                            <div className="app-stats">
                                <span className="app-cpu">{app.cpu}% CPU</span>
                                <span className="app-mem">{app.mem}MB</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="ambient-waveform"></div>
        </div>
    );
};

export default HealthMonitor;
