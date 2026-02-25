const { app, BrowserWindow, ipcMain, screen, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const si = require('systeminformation');

// Register media protocol to load local files
app.whenReady().then(() => {
    protocol.registerFileProtocol('media', (request, callback) => {
        let filePath = request.url.replace('media://', '');
        // Remove leading slash if it exists (common in URL parsing)
        if (filePath.startsWith('/')) {
            filePath = filePath.substring(1);
        }
        try {
            return callback(decodeURIComponent(filePath));
        } catch (error) {
            console.error("[Protocol Error]:", error);
        }
    });
});

let mainWindow;

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // Initial Window (Widget)
    mainWindow = new BrowserWindow({
        width: 120,   // Start with widget size
        height: 120,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For easier IPC initially
        },
        alwaysOnTop: true,
        frame: false, // Frameless for custom UI
        transparent: true, // Transparent for non-rectangular shapes
        resizable: false,
        skipTaskbar: true,
        x: width - 200,
        y: 100,
    });

    // Load Splash Screen first
    mainWindow.loadFile(path.join(__dirname, 'splash.html'));

    // Polling function to check if the dev server is ready
    const pollServer = (url) => {
        const http = require('http');
        const check = () => {
            console.log("Checking for dev server at:", url);
            http.get(url, (res) => {
                if (res.statusCode === 200) {
                    console.log("Dev server ready! Loading App...");
                    mainWindow.loadURL(url);
                } else {
                    setTimeout(check, 500);
                }
            }).on('error', () => {
                setTimeout(check, 500);
            });
        };
        check();
    };

    // Load the app URL or start polling
    const startUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3010'
        : `file://${path.join(__dirname, 'dist/index.html')}`;

    if (process.env.NODE_ENV === 'development') {
        pollServer(startUrl);
    } else {
        mainWindow.loadURL(startUrl);
    }

    mainWindow.on('closed', () => (mainWindow = null));

    // Background Logic: Check on user every 2 hours
    setInterval(() => {
        if (mainWindow) {
            mainWindow.webContents.send('bestie-checkin', 'Hey! You have been working for a while. Take a break? 🥤');
        }
    }, 2 * 60 * 60 * 1000); // 2 hours

    // Health Buddy Polling - Every 5 seconds
    setInterval(async () => {
        if (mainWindow) {
            try {
                const [cpu, mem, battery, temp, network] = await Promise.all([
                    si.currentLoad(),
                    si.mem(),
                    si.battery(),
                    si.cpuTemperature(),
                    si.networkStats()
                ]);

                // Identify Top 3 Apps (CPU & RAM usage)
                const processes = await si.processes();
                const topApps = processes.list
                    .sort((a, b) => b.cpu - a.cpu)
                    .slice(0, 3)
                    .map(p => ({
                        name: p.name,
                        cpu: Math.round(p.cpu),
                        mem: Math.round(p.memRss / 1024 / 1024) // MB
                    }));

                mainWindow.webContents.send('system:health-update', {
                    cpu: Math.round(cpu.currentLoad),
                    temp: temp.main || 0,
                    ramUsed: (mem.active / (1024 * 1024 * 1024)).toFixed(1),
                    ramTotal: (mem.total / (1024 * 1024 * 1024)).toFixed(1),
                    battery: battery.percent,
                    isCharging: battery.isCharging,
                    network: network[0] ? {
                        up: (network[0].tx_sec / 1024).toFixed(1),
                        down: (network[0].rx_sec / 1024).toFixed(1)
                    } : { up: 0, down: 0 },
                    topApps
                });
            } catch (err) {
                console.error("[Health Polling Error]:", err);
            }
        }
    }, 5000);

    // --- CLIPBOARD MONITORING ---
    const { clipboard } = require('electron');
    let lastClipboardText = clipboard.readText();

    setInterval(() => {
        const text = clipboard.readText();
        if (text && text !== lastClipboardText) {
            lastClipboardText = text;
            if (mainWindow) {
                console.log("[Clipboard] Change detected.");
                mainWindow.webContents.send('system:clipboard-update', text);
            }
        }
    }, 2000);
}

// --- APP IPC HANDLERS ---
ipcMain.on('system:run-scene', async (event, { sceneName }) => {
    const { exec } = require('child_process');
    const path = require('path');
    const pythonPath = 'python';
    const bridgePath = path.join(__dirname, 'python', 'bridge.py');

    console.log(`[Scenes] Running scenario: ${sceneName}`);

    const smartFocusOrLaunch = (titlePart, launchCmd) => {
        exec(`${pythonPath} "${bridgePath}" focus_window "${titlePart}"`, (err, stdout) => {
            try {
                const res = JSON.parse(stdout);
                if (!res.success) {
                    // Not found, launch it
                    console.log(`[SmartLaunch] ${titlePart} not found, launching...`);
                    exec(launchCmd);
                } else {
                    console.log(`[SmartLaunch] ${titlePart} focused!`);
                }
            } catch (e) {
                exec(launchCmd);
            }
        });
    };

    switch (sceneName) {
        case 'coding':
            smartFocusOrLaunch('Visual Studio Code', 'code .');
            exec('start https://stackoverflow.com');
            break;
        case 'cinema':
            smartFocusOrLaunch('YouTube', 'start https://youtube.com');
            exec('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"'); // Toggle Mute
            break;
        case 'relax':
            smartFocusOrLaunch('Spotify', 'start https://open.spotify.com');
            break;
        default:
            console.warn("Unknown scene:", sceneName);
    }
});

ipcMain.on('save-photo', (event, { dataUrl }) => {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return;

    const buffer = Buffer.from(matches[2], 'base64');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `photo_${timestamp}.png`;
    const photoDir = path.join(process.cwd(), 'data', 'photos');

    if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
    const filePath = path.join(photoDir, filename);

    fs.writeFile(filePath, buffer, (err) => {
        if (!err) event.reply('photo-saved', { success: true, path: filePath });
    });
});

ipcMain.on('resize-window', (event, arg) => {
    if (!mainWindow) return;
    if (arg === 'chat') {
        mainWindow.setResizable(true);
        mainWindow.setSize(350, 600, true);
        mainWindow.setResizable(false);
    } else if (arg === 'widget') {
        mainWindow.setResizable(true);
        mainWindow.setSize(120, 120, true);
        mainWindow.setResizable(false);
    }
});

ipcMain.on('window-move', (event, { x, y }) => {
    if (mainWindow) mainWindow.setPosition(Math.round(x), Math.round(y));
});

// --- ASSISTANT SYSTEM ACTIONS ---

ipcMain.on('system:open-app', (event, { appName }) => {
    const { shell } = require('electron');
    const { spawn } = require('child_process');
    const path = require('path');

    const webFallbacks = {
        'whatsapp': 'https://web.whatsapp.com',
        'discord': 'https://discord.com/app',
        'spotify': 'https://open.spotify.com',
        'gmail': 'https://mail.google.com',
        'youtube': 'https://youtube.com',
        'telegram': 'https://web.telegram.org'
    };

    const lowerName = appName.toLowerCase().trim();
    const pythonPath = 'python';
    const scriptPath = path.join(__dirname, 'python', 'bridge.py');

    // 1. Try Python Bridge (Robust Launcher)
    const pythonProcess = spawn(pythonPath, [scriptPath, 'open_app', appName]);
    let output = '';

    pythonProcess.stdout.on('data', (data) => output += data.toString());

    pythonProcess.on('close', (code) => {
        try {
            const result = JSON.parse(output);
            if (result.success) {
                event.reply('system:action-result', { success: true, message: `Opened ${appName}! 🚀` });
            } else {
                // 2. Fallback to Web if Python fails
                console.log(`Python launcher failed for ${appName}, checking web fallbacks...`);
                const fallbackKey = Object.keys(webFallbacks).find(k => lowerName.includes(k));
                const fallbackUrl = webFallbacks[lowerName] || (fallbackKey ? webFallbacks[fallbackKey] : null);

                if (fallbackUrl) {
                    shell.openExternal(fallbackUrl);
                    event.reply('system:action-result', {
                        success: true,
                        message: `I couldn't find the ${appName} app, so I opened it in your browser! 🌐`
                    });
                } else {
                    event.reply('system:action-result', { success: false, error: `Could not find application: ${appName}` });
                }
            }
        } catch (e) {
            event.reply('system:action-result', { success: false, error: 'Command bridge error' });
        }
    });
});

ipcMain.on('system:browse', (event, { url }) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    event.reply('system:action-result', { success: true, message: `Opened browser at ${url}` });
});

ipcMain.on('system:whatsapp-send', (event, { phone, message }) => {
    const { shell, exec } = require('electron');
    const { exec: childExec } = require('child_process');

    let url;
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';

    if (cleanPhone) {
        url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    } else {
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    }

    shell.openExternal(url);

    // Smart Send: Use Python + PyAutoGUI to press Enter
    // This is more robust than PowerShell for complex UI
    setTimeout(() => {
        const pythonPath = 'python'; // Assumptions: python is in PATH
        const scriptPath = path.join(__dirname, 'python', 'bridge.py');

        const { spawn } = require('child_process');
        // We pass the message as well just in case we want to use clipboard later
        const pythonProcess = spawn(pythonPath, [scriptPath, 'whatsapp_send', message]);

        pythonProcess.stdout.on('data', (data) => console.log(`[Python Bridge]: ${data}`));
        pythonProcess.stderr.on('data', (data) => console.error(`[Python Error]: ${data}`));

        pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
        });
    }, 7000);

    event.reply('system:action-result', {
        success: true,
        message: `I've prepared your message! Quick—click on the WhatsApp tab I just opened! I'll press "Send" for you in 7 seconds! 📲💨`
    });
});

ipcMain.on('system:list-files', (event, { directory }) => {
    const targetDir = directory || process.cwd();
    fs.readdir(targetDir, { withFileTypes: true }, (err, files) => {
        if (!err) {
            const fileList = files.map(f => `${f.isDirectory() ? '📂' : '📄'} ${f.name}`);
            event.reply('system:action-result', { success: true, data: fileList });
        }
    });
});

ipcMain.on('system:type-text', (event, { text }) => {
    if (!text) return;
    const { spawn } = require('child_process');
    const path = require('path');

    const pythonPath = 'python';
    const scriptPath = path.join(__dirname, 'python', 'bridge.py');

    // Use Python Bridge for robust typing (PyAutoGUI)
    console.log(`[V2.0-PYTHON] Starting Python type_text for: ${text}`);

    // We wait 2 seconds to allow user to focus the target field
    setTimeout(() => {
        const pythonProcess = spawn(pythonPath, [scriptPath, 'type_text', text]);

        pythonProcess.stdout.on('data', (data) => console.log(`[Python Bridge]: ${data}`));
        pythonProcess.stderr.on('data', (data) => console.error(`[Python Error]: ${data}`));

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                event.reply('system:action-result', { success: true, message: 'Typed successfully via Python! ⌨️✅' });
            } else {
                event.reply('system:action-result', { success: false, error: 'Python typing failed' });
            }
        });
    }, 2000);
});

ipcMain.on('system:capture-screen', (event) => {
    const { spawn } = require('child_process');
    const path = require('path');

    const pythonPath = 'python';
    // Use app.getAppPath() to ensure absolute pathing regardless of launch context
    const scriptPath = path.join(app.getAppPath(), 'python', 'bridge.py');

    console.log(`[Vision] Launching bridge at: ${scriptPath}`);

    // Add delay so user can focus the target window
    setTimeout(() => {
        // Wrap scriptPath in quotes to handle spaces in directory name (e.g. AI girl)
        const pythonProcess = spawn(pythonPath, [`"${scriptPath}"`, 'capture_screen'], {
            shell: true,
            cwd: app.getAppPath()
        });
        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => output += data.toString());
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error(`[Vision Error Output]: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`[Vision Bridge] Process exited with code ${code}`);
            try {
                // Find the JSON part in case there's other output noise
                const startIdx = output.lastIndexOf('{');
                const endIdx = output.lastIndexOf('}') + 1;

                if (startIdx === -1 || endIdx === 0) {
                    throw new Error(errorOutput || "No JSON found in output: " + output);
                }

                const jsonStr = output.substring(startIdx, endIdx);
                const result = JSON.parse(jsonStr);

                if (result.success) {
                    console.log(`[Vision Bridge] Capture success: ${result.path}`);
                    event.reply('system:action-result', { success: true, data: result.path });
                } else {
                    console.error(`[Vision Bridge] Python logic error: ${result.error}`);
                    event.reply('system:action-result', { success: false, error: result.error });
                }
            } catch (e) {
                console.error(`[Vision Bridge] Exception: ${e.message}`);
                event.reply('system:action-result', {
                    success: false,
                    error: `Vision failed. Python says: ${e.message.substring(0, 100)}...`
                });
            }
        });
    }, 3000);
});

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on('ready', () => {
        createWindow();

        // Auto-launch on startup (works best in packaged app)
        app.setLoginItemSettings({
            openAtLogin: true,
            path: app.getPath('exe') // Path to the executable
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
