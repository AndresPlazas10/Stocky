import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createOrderAndOccupyTable,
  createTable,
  deleteOrderAndReleaseTable,
  deleteOrderItemById,
  insertOrderItem,
  persistOrderItemQuantities,
  updateOrderItemQuantityById,
  updateOrderTotalById
} from '../../../data/commands/ordersCommands';
import {
  getOrderForRealtimeById,
  getOrderItemsByOrderId,
  getOrderWithItemsById,
  getTablesWithCurrentOrderByBusiness
} from '../../../data/queries/ordersQueries';
import {
  getAuthenticatedUser as getAuthenticatedUserFromOrders
} from '../../../data/queries/authQueries';
import {
  getMesaInUseMessage,
  ORDER_ITEMS_SELECT,
  ORDER_ITEM_TYPE,
  toFiniteNumber,
  getTotalProductUnits,
  calculateOrderItemsTotal,
  normalizeEntityId,
  mergeOrderItemsPreservingPosition,
  normalizeTableIdentifier,
  compareTableIdentifiers,
  applyPendingQuantities,
  areMesaArraysEquivalent,
  buildDiagnosticAlertMessage,
  sanitizeMesaOrderAssociation,
  reconcileTablesWithOpenOrders,
  reconcileClosedOrdersFromOutbox,
  isMesaLockExpired
} from './mesaHelpers';
import { isConnectivityError } from '../../../utils/connectivity';
import { normalizeTableRecord } from '../../../utils/tableStatus';
import {
  isOfflineMode,
  isOfflinePersistenceEnabled,
  readOfflineSnapshot,
  saveOfflineSnapshot
} from '../../../utils/offlineSnapshot.js';
import { invalidateOrderCache } from '../../../data/adapters/cacheInvalidation.js';
import { closeModalImmediate } from '../../../utils/closeModalImmediate';
import { logger } from '@/utils/logger';
import type { MesaRecord, OrderItem, OrderRecord, CatalogItem, MesaLockState, MesaBroadcastState, MesaLockResult } from '@/types/mesas';
import { useMesaLoader } from './useMesaLoader';
import { useMesaItems } from './useMesaItems';
import { useMesaOpen } from './useMesaOpen';
import { useMesaClose } from './useMesaClose';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
interface UseMesaOrderOperationsParams {
  businessId: string;
  _userRole: string;
  _mesas: any[];
  setMesas: SetState<any[]>;
  setLoading: SetState<boolean>;
  selectedMesa: any;
  setSelectedMesa: SetState<any>;
  _showOrderDetails: boolean;
  setShowOrderDetails: SetState<boolean>;
  orderItems: any[];
  setOrderItems: SetState<any[]>;
  setPendingQuantityUpdatesSafe: SetState<any>;
  _products: unknown[];
  _combos: unknown[];
  _catalogItems: unknown[];
  _productCatalogByIdRef: React.MutableRefObject<any>;
  _comboCatalogByIdRef: React.MutableRefObject<any>;
  pendingQuantityUpdatesRef: React.MutableRefObject<Record<string, number>>;
  orderItemsDirtyRef: React.MutableRefObject<boolean>;
  orderItemsRef: React.MutableRefObject<any[]>;
  _selectedMesaRef: React.MutableRefObject<any>;
  orderDetailsRequestRef: React.MutableRefObject<number>;
  pendingRemoteOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  orderTotalSyncQueueRef: React.MutableRefObject<Record<string, Promise<void>>>;
  lastSyncedOrderTotalsRef: React.MutableRefObject<Record<string, number>>;
  optimisticTempItemQuantitiesRef: React.MutableRefObject<Record<string, number>>;
  pendingOrderItemOpsRef: React.MutableRefObject<number>;
  _orderItemWriteQueueRef: React.MutableRefObject<unknown>;
  markOrderItemOpStarted: () => void;
  markOrderItemOpFinished: () => void;
  waitForPendingOrderItemOps: () => Promise<boolean>;
  enqueueOrderItemWrite: (itemId: string, writeFn: () => Promise<unknown>) => Promise<void>;
  acquireMesaEditLockWeb: (params: { targetBusinessId: string; tableId: string; lockToken: string }) => Promise<MesaLockResult>;
  selectMesaEditLockByTableId: (params: { businessId: string; tableId: string }) => Promise<Record<string, unknown> | null>;
  _releaseMesaEditLockWeb: unknown;
  _sendMesaSyncBroadcast: unknown;
  publishMesaLockBroadcast: (params: { tableId: string; locked: boolean; mode: string; lockToken: string | null }) => void;
  ensureCatalogWarmup: () => Promise<void>;
  isOfflineFirstRuntime: boolean;
  setMesaOpenDebugStage: (stage: string) => void;
  buildMesaOpenDebugTag: (error: unknown, mesa: any) => string;
  isCreatingTable: boolean;
  setIsCreatingTable: SetState<boolean>;
  newTableNumber: string;
  setNewTableNumber: SetState<string>;
  _modalOpenIntent: boolean;
  setModalOpenIntent: SetState<boolean>;
  _canShowOrderModal: boolean;
  setCanShowOrderModal: SetState<boolean>;
  _searchProduct: string;
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
  showAddForm: boolean;
  setShowAddForm: SetState<boolean>;
  isOpeningTableRef: React.MutableRefObject<boolean>;
  emptyReleaseInProgressRef: React.MutableRefObject<string | null>;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
}

export function useMesaOrderOperations({
  businessId,
  _userRole,
  _mesas,
  setMesas,
  setLoading,
  selectedMesa,
  setSelectedMesa,
  _showOrderDetails,
  setShowOrderDetails,
  orderItems,
  setOrderItems,
  setPendingQuantityUpdatesSafe,
  _products,
  _combos,
  _catalogItems,
  _productCatalogByIdRef,
  _comboCatalogByIdRef,
  pendingQuantityUpdatesRef,
  orderItemsDirtyRef,
  orderItemsRef,
  _selectedMesaRef,
  orderDetailsRequestRef,
  pendingRemoteOrderTotalsRef,
  orderTotalSyncQueueRef,
  lastSyncedOrderTotalsRef,
  optimisticTempItemQuantitiesRef,
  pendingOrderItemOpsRef,
  _orderItemWriteQueueRef,
  markOrderItemOpStarted,
  markOrderItemOpFinished,
  waitForPendingOrderItemOps,
  enqueueOrderItemWrite,
  acquireMesaEditLockWeb,
  selectMesaEditLockByTableId,
  _releaseMesaEditLockWeb,
  _sendMesaSyncBroadcast,
  publishMesaLockBroadcast,
  ensureCatalogWarmup,
  isOfflineFirstRuntime,
  setMesaOpenDebugStage,
  buildMesaOpenDebugTag,
  isCreatingTable,
  setIsCreatingTable,
  newTableNumber,
  setNewTableNumber,
  _modalOpenIntent,
  setModalOpenIntent,
  _canShowOrderModal,
  setCanShowOrderModal,
  _searchProduct,
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
    showAddForm,
    setShowAddForm,
    isOpeningTableRef,
    emptyReleaseInProgressRef,
    showError,
    showSuccess,
  }: UseMesaOrderOperationsParams) {
  const { t } = useTranslation(['mesas']);
  const pendingOrderItemOpsCountRef = pendingOrderItemOpsRef;

  const { loadMesas, clearClosedMesaCache, handleCreateTable   } = useMesaLoader({
    businessId, setMesas, setLoading, showError, showSuccess, t,
    canManageTables, isEmployee, isCreatingTable, setIsCreatingTable,
    newTableNumber, setNewTableNumber, setShowAddForm,
  });

  const {
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    persistPendingQuantityUpdates,
    removeItem,
    addCatalogItemToOrder,
    updateItemQuantity,
  } = useMesaItems({
    businessId, selectedMesa, orderItems, setOrderItems,
    setPendingQuantityUpdatesSafe, pendingQuantityUpdatesRef,
    orderItemsRef, orderItemsDirtyRef,
    optimisticTempItemQuantitiesRef, pendingOrderItemOpsRef,
    pendingRemoteOrderTotalsRef, lastSyncedOrderTotalsRef, orderTotalSyncQueueRef,
    markOrderItemOpStarted, markOrderItemOpFinished, enqueueOrderItemWrite,
    showError, t, isOfflineFirstRuntime, quantityToAdd,
    setSearchProduct, setQuantityToAdd, setMesas,
  });

  const {
    ensureCurrentUser,
    createNewOrder,
    loadOrderDetails,
    handleOpenTable,
  } = useMesaOpen({
    businessId, currentUser, getCurrentUser, setMesas, setSelectedMesa,
    orderItemsDirtyRef, orderItemsRef, setOrderItems,
    setPendingQuantityUpdatesSafe, setModalOpenIntent, setShowOrderDetails,
    isOfflineFirstRuntime, setMesaOpenDebugStage, buildMesaOpenDebugTag,
    isOpeningTableRef, pendingQuantityUpdatesRef, showError, t,
    acquireMesaEditLockWeb, selectMesaEditLockByTableId,
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
    setPendingQuantityUpdatesSafe, waitForPendingOrderItemOps,
    showError, showSuccess,
    updateOrderTotal, loadMesas, clearClosedMesaCache,
    persistPendingQuantityUpdates,
  });

  return {
    handleCreateTable,
    loadOrderDetails,
    handleOpenTable,
    addCatalogItemToOrder,
    updateItemQuantity,
    removeItem,
    handleRefreshOrder,
    handleCloseModal,
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    createNewOrder,
    releaseEmptyOrderAndCloseModal,
    loadMesas
  };
}
