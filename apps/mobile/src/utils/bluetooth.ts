import { Alert, Linking, Platform } from 'react-native';
import BluetoothClassic from 'react-native-bluetooth-classic';

export const BLUETOOTH_PRINT_REQUIRED_MESSAGE =
  'Para imprimir necesitas activar el Bluetooth y conectar una impresora termica.';

export async function isBluetoothEnabled(): Promise<boolean> {
  try {
    if (!BluetoothClassic) return false;
    return await BluetoothClassic.isBluetoothEnabled();
  } catch (error) {
    console.error('[BT] isBluetoothEnabled failed:', error);
    return false;
  }
}

export async function ensureBluetoothEnabled(): Promise<boolean> {
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
