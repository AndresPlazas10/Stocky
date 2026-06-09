import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, View, Text } from 'react-native';
import { STOCKY_COLORS } from '../../theme/tokens';
import { StockyButton } from '../../ui/StockyButton';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';
import { useInventoryProducts } from './hooks/useInventoryProducts';
import { useInventoryForm } from './hooks/useInventoryForm';
import { useInventoryMutations } from './hooks/useInventoryMutations';
import { useInventoryPermissions } from './hooks/useInventoryPermissions';
import { useInventorySearch } from './hooks/useInventorySearch';
import { InventoryListHeader } from './components/InventoryListHeader';
import { ProductCard } from './components/ProductCard';
import { ProductFormModal } from './components/ProductFormModal';
import { CategoryPickerModal } from './components/CategoryPickerModal';
import { UnitPickerModal } from './components/UnitPickerModal';
import { SupplierPickerModal } from './components/SupplierPickerModal';
import { DeactivateConfirmModal } from './components/DeactivateConfirmModal';
import { inventarioStyles as styles } from './inventarioStyles';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function InventarioPanel({ businessId, businessName, userId, source }: Props) {
  const {
    loading,
    refreshing,
    error,
    setError,
    products,
    suppliers,
    hasMoreProducts,
    loadingMore,
    suppliersRef,
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

  const { search, setSearch, filteredProducts } = useInventorySearch(products);

  const form = useInventoryForm();

  const mutations = useInventoryMutations({
    businessId,
    canManageProducts,
    form: form.form,
    editingProduct: form.editingProduct,
    closeFormModal: form.closeFormModal,
    refreshProducts,
    setError,
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
      { table: 'products', filter: businessId ? `business_id=eq.${businessId}` : undefined, onEvent: scheduleProductsRefresh },
      { table: 'suppliers', filter: businessId ? `business_id=eq.${businessId}` : undefined, onEvent: scheduleSuppliersRefresh },
    ],
    onSubscribed: () => { scheduleProductsRefresh(); scheduleSuppliersRefresh(); },
    onPollTick: () => { scheduleProductsRefresh(); scheduleSuppliersRefresh(); },
    onCleanup: () => {
      if (inventoryRealtimeRefreshTimerRef.current) { clearTimeout(inventoryRealtimeRefreshTimerRef.current); inventoryRealtimeRefreshTimerRef.current = null; }
      if (inventorySuppliersRefreshTimerRef.current) { clearTimeout(inventorySuppliersRefreshTimerRef.current); inventorySuppliersRefreshTimerRef.current = null; }
    },
  });

  const suspendBackgroundList = form.showFormModal
    || form.showUnitModal
    || form.showSupplierModal
    || mutations.showDeleteModal
    || mutations.showDeactivateModal;

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
        data={suspendBackgroundList ? [] : filteredProducts}
        keyExtractor={(item) => item.id}
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
        ListEmptyComponent={!suspendBackgroundList ? (
          <Text style={styles.emptyText}>No hay productos para la busqueda actual.</Text>
        ) : null}
        ItemSeparatorComponent={() => <View style={styles.listItemSeparator} />}
        ListFooterComponent={!suspendBackgroundList && hasMoreProducts ? (
          <View style={styles.loadMoreWrap}>
            <Text style={styles.loadMoreHint}>Mostrando {products.length} productos</Text>
            <StockyButton onPress={loadMoreProducts} loading={loadingMore} variant="ghost">
              Cargar más productos
            </StockyButton>
          </View>
        ) : (
          <View style={styles.listFooterSpacer} />
        )}
        renderItem={({ item }) => (
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
        )}
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
        onFormChange={(updates) => form.setForm((prev) => ({ ...prev, ...updates }))}
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
        title="Eliminar producto"
        message={`¿Seguro que quieres eliminar ${mutations.productTarget?.name || 'este producto'}?`}
        warning="Esta acción no se puede deshacer."
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
