import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Platform, Text, View } from 'react-native';
import { STOCKY_COLORS } from '../../theme/tokens';
import { StockyButton } from '../../ui/StockyButton';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { empleadosStyles as s } from './empleadosStyles';
import { EmployeeCard } from './components/EmployeeCard';
import { EmployeeFormModal } from './components/EmployeeFormModal';
import { CredentialsModal } from './components/CredentialsModal';
import { EmployeeListHeader } from './components/EmployeeListHeader';
import { useEmpleadoData } from './hooks/useEmpleadoData';
import { useEmpleadoForm } from './hooks/useEmpleadoForm';
import { useEmpleadoMutations } from './hooks/useEmpleadoMutations';
import { useToast } from '../../hooks/useToast';
import { StockyToast } from '../../ui/StockyToast';
import { TOAST_MESSAGES } from '../../constants/toastMessages';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function EmpleadosPanel({ businessId, userId, source }: Props) {
  const toast = useToast();
  const data = useEmpleadoData({ businessId, source, userId });
  const form = useEmpleadoForm();
  const mutations = useEmpleadoMutations({
    form,
    businessId,
    userId,
    canManageEmployees: data.canManageEmployees,
    onRefresh: data.refreshEmployees,
    onEmployeeCreated: (name) => {
      toast.showSuccess(TOAST_MESSAGES.empleados.created(name));
    },
    onEmployeeDeleted: () => {
      toast.showSuccess(TOAST_MESSAGES.empleados.deleted());
    },
  });

  const employeeKeyExtractor = useCallback((item: { id: string }) => item.id, []);

  const renderEmployeeItem = useCallback(
    ({ item }: { item: any }) => (
      <EmployeeCard
        employee={item}
        userId={userId}
        canManageEmployees={data.canManageEmployees}
        checkingPermissions={data.checkingPermissions}
        deleting={mutations.deleting}
        onDelete={mutations.askDeleteEmployee}
      />
    ),
    [userId, data.canManageEmployees, data.checkingPermissions, mutations.deleting, mutations.askDeleteEmployee],
  );

  return (
    <>
      <View style={s.container}>
        <EmployeeListHeader
          canManageEmployees={data.canManageEmployees}
          checkingPermissions={data.checkingPermissions}
          onInvite={form.openCreateModal}
        />

        {data.loading || data.refreshing ? (
          <ActivityIndicator color={STOCKY_COLORS.primary900} />
        ) : null}

        {data.loading ? (
          <View style={s.loadingBlock}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
            <Text style={s.loadingText}>Cargando empleados...</Text>
          </View>
        ) : (
          <FlatList
            data={data.employees}
            keyExtractor={employeeKeyExtractor}
            renderItem={renderEmployeeItem}
            refreshing={data.refreshing}
            onRefresh={data.refreshEmployees}
            onEndReached={data.loadMoreEmployees}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={<Text style={s.emptyText}>No hay empleados registrados.</Text>}
            ListFooterComponent={
              data.hasMoreEmployees ? (
                <View style={s.loadMoreWrap}>
                  <Text style={s.loadMoreHint}>Mostrando {data.employees.length} empleados</Text>
                  <StockyButton
                    onPress={data.loadMoreEmployees}
                    loading={data.loadingMore}
                    variant="ghost"
                  >
                    Cargar más empleados
                  </StockyButton>
                </View>
              ) : null
            }
            windowSize={7}
            maxToRenderPerBatch={8}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={5}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <EmployeeFormModal
        visible={form.showFormModal}
        form={form.form}
        creating={mutations.creating}
        error={mutations.error}
        onFormChange={(updates) => form.setForm({ ...form.form, ...updates })}
        onClose={form.closeCreateModal}
        onSubmit={mutations.submitCreateEmployee}
      />

      <StockyDeleteConfirmModal
        visible={form.showDeleteModal}
        title="Eliminar empleado"
        message={`¿Seguro que deseas eliminar a "${form.employeeToDelete?.full_name || 'este empleado'}"?`}
        warning="Esta acción revoca su acceso al negocio."
        itemLabel={form.employeeToDelete?.full_name || null}
        loading={mutations.deleting}
        onCancel={() => {
          if (mutations.deleting) return;
          form.setShowDeleteModal(false);
          form.setEmployeeToDelete(null);
        }}
        onConfirm={mutations.confirmDeleteEmployee}
      />

      <CredentialsModal
        visible={form.showCredentialsModal}
        credentials={form.generatedCredentials}
        onClose={() => {
          form.setShowCredentialsModal(false);
          form.setGeneratedCredentials(null);
        }}
      />

      <StockyToast
        visible={toast.toast.visible}
        type={toast.toast.type}
        title={toast.toast.title}
        message={toast.toast.message}
        ctaText={toast.toast.ctaText}
        durationMs={toast.toast.durationMs}
        onClose={toast.hideToast}
      />
    </>
  );
}
