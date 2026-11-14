// public/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Loads the security bridge
            contextIsolation: true, // Required for secure IPC
            nodeIntegration: false
        }
    });

    // In development, load the local React server.
    // In production, you would loadFile(path.join(__dirname, '../build/index.html'))
    mainWindow.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
    createWindow();
});

// OS HOOK: Listen for the React trigger and apply OS-level blackout
ipcMain.on('toggle-content-protection', (event, shouldProtect) => {
    if (mainWindow) {
        mainWindow.setContentProtection(shouldProtect);
        console.log(`[Veri-Human] OS Content Protection set to: ${shouldProtect}`);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});