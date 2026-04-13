const path = require('node:path');
const { app, BrowserWindow } = require('electron');

let previewWindow = null;

function createWindow() {
  previewWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1220,
    minHeight: 820,
    title: 'YouTube Backup Desktop Design Preview',
    backgroundColor: '#f4efe7',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  previewWindow.loadFile(path.join(__dirname, 'renderer', 'design-preview.html'));
}

app.whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error('Failed to open design preview', error);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
