import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import http from 'http';

const require = createRequire(import.meta.url);
const { serializeReceipt, PAPER_COLUMNS } = require('../apps/print-bridge-windows/src/escpos.cjs');
const { PrintBridgeServer } = require('../apps/print-bridge-windows/src/server.cjs');

const saleReceipt = {
  type: 'sale',
  header: { title: 'COMPROBANTE', businessName: 'Test', dateText: '01/01/2026', alignment: 'center' },
  metadata: [{ label: 'Vendedor', value: 'Empleado' }],
  itemsHeader: 'Producto       Cant.      Total',
  items: [{ name: 'Producto A', quantity: 2, subtotalText: '$10.000' }],
  totals: { voluntaryTip: 0, voluntaryTipText: '$0', total: 10000, totalText: '$10.000' },
  payment: { methodText: 'Efectivo' },
  footer: { message: 'Gracias', alignment: 'center' },
};

const kitchenReceipt = {
  type: 'kitchen',
  header: { title: 'ORDEN DE COCINA', businessName: 'Sistema Stocky', dateText: '01/01/2026', alignment: 'center' },
  metadata: [
    { label: 'Mesa', value: '#5' },
    { label: 'Estado', value: 'Ocupada' },
  ],
  itemsHeader: 'Producto       Cant.',
  items: [{ name: 'Bandeja paisa', quantity: 2, subtotalText: '' }],
  footer: { message: '*** ORDEN PARA COCINA ***', alignment: 'center' },
};

describe('Windows bridge escpos serializer', () => {
  it('supports 58/80/104mm column widths', () => {
    expect(PAPER_COLUMNS).toEqual({ 58: 32, 80: 48, 104: 64 });
  });

  it('serializes a sale receipt to ESC/POS bytes', () => {
    const buffer = serializeReceipt({ receipt: saleReceipt, paperWidthMm: 80 });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer[0]).toBe(0x1b); // ESC
    expect(buffer[1]).toBe(0x40); // @ init
    expect(buffer.toString('ascii')).toContain('COMPROBANTE');
    expect(buffer.toString('ascii')).toContain('Producto A');
    expect(buffer.toString('ascii')).toContain('$10.000');
  });

  it('serializes a kitchen receipt to ESC/POS bytes without totals', () => {
    const buffer = serializeReceipt({ receipt: kitchenReceipt, paperWidthMm: 80 });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer[0]).toBe(0x1b);
    expect(buffer[1]).toBe(0x40);
    const text = buffer.toString('ascii');
    expect(text).toContain('ORDEN DE COCINA');
    expect(text).toContain('Mesa');
    expect(text).toContain('#5');
    expect(text).toContain('Bandeja paisa');
    expect(text).toContain('x2');
    expect(text).not.toContain('TOTAL');
  });

  it('strips accents and unsupported characters for the printer', () => {
    const buffer = serializeReceipt({
      receipt: { ...saleReceipt, items: [{ name: 'Café con leche áéíóú', quantity: 1, subtotalText: '$5.000' }] },
      paperWidthMm: 58,
    });
    const text = buffer.toString('ascii');
    expect(text).toContain('Cafe con leche');
    expect(text).not.toContain('é');
  });

  it('throws for unsupported receipt types', () => {
    expect(() => serializeReceipt({ receipt: { type: 'unknown', items: [] }, paperWidthMm: 80 }))
      .toThrow('Tipo de recibo no soportado');
  });
});

describe('Windows bridge HTTP server', () => {
  const buildConfig = (overrides = {}) => ({
    server: {
      port: 0,
      enabled: true,
      allowedOrigins: ['http://localhost:5173', 'https://stockypos.app'],
      ...(overrides.server || {}),
    },
    printer: { name: 'XP-58', portPath: 'COM3', baudRate: 9600, paperWidthMm: 80 },
    receipt: {
      businessName: 'Sistema Stocky',
      footerMessage: 'Gracias por su compra',
      headerAlignment: 'center',
      footerAlignment: 'center',
      showVoluntaryTip: false,
      voluntaryTipValue: 0,
    },
    auth: { token: 'secret-token' },
  });

  const startServer = async (config) => {
    const printed = [];
    const configStore = {
      get: () => config,
    };
    const printer = {
      printBuffer: async ({ buffer }) => { printed.push(buffer); },
    };
    const bridge = new PrintBridgeServer({ configStore, printer });
    bridge.start();
    await new Promise((resolve) => bridge.server.once('listening', resolve));
    const port = bridge.server.address().port;
    return { bridge, printer, printed, port };
  };

  const post = (port, path, body, headers = {}) => new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      agent: false,
      headers: { 'Content-Type': 'application/json', ...headers },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} }));
    });
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });

  it('rejects a kitchen receipt when disabled', async () => {
    const config = buildConfig({ server: { port: 0, enabled: false } });
    const { bridge, port } = await startServer(config);
    try {
      const res = await post(port, '/v1/print', { receipt: kitchenReceipt }, {
        'X-Stocky-Bridge-Token': 'secret-token',
        'X-Stocky-Origin': 'http://localhost:5173',
      });
      expect(res.status).toBe(503);
    } finally {
      bridge.stop();
    }
  });

  it('rejects requests with a bad token', async () => {
    const { bridge, port } = await startServer(buildConfig());
    try {
      const res = await post(port, '/v1/print', { receipt: saleReceipt }, {
        'X-Stocky-Bridge-Token': 'wrong',
        'X-Stocky-Origin': 'http://localhost:5173',
      });
      expect(res.status).toBe(401);
    } finally {
      bridge.stop();
    }
  });

  it('rejects requests from unauthorized origins', async () => {
    const { bridge, port } = await startServer(buildConfig());
    try {
      const res = await post(port, '/v1/print', { receipt: saleReceipt }, {
        'X-Stocky-Bridge-Token': 'secret-token',
        'X-Stocky-Origin': 'https://evil.example',
      });
      expect(res.status).toBe(403);
    } finally {
      bridge.stop();
    }
  });

  it('prints a sale receipt', async () => {
    const { bridge, printed, port } = await startServer(buildConfig());
    try {
      const res = await post(port, '/v1/print', { source: 'stocky', paperWidthMm: 80, receipt: saleReceipt }, {
        'X-Stocky-Bridge-Token': 'secret-token',
        'X-Stocky-Origin': 'https://stockypos.app',
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(printed).toHaveLength(1);
      expect(printed[0].toString('ascii')).toContain('COMPROBANTE');
    } finally {
      bridge.stop();
    }
  });

  it('prints a kitchen receipt', async () => {
    const { bridge, printed, port } = await startServer(buildConfig());
    try {
      const res = await post(port, '/v1/print', { source: 'stocky', paperWidthMm: 80, receipt: kitchenReceipt }, {
        'X-Stocky-Bridge-Token': 'secret-token',
        'X-Stocky-Origin': 'http://localhost:5173',
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(printed).toHaveLength(1);
      expect(printed[0].toString('ascii')).toContain('ORDEN DE COCINA');
    } finally {
      bridge.stop();
    }
  });

  it('rejects a kitchen receipt without items', async () => {
    const { bridge, port } = await startServer(buildConfig());
    try {
      const res = await post(port, '/v1/print', {
        receipt: { ...kitchenReceipt, items: [] },
      }, {
        'X-Stocky-Bridge-Token': 'secret-token',
        'X-Stocky-Origin': 'http://localhost:5173',
      });
      expect(res.status).toBe(422);
    } finally {
      bridge.stop();
    }
  });

  it('accepts localhost origins in development', async () => {
    const { bridge, printed, port } = await startServer(buildConfig());
    try {
      const res = await post(port, '/v1/print', { receipt: saleReceipt }, {
        'X-Stocky-Bridge-Token': 'secret-token',
        'X-Stocky-Origin': 'http://localhost:5173',
      });
      expect(res.status).toBe(200);
      expect(printed).toHaveLength(1);
    } finally {
      bridge.stop();
    }
  });
});
