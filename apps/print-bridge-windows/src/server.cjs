const http = require('http');
const { serializeReceipt } = require('./escpos.cjs');

const readJsonBody = (request) => new Promise((resolve, reject) => {
  let body = '';

  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 512 * 1024) {
      reject(new Error('Payload demasiado grande'));
      request.destroy();
    }
  });

  request.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch {
      reject(new Error('JSON invalido'));
    }
  });
});

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Stocky-Bridge-Token, X-Stocky-Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  response.end(JSON.stringify(payload));
};

const validateOrigin = (config, request) => {
  const origin = request.headers.origin || request.headers['x-stocky-origin'] || '';
  if (!origin) return true;

  const allowed = config.server?.allowedOrigins || [];
  if (allowed.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const validateReceipt = (receipt) => {
  if (!receipt || receipt.type !== 'sale') return 'Tipo de recibo no soportado';
  if (!Array.isArray(receipt.items) || receipt.items.length === 0) return 'El recibo no tiene items';
  if (!receipt.totals || !receipt.totals.totalText) return 'El recibo no tiene total';
  return '';
};

class PrintBridgeServer {
  constructor({ configStore, printer }) {
    this.configStore = configStore;
    this.printer = printer;
    this.server = null;
  }

  start() {
    if (this.server) return;

    this.server = http.createServer(async (request, response) => {
      const config = this.configStore.get();

      if (request.method === 'OPTIONS') {
        sendJson(response, 204, {});
        return;
      }

      if (request.method === 'GET' && request.url === '/v1/status') {
        sendJson(response, 200, {
          ok: true,
          enabled: Boolean(config.server?.enabled),
          name: config.printer?.name || '',
          portPath: config.printer?.portPath || '',
          paperWidthMm: config.printer?.paperWidthMm || 80
        });
        return;
      }

      if (request.method !== 'POST' || request.url !== '/v1/print') {
        sendJson(response, 404, { ok: false, error: 'Ruta no encontrada' });
        return;
      }

      if (!config.server?.enabled) {
        sendJson(response, 503, { ok: false, error: 'Integracion web desactivada' });
        return;
      }

      if (!validateOrigin(config, request)) {
        sendJson(response, 403, { ok: false, error: 'Origen no autorizado' });
        return;
      }

      const token = request.headers['x-stocky-bridge-token'];
      if (!token || token !== config.auth?.token) {
        sendJson(response, 401, { ok: false, error: 'Token invalido' });
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const receiptError = validateReceipt(payload.receipt);
        if (receiptError) {
          sendJson(response, 422, { ok: false, error: receiptError });
          return;
        }

        const receipt = {
          ...payload.receipt,
          header: {
            ...(payload.receipt.header || {}),
            businessName: config.receipt?.businessName || payload.receipt.header?.businessName,
            alignment: config.receipt?.headerAlignment || payload.receipt.header?.alignment
          },
          footer: {
            ...(payload.receipt.footer || {}),
            message: config.receipt?.footerMessage || payload.receipt.footer?.message,
            alignment: config.receipt?.footerAlignment || payload.receipt.footer?.alignment
          }
        };

        if (config.receipt?.showVoluntaryTip) {
          const tipValue = Number(config.receipt?.voluntaryTipValue || 0);
          receipt.totals = {
            ...(receipt.totals || {}),
            voluntaryTip: tipValue,
            voluntaryTipText: `${tipValue.toLocaleString('es-CO')} COP`,
            total: Number(receipt.totals?.subtotal ?? receipt.totals?.total ?? 0) + tipValue,
            totalText: `${(Number(receipt.totals?.subtotal ?? receipt.totals?.total ?? 0) + tipValue).toLocaleString('es-CO')} COP`
          };
        }

        const buffer = serializeReceipt({
          receipt,
          paperWidthMm: payload.paperWidthMm || config.printer?.paperWidthMm
        });

        await this.printer.printBuffer({
          portPath: config.printer?.portPath,
          baudRate: config.printer?.baudRate,
          buffer
        });

        sendJson(response, 200, { ok: true });
      } catch (err) {
        sendJson(response, 500, { ok: false, error: err?.message || String(err) });
      }
    });

    const port = Number(this.configStore.get().server?.port || 41780);
    this.server.listen(port, '127.0.0.1');
  }

  stop() {
    if (!this.server) return;
    this.server.close();
    this.server = null;
  }
}

module.exports = { PrintBridgeServer };
