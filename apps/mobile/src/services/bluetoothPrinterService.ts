import AsyncStorage from '@react-native-async-storage/async-storage';
import BluetoothClassic from 'react-native-bluetooth-classic';

const PRINTER_KEY = 'stocky_bt_printer';
const CHUNK_SIZE = 512;
const CHUNK_DELAY_MS = 50;
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

export async function getSavedPrinter(): Promise<PrinterConfig | null> {
  try {
    const json = await AsyncStorage.getItem(PRINTER_KEY);
    if (!json) return null;
    return JSON.parse(json) as PrinterConfig;
  } catch (error) {
    console.error('[BT Printer] getSavedPrinter failed:', error);
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
  try {
    const paired = await BluetoothClassic.getBondedDevices();
    return paired.map((d: { address: string; name: string }) => ({
      address: d.address,
      name: d.name || 'Impresora Bluetooth',
      paired: true,
    }));
  } catch (error) {
    console.error('[BT Printer] getPairedDevices failed:', error);
    return [];
  }
}

export async function startDiscovery(): Promise<BluetoothDevice[]> {
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
    console.error('[BT Printer] startDiscovery failed:', error);
    return [];
  }
}

export async function cancelDiscovery(): Promise<void> {
  try {
    await BluetoothClassic.cancelDiscovery();
  } catch (error) {
    console.error('[BT Printer] cancelDiscovery failed:', error);
  }
}

export async function connectToPrinter(address: string): Promise<boolean> {
  try {
    await BluetoothClassic.cancelDiscovery();
  } catch (error) {
    console.error('[BT Printer] cancelDiscovery before connect failed:', error);
  }
  try {
    await BluetoothClassic.connectToDevice(address, {
      connectorType: 'rfcomm',
      secureSocket: false,
      connectionType: 'binary',
    });
    return true;
  } catch (error) {
    console.error('[BT Printer] connectToDevice (insecure) failed:', error);
    try {
      await BluetoothClassic.connectToDevice(address, {
        connectorType: 'rfcomm',
        secureSocket: true,
        connectionType: 'binary',
      });
      return true;
    } catch (error2) {
      console.error('[BT Printer] connectToDevice (secure fallback) failed:', error2);
      return false;
    }
  }
}

export async function disconnectFromPrinter(address: string): Promise<void> {
  try {
    await BluetoothClassic.disconnectFromDevice(address);
  } catch (error) {
    console.error('[BT Printer] disconnectFromPrinter failed:', error);
  }
}

export async function printBytes(address: string, data: Uint8Array): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[BT Printer] Retry attempt ${attempt}`);
        await delay(1000);
      }

      const connected = await BluetoothClassic.isDeviceConnected(address);
      if (!connected) {
        console.log('[BT Printer] Device not connected, attempting reconnect...');
        const reconnected = await connectToPrinter(address);
        if (!reconnected) {
          console.error('[BT Printer] Reconnection failed');
          continue;
        }
      }

      const buffer = Buffer.from(data);

      if (buffer.length <= CHUNK_SIZE) {
        await BluetoothClassic.writeToDevice(address, buffer);
      } else {
        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          const end = Math.min(offset + CHUNK_SIZE, buffer.length);
          const chunk = buffer.subarray(offset, end);
          await BluetoothClassic.writeToDevice(address, chunk);
          if (end < buffer.length) {
            await delay(CHUNK_DELAY_MS);
          }
        }
      }

      return true;
    } catch (error) {
      console.error(`[BT Printer] printBytes attempt ${attempt + 1} failed:`, error);
    }
  }
  return false;
}

export async function isPrinterConnected(address: string): Promise<boolean> {
  try {
    return await BluetoothClassic.isDeviceConnected(address);
  } catch (error) {
    console.error('[BT Printer] isPrinterConnected failed:', error);
    return false;
  }
}
