import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Plus } from 'lucide-react';
import { deleteTableCascadeOrders } from '../../data/commands/ordersCommands';
import type { SplitBillOrderItem, OrderItem } from '../../types/components';
import { calcularCambio } from '../../utils/cambio';
import { Button } from '../ui/button';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { getTotalProductUnits } from './mesas/mesaHelpers.js';
import MesasGrid from './mesas/MesasGrid';
import { useMesaEditLocks } from './mesas/useMesaEditLocks.js';
import { useMesaRealtime } from './mesas/useMesaRealtime.js';
import { useMesaOrderOperations } from './mesas/useMesaOrderOperations.js';
import { useMesaPayment } from './mesas/useMesaPayment.js';
import { useMesasState } from './mesas/useMesasState.js';
import { useMesasRefs } from './mesas/useMesasRefs.js';
import { useMesasEffects } from './mesas/useMesasEffects.js';
import { useMesasCatalog } from './mesas/useMesasCatalog.js';
import { useMesaCatalog } from '../../hooks/useMesaCatalog.js';
import { useRafBatchedQueue } from '../../hooks/useRafBatchedQueue.js';
import { useCloseOrderLocks } from '../../hooks/useCloseOrderLocks.js';
import { MesasHeader } from './mesas/MesasHeader.jsx';
import { AddMesaForm } from './mesas/AddMesaForm.jsx';
import { MesasAlerts } from './mesas/MesasAlerts.jsx';
import { OrderDetailsModal } from './mesas/OrderDetailsModal.jsx';
import { CloseOrderChoiceModal } from './mesas/CloseOrderChoiceModal.jsx';
import SplitBillModal from './SplitBillModal.jsx';
import { MesaPaymentModal } from './MesaPaymentModal.jsx';
import { MesaDeleteModal } from './MesaDeleteModal.jsx';

function Mesas({ businessId, userRole = 'admin' }: { businessId: string; userRole?: string }) {
  const state = useMesasState(businessId, userRole);
  const refs = useMesasRefs({
    businessId,
    currentUser: state.currentUser,
    setPendingQuantityUpdates: state.setPendingQuantityUpdates,
    setPendingOrderItemOps: state.setPendingOrderItemOps,
  });

  const { loadCombos, ensureCatalogWarmup } = useMesaCatalog({
    businessId,
    setProducts: state.setProducts,
    setCombos: state.setCombos,
    setError: state.setError,
  });

  const { acquireCloseOrderLock, releaseCloseOrderLock } = useCloseOrderLocks();
  const enqueueRealtimeUpdate = useRafBatchedQueue({ useTransition: false });

  const {
    getMesaLockState,
    acquireMesaEditLockWeb,
    releaseMesaEditLockWeb,
    refreshMesaLocks,
    applyRealtimeMesaLockRow,
    applyRealtimeMesaLockBroadcast,
    refreshMesaEditLockHeartbeatWeb,
  } = useMesaEditLocks({
    businessId,
    currentUser: state.currentUser,
    isOfflineFirstRuntime: refs.isOfflineFirstRuntime,
    heldMesaLockRef: refs.heldMesaLockRef,
    mesaSyncClientIdRef: refs.mesaSyncClientIdRef,
    _activeMesaBroadcastRef: refs.activeMesaBroadcastRef,
    mesaLockHeartbeatTimerRef: refs.mesaLockHeartbeatTimerRef,
  });

  const catalog = useMesasCatalog({
    products: state.products,
    combos: state.combos,
    orderItems: state.orderItems,
    selectedMesa: state.selectedMesa,
    searchProduct: state.searchProduct,
    debouncedSearch: state.debouncedSearch,
    lowMotionMode: state.lowMotionMode,
    paymentMethod: state.paymentMethod,
    amountReceived: state.amountReceived,
  });

  const {
    handleCreateTable,
    loadMesas,
    handleOpenTable,
    addCatalogItemToOrder,
    updateItemQuantity,
    handleRefreshOrder,
    handleCloseModal,
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    releaseEmptyOrderAndCloseModal,
    loadOrderDetails,
  } = useMesaOrderOperations({
    businessId,
    _userRole: userRole,
    _mesas: state.mesas,
    setMesas: state.setMesas,
    selectedMesa: state.selectedMesa,
    setSelectedMesa: state.setSelectedMesa,
    _showOrderDetails: state.showOrderDetails,
    setShowOrderDetails: state.setShowOrderDetails,
    orderItems: state.orderItems,
    setOrderItems: state.setOrderItems,
    setPendingQuantityUpdatesSafe: refs.setPendingQuantityUpdatesSafe,
    _products: state.products,
    _combos: state.combos,
    _catalogItems: catalog?.filteredCatalog,
    _productCatalogByIdRef: refs.productCatalogByIdRef,
    _comboCatalogByIdRef: refs.comboCatalogByIdRef,
    pendingQuantityUpdatesRef: refs.pendingQuantityUpdatesRef,
    orderItemsDirtyRef: refs.orderItemsDirtyRef,
    orderItemsRef: refs.orderItemsRef,
    _selectedMesaRef: refs.selectedMesaRef,
    orderDetailsRequestRef: refs.orderDetailsRequestRef,
    pendingRemoteOrderTotalsRef: refs.pendingRemoteOrderTotalsRef,
    orderTotalSyncQueueRef: refs.orderTotalSyncQueueRef,
    lastSyncedOrderTotalsRef: refs.lastSyncedOrderTotalsRef,
    optimisticTempItemQuantitiesRef: refs.optimisticTempItemQuantitiesRef,
    pendingOrderItemOpsRef: refs.pendingOrderItemOpsRef,
    _orderItemWriteQueueRef: refs.orderItemWriteQueueRef,
    markOrderItemOpStarted: refs.markOrderItemOpStarted,
    markOrderItemOpFinished: refs.markOrderItemOpFinished,
    waitForPendingOrderItemOps: refs.waitForPendingOrderItemOps,
    enqueueOrderItemWrite: refs.enqueueOrderItemWrite,
    acquireMesaEditLockWeb,
    _releaseMesaEditLockWeb: releaseMesaEditLockWeb,
    _sendMesaSyncBroadcast: refs.sendMesaSyncBroadcast,
    publishMesaLockBroadcast: refs.publishMesaLockBroadcast,
    ensureCatalogWarmup,
    isOfflineFirstRuntime: refs.isOfflineFirstRuntime,
    setMesaOpenDebugStage: refs.setMesaOpenDebugStage,
    buildMesaOpenDebugTag: refs.buildMesaOpenDebugTag,
    setError: state.setError,
    setSuccess: state.setSuccess,
    setSuccessTitle: state.setSuccessTitle,
    setSuccessDetails: state.setSuccessDetails,
    setAlertType: state.setAlertType,
    isCreatingTable: state.isCreatingTable,
    setIsCreatingTable: state.setIsCreatingTable,
    newTableNumber: state.newTableNumber,
    setNewTableNumber: state.setNewTableNumber,
    _modalOpenIntent: state.modalOpenIntent,
    setModalOpenIntent: state.setModalOpenIntent,
    _canShowOrderModal: state.canShowOrderModal,
    setCanShowOrderModal: state.setCanShowOrderModal,
    _searchProduct: state.searchProduct,
    setSearchProduct: state.setSearchProduct,
    quantityToAdd: state.quantityToAdd,
    setQuantityToAdd: state.setQuantityToAdd,
    getCurrentUser: state.getCurrentUser,
    currentUser: state.currentUser,
    canManageTables: state.canManageTables,
    isEmployee: state.isEmployee,
    activeMesaBroadcastRef: refs.activeMesaBroadcastRef,
    mesaSyncClientIdRef: refs.mesaSyncClientIdRef,
    heldMesaLockRef: refs.heldMesaLockRef,
    getMesaLockState,
    showAddForm: state.showAddForm,
    setShowAddForm: state.setShowAddForm,
  });

  useMesaRealtime({
    businessId,
    setMesas: state.setMesas,
    enqueueRealtimeUpdate,
    setSelectedMesa: state.setSelectedMesa,
    selectedMesaRef: refs.selectedMesaRef,
    orderItemsRef: refs.orderItemsRef,
    setOrderItems: state.setOrderItems,
    pendingQuantityUpdatesRef: refs.pendingQuantityUpdatesRef,
    pendingOrderItemOps: state.pendingOrderItemOps,
    productCatalogByIdRef: refs.productCatalogByIdRef,
    orderItemsDirtyRef: refs.orderItemsDirtyRef,
    lastSyncedOrderTotalsRef: refs.lastSyncedOrderTotalsRef,
    justCompletedSaleRef: refs.justCompletedSaleRef,
    setShowOrderDetails: state.setShowOrderDetails,
    setModalOpenIntent: state.setModalOpenIntent,
    pendingRemoteOrderTotalsRef: refs.pendingRemoteOrderTotalsRef,
    loadCombos,
    comboCatalogByIdRef: refs.comboCatalogByIdRef,
  });

  const {
    handleCloseOrder,
    handlePayAllTogether,
    handleSplitBill,
    processPaymentAndClose,
    processSplitPaymentAndClose,
    handlePrintOrder,
    handlePrintConfirm,
    handlePrintCancel,
  } = useMesaPayment({
    businessId,
    userRole,
    currentUser: state.currentUser,
    mesas: state.mesas,
    setMesas: state.setMesas,
    selectedMesa: state.selectedMesa,
    setSelectedMesa: state.setSelectedMesa,
    orderItems: state.orderItems,
    setOrderItems: state.setOrderItems,
    paymentMethod: state.paymentMethod,
    setPaymentMethod: state.setPaymentMethod,
    amountReceived: state.amountReceived,
    setAmountReceived: state.setAmountReceived,
    amountReceivedError: state.amountReceivedError,
    setAmountReceivedError: state.setAmountReceivedError,
    selectedCustomer: state.selectedCustomer,
    setSelectedCustomer: state.setSelectedCustomer,
    customers: state.customers,
    setCustomers: state.setCustomers,
    isClosingOrder: state.isClosingOrder,
    setIsClosingOrder: state.setIsClosingOrder,
    setIsGeneratingSplitSales: state.setIsGeneratingSplitSales,
    showPaymentModal: state.showPaymentModal,
    setShowPaymentModal: state.setShowPaymentModal,
    showSplitBillModal: state.showSplitBillModal,
    setShowSplitBillModal: state.setShowSplitBillModal,
    showCloseOrderChoiceModal: state.showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal: state.setShowCloseOrderChoiceModal,
    showPrintModal: state.showPrintModal,
    setShowPrintModal: state.setShowPrintModal,
    printSaleDataList: state.printSaleDataList,
    setPrintSaleDataList: state.setPrintSaleDataList,
    isPrintingReceipt: state.isPrintingReceipt,
    setIsPrintingReceipt: state.setIsPrintingReceipt,
    printCustomerName: state.printCustomerName,
    setPrintCustomerName: state.setPrintCustomerName,
    setPrintSaleIds: state.setPrintSaleIds,
    pendingOrderItemOps: state.pendingOrderItemOps,
    justCompletedSaleRef: refs.justCompletedSaleRef,
    acquireCloseOrderLock,
    releaseCloseOrderLock,
    acquireMesaEditLockWeb,
    releaseMesaEditLockWeb,
    refreshMesaLocks,
    applyRealtimeMesaLockRow,
    sendMesaSyncBroadcast: refs.sendMesaSyncBroadcast,
    publishMesaLockBroadcast: refs.publishMesaLockBroadcast,
    loadMesas,
    loadOrderDetails,
    updateOrderTotal,
    flushPendingRemoteOrderTotals,
    waitForPendingOrderItemOps: refs.waitForPendingOrderItemOps,
    persistPendingQuantityUpdates: handleRefreshOrder,
    releaseEmptyOrderAndCloseModal,
    setSuccess: state.setSuccess,
    setSuccessTitle: state.setSuccessTitle,
    setSuccessDetails: state.setSuccessDetails,
    setAlertType: state.setAlertType,
    setError: state.setError,
    productCatalogByIdRef: refs.productCatalogByIdRef,
    comboCatalogByIdRef: refs.comboCatalogByIdRef,
    pendingQuantityUpdatesRef: refs.pendingQuantityUpdatesRef,
    orderItemsDirtyRef: refs.orderItemsDirtyRef,
    orderItemsRef: refs.orderItemsRef,
    setModalOpenIntent: state.setModalOpenIntent,
    setShowOrderDetails: state.setShowOrderDetails,
    setCanShowOrderModal: state.setCanShowOrderModal,
    insufficientItems: catalog.insufficientItems,
    hasInsufficientComboStock: catalog.hasInsufficientComboStock,
    insufficientComboComponents: catalog.insufficientComboComponents,
    orderTotal: catalog.orderTotal,
    setPendingQuantityUpdatesSafe: refs.setPendingQuantityUpdatesSafe,
    setProducts: state.setProducts,
  });

  useEffect(() => {
    refs.orderItemsRef.current = Array.isArray(state.orderItems) ? state.orderItems : [];
  }, [state.orderItems]);

  useEffect(() => {
    refs.selectedMesaRef.current = state.selectedMesa || null;
  }, [state.selectedMesa]);

  useEffect(() => {
    refs.mesasLengthRef.current = Array.isArray(state.mesas) ? state.mesas.length : 0;
  }, [state.mesas]);

  useEffect(() => {
    const productMap = new Map();
    (Array.isArray(state.products) ? state.products : []).forEach((product) => {
      const productId = product?.id;
      if (productId) productMap.set(productId, product);
    });
    refs.productCatalogByIdRef.current = productMap;
  }, [state.products]);

  useEffect(() => {
    const comboMap = new Map();
    (Array.isArray(state.combos) ? state.combos : []).forEach((combo) => {
      const comboId = combo?.id;
      if (comboId) comboMap.set(comboId, combo);
    });
    refs.comboCatalogByIdRef.current = comboMap;
  }, [state.combos]);

  useMesasEffects({
    businessId,
    mesas: state.mesas,
    _selectedMesa: state.selectedMesa,
    showOrderDetails: state.showOrderDetails,
    loadMesas,
    loadClientes: state.loadCustomers,
    getCurrentUser: state.getCurrentUser,
    checkIfEmployee: state.checkIfEmployee,
    refreshMesaLocks,
    applyRealtimeMesaLockBroadcast,
    refreshMesaEditLockHeartbeatWeb,
    releaseMesaEditLockWeb,
    flushPendingRemoteOrderTotals,
    _setMesas: state.setMesas,
    _setShowOrderDetails: state.setShowOrderDetails,
    _setCanShowOrderModal: state.setCanShowOrderModal,
    heldMesaLockRef: refs.heldMesaLockRef,
    activeMesaBroadcastRef: refs.activeMesaBroadcastRef,
    mesaSyncBroadcastChannelRef: refs.mesaSyncBroadcastChannelRef,
    mesaSyncBroadcastReadyRef: refs.mesaSyncBroadcastReadyRef,
    mesasSnapshotTimerRef: refs.mesasSnapshotTimerRef,
    mesaLockHeartbeatTimerRef: refs.mesaLockHeartbeatTimerRef,
    publishMesaLockBroadcast: refs.publishMesaLockBroadcast,
  });

  const handleRetry = async () => {
    try {
      await Promise.all([loadMesas(), state.loadCustomers()]);
    } catch {
      state.setError('No se pudo cargar la informacion de las mesas. Por favor, intenta recargar la pagina.');
    }
  };

  return (
    <AsyncStateWrapper
      loading={state.loading}
      error={state.mesas.length === 0 ? state.error : null}
      dataCount={state.mesas.length}
      onRetry={handleRetry}
      skeletonType="mesas"
      emptyTitle="Aun no hay mesas creadas"
      emptyDescription="Crea tu primera mesa para empezar a registrar ordenes."
      emptyAction={
        state.canManageTables ? (
          <Button
            type="button"
            onClick={() => state.setShowAddForm(true)}
            className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            Crear Primera Mesa
          </Button>
        ) : null
      }
      bypassStateRendering={state.showAddForm}
    >
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-6"
      >
        <MesasHeader
          canManageTables={state.canManageTables}
          onToggleAddForm={() => state.setShowAddForm(!state.showAddForm)}
        />

        <div className="pt-6">
          <MesasAlerts
            isGeneratingSplitSales={state.isGeneratingSplitSales}
            isClosingOrder={state.isClosingOrder}
            success={state.success}
            alertType={state.alertType}
            successTitle={state.successTitle}
            successDetails={state.successDetails}
            error={state.error}
            showPrintModal={state.showPrintModal}
            isPrintingReceipt={state.isPrintingReceipt}
            printCustomerName={state.printCustomerName}
            onPrintConfirm={handlePrintConfirm}
            onPrintCancel={handlePrintCancel}
            onPrintCustomerNameChange={state.setPrintCustomerName}
            onSuccessClose={() => state.setSuccess(false)}
            onErrorClose={() => state.setError(null)}
          />

          <AddMesaForm
            showAddForm={state.showAddForm}
            canManageTables={state.canManageTables}
            isCreatingTable={state.isCreatingTable}
            newTableNumber={state.newTableNumber}
            onNewTableNumberChange={(e) => state.setNewTableNumber(e.target.value)}
            onSubmit={handleCreateTable}
            onCancel={() => {
              state.setShowAddForm(false);
              state.setNewTableNumber('');
            }}
          />

          <MesasGrid
            visibleMesas={state.visibleMesas}
            totalMesas={state.totalMesas}
            hasMoreMesas={state.hasMoreMesas}
            mesasSentinelRef={state.mesasSentinelRef}
            loadMoreMesas={state.loadMoreMesas}
            isEmployee={state.isEmployee}
            onOpenTable={handleOpenTable}
            onDeleteTable={(mesaId) => {
              state.setMesaToDelete(state.mesas.find((m) => m.id === mesaId) ?? null);
              state.setShowDeleteModal(true);
            }}
            selectedMesaId={state.modalOpenIntent && state.showOrderDetails ? null : state.selectedMesa?.id || null}
            selectedMesaUnits={
              state.modalOpenIntent && state.showOrderDetails
                ? null
                : state.selectedMesa?.id
                  ? getTotalProductUnits(state.orderItems)
                  : null
            }
            lowMotionMode={state.lowMotionMode}
            getMesaLockState={getMesaLockState}
          />

          {state.mesas.length === 0 && !state.loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-10 h-10 text-accent-600" />
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">No hay mesas creadas</h3>
              <p className="text-primary-600 mb-6">Comienza agregando tu primera mesa</p>
              {state.canManageTables && (
                <Button onClick={() => state.setShowAddForm(true)} className="gradient-primary text-white hover:opacity-90">
                  <Plus className="w-5 h-5 mr-2" />
                  Agregar Mesa
                </Button>
              )}
            </div>
          )}
        </div>

        <OrderDetailsModal
          isOpen={state.modalOpenIntent && state.showOrderDetails && state.canShowOrderModal}
          selectedMesa={state.selectedMesa}
          searchProduct={state.searchProduct}
          onSearchChange={(value) => state.setSearchProduct(value)}
          filteredCatalog={catalog.filteredCatalog}
          visibleFilteredCatalog={catalog.visibleFilteredCatalog}
          hasMoreFilteredCatalog={catalog.hasMoreFilteredCatalog}
          totalFilteredCatalog={catalog.totalFilteredCatalog}
          filteredCatalogSentinelRef={catalog.filteredCatalogSentinelRef}
          lowMotionMode={state.lowMotionMode}
          onAddItem={addCatalogItemToOrder}
          onLoadMoreFilteredCatalog={catalog.loadMoreFilteredCatalog}
          orderItems={state.orderItems as OrderItem[]}
          visibleOrderItems={catalog.visibleOrderItems as OrderItem[]}
          hasMoreOrderItems={catalog.hasMoreOrderItems}
          totalOrderItems={catalog.totalOrderItems}
          orderItemsSentinelRef={catalog.orderItemsSentinelRef}
          isOrderItemsSyncing={state.isOrderItemsSyncing}
          getOrderItemRenderKey={null}
          getOrderItemName={null}
          onUpdateQuantity={updateItemQuantity}
          onLoadMoreOrderItems={catalog.loadMoreOrderItems}
          orderTotal={catalog.orderTotal}
          onSave={handleRefreshOrder}
          onPrintKitchen={handlePrintOrder}
          onCloseOrder={handleCloseOrder}
          onClose={handleCloseModal}
        />

        <CloseOrderChoiceModal
          isOpen={state.showCloseOrderChoiceModal}
          orderTotal={catalog.orderTotal}
          onPayAllTogether={handlePayAllTogether}
          onSplitBill={handleSplitBill}
          onClose={() => state.setShowCloseOrderChoiceModal(false)}
        />

        <AnimatePresence>
          {state.showSplitBillModal && (
            <SplitBillModal
              orderItems={state.orderItems as SplitBillOrderItem[]}
              onConfirm={processSplitPaymentAndClose}
              onCancel={() => {
                state.setShowSplitBillModal(false);
                state.setShowCloseOrderChoiceModal(true);
              }}
            />
          )}
        </AnimatePresence>

        <MesaPaymentModal
          isOpen={state.showPaymentModal}
          orderTotal={catalog.orderTotal}
          cambioPago={catalog.cambioPago}
          paymentMethod={state.paymentMethod}
          onPaymentMethodChange={state.setPaymentMethod}
          selectedCustomer={state.selectedCustomer}
          onCustomerChange={state.setSelectedCustomer}
          clientes={state.customers}
          amountReceived={state.amountReceived}
          onAmountReceivedChange={state.setAmountReceived}
          amountReceivedError={state.amountReceivedError}
          setAmountReceivedError={state.setAmountReceivedError}
          insufficientItems={catalog.insufficientItems}
          insufficientComboComponents={catalog.insufficientComboComponents}
          hasInsufficientComboStock={catalog.hasInsufficientComboStock}
          isCashPaymentInvalid={catalog.isCashPaymentInvalid}
          isClosingOrder={state.isClosingOrder}
          onCancel={() => {
            state.setShowPaymentModal(false);
            state.setPaymentMethod('cash');
            state.setAmountReceived('');
            state.setAmountReceivedError('');
            state.setSelectedCustomer('');
          }}
          onConfirm={processPaymentAndClose}
          calcularCambio={calcularCambio}
        />

        <MesaDeleteModal
          isOpen={state.showDeleteModal}
          onCancel={() => {
            state.setShowDeleteModal(false);
            state.setMesaToDelete(null);
          }}
          onConfirm={async () => {
            if (!state.mesaToDelete) return;
            const mesaId = state.mesaToDelete.id;
            const snapshotMesas = state.mesas.slice();
            const deletedTable = snapshotMesas.find((m) => m.id === mesaId) || null;
            const deletedTableLabel = deletedTable?.table_number ? `#${deletedTable.table_number}` : '-';
            state.setMesas((prevMesas) => prevMesas.filter((m) => m.id !== mesaId));
            if (state.selectedMesa?.id === mesaId) {
              handleCloseModal();
            }
            state.setShowDeleteModal(false);
            state.setMesaToDelete(null);
            try {
              const deleteResult = await deleteTableCascadeOrders(mesaId, { businessId });
              state.setAlertType('success');
              state.setSuccessTitle('Mesa Eliminada');
              state.setSuccessDetails([{ label: 'Mesa', value: deletedTableLabel }]);
              state.setSuccess(true);
              setTimeout(() => state.setSuccess(false), 3000);
              if (!deleteResult?.__localOnly) {
                await loadMesas();
              }
            } catch (err) {
              const message = String(err?.message || '').trim();
              const code = String(err?.code || '').trim();
              const details = String(err?.details || '').trim();
              const hint = String(err?.hint || '').trim();
              const diag = [code ? `code=${code}` : null, hint ? `hint=${hint}` : null, details ? `details=${details}` : null]
                .filter(Boolean)
                .join(' | ');
              state.setError(
                `No se pudo eliminar la mesa. Revirtiendo estado.${message ? ` ${message}` : ''}${diag ? ` [${diag}]` : ''}`,
              );
              state.setMesas(snapshotMesas);
              setTimeout(() => state.setError(null), 5000);
            }
          }}
        />
      </motion.section>
    </AsyncStateWrapper>
  );
}

export default Mesas;
