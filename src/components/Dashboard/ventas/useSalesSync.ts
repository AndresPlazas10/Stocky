import { useEffect } from 'react';
import { subscribeSalesSyncUpdates } from '@/data/commands/salesCommands';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '@/utils/offlineSnapshot';

export function useSalesSync(
  businessId: string,
  sales: any[],
  loading: boolean,
  setSales: (value: any[] | ((prev: any[]) => any[])) => void,
  setSelectedSale: (value: any | ((prev: any) => any)) => void,
) {
  useEffect(() => {
    const unsubscribe = subscribeSalesSyncUpdates((payload: any) => {
      const tempSaleId = String(payload?.tempSaleId || '').trim();
      const remoteSaleId = String(payload?.remoteSaleId || '').trim();
      const syncedAt = payload?.syncedAt || new Date().toISOString();
      const payloadBusinessId = String(payload?.businessId || '').trim();

      if (!tempSaleId || !remoteSaleId) return;
      if (payloadBusinessId && String(businessId || '').trim() && payloadBusinessId !== String(businessId || '').trim()) {
        return;
      }

      setSales((prevVentas: any[]) => {
        const list = Array.isArray(prevVentas) ? [...prevVentas] : [];
        const tempIndex = list.findIndex((sale) => String(sale?.id || '').trim() === tempSaleId);
        if (tempIndex < 0) return prevVentas;

        const remoteIndex = list.findIndex((sale) => String(sale?.id || '').trim() === remoteSaleId);
        if (remoteIndex >= 0 && remoteIndex !== tempIndex) {
          const tempSale = list[tempIndex] || {};
          const remoteSale = list[remoteIndex] || {};
          list[remoteIndex] = {
            ...tempSale,
            ...remoteSale,
            id: remoteSaleId,
            pending_sync: false,
            synced_at: syncedAt
          };
          list.splice(tempIndex, 1);
          return list;
        }

        list[tempIndex] = {
          ...(list[tempIndex] || {}),
          id: remoteSaleId,
          pending_sync: false,
          synced_at: syncedAt
        };
        return list;
      });

      setSelectedSale((prevSelected: any) => {
        if (!prevSelected) return prevSelected;
        const selectedId = String(prevSelected?.id || '').trim();
        if (selectedId !== tempSaleId) return prevSelected;
        return {
          ...prevSelected,
          id: remoteSaleId,
          pending_sync: false,
          synced_at: syncedAt
        };
      });
    });

    return () => { unsubscribe(); };
  }, [businessId, setSales, setSelectedSale]);

  useEffect(() => {
    if (!businessId || !Array.isArray(sales) || loading) return;

    const snapshotKey = `ventas.list:${businessId}`;
    if (sales.length === 0) {
      const offline = isOfflineMode();
      const existing = readOfflineSnapshot(snapshotKey, []);
      if (offline && Array.isArray(existing) && existing.length > 0) {
        return;
      }
    }

    saveOfflineSnapshot(snapshotKey, sales);
  }, [businessId, sales, loading]);
}
