const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';

function createMainWindow() {
	const win = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1200,
		minHeight: 760,
		autoHideMenuBar: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	win.once('ready-to-show', () => {
		win.show();
	});

	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	if (isDev) {
		win.loadURL(startUrl);
		win.webContents.openDevTools({ mode: 'detach' });
	} else {
		win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
	}
}

app.whenReady().then(() => {
	createMainWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

