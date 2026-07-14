import { useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import {
  fetchMesasByBusinessId,
  resolveBusinessContext,
  resolveMesaEditorDisplayName,
  type BusinessContext,
  type MesaRecord,
} from '../../../services/mesasService';
import { loadOpenOrderSnapshot } from '../../../services/mesaOrderService';
import { compareMesaTableIdentifiers } from '../utils/mesaHelpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

type UseMesaDataLoaderParams = {
  session: Session;
  businessContext?: BusinessContext | null;
  sessionDisplayName: string;
  setContext: (ctx: BusinessContext | null) => void;
  setMesas: (v: MesaRecord[] | ((prev: MesaRecord[]) => MesaRecord[])) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setActorDisplayName: (v: string) => void;
  setCatalogItems: any;
  setMesaLocksByTableId: any;
  ensureCatalogLoaded: (businessId: string) => Promise<any[]>;
  publishMesaStateBroadcast: (mesa: MesaRecord, options?: Record<string, unknown>) => void;
  traceAsyncDuration: (label: string, start: number, data?: Record<string, unknown>) => void;
  readCatalogFromStorage: (businessId: string) => Promise<any>;
  refreshMesaLocks: (businessId: string) => Promise<void>;
  heldMesaLockRef: React.MutableRefObject<any>;
  releaseHeldMesaLock: (held?: any) => void;
  catalogBusinessIdRef: React.MutableRefObject<string | null>;
  catalogUpdatedAtRef: React.MutableRefObject<number>;
  catalogItemsRef: React.MutableRefObject<any[]>;
  orderItemsCacheRef: React.MutableRefObject<Map<string, any>>;
  mesasLengthRef: React.MutableRefObject<number>;
  hasLoadedOnceRef: React.MutableRefObject<boolean>;
  realtimeClientInstanceIdRef: React.MutableRefObject<string>;
  actorDisplayName: string;
};

export function useMesaDataLoader({
  session,
  businessContext,
  sessionDisplayName,
  setContext,
  setMesas,
  setLoading,
  setError,
  setActorDisplayName,
  setCatalogItems,
  setMesaLocksByTableId,
  ensureCatalogLoaded,
  publishMesaStateBroadcast,
  traceAsyncDuration,
  readCatalogFromStorage,
  refreshMesaLocks,
  heldMesaLockRef,
  releaseHeldMesaLock,
  catalogBusinessIdRef,
  catalogUpdatedAtRef,
  catalogItemsRef,
  orderItemsCacheRef,
  mesasLengthRef,
  hasLoadedOnceRef,
  realtimeClientInstanceIdRef,
  actorDisplayName,
}: UseMesaDataLoaderParams) {
  const { t } = useTranslation('mesas');
  const actorDisplayNameRef = useRef(actorDisplayName);
  actorDisplayNameRef.current = actorDisplayName;

  const loadData = useCallback(async () => {
    const shouldShowLoading = mesasLengthRef.current === 0 && !hasLoadedOnceRef.current;
    if (shouldShowLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const nextContext = businessContext?.businessId
        ? businessContext
        : await resolveBusinessContext(session.user.id);
      if (!nextContext?.businessId) {
        setContext(null);
        setMesas([]);
        setMesaLocksByTableId({});
        orderItemsCacheRef.current.clear();
        setError(t('mesas.notFound'));
        return;
      }

      setContext(nextContext);
      const fallbackName = sessionDisplayName;
      void resolveMesaEditorDisplayName({
        businessId: nextContext.businessId,
        userId: session.user.id,
        fallbackName,
      })
        .then((name: string) => {
          setActorDisplayName(name);
        })
        .catch(() => {
          setActorDisplayName(fallbackName);
        });
      if (catalogBusinessIdRef.current !== nextContext.businessId) {
        catalogBusinessIdRef.current = null;
        catalogUpdatedAtRef.current = 0;
        setCatalogItems([]);
        orderItemsCacheRef.current.clear();
      }
      void readCatalogFromStorage(nextContext.businessId)
        .then((cached: any) => {
          if (!cached) return;
          if (
            catalogBusinessIdRef.current === nextContext.businessId &&
            catalogItemsRef.current.length > 0
          ) {
            return;
          }
          catalogBusinessIdRef.current = nextContext.businessId;
          catalogUpdatedAtRef.current = cached.cachedAt || 0;
          setCatalogItems(cached.items);
        })
        .catch(() => {
          // no-op
        });
      void ensureCatalogLoaded(nextContext.businessId).catch(() => {
        // no-op: no bloquear carga de mesas por catalogo
      });

      const initialFetchStart = Date.now();
      const nextMesas = await fetchMesasByBusinessId(nextContext.businessId);
      traceAsyncDuration('initial_fetch_mesas', initialFetchStart, {
        businessId: nextContext.businessId,
        rows: Array.isArray(nextMesas) ? nextMesas.length : 0,
      });
      const sortedMesas = nextMesas.sort(compareMesaTableIdentifiers);
      setMesas(sortedMesas);
      void refreshMesaLocks(nextContext.businessId);

      // Pre-fetch order items for occupied tables in background
      const occupiedMesas = sortedMesas.filter(
        (m: MesaRecord) => m.status === 'occupied' && m.current_order_id,
      );
      for (const mesa of occupiedMesas) {
        void loadOpenOrderSnapshot(mesa.current_order_id!, { forceRefresh: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mesas.loadFailed'));
    } finally {
      hasLoadedOnceRef.current = true;
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  }, [
    businessContext,
    catalogBusinessIdRef,
    catalogItemsRef,
    catalogUpdatedAtRef,
    ensureCatalogLoaded,
    orderItemsCacheRef,
    session.user.id,
    sessionDisplayName,
    setCatalogItems,
    setContext,
    setError,
    setLoading,
    setMesaLocksByTableId,
    setMesas,
    setActorDisplayName,
    traceAsyncDuration,
    t,
    mesasLengthRef,
    hasLoadedOnceRef,
    readCatalogFromStorage,
    refreshMesaLocks,
  ]);

  const patchMesaOrderTotal = useCallback(
    (mesaId: string, orderId: string, total: number) => {
      setMesas((prev: MesaRecord[]) =>
        prev.map((mesa: MesaRecord) => {
          if (mesa.id !== mesaId) return mesa;
          return {
            ...mesa,
            status: 'occupied',
            current_order_id: orderId,
            orders: {
              ...(mesa.orders || {}),
              id: orderId,
              total,
            },
          };
        }),
      );
    },
    [setMesas],
  );

  const publishRealtimeOrderSummary = useCallback(
    (
      mesa: MesaRecord | null | undefined,
      orderId: string,
      total: number,
      units: number,
      mode: 'optimistic' | 'confirmed' | 'rollback' = 'optimistic',
    ) => {
      const normalizedMesaId = String(mesa?.id || '').trim();
      const normalizedOrderId = String(orderId || '').trim();
      const normalizedBusinessId = String(mesa?.business_id || '').trim();
      if (!normalizedMesaId || !normalizedOrderId || !normalizedBusinessId) return;

      publishMesaStateBroadcast(
        {
          id: normalizedMesaId,
          business_id: normalizedBusinessId,
          status: 'occupied',
          current_order_id: normalizedOrderId,
          table_number: mesa?.table_number ?? null,
          table_name: mesa?.table_name ?? null,
          orders: {
            id: normalizedOrderId,
            status: 'open',
            total: Number(total || 0),
          },
        } as unknown as MesaRecord,
        {
          previousOrderId: normalizedOrderId,
          mode,
          orderUnits: Math.max(0, Math.floor(Number(units || 0))),
        },
      );
    },
    [publishMesaStateBroadcast],
  );

  const markMesaAsAvailableAfterSale = useCallback(
    (mesaId: string) => {
      let orderIdToClear = '';
      let mesaBusinessId = '';
      let mesaTableNumber: string | number | null | undefined = null;
      let mesaTableName: string | null | undefined = null;
      setMesas((prev: MesaRecord[]) => {
        const target = prev.find((mesa: MesaRecord) => mesa.id === mesaId) || null;
        orderIdToClear = String(target?.current_order_id || '').trim();
        mesaBusinessId = String(target?.business_id || '').trim();
        mesaTableNumber = target?.table_number;
        mesaTableName = target?.table_name;
        return prev.map((mesa: MesaRecord) =>
          mesa.id === mesaId
            ? {
                ...mesa,
                status: 'available',
                current_order_id: null,
                orders: null,
              }
            : mesa,
        );
      });
      if (orderIdToClear) {
        orderItemsCacheRef.current.delete(orderIdToClear);
      }

      publishMesaStateBroadcast(
        {
          id: mesaId,
          business_id: mesaBusinessId,
          status: 'available',
          current_order_id: null,
          table_number: mesaTableNumber ?? null,
          table_name: mesaTableName ?? null,
          orders: null,
        } as unknown as MesaRecord,
        {
          previousOrderId: orderIdToClear || null,
        },
      );
    },
    [orderItemsCacheRef, publishMesaStateBroadcast, setMesas],
  );

  return {
    loadData,
    patchMesaOrderTotal,
    publishRealtimeOrderSummary,
    markMesaAsAvailableAfterSale,
  };
}
