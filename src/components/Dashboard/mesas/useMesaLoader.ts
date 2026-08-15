import { useCallback } from 'react';
import { suppressDismissedCalls } from '@stocky/shared';
import { getTablesWithCurrentOrderByBusiness } from '@/data/queries/ordersQueries';
import { createTable } from '@/data/commands/ordersCommands';
import {
  normalizeEntityId,
  normalizeTableIdentifier,
  compareTableIdentifiers,
  areMesaArraysEquivalent,
  sanitizeMesaOrderAssociation,
  reconcileTablesWithOpenOrders,
} from './mesaHelpers';
import { normalizeTableRecord } from '@/utils/tableStatus';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '@/utils/offlineSnapshot';
import { invalidateOrderCache } from '@/data/adapters/cacheInvalidation';
import { logger } from '@/utils/logger';

interface UseMesaLoaderParams {
  businessId: string;
  setMesas: React.Dispatch<React.SetStateAction<any[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  t: (key: string, options?: any) => string;
  canManageTables: boolean;
  isEmployee: boolean;
  isCreatingTable: boolean;
  setIsCreatingTable: React.Dispatch<React.SetStateAction<boolean>>;
  newTableNumber: string;
  setNewTableNumber: React.Dispatch<React.SetStateAction<string>>;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  dismissedCallsRef?: React.MutableRefObject<Map<string, number>> | null;
}

export function useMesaLoader({
  businessId,
  setMesas,
  setLoading,
  showError,
  showSuccess,
  t,
  canManageTables,
  isEmployee,
  isCreatingTable,
  setIsCreatingTable,
  newTableNumber,
  setNewTableNumber,
  setShowAddForm,
  dismissedCallsRef = null,
}: UseMesaLoaderParams) {
  const normalizeMesaList = useCallback((mesas: any[]) => {
    return suppressDismissedCalls(
      (Array.isArray(mesas) ? mesas : [])
        .map(normalizeTableRecord)
        .sort(compareTableIdentifiers)
        .map(sanitizeMesaOrderAssociation)
        .sort(compareTableIdentifiers),
      dismissedCallsRef?.current,
    );
  }, [dismissedCallsRef]);

  const loadMesas = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `mesas.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      const withOpenOrders = await reconcileTablesWithOpenOrders({ mesas: offlineSnapshot, businessId });
      const sanitizedSnapshot = normalizeMesaList(withOpenOrders);
      setMesas(sanitizedSnapshot);
      saveOfflineSnapshot(offlineSnapshotKey, sanitizedSnapshot);
      return;
    }

    try {
      const data = await getTablesWithCurrentOrderByBusiness(businessId);
      const normalized = (Array.isArray(data) ? data : []).map(normalizeTableRecord).sort(compareTableIdentifiers);
      const hasLocalData = normalized.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        const withOpenOrdersFromSnapshot = await reconcileTablesWithOpenOrders({ mesas: offlineSnapshot, businessId });
        const sanitizedSnapshot = normalizeMesaList(withOpenOrdersFromSnapshot);
        setMesas((prev) => areMesaArraysEquivalent(prev, sanitizedSnapshot) ? prev : sanitizedSnapshot);
        saveOfflineSnapshot(offlineSnapshotKey, sanitizedSnapshot);
        return;
      }

      const withOpenOrders = offline ? await reconcileTablesWithOpenOrders({ mesas: normalized, businessId }) : normalized;
      const sanitizedMesas = normalizeMesaList(withOpenOrders);
      setMesas((prev) => areMesaArraysEquivalent(prev, sanitizedMesas) ? prev : sanitizedMesas);
      if (!offline || hasLocalData) saveOfflineSnapshot(offlineSnapshotKey, sanitizedMesas);
    } catch {
      const cached = readOfflineSnapshot(offlineSnapshotKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        const withOpenOrdersCached = await reconcileTablesWithOpenOrders({ mesas: cached, businessId });
        const sanitizedCached = normalizeMesaList(withOpenOrdersCached);
        setMesas((prev) => areMesaArraysEquivalent(prev, sanitizedCached) ? prev : sanitizedCached);
        saveOfflineSnapshot(offlineSnapshotKey, sanitizedCached);
        return;
      }
      if (offline) setMesas([]);
      else showError('Error', t('mesas:errors.loadTablesFailed'));
    } finally {
      setLoading(false);
    }
  }, [businessId, setMesas, showError, setLoading, t, normalizeMesaList]);

  const clearClosedMesaCache = useCallback(async ({ tableId, orderId = null }: { tableId?: string | null; orderId?: string | null } = {}) => {
    const normalizedTableId = normalizeEntityId(tableId);
    if (!businessId || !normalizedTableId) return;

    const snapshotKey = `mesas.list:${businessId}`;
    const cachedMesas = readOfflineSnapshot(snapshotKey, []);
    if (Array.isArray(cachedMesas) && cachedMesas.length > 0) {
      const sanitized = cachedMesas.map((mesa: any) => {
        if (normalizeEntityId(mesa?.id) !== normalizedTableId) return mesa;
        return normalizeTableRecord({ ...mesa, status: 'available', current_order_id: null, orders: null });
      });
      saveOfflineSnapshot(snapshotKey, sanitized);
    }

    invalidateOrderCache({ businessId, tableId: normalizedTableId, orderId }).catch((err: unknown) => { logger.warn('mesas:order_operations:invalidate_cache failed', err); });
  }, [businessId]);

  const handleCreateTable = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageTables || isEmployee) {
      setShowAddForm(false);
      showError('Error', t('mesas:errors.adminOnly'));
      return;
    }

    if (isCreatingTable) return;
    setIsCreatingTable(true);

    try {
      const tableIdentifier = normalizeTableIdentifier(newTableNumber);
      if (!tableIdentifier) throw new Error(t('mesas:errors.invalidIdentifier'));

      try {
        const createdTable = await createTable({ businessId, tableNumber: tableIdentifier });
        if (createdTable?.id) {
          const normalizedTable = normalizeTableRecord(createdTable as unknown as Parameters<typeof normalizeTableRecord>[0]);
          setMesas((prev) => {
            const exists = prev.some((table) => table.id === normalizedTable.id);
            if (exists) return prev;
            return [...prev, normalizedTable].sort(compareTableIdentifiers);
          });
        }
        if (!createdTable?.__localOnly) await loadMesas();
      } catch (error: unknown) {
        if ((error as { code?: string })?.code === '23505') throw new Error(t('mesas:errors.identifierExists'));
        throw error;
      }

      showSuccess(t('mesas:success.tableCreated'), `#${tableIdentifier}`);
      setNewTableNumber('');
      setShowAddForm(false);
    } catch (error: unknown) {
      showError('Error', (error as Error)?.message || t('mesas:errors.createFailed'));
    } finally {
      setIsCreatingTable(false);
    }
  }, [canManageTables, isEmployee, isCreatingTable, newTableNumber, businessId, loadMesas, setMesas, showError, showSuccess, setNewTableNumber, setShowAddForm, setIsCreatingTable, t]);

  return { loadMesas, clearClosedMesaCache, handleCreateTable };
}
