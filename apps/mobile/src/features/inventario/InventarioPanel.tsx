import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STOCKY_COLORS } from '../../theme/tokens';
import { StockyButton } from '../../ui/StockyButton';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';
import { useInventoryProducts } from './hooks/useInventoryProducts';
import { useInventoryForm } from './hooks/useInventoryForm';
import { useInventoryMutations } from './hooks/useInventoryMutations';
import { useInventoryPermissions } from './hooks/useInventoryPermissions';
import { useInventorySearch } from './hooks/useInventorySearch';
import { useToastContext } from '../../hooks/useToastContext';
import { useToastMessages } from '../../hooks/useToastMessages';
import { InventoryListHeader } from './components/InventoryListHeader';
import { ProductCard } from './components/ProductCard';
import { ProductFormModal } from './components/ProductFormModal';
import { CategoryPickerModal } from './components/CategoryPickerModal';
import { UnitPickerModal } from './components/UnitPickerModal';
import { SupplierPickerModal } from './components/SupplierPickerModal';
import { DeactivateConfirmModal } from './components/DeactivateConfirmModal';
import { inventarioStyles as styles } from './inventarioStyles';

const ItemSeparator = () => <View style={styles.listItemSeparator} />;

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function InventarioPanel({
  businessId,
  businessName: _businessName,
  userId,
  source,
}: Props) {
  const { t } = useTranslation();
  const {
    loading,
    refreshing,
    error,
    setError,
    products,
    suppliers,
    hasMoreProducts,
    loadingMore,
    inventoryRealtimeRefreshTimerRef,
    inventorySuppliersRefreshTimerRef,
    loadData,
    refreshProducts,
    refreshProductsSilently,
    refreshSuppliersSilently,
    loadMoreProducts,
  } = useInventoryProducts(businessId);

  const { canManageProducts, checkingPermissions, checkPermissions } = useInventoryPermissions(
    businessId,
    userId,
    source,
  );

  const toast = useToastContext();
  const toastMessages = useToastMessages();
  const { search, setSearch, filteredProducts } = useInventorySearch(products);

  const form = useInventoryForm();

  const handleFormChange = useCallback(
    (updates: Partial<typeof form.form>) => {
      form.setForm((prev) => ({ ...prev, ...updates }));
    },
    [form.setForm],
  );

  const mutations = useInventoryMutations({
    businessId,
    canManageProducts,
    form: form.form,
    editingProduct: form.editingProduct,
    closeFormModal: form.closeFormModal,
    refreshProducts,
    setError,
    onProductSaved: (isEdit, name) => {
      toast.showSuccess(
        isEdit ? toastMessages.productos.updated(name) : toastMessages.productos.created(name),
      );
    },
    onProductDeleted: (name) => {
      toast.showSuccess(toastMessages.productos.deleted(name));
    },
    onProductDeactivated: (name) => {
      toast.showSuccess(toastMessages.productos.deactivated(name));
    },
    onProductActivated: (name) => {
      toast.showSuccess(toastMessages.productos.activated(name));
    },
  });

  useEffect(() => {
    loadData();
    checkPermissions();
  }, [checkPermissions, loadData]);

  const scheduleProductsRefresh = useCallback(() => {
    if (inventoryRealtimeRefreshTimerRef.current) return;
    inventoryRealtimeRefreshTimerRef.current = setTimeout(() => {
      inventoryRealtimeRefreshTimerRef.current = null;
      void refreshProductsSilently();
    }, 120);
  }, [refreshProductsSilently, inventoryRealtimeRefreshTimerRef]);

  const scheduleSuppliersRefresh = useCallback(() => {
    if (inventorySuppliersRefreshTimerRef.current) return;
    inventorySuppliersRefreshTimerRef.current = setTimeout(() => {
      inventorySuppliersRefreshTimerRef.current = null;
      void refreshSuppliersSilently();
    }, 180);
  }, [refreshSuppliersSilently, inventorySuppliersRefreshTimerRef]);

  useSupabaseRealtime({
    channelKey: 'inventario',
    businessId,
    tables: [
      {
        table: 'products',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: scheduleProductsRefresh,
      },
      {
        table: 'suppliers',
        filter: businessId ? `business_id=eq.${businessId}` : undefined,
        onEvent: scheduleSuppliersRefresh,
      },
    ],
    onSubscribed: () => {
      scheduleProductsRefresh();
      scheduleSuppliersRefresh();
    },
    onPollTick: () => {
      scheduleProductsRefresh();
      scheduleSuppliersRefresh();
    },
    onCleanup: () => {
      if (inventoryRealtimeRefreshTimerRef.current) {
        clearTimeout(inventoryRealtimeRefreshTimerRef.current);
        inventoryRealtimeRefreshTimerRef.current = null;
      }
      if (inventorySuppliersRefreshTimerRef.current) {
        clearTimeout(inventorySuppliersRefreshTimerRef.current);
        inventorySuppliersRefreshTimerRef.current = null;
      }
    },
  });

  const productKeyExtractor = useCallback((item: { id: string }) => item.id, []);

  const renderProductItem = useCallback(
    ({ item }: { item: any }) => (
      <ProductCard
        product={item}
        canManageProducts={canManageProducts}
        deleting={mutations.deleting}
        openEditModal={(p) => {
          setError(null);
          form.openEditModal(p);
        }}
        askDeleteProduct={mutations.askDeleteProduct}
        activateProduct={mutations.activateProduct}
      />
    ),
    [
      canManageProducts,
      mutations.deleting,
      mutations.askDeleteProduct,
      mutations.activateProduct,
      setError,
      form.openEditModal,
    ],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={filteredProducts}
        keyExtractor={productKeyExtractor}
        style={styles.screenList}
        contentContainerStyle={styles.screenListContent}
        ListHeaderComponentStyle={styles.listHeader}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={40}
        ListHeaderComponent={
          <InventoryListHeader
            canManageProducts={canManageProducts}
            checkingPermissions={checkingPermissions}
            openCreateModal={() => {
              setError(null);
              form.openCreateModal();
            }}
            search={search}
            setSearch={setSearch}
            filteredCount={filteredProducts.length}
            totalCount={products.length}
            refreshing={refreshing}
          />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{t('inventario.emptyState')}</Text>}
        ItemSeparatorComponent={ItemSeparator}
        ListFooterComponent={
          hasMoreProducts ? (
            <View style={styles.loadMoreWrap}>
              <Text style={styles.loadMoreHint}>
                {t('inventario.showingProducts', { count: products.length })}
              </Text>
              <StockyButton onPress={loadMoreProducts} loading={loadingMore} variant="ghost">
                {t('inventario.loadMore')}
              </StockyButton>
            </View>
          ) : (
            <View style={styles.listFooterSpacer} />
          )
        }
        renderItem={renderProductItem}
      />

      <ProductFormModal
        visible={form.showFormModal}
        saving={mutations.saving}
        error={error}
        editingProduct={form.editingProduct}
        form={form.form}
        suppliers={suppliers}
        onClose={() => {
          form.closeFormModal();
          setError(null);
        }}
        onFormChange={handleFormChange}
        onSave={mutations.handleSaveProduct}
        onOpenCategoryPicker={() => form.setShowCategoryModal(true)}
        onOpenUnitPicker={() => {
          form.setShowCategoryModal(false);
          form.setShowUnitModal(true);
        }}
        onOpenSupplierPicker={() => {
          form.setShowCategoryModal(false);
          form.setShowSupplierModal(true);
        }}
        onRefreshSuppliers={refreshSuppliersSilently}
      />

      <CategoryPickerModal
        visible={form.showCategoryModal}
        selectedCategory={form.form.category}
        onSelect={form.selectCategory}
        onClose={() => form.setShowCategoryModal(false)}
      />

      <UnitPickerModal
        visible={form.showUnitModal}
        selectedUnit={form.form.unit}
        onSelect={form.selectUnit}
        onClose={() => form.setShowUnitModal(false)}
      />

      <SupplierPickerModal
        visible={form.showSupplierModal}
        selectedSupplierId={form.form.supplierId}
        suppliers={suppliers}
        onSelect={form.selectSupplier}
        onClose={() => form.setShowSupplierModal(false)}
      />

      <StockyDeleteConfirmModal
        visible={mutations.showDeleteModal}
        title={t('inventario.deleteTitle')}
        message={t('inventario.deleteMessage', {
          name: mutations.productTarget?.name || 'este producto',
        })}
        warning={t('errors.deleteFailed')}
        itemLabel={mutations.productTarget?.name || null}
        loading={mutations.deleting}
        onCancel={mutations.closeDeleteModals}
        onConfirm={mutations.confirmDeleteProduct}
      />

      <DeactivateConfirmModal
        visible={mutations.showDeactivateModal}
        deleting={mutations.deleting}
        productTarget={mutations.productTarget}
        deleteCheckResult={mutations.deleteCheckResult}
        onClose={mutations.closeDeleteModals}
        onConfirm={mutations.confirmDeactivateProduct}
      />
    </>
  );
}
