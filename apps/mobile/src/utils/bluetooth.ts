import { Alert, Linking, Platform } from 'react-native';

let BluetoothClassic: any = null;
try {
  BluetoothClassic = require('react-native-bluetooth-classic').default;
} catch {
  // Expo Go o módulo nativo no disponible
}

export const BLUETOOTH_PRINT_REQUIRED_MESSAGE =
  'Para imprimir necesitas activar el Bluetooth y conectar una impresora termica.';

export const BLUETOOTH_MODULE_UNAVAILABLE_MESSAGE =
  'La impresion Bluetooth no esta disponible en Expo Go. Usa una dev build para esta funcionalidad.';

export function isBluetoothModuleAvailable(): boolean {
  return !!BluetoothClassic;
}

export async function isBluetoothEnabled(): Promise<boolean> {
  try {
    if (!BluetoothClassic) return false;
    return await BluetoothClassic.isBluetoothEnabled();
  } catch (error) {
    if (__DEV__) console.error('[BT] isBluetoothEnabled failed:', error);
    return false;
  }
}

export async function ensureBluetoothEnabled(): Promise<boolean> {
  if (!BluetoothClassic) {
    if (__DEV__) console.warn('[BT] Bluetooth module not available (Expo Go?)');
    Alert.alert('Bluetooth no disponible', BLUETOOTH_MODULE_UNAVAILABLE_MESSAGE);
    return false;
  }

  const enabled = await isBluetoothEnabled();
  if (enabled) return true;

  return new Promise<boolean>((resolve) => {
    Alert.alert('Bluetooth desactivado', BLUETOOTH_PRINT_REQUIRED_MESSAGE, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      {
        text: 'Activar Bluetooth',
        onPress: async () => {
          if (Platform.OS === 'android') {
            try {
              if (!BluetoothClassic) {
                resolve(false);
                return;
              }
              const result = await BluetoothClassic.requestBluetoothEnabled();
              resolve(result);
            } catch {
              resolve(false);
            }
          } else {
            await Linking.openSettings();
            resolve(false);
          }
        },
      },
    ]);
  });
}
