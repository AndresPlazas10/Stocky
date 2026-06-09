import AsyncStorage from '@react-native-async-storage/async-storage';
import BluetoothClassic from 'react-native-bluetooth-classic';

const PRINTER_KEY = 'stocky_bt_printer';

export interface BluetoothDevice {
  address: string;
  name: string;
  paired?: boolean;
}

export interface PrinterConfig {
  address: string;
  name: string;
}

export async function getSavedPrinter(): Promise<PrinterConfig | null> {
  try {
    const json = await AsyncStorage.getItem(PRINTER_KEY);
    if (!json) return null;
    return JSON.parse(json) as PrinterConfig;
  } catch {
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
  } catch {
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
  } catch {
    return [];
  }
}

export async function cancelDiscovery(): Promise<void> {
  try {
    await BluetoothClassic.cancelDiscovery();
  } catch {
    /* ignore */
  }
}

export async function connectToPrinter(address: string): Promise<boolean> {
  try {
    await BluetoothClassic.connectToDevice(address);
    return true;
  } catch {
    return false;
  }
}

export async function disconnectFromPrinter(address: string): Promise<void> {
  try {
    await BluetoothClassic.disconnectFromDevice(address);
  } catch {
    /* ignore */
  }
}

export async function printBytes(address: string, data: Uint8Array): Promise<boolean> {
  try {
    const connected = await BluetoothClassic.isDeviceConnected(address);
    if (!connected) {
      const reconnected = await connectToPrinter(address);
      if (!reconnected) return false;
    }
    const buffer = Buffer.from(data);
    await BluetoothClassic.writeToDevice(address, buffer);
    return true;
  } catch {
    return false;
  }
}

export async function isPrinterConnected(address: string): Promise<boolean> {
  try {
    return await BluetoothClassic.isDeviceConnected(address);
  } catch {
    return false;
  }
}
