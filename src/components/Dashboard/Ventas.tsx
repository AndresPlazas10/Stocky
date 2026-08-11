import type { DashboardModuleProps } from '@/types/components';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { getFilteredSales } from '../../services/salesService';
import { recordSaleCreationTime } from '../../services/salesServiceOptimized';
import { fetchComboCatalog } from '../../services/combosService';
import {
  createSaleWithOutbox,
  deleteSaleWithDetails,
  flushSalesOutbox,
  getSalesOutboxSnapshot,
  retryAllSalesOutboxErrorEvents,
  retrySalesOutboxEventByTempSaleId,
  subscribeSalesOutboxUpdates,
  subscribeSalesSyncUpdates
} from '../../data/commands/salesCommands.js';
import {
  getBusinessNameById,
  getProductsForSale,
  getSaleCashMetadataBySaleId,
  getSaleDetailsBySaleId,
  getSaleForPrintById
} from '../../data/queries/salesQueries';
import {
  getAuthenticatedUser,
  isEmployeeInBusiness,
  getEmployeeRoleInBusiness
} from '../../data/queries/authQueries';
import { isAdminRole } from '../../utils/roles.js';
import SalesFilters from '../Filters/SalesFilters';
import { sendInvoiceEmail } from '../../utils/emailService.js';
import { formatPrice, formatDate, formatDateOnly } from '../../utils/formatters';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { isAutoPrintReceiptEnabled } from '../../utils/printer.js';
import { printSaleReceipt } from '../../utils/saleReceiptPrint.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import PaymentMethodSelect from '../ui/PaymentMethodSelect.jsx';
import { useAppToast } from '../../hooks/useAppToast';
import { PrintReceiptConfirmModal } from '../ui/PrintReceiptConfirmModal';
import Pagination from '../Pagination';
import { useLowMotionMode } from '../../hooks/useLowMotionMode.js';
import { useProgressiveList } from '../../hooks/useProgressiveList.js';
import { useRafBatchedQueue } from '../../hooks/useRafBatchedQueue.js';
import { useDebounce } from '../../hooks/optimized.js';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Receipt, 
  Search,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  User,
  Mail,
  FileText,
  Calendar,
  CreditCard,
  X,
  Printer,
  Eye
} from 'lucide-react';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../../utils/offlineSnapshot.js';
import { PaymentMethodBankLogo, getPaymentMethodLabel } from '../ui/PaymentMethodBankLogo';
import {
  applyOfflineStockConsumption,
  buildCartConsumptionByProduct,
  evaluateOfflineStockShortages
} from '../../utils/offlineStockGuards.js';
import { isConnectivityError, formatLoadError } from '../../utils/connectivity';
import { getVendedorName, buildDiagnosticAlertMessage, getActionableSyncErrorMessage, toNumberOrNull, getSaleDetailDisplayName } from './ventas/ventasHelpers';
import { SALE_ITEM_TYPE, buildCartItemKey } from './ventas/ventasConstants';
import { useSaleCart } from './ventas/useSaleCart';
import { useSalesOutbox } from './ventas/useSalesOutbox';
import { useSalesSync } from './ventas/useSalesSync';
import { useVentasRealtime } from './ventas/useVentasRealtime';
import { useVentasData } from './ventas/useVentasData';
import { useDeleteSale } from './ventas/useDeleteSale';
import { useSaleDetails } from './ventas/useSaleDetails';
import { useInvoice } from './ventas/useInvoice';
import { usePrintReceipt } from './ventas/usePrintReceipt';
import { useSaleProcessor } from './ventas/useSaleProcessor';
import { DeleteSaleModal } from './ventas/DeleteSaleModal';
import { SyncStatusCard } from './ventas/SyncStatusCard';
import { InvoiceModal } from './ventas/InvoiceModal';
import { SaleCreateModal } from './ventas/SaleCreateModal';

function Ventas({ businessId, userRole = 'admin' }: DashboardModuleProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(['ventas', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  const dateConfig = { timezone: config.timezone, locale: config.locale };
  
  const { showError, showSuccess, showWarning, showLoading, ToastComponent } = useAppToast();
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  const fmtDate = (timestamp, options = {}) => formatDate(timestamp, options, dateConfig);
  const fmtDateOnly = (timestamp) => formatDateOnly(timestamp, dateConfig);
  
  const {
    sales, setSales,
    page, setPage,
    limit,
    totalCount, setTotalCount,
    currentFilters, setCurrentFilters,
    products, setProducts,
    combos, setCombos,
    loading, setLoading,
    error, setError,
    sessionChecked,
    isEmployee,
    loadVentas, loadProductos, loadCombos, loadData,
  } = useVentasData(businessId);
  const customers = [];
  const [showSaleModal, setShowSaleModal] = useState(false);
  
  const lowMotionMode = useLowMotionMode();

  const deleteHook = useDeleteSale(
    businessId, setLoading, setError,
    loadVentas, currentFilters, limit, page,
    showSuccess, showError, t,
  );
  const { showDeleteModal, handleDeleteSale, confirmDeleteSale, cancelDelete } = deleteHook;

  const saleDetailsHook = useSaleDetails(t);
  const { selectedSale, setSelectedSale, showSaleDetailsModal, saleDetailsLoading, saleDetailsError, fetchSaleDetails, openSaleDetailsModal } = saleDetailsHook;

  const invoiceHook = useInvoice(businessId, fetchSaleDetails, showSuccess, showError, t);
  const { showInvoiceModal, invoiceCustomerName, setInvoiceCustomerName, invoiceCustomerEmail, setInvoiceCustomerEmail, invoiceCustomerIdNumber, setInvoiceCustomerIdNumber, generatingInvoice, generateInvoiceFromSale } = invoiceHook;

  const printHook = usePrintReceipt(businessId, showError, showWarning, showSuccess, t);
  const { showPrintModal, setShowPrintModal, printSaleData, setPrintSaleData, printSaleDetails, setPrintSaleDetails, isPrintingReceipt, printCustomerName, setPrintCustomerName, handlePrintConfirm, handlePrintCancel, handlePrintInvoice } = printHook;

  const comboById = useMemo(() => {
    const map = new Map();
    combos.forEach((combo) => map.set(combo.id, combo));
    return map;
  }, [combos]);

  const catalogItems = useMemo(() => {
    const productItems = products.map((product) => ({
      item_type: SALE_ITEM_TYPE.PRODUCT,
      item_id: product.id,
      product_id: product.id,
      combo_id: null,
      name: product.name,
      code: product.code || '',
      sale_price: Number(product.sale_price || 0),
      stock: Number(product.stock || 0),
      manage_stock: product.manage_stock !== false,
      combo_items: []
    }));

    const comboItems = combos.map((combo) => ({
      item_type: SALE_ITEM_TYPE.COMBO,
      item_id: combo.id,
      product_id: null,
      combo_id: combo.id,
      name: combo.nombre,
      code: `COMBO-${String(combo.id).slice(0, 4).toUpperCase()}`,
      sale_price: Number(combo.precio_venta || 0),
      stock: null,
      combo_items: combo.combo_items || []
    }));

    return [...comboItems, ...productItems];
  }, [products, combos]);

  const {
    cart, setCart,
    selectedCustomer, setSelectedCustomer,
    paymentMethod, setPaymentMethod,
    searchProduct, setSearchProduct,
    saleModalPanel, setSaleModalPanel,
    addToCart, removeFromCart, updateQuantity, clearCart: clearCartHook,
    comboStockShortages, simpleStockShortages,
    total,
    saleIntentSignature, saleIntentKeyRef, saleIntentSignatureRef,
  } = useSaleCart(products, comboById, businessId);

  const closeSaleModal = useCallback(() => {
    setShowSaleModal(false);
    clearCartHook();
  }, [setShowSaleModal, clearCartHook]);

  const { processSale, isSubmitting } = useSaleProcessor({
    businessId,
    cart,
    comboById,
    comboStockShortages,
    simpleStockShortages,
    paymentMethod,
    sessionChecked,
    saleIntentSignature,
    saleIntentKeyRef,
    saleIntentSignatureRef,
    fmtPrice,
    t,
    loadVentas,
    currentFilters,
    limit,
    page,
    setSales,
    setTotalCount,
    setProducts,
    setCart,
    setSelectedCustomer,
    setPaymentMethod,
    setShowSaleModal,
    setSaleModalPanel,
    setPrintSaleData,
    setPrintSaleDetails,
    setShowPrintModal,
    setError,
    showSuccess,
    showError,
    showLoading,
  });

  const salesOutboxState = useSalesOutbox();

  useSalesSync(businessId, sales, loading, setSales, setSelectedSale);

  useVentasRealtime({
    businessId,
    setSales,
    setTotalCount,
    setProducts,
    setCart,
    loadCombos,
    showSuccess,
    t,
  });

  const debouncedSearch = useDebounce(searchProduct, 200);

  // Memoizar catálogo filtrado (productos + combos)
  const filteredCatalog = useMemo(() => {
    if (!debouncedSearch.trim()) return catalogItems;

    const search = debouncedSearch.toLowerCase();
    return catalogItems.filter((item) =>
      item.name.toLowerCase().includes(search) ||
      item.code?.toLowerCase().includes(search)
    );
  }, [catalogItems, debouncedSearch]);

  const {
    visibleItems: visibleFilteredCatalog,
    hasMore: hasMoreFilteredCatalog,
    totalCount: totalFilteredCatalog,
    sentinelRef: filteredCatalogSentinelRef,
    loadMore: loadMoreFilteredCatalog
  } = useProgressiveList(filteredCatalog, {
    initialCount: lowMotionMode ? 12 : 20,
    step: lowMotionMode ? 10 : 18,
    rootMargin: '260px',
    resetKey: `${searchProduct.trim().toLowerCase()}:${filteredCatalog.length}:${lowMotionMode ? 'low' : 'full'}`
  });

  const {
    visibleItems: visibleCartItems,
    hasMore: hasMoreCartItems,
    totalCount: totalCartItems,
    sentinelRef: cartSentinelRef,
    loadMore: loadMoreCartItems
  } = useProgressiveList(cart, {
    initialCount: lowMotionMode ? 10 : 16,
    step: lowMotionMode ? 8 : 14,
    rootMargin: '220px',
    resetKey: `${cart.length}:${lowMotionMode ? 'low' : 'full'}`
  });

  const selectedSaleAmountReceived = toNumberOrNull(selectedSale?.amount_received);
  const selectedSaleChangeAmount = toNumberOrNull(selectedSale?.change_amount);
  const hasAmountReceivedValue = selectedSale?.amount_received !== null
    && selectedSale?.amount_received !== undefined;
  const hasChangeAmountValue = selectedSale?.change_amount !== null
    && selectedSale?.change_amount !== undefined;
  const selectedSaleChangeBreakdown = Array.isArray(selectedSale?.change_breakdown)
    ? selectedSale.change_breakdown
    : [];
  const selectedSaleTotal = toNumberOrNull(selectedSale?.total) ?? 0;
  const changeFromBreakdown = selectedSaleChangeBreakdown.reduce((sum, entry) => {
    const denomination = Number(entry?.denomination || 0);
    const count = Number(entry?.count || 0);
    if (!Number.isFinite(denomination) || !Number.isFinite(count) || count <= 0) return sum;
    return sum + (denomination * count);
  }, 0);
  const changeFromDifference = selectedSaleAmountReceived !== null
    ? Math.max(selectedSaleAmountReceived - selectedSaleTotal, 0)
    : null;
  const resolvedChangeAmount = selectedSaleChangeAmount !== null
    ? selectedSaleChangeAmount
    : (changeFromBreakdown > 0 ? changeFromBreakdown : changeFromDifference);
  const hasChangeBreakdown = changeFromBreakdown > 0;
  const showCashPaymentDetails = selectedSale?.payment_method === 'cash'
    && (hasAmountReceivedValue || hasChangeAmountValue || hasChangeBreakdown);
  const shouldBlockWithError = Boolean(sales.length === 0 && error && !isConnectivityError(error));
  const lastSuccessfulSyncText = salesOutboxState?.lastSuccessfulSyncAt
    ? fmtDate(salesOutboxState.lastSuccessfulSyncAt)
    : t('ventas:sync.noSyncYet');

  return (
    <AsyncStateWrapper
      loading={loading}
      error={shouldBlockWithError ? error : null}
      dataCount={sales.length}
      onRetry={loadData}
      skeletonType="ventas"
      hasFilters={Boolean(currentFilters && Object.keys(currentFilters).length > 0)}
      noResultsTitle={t('ventas:empty.noResultsTitle')}
      noResultsDescription={t('ventas:empty.noResultsDescription')}
      noResultsAction={
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={() => {
              setCurrentFilters({});
              setPage(1);
              loadVentas({}, { limit, offset: 0, includeCount: false });
            }}
            className="bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-100 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            {t('common:buttons.clearFilters')}
          </Button>
        </div>
      }
      emptyTitle={t('ventas:empty.noSales')}
      emptyDescription={t('ventas:empty.noSalesDescription')}
      emptyAction={
        <Button
          type="button"
          onClick={() => setShowSaleModal(true)}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          {t('ventas:empty.createFirstSale')}
        </Button>
      }
      bypassStateRendering={showSaleModal}
      actionProcessing={isSubmitting || generatingInvoice}
      className="min-h-screen bg-gradient-to-br from-light-bg-primary to-white p-6"
    >
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="gradient-primary text-white shadow-xl rounded-2xl border-none mb-6">
          <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{t('ventas:title')}</h1>
                <p className="text-white/80 mt-1 text-sm sm:text-base">{t('ventas:subtitle')}</p>
              </div>
            </div>
            <Button
              onClick={() => setShowSaleModal(!showSaleModal)}
              className="w-full sm:w-auto gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showSaleModal ? (
                <>
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="whitespace-nowrap">{t('ventas:buttons.viewHistory')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="whitespace-nowrap">{t('buttons.newSale')}</span>
                </>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Mensajes */}
      <AnimatePresence>
        <PrintReceiptConfirmModal
          key="print-receipt-confirm"
          isOpen={showPrintModal}
          onConfirm={handlePrintConfirm}
          onCancel={handlePrintCancel}
          isLoading={isPrintingReceipt}
          customerName={printCustomerName}
          onCustomerNameChange={setPrintCustomerName}
        />
      </AnimatePresence>

      {!showSaleModal && (
        <SalesFilters
          {...({ businessId } as any)}
          onApply={(filters) => {
            setCurrentFilters(filters || {});
            setPage(1);
            loadVentas(filters || {}, { limit, offset: 0, includeCount: false });
          }}
          onClear={() => {
            setCurrentFilters({});
            setPage(1);
            loadVentas({}, { limit, offset: 0, includeCount: false });
          }}
        />
      )}

      {!showSaleModal && (
        <SyncStatusCard
          salesOutboxState={salesOutboxState}
          lastSuccessfulSyncText={lastSuccessfulSyncText}
          showError={showError}
          showSuccess={showSuccess}
          t={t}
        />
      )}

      <SaleCreateModal
        isOpen={showSaleModal}
        cart={cart}
        total={total}
        searchProduct={searchProduct}
        saleModalPanel={saleModalPanel}
        selectedCustomer={selectedCustomer}
        paymentMethod={paymentMethod}
        isSubmitting={isSubmitting}
        comboStockShortages={comboStockShortages}
        simpleStockShortages={simpleStockShortages}
        totalFilteredCatalog={totalFilteredCatalog}
        visibleFilteredCatalog={visibleFilteredCatalog}
        hasMoreFilteredCatalog={hasMoreFilteredCatalog}
        filteredCatalogSentinelRef={filteredCatalogSentinelRef}
        loadMoreFilteredCatalog={loadMoreFilteredCatalog}
        visibleCartItems={visibleCartItems}
        hasMoreCartItems={hasMoreCartItems}
        totalCartItems={totalCartItems}
        cartSentinelRef={cartSentinelRef}
        loadMoreCartItems={loadMoreCartItems}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        updateQuantity={updateQuantity}
        fmtPrice={fmtPrice}
        t={t}
        country={config.country}
        customers={customers}
        onClose={closeSaleModal}
        onSearchChange={setSearchProduct}
        onSetSaleModalPanel={setSaleModalPanel}
        onSelectedCustomerChange={setSelectedCustomer}
        onPaymentMethodChange={setPaymentMethod}
        onProcessSale={processSale}
      />

      {/* Historial de Ventas */}
      {!showSaleModal && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {sales.length === 0 ? (
            <Card className="shadow-xl rounded-2xl bg-white border-none">
              <div className="p-12 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium text-lg mb-2">{t('empty.noSales')}</p>
                <p className="text-gray-400">{t('empty.noSalesDescription')}</p>
              </div>
            </Card>
              ) : (
            <div className="space-y-4">
                {/* Paginación superior */}
                <Pagination
                  currentPage={page}
                  totalItems={totalCount}
                  itemsPerPage={limit}
                  onPageChange={async (newPage) => {
                    setPage(newPage);
                    await loadVentas(currentFilters, {
                      limit,
                      offset: (newPage - 1) * limit,
                      includeCount: false
                    });
                  }}
                  disabled={loading}
                />

                <div className="space-y-4">
              {/* Vista de tarjetas en móvil y desktop */}
              <div className="grid grid-cols-1 gap-4">
                {sales.map((sale, index) => (
                  <motion.div
                    key={sale.id}
                    initial={lowMotionMode ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={lowMotionMode ? { duration: 0 } : { duration: 0.2, delay: index * 0.02 }}
                  >
                    {(() => {
                      const outboxEntry = salesOutboxState.byTempSaleId?.[sale.id] || null;
                      const saleSyncStatus = outboxEntry?.status || (sale?.pending_sync ? 'pending' : 'synced');
                      const saleSyncError = outboxEntry?.last_error || null;

                      return (
                    <Card className="shadow-lg rounded-2xl bg-white border-2 border-accent-100 hover:border-primary-300 hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Información principal */}
                          <div className="flex-1 space-y-3">
                            {/* Fecha y hora */}
                            <div className="flex items-center gap-2 text-accent-600">
                              <Calendar className="w-4 h-4 shrink-0" />
                              <span className="text-sm font-medium">
                                {sale.created_at ? fmtDate(sale.created_at) : t('ventas:labels.dateNotAvailable')}
                              </span>
                            </div>

                            {/* Cliente y Vendedor */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-primary-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-accent-500 uppercase tracking-wide">{t('ventas:labels.customer')}</p>
                                  <p className="text-sm font-semibold text-primary-900 truncate">
                                    {t('form.generalSale', { ns: 'common' })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-accent-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-accent-500 uppercase tracking-wide">{t('ventas:labels.seller')}</p>
                                  <p className="text-sm font-medium text-gray-700 truncate">
                                    {getVendedorName(sale, t)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Método de pago */}
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-accent-600 shrink-0" />
                              <Badge 
                                className={`${
                                  sale.payment_method === 'cash' 
                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                    : sale.payment_method === 'card'
                                    ? 'bg-gray-100 text-gray-800 border-gray-200'
                                    : sale.payment_method === 'transfer'
                                    ? 'bg-gray-100 text-gray-800 border-gray-200'
                                    : 'bg-orange-100 text-orange-800 border-orange-200'
                                } border inline-flex items-center gap-1.5`}
                              >
                                {sale.payment_method === 'cash' && (
                                  <>
                                    <span>💵</span>
                                    <span>{t('ventas:paymentMethods.cash')}</span>
                                  </>
                                )}
                                {sale.payment_method === 'card' && (
                                  <>
                                    <span>💳</span>
                                    <span>{t('ventas:paymentMethods.card')}</span>
                                  </>
                                )}
                                {sale.payment_method === 'transfer' && (
                                  <>
                                    <span>🏦</span>
                                    <span>{t('ventas:paymentMethods.transfer')}</span>
                                  </>
                                )}
                                {sale.payment_method === 'mixed' && (
                                  <>
                                    <span>🔀</span>
                                    <span>{t('ventas:paymentMethods.mixed')}</span>
                                  </>
                                )}
                                {![ 'cash', 'card', 'transfer', 'mixed' ].includes(sale.payment_method) && (
                                  <>
                                    <PaymentMethodBankLogo method={sale.payment_method} sizeClass="h-4" />
                                    <span>{getPaymentMethodLabel(sale.payment_method, t)}</span>
                                  </>
                                )}
                              </Badge>

                              {saleSyncStatus === 'pending' && (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-200">{t('status.pendingSync', { ns: 'common' })}</Badge>
                              )}
                              {saleSyncStatus === 'processing' && (
                                <Badge className="bg-gray-100 text-gray-800 border border-gray-200">{t('status.syncing', { ns: 'common' })}</Badge>
                              )}
                              {saleSyncStatus === 'error' && (
                                <Badge className="bg-red-100 text-red-800 border border-red-200">{t('status.errorSync', { ns: 'common' })}</Badge>
                              )}
                              {saleSyncStatus === 'synced' && (
                                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">{t('status.synced', { ns: 'common' })}</Badge>
                              )}
                            </div>

                            {saleSyncStatus === 'error' && saleSyncError && (
                              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                {getActionableSyncErrorMessage(saleSyncError, t)}
                              </p>
                            )}

                            {saleSyncStatus === 'error' && (
                              <div className="pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    const retried = retrySalesOutboxEventByTempSaleId(sale.id);
                                    if (!retried) {
                                      showError('Error', t('ventas:errors.retryNotFound'));
                                      return;
                                    }
                                    void flushSalesOutbox();
                                  }}
                                >
                                  {t('ventas:details.retrySync')}
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Total y Acciones */}
                          <div className="flex flex-col sm:items-end gap-3 sm:border-l sm:border-accent-200 sm:pl-6">
                            {/* Total */}
                            <div className="text-left sm:text-right">
                              <p className="text-xs text-accent-500 uppercase tracking-wide mb-1">{t('labels.total', { ns: 'common' })}</p>
                              <p className="text-2xl sm:text-3xl font-bold text-primary-900">
                                {fmtPrice(sale.total)}
                              </p>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <Button
                                onClick={async () => {
                                  try {
                                    const saleDetails = await fetchSaleDetails(sale.id);
                                    setSelectedSale({ ...sale, sale_details: saleDetails });
                                  } catch {
                                    setSelectedSale({ ...sale, sale_details: [] });
                                  }
                                  setInvoiceCustomerName('');
                                  setInvoiceCustomerEmail('');
                                  setInvoiceCustomerIdNumber('');
                                  setShowInvoiceModal(true);
                                }}
                                className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                              >
                                <Mail className="w-4 h-4" />
                                <span className="text-sm">{t('ventas:buttons.sendEmail')}</span>
                              </Button>
                              <Button
                                onClick={() => openSaleDetailsModal(sale)}
                                disabled={saleDetailsLoading}
                                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto disabled:opacity-60"
                              >
                                <Eye className="w-4 h-4" />
                                <span className="text-sm">{t('buttons.viewDetails', { ns: 'common' })}</span>
                              </Button>
                              <Button
                                 onClick={() => handlePrintInvoice(sale, fetchSaleDetails)}
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                              >
                                <Printer className="w-4 h-4" />
                                <span className="text-sm">{t('buttons.print', { ns: 'common' })}</span>
                              </Button>
                              {userRole === 'admin' && !isEmployee && (
                                <Button
                                  onClick={() => handleDeleteSale(sale.id)}
                                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                                  title={t('ventas:buttons.deleteSale')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                      );
                    })()}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          )}
        </motion.div>
      )}

      {/* Modal para generar comprobante de pago desde venta */}
      <InvoiceModal
        isOpen={showInvoiceModal && !!selectedSale}
        selectedSale={selectedSale}
        invoiceCustomerName={invoiceCustomerName}
        invoiceCustomerEmail={invoiceCustomerEmail}
        invoiceCustomerIdNumber={invoiceCustomerIdNumber}
        generatingInvoice={generatingInvoice}
        fmtPrice={fmtPrice}
        fmtDateOnly={fmtDateOnly}
        t={t}
        onClose={() => setShowInvoiceModal(false)}
        onCustomerNameChange={setInvoiceCustomerName}
        onCustomerEmailChange={setInvoiceCustomerEmail}
        onCustomerIdNumberChange={setInvoiceCustomerIdNumber}
        onSend={() => generateInvoiceFromSale(selectedSale)}
      />

      {/* Modal de detalle de venta */}
      <AnimatePresence>
        {showSaleDetailsModal && selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowSaleDetailsModal(false);
              setSaleDetailsError('');
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <Card className="bg-white shadow-2xl rounded-2xl border-none">
                <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Eye className="w-5 h-5" />
                    {t('ventas:details.title')}
                  </CardTitle>
                  <p className="text-sm text-slate-100">
                    {selectedSale?.created_at ? fmtDate(selectedSale.created_at) : t('ventas:labels.dateNotAvailable')} • {getPaymentMethodLabel(selectedSale?.payment_method, t)}
                  </p>
                </CardHeader>

                <CardContent className="p-6">
                  <div className={`grid grid-cols-1 sm:grid-cols-3 ${showCashPaymentDetails ? 'lg:grid-cols-5' : ''} gap-3 mb-6`}>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 uppercase">{t('ventas:labels.seller')}</p>
                      <p className="font-semibold text-slate-900">{getVendedorName(selectedSale, t)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 uppercase">{t('ventas:details.items')}</p>
                      <p className="font-semibold text-slate-900">{selectedSale?.sale_details?.length || 0}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 uppercase">{t('labels.total', { ns: 'common' })}</p>
                      <p className="font-semibold text-slate-900">{fmtPrice(selectedSale?.total || 0)}</p>
                    </div>
                    {showCashPaymentDetails && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700 uppercase">{t('ventas:details.received')}</p>
                        <p className="font-semibold text-emerald-900">{fmtPrice(selectedSaleAmountReceived)}</p>
                      </div>
                    )}
                    {showCashPaymentDetails && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs text-gray-700 uppercase">{t('ventas:details.change')}</p>
                        <p className="font-semibold text-gray-900">
                          {resolvedChangeAmount !== null ? fmtPrice(resolvedChangeAmount) : t('ventas:details.notRegistered')}
                        </p>
                      </div>
                    )}
                  </div>

                  {showCashPaymentDetails && selectedSaleChangeBreakdown.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
                      <p className="text-xs text-slate-500 uppercase mb-2">{t('ventas:details.breakdown')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedSaleChangeBreakdown.map((entry, idx) => {
                          const denomination = Number(entry?.denomination || 0);
                          const count = Number(entry?.count || 0);
                          if (!Number.isFinite(denomination) || !Number.isFinite(count) || count <= 0) return null;
                          return (
                            <p key={`change-${idx}`} className="text-sm text-slate-700">
                              {count} x {fmtPrice(denomination)}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {saleDetailsLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm">
                      {t('ventas:details.loading')}
                    </div>
                  ) : saleDetailsError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
                      {saleDetailsError}
                    </div>
                  ) : !selectedSale.sale_details || selectedSale.sale_details.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
                      {t('ventas:details.noItems')}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">{t('labels.product', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">{t('labels.code', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-center font-semibold text-slate-700">{t('form.quantity', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">{t('labels.unitPrice', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">{t('labels.subtotal', { ns: 'common' })}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSale.sale_details.map((item, idx) => (
                            <tr key={`${selectedSale.id}-${idx}`} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-4 py-3 text-slate-800">{getSaleDetailDisplayName(item, t)}</td>
                              <td className="px-4 py-3 text-slate-600">{item.products?.code || (item.combo_id ? 'COMBO' : '-')}</td>
                              <td className="px-4 py-3 text-center text-slate-700">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-slate-700">{fmtPrice(item.unit_price)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                {fmtPrice(item.subtotal ?? (Number(item.quantity || 0) * Number(item.unit_price || 0)))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-5 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        setShowSaleDetailsModal(false);
                        setSaleDetailsError('');
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl px-5 py-2"
                    >
                      {t('buttons.close', { ns: 'common' })}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación de venta (solo admin) */}
      <DeleteSaleModal
        isOpen={showDeleteModal}
        loading={loading}
        onCancel={cancelDelete}
        onConfirm={confirmDeleteSale}
        t={t}
      />

      <ToastComponent />
    </div>
    </AsyncStateWrapper>
  );
}

export default Ventas;
