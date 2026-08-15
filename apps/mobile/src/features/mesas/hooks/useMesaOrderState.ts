import { useCallback, useEffect, useDeferredValue, useMemo, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildCatalogLookup,
  calculateCashChange,
  calculateOrderTotal,
  evaluateOrderStockShortagesWithLookup,
  type MesaOrderCatalogItem,
  type MesaOrderItem,
} from '../../../services/mesaOrderService';
import { mesaDisplayName, type MesaRecord } from '../../../services/mesasService';
import type { PaymentMethod } from '../../../services/mesaCheckoutService';
import { onCatalogInvalidated } from '../../../utils/catalogEvents';
import {
  CATALOG_STORAGE_PREFIX,
  CATALOG_LOCAL_TTL_MS,
  writeCatalogToStorage,
} from '../utils/catalogCache';

// ---------------------------------------------------------------------------
// State & Action types
// ---------------------------------------------------------------------------

type OrderState = {
  showOrderModal: boolean;
  selectedMesa: MesaRecord | null;
  catalogItems: MesaOrderCatalogItem[];
  isCatalogLoading: boolean;
  orderItems: MesaOrderItem[];
  loadingOrder: boolean;
  orderModalError: string | null;
  searchCatalog: string;
  releasingEmptyOrder: boolean;
  isSavingOrder: boolean;
  showCloseOrderChoiceModal: boolean;
  showPaymentModal: boolean;
  showSplitBillModal: boolean;
  showPaymentMethodMenu: boolean;
  isClosingOrder: boolean;
  paymentMethod: PaymentMethod;
  amountReceived: string;
  hasPendingChanges: boolean;
};

type OrderAction =
  | { type: 'SET_FIELD'; key: keyof OrderState; value: OrderState[keyof OrderState] }
  | { type: 'SET_MULTIPLE'; patch: Partial<OrderState> };

const initialState: OrderState = {
  showOrderModal: false,
  selectedMesa: null,
  catalogItems: [],
  isCatalogLoading: false,
  orderItems: [],
  loadingOrder: false,
  orderModalError: null,
  searchCatalog: '',
  releasingEmptyOrder: false,
  isSavingOrder: false,
  showCloseOrderChoiceModal: false,
  showPaymentModal: false,
  showSplitBillModal: false,
  showPaymentMethodMenu: false,
  isClosingOrder: false,
  paymentMethod: 'cash',
  amountReceived: '',
  hasPendingChanges: false,
};

function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.key]: action.value };
    case 'SET_MULTIPLE':
      return { ...state, ...action.patch };
  }
}

// ---------------------------------------------------------------------------
// Pending quantity update type
// ---------------------------------------------------------------------------

type PendingQuantityUpdate = {
  orderId: string;
  itemId: string;
  quantity: number;
  price: number;
  total: number;
};

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

type UseMesaOrderStateParams = {
  listCatalogItems: (
    businessId: string,
    options?: { forceRefresh?: boolean },
  ) => Promise<MesaOrderCatalogItem[]>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMesaOrderState({ listCatalogItems }: UseMesaOrderStateParams) {
  const { t } = useTranslation('mesas');
  const [state, dispatch] = useReducer(orderReducer, initialState);

  // Stable setter wrappers that dispatch actions (backward compatible)
  const setShowOrderModal = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'showOrderModal', value: v }), []);
  const setSelectedMesa = useCallback((v: MesaRecord | null | ((prev: MesaRecord | null) => MesaRecord | null)) => {
    const resolved = typeof v === 'function' ? v(state.selectedMesa) : v;
    dispatch({ type: 'SET_FIELD', key: 'selectedMesa', value: resolved });
  }, [state.selectedMesa]);
  const setCatalogItems = useCallback((v: MesaOrderCatalogItem[]) => dispatch({ type: 'SET_FIELD', key: 'catalogItems', value: v }), []);
  const setIsCatalogLoading = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'isCatalogLoading', value: v }), []);
  const setOrderItems = useCallback((v: MesaOrderItem[] | ((prev: MesaOrderItem[]) => MesaOrderItem[])) => {
    if (typeof v === 'function') {
      dispatch({ type: 'SET_FIELD', key: 'orderItems', value: v(state.orderItems) });
    } else {
      dispatch({ type: 'SET_FIELD', key: 'orderItems', value: v });
    }
  }, [state.orderItems]);
  const setLoadingOrder = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'loadingOrder', value: v }), []);
  const setOrderModalError = useCallback((v: string | null) => dispatch({ type: 'SET_FIELD', key: 'orderModalError', value: v }), []);
  const setSearchCatalog = useCallback((v: string) => dispatch({ type: 'SET_FIELD', key: 'searchCatalog', value: v }), []);
  const setReleasingEmptyOrder = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'releasingEmptyOrder', value: v }), []);
  const setIsSavingOrder = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'isSavingOrder', value: v }), []);
  const setShowCloseOrderChoiceModal = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'showCloseOrderChoiceModal', value: v }), []);
  const setShowPaymentModal = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'showPaymentModal', value: v }), []);
  const setShowSplitBillModal = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'showSplitBillModal', value: v }), []);
  const setShowPaymentMethodMenu = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof v === 'function' ? v(state.showPaymentMethodMenu) : v;
    dispatch({ type: 'SET_FIELD', key: 'showPaymentMethodMenu', value: resolved });
  }, [state.showPaymentMethodMenu]);
  const setIsClosingOrder = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'isClosingOrder', value: v }), []);
  const setPaymentMethod = useCallback((v: PaymentMethod) => dispatch({ type: 'SET_FIELD', key: 'paymentMethod', value: v }), []);
  const setAmountReceived = useCallback((v: string) => dispatch({ type: 'SET_FIELD', key: 'amountReceived', value: v }), []);
  const setHasPendingChanges = useCallback((v: boolean) => dispatch({ type: 'SET_FIELD', key: 'hasPendingChanges', value: v }), []);

  // Refs (unchanged)
  const quantityFlushQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestOrderItemsRef = useRef<MesaOrderItem[]>([]);
  const orderItemsCacheRef = useRef(new Map<string, MesaOrderItem[]>());
  const catalogBusinessIdRef = useRef<string | null>(null);
  const catalogUpdatedAtRef = useRef(0);
  const catalogItemsRef = useRef<MesaOrderCatalogItem[]>([]);
  const catalogLoadPromiseRef = useRef<Promise<MesaOrderCatalogItem[]> | null>(null);
  const orderModalOpenIntentRef = useRef(false);
  const pendingQuantityUpdatesRef = useRef(new Map<string, PendingQuantityUpdate>());

  // Effects
  useEffect(() => {
    const unsubscribe = onCatalogInvalidated(() => {
      catalogUpdatedAtRef.current = 0;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    latestOrderItemsRef.current = state.orderItems;
  }, [state.orderItems]);

  useEffect(() => {
    catalogItemsRef.current = state.catalogItems;
  }, [state.catalogItems]);

  useEffect(() => {
    const orderId = String(state.selectedMesa?.current_order_id || '').trim();
    if (!orderId) return;
    orderItemsCacheRef.current.set(orderId, state.orderItems);
  }, [state.orderItems, state.selectedMesa?.current_order_id]);

  // Catalog loading (unchanged logic)
  const ensureCatalogLoaded = useCallback(
    async (businessId: string, options?: { forceRefresh?: boolean }) => {
      const normalizedBusinessId = String(businessId || '').trim();
      if (!normalizedBusinessId) return [] as MesaOrderCatalogItem[];
      const forceRefresh = options?.forceRefresh === true;
      const localCatalog = catalogItemsRef.current;

      const catalogAgeMs = Date.now() - Number(catalogUpdatedAtRef.current || 0);
      const hasLocalCatalogForBusiness =
        !forceRefresh &&
        catalogBusinessIdRef.current === normalizedBusinessId &&
        localCatalog.length > 0;

      if (hasLocalCatalogForBusiness && catalogAgeMs <= CATALOG_LOCAL_TTL_MS) {
        return localCatalog;
      }

      if (hasLocalCatalogForBusiness && catalogAgeMs > CATALOG_LOCAL_TTL_MS) {
        if (!catalogLoadPromiseRef.current) {
          setIsCatalogLoading(true);
          const refreshPromise = listCatalogItems(normalizedBusinessId, {
            forceRefresh: true,
          })
            .then((items) => {
              catalogBusinessIdRef.current = normalizedBusinessId;
              catalogUpdatedAtRef.current = Date.now();
              setCatalogItems(items);
              void writeCatalogToStorage(normalizedBusinessId, items);
              return items;
            })
            .finally(() => {
              catalogLoadPromiseRef.current = null;
              setIsCatalogLoading(false);
            });
          catalogLoadPromiseRef.current = refreshPromise;
        }
        return localCatalog;
      }

      if (catalogLoadPromiseRef.current) {
        return catalogLoadPromiseRef.current;
      }

      setIsCatalogLoading(true);
      const promise = listCatalogItems(
        normalizedBusinessId,
        forceRefresh ? { forceRefresh: true } : undefined,
      )
        .then((items) => {
          catalogBusinessIdRef.current = normalizedBusinessId;
          catalogUpdatedAtRef.current = Date.now();
          setCatalogItems(items);
          void writeCatalogToStorage(normalizedBusinessId, items);
          return items;
        })
        .finally(() => {
          catalogLoadPromiseRef.current = null;
          setIsCatalogLoading(false);
        });

      catalogLoadPromiseRef.current = promise;
      return promise;
    },
    [listCatalogItems, setCatalogItems, setIsCatalogLoading],
  );

  // Derived values
  const deferredSearch = useDeferredValue(state.searchCatalog);

  const filteredCatalog = useMemo(() => {
    const source = Array.isArray(state.catalogItems) ? state.catalogItems : [];
    const search = String(deferredSearch || '')
      .trim()
      .toLowerCase();

    if (!search) {
      return [];
    }

    return source
      .filter((item) => {
        const byName = String(item.name || '')
          .toLowerCase()
          .includes(search);
        return byName;
      })
      .slice(0, 80);
  }, [state.catalogItems, deferredSearch]);

  const catalogLookup = useMemo(() => buildCatalogLookup(state.catalogItems), [state.catalogItems]);

  const { insufficientItems, insufficientComboComponents } = useMemo(() => {
    if (state.loadingOrder) {
      return { insufficientItems: [], insufficientComboComponents: [] };
    }
    if (state.catalogItems.length === 0) {
      return { insufficientItems: [], insufficientComboComponents: [] };
    }
    return evaluateOrderStockShortagesWithLookup({
      orderItems: state.orderItems,
      lookup: catalogLookup,
    });
  }, [state.catalogItems.length, catalogLookup, state.loadingOrder, state.orderItems]);

  const getStockValidationMessage = useCallback(() => {
    if (insufficientItems.length > 0) {
      const first = insufficientItems[0];
      return `Stock insuficiente para "${first.product_name}" (disp: ${first.available_stock}, req: ${first.quantity}).`;
    }

    if (insufficientComboComponents.length > 0) {
      const first = insufficientComboComponents[0];
      return `Stock insuficiente para "${first.product_name}" (disp: ${first.available_stock}, req: ${first.required_quantity}).`;
    }

    return null;
  }, [insufficientComboComponents, insufficientItems]);

  const orderTotal = useMemo(() => calculateOrderTotal(state.orderItems), [state.orderItems]);

  const orderModalTitle = state.selectedMesa
    ? `${mesaDisplayName(state.selectedMesa, t('labels.table'))} - ${t('labels.orderDetails')}`
    : `${t('labels.table')} - ${t('labels.orderDetails')}`;

  const isOrderFlowActive =
    state.showOrderModal ||
    state.showCloseOrderChoiceModal ||
    state.showPaymentModal ||
    state.showSplitBillModal ||
    state.showPaymentMethodMenu;

  const cashChangeData = useMemo(() => {
    if (state.paymentMethod !== 'cash') return null;
    if (String(state.amountReceived || '').trim() === '')
      return {
        isValid: false,
        reason: 'empty' as const,
        change: 0,
        paid: 0,
      };
    return calculateCashChange(orderTotal, state.amountReceived);
  }, [state.amountReceived, orderTotal, state.paymentMethod]);

  // Return same interface as before (backward compatible)
  return {
    showOrderModal: state.showOrderModal,
    setShowOrderModal,
    selectedMesa: state.selectedMesa,
    setSelectedMesa,
    catalogItems: state.catalogItems,
    setCatalogItems,
    isCatalogLoading: state.isCatalogLoading,
    orderItems: state.orderItems,
    setOrderItems,
    loadingOrder: state.loadingOrder,
    setLoadingOrder,
    orderModalError: state.orderModalError,
    setOrderModalError,
    searchCatalog: state.searchCatalog,
    setSearchCatalog,
    releasingEmptyOrder: state.releasingEmptyOrder,
    setReleasingEmptyOrder,
    isSavingOrder: state.isSavingOrder,
    setIsSavingOrder,
    showCloseOrderChoiceModal: state.showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal,
    showPaymentModal: state.showPaymentModal,
    setShowPaymentModal,
    showSplitBillModal: state.showSplitBillModal,
    setShowSplitBillModal,
    showPaymentMethodMenu: state.showPaymentMethodMenu,
    setShowPaymentMethodMenu,
    isClosingOrder: state.isClosingOrder,
    setIsClosingOrder,
    paymentMethod: state.paymentMethod,
    setPaymentMethod,
    amountReceived: state.amountReceived,
    setAmountReceived,
    hasPendingChanges: state.hasPendingChanges,
    setHasPendingChanges,

    quantityFlushQueueRef,
    latestOrderItemsRef,
    orderItemsCacheRef,
    catalogBusinessIdRef,
    catalogUpdatedAtRef,
    catalogItemsRef,
    catalogLoadPromiseRef,
    orderModalOpenIntentRef,
    pendingQuantityUpdatesRef,

    filteredCatalog,
    insufficientItems,
    insufficientComboComponents,
    getStockValidationMessage,
    orderTotal,
    orderModalTitle,
    isOrderFlowActive,
    cashChangeData,

    ensureCatalogLoaded,
  };
}

export type UseMesaOrderStateReturn = ReturnType<typeof useMesaOrderState>;
