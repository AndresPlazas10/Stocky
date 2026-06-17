import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MesaOrderCatalogItem } from '../../../services/mesaOrderService';

export const CATALOG_LOCAL_TTL_MS = 180_000;
export const CATALOG_STORAGE_PREFIX = 'stocky:mesa-catalog:';

type StoredCatalogSnapshot = {
  cachedAt: number;
  items: MesaOrderCatalogItem[];
};

export async function readCatalogFromStorage(
  businessId: string,
): Promise<StoredCatalogSnapshot | null> {
  const storageKey = `${CATALOG_STORAGE_PREFIX}${businessId}`;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCatalogSnapshot;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    const cachedAt = Number(parsed.cachedAt || 0);
    return {
      cachedAt: Number.isFinite(cachedAt) ? cachedAt : 0,
      items: parsed.items,
    };
  } catch {
    return null;
  }
}

export async function writeCatalogToStorage(businessId: string, items: MesaOrderCatalogItem[]) {
  const storageKey = `${CATALOG_STORAGE_PREFIX}${businessId}`;
  const payload: StoredCatalogSnapshot = {
    cachedAt: Date.now(),
    items,
  };
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // no-op
  }
}
