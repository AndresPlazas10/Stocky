import { useTranslation } from 'react-i18next';
import type { MesaLockState, MesaBroadcastState, MesaLockResult } from '@/types/mesas';
import { useMesaLoader } from './useMesaLoader';
import { useMesaItems } from './useMesaItems';
import { useMesaOpen } from './useMesaOpen';
import { useMesaClose } from './useMesaClose';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
interface UseMesaOrderOperationsParams {
  businessId: string;
  setMesas: SetState<any[]>;
  setLoading: SetState<boolean>;
  selectedMesa: any;
  setSelectedMesa: SetState<any>;
  setShowOrderDetails: SetState<boolean>;
  orderItems: any[];
  setOrderItems: SetState<any[]>;
  setPendingQuantityUpdatesSafe: SetState<any>;
  pendingQuantityUpdatesRef: React.MutableRefObject<Record<string, number>>;
  orderItemsDirtyRef: React.MutableRefObject<boolean>;
  orderItemsRef: React.MutableRefObject<any[]>;
  orderDetailsRequestRef: React.MutableRefObject<number>;
  pendingRemoteOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  orderTotalSyncQueueRef: React.MutableRefObject<Record<string, Promise<void>>>;
  lastSyncedOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  acquireMesaEditLockWeb: (params: { targetBusinessId: string; tableId: string; lockToken: string; lockOwnerName?: string | null }) => Promise<MesaLockResult>;
  resolveWebUserName: () => Promise<string>;
  publishMesaLockBroadcast: (params: { tableId: string; locked: boolean; mode: string; lockToken: string | null; lockOwnerName?: string | null }) => void;
  ensureCatalogWarmup: () => Promise<void>;
  isOfflineFirstRuntime: boolean;
  setMesaOpenDebugStage: (stage: string) => void;
  buildMesaOpenDebugTag: (error: unknown, mesa: any) => string;
  isCreatingTable: boolean;
  setIsCreatingTable: SetState<boolean>;
  newTableNumber: string;
  setNewTableNumber: SetState<string>;
  setModalOpenIntent: SetState<boolean>;
  setSearchProduct: SetState<string>;
  quantityToAdd: number;
  setQuantityToAdd: SetState<number>;
  getCurrentUser: () => Promise<{ id: string } | null>;
  currentUser: { id: string } | null;
  canManageTables: boolean;
  isEmployee: boolean;
  activeMesaBroadcastRef: React.MutableRefObject<MesaBroadcastState | null>;
  mesaSyncClientIdRef: React.MutableRefObject<string>;
  heldMesaLockRef: React.MutableRefObject<{ businessId: string; tableId: string; lockToken: string } | null>;
  getMesaLockState: (tableId: string) => MesaLockState | null;
  setShowAddForm: SetState<boolean>;
  isOpeningTableRef: React.MutableRefObject<boolean>;
  emptyReleaseInProgressRef: React.MutableRefObject<string | null>;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  dismissedCallsRef?: React.MutableRefObject<Map<string, number>> | null;
}

export function useMesaOrderOperations({
  businessId,
  setMesas,
  setLoading,
  selectedMesa,
  setSelectedMesa,
  setShowOrderDetails,
  orderItems,
  setOrderItems,
  setPendingQuantityUpdatesSafe,
  pendingQuantityUpdatesRef,
  orderItemsDirtyRef,
  orderItemsRef,
  orderDetailsRequestRef,
  pendingRemoteOrderTotalsRef,
  orderTotalSyncQueueRef,
  lastSyncedOrderTotalsRef,
  acquireMesaEditLockWeb,
  resolveWebUserName,
  publishMesaLockBroadcast,
  ensureCatalogWarmup,
  isOfflineFirstRuntime,
  setMesaOpenDebugStage,
  buildMesaOpenDebugTag,
  isCreatingTable,
  setIsCreatingTable,
  newTableNumber,
  setNewTableNumber,
  setModalOpenIntent,
  setSearchProduct,
  quantityToAdd,
  setQuantityToAdd,
  getCurrentUser,
  currentUser,
  canManageTables,
  isEmployee,
  activeMesaBroadcastRef,
  mesaSyncClientIdRef,
  heldMesaLockRef,
  getMesaLockState,
  setShowAddForm,
  isOpeningTableRef,
  emptyReleaseInProgressRef,
  showError,
  showSuccess,
  dismissedCallsRef = null,
}: UseMesaOrderOperationsParams) {
  const { t } = useTranslation(['mesas']);

  const { loadMesas, clearClosedMesaCache, handleCreateTable   } = useMesaLoader({
    businessId, setMesas, setLoading, showError, showSuccess, t,
    canManageTables, isEmployee, isCreatingTable, setIsCreatingTable,
    newTableNumber, setNewTableNumber, setShowAddForm,
    dismissedCallsRef,
  });

  const {
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    persistPendingQuantityUpdates,
    addCatalogItemToOrder,
    updateItemQuantity,
  } = useMesaItems({
    businessId, selectedMesa, orderItems, setOrderItems,
    setPendingQuantityUpdatesSafe, pendingQuantityUpdatesRef,
    orderItemsRef, orderItemsDirtyRef,
    pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef, orderTotalSyncQueueRef,
    showError, t, isOfflineFirstRuntime, quantityToAdd,
    setSearchProduct, setQuantityToAdd, setMesas,
  });

  const {
    loadOrderDetails,
    handleOpenTable,
  } = useMesaOpen({
    businessId, currentUser, getCurrentUser, setMesas, setSelectedMesa,
    orderItemsDirtyRef, orderItemsRef, setOrderItems,
    setPendingQuantityUpdatesSafe, setModalOpenIntent, setShowOrderDetails,
    isOfflineFirstRuntime, setMesaOpenDebugStage, buildMesaOpenDebugTag,
    isOpeningTableRef, pendingQuantityUpdatesRef, showError,
    acquireMesaEditLockWeb,
    resolveWebUserName,
    activeMesaBroadcastRef, publishMesaLockBroadcast,
    mesaSyncClientIdRef, heldMesaLockRef, getMesaLockState,
    ensureCatalogWarmup, orderDetailsRequestRef,
    loadMesas,
  });

  const {
    releaseEmptyOrderAndCloseModal,
    handleRefreshOrder,
    handleCloseModal,
  } = useMesaClose({
    businessId, selectedMesa, currentUser,
    emptyReleaseInProgressRef,
    pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef,
    pendingQuantityUpdatesRef, orderItemsRef, orderItemsDirtyRef,
    setMesas, setShowOrderDetails, setModalOpenIntent,
    setSelectedMesa, setOrderItems, setSearchProduct,
    setPendingQuantityUpdatesSafe,
    showError, showSuccess,
    updateOrderTotal, loadMesas, clearClosedMesaCache,
    persistPendingQuantityUpdates,
  });

  return {
    handleCreateTable,
    loadMesas,
    clearClosedMesaCache,
    loadOrderDetails,
    handleOpenTable,
    addCatalogItemToOrder,
    updateItemQuantity,
    handleRefreshOrder,
    handleCloseModal,
    flushPendingRemoteOrderTotals,
  };
}
