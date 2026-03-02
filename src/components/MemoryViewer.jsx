import React, { useState, useEffect } from 'react';
import './MemoryViewer.css';
import { getMemories, deleteMemory, clearMemories } from '../services/memory';

const MemoryViewer = ({ onClose }) => {
    const [memories, setMemories] = useState([]);

    useEffect(() => {
        loadMemories();
    }, []);

    const loadMemories = () => {
        setMemories([...getMemories()]);
    };

    const handleDelete = (id) => {
        deleteMemory(id);
        loadMemories();
    };

    const handleClearAll = () => {
        if (window.confirm("Are you sure? This will wipe all learned facts and reset to defaults.")) {
            clearMemories();
            loadMemories();
        }
    };

    return (
        <div className="memory-viewer-overlay" onClick={onClose}>
            <div className="memory-viewer-modal" onClick={e => e.stopPropagation()}>
                <div className="memory-header">
                    <h2>🧠 Luna's Brain</h2>
                    <div className="memory-actions">
                        <button className="action-btn danger" onClick={handleClearAll}>
                            Reset / Clear All
                        </button>
                        <button className="action-btn" onClick={onClose}>Close</button>
                    </div>
                </div>

                <div className="memory-list">
                    {memories.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
                            No memories found. Luna's mind is a blank slate. 🌑
                        </div>
                    ) : (
                        memories.map(mem => (
                            <div key={mem.id} className={`memory-item ${mem.type || 'fact'}`}>
                                <div className="memory-content">
                                    <div className="memory-meta">
                                        <span className="type-badge">{mem.type || 'FACT'}</span>
                                        <span>{mem.date || 'Unknown Date'}</span>
                                    </div>
                                    <div className="memory-text">{mem.text}</div>
                                </div>
                                {mem.type !== 'core' && (
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDelete(mem.id)}
                                        title="Forget this"
                                    >×</button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default MemoryViewer;
