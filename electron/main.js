const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { fork, ChildProcess } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.setName('Echotron'); // pins userData to %APPDATA%\Echotron regardless of package.json's lowercase name

// Prevent a second launch (e.g. clicking the taskbar icon while already
// running) from spawning a second server that immediately crashes on the
// already-bound port. Second launch just focuses the existing window instead.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;
/** @type {ChildProcess | null} */
let serverProcess = null;

const PORT = process.env.PORT || 5075;

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error('Server did not become ready in time'));
          } else {
            setTimeout(attempt, 300);
          }
        });
    };
    attempt();
  });
}

function startServer() {
  // In dev, ELECTRON_START_URL is set (Vite dev server) — the server is
  // already running separately via `npm --prefix server run dev`, so don't
  // spawn a second copy of it.
  if (process.env.ELECTRON_START_URL) return Promise.resolve();

  const userDataPath = app.getPath('userData');
  const envPath = path.join(userDataPath, '.env');
  const dataDir = path.join(userDataPath, 'data');

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(
      envPath,
      '# Echotron configuration\nSARVAM_API_KEY=your_sarvam_api_key_here\nPORT=5075\n',
      'utf8'
    );
  }

  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'server', 'index.js')
    : path.join(__dirname, '..', 'server', 'index.js');

  serverProcess = fork(serverEntry, [], {
    env: {
      ...process.env,
      ECHOTRON_ENV_PATH: envPath,
      ECHOTRON_DATA_DIR: dataDir,
      PORT: String(PORT),
    },
    silent: true,
  });
  serverProcess.stdout?.on('data', (d) => console.log(`[server] ${d}`.trim()));
  serverProcess.stderr?.on('data', (d) => console.error(`[server] ${d}`.trim()));

  return waitForServer(`http://localhost:${PORT}/api/health`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: 'Echotron',
    backgroundColor: '#F6F7F5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || `http://localhost:${PORT}`;
  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    dialog.showErrorBox('Echotron failed to start', String(err));
    app.quit();
    return;
  }

  createWindow();

  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
