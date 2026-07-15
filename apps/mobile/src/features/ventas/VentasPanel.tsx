import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyMoneyText } from '../../ui/StockyMoneyText';
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
import { useToastContext } from '../../hooks/useToastContext';
import { useToastMessages } from '../../hooks/useToastMessages';
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

const ventakeyExtractor = (item: VentaRecord) => item.id;

type VentasListHeaderProps = {
  loading: boolean;
  loadingSales: boolean;
  error: string | null;
  openCreateSaleModal: () => void;
  showFiltersExpanded: boolean;
  setShowFiltersExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDayLabel: string;
  dayFilter: string;
  openDayFilterCalendar: () => void;
  selectedSellerLabel: string;
  sellerFilter: string;
  setShowSellerFilterModal: React.Dispatch<React.SetStateAction<boolean>>;
  clearFilters: () => void;
  pageRange: { from: number; to: number };
  filteredVentas: VentaRecord[];
  currentPage: number;
  totalPages: number;
  canPrevPage: boolean;
  canNextPage: boolean;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  paginatedVentas: VentaRecord[];
};

const VentasListHeader = memo(function VentasListHeader({
  loading,
  loadingSales,
  error,
  openCreateSaleModal,
  showFiltersExpanded,
  setShowFiltersExpanded,
  selectedDayLabel,
  dayFilter,
  openDayFilterCalendar,
  selectedSellerLabel,
  sellerFilter,
  setShowSellerFilterModal,
  clearFilters,
  pageRange,
  filteredVentas,
  currentPage,
  totalPages,
  canPrevPage,
  canNextPage,
  setCurrentPage,
  paginatedVentas,
}: VentasListHeaderProps) {
  const { t } = useTranslation();
  return (
    <>
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
            <Text style={s.heroTitle}>{t('ventas.title')}</Text>
            <Text style={s.heroSubtitle}>{t('ventas.subtitle')}</Text>
          </View>
        </View>

        <Pressable style={s.heroCreateButton} onPress={openCreateSaleModal}>
          <Ionicons name="add" size={20} color="rgba(255,255,255,0.9)" />
          <Text style={s.heroCreateButtonText}>{t('buttons.newSale')}</Text>
        </Pressable>
      </LinearGradient>

      {loading ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
      {loadingSales ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
      {error ? (
        <View style={s.errorContainer}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={s.filtersWrapper}>
        <RecordFilterCard
          title={t('ventas.filters')}
          subtitle={t('ventas.filtersDescription')}
          expanded={showFiltersExpanded}
          onToggle={() => setShowFiltersExpanded((prev) => !prev)}
          dayField={{
            icon: 'calendar-clear-outline',
            label: t('ventasSection.day'),
            selectedLabel: selectedDayLabel,
            isActive: dayFilter !== 'all',
            onOpen: openDayFilterCalendar,
          }}
          secondField={{
            icon: 'person-outline',
            label: t('ventasSection.seller'),
            selectedLabel: selectedSellerLabel,
            isActive: sellerFilter !== 'all',
            onOpen: () => setShowSellerFilterModal(true),
          }}
          onClearFilters={clearFilters}
        />
      </View>

      <View style={[s.paginationCard, { marginTop: 4 }]}>
        <Text style={s.paginationText}>
          {t('ventas.showingRecords', {
            from: pageRange.from,
            to: pageRange.to,
            total: filteredVentas.length,
          })}
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
              {t('ventas.page', { current: currentPage, total: totalPages })}
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
        <Text style={s.emptyText}>{t('ventas.emptyState')}</Text>
      ) : null}
    </>
  );
});

export function VentasPanel({ businessId, businessName, source }: Props) {
  const { t } = useTranslation();
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

  const { isPrinting, handlePrintSale } = useVentaPrint(businessName, setError);

  const toast = useToastContext();
  const toastMessages = useToastMessages();
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
        setError(err instanceof Error ? err.message : t('errors.refreshFailed'));
      } finally {
        setLoadingSales(false);
      }
    },
    setCatalogItems,
    setShowCreateSaleModal,
    setShowVentaDetails: () => {},
    setSelectedVenta: () => {},
    setSelectedVentaDetails: () => {},
    setVentas,
    setError,
    onSaleCreated: (total) => {
      toast.showSuccess(toastMessages.ventas.registered(formatCop(total)));
    },
    onSaleDeleted: () => {
      toast.showSuccess(toastMessages.ventas.deleted());
    },
  });

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const recentSales = await listRecentVentas(businessId, 50, { ttlMs: 45_000 });
      setVentas(recentSales);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
    try {
      await loadCatalogData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ventasSection.catalogLoadError'));
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
      if (__DEV__)
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
        .catch((err) => setError(err instanceof Error ? err.message : t('errors.refreshFailed')))
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

  const renderVentaItem = useCallback(
    ({ item }: { item: VentaRecord }) => (
      <SaleCard
        venta={item}
        canDelete={canDeleteSales}
        isPrinting={isPrinting}
        onViewDetails={openVentaDetails}
        onPrint={handlePrintSale}
        onDelete={askDeleteVenta}
      />
    ),
    [canDeleteSales, isPrinting, openVentaDetails, handlePrintSale, askDeleteVenta],
  );

  return (
    <>
      <FlatList
        data={paginatedVentas}
        keyExtractor={ventakeyExtractor}
        renderItem={renderVentaItem}
        ListHeaderComponent={
          <VentasListHeader
            loading={loading}
            loadingSales={loadingSales}
            error={_error}
            openCreateSaleModal={openCreateSaleModal}
            showFiltersExpanded={showFiltersExpanded}
            setShowFiltersExpanded={setShowFiltersExpanded}
            selectedDayLabel={selectedDayLabel}
            dayFilter={dayFilter}
            openDayFilterCalendar={openDayFilterCalendar}
            selectedSellerLabel={selectedSellerLabel}
            sellerFilter={sellerFilter}
            setShowSellerFilterModal={setShowSellerFilterModal}
            clearFilters={clearFilters}
            pageRange={pageRange}
            filteredVentas={filteredVentas}
            currentPage={currentPage}
            totalPages={totalPages}
            canPrevPage={canPrevPage}
            canNextPage={canNextPage}
            setCurrentPage={setCurrentPage}
            paginatedVentas={paginatedVentas}
          />
        }
        style={s.screenList}
        ListHeaderComponentStyle={{ paddingBottom: 16 }}
        contentContainerStyle={s.container}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={8}
        updateCellsBatchingPeriod={50}
      />

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
        title={t('ventas.deleteTitle')}
        message={t('ventas.deleteMessage')}
        warning={t('errors.deleteFailed')}
        itemLabel={
          ventaToDelete ? `${t('ventasSection.total')} ${formatCop(ventaToDelete.total)}` : null
        }
        loading={deletingVenta}
        onCancel={() => {
          if (deletingVenta) return;
          setShowDeleteVentaModal(false);
          setVentaToDelete(null);
        }}
        onConfirm={confirmDeleteVenta}
      />
    </>
  );
}
