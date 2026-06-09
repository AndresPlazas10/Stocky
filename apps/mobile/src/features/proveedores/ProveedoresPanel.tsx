import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { StockyButton } from '../../ui/StockyButton';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { STOCKY_COLORS } from '../../theme/tokens';
import { useProveedorData } from './hooks/useProveedorData';
import { useProveedorForm } from './hooks/useProveedorForm';
import { useProveedorMutations } from './hooks/useProveedorMutations';
import { SupplierCard } from './components/SupplierCard';
import { SupplierListHeader } from './components/SupplierListHeader';
import { SupplierFormModal } from './components/SupplierFormModal';
import { proveedoresStyles as styles } from './proveedoresStyles';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function ProveedoresPanel({ businessId, businessName, userId, source }: Props) {
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
    taxColumn: taxColumn as any,
    setTaxColumn: () => {},
    closeFormModal,
    refreshSuppliers,
    setError,
  });

  const suspendBackgroundList = showFormModal || showDeleteModal;

  return (
    <>
      <FlatList
        data={suspendBackgroundList ? [] : suppliers}
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
          <SupplierListHeader
            canManageSuppliers={canManageSuppliers}
            checkingPermissions={checkingPermissions}
            loading={loading}
            refreshing={refreshing}
            onCreate={openCreateModal}
          />
        }
        ListEmptyComponent={loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
            <Text style={styles.loadingText}>Cargando proveedores...</Text>
          </View>
        ) : (!suspendBackgroundList ? (
          <Text style={styles.emptyText}>No hay proveedores registrados.</Text>
        ) : null)}
        ItemSeparatorComponent={() => <View style={styles.listItemSeparator} />}
        ListFooterComponent={!suspendBackgroundList && hasMoreSuppliers ? (
          <View style={styles.loadMoreWrap}>
            <Text style={styles.loadMoreHint}>Mostrando {suppliers.length} proveedores</Text>
            <StockyButton onPress={loadMoreSuppliers} loading={loadingMore} variant="ghost">
              Cargar más proveedores
            </StockyButton>
          </View>
        ) : (
          <View style={styles.listFooterSpacer} />
        )}
        renderItem={({ item }) => (
          <SupplierCard
            supplier={item}
            canManageSuppliers={canManageSuppliers}
            onEdit={openEditModal}
            onDelete={askDeleteSupplier}
          />
        )}
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
        title="Eliminar proveedor"
        message={`¿Seguro que deseas eliminar el proveedor "${supplierToDelete?.business_name || 'seleccionado'}"?`}
        warning="Si tiene compras asociadas no se podrá eliminar. En ese caso, mantenlo para historial."
        itemLabel={supplierToDelete?.business_name || null}
        loading={deleting}
        onCancel={closeDeleteModal}
        onConfirm={confirmDeleteSupplier}
      />
    </>
  );
}
