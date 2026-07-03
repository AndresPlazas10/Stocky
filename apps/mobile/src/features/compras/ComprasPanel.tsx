import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '../../lib/supabase';
import { STOCKY_COLORS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { DayFilterCalendarModal } from '../../ui/DayFilterCalendarModal';
import { RecordFilterCard } from '../../ui/RecordFilterCard';
import { formatCop } from '../../utils/money';
import { getErrorMessage } from '../../utils/error';
import {
  listRecentCompras,
  listCompraDetails,
  type CompraRecord,
} from '../../services/comprasService';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';
import { useCompraCart } from './hooks/useCompraCart';
import { useCompraCatalog } from './hooks/useCompraCatalog';
import { useCompraFilters } from './hooks/useCompraFilters';
import { useCompraDetails } from './hooks/useCompraDetails';
import { useCompraMutations } from './hooks/useCompraMutations';
import { PurchaseCard } from './components/PurchaseCard';
import { PurchaseDetailsModal } from './components/PurchaseDetailsModal';
import { CreatePurchaseModal } from './components/CreatePurchaseModal';
import { SupplierFilterModal } from './components/SupplierFilterModal';
import { comprasStyles as s } from './comprasStyles';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function ComprasPanel({ businessId, businessName, userId, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<CompraRecord[]>([]);
  const [showCreatePurchaseModal, setShowCreatePurchaseModal] = useState(false);
  const [showFiltersExpanded, setShowFiltersExpanded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [canDeletePurchases, setCanDeletePurchases] = useState(source === 'owner');

  const purchasesRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { cart, setCart, cartTotal, addProductToCart, updateCartQuantity } = useCompraCart();

  const {
    suppliers,
    loadingCatalog,
    productSearch,
    setProductSearch,
    supplierId,
    setSupplierId,
    loadCatalogData,
    refreshCatalogSilently,
    refreshProductsSilently,
    purchaseSupplierLabel,
    supplierNameById,
    productsFiltered,
  } = useCompraCatalog(businessId);

  const {
    dayFilter,
    setDayFilter,
    supplierFilter,
    setSupplierFilter,
    currentPage,
    setCurrentPage,
    dayCalendarMonth,
    setDayCalendarMonth,
    showDayFilterModal,
    setShowDayFilterModal,
    showSupplierFilterModal,
    setShowSupplierFilterModal,
    minSelectableDayKey,
    maxSelectableDayKey,
    minSelectableDate,
    maxSelectableDate,
    supplierOptions,
    filteredPurchases,
    totalPages,
    paginatedPurchases,
    pageRange,
    canPrevPage,
    canNextPage,
    selectedDayLabel,
    selectedSupplierLabel,
    openDayFilterCalendar,
    clearFilters,
  } = useCompraFilters(purchases, supplierNameById);

  const {
    selectedPurchase,
    setSelectedPurchase,
    selectedPurchaseDetails,
    setSelectedPurchaseDetails,
    showPurchaseDetails,
    setShowPurchaseDetails,
    loadingPurchaseDetails,
    selectedPurchaseIdRef,
    showPurchaseDetailsRef,
    openPurchaseDetails,
    closePurchaseDetails,
  } = useCompraDetails();

  const clearForm = useCallback(() => {
    setSupplierId('');
    setPaymentMethod('cash');
    setCart([]);
    setProductSearch('');
  }, [setSupplierId, setCart, setProductSearch]);

  const refreshPurchases = useCallback(async () => {
    setLoadingPurchases(true);
    setError(null);
    try {
      const purchasesResult = await listRecentCompras(businessId, 50, { forceRefresh: true });
      setPurchases(purchasesResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo refrescar el historial de compras.',
      );
    } finally {
      setLoadingPurchases(false);
    }
  }, [businessId]);

  const refreshPurchasesSilently = useCallback(async () => {
    try {
      const purchasesResult = await listRecentCompras(businessId, 50, { forceRefresh: true });
      setPurchases(purchasesResult);
    } catch (err) {
      console.error('[Compras] error al refrescar compras silenciosamente:', getErrorMessage(err));
    }
  }, [businessId]);

  const {
    creatingPurchase,
    purchaseToDelete,
    setPurchaseToDelete,
    showDeleteModal,
    setShowDeleteModal,
    deletingPurchase,
    submitPurchase,
    askDeletePurchase,
    confirmDeletePurchase,
  } = useCompraMutations({
    businessId,
    userId,
    supplierId,
    paymentMethod,
    cart,
    cartTotal,
    canDeletePurchases,
    selectedPurchase,
    clearForm,
    refreshPurchases,
    refreshProducts: refreshProductsSilently,
    setShowCreatePurchaseModal,
    setShowPurchaseDetails,
    setSelectedPurchase,
    setSelectedPurchaseDetails,
    setPurchases,
    setError,
  });

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const purchasesResult = await listRecentCompras(businessId, 50, { ttlMs: 45_000 });
      setPurchases(purchasesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las compras.');
    } finally {
      setLoading(false);
    }
    try {
      await loadCatalogData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catalogo de compras.');
    }
  }, [businessId, loadCatalogData]);

  const checkDeletePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanDeletePurchases(true);
      return;
    }
    setCheckingAdmin(true);
    try {
      const client = getSupabaseClient();
      const { data, error: roleError } = await client
        .from('employees')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      if (roleError) throw roleError;
      const role = String(data?.role || '')
        .trim()
        .toLowerCase();
      setCanDeletePurchases(role === 'admin' || role.includes('admin'));
    } catch {
      setCanDeletePurchases(false);
    } finally {
      setCheckingAdmin(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadInitialData();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void checkDeletePermission();
  }, [checkDeletePermission, loadInitialData]);

  const schedulePurchasesRefresh = useCallback(() => {
    if (purchasesRealtimeRefreshTimerRef.current) return;
    purchasesRealtimeRefreshTimerRef.current = setTimeout(() => {
      purchasesRealtimeRefreshTimerRef.current = null;
      void refreshPurchasesSilently();
      const currentPurchaseId = selectedPurchaseIdRef.current;
      if (showPurchaseDetailsRef.current && currentPurchaseId) {
        void listCompraDetails(currentPurchaseId)
          .then((details) => setSelectedPurchaseDetails(details))
          .catch(() => {});
      }
    }, 120);
  }, [
    refreshPurchasesSilently,
    selectedPurchaseIdRef,
    showPurchaseDetailsRef,
    setSelectedPurchaseDetails,
  ]);

  const scheduleCatalogRefresh = useCallback(() => {
    if (catalogRealtimeRefreshTimerRef.current) return;
    catalogRealtimeRefreshTimerRef.current = setTimeout(() => {
      catalogRealtimeRefreshTimerRef.current = null;
      void refreshCatalogSilently();
    }, 180);
  }, [refreshCatalogSilently]);

  useSupabaseRealtime({
    channelKey: 'compras',
    businessId,
    tables: [
      {
        table: 'purchases',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: schedulePurchasesRefresh,
      },
      { table: 'purchase_details', onEvent: schedulePurchasesRefresh },
      {
        table: 'products',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: scheduleCatalogRefresh,
      },
      {
        table: 'suppliers',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: scheduleCatalogRefresh,
      },
    ],
    onSubscribed: () => {
      schedulePurchasesRefresh();
      scheduleCatalogRefresh();
    },
    onPollTick: () => {
      schedulePurchasesRefresh();
      scheduleCatalogRefresh();
    },
    onCleanup: () => {
      if (purchasesRealtimeRefreshTimerRef.current) {
        clearTimeout(purchasesRealtimeRefreshTimerRef.current);
        purchasesRealtimeRefreshTimerRef.current = null;
      }
      if (catalogRealtimeRefreshTimerRef.current) {
        clearTimeout(catalogRealtimeRefreshTimerRef.current);
        catalogRealtimeRefreshTimerRef.current = null;
      }
    },
  });

  useFocusEffect(
    useCallback(() => {
      setLoadingPurchases(true);
      setError(null);
      listRecentCompras(businessId, 50, { forceRefresh: true })
        .then(setPurchases)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'No se pudo refrescar el historial.'),
        )
        .finally(() => setLoadingPurchases(false));
    }, [businessId]),
  );

  const openCreatePurchaseModal = useCallback(() => {
    setShowCreatePurchaseModal(true);
    void loadCatalogData(true);
  }, [loadCatalogData]);

  const resolvePurchaseSupplierLabel = useCallback(
    (purchase: CompraRecord) => {
      const embedded = purchase.supplier?.business_name || purchase.supplier?.contact_name;
      if (embedded) return embedded;
      const sid = String(purchase.supplier_id || '').trim();
      if (!sid) return 'Sin proveedor';
      return supplierNameById.get(sid) || 'Sin proveedor';
    },
    [supplierNameById],
  );

  const handleViewDetails = useCallback(
    (purchase: CompraRecord) => openPurchaseDetails(purchase, setError),
    [openPurchaseDetails, setError],
  );

  return (
    <>
      <FlatList
        data={paginatedPurchases}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PurchaseCard
            purchase={item}
            canDelete={canDeletePurchases}
            supplierLabel={resolvePurchaseSupplierLabel(item)}
            onViewDetails={handleViewDetails}
            onDelete={askDeletePurchase}
          />
        )}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.heroCard}
            >
              <View style={s.heroTop}>
                <View style={s.heroIconBox}>
                  <Ionicons name="bag-handle-outline" size={28} color={STOCKY_COLORS.white} />
                </View>
                <View style={s.heroTitleWrap}>
                  <Text style={s.heroTitle}>Compras</Text>
                  <Text style={s.heroSubtitle}>{businessName || businessId}</Text>
                </View>
              </View>

              <Pressable style={s.heroCreateButton} onPress={openCreatePurchaseModal}>
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.9)" />
                <Text style={s.heroCreateButtonText}>Nueva Compra</Text>
              </Pressable>
            </LinearGradient>

            {loading ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
            {loadingPurchases ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
            <RecordFilterCard
              title="Filtros de Compras"
              subtitle="Filtra por un día específico."
              expanded={showFiltersExpanded}
              onToggle={() => setShowFiltersExpanded((prev) => !prev)}
              dayField={{
                icon: 'calendar-clear-outline',
                label: 'Día',
                selectedLabel: selectedDayLabel,
                isActive: dayFilter !== 'all',
                onOpen: openDayFilterCalendar,
              }}
              secondField={{
                icon: 'storefront-outline',
                label: 'Proveedor',
                selectedLabel: selectedSupplierLabel,
                isActive: supplierFilter !== 'all',
                onOpen: () => setShowSupplierFilterModal(true),
              }}
              onClearFilters={clearFilters}
            />

            <View style={s.paginationCard}>
              <Text style={s.paginationText}>
                Mostrando {pageRange.from} a {pageRange.to} de {filteredPurchases.length} registros
              </Text>
              <View style={s.paginationControls}>
                <Pressable
                  style={[
                    s.paginationArrowButton,
                    canPrevPage && s.paginationArrowButtonActive,
                    !canPrevPage && s.buttonDisabled,
                  ]}
                  onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={!canPrevPage}
                >
                  <Ionicons name="chevron-back" size={19} color={canPrevPage ? '#4F46E5' : '#9CA3AF'} />
                </Pressable>
                <View style={s.paginationPageBadge}>
                  <Text style={s.paginationPageText}>
                    Pagina {currentPage} de {totalPages}
                  </Text>
                </View>
                <Pressable
                  style={[
                    s.paginationArrowButton,
                    canNextPage && s.paginationArrowButtonActive,
                    !canNextPage && s.buttonDisabled,
                  ]}
                  onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={!canNextPage}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color={canNextPage ? '#4F46E5' : '#9CA3AF'}
                  />
                </Pressable>
              </View>
            </View>

            {!loading && paginatedPurchases.length === 0 ? (
              <Text style={s.emptyTextLarge}>No hay compras para esos filtros.</Text>
            ) : null}
          </>
        }
        contentContainerStyle={s.container}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      <CreatePurchaseModal
        visible={showCreatePurchaseModal}
        creatingPurchase={creatingPurchase}
        cart={cart}
        cartTotal={cartTotal}
        paymentMethod={paymentMethod}
        supplierId={supplierId}
        suppliers={suppliers}
        productsFiltered={productsFiltered(cart)}
        loadingCatalog={loadingCatalog}
        productSearch={productSearch}
        purchaseSupplierLabel={purchaseSupplierLabel}
        onClose={() => setShowCreatePurchaseModal(false)}
        onPaymentMethodChange={setPaymentMethod}
        onSupplierSelect={(id) => {
          setSupplierId((prev) => (prev === id ? '' : id));
          setCart([]);
        }}
        onProductSearchChange={setProductSearch}
        onAddProduct={(product) => addProductToCart(product, supplierId, setError)}
        onUpdateCartQuantity={updateCartQuantity}
        onClearForm={clearForm}
        onSubmit={() => void submitPurchase()}
      />

      <DayFilterCalendarModal
        visible={showDayFilterModal}
        dayFilter={dayFilter}
        dayCalendarMonth={dayCalendarMonth}
        minSelectableDate={minSelectableDate}
        maxSelectableDate={maxSelectableDate}
        minSelectableDayKey={minSelectableDayKey}
        maxSelectableDayKey={maxSelectableDayKey}
        onSelectDay={(key: string) => {
          setDayFilter(key);
          setCurrentPage(1);
          setShowDayFilterModal(false);
        }}
        onClose={() => setShowDayFilterModal(false)}
        onMonthChange={setDayCalendarMonth}
      />

      <SupplierFilterModal
        visible={showSupplierFilterModal}
        supplierFilter={supplierFilter}
        supplierOptions={supplierOptions}
        onSelect={(value) => {
          setSupplierFilter(value);
          setCurrentPage(1);
          setShowSupplierFilterModal(false);
        }}
        onClose={() => setShowSupplierFilterModal(false)}
      />

      <PurchaseDetailsModal
        visible={showPurchaseDetails}
        selectedPurchase={selectedPurchase}
        selectedPurchaseDetails={selectedPurchaseDetails}
        loadingPurchaseDetails={loadingPurchaseDetails}
        supplierLabel={selectedPurchase ? resolvePurchaseSupplierLabel(selectedPurchase) : ''}
        onClose={closePurchaseDetails}
      />

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title="Eliminar compra"
        message="Al eliminar esta compra, el stock de productos se revertirá automáticamente."
        warning="No se puede deshacer."
        itemLabel={purchaseToDelete ? `Total: ${formatCop(purchaseToDelete.total)}` : null}
        loading={deletingPurchase || checkingAdmin}
        onCancel={() => {
          if (deletingPurchase) return;
          setShowDeleteModal(false);
          setPurchaseToDelete(null);
        }}
        onConfirm={confirmDeletePurchase}
      />
    </>
  );
}
