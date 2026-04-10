const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('youtubeBackupApp', {
  getInitialState: () => ipcRenderer.invoke('app:get-initial-state'),
  setLanguage: (language) => ipcRenderer.invoke('app:set-language', language),
  pickOutputDirectory: (language) => ipcRenderer.invoke('dialog:pick-output-dir', language),
  openDirectory: (directoryPath) => ipcRenderer.invoke('dialog:open-dir', directoryPath),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  createJob: (payload) => ipcRenderer.invoke('jobs:create', payload),
  cancelJob: (jobId) => ipcRenderer.invoke('jobs:cancel', jobId),
  retryJob: (jobId) => ipcRenderer.invoke('jobs:retry', jobId),
  onJobsUpdated: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('jobs:updated', listener);
    return () => ipcRenderer.removeListener('jobs:updated', listener);
  }
});
