import React, { useState, useEffect, useRef } from 'react';
import HealthMonitor from './HealthMonitor';
import SceneSelector from './SceneSelector';
import './ChatInterface.css';

const ChatInterface = ({ onClose, messages, onSend, onToggleCamera, isCameraOn, moodVisuals, onSeeScreen, isMonitoring, onToggleMonitoring, healthData, onRunScene }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    // --- TACTILE SENTIMENT TRACKING ---
    const typingStats = useRef({ start: 0, backspaces: 0, length: 0 });

    const handleInputChange = (e) => {
        const val = e.target.value;
        if (!typingStats.current.start) typingStats.current.start = Date.now();

        // Count Backspaces
        if (val.length < typingStats.current.length) {
            typingStats.current.backspaces++;
        }
        typingStats.current.length = val.length;
        setInput(val);
    };

    const handleSendClick = () => {
        if (!input.trim()) return;

        // Calculate Stats
        const duration = (Date.now() - typingStats.current.start) / 1000; // secs
        const wpm = (input.split(' ').length / (duration / 60)) || 0;

        onSend(input, {
            speed: Math.round(wpm),
            backspaces: typingStats.current.backspaces
        });

        // Reset
        setInput('');
        typingStats.current = { start: 0, backspaces: 0, length: 0 };
    };

    // Drag Logic for Header
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        // Only trigger drag if clicking the header background or safe areas, 
        // not the close button (though close button has its own onClick, bubbling might be an issue if not handled, 
        // but typically specific handlers run. Let's start drag anyway, close btn will still work).
        isDragging.current = false;
        dragStart.current = {
            mouseX: e.clientX,
            mouseY: e.clientY
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        isDragging.current = true;

        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            // To calculate new window position:
            // We want the Window's Top-Left to remain at the same offset from the Mouse Ptr
            // The 'dragStart' captured clientX/Y, which is really just where we clicked INSIDE the window.
            // So if I click at 10,10 inside the window, I want the window to be at (CurrentScreenMouse - 10, CurrentScreenMouse - 10).

            // e.screenX is the absolute mouse position on screen.
            // dragStart.current.mouseX is the offset from left of window (since we clicked inside, clientX is approx offset if no scroll).

            const newX = e.screenX - dragStart.current.mouseX;
            const newY = e.screenY - dragStart.current.mouseY;

            ipcRenderer.send('window-move', { x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        isDragging.current = false;
    };

    return (
        <div className="chat-interface">
            <div
                className="chat-header"
                onMouseDown={handleMouseDown}
            >
                <div className="header-info">
                    <span className="status-dot"></span>
                    <h3>Luna</h3>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); onToggleCamera(); }}
                        title={isCameraOn ? "Disable Eyes" : "Enable Eyes"}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                        {isCameraOn ? '👁️' : '🙈'}
                    </button>
                    <button
                        className={`icon-btn ${isMonitoring ? 'active-pulse' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onToggleMonitoring(); }}
                        title={isMonitoring ? "Stop Monitoring" : "Start Silent Monitoring"}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            color: isMonitoring ? '#00ffcc' : 'inherit',
                            textShadow: isMonitoring ? '0 0 10px #00ffcc' : 'none'
                        }}
                    >
                        {isMonitoring ? '📡' : '🛰️'}
                    </button>
                    <button
                        className="icon-btn"
                        onClick={(e) => { e.stopPropagation(); onSeeScreen(); }}
                        title="See my Screen"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                        📸
                    </button>
                    <button
                        onClick={onClose}
                        className="close-btn"
                        onMouseDown={(e) => e.stopPropagation()}
                    >×</button>
                </div>
            </div>

            <div className="messages-area">
                <SceneSelector onRunScene={onRunScene} />
                {healthData && <HealthMonitor data={healthData} />}
                {messages.map(msg => (
                    <div key={msg.id} className={`message ${msg.sender}`}>
                        {msg.image && <img src={msg.image} alt="Captured" className="chat-image" style={{ maxWidth: '100%', borderRadius: '10px', marginTop: '5px' }} />}
                        <div className="bubble">{msg.text}</div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
                <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendClick()}
                    placeholder="Type a message..."
                />
                <button onClick={handleSendClick}>➤</button>
            </div>
        </div>
    );
};

export default ChatInterface;
