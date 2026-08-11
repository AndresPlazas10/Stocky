const BAUD_RATE = 9600;
const CHUNK_SIZE = 256;
const CHUNK_DELAY_MS = 100;
const SAVED_PRINTER_KEY = 'stocky_serial_printer_id';

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface MinimalSerialPort {
  isOpen: boolean;
  open: (options?: { baudRate?: number }) => Promise<void>;
  close: () => Promise<void>;
  getInfo: () => SerialPortInfo;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
}

export interface PrinterConnectionResult {
  ok: boolean;
  error?: string;
  label?: string;
}

let activePort: MinimalSerialPort | null = null;

const getSerial = (): { requestPort?: () => Promise<MinimalSerialPort>; getPorts?: () => Promise<MinimalSerialPort[]> } | null => {
  if (typeof navigator === 'undefined' || !('serial' in navigator)) return null;
  return (navigator as unknown as { serial: { requestPort?: () => Promise<MinimalSerialPort>; getPorts?: () => Promise<MinimalSerialPort[]> } }).serial;
};

export const isWebSerialSupported = (): boolean => getSerial() !== null;

export const getSavedPrinterId = (): string => {
  try {
    return String(window.localStorage.getItem(SAVED_PRINTER_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const savePrinterId = (id: string): boolean => {
  try {
    window.localStorage.setItem(SAVED_PRINTER_KEY, String(id || '').trim());
    return true;
  } catch {
    return false;
  }
};

export const clearSavedPrinterId = (): boolean => {
  try {
    window.localStorage.removeItem(SAVED_PRINTER_KEY);
    return true;
  } catch {
    return false;
  }
};

const portLabel = (port: MinimalSerialPort): string => {
  try {
    const info = port.getInfo() || {};
    if (info.usbVendorId || info.usbProductId) {
      const vendor = info.usbVendorId?.toString(16).padStart(4, '0') || '????';
      const product = info.usbProductId?.toString(16).padStart(4, '0') || '????';
      return `USB-${vendor}:${product}`;
    }
  } catch {
    // fall through
  }
  return 'Impresora termica';
};

const isAlreadyOpenError = (err: unknown): boolean =>
  /already open/i.test(String((err as Error)?.message || ''));

const openWithTolerance = async (port: MinimalSerialPort): Promise<MinimalSerialPort | null> => {
  if (port.isOpen) return port;

  try {
    await port.open({ baudRate: BAUD_RATE });
    return port;
  } catch (err) {
    if (isAlreadyOpenError(err)) {
      return activePort || port;
    }
    throw err;
  }
};

export const getActivePort = (): MinimalSerialPort | null => activePort;

export const isPrinterConnected = (): boolean => Boolean(activePort?.isOpen);

export const scanPrinter = async (): Promise<PrinterConnectionResult> => {
  const serial = getSerial();
  if (!serial || !serial.requestPort) {
    return { ok: false, error: 'Web Serial no disponible. Usa Chrome o Edge.' };
  }

  try {
    const port = await serial.requestPort();
    const opened = await openWithTolerance(port);
    if (!opened) {
      return { ok: false, error: 'No se pudo conectar la impresora.' };
    }
    activePort = opened;

    const info = opened.getInfo() || {};
    const vendor = info.usbVendorId?.toString(16) || '';
    const product = info.usbProductId?.toString(16) || '';
    savePrinterId(`${vendor}:${product}`);

    return { ok: true, label: portLabel(opened) };
  } catch (err) {
    const name = (err as Error)?.name || '';
    if (name === 'NotFoundError') {
      return { ok: false, error: 'No se selecciono ninguna impresora.' };
    }
    return { ok: false, error: `No se pudo conectar la impresora: ${(err as Error)?.message || String(err)}` };
  }
};

const getSavedPort = async (): Promise<MinimalSerialPort | null> => {
  const serial = getSerial();
  if (!serial || !serial.getPorts) return null;

  try {
    const ports = await serial.getPorts();
    if (!Array.isArray(ports) || ports.length === 0) return null;

    const savedId = getSavedPrinterId();
    if (savedId) {
      const match = ports.find((port) => {
        const info = port.getInfo() || {};
        const vendor = info.usbVendorId?.toString(16) || '';
        const product = info.usbProductId?.toString(16) || '';
        return `${vendor}:${product}` === savedId;
      });
      if (match) return match;
    }

    return ports[0] || null;
  } catch {
    return null;
  }
};

export const connectPrinter = async (): Promise<PrinterConnectionResult> => {
  if (activePort) {
    const opened = await openWithTolerance(activePort);
    if (opened) {
      activePort = opened;
      return { ok: true, label: portLabel(opened) };
    }
    return { ok: false, error: 'No se pudo conectar la impresora.' };
  }

  const port = await getSavedPort();
  if (!port) {
    return { ok: false, error: 'No hay una impresora autorizada. Usa "Escanear impresora" primero.' };
  }

  try {
    const opened = await openWithTolerance(port);
    if (!opened) {
      return { ok: false, error: 'No se pudo conectar la impresora.' };
    }
    activePort = opened;
    return { ok: true, label: portLabel(opened) };
  } catch (err) {
    return { ok: false, error: `No se pudo conectar la impresora: ${(err as Error)?.message || String(err)}` };
  }
};

export const disconnectPrinter = async (): Promise<void> => {
  clearSavedPrinterId();
  if (!activePort) return;
  try {
    if (activePort.isOpen) await activePort.close();
  } catch {
    // best effort
  } finally {
    activePort = null;
  }
};

export const printBytes = async (
  data: Uint8Array,
): Promise<{ ok: boolean; error?: string }> => {
  let port = activePort;

  if (!port) {
    const reconnect = await connectPrinter();
    if (!reconnect.ok || !activePort) {
      return { ok: false, error: reconnect.error || 'No hay una impresora conectada. Ve a Configuracion > Impresora para conectar una.' };
    }
    port = activePort;
  }

  if (!port.isOpen) {
    const opened = await openWithTolerance(port);
    if (!opened) {
      return { ok: false, error: 'No se pudo conectar la impresora.' };
    }
    port = opened;
  }

  const writer = port.writer || (port.writable && port.writable.getWriter());
  if (!writer) {
    return { ok: false, error: 'La impresora no esta disponible para escribir.' };
  }

  try {
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.subarray(offset, offset + CHUNK_SIZE);
      await writer.write(chunk);
      if (offset + CHUNK_SIZE < data.length) {
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Error de impresion: ${(err as Error)?.message || String(err)}` };
  } finally {
    try {
      writer.releaseLock();
    } catch {
      // best effort
    }
  }
};
