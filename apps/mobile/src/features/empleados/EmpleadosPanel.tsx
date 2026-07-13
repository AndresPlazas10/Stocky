import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useToastContext } from '../../hooks/useToastContext';
import { useToastMessages } from '../../hooks/useToastMessages';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

export function EmpleadosPanel({ businessId, userId, source }: Props) {
  const { t } = useTranslation();
  const toast = useToastContext();
  const toastMessages = useToastMessages();
  const data = useEmpleadoData({ businessId, source, userId });
  const form = useEmpleadoForm();
  const mutations = useEmpleadoMutations({
    form,
    businessId,
    userId,
    canManageEmployees: data.canManageEmployees,
    onRefresh: data.refreshEmployees,
    onEmployeeCreated: (name) => {
      toast.showSuccess(toastMessages.empleados.created(name));
    },
    onEmployeeDeleted: () => {
      toast.showSuccess(toastMessages.empleados.deleted());
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
    [
      userId,
      data.canManageEmployees,
      data.checkingPermissions,
      mutations.deleting,
      mutations.askDeleteEmployee,
    ],
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
            <Text style={s.loadingText}>{t('empleados.loading')}</Text>
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
            ListEmptyComponent={<Text style={s.emptyText}>{t('empleados.emptyState')}</Text>}
            ListFooterComponent={
              data.hasMoreEmployees ? (
                <View style={s.loadMoreWrap}>
                  <Text style={s.loadMoreHint}>
                    {t('empleados.showing', { count: data.employees.length })}
                  </Text>
                  <StockyButton
                    onPress={data.loadMoreEmployees}
                    loading={data.loadingMore}
                    variant="ghost"
                  >
                    {t('empleados.loadMore')}
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
        title={t('empleados.deleteTitle')}
        message={t('empleados.deleteMessage', {
          name: form.employeeToDelete?.full_name || t('empleados.deleteMessageFallback'),
        })}
        warning={t('empleados.deleteWarning')}
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
    </>
  );
}
