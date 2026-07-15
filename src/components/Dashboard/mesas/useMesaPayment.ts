import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { closeOrderAsSplit, closeOrderSingle } from '../../../services/ordersService.js';
import { getSalePrintBundle } from '../../../data/queries/ordersQueries';
import { getBusinessNameById } from '../../../data/queries/salesQueries';
import { printKitchenOrder } from '../../../utils/kitchenOrderPrint.js';
import { printSaleReceipt } from '../../../utils/saleReceiptPrint.js';
import { isAutoPrintReceiptEnabled } from '../../../utils/printer.js';
import { calcularCambio, parseCopAmount } from '../../../utils/cambio.js';
import { formatPrice } from '../../../utils/formatters';
import {
  toFiniteNumber,
  normalizeEntityId,
  calculateOrderItemsTotal,
  buildDiagnosticAlertMessage,
  getPaymentMethodLabel,
} from './mesaHelpers';
import {
  readOfflineSnapshot,
  saveOfflineSnapshot,
} from '../../../utils/offlineSnapshot.js';
import { invalidateOrderCache } from '../../../data/adapters/cacheInvalidation.js';
import { normalizeTableRecord } from '../../../utils/tableStatus';
import { logger } from '@/utils/logger';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

/* eslint-disable @typescript-eslint/no-explicit-any */
type MesaRecord = Record<string, any>;
type OrderItem = Record<string, any>;
type SaleRecord = Record<string, any>;
type SubAccount = Record<string, any>;
type PrintBundle = Record<string, any>;

const MODAL_REOPEN_GUARD_MS = 600;

function clearClosedMesaCache({ tableId, orderId = null, businessId }: { tableId: string; orderId?: string | null; businessId: string }) {
  const normalizedTableId = normalizeEntityId(tableId);
  if (!businessId || !normalizedTableId) return;

  const snapshotKey = `mesas.list:${businessId}`;
  const cachedMesas = readOfflineSnapshot(snapshotKey, []);
  if (Array.isArray(cachedMesas) && cachedMesas.length > 0) {
    const sanitized = cachedMesas.map((mesa: MesaRecord) => {
      if (normalizeEntityId(mesa?.id) !== normalizedTableId) return mesa;
      return normalizeTableRecord({
        ...mesa,
        status: 'available',
        current_order_id: null,
        orders: null
      } as any);
    });
    saveOfflineSnapshot(snapshotKey, sanitized);
  }

  invalidateOrderCache({
    businessId,
    tableId: normalizedTableId,
    orderId: normalizeEntityId(orderId)
  }).catch((err: Error) => { logger.warn('mesas:payment:invalidate_order_cache failed', err); });
}

function buildStockConsumptionFromItems(items: OrderItem[] = [], comboCatalogByIdRef: React.MutableRefObject<Map<string, any>>) {
  const consumptionByProduct = new Map<string, number>();
  const source = Array.isArray(items) ? items : [];

  source.forEach((item: OrderItem) => {
    const quantity = Number(item?.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    const productId = normalizeEntityId(item?.product_id || item?.products?.id);
    const comboId = normalizeEntityId(item?.combo_id || item?.combos?.id);

    if (productId) {
      const current = Number(consumptionByProduct.get(productId) || 0);
      consumptionByProduct.set(productId, current + quantity);
      return;
    }

    if (!comboId) return;
    const combo = comboCatalogByIdRef.current.get(comboId);
    if (!combo) return;

    (combo.combo_items || []).forEach((component: Record<string, any>) => {
      const componentProductId = normalizeEntityId(component?.producto_id);
      if (!componentProductId) return;

      const componentQuantity = Number(component?.cantidad || 0);
      if (!Number.isFinite(componentQuantity) || componentQuantity <= 0) return;

      const current = Number(consumptionByProduct.get(componentProductId) || 0);
      consumptionByProduct.set(componentProductId, current + (quantity * componentQuantity));
    });
  });

  return consumptionByProduct;
}

function applyLocalStockConsumption(consumptionByProduct: Map<string, number>, { mode = 'consume', businessId, setProducts }: { mode?: 'consume' | 'restore'; businessId: string; setProducts: SetState<any[]> }) {
  if (!(consumptionByProduct instanceof Map) || consumptionByProduct.size === 0) return;
  const shouldRestore = mode === 'restore';

  setProducts((prevProducts: any[]) => {
    const source = Array.isArray(prevProducts) ? prevProducts : [];
    const nextProducts = source.map((product: Record<string, any>) => {
      if (product?.manage_stock === false) return product;

      const productId = normalizeEntityId(product?.id);
      if (!productId) return product;

      const consumed = Number(consumptionByProduct.get(productId) || 0);
      if (!Number.isFinite(consumed) || consumed <= 0) return product;

      const currentStock = Number(product?.stock || 0);
      const safeCurrentStock = Number.isFinite(currentStock) ? currentStock : 0;

      const nextStock = shouldRestore
        ? safeCurrentStock + consumed
        : Math.max(0, safeCurrentStock - consumed);

      return {
        ...product,
        stock: nextStock
      };
    });

    if (businessId) {
      saveOfflineSnapshot(`mesas.productos:${businessId}`, nextProducts);
      saveOfflineSnapshot(`ventas.productos:${businessId}`, nextProducts);
      saveOfflineSnapshot(`inventario.productos:${businessId}`, nextProducts);
    }

    return nextProducts;
  });
}

function appendPendingSalesToVentasSnapshot(pendingSales: SaleRecord[] = [], businessId: string, t: (key: string) => string) {
  if (!businessId || !Array.isArray(pendingSales) || pendingSales.length === 0) return;

  const snapshotKey = `ventas.list:${businessId}`;
  const currentSnapshot = readOfflineSnapshot(snapshotKey, []);
  const currentList = Array.isArray(currentSnapshot) ? currentSnapshot : [];

  const normalizedPendingSales = pendingSales
    .map((sale: SaleRecord) => {
      const saleId = String(sale?.id || '').trim();
      if (!saleId) return null;

      const total = Number(sale?.total || 0);
      const amountReceived = Number(sale?.amount_received);
      const resolvedAmountReceived = Number.isFinite(amountReceived) ? amountReceived : null;
      const changeBreakdown = Array.isArray(sale?.change_breakdown) ? sale.change_breakdown : [];
      const changeFromBreakdown = changeBreakdown.reduce((sum: number, entry: Record<string, any>) => {
        const denomination = Number(entry?.denomination || 0);
        const count = Number(entry?.count || 0);
        if (!Number.isFinite(denomination) || !Number.isFinite(count) || count <= 0) return sum;
        return sum + (denomination * count);
      }, 0);
      const changeAmount = changeFromBreakdown > 0
        ? changeFromBreakdown
        : (resolvedAmountReceived !== null ? Math.max(resolvedAmountReceived - total, 0) : null);

      return {
        id: saleId,
        business_id: businessId,
        user_id: null,
        seller_name: t('mesas:defaults.offlineSale'),
        payment_method: sale?.payment_method || 'cash',
        total,
        created_at: sale?.created_at || new Date().toISOString(),
        notes: t('mesas:defaults.pendingSync'),
        pending_sync: true,
        amount_received: resolvedAmountReceived,
        change_amount: changeAmount,
        change_breakdown: changeBreakdown,
        employees: { full_name: t('mesas:defaults.pendingSyncShort'), role: 'employee' }
      };
    })
    .filter(Boolean);

  if (normalizedPendingSales.length === 0) return;

  const existingIds = new Set(currentList.map((sale: SaleRecord) => String(sale?.id || '').trim()).filter(Boolean));
  const newItems = normalizedPendingSales.filter((sale: SaleRecord) => !existingIds.has(String(sale.id || '').trim()));
  if (newItems.length === 0) return;

  saveOfflineSnapshot(snapshotKey, [...newItems, ...currentList]);
}

function mapOrderItemsToPrintDetails(items: OrderItem[] = []) {
  const source = Array.isArray(items) ? items : [];

  return source
    .map((item: OrderItem) => {
      const quantity = toFiniteNumber(item?.quantity, 0);
      if (quantity <= 0) return null;

      const unitPrice = toFiniteNumber(item?.unit_price ?? item?.price, 0);
      const subtotalValue = Number(item?.subtotal);
      const subtotal = Number.isFinite(subtotalValue)
        ? subtotalValue
        : (quantity * unitPrice);

      const productName = String(
        item?.products?.name
        || item?.product_name
        || item?.name
        || ''
      ).trim();
      const comboName = String(
        item?.combos?.nombre
        || item?.combos?.name
        || item?.combo_name
        || ''
      ).trim();

      return {
        quantity,
        unit_price: unitPrice,
        subtotal,
        products: productName ? { name: productName } : null,
        combos: comboName ? { nombre: comboName } : null,
        product_name: productName || comboName || 'Item'
      };
    })
    .filter(Boolean);
}

function buildLocalPrintBundle({
  saleId,
  total,
  paymentMethod,
  createdAt,
  amountReceived,
  changeBreakdown,
  orderItems,
  sellerName
}: {
  saleId: string;
  total: number;
  paymentMethod: string;
  createdAt: string;
  amountReceived: number | null;
  changeBreakdown: Record<string, any>[];
  orderItems: OrderItem[];
  sellerName?: string;
}) {
  const normalizedSaleId = String(saleId || '').trim();
  const saleDetails = mapOrderItemsToPrintDetails(orderItems);
  if (saleDetails.length === 0) return null;

  const fallbackSaleId = normalizedSaleId || `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    saleId: fallbackSaleId,
    saleRow: {
      id: fallbackSaleId,
      total: toFiniteNumber(total, 0),
      payment_method: paymentMethod || 'cash',
      created_at: createdAt || new Date().toISOString(),
      seller_name: sellerName,
      amount_received: Number.isFinite(Number(amountReceived)) ? Number(amountReceived) : null,
      change_breakdown: Array.isArray(changeBreakdown) ? changeBreakdown : []
    },
    saleDetails
  };
}

function buildLocalSplitPrintBundles({ saleIds = [], sales = [], subAccounts = [], t }: { saleIds?: string[]; sales?: SaleRecord[]; subAccounts?: SubAccount[]; t: (key: string) => string }) {
  const normalizedSaleIds = Array.isArray(saleIds) ? saleIds : [];
  const normalizedSales = Array.isArray(sales) ? sales : [];
  const normalizedSubAccounts = Array.isArray(subAccounts) ? subAccounts : [];

  return normalizedSubAccounts
    .map((subAccount: SubAccount, index: number) => {
      const items = Array.isArray(subAccount?.items) ? subAccount.items : [];
      if (items.length === 0) return null;

      const saleMeta = normalizedSales[index] || {};
      const resolvedSaleId = normalizedSaleIds[index] || saleMeta?.id || null;
      const saleTotalFromMeta = Number(saleMeta?.total);
      const saleTotal = Number.isFinite(saleTotalFromMeta)
        ? saleTotalFromMeta
        : items.reduce((sum: number, item: OrderItem) => {
          const quantity = toFiniteNumber(item?.quantity, 0);
          const unitPrice = toFiniteNumber(item?.unit_price ?? item?.price, 0);
          return sum + (quantity * unitPrice);
        }, 0);

      return buildLocalPrintBundle({
        saleId: resolvedSaleId,
        total: saleTotal,
        paymentMethod: saleMeta?.payment_method || subAccount?.paymentMethod || subAccount?.payment_method || 'cash',
        createdAt: saleMeta?.created_at || new Date().toISOString(),
        amountReceived: saleMeta?.amount_received ?? subAccount?.amountReceived ?? subAccount?.amount_received,
        changeBreakdown: saleMeta?.change_breakdown ?? subAccount?.changeBreakdown ?? subAccount?.change_breakdown ?? [],
        orderItems: items,
        sellerName: t('mesas:defaults.offlineSale')
      });
    })
    .filter(Boolean);
}

interface UseMesaPaymentParams {
  businessId: string;
  userRole: string;
  currentUser: { id: string } | null;
  mesas: MesaRecord[];
  setMesas: SetState<MesaRecord[]>;
  selectedMesa: MesaRecord | null;
  setSelectedMesa: SetState<MesaRecord | null>;
  orderItems: OrderItem[];
  setOrderItems: SetState<OrderItem[]>;
  paymentMethod: string;
  setPaymentMethod: SetState<string>;
  amountReceived: string;
  setAmountReceived: SetState<string>;
  amountReceivedError: string;
  setAmountReceivedError: SetState<string>;
  selectedCustomer: string;
  setSelectedCustomer: SetState<string>;
  customers: any[];
  setCustomers: SetState<any[]>;
  isClosingOrder: boolean;
  setIsClosingOrder: SetState<boolean>;
  setIsGeneratingSplitSales: SetState<boolean>;
  showPaymentModal: boolean;
  setShowPaymentModal: SetState<boolean>;
  showSplitBillModal: boolean;
  setShowSplitBillModal: SetState<boolean>;
  showCloseOrderChoiceModal: boolean;
  setShowCloseOrderChoiceModal: SetState<boolean>;
  showPrintModal: boolean;
  setShowPrintModal: SetState<boolean>;
  printSaleDataList: PrintBundle[];
  setPrintSaleDataList: SetState<PrintBundle[]>;
  isPrintingReceipt: boolean;
  setIsPrintingReceipt: SetState<boolean>;
  printCustomerName: string;
  setPrintCustomerName: SetState<string>;
  setPrintSaleIds: SetState<string[]>;
  pendingOrderItemOps: number;
  justCompletedSaleRef: React.MutableRefObject<boolean>;
  acquireCloseOrderLock: (key: string) => boolean;
  releaseCloseOrderLock: (key: string) => void;
  acquireMesaEditLockWeb: (params: { targetBusinessId: string; tableId: string; lockToken: string }) => Promise<{ unsupported?: boolean; ok?: boolean; lockToken?: string }>;
  releaseMesaEditLockWeb: (params: { targetBusinessId: string; tableId: string; lockToken: string }) => Promise<void>;
  refreshMesaLocks: () => Promise<void>;
  applyRealtimeMesaLockRow: (row: Record<string, any>) => void;
  priceConfig: Record<string, any>;
  sendMesaSyncBroadcast: (params: { tableId: string; action: string; data?: Record<string, any> }) => void;
  publishMesaLockBroadcast: (params: { tableId: string; locked: boolean; mode: string; lockToken: string | null }) => void;
  loadMesas: () => Promise<void>;
  loadOrderDetails: (mesa: MesaRecord) => Promise<void>;
  updateOrderTotal: (...args: any[]) => Promise<void>;
  flushPendingRemoteOrderTotals: () => Promise<void>;
  waitForPendingOrderItemOps: () => Promise<boolean>;
  persistPendingQuantityUpdates: (...args: any[]) => Promise<void>;
  releaseEmptyOrderAndCloseModal: (...args: any[]) => any;
  productCatalogByIdRef: React.MutableRefObject<Map<string, any>>;
  comboCatalogByIdRef: React.MutableRefObject<Map<string, any>>;
  pendingQuantityUpdatesRef: React.MutableRefObject<Record<string, number>>;
  orderItemsDirtyRef: React.MutableRefObject<boolean>;
  orderItemsRef: React.MutableRefObject<OrderItem[]>;
  setModalOpenIntent: SetState<boolean>;
  setShowOrderDetails: SetState<boolean>;
  setCanShowOrderModal: SetState<boolean>;
  insufficientItems: Record<string, any>[];
  hasInsufficientComboStock: boolean;
  insufficientComboComponents: Record<string, any>[];
  orderTotal: number;
  setPendingQuantityUpdatesSafe: SetState<Record<string, number>>;
  setProducts: SetState<any[]>;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
}

export function useMesaPayment({
  businessId,
  userRole,
  currentUser,
  mesas,
  setMesas,
  selectedMesa,
  setSelectedMesa,
  orderItems,
  setOrderItems,
  paymentMethod,
  setPaymentMethod,
  amountReceived,
  setAmountReceived,
  amountReceivedError,
  setAmountReceivedError,
  selectedCustomer,
  setSelectedCustomer,
  customers,
  setCustomers,
  isClosingOrder,
  setIsClosingOrder,
  setIsGeneratingSplitSales,
  showPaymentModal,
  setShowPaymentModal,
  showSplitBillModal,
  setShowSplitBillModal,
  showCloseOrderChoiceModal,
  setShowCloseOrderChoiceModal,
  showPrintModal,
  setShowPrintModal,
  printSaleDataList,
  setPrintSaleDataList,
  isPrintingReceipt,
  setIsPrintingReceipt,
  printCustomerName,
  setPrintCustomerName,
  setPrintSaleIds,
  pendingOrderItemOps,
  justCompletedSaleRef,
  acquireCloseOrderLock,
  releaseCloseOrderLock,
  acquireMesaEditLockWeb,
  releaseMesaEditLockWeb,
  refreshMesaLocks,
  applyRealtimeMesaLockRow,
  priceConfig,
  sendMesaSyncBroadcast,
  publishMesaLockBroadcast,
  loadMesas,
  loadOrderDetails,
  updateOrderTotal,
  flushPendingRemoteOrderTotals,
  waitForPendingOrderItemOps,
  persistPendingQuantityUpdates,
  releaseEmptyOrderAndCloseModal,
  productCatalogByIdRef,
  comboCatalogByIdRef,
  pendingQuantityUpdatesRef,
  orderItemsDirtyRef,
  orderItemsRef,
  setModalOpenIntent,
  setShowOrderDetails,
  setCanShowOrderModal,
  insufficientItems,
  hasInsufficientComboStock,
  insufficientComboComponents,
  orderTotal,
  setPendingQuantityUpdatesSafe,
  setProducts,
  showError,
  showSuccess,
}: UseMesaPaymentParams) {
  const { t } = useTranslation(['mesas', 'common']);
  const fmtPrice = (value: number, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig || {});
  
  const handleCloseOrder = () => {
    setShowCloseOrderChoiceModal(true);
  };

  const handlePayAllTogether = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(false);
    setAmountReceived(String(Math.round(orderTotal || 0)));
    setAmountReceivedError('');
    setShowPaymentModal(true);
  };

  const handleSplitBill = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(true);
  };

  const askReceiptPrintConfirmation = useCallback(async (saleIds: string[] = [], localPrintDataList: PrintBundle[] = []) => {
    const normalizedSaleIds = Array.isArray(saleIds)
      ? saleIds.map((saleId: string) => String(saleId || '').trim()).filter(Boolean)
      : [];
    const normalizedLocalPrintDataList = Array.isArray(localPrintDataList)
      ? localPrintDataList.filter((entry: PrintBundle) => entry?.saleRow && Array.isArray(entry?.saleDetails) && entry.saleDetails.length > 0)
      : [];

    if (normalizedSaleIds.length === 0 && normalizedLocalPrintDataList.length === 0) return false;

    try {
      const saleDataList: PrintBundle[] = [];
      const appendedSaleIds = new Set<string>();
      const localById = new Map<string, PrintBundle>(
        normalizedLocalPrintDataList.map((entry: PrintBundle): [string, PrintBundle] => {
          const entrySaleId = String(entry?.saleId || entry?.saleRow?.id || '').trim();
          return [entrySaleId, entry];
        }).filter(([entrySaleId]: [string, PrintBundle]) => Boolean(entrySaleId))
      );

      const appendCandidate = (candidate: PrintBundle | undefined) => {
        if (!candidate?.saleRow || !Array.isArray(candidate?.saleDetails) || candidate.saleDetails.length === 0) return;
        const candidateSaleId = String(candidate?.saleId || candidate?.saleRow?.id || '').trim();
        if (!candidateSaleId || appendedSaleIds.has(candidateSaleId)) return;

        saleDataList.push({
          saleId: candidateSaleId,
          saleRow: candidate.saleRow,
          saleDetails: candidate.saleDetails
        });
        appendedSaleIds.add(candidateSaleId);
      };

      for (const saleId of normalizedSaleIds) {
        let wasAdded = false;

        try {
          const { saleRow, saleDetails } = await getSalePrintBundle({
            businessId,
            saleId
          });

          if (saleRow && Array.isArray(saleDetails) && saleDetails.length > 0) {
            appendCandidate({ saleId, saleRow, saleDetails });
            wasAdded = appendedSaleIds.has(String(saleId || '').trim());
          }
        } catch (err) {
          logger.warn('mesas:payment:get_sale_print_bundle failed', err);
        }

        if (!wasAdded) {
          appendCandidate(localById.get(saleId));
        }
      }

      if (saleDataList.length === 0) {
        normalizedLocalPrintDataList.forEach((entry: PrintBundle) => appendCandidate(entry));
      }

      if (saleDataList.length === 0) return false;

      setPrintSaleIds(saleDataList.map((entry: PrintBundle) => entry.saleId));
      setPrintSaleDataList(saleDataList);
      setShowPrintModal(true);

      return true;
    } catch {
      return false;
    }
  }, [businessId]);

  const handlePrintConfirm = useCallback(async () => {
    setIsPrintingReceipt(true);
    try {
      for (const { saleRow, saleDetails } of printSaleDataList) {
        try {
          const printResult = await printSaleReceipt({
            sale: saleRow,
            saleDetails,
            sellerName: saleRow?.seller_name || t('mesas:defaults.employee'),
            businessName: await getBusinessNameById(businessId),
            customerName: printCustomerName,
          });

          if (!printResult.ok) {
            showError('Error',t('mesas:errors.printFailed'));
          }
        } catch {
          showError('Error',t('mesas:errors.printFailed'));
        }
      }
    } catch {
      showError('Error',t('mesas:errors.printAllFailed'));
    } finally {
      setIsPrintingReceipt(false);
      setShowPrintModal(false);
      setPrintSaleIds([]);
      setPrintSaleDataList([]);
      setPrintCustomerName(t('mesas:defaults.generalSale'));
    }
  }, [printSaleDataList, printCustomerName, businessId]);

  const handlePrintCancel = useCallback(() => {
    setShowPrintModal(false);
    setPrintSaleIds([]);
    setPrintSaleDataList([]);
    setPrintCustomerName(t('mesas:defaults.generalSale'));
  }, []);

  const _tryAutoPrintReceiptBySaleId = useCallback(async (saleId: string) => {
    if (!isAutoPrintReceiptEnabled() || !saleId) return;

    try {
      const { saleRow, saleDetails } = await getSalePrintBundle({
        businessId,
        saleId
      });

      if (!saleRow || !Array.isArray(saleDetails) || saleDetails.length === 0) return;

      const printResult = await printSaleReceipt({
        sale: saleRow,
        saleDetails,
        sellerName: (saleRow as any).seller_name || t('mesas:defaults.employee'),
        businessName: await getBusinessNameById(businessId),
        customerName: t('mesas:defaults.generalSale'),
      });

      if (!printResult.ok) {
        showError('Error',t('mesas:errors.printAutoFailed'));
      }
    } catch {
      showError('Error',t('mesas:errors.printAutoFailed'));
    }
  }, [businessId]);

  const processSplitPaymentAndClose = async ({ subAccounts }: { subAccounts: SubAccount[] }) => {
    if (isClosingOrder) return;

    let splitCloseLockKey: string | null = null;

    if (insufficientItems.length > 0) {
      const firstShortage = insufficientItems[0];
      showError('Error',
        t('mesas:errors.insufficientStockShortage', {
          productName: firstShortage.product_name,
          available: firstShortage.available_stock,
          required: firstShortage.quantity
        })
      );
      return;
    }

    if (hasInsufficientComboStock) {
      const firstShortage = insufficientComboComponents[0];
      showError('Error',
        t('mesas:errors.insufficientStockShortage', {
          productName: firstShortage.product_name,
          available: firstShortage.available_stock,
          required: firstShortage.required_quantity
        })
      );
      return;
    }

    setIsClosingOrder(true);
    setIsGeneratingSplitSales(true);

    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    if (!mesaSnapshot?.id || !mesaSnapshot?.current_order_id) {
      showError('Error',t('mesas:errors.noActiveOrder'));
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
      return;
    }

    splitCloseLockKey = `split:${businessId}:${mesaSnapshot.id}:${mesaSnapshot.current_order_id}`;
    if (!acquireCloseOrderLock(splitCloseLockKey)) {
      showError('Error',t('mesas:errors.orderClosing'));
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
      return;
    }

    const optimisticSplitTotal = (subAccounts || []).reduce(
      (sum: number, sub: SubAccount) => sum + Number(sub?.total || 0),
      0
    );
    const splitItemsSnapshot = (Array.isArray(subAccounts) ? subAccounts : [])
      .flatMap((sub: SubAccount) => (Array.isArray(sub?.items) ? sub.items : []));
    const splitConsumptionByProduct = buildStockConsumptionFromItems(splitItemsSnapshot, comboCatalogByIdRef);

    setMesas((prevMesas: MesaRecord[]) =>
      prevMesas.map((mesa: MesaRecord) => (
        mesa.id === mesaSnapshot.id
          ? { ...mesa, status: 'available', current_order_id: null, orders: null }
          : mesa
      ))
    );
    clearClosedMesaCache({
      tableId: mesaSnapshot.id,
      orderId: mesaSnapshot.current_order_id,
      businessId
    });
    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);
    setShowSplitBillModal(false);
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowOrderDetails(false);
    setModalOpenIntent(false);
    setSelectedMesa(null);
    orderItemsDirtyRef.current = false;
    orderItemsRef.current = [];
    setOrderItems([]);
    setPendingQuantityUpdatesSafe({});
    applyLocalStockConsumption(splitConsumptionByProduct, { businessId, setProducts });
    setIsGeneratingSplitSales(false);
    setIsClosingOrder(false);
    showSuccess(
      `✨ ${t('mesas:success.saleRegistered')}`,
      `${t('mesas:labels.table')} #${mesaSnapshot.table_number}`
    );

    try {
      const closeResult = await closeOrderAsSplit(businessId, {
        subAccounts: subAccounts as any,
        orderId: mesaSnapshot.current_order_id,
        tableId: mesaSnapshot.id
      }) as any;
      const {
        saleIds = []
      } = closeResult || {};

      if (closeResult?.pending_sync && Array.isArray(closeResult?.sales)) {
        appendPendingSalesToVentasSnapshot(closeResult.sales, businessId, t);
      }

      const localSplitPrintBundles = closeResult?.pending_sync
        ? buildLocalSplitPrintBundles({
          saleIds,
          sales: closeResult?.sales || [],
          subAccounts,
          t
        })
        : [];

      const shouldPrintReceipts = isAutoPrintReceiptEnabled()
        ? (await askReceiptPrintConfirmation(saleIds, localSplitPrintBundles))
        : false;

      if (!shouldPrintReceipts) {
        // Usuario canceló la impresión o auto-print deshabilitado
      }

      loadMesas().catch((err: Error) => { logger.warn('mesas:payment:load_mesas_after_split failed', err); });

      setTimeout(() => {
        justCompletedSaleRef.current = false;
        setCanShowOrderModal(true);
      }, MODAL_REOPEN_GUARD_MS);
    } catch (error) {
      applyLocalStockConsumption(splitConsumptionByProduct, { mode: 'restore', businessId, setProducts });
        showError('Error',buildDiagnosticAlertMessage(error, t));
      try { await loadMesas(); } catch (err) { logger.warn('mesas:payment:load_mesas_recovery_split failed', err); }
      try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch (err) { logger.warn('mesas:payment:reset_modal_state_split failed', err); }
    } finally {
      releaseCloseOrderLock(splitCloseLockKey);
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
    }
  };

  const processPaymentAndClose = async () => {
    if (isClosingOrder) return;

    let closeLockKey: string | null = null;

    if (insufficientItems.length > 0) {
      const firstShortage = insufficientItems[0];
      showError('Error',
        t('mesas:errors.insufficientStockShortage', {
          productName: firstShortage.product_name,
          available: firstShortage.available_stock,
          required: firstShortage.quantity
        })
      );
      return;
    }

    if (hasInsufficientComboStock) {
      const firstShortage = insufficientComboComponents[0];
      showError('Error',
        t('mesas:errors.insufficientStockShortage', {
          productName: firstShortage.product_name,
          available: firstShortage.available_stock,
          required: firstShortage.required_quantity
        })
      );
      return;
    }

    const paymentSnapshot = paymentMethod;
    const amountReceivedSnapshot = amountReceived;
    const normalizedAmountReceived = parseCopAmount(amountReceivedSnapshot);
    const cashChangeData = paymentSnapshot === 'cash'
      ? calcularCambio(orderTotal, amountReceivedSnapshot, priceConfig?.currency || 'COP')
      : null;

    if (paymentSnapshot === 'cash') {
      if (!cashChangeData?.isValid) {
        showError('Error',cashChangeData?.reason === 'insufficient'
          ? t('mesas:errors.insufficientAmount')
          : t('mesas:errors.invalidAmount'));
        return;
      }
    }

    setIsClosingOrder(true);

    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    if (!mesaSnapshot?.id || !mesaSnapshot?.current_order_id) {
      showError('Error',t('mesas:errors.noActiveOrder'));
      setIsClosingOrder(false);
      return;
    }

    closeLockKey = `single:${businessId}:${mesaSnapshot.id}:${mesaSnapshot.current_order_id}`;
    if (!acquireCloseOrderLock(closeLockKey)) {
      showError('Error',t('mesas:errors.orderClosing'));
      setIsClosingOrder(false);
      return;
    }

    const orderItemsSnapshot = Array.isArray(orderItemsRef.current) ? [...orderItemsRef.current] : [];
    const optimisticSaleTotal = calculateOrderItemsTotal(orderItemsSnapshot);
    const orderConsumptionByProduct = buildStockConsumptionFromItems(orderItemsSnapshot, comboCatalogByIdRef);

    if (mesaSnapshot) {
      setMesas((prevMesas: MesaRecord[]) => prevMesas.map((m: MesaRecord) => (
        m.id === mesaSnapshot.id
          ? { ...m, status: 'available', current_order_id: null, orders: null }
          : m
      )));
      clearClosedMesaCache({
        tableId: mesaSnapshot.id,
        orderId: mesaSnapshot.current_order_id,
        businessId
      });
    }
    setShowPaymentModal(false);
    setShowOrderDetails(false);
    setModalOpenIntent(false);
    setSelectedMesa(null);
    orderItemsDirtyRef.current = false;
    orderItemsRef.current = [];
    setOrderItems([]);
    setPendingQuantityUpdatesSafe({});
    applyLocalStockConsumption(orderConsumptionByProduct, { businessId, setProducts });
    setPaymentMethod('cash');
    setAmountReceived('');
    setAmountReceivedError('');
    setSelectedCustomer('');

    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);
    setIsClosingOrder(false);
    showSuccess(
      `✨ ${t('mesas:success.saleRegistered')}`,
      `${t('mesas:labels.table')} #${mesaSnapshot?.table_number || '-'}`
    );

    (async () => {
      try {
        const closeResult = await closeOrderSingle(businessId, {
          orderId: mesaSnapshot.current_order_id,
          tableId: mesaSnapshot.id,
          paymentMethod: paymentSnapshot,
          amountReceived: paymentSnapshot === 'cash' ? normalizedAmountReceived : null,
          changeBreakdown: paymentSnapshot === 'cash' ? cashChangeData?.breakdown || [] : [],
          orderItems: orderItemsSnapshot
        }) as any;
        const { saleId } = closeResult || {};

        if (closeResult?.pending_sync && saleId) {
          appendPendingSalesToVentasSnapshot([{
            id: saleId,
            payment_method: paymentSnapshot,
            total: optimisticSaleTotal,
            amount_received: paymentSnapshot === 'cash' ? normalizedAmountReceived : null,
            change_breakdown: paymentSnapshot === 'cash' ? (cashChangeData?.breakdown || []) : [],
            created_at: closeResult?.created_at || new Date().toISOString()
          }], businessId, t);
        }

        const localSinglePrintBundle = closeResult?.pending_sync
          ? buildLocalPrintBundle({
            saleId,
            total: optimisticSaleTotal,
            paymentMethod: paymentSnapshot,
            createdAt: closeResult?.created_at || new Date().toISOString(),
            amountReceived: paymentSnapshot === 'cash' ? normalizedAmountReceived : null,
            changeBreakdown: paymentSnapshot === 'cash' ? (cashChangeData?.breakdown || []) : [],
            orderItems: orderItemsSnapshot,
            sellerName: t('mesas:defaults.offlineSale')
          })
          : null;

        const shouldPrintReceipt = isAutoPrintReceiptEnabled()
          ? (await askReceiptPrintConfirmation(
            [saleId],
            localSinglePrintBundle ? [localSinglePrintBundle] : []
          ))
          : false;

        if (!shouldPrintReceipt) {
          // Usuario canceló la impresión o auto-print deshabilitado
        }

        loadMesas().catch((err: Error) => { logger.warn('mesas:payment:load_mesas_after_single failed', err); });

        setTimeout(() => {
          justCompletedSaleRef.current = false;
          setCanShowOrderModal(true);
        }, MODAL_REOPEN_GUARD_MS);
      } catch (error) {
        applyLocalStockConsumption(orderConsumptionByProduct, { mode: 'restore', businessId, setProducts });
      showError('Error',buildDiagnosticAlertMessage(error, t));
        try { await loadMesas(); } catch (err) { logger.warn('mesas:payment:load_mesas_recovery_single failed', err); }
        try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch (err) { logger.warn('mesas:payment:reset_modal_state_single failed', err); }
      } finally {
        releaseCloseOrderLock(closeLockKey);
        setIsClosingOrder(false);
      }
    })();
  };

  const handlePrintOrder = () => {
    if (!selectedMesa || orderItems.length === 0) {
      showError('Error', t('mesas:errors.noItemsToPrint'));
      return;
    }

    const normalizeCategory = (value: string) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const categoriasParaCocina = new Set(['plato', 'platos', 'cocina', 'comida']);
    const itemsParaCocina = orderItems.filter((item: OrderItem) => {
      if (item?.combo_id) return true;
      const category = normalizeCategory(item?.products?.category || item?.category || '');
      return categoriasParaCocina.has(category)
        || category.startsWith('plato')
        || category.includes('plato');
    });

    if (itemsParaCocina.length === 0) {
      showError('Error', t('mesas:errors.noKitchenItems'));
      return;
    }

    printKitchenOrder({
      itemsParaCocina,
      tableNumber: selectedMesa.table_number,
      status: selectedMesa.status,
      orderTotal,
      onError: (msg: string) => {
        if (msg) showError('Error', msg);
      },
    });
  };

  return {
    handleCloseOrder,
    handlePayAllTogether,
    handleSplitBill,
    processPaymentAndClose,
    processSplitPaymentAndClose,
    handlePrintOrder,
    askReceiptPrintConfirmation,
    handlePrintConfirm,
    handlePrintCancel,
  };
}
