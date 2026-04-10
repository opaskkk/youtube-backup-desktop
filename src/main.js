const path = require('node:path');
const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require('electron');
const { DownloadManager } = require('./services/download-manager');
const { ensureBundledBinaries } = require('./services/binary-manager');
const { loadSettings, normalizeLanguage, saveSettings, saveSettingsSync } = require('./services/settings-store');

let mainWindow = null;
let downloadManager = null;
let isQuitting = false;
let currentSettings = null;
let windowStateSaveTimer = null;

function getFolderDialogTitle(language) {
  return normalizeLanguage(language) === 'ko' ? '백업 폴더 선택' : 'Choose backup folder';
}

function buildLocalizedMenu(language) {
  const locale = normalizeLanguage(language);

  const labels = locale === 'ko'
    ? {
        file: '파일',
        close: '닫기',
        edit: '편집',
        undo: '실행 취소',
        redo: '다시 실행',
        cut: '잘라내기',
        copy: '복사',
        paste: '붙여넣기',
        selectAll: '전체 선택',
        view: '보기',
        reload: '새로 고침',
        forceReload: '강제 새로 고침',
        toggleDevTools: '개발자 도구',
        resetZoom: '실제 크기',
        zoomIn: '확대',
        zoomOut: '축소',
        toggleFullScreen: '전체 화면',
        window: '창',
        minimize: '최소화',
        zoom: '확대/축소',
        help: '도움말',
        about: 'YouTube Backup Desktop 정보'
      }
    : {
        file: 'File',
        close: 'Close',
        edit: 'Edit',
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste',
        selectAll: 'Select All',
        view: 'View',
        reload: 'Reload',
        forceReload: 'Force Reload',
        toggleDevTools: 'Toggle Developer Tools',
        resetZoom: 'Actual Size',
        zoomIn: 'Zoom In',
        zoomOut: 'Zoom Out',
        toggleFullScreen: 'Toggle Full Screen',
        window: 'Window',
        minimize: 'Minimize',
        zoom: 'Zoom',
        help: 'Help',
        about: 'About YouTube Backup Desktop'
      };

  return Menu.buildFromTemplate([
    {
      label: labels.file,
      submenu: [
        { label: labels.close, role: 'close' }
      ]
    },
    {
      label: labels.edit,
      submenu: [
        { label: labels.undo, role: 'undo' },
        { label: labels.redo, role: 'redo' },
        { type: 'separator' },
        { label: labels.cut, role: 'cut' },
        { label: labels.copy, role: 'copy' },
        { label: labels.paste, role: 'paste' },
        { type: 'separator' },
        { label: labels.selectAll, role: 'selectAll' }
      ]
    },
    {
      label: labels.view,
      submenu: [
        { label: labels.reload, role: 'reload' },
        { label: labels.forceReload, role: 'forceReload' },
        { label: labels.toggleDevTools, role: 'toggleDevTools' },
        { type: 'separator' },
        { label: labels.resetZoom, role: 'resetZoom' },
        { label: labels.zoomIn, role: 'zoomIn' },
        { label: labels.zoomOut, role: 'zoomOut' },
        { type: 'separator' },
        { label: labels.toggleFullScreen, role: 'togglefullscreen' }
      ]
    },
    {
      label: labels.window,
      submenu: [
        { label: labels.minimize, role: 'minimize' },
        { label: labels.zoom, role: 'zoom' },
        { label: labels.close, role: 'close' }
      ]
    },
    {
      label: labels.help,
      submenu: [
        { label: labels.about, role: 'about' }
      ]
    }
  ]);
}

function applyApplicationMenu(language) {
  Menu.setApplicationMenu(buildLocalizedMenu(language));
}

function getSafeWindowBounds(windowBounds) {
  if (!windowBounds) {
    return null;
  }

  const display = screen.getDisplayMatching({
    x: windowBounds.x,
    y: windowBounds.y,
    width: windowBounds.width,
    height: windowBounds.height
  });

  if (!display || !display.workArea) {
    return null;
  }

  const { x, y, width, height } = display.workArea;
  const fitsHorizontally = windowBounds.x < x + width && (windowBounds.x + windowBounds.width) > x;
  const fitsVertically = windowBounds.y < y + height && (windowBounds.y + windowBounds.height) > y;

  return fitsHorizontally && fitsVertically ? windowBounds : null;
}

function clearPendingWindowStateSave() {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = null;
  }
}

function collectWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const bounds = mainWindow.isMaximized()
    ? mainWindow.getNormalBounds()
    : mainWindow.getBounds();

  return {
    ...bounds,
    isMaximized: mainWindow.isMaximized()
  };
}

async function persistWindowState() {
  const windowBounds = collectWindowState();
  if (!windowBounds) {
    return;
  }

  const nextSettings = await saveSettings(app, {
    ...currentSettings,
    windowBounds
  });
  currentSettings = nextSettings;
}

function persistWindowStateSync() {
  const windowBounds = collectWindowState();
  if (!windowBounds) {
    return;
  }

  clearPendingWindowStateSave();
  const nextSettings = saveSettingsSync(app, {
    ...currentSettings,
    windowBounds
  });
  currentSettings = nextSettings;
}

function scheduleWindowStatePersist() {
  clearPendingWindowStateSave();
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    void persistWindowState();
  }, 250);
}

function createWindow() {
  const restoredBounds = getSafeWindowBounds(currentSettings?.windowBounds);
  mainWindow = new BrowserWindow({
    width: restoredBounds?.width || 1200,
    height: restoredBounds?.height || 860,
    x: restoredBounds?.x,
    y: restoredBounds?.y,
    minWidth: 1040,
    minHeight: 760,
    backgroundColor: '#f4efe7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (restoredBounds?.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) {
      scheduleWindowStatePersist();
    }
  });

  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      scheduleWindowStatePersist();
    }
  });

  mainWindow.on('maximize', () => {
    scheduleWindowStatePersist();
  });

  mainWindow.on('unmaximize', () => {
    scheduleWindowStatePersist();
  });

  mainWindow.on('close', () => {
    persistWindowStateSync();
  });
}

async function bootstrap() {
  await app.whenReady();
  await ensureBundledBinaries(app);

  const initialSettings = await loadSettings(app);
  currentSettings = initialSettings;
  applyApplicationMenu(initialSettings.language);

  downloadManager = new DownloadManager({
    app,
    onUpdate(snapshot) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('jobs:updated', snapshot);
      }
    }
  });

  ipcMain.handle('dialog:pick-output-dir', async (_event, language) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: getFolderDialogTitle(language)
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('dialog:open-dir', async (_event, directoryPath) => {
    if (!directoryPath || typeof directoryPath !== 'string') {
      return { ok: false, message: 'No folder selected.' };
    }

    const errorMessage = await shell.openPath(directoryPath);
    if (errorMessage) {
      return { ok: false, message: errorMessage };
    }

    return { ok: true };
  });

  ipcMain.handle('app:get-initial-state', async () => ({
    settings: currentSettings,
    jobs: downloadManager.getSnapshot()
  }));

  ipcMain.handle('app:set-language', async (_event, language) => {
    applyApplicationMenu(language);
    return normalizeLanguage(language);
  });

  ipcMain.handle('settings:save', async (_event, settings) => {
    const saved = await saveSettings(app, settings);
    currentSettings = saved;
    applyApplicationMenu(saved.language);
    return saved;
  });

  ipcMain.handle('jobs:create', async (_event, payload) => {
    return downloadManager.enqueue(payload);
  });

  ipcMain.handle('jobs:cancel', async (_event, jobId) => {
    return downloadManager.cancel(jobId);
  });

  ipcMain.handle('jobs:retry', async (_event, jobId) => {
    return downloadManager.retry(jobId);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  persistWindowStateSync();
  downloadManager?.shutdown();
});

bootstrap().catch((error) => {
  console.error('Failed to bootstrap app', error);
  app.quit();
});
