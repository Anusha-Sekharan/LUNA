const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    send: (channel, data) => {
        // Whitelist channels
        let validChannels = ['resize-window', 'save-photo', 'window-move'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    on: (channel, func) => {
        let validChannels = ['bestie-checkin', 'photo-saved'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    removeListener: (channel, func) => {
        // This is tricky with contextIsolation because functions can't be passed directly back.
        // For simple use cases, we might just remove all listeners or handle it differently.
        // For now, let's allow removing all listeners for a channel.
        ipcRenderer.removeAllListeners(channel);
    }
});

contextBridge.exposeInMainWorld('fs', {
    saveMemory: (data) => ipcRenderer.invoke('save-memory', data),
    loadMemory: () => ipcRenderer.invoke('load-memory'),
    saveEmotions: (data) => ipcRenderer.invoke('save-emotions', data),
    loadEmotions: () => ipcRenderer.invoke('load-emotions'),

    // Advanced Memory
    loadUserProfile: () => ipcRenderer.invoke('load-user-profile'),
    saveUserProfile: (data) => ipcRenderer.invoke('save-user-profile', data),
    loadEntities: () => ipcRenderer.invoke('load-entities'),
    saveEntity: (data) => ipcRenderer.invoke('save-entity', data),
    logConversation: (role, content) => ipcRenderer.invoke('log-conversation', { role, content }),
});
