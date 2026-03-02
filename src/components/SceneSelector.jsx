import React from 'react';
import './SceneSelector.css';

const SCENES = [
    { id: 'coding', name: 'Code Mode', icon: '💻', desc: 'VS Code + Docs' },
    { id: 'cinema', name: 'Cinema', icon: '🍿', desc: 'YouTube + Mute' },
    { id: 'relax', name: 'Relax', icon: '🧘‍♀️', desc: 'Spotify Vibes' }
];

const SceneSelector = ({ onRunScene }) => {
    return (
        <div className="scene-selector">
            <div className="scene-header">
                <h4>Life Automation Scenes 🪄</h4>
            </div>
            <div className="scene-grid">
                {SCENES.map(scene => (
                    <button
                        key={scene.id}
                        className="scene-card"
                        onClick={() => onRunScene(scene.id)}
                    >
                        <span className="scene-icon">{scene.icon}</span>
                        <div className="scene-info">
                            <span className="scene-name">{scene.name}</span>
                            <span className="scene-desc">{scene.desc}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SceneSelector;
