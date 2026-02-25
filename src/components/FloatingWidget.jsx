import React from 'react';
import './FloatingWidget.css';

const FloatingWidget = ({ onClick, visuals }) => {
    const isDragging = React.useRef(false);
    const dragStart = React.useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        console.log("Widget: MouseDown");
        isDragging.current = false;

        // Capture mouse offset relative to screen
        dragStart.current = {
            mouseX: e.clientX,
            mouseY: e.clientY
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        isDragging.current = true;
        // console.log("Widget: MouseMove"); // Too spammy, maybe uncomment if needed

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const newX = e.screenX - dragStart.current.mouseX;
            const newY = e.screenY - dragStart.current.mouseY;
            ipcRenderer.send('window-move', { x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        if (!isDragging.current) {
            onClick();
        }
        isDragging.current = false;
    };

    const style = {
        borderColor: visuals ? visuals.color : 'cyan',
        boxShadow: visuals ? `0 0 20px ${visuals.color}80` : undefined,
        animation: visuals ? `${visuals.animation} 3s ease-in-out infinite` : 'float 3s ease-in-out infinite'
    };

    return (
        <div
            className="floating-widget"
            onMouseDown={handleMouseDown}
            style={style}
        >
            <div className="avatar-container">
                <img src="/luna_avatar.png" alt="Luna" className="avatar-image" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
                <div className="avatar-placeholder" style={{ display: 'none' }}>Luna</div>
            </div>
        </div>
    );
};

export default FloatingWidget;
