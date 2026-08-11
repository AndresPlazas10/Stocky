import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const createLocalStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

const installLocalStorageMock = () => {
  Object.defineProperty(window, 'localStorage', { value: createLocalStorageMock(), configurable: true, writable: true });
};

const createFakePort = ({ vendorId = 0x1234, productId = 0x5678 } = {}) => {
  const written = [];
  const port = {
    isOpen: false,
    openedAt: 0,
    getInfo: () => ({ usbVendorId: vendorId, usbProductId: productId }),
    open: vi.fn(async () => {
      port.isOpen = true;
    }),
    close: vi.fn(async () => {
      port.isOpen = false;
    }),
      writer: {
        write: vi.fn(async (chunk) => {
          written.push(Array.from(chunk));
        }),
        releaseLock: vi.fn(),
      },
  };
  return { port, written };
};

const installSerial = (ports, requestPortImpl) => {
  const serial = {
    getPorts: vi.fn(async () => ports),
  };
  if (requestPortImpl) {
    serial.requestPort = vi.fn(requestPortImpl);
  }
  Object.defineProperty(navigator, 'serial', { value: serial, configurable: true });
  return serial;
};

describe('webSerialPrinterService', () => {
  let service;

  beforeEach(async () => {
    installLocalStorageMock();
    window.localStorage.clear();
    vi.resetModules();
    service = await import('../src/services/webSerialPrinterService');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('reports Web Serial availability', () => {
    expect(service.isWebSerialSupported()).toBe(false);
    installSerial([]);
    expect(service.isWebSerialSupported()).toBe(true);
  });

  it('scans and connects a printer via requestPort', async () => {
    const { port } = createFakePort();
    installSerial([], () => Promise.resolve(port));

    const result = await service.scanPrinter();

    expect(result.ok).toBe(true);
    expect(result.label).toContain('USB');
    expect(port.isOpen).toBe(true);
    expect(service.isPrinterConnected()).toBe(true);
    expect(window.localStorage.getItem('stocky_serial_printer_id')).toBe('1234:5678');
  });

  it('returns an error when the user cancels the picker', async () => {
    installSerial([], () => {
      const err = new Error('cancelled');
      err.name = 'NotFoundError';
      return Promise.reject(err);
    });

    const result = await service.scanPrinter();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('No se selecciono');
  });

  it('reconnects the saved printer without prompting', async () => {
    const { port } = createFakePort();
    installSerial([port]);
    window.localStorage.setItem('stocky_serial_printer_id', '1234:5678');

    const result = await service.connectPrinter();

    expect(result.ok).toBe(true);
    expect(port.open).toHaveBeenCalled();
    expect(service.isPrinterConnected()).toBe(true);
  });

  it('reports no printer when nothing is authorized', async () => {
    installSerial([]);
    const result = await service.connectPrinter();
    expect(result.ok).toBe(false);
  });

  it('prints bytes in 256-byte chunks with delays', async () => {
    const { port, written } = createFakePort();
    installSerial([port]);
    window.localStorage.setItem('stocky_serial_printer_id', '1234:5678');
    await service.connectPrinter();

    const data = new Uint8Array(700);
    data.fill(0x41);
    const result = await service.printBytes(data);

    expect(result.ok).toBe(true);
    expect(written.length).toBe(3);
    expect(written[0]).toHaveLength(256);
    expect(written[1]).toHaveLength(256);
    expect(written[2]).toHaveLength(188);
  });

  it('auto-reconnects before printing when the port was closed', async () => {
    const { port, written } = createFakePort();
    installSerial([port]);
    window.localStorage.setItem('stocky_serial_printer_id', '1234:5678');

    const result = await service.printBytes(new Uint8Array([0x1b, 0x40]));

    expect(result.ok).toBe(true);
    expect(port.open).toHaveBeenCalled();
    expect(written[0]).toEqual([0x1b, 0x40]);
  });

  it('fails when printing without a printer', async () => {
    installSerial([]);
    const result = await service.printBytes(new Uint8Array([0x1b, 0x40]));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('impresora');
  });

  it('disconnects and clears the saved printer', async () => {
    const { port } = createFakePort();
    installSerial([port]);
    window.localStorage.setItem('stocky_serial_printer_id', '1234:5678');
    await service.connectPrinter();

    await service.disconnectPrinter();

    expect(port.close).toHaveBeenCalled();
    expect(service.isPrinterConnected()).toBe(false);
    expect(window.localStorage.getItem('stocky_serial_printer_id')).toBe(null);
  });
});
