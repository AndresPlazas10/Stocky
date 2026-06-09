import { useCallback } from 'react';
import { FlatList, Text, View } from 'react-native';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { useComboData } from './hooks/useComboData';
import { useComboForm } from './hooks/useComboForm';
import { useComboMutations } from './hooks/useComboMutations';
import { useComboSearch } from './hooks/useComboSearch';
import { CombosListHeader } from './components/CombosListHeader';
import { ComboCard } from './components/ComboCard';
import { ComboFormModal } from './components/ComboFormModal';
import { ProductPickerModal } from './components/ProductPickerModal';
import { combosStyles as styles } from './combosStyles';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function CombosPanel({ businessId, businessName, userId, source }: Props) {
  const {
    loading,
    refreshing,
    error,
    setError,
    combos,
    setCombos,
    products,
    productsById,
    canManageCombos,
    checkingPermissions,
    refreshCombos,
    refreshProductsSilently,
  } = useComboData(businessId, userId, source);

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    productSearch,
    setProductSearch,
    filteredCombos,
    filterProductCatalog,
  } = useComboSearch(combos);

  const {
    showFormModal,
    editingCombo,
    form,
    setForm,
    showProductPickerModal,
    productPickerRowIndex,
    hasDuplicateProducts,
    openCreateModal,
    openEditModal,
    closeFormModal,
    handleAddItemRow,
    handleRemoveItemRow,
    handleItemChange,
    openProductPicker,
    closeProductPicker,
  } = useComboForm();

  const {
    saving,
    deleting,
    showDeleteModal,
    comboToDelete,
    submitForm,
    askDeleteCombo,
    confirmDeleteCombo,
    closeDeleteModal,
  } = useComboMutations({
    businessId,
    canManageCombos,
    form,
    editingCombo,
    hasDuplicateProducts,
    closeFormModal,
    refreshCombos,
    setCombos,
    setError,
  });

  const handleSelectProduct = useCallback((productId: string) => {
    if (productPickerRowIndex === null) return;
    handleItemChange(productPickerRowIndex, 'productoId', productId);
    closeProductPicker();
  }, [productPickerRowIndex, handleItemChange, closeProductPicker]);

  const productCatalogFiltered = filterProductCatalog(products);

  const suspendBackgroundList = showFormModal || showProductPickerModal || showDeleteModal;

  return (
    <>
      <FlatList
        data={suspendBackgroundList ? [] : filteredCombos}
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
          <CombosListHeader
            loading={loading}
            refreshing={refreshing}
            error={error}
            canManageCombos={canManageCombos}
            checkingPermissions={checkingPermissions}
            onOpenCreate={openCreateModal}
          />
        }
        ListEmptyComponent={!suspendBackgroundList && !loading ? (
          <Text style={styles.emptyText}>No hay combos para los filtros seleccionados.</Text>
        ) : null}
        ItemSeparatorComponent={() => <View style={styles.listItemSeparator} />}
        ListFooterComponent={<View style={styles.listFooterSpacer} />}
        renderItem={({ item }) => (
          <ComboCard
            combo={item}
            canManageCombos={canManageCombos}
            onEdit={openEditModal}
            onDelete={askDeleteCombo}
          />
        )}
      />

      <ComboFormModal
        visible={showFormModal}
        saving={saving}
        error={error}
        editingCombo={editingCombo}
        form={form}
        productsById={productsById}
        hasDuplicateProducts={hasDuplicateProducts}
        onClose={closeFormModal}
        onFormChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
        onSave={submitForm}
        onAddItemRow={handleAddItemRow}
        onRemoveItemRow={handleRemoveItemRow}
        onItemChange={handleItemChange}
        onOpenProductPicker={openProductPicker}
      />

      <ProductPickerModal
        visible={showProductPickerModal}
        productSearch={productSearch}
        onProductSearchChange={setProductSearch}
        productCatalogFiltered={productCatalogFiltered}
        formItems={form.items}
        productPickerRowIndex={productPickerRowIndex}
        onSelectProduct={handleSelectProduct}
        onClose={closeProductPicker}
      />

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title="Eliminar combo"
        message={`¿Seguro que deseas eliminar el combo "${comboToDelete?.nombre || 'seleccionado'}"?`}
        warning="Esta acción no se puede deshacer. Si el combo tiene movimientos asociados, desactívalo."
        itemLabel={comboToDelete?.nombre || null}
        loading={deleting}
        onCancel={closeDeleteModal}
        onConfirm={confirmDeleteCombo}
      />
    </>
  );
}
