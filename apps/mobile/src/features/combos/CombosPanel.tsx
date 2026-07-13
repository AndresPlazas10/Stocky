import { useCallback } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { useComboData } from './hooks/useComboData';
import { useComboForm } from './hooks/useComboForm';
import { useComboMutations } from './hooks/useComboMutations';
import { useComboSearch } from './hooks/useComboSearch';
import { useToastContext } from '../../hooks/useToastContext';
import { useToastMessages } from '../../hooks/useToastMessages';
import { CombosListHeader } from './components/CombosListHeader';
import { ComboCard } from './components/ComboCard';
import { ComboFormModal } from './components/ComboFormModal';
import { ProductPickerModal } from './components/ProductPickerModal';
import { combosStyles as styles } from './combosStyles';

const ItemSeparator = () => <View style={styles.listItemSeparator} />;

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function CombosPanel({ businessId, businessName: _businessName, userId, source }: Props) {
  const { t } = useTranslation();
  const toast = useToastContext();
  const toastMessages = useToastMessages();
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
  } = useComboData(businessId, userId, source);

  const { productSearch, setProductSearch, filteredCombos, filterProductCatalog } =
    useComboSearch(combos);

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
    onComboSaved: (isEdit, name) => {
      toast.showSuccess(
        isEdit ? toastMessages.combos.updated(name) : toastMessages.combos.created(name),
      );
    },
    onComboDeleted: (name) => {
      toast.showSuccess(toastMessages.combos.deleted(name));
    },
  });

  const handleSelectProduct = useCallback(
    (productId: string) => {
      if (productPickerRowIndex === null) return;
      handleItemChange(productPickerRowIndex, 'productoId', productId);
      closeProductPicker();
    },
    [productPickerRowIndex, handleItemChange, closeProductPicker],
  );

  const productCatalogFiltered = filterProductCatalog(products);

  const suspendBackgroundList = showFormModal || showProductPickerModal || showDeleteModal;

  const comboKeyExtractor = useCallback((item: { id: string }) => item.id, []);

  const renderComboItem = useCallback(
    ({ item }: { item: any }) => (
      <ComboCard
        combo={item}
        canManageCombos={canManageCombos}
        onEdit={openEditModal}
        onDelete={askDeleteCombo}
      />
    ),
    [canManageCombos, openEditModal, askDeleteCombo],
  );

  return (
    <>
      <FlatList
        data={suspendBackgroundList ? [] : filteredCombos}
        keyExtractor={comboKeyExtractor}
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
        ListEmptyComponent={
          !suspendBackgroundList && !loading ? (
            <Text style={styles.emptyText}>{t('combos.emptyState')}</Text>
          ) : null
        }
        ItemSeparatorComponent={ItemSeparator}
        ListFooterComponent={<View style={styles.listFooterSpacer} />}
        renderItem={renderComboItem}
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
        title={t('combos.deleteTitle')}
        message={t('combos.deleteMessage', { name: comboToDelete?.nombre || 'seleccionado' })}
        warning={t('combos.deleteWarning')}
        itemLabel={comboToDelete?.nombre || null}
        loading={deleting}
        onCancel={closeDeleteModal}
        onConfirm={confirmDeleteCombo}
      />
    </>
  );
}
