const fields = {
  serverStatus: document.getElementById('serverStatus'),
  refreshPrinters: document.getElementById('refreshPrinters'),
  printerPort: document.getElementById('printerPort'),
  printerName: document.getElementById('printerName'),
  paperWidth: document.getElementById('paperWidth'),
  baudRate: document.getElementById('baudRate'),
  serverEnabled: document.getElementById('serverEnabled'),
  endpoint: document.getElementById('endpoint'),
  token: document.getElementById('token'),
  businessName: document.getElementById('businessName'),
  footerMessage: document.getElementById('footerMessage'),
  showVoluntaryTip: document.getElementById('showVoluntaryTip'),
  voluntaryTipValue: document.getElementById('voluntaryTipValue'),
  saveConfig: document.getElementById('saveConfig'),
  testPrint: document.getElementById('testPrint'),
  feedback: document.getElementById('feedback')
};

let currentConfig = null;

const setFeedback = (message, type = '') => {
  fields.feedback.textContent = message;
  fields.feedback.className = `feedback ${type}`.trim();
};

const renderConfig = (config, status) => {
  currentConfig = config;
  fields.serverEnabled.checked = Boolean(config.server?.enabled);
  fields.endpoint.value = status?.endpoint || `http://127.0.0.1:${config.server?.port || 41780}`;
  fields.token.value = config.auth?.token || '';
  fields.printerName.value = config.printer?.name || '';
  fields.paperWidth.value = String(config.printer?.paperWidthMm || 80);
  fields.baudRate.value = String(config.printer?.baudRate || 9600);
  fields.businessName.value = config.receipt?.businessName || '';
  fields.footerMessage.value = config.receipt?.footerMessage || '';
  fields.showVoluntaryTip.checked = Boolean(config.receipt?.showVoluntaryTip);
  fields.voluntaryTipValue.value = String(config.receipt?.voluntaryTipValue || 0);
  fields.serverStatus.textContent = status?.portPath
    ? `Listo: ${status.portPath}`
    : 'Esperando impresora';
};

const refreshPrinters = async () => {
  const selected = currentConfig?.printer?.portPath || fields.printerPort.value;
  fields.printerPort.innerHTML = '';

  const ports = await window.stockyBridge.listPrinters();
  if (!ports.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No se detectaron puertos COM';
    fields.printerPort.appendChild(option);
    return;
  }

  ports.forEach((port) => {
    const option = document.createElement('option');
    option.value = port.path;
    option.textContent = [port.path, port.friendlyName || port.manufacturer].filter(Boolean).join(' - ');
    fields.printerPort.appendChild(option);
  });

  fields.printerPort.value = selected || ports[0].path;
};

const load = async () => {
  const [config, status] = await Promise.all([
    window.stockyBridge.getConfig(),
    window.stockyBridge.getServerStatus()
  ]);
  renderConfig(config, status);
  await refreshPrinters();
};

const collectConfig = () => ({
  server: {
    enabled: fields.serverEnabled.checked
  },
  printer: {
    name: fields.printerName.value.trim(),
    portPath: fields.printerPort.value,
    paperWidthMm: Number(fields.paperWidth.value),
    baudRate: Number(fields.baudRate.value)
  },
  receipt: {
    businessName: fields.businessName.value.trim() || 'Sistema Stocky',
    footerMessage: fields.footerMessage.value.trim() || 'Gracias por su compra',
    showVoluntaryTip: fields.showVoluntaryTip.checked,
    voluntaryTipValue: Number(fields.voluntaryTipValue.value || 0)
  }
});

fields.refreshPrinters.addEventListener('click', async () => {
  try {
    await refreshPrinters();
    setFeedback('Puertos actualizados.', 'success');
  } catch (err) {
    setFeedback(err?.message || 'No se pudieron listar los puertos.', 'error');
  }
});

fields.saveConfig.addEventListener('click', async () => {
  try {
    const config = await window.stockyBridge.updateConfig(collectConfig());
    const status = await window.stockyBridge.getServerStatus();
    renderConfig(config, status);
    setFeedback('Configuración guardada.', 'success');
  } catch (err) {
    setFeedback(err?.message || 'No se pudo guardar.', 'error');
  }
});

fields.testPrint.addEventListener('click', async () => {
  try {
    await window.stockyBridge.updateConfig(collectConfig());
    await window.stockyBridge.testPrint();
    setFeedback('Prueba enviada a la impresora.', 'success');
  } catch (err) {
    setFeedback(err?.message || 'No se pudo imprimir la prueba.', 'error');
  }
});

load().catch((err) => {
  setFeedback(err?.message || 'No se pudo iniciar Stocky Print Bridge.', 'error');
});
