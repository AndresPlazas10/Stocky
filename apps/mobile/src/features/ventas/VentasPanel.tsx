import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyMoneyText } from '../../ui/StockyMoneyText';
import { PrintReceiptConfirmModal } from '../../ui/PrintReceiptConfirmModal';
import { DayFilterCalendarModal } from '../../ui/DayFilterCalendarModal';
import { RecordFilterCard } from '../../ui/RecordFilterCard';
import { formatCop } from '../../utils/money';
import { getErrorMessage } from '../../utils/error';
import { listRecentVentas, type VentaRecord } from '../../services/ventasService';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';
import { useVentaCart } from './hooks/useVentaCart';
import { useVentaFilters } from './hooks/useVentaFilters';
import { useVentaCatalog } from './hooks/useVentaCatalog';
import { useVentaDetails } from './hooks/useVentaDetails';
import { useVentaPrint } from './hooks/useVentaPrint';
import { useVentaMutations } from './hooks/useVentaMutations';
import { useVentaPayment } from './hooks/useVentaPayment';
import { SaleCard } from './components/SaleCard';
import { SaleDetailsModal } from './components/SaleDetailsModal';
import { CreateSaleModal } from './components/CreateSaleModal';
import { SellerFilterModal } from './components/SellerFilterModal';
import { ventasStyles as s } from './ventasStyles';

type Props = {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
};

export function VentasPanel({ businessId, businessName, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [ventas, setVentas] = useState<VentaRecord[]>([]);
  const [showCreateSaleModal, setShowCreateSaleModal] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showFiltersExpanded, setShowFiltersExpanded] = useState(false);

  const {
    cart,
    cartTotal,
    addToCart,
    updateCartQuantity,
    clearCart: clearCartBase,
  } = useVentaCart();

  const { paymentMethod, setPaymentMethod, amountReceived, setAmountReceived, resetPayment } =
    useVentaPayment(cartTotal);

  const clearCart = useCallback(() => {
    clearCartBase();
    resetPayment();
  }, [clearCartBase, resetPayment]);

  const {
    catalogItems,
    setCatalogItems,
    loadingCatalog,
    searchCatalog,
    setSearchCatalog,
    isSaleSearchFocused,
    setIsSaleSearchFocused,
    firstVentaDayKey,
    loadCatalogData,
    refreshCatalogSilently,
    hasCatalogQuery,
    catalogFiltered,
  } = useVentaCatalog(businessId);

  const {
    dayFilter,
    setDayFilter,
    sellerFilter,
    setSellerFilter,
    currentPage,
    setCurrentPage,
    dayCalendarMonth,
    setDayCalendarMonth,
    showDayFilterModal,
    setShowDayFilterModal,
    showSellerFilterModal,
    setShowSellerFilterModal,
    minSelectableDayKey,
    maxSelectableDayKey,
    minSelectableDate,
    maxSelectableDate,
    sellerOptions,
    filteredVentas,
    totalPages,
    paginatedVentas,
    pageRange,
    canPrevPage,
    canNextPage,
    selectedDayLabel,
    selectedSellerLabel,
    openDayFilterCalendar,
    clearFilters,
  } = useVentaFilters(ventas, firstVentaDayKey);

  const {
    selectedVenta,
    selectedVentaDetails,
    loadingVentaDetails,
    ventaDetailsError,
    showVentaDetails,
    openVentaDetails,
    closeVentaDetails,
    refreshDetailsForCurrentVenta,
  } = useVentaDetails();

  const {
    showPrintModal,
    isPrinting,
    printCustomerName,
    setPrintCustomerName,
    showPrintModalForSale,
    handlePrintConfirm,
    handlePrintCancel,
    handlePrintSale,
  } = useVentaPrint(businessName, setError);

  const canDeleteSales = source === 'owner';

  const {
    submitting,
    ventaToDelete,
    setVentaToDelete,
    showDeleteVentaModal,
    setShowDeleteVentaModal,
    deletingVenta,
    cashChangeData,
    submitSale,
    askDeleteVenta,
    confirmDeleteVenta,
  } = useVentaMutations({
    businessId,
    source,
    cart,
    paymentMethod,
    amountReceived,
    cartTotal,
    catalogItems,
    selectedVenta,
    canDeleteSales,
    clearCart,
    refreshSales: async () => {
      setLoadingSales(true);
      setError(null);
      try {
        const recentSales = await listRecentVentas(businessId, 50, { forceRefresh: true });
        setVentas(recentSales);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo refrescar el historial.');
      } finally {
        setLoadingSales(false);
      }
    },
    setCatalogItems,
    showPrintModalForSale,
    setShowCreateSaleModal,
    setShowVentaDetails: () => {},
    setSelectedVenta: () => {},
    setSelectedVentaDetails: () => {},
    setVentas,
    setError,
  });

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const recentSales = await listRecentVentas(businessId, 50, { ttlMs: 45_000 });
      setVentas(recentSales);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas.');
    } finally {
      setLoading(false);
    }
    try {
      await loadCatalogData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo de ventas.');
    }
  }, [businessId, loadCatalogData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos
    void loadInitialData();
  }, [loadInitialData]);

  const refreshSalesSilently = useCallback(async () => {
    try {
      const recentSales = await listRecentVentas(businessId, 50, { forceRefresh: true });
      setVentas(recentSales);
    } catch (err) {
      console.error('[Ventas] error al refrescar ventas silenciosamente:', getErrorMessage(err));
    }
  }, [businessId]);

  const scheduleSalesRefresh = useCallback(() => {
    void refreshSalesSilently();
    void refreshDetailsForCurrentVenta();
  }, [refreshSalesSilently, refreshDetailsForCurrentVenta]);

  const scheduleCatalogRefresh = useCallback(() => {
    void refreshCatalogSilently();
  }, [refreshCatalogSilently]);

  useSupabaseRealtime({
    channelKey: 'ventas',
    businessId,
    tables: [
      {
        table: 'sales',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: scheduleSalesRefresh,
      },
      { table: 'sale_details', onEvent: scheduleSalesRefresh },
      {
        table: 'products',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: scheduleCatalogRefresh,
      },
      {
        table: 'combos',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: scheduleCatalogRefresh,
      },
    ],
    onSubscribed: scheduleSalesRefresh,
    onPollTick: scheduleSalesRefresh,
  });

  useFocusEffect(
    useCallback(() => {
      setLoadingSales(true);
      setError(null);
      listRecentVentas(businessId, 50, { forceRefresh: true })
        .then(setVentas)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'No se pudo refrescar el historial.'),
        )
        .finally(() => setLoadingSales(false));
    }, [businessId]),
  );

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () =>
      setIsKeyboardVisible(true),
    );
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () =>
      setIsKeyboardVisible(false),
    );
    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  const openCreateSaleModal = useCallback(() => {
    setShowCreateSaleModal(true);
    if (catalogItems.length === 0) {
      void loadCatalogData();
    }
  }, [catalogItems.length, loadCatalogData]);

  return (
    <>
      <View style={s.container}>
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          <View style={s.heroTop}>
            <View style={s.heroIconBox}>
              <Ionicons name="cart-outline" size={28} color={STOCKY_COLORS.white} />
            </View>
            <View style={s.heroTitleWrap}>
              <Text style={s.heroTitle}>Ventas</Text>
              <Text style={s.heroSubtitle}>Sistema de punto de venta</Text>
            </View>
          </View>

          <Pressable style={s.heroCreateButton} onPress={openCreateSaleModal}>
            <Ionicons name="add" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={s.heroCreateButtonText}>Nueva Venta</Text>
          </Pressable>
        </LinearGradient>

        {loading ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        {loadingSales ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}

        <RecordFilterCard
          title="Filtros de Ventas"
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
            icon: 'person-outline',
            label: 'Vendedor',
            selectedLabel: selectedSellerLabel,
            isActive: sellerFilter !== 'all',
            onOpen: () => setShowSellerFilterModal(true),
          }}
          onClearFilters={clearFilters}
        />

        <View style={s.paginationCard}>
          <Text style={s.paginationText}>
            Mostrando {pageRange.from} a {pageRange.to} de {filteredVentas.length} registros
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
                Página {currentPage} de {totalPages}
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

        {!loading && paginatedVentas.length === 0 ? (
          <Text style={s.emptyText}>No hay ventas para esos filtros.</Text>
        ) : null}

        {paginatedVentas.map((venta) => (
          <SaleCard
            key={venta.id}
            venta={venta}
            canDelete={canDeleteSales}
            onViewDetails={openVentaDetails}
            onPrint={handlePrintSale}
            onDelete={askDeleteVenta}
          />
        ))}
      </View>

      <CreateSaleModal
        visible={showCreateSaleModal}
        submitting={submitting}
        cart={cart}
        cartTotal={cartTotal}
        paymentMethod={paymentMethod}
        amountReceived={amountReceived}
        cashChangeData={cashChangeData}
        isKeyboardVisible={isKeyboardVisible}
        catalogItems={catalogItems}
        loadingCatalog={loadingCatalog}
        searchCatalog={searchCatalog}
        isSaleSearchFocused={isSaleSearchFocused}
        hasCatalogQuery={hasCatalogQuery}
        catalogFiltered={catalogFiltered}
        onClose={() => setShowCreateSaleModal(false)}
        onPaymentMethodChange={setPaymentMethod}
        onAmountReceivedChange={setAmountReceived}
        onSearchChange={setSearchCatalog}
        onSearchFocusChange={setIsSaleSearchFocused}
        onAddToCart={addToCart}
        onUpdateCartQuantity={updateCartQuantity}
        onClearCart={clearCart}
        onSubmit={() => void submitSale()}
      />

      <DayFilterCalendarModal
        visible={showDayFilterModal}
        dayFilter={dayFilter}
        dayCalendarMonth={dayCalendarMonth}
        minSelectableDate={minSelectableDate}
        maxSelectableDate={maxSelectableDate}
        minSelectableDayKey={minSelectableDayKey}
        maxSelectableDayKey={maxSelectableDayKey}
        onSelectDay={(key) => {
          setDayFilter(key);
          setCurrentPage(1);
          setShowDayFilterModal(false);
        }}
        onClose={() => setShowDayFilterModal(false)}
        onMonthChange={setDayCalendarMonth}
      />

      <SellerFilterModal
        visible={showSellerFilterModal}
        sellerFilter={sellerFilter}
        sellerOptions={sellerOptions}
        onSelect={(value) => {
          setSellerFilter(value);
          setCurrentPage(1);
          setShowSellerFilterModal(false);
        }}
        onClose={() => setShowSellerFilterModal(false)}
      />

      <SaleDetailsModal
        visible={showVentaDetails}
        selectedVenta={selectedVenta}
        selectedVentaDetails={selectedVentaDetails}
        loadingVentaDetails={loadingVentaDetails}
        ventaDetailsError={ventaDetailsError}
        onClose={closeVentaDetails}
      />

      <StockyDeleteConfirmModal
        visible={showDeleteVentaModal}
        title="Eliminar venta"
        message="Esta acción eliminará la venta y su detalle asociado."
        warning="No se puede deshacer."
        itemLabel={ventaToDelete ? `Total: ${formatCop(ventaToDelete.total)}` : null}
        loading={deletingVenta}
        onCancel={() => {
          if (deletingVenta) return;
          setShowDeleteVentaModal(false);
          setVentaToDelete(null);
        }}
        onConfirm={confirmDeleteVenta}
      />
      <PrintReceiptConfirmModal
        visible={showPrintModal}
        onConfirm={handlePrintConfirm}
        onCancel={handlePrintCancel}
        isLoading={isPrinting}
        customerName={printCustomerName}
        onCustomerNameChange={setPrintCustomerName}
      />
    </>
  );
}
