const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stockyBridge', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (config) => ipcRenderer.invoke('config:update', config),
  listPrinters: () => ipcRenderer.invoke('printer:list'),
  testPrint: () => ipcRenderer.invoke('printer:test'),
  getServerStatus: () => ipcRenderer.invoke('server:status')
});
