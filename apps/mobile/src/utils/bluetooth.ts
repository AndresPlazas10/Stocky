import { Alert, Linking, Platform } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';

const bleManager = new BleManager();

export async function isBluetoothEnabled(): Promise<boolean> {
  try {
    const state = await bleManager.state();
    return state === State.PoweredOn;
  } catch {
    return false;
  }
}

export async function ensureBluetoothEnabled(): Promise<boolean> {
  const enabled = await isBluetoothEnabled();
  if (enabled) return true;

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Bluetooth desactivado',
      'Para imprimir necesitas activar el Bluetooth y conectar una impresora térmica.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Activar Bluetooth',
          onPress: async () => {
            if (Platform.OS === 'android') {
              try {
                await bleManager.enable();
                const state = await bleManager.state();
                resolve(state === State.PoweredOn);
              } catch {
                resolve(false);
              }
            } else {
              await Linking.openSettings();
              resolve(false);
            }
          },
        },
      ],
    );
  });
}
