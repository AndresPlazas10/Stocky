import { useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import {
  fetchMesasByBusinessId,
  resolveBusinessContext,
  resolveMesaEditorDisplayName,
  type BusinessContext,
  type MesaRecord,
} from '../../../services/mesasService';
import { loadOpenOrderSnapshot, type MesaOrderItem } from '../../../services/mesaOrderService';
import { compareMesaTableIdentifiers } from '../utils/mesaHelpers';
import type { StoredCatalogSnapshot } from '../utils/catalogCache';

/* eslint-disable @typescript-eslint/no-explicit-any */

function resolveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return String(err.message || '').trim() || fallback;
  }
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
    const details = (err as { details?: unknown }).details;
    if (typeof details === 'string' && details.trim()) return details.trim();
  }
  if (typeof err === 'string' && err.trim()) return err.trim();
  return fallback;
}

type MesaEditLock = {
  table_id: string;
  business_id: string;
  lock_owner_user_id: string;
  lock_owner_name: string;
  lock_token: string | null;
  lock_expires_at: string | null;
  updated_at: string | null;
};

type UseMesaDataLoaderParams = {
  auth: {
    session: Session;
    businessContext?: BusinessContext | null;
    sessionDisplayName: string;
    actorDisplayName: string;
  };
  setters: {
    setContext: (ctx: BusinessContext | null) => void;
    setMesas: (v: MesaRecord[] | ((prev: MesaRecord[]) => MesaRecord[])) => void;
    setLoading: (v: boolean) => void;
    setError: (v: string | null) => void;
    setActorDisplayName: (v: string) => void;
    setCatalogItems: (v: any[]) => void;
  };
  lockOps: {
    setMesaLocksByTableId: React.Dispatch<React.SetStateAction<Record<string, MesaEditLock>>>;
    refreshMesaLocks: (businessId: string) => Promise<void>;
  };
  catalogOps: {
    ensureCatalogLoaded: (businessId: string) => Promise<any[]>;
    readCatalogFromStorage: (businessId: string) => Promise<StoredCatalogSnapshot | null>;
    catalogBusinessIdRef: React.MutableRefObject<string | null>;
    catalogUpdatedAtRef: React.MutableRefObject<number>;
    catalogItemsRef: React.MutableRefObject<any[]>;
  };
  broadcast: {
    publishMesaStateBroadcast: (mesa: MesaRecord, options?: Record<string, unknown>) => void;
    traceAsyncDuration: (label: string, start: number, data?: Record<string, unknown>) => void;
  };
  sharedRefs: {
    orderItemsCacheRef: React.MutableRefObject<Map<string, MesaOrderItem[]>>;
    mesasLengthRef: React.MutableRefObject<number>;
    hasLoadedOnceRef: React.MutableRefObject<boolean>;
    isPendingEmptyRelease?: (mesaId: string) => boolean;
  };
};

export function useMesaDataLoader({
  auth,
  setters,
  lockOps,
  catalogOps,
  broadcast,
  sharedRefs,
}: UseMesaDataLoaderParams) {
  const { session, businessContext, sessionDisplayName } = auth;
  const { setContext, setMesas, setLoading, setError, setActorDisplayName, setCatalogItems } = setters;
  const { setMesaLocksByTableId, refreshMesaLocks } = lockOps;
  const { ensureCatalogLoaded, readCatalogFromStorage, catalogBusinessIdRef, catalogUpdatedAtRef, catalogItemsRef } = catalogOps;
  const { publishMesaStateBroadcast, traceAsyncDuration } = broadcast;
  const { orderItemsCacheRef, mesasLengthRef, hasLoadedOnceRef, isPendingEmptyRelease } = sharedRefs;

  const { t } = useTranslation('mesas');

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
        setError(t('mesas:notFound'));
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
        .catch((err: unknown) => {
          if (__DEV__) console.warn('[mesas] resolve_editor_name_failed', (err as Error)?.message || err);
          setActorDisplayName(fallbackName);
        });
      if (catalogBusinessIdRef.current !== nextContext.businessId) {
        catalogBusinessIdRef.current = null;
        catalogUpdatedAtRef.current = 0;
        setCatalogItems([]);
        orderItemsCacheRef.current.clear();
      }
      void readCatalogFromStorage(nextContext.businessId)
        .then((cached) => {
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
        .catch((err: unknown) => {
          if (__DEV__) console.warn('[mesas] storage_read_catalog_failed', (err as Error)?.message || err);
        });
      void ensureCatalogLoaded(nextContext.businessId).catch((err: unknown) => {
        if (__DEV__) console.warn('[mesas] ensure_catalog_failed', (err as Error)?.message || err);
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
      setError(resolveErrorMessage(err, t('mesas:loadFailed')));
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
      if (isPendingEmptyRelease?.(mesaId)) return;

      const safeTotal = Number(total || 0);
      setMesas((prev: MesaRecord[]) =>
        prev.map((mesa: MesaRecord) => {
          if (mesa.id !== mesaId) return mesa;
          if (isPendingEmptyRelease?.(mesaId)) return mesa;

          const isCurrentlyAvailable =
            String(mesa.status || '')
              .trim()
              .toLowerCase() === 'available' && !mesa.current_order_id;

          // Never re-occupy an available/empty table with a $0 patch (empty save/open race).
          if (isCurrentlyAvailable && safeTotal <= 0.0001) {
            return mesa;
          }

          return {
            ...mesa,
            status: 'occupied',
            current_order_id: orderId,
            orders: {
              ...(mesa.orders || {}),
              id: orderId,
              total: safeTotal,
            },
          };
        }),
      );
    },
    [isPendingEmptyRelease, setMesas],
  );

  const patchMesaOrderNotes = useCallback(
    (mesaId: string, orderId: string, notes: string) => {
      const cleanNotes = String(notes || '').trim().slice(0, 500);
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
              notes: cleanNotes !== '' ? cleanNotes : undefined,
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
      if (isPendingEmptyRelease?.(normalizedMesaId)) return;

      const safeTotal = Number(total || 0);
      const safeUnits = Math.max(0, Math.floor(Number(units || 0)));
      if (safeTotal <= 0.0001 && safeUnits <= 0) return;

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
            total: safeTotal,
          },
        } as unknown as MesaRecord,
        {
          previousOrderId: normalizedOrderId,
          mode,
          orderUnits: safeUnits,
        },
      );
    },
    [isPendingEmptyRelease, publishMesaStateBroadcast],
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
    patchMesaOrderNotes,
    publishRealtimeOrderSummary,
    markMesaAsAvailableAfterSale,
  };
}
