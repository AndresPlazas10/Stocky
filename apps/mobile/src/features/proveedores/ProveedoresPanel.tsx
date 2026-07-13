import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { StockyButton } from '../../ui/StockyButton';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { STOCKY_COLORS } from '../../theme/tokens';
import { useProveedorData } from './hooks/useProveedorData';
import { useProveedorForm } from './hooks/useProveedorForm';
import { useProveedorMutations } from './hooks/useProveedorMutations';
import { useToastContext } from '../../hooks/useToastContext';
import { useToastMessages } from '../../hooks/useToastMessages';
import { SupplierCard } from './components/SupplierCard';
import { SupplierListHeader } from './components/SupplierListHeader';
import { SupplierFormModal } from './components/SupplierFormModal';
import { proveedoresStyles as styles } from './proveedoresStyles';

const ItemSeparator = () => <View style={styles.listItemSeparator} />;

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function ProveedoresPanel({
  businessId,
  businessName: _businessName,
  userId,
  source,
}: Props) {
  const { t } = useTranslation();
  const toast = useToastContext();
  const toastMessages = useToastMessages();
  const {
    loading,
    refreshing,
    error,
    setError,
    suppliers,
    canManageSuppliers,
    checkingPermissions,
    taxColumn,
    hasMoreSuppliers,
    loadingMore,
    refreshSuppliers,
    loadMoreSuppliers,
  } = useProveedorData({ businessId, source, userId });

  const {
    showFormModal,
    editingSupplier,
    form,
    setForm,
    formDetailsReady,
    setFormDetailsReady,
    openCreateModal,
    openEditModal,
    closeFormModal,
  } = useProveedorForm();

  const {
    saving,
    deleting,
    showDeleteModal,
    supplierToDelete,
    submitForm,
    askDeleteSupplier,
    confirmDeleteSupplier,
    closeDeleteModal,
  } = useProveedorMutations({
    businessId,
    canManageSuppliers,
    form,
    editingSupplier,
    taxColumn,
    setTaxColumn: () => {},
    closeFormModal,
    refreshSuppliers,
    setError,
    onSupplierSaved: (isEdit, name) => {
      toast.showSuccess(
        isEdit ? toastMessages.proveedores.updated(name) : toastMessages.proveedores.created(name),
      );
    },
    onSupplierDeleted: (name) => {
      toast.showSuccess(toastMessages.proveedores.deleted(name));
    },
  });

  const suspendBackgroundList = showFormModal || showDeleteModal;

  const supplierKeyExtractor = useCallback((item: { id: string }) => item.id, []);

  const renderSupplierItem = useCallback(
    ({ item }: { item: any }) => (
      <SupplierCard
        supplier={item}
        canManageSuppliers={canManageSuppliers}
        onEdit={openEditModal}
        onDelete={askDeleteSupplier}
      />
    ),
    [canManageSuppliers, openEditModal, askDeleteSupplier],
  );

  return (
    <>
      <FlatList
        data={suspendBackgroundList ? [] : suppliers}
        keyExtractor={supplierKeyExtractor}
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
          <SupplierListHeader
            canManageSuppliers={canManageSuppliers}
            checkingPermissions={checkingPermissions}
            loading={loading}
            refreshing={refreshing}
            onCreate={openCreateModal}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={STOCKY_COLORS.primary900} />
              <Text style={styles.loadingText}>{t('proveedores.loading')}</Text>
            </View>
          ) : !suspendBackgroundList ? (
            <Text style={styles.emptyText}>{t('proveedores.emptyState')}</Text>
          ) : null
        }
        ItemSeparatorComponent={ItemSeparator}
        ListFooterComponent={
          !suspendBackgroundList && hasMoreSuppliers ? (
            <View style={styles.loadMoreWrap}>
              <Text style={styles.loadMoreHint}>
                {t('proveedores.showing', { count: suppliers.length })}
              </Text>
              <StockyButton onPress={loadMoreSuppliers} loading={loadingMore} variant="ghost">
                {t('proveedores.loadMore')}
              </StockyButton>
            </View>
          ) : (
            <View style={styles.listFooterSpacer} />
          )
        }
        renderItem={renderSupplierItem}
      />

      <SupplierFormModal
        visible={showFormModal}
        saving={saving}
        error={error}
        editingSupplier={editingSupplier}
        form={form}
        onFormChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
        onClose={closeFormModal}
        onSave={submitForm}
        formDetailsReady={formDetailsReady}
        setFormDetailsReady={setFormDetailsReady}
      />

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title={t('proveedores.deleteTitle')}
        message={t('proveedores.deleteMessage', {
          name: supplierToDelete?.business_name || 'seleccionado',
        })}
        warning={t('proveedores.deleteWarning')}
        itemLabel={supplierToDelete?.business_name || null}
        loading={deleting}
        onCancel={closeDeleteModal}
        onConfirm={confirmDeleteSupplier}
      />
    </>
  );
}
