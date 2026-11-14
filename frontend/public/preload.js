// public/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Exposes window.electronAPI.setContentProtection() to your React app
contextBridge.exposeInMainWorld('electronAPI', {
    setContentProtection: (shouldProtect) => ipcRenderer.send('toggle-content-protection', shouldProtect)
});