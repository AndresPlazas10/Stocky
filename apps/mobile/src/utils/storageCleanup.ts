import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIXES = ['stocky:'];
const STORAGE_KEYS = ['stocky.mobile.last_business_id'];

export async function clearSensitiveStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const targets = keys.filter((key) => (
      STORAGE_KEYS.includes(key)
      || STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    ));
    if (targets.length > 0) {
      await AsyncStorage.multiRemove(targets);
    }
  } catch {
    // no-op
  }
}
