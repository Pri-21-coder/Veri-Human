// public/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

let mainWindow;
let SetWindowDisplayAffinity = null;

// Connect directly to the Windows OS Kernel
if (os.platform() === 'win32') {
    try {
        const koffi = require('koffi');
        const user32 = koffi.load('user32.dll');
        // Define the Win32 API function
        SetWindowDisplayAffinity = user32.func('bool __stdcall SetWindowDisplayAffinity(void* hWnd, uint32 dwAffinity)');
    } catch (err) {
        console.error("Failed to load user32.dll via koffi", err);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
    createWindow();
});

// OS HOOK: Listen for the React trigger
ipcMain.on('toggle-content-protection', (event, shouldProtect) => {
    if (mainWindow) {
        if (os.platform() === 'win32' && SetWindowDisplayAffinity) {
            const WDA_NONE = 0x00;
            const WDA_MONITOR = 0x01; // Solid Black Box
            
            // CRITICAL FIX: Extract the actual integer ID from Electron's Buffer
            const hwndBuffer = mainWindow.getNativeWindowHandle();
            // Windows is 64-bit on most modern machines, ia32 on older ones
            const hwndInt = os.arch() === 'ia32' ? hwndBuffer.readInt32LE(0) : hwndBuffer.readBigInt64LE(0);
            
            // Send the extracted integer to the Kernel
            const success = SetWindowDisplayAffinity(hwndInt, shouldProtect ? WDA_MONITOR : WDA_NONE);
            
            console.log(`[Veri-Human] Black Box Applied: ${success}, Protection: ${shouldProtect ? 'ON' : 'OFF'}`);
        } else {
            // Fallback for macOS / Linux
            mainWindow.setContentProtection(shouldProtect);
            console.log(`[Veri-Human] Native Electron Content Protection set to: ${shouldProtect}`);
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});