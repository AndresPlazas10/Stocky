import { useCallback } from 'react';
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
} from './mesaHelpers.js';
import {
  readOfflineSnapshot,
  saveOfflineSnapshot,
} from '../../../utils/offlineSnapshot.js';
import { invalidateOrderCache } from '../../../data/adapters/cacheInvalidation.js';
import { normalizeTableRecord } from '../../../utils/tableStatus';

const MODAL_REOPEN_GUARD_MS = 600;

function clearClosedMesaCache({ tableId, orderId = null, businessId }) {
  const normalizedTableId = normalizeEntityId(tableId);
  if (!businessId || !normalizedTableId) return;

  const snapshotKey = `mesas.list:${businessId}`;
  const cachedMesas = readOfflineSnapshot(snapshotKey, []);
  if (Array.isArray(cachedMesas) && cachedMesas.length > 0) {
    const sanitized = cachedMesas.map((mesa) => {
      if (normalizeEntityId(mesa?.id) !== normalizedTableId) return mesa;
      return normalizeTableRecord({
        ...mesa,
        status: 'available',
        current_order_id: null,
        orders: null
      });
    });
    saveOfflineSnapshot(snapshotKey, sanitized);
  }

  invalidateOrderCache({
    businessId,
    tableId: normalizedTableId,
    orderId: normalizeEntityId(orderId)
  }).catch(() => {});
}

function buildStockConsumptionFromItems(items = [], comboCatalogByIdRef) {
  const consumptionByProduct = new Map();
  const source = Array.isArray(items) ? items : [];

  source.forEach((item) => {
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

    (combo.combo_items || []).forEach((component) => {
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

function applyLocalStockConsumption(consumptionByProduct, { mode = 'consume', businessId, setProductos }) {
  if (!(consumptionByProduct instanceof Map) || consumptionByProduct.size === 0) return;
  const shouldRestore = mode === 'restore';

  setProductos((prevProducts) => {
    const source = Array.isArray(prevProducts) ? prevProducts : [];
    const nextProducts = source.map((product) => {
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

function appendPendingSalesToVentasSnapshot(pendingSales = [], businessId) {
  if (!businessId || !Array.isArray(pendingSales) || pendingSales.length === 0) return;

  const snapshotKey = `ventas.list:${businessId}`;
  const currentSnapshot = readOfflineSnapshot(snapshotKey, []);
  const currentList = Array.isArray(currentSnapshot) ? currentSnapshot : [];

  const normalizedPendingSales = pendingSales
    .map((sale) => {
      const saleId = String(sale?.id || '').trim();
      if (!saleId) return null;

      const total = Number(sale?.total || 0);
      const amountReceived = Number(sale?.amount_received);
      const resolvedAmountReceived = Number.isFinite(amountReceived) ? amountReceived : null;
      const changeBreakdown = Array.isArray(sale?.change_breakdown) ? sale.change_breakdown : [];
      const changeFromBreakdown = changeBreakdown.reduce((sum, entry) => {
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
        seller_name: 'Venta offline',
        payment_method: sale?.payment_method || 'cash',
        total,
        created_at: sale?.created_at || new Date().toISOString(),
        notes: 'Pendiente de sincronización',
        pending_sync: true,
        amount_received: resolvedAmountReceived,
        change_amount: changeAmount,
        change_breakdown: changeBreakdown,
        employees: { full_name: 'Pendiente sync', role: 'employee' }
      };
    })
    .filter(Boolean);

  if (normalizedPendingSales.length === 0) return;

  const existingIds = new Set(currentList.map((sale) => String(sale?.id || '').trim()).filter(Boolean));
  const newItems = normalizedPendingSales.filter((sale) => !existingIds.has(String(sale.id || '').trim()));
  if (newItems.length === 0) return;

  saveOfflineSnapshot(snapshotKey, [...newItems, ...currentList]);
}

function mapOrderItemsToPrintDetails(items = []) {
  const source = Array.isArray(items) ? items : [];

  return source
    .map((item) => {
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
  sellerName = 'Venta offline'
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

function buildLocalSplitPrintBundles({ saleIds = [], sales = [], subAccounts = [] }) {
  const normalizedSaleIds = Array.isArray(saleIds) ? saleIds : [];
  const normalizedSales = Array.isArray(sales) ? sales : [];
  const normalizedSubAccounts = Array.isArray(subAccounts) ? subAccounts : [];

  return normalizedSubAccounts
    .map((subAccount, index) => {
      const items = Array.isArray(subAccount?.items) ? subAccount.items : [];
      if (items.length === 0) return null;

      const saleMeta = normalizedSales[index] || {};
      const resolvedSaleId = normalizedSaleIds[index] || saleMeta?.id || null;
      const saleTotalFromMeta = Number(saleMeta?.total);
      const saleTotal = Number.isFinite(saleTotalFromMeta)
        ? saleTotalFromMeta
        : items.reduce((sum, item) => {
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
        sellerName: 'Venta offline'
      });
    })
    .filter(Boolean);
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
  clientes,
  setClientes,
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
  sendMesaSyncBroadcast,
  publishMesaLockBroadcast,
  loadMesas,
  loadOrderDetails,
  updateOrderTotal,
  flushPendingRemoteOrderTotals,
  waitForPendingOrderItemOps,
  persistPendingQuantityUpdates,
  releaseEmptyOrderAndCloseModal,
  setSuccess,
  setSuccessTitle,
  setSuccessDetails,
  setAlertType,
  setError,
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
  setProductos,
}) {
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

  const askReceiptPrintConfirmation = useCallback(async (saleIds = [], localPrintDataList = []) => {
    const normalizedSaleIds = Array.isArray(saleIds)
      ? saleIds.map((saleId) => String(saleId || '').trim()).filter(Boolean)
      : [];
    const normalizedLocalPrintDataList = Array.isArray(localPrintDataList)
      ? localPrintDataList.filter((entry) => entry?.saleRow && Array.isArray(entry?.saleDetails) && entry.saleDetails.length > 0)
      : [];

    if (normalizedSaleIds.length === 0 && normalizedLocalPrintDataList.length === 0) return false;

    try {
      const saleDataList = [];
      const appendedSaleIds = new Set();
      const localById = new Map(
        normalizedLocalPrintDataList.map((entry) => {
          const entrySaleId = String(entry?.saleId || entry?.saleRow?.id || '').trim();
          return [entrySaleId, entry];
        }).filter(([entrySaleId]) => Boolean(entrySaleId))
      );

      const appendCandidate = (candidate) => {
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
        } catch {
          // no-op
        }

        if (!wasAdded) {
          appendCandidate(localById.get(saleId));
        }
      }

      if (saleDataList.length === 0) {
        normalizedLocalPrintDataList.forEach((entry) => appendCandidate(entry));
      }

      if (saleDataList.length === 0) return false;

      setPrintSaleIds(saleDataList.map((entry) => entry.saleId));
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
            sellerName: saleRow?.seller_name || 'Empleado',
            businessName: await getBusinessNameById(businessId),
            customerName: printCustomerName,
          });

          if (!printResult.ok) {
            setError('⚠️ No se pudo imprimir alguno de los comprobantes.');
          }
        } catch {
          setError('⚠️ No se pudo imprimir alguno de los comprobantes.');
        }
      }
    } catch {
      setError('⚠️ No se pudo imprimir los comprobantes.');
    } finally {
      setIsPrintingReceipt(false);
      setShowPrintModal(false);
      setPrintSaleIds([]);
      setPrintSaleDataList([]);
      setPrintCustomerName('Venta general');
    }
  }, [printSaleDataList, printCustomerName, businessId]);

  const handlePrintCancel = useCallback(() => {
    setShowPrintModal(false);
    setPrintSaleIds([]);
    setPrintSaleDataList([]);
    setPrintCustomerName('Venta general');
  }, []);

  const _tryAutoPrintReceiptBySaleId = useCallback(async (saleId) => {
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
        sellerName: saleRow.seller_name || 'Empleado',
        businessName: await getBusinessNameById(businessId),
        customerName: 'Venta general',
      });

      if (!printResult.ok) {
        setError('⚠️ La venta se cerró, pero no se pudo imprimir el recibo automáticamente.');
      }
    } catch {
      setError('⚠️ La venta se cerró, pero no se pudo imprimir el recibo automáticamente.');
    }
  }, [businessId]);

  const processSplitPaymentAndClose = async ({ subAccounts }) => {
    if (isClosingOrder) return;

    let splitCloseLockKey = null;

    if (insufficientItems.length > 0) {
      const firstShortage = insufficientItems[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.quantity}).`
      );
      return;
    }

    if (hasInsufficientComboStock) {
      const firstShortage = insufficientComboComponents[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.required_quantity}).`
      );
      return;
    }

    setIsClosingOrder(true);
    setIsGeneratingSplitSales(true);
    setError(null);

    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    if (!mesaSnapshot?.id || !mesaSnapshot?.current_order_id) {
      setError('❌ No se encontró una orden activa para cerrar.');
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
      return;
    }

    splitCloseLockKey = `split:${businessId}:${mesaSnapshot.id}:${mesaSnapshot.current_order_id}`;
    if (!acquireCloseOrderLock(splitCloseLockKey)) {
      setError('⏳ Esta orden ya se está cerrando. Espera un momento.');
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
      return;
    }

    const optimisticSplitTotal = (subAccounts || []).reduce(
      (sum, sub) => sum + Number(sub?.total || 0),
      0
    );
    const splitItemsSnapshot = (Array.isArray(subAccounts) ? subAccounts : [])
      .flatMap((sub) => (Array.isArray(sub?.items) ? sub.items : []));
    const splitConsumptionByProduct = buildStockConsumptionFromItems(splitItemsSnapshot, comboCatalogByIdRef);

    setMesas((prevMesas) =>
      prevMesas.map((mesa) => (
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
    applyLocalStockConsumption(splitConsumptionByProduct, { businessId, setProductos });
    setIsGeneratingSplitSales(false);
    setIsClosingOrder(false);
    setSuccessDetails([
      { label: 'Total', value: formatPrice(optimisticSplitTotal) },
      { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
      { label: 'Cuentas', value: subAccounts.length },
      { label: 'Sincronización', value: 'Procesando en segundo plano' }
    ]);
    setSuccessTitle('✨ Venta Registrada');
    setAlertType('success');
    setSuccess(true);

    try {
      const closeResult = await closeOrderAsSplit(businessId, {
        subAccounts,
        orderId: mesaSnapshot.current_order_id,
        tableId: mesaSnapshot.id
      });
      const {
        saleIds = []
      } = closeResult || {};

      if (closeResult?.pending_sync && Array.isArray(closeResult?.sales)) {
        appendPendingSalesToVentasSnapshot(closeResult.sales, businessId);
      }

      const localSplitPrintBundles = closeResult?.pending_sync
        ? buildLocalSplitPrintBundles({
          saleIds,
          sales: closeResult?.sales || [],
          subAccounts
        })
        : [];

      const shouldPrintReceipts = isAutoPrintReceiptEnabled()
        ? (await askReceiptPrintConfirmation(saleIds, localSplitPrintBundles))
        : false;

      if (!shouldPrintReceipts) {
        // Usuario canceló la impresión o auto-print deshabilitado
      }

      loadMesas().catch(() => {});

      setTimeout(() => {
        justCompletedSaleRef.current = false;
        setCanShowOrderModal(true);
      }, MODAL_REOPEN_GUARD_MS);
    } catch (error) {
      applyLocalStockConsumption(splitConsumptionByProduct, { mode: 'restore', businessId, setProductos });
      setError(buildDiagnosticAlertMessage(error, 'No se pudo cerrar la orden. Revirtiendo estado.'));
      try { await loadMesas(); } catch { /* no-op */ }
      try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch { /* no-op */ }
    } finally {
      releaseCloseOrderLock(splitCloseLockKey);
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
    }
  };

  const processPaymentAndClose = async () => {
    if (isClosingOrder) return;

    let closeLockKey = null;

    if (insufficientItems.length > 0) {
      const firstShortage = insufficientItems[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.quantity}).`
      );
      return;
    }

    if (hasInsufficientComboStock) {
      const firstShortage = insufficientComboComponents[0];
      setError(
        `❌ Stock insuficiente para "${firstShortage.product_name}" ` +
        `(disp: ${firstShortage.available_stock}, req: ${firstShortage.required_quantity}).`
      );
      return;
    }

    const paymentSnapshot = paymentMethod;
    const amountReceivedSnapshot = amountReceived;
    const normalizedAmountReceived = parseCopAmount(amountReceivedSnapshot);
    const cashChangeData = paymentSnapshot === 'cash'
      ? calcularCambio(orderTotal, amountReceivedSnapshot)
      : null;

    if (paymentSnapshot === 'cash') {
      if (!cashChangeData?.isValid) {
        setError(cashChangeData?.reason === 'insufficient'
          ? '❌ El monto recibido es menor al total de la cuenta.'
          : '❌ Ingresa un monto recibido válido.');
        return;
      }
    }

    setIsClosingOrder(true);
    setError(null);

    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    if (!mesaSnapshot?.id || !mesaSnapshot?.current_order_id) {
      setError('❌ No se encontró una orden activa para cerrar.');
      setIsClosingOrder(false);
      return;
    }

    closeLockKey = `single:${businessId}:${mesaSnapshot.id}:${mesaSnapshot.current_order_id}`;
    if (!acquireCloseOrderLock(closeLockKey)) {
      setError('⏳ Esta orden ya se está cerrando. Espera un momento.');
      setIsClosingOrder(false);
      return;
    }

    const orderItemsSnapshot = Array.isArray(orderItemsRef.current) ? [...orderItemsRef.current] : [];
    const optimisticSaleTotal = calculateOrderItemsTotal(orderItemsSnapshot);
    const orderConsumptionByProduct = buildStockConsumptionFromItems(orderItemsSnapshot, comboCatalogByIdRef);

    if (mesaSnapshot) {
      setMesas(prevMesas => prevMesas.map(m => (
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
    applyLocalStockConsumption(orderConsumptionByProduct, { businessId, setProductos });
    setPaymentMethod('cash');
    setAmountReceived('');
    setAmountReceivedError('');
    setSelectedCustomer('');

    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);
    setIsClosingOrder(false);
    setSuccessDetails([
      { label: 'Total', value: formatPrice(optimisticSaleTotal) },
      { label: 'Mesa', value: `#${mesaSnapshot?.table_number || '-'}` },
      { label: 'Método', value: getPaymentMethodLabel(paymentSnapshot) },
      { label: 'Sincronización', value: 'Procesando en segundo plano' }
    ]);
    setSuccessTitle('✨ Venta Registrada');
    setAlertType('success');
    setSuccess(true);

    (async () => {
      try {
        const closeResult = await closeOrderSingle(businessId, {
          orderId: mesaSnapshot.current_order_id,
          tableId: mesaSnapshot.id,
          paymentMethod: paymentSnapshot,
          amountReceived: paymentSnapshot === 'cash' ? normalizedAmountReceived : null,
          changeBreakdown: paymentSnapshot === 'cash' ? cashChangeData?.breakdown || [] : [],
          orderItems: orderItemsSnapshot
        });
        const { saleId } = closeResult || {};

        if (closeResult?.pending_sync && saleId) {
          appendPendingSalesToVentasSnapshot([{
            id: saleId,
            payment_method: paymentSnapshot,
            total: optimisticSaleTotal,
            amount_received: paymentSnapshot === 'cash' ? normalizedAmountReceived : null,
            change_breakdown: paymentSnapshot === 'cash' ? (cashChangeData?.breakdown || []) : [],
            created_at: closeResult?.created_at || new Date().toISOString()
          }], businessId);
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
            sellerName: 'Venta offline'
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

        loadMesas().catch(() => {});

        setTimeout(() => {
          justCompletedSaleRef.current = false;
          setCanShowOrderModal(true);
        }, MODAL_REOPEN_GUARD_MS);
      } catch (error) {
        applyLocalStockConsumption(orderConsumptionByProduct, { mode: 'restore', businessId, setProductos });
        setError(buildDiagnosticAlertMessage(error, 'No se pudo cerrar la orden. Revirtiendo estado.'));
        try { await loadMesas(); } catch { /* no-op */ }
        try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch { /* no-op */ }
      } finally {
        releaseCloseOrderLock(closeLockKey);
        setIsClosingOrder(false);
      }
    })();
  };

  const handlePrintOrder = () => {
    if (!selectedMesa || orderItems.length === 0) {
      setError('No hay productos en la orden para imprimir');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const normalizeCategory = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const categoriasParaCocina = new Set(['plato', 'platos', 'cocina', 'comida']);
    const itemsParaCocina = orderItems.filter((item) => {
      if (item?.combo_id) return true;
      const category = normalizeCategory(item?.products?.category || item?.category || '');
      return categoriasParaCocina.has(category)
        || category.startsWith('plato')
        || category.includes('plato');
    });

    if (itemsParaCocina.length === 0) {
      setError('No hay productos que requieran preparación en cocina');
      setTimeout(() => setError(null), 3000);
      return;
    }

    printKitchenOrder({
      itemsParaCocina,
      tableNumber: selectedMesa.table_number,
      status: selectedMesa.status,
      orderTotal,
      onError: (msg) => {
        setError(msg);
        if (msg) setTimeout(() => setError(null), 3000);
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
