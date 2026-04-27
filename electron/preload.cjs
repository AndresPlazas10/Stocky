const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('stockyDesktop', {
  platform: process.platform,
  isDesktop: true,
  isPackaged: process.env.NODE_ENV === 'production',
});
