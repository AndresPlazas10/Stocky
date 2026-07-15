import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

let BluetoothClassic: any = null;
try {
  BluetoothClassic = require('react-native-bluetooth-classic').default;
} catch {
  // Expo Go o módulo nativo no disponible
}

const PRINTER_KEY = 'stocky_bt_printer';
const CHUNK_SIZE = 256; // PT-210 y similares funcionan mejor con chunks pequenos
const CHUNK_DELAY_MS = 100;
const CONNECT_DELAY_MS = 300;
const MAX_RETRIES = 2;

export interface BluetoothDevice {
  address: string;
  name: string;
  paired?: boolean;
}

export interface PrinterConfig {
  address: string;
  name: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkBluetoothModule(): string | null {
  if (!BluetoothClassic) {
    return 'El modulo Bluetooth nativo no esta disponible. Usa una dev build de EAS generada despues de instalar react-native-bluetooth-classic.';
  }
  return null;
}

export async function getSavedPrinter(): Promise<PrinterConfig | null> {
  try {
    const json = await AsyncStorage.getItem(PRINTER_KEY);
    if (!json) return null;
    return JSON.parse(json) as PrinterConfig;
  } catch (error) {
    if (__DEV__) console.error('[BT Printer] getSavedPrinter failed:', error);
    return null;
  }
}

export async function savePrinter(config: PrinterConfig): Promise<void> {
  await AsyncStorage.setItem(PRINTER_KEY, JSON.stringify(config));
}

export async function clearPrinter(): Promise<void> {
  await AsyncStorage.removeItem(PRINTER_KEY);
}

export async function getPairedDevices(): Promise<BluetoothDevice[]> {
  const moduleError = checkBluetoothModule();
  if (moduleError) {
    if (__DEV__) console.error('[BT Printer] getPairedDevices:', moduleError);
    return [];
  }
  try {
    const paired = await BluetoothClassic.getBondedDevices();
    return paired.map((d: { address: string; name: string }) => ({
      address: d.address,
      name: d.name || 'Impresora Bluetooth',
      paired: true,
    }));
  } catch (error) {
    if (__DEV__) console.error('[BT Printer] getPairedDevices failed:', error);
    return [];
  }
}

export async function startDiscovery(): Promise<BluetoothDevice[]> {
  const moduleError = checkBluetoothModule();
  if (moduleError) {
    if (__DEV__) console.error('[BT Printer] startDiscovery:', moduleError);
    return [];
  }
  try {
    const devices = await BluetoothClassic.startDiscovery();
    const mapped: BluetoothDevice[] = [];
    for (const d of devices) {
      if (d.name || d.address) {
        mapped.push({
          address: d.address,
          name: d.name || 'Dispositivo desconocido',
        });
      }
    }
    return mapped;
  } catch (error) {
    if (__DEV__) console.error('[BT Printer] startDiscovery failed:', error);
    return [];
  }
}

export async function cancelDiscovery(): Promise<void> {
  try {
    await BluetoothClassic.cancelDiscovery();
  } catch (error) {
    if (__DEV__) console.error('[BT Printer] cancelDiscovery failed:', error);
  }
}

export async function connectToPrinter(address: string): Promise<boolean> {
  const moduleError = checkBluetoothModule();
  if (moduleError) {
    if (__DEV__) console.error('[BT Printer] connectToPrinter:', moduleError);
    return false;
  }
  try {
    await BluetoothClassic.cancelDiscovery();
  } catch (error) {
    if (__DEV__) console.error('[BT Printer] cancelDiscovery before connect failed:', error);
  }

  // Desconectar primero para evitar sockets RFCOMM duplicados
  try {
    await BluetoothClassic.disconnectFromDevice(address);
    if (__DEV__) console.warn('[BT Printer] Pre-connect disconnect OK for', address);
  } catch (error) {
    // Es normal que falle si no habia conexion previa
    if (__DEV__) console.warn('[BT Printer] Pre-connect disconnect skipped/failed:', error);
  }

  await delay(CONNECT_DELAY_MS);

  // Intentar conexión segura (las impresoras térmicas suelen usar conexión secure)
  try {
    await BluetoothClassic.connectToDevice(address, {
      connectorType: 'rfcomm',
      secure: true,
    });
    if (__DEV__) console.warn('[BT Printer] Connected (secure) to', address);
    await delay(CONNECT_DELAY_MS);
    return true;
  } catch (secureError) {
    if (__DEV__) console.error('[BT Printer] connectToDevice (secure) failed:', secureError);
    return false;
  }
}

export async function disconnectFromPrinter(address: string): Promise<void> {
  try {
    await BluetoothClassic.disconnectFromDevice(address);
  } catch (error) {
    if (__DEV__) console.error('[BT Printer] disconnectFromPrinter failed:', error);
  }
}

export type PrintResult = { ok: true } | { ok: false; error: string };

export async function printBytes(address: string, data: Uint8Array): Promise<PrintResult> {
  const moduleError = checkBluetoothModule();
  if (moduleError) {
    if (__DEV__) console.error('[BT Printer] printBytes:', moduleError);
    return { ok: false, error: moduleError };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        if (__DEV__) console.warn(`[BT Printer] Retry attempt ${attempt}`);
        await delay(1000);
      }

      const connected = await BluetoothClassic.isDeviceConnected(address);
      if (__DEV__) console.warn(`[BT Printer] isDeviceConnected(${address}) = ${connected}`);
      if (!connected) {
        if (__DEV__) console.warn('[BT Printer] Device not connected, attempting reconnect...');
        const reconnected = await connectToPrinter(address);
        if (!reconnected) {
          if (__DEV__) console.error('[BT Printer] Reconnection failed');
          return {
            ok: false,
            error:
              'La impresora parece estar apagada o fuera de rango. Verifica que esté encendida y cerca.',
          };
        }
      }

      // Algunas librerias de RN prefieren Buffer construido desde el ArrayBuffer subyacente
      const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      if (__DEV__)
        console.warn(
          `[BT Printer] Writing ${buffer.length} bytes to ${address} (chunkSize=${CHUNK_SIZE})`,
        );

      if (buffer.length <= CHUNK_SIZE) {
        await BluetoothClassic.writeToDevice(address, buffer);
      } else {
        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          const end = Math.min(offset + CHUNK_SIZE, buffer.length);
          const chunk = buffer.subarray(offset, end);
          if (__DEV__) console.warn(`[BT Printer] Writing chunk ${offset}-${end}`);
          await BluetoothClassic.writeToDevice(address, chunk);
          if (end < buffer.length) {
            await delay(CHUNK_DELAY_MS);
          }
        }
      }

      if (__DEV__) console.warn('[BT Printer] Write OK');
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (__DEV__)
        console.error(`[BT Printer] printBytes attempt ${attempt + 1} failed:`, message, error);
      if (attempt === MAX_RETRIES) {
        return { ok: false, error: message };
      }
    }
  }

  return { ok: false, error: 'No se pudo conectar ni enviar datos a la impresora.' };
}

export async function isPrinterConnected(address: string): Promise<boolean> {
  const moduleError = checkBluetoothModule();
  if (moduleError) {
    if (__DEV__) console.error('[BT Printer] isPrinterConnected:', moduleError);
    return false;
  }
  try {
    return await BluetoothClassic.isDeviceConnected(address);
  } catch (error) {
    if (__DEV__) console.error('[BT Printer] isPrinterConnected failed:', error);
    return false;
  }
}

/**
 * Connect → Print → Disconnect
 * Conecta a la impresora, envía los datos y desconecta inmediatamente.
 * Esto permite que múltiples dispositivos compartan la misma impresora
 * sin bloquearla con una conexión persistente.
 */
export async function connectPrintDisconnect(
  address: string,
  data: Uint8Array,
): Promise<PrintResult> {
  const moduleError = checkBluetoothModule();
  if (moduleError) {
    if (__DEV__) console.error('[BT Printer] connectPrintDisconnect:', moduleError);
    return { ok: false, error: moduleError };
  }

  if (__DEV__) console.warn('[BT Printer] connectPrintDisconnect: Connecting to', address);
  const connected = await connectToPrinter(address);
  if (!connected) {
    return {
      ok: false,
      error: 'Impresora ocupada, por favor intente de nuevo...',
    };
  }

  try {
    if (__DEV__) console.warn('[BT Printer] connectPrintDisconnect: Printing...');
    const result = await printBytes(address, data);
    return result;
  } finally {
    if (__DEV__) console.warn('[BT Printer] connectPrintDisconnect: Disconnecting...');
    await disconnectFromPrinter(address);
  }
}
