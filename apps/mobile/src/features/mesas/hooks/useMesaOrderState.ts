import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildCatalogLookup,
  calculateCashChange,
  calculateOrderTotal,
  evaluateOrderStockShortagesWithLookup,
  type ComboComponentShortage,
  type MesaOrderCatalogItem,
  type MesaOrderItem,
  type StockShortage,
} from '../../../services/mesaOrderService';
import { mesaDisplayName, type MesaRecord } from '../../../services/mesasService';
import type { PaymentMethod } from '../../../services/mesaCheckoutService';

const CATALOG_STORAGE_PREFIX = 'stocky:mesa-catalog:';
const CATALOG_LOCAL_TTL_MS = 180_000;

type StoredCatalogSnapshot = {
  cachedAt: number;
  items: MesaOrderCatalogItem[];
};

type PendingQuantityUpdate = {
  orderId: string;
  itemId: string;
  quantity: number;
  price: number;
  total: number;
};

type UseMesaOrderStateParams = {
  listCatalogItems: (
    businessId: string,
    options?: { forceRefresh?: boolean },
  ) => Promise<MesaOrderCatalogItem[]>;
};

async function writeCatalogToStorage(businessId: string, items: MesaOrderCatalogItem[]) {
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

export function useMesaOrderState({ listCatalogItems }: UseMesaOrderStateParams) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<MesaRecord | null>(null);
  const [catalogItems, setCatalogItems] = useState<MesaOrderCatalogItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<MesaOrderItem[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderModalError, setOrderModalError] = useState<string | null>(null);
  const [searchCatalog, setSearchCatalog] = useState('');
  const deferredSearch = useDeferredValue(searchCatalog);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mutatingOrderItemId, setMutatingOrderItemId] = useState<string | null>(null);
  const [releasingEmptyOrder, setReleasingEmptyOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [showCloseOrderChoiceModal, setShowCloseOrderChoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [showPaymentMethodMenu, setShowPaymentMethodMenu] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');

  const addCatalogQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestOrderItemsRef = useRef<MesaOrderItem[]>([]);
  const orderItemsCacheRef = useRef(new Map<string, MesaOrderItem[]>());
  const catalogBusinessIdRef = useRef<string | null>(null);
  const catalogUpdatedAtRef = useRef(0);
  const catalogItemsRef = useRef<MesaOrderCatalogItem[]>([]);
  const catalogLoadPromiseRef = useRef<Promise<MesaOrderCatalogItem[]> | null>(null);
  const orderModalOpenIntentRef = useRef(false);
  const pendingQuantityUpdatesRef = useRef(new Map<string, PendingQuantityUpdate>());
  const quantitySyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    [listCatalogItems],
  );

  const filteredCatalog = useMemo(() => {
    const source = Array.isArray(catalogItems) ? catalogItems : [];
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
  }, [catalogItems, deferredSearch]);

  const hasCatalogQuery = String(searchCatalog || '').trim().length > 0;

  const catalogLookup = useMemo(() => buildCatalogLookup(catalogItems), [catalogItems]);

  const { insufficientItems, insufficientComboComponents } = useMemo(() => {
    if (loadingOrder) {
      return { insufficientItems: [], insufficientComboComponents: [] };
    }
    if (catalogItems.length === 0) {
      return { insufficientItems: [], insufficientComboComponents: [] };
    }
    return evaluateOrderStockShortagesWithLookup({
      orderItems,
      lookup: catalogLookup,
    });
  }, [catalogItems.length, catalogLookup, loadingOrder, orderItems]);

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

  const orderTotal = useMemo(() => calculateOrderTotal(orderItems), [orderItems]);

  const orderModalTitle = selectedMesa
    ? `${mesaDisplayName(selectedMesa)} - Orden`
    : 'Mesa - Orden';

  const isOrderFlowActive =
    showOrderModal ||
    showCloseOrderChoiceModal ||
    showPaymentModal ||
    showSplitBillModal ||
    showPaymentMethodMenu;

  const cashChangeData = useMemo(() => {
    if (paymentMethod !== 'cash') return null;
    if (String(amountReceived || '').trim() === '')
      return {
        isValid: false,
        reason: 'empty' as const,
        change: 0,
        paid: 0,
      };
    return calculateCashChange(orderTotal, amountReceived);
  }, [amountReceived, orderTotal, paymentMethod]);

  return {
    showOrderModal,
    setShowOrderModal,
    selectedMesa,
    setSelectedMesa,
    catalogItems,
    setCatalogItems,
    isCatalogLoading,
    setIsCatalogLoading,
    orderItems,
    setOrderItems,
    loadingOrder,
    setLoadingOrder,
    orderModalError,
    setOrderModalError,
    searchCatalog,
    setSearchCatalog,
    deferredSearch,
    isSearchFocused,
    setIsSearchFocused,
    mutatingOrderItemId,
    setMutatingOrderItemId,
    releasingEmptyOrder,
    setReleasingEmptyOrder,
    isSavingOrder,
    setIsSavingOrder,
    showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal,
    showPaymentModal,
    setShowPaymentModal,
    showSplitBillModal,
    setShowSplitBillModal,
    showPaymentMethodMenu,
    setShowPaymentMethodMenu,
    isClosingOrder,
    setIsClosingOrder,
    paymentMethod,
    setPaymentMethod,
    amountReceived,
    setAmountReceived,

    addCatalogQueueRef,
    latestOrderItemsRef,
    orderItemsCacheRef,
    catalogBusinessIdRef,
    catalogUpdatedAtRef,
    catalogItemsRef,
    catalogLoadPromiseRef,
    orderModalOpenIntentRef,
    pendingQuantityUpdatesRef,
    quantitySyncTimerRef,

    filteredCatalog,
    hasCatalogQuery,
    catalogLookup,
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
