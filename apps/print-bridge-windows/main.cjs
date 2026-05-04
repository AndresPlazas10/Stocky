const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { ConfigStore } = require('./src/config-store.cjs');
const { PrintBridgeServer } = require('./src/server.cjs');
const printer = require('./src/serial-printer.cjs');
const { serializeReceipt } = require('./src/escpos.cjs');

let mainWindow;
let configStore;
let bridgeServer;

const createTestReceipt = (config) => ({
  type: 'sale',
  version: 1,
  requiredSections: ['items', 'totals'],
  header: {
    title: 'PRUEBA STOCKY',
    businessName: config.receipt?.businessName || 'Sistema Stocky',
    dateText: new Date().toLocaleString('es-CO'),
    alignment: config.receipt?.headerAlignment || 'center'
  },
  metadata: [
    { label: 'Bridge', value: 'Windows' },
    { label: 'Impresora', value: config.printer?.name || config.printer?.portPath || 'Configurada' }
  ],
  items: [
    {
      name: 'Impresion de prueba',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      subtotalText: '0 COP'
    }
  ],
  totals: {
    subtotal: 0,
    subtotalText: '0 COP',
    voluntaryTip: 0,
    voluntaryTipText: '0 COP',
    total: 0,
    totalText: '0 COP'
  },
  payment: {
    method: 'test',
    methodText: 'Prueba'
  },
  footer: {
    message: config.receipt?.footerMessage || 'Gracias por su compra',
    alignment: config.receipt?.footerAlignment || 'center'
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 860,
    minHeight: 640,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  configStore = new ConfigStore(app.getPath('userData'));
  configStore.load();
  bridgeServer = new PrintBridgeServer({ configStore, printer });
  bridgeServer.start();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

ipcMain.handle('config:get', () => configStore.get());

ipcMain.handle('config:update', (_event, partialConfig) => {
  const next = configStore.update(partialConfig);
  return next;
});

ipcMain.handle('printer:list', async () => printer.listPorts());

ipcMain.handle('printer:test', async () => {
  const config = configStore.get();
  const buffer = serializeReceipt({
    receipt: createTestReceipt(config),
    paperWidthMm: config.printer?.paperWidthMm || 80
  });

  await printer.printBuffer({
    portPath: config.printer?.portPath,
    baudRate: config.printer?.baudRate,
    buffer
  });

  return { ok: true };
});

ipcMain.handle('server:status', () => {
  const config = configStore.get();
  return {
    ok: true,
    endpoint: `http://127.0.0.1:${config.server?.port || 41780}`,
    enabled: Boolean(config.server?.enabled),
    printerName: config.printer?.name || '',
    portPath: config.printer?.portPath || ''
  };
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (bridgeServer) bridgeServer.stop();
});
