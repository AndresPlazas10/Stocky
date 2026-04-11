import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '../../lib/supabase';
import {
  deleteSupplierById,
  listSuppliersForManagement,
  saveSupplierWithTaxFallback,
  type ProveedorRecord,
  type SupplierTaxColumn,
} from '../../services/proveedoresService';
import { invalidatePurchaseCatalogCache } from '../../services/comprasService';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyModal } from '../../ui/StockyModal';
import { StockyStatusToast } from '../../ui/StockyStatusToast';
import { StockyButton } from '../../ui/StockyButton';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

type ProveedorFormState = {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  nit: string;
  notes: string;
};

const INITIAL_FORM: ProveedorFormState = {
  business_name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: '',
  nit: '',
  notes: '',
};
const SUPPLIERS_PAGE_SIZE = 40;

function normalizeRole(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function ProveedoresPanel({ businessId, businessName, userId, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [taxColumn, setTaxColumn] = useState<SupplierTaxColumn>('nit');

  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<ProveedorRecord[]>([]);

  const [canManageSuppliers, setCanManageSuppliers] = useState(source === 'owner');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ProveedorRecord | null>(null);
  const [form, setForm] = useState<ProveedorFormState>(INITIAL_FORM);
  const [showSupplierCreatedToast, setShowSupplierCreatedToast] = useState(false);
  const [showSupplierUpdatedToast, setShowSupplierUpdatedToast] = useState(false);
  const [showSupplierDeletedToast, setShowSupplierDeletedToast] = useState(false);
  const [supplierToastName, setSupplierToastName] = useState('');
  const [supplierToastNit, setSupplierToastNit] = useState('');
  const [formDetailsReady, setFormDetailsReady] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<ProveedorRecord | null>(null);
  const suppliersRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(1);
  const [hasMoreSuppliers, setHasMoreSuppliers] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: 0,
      });

      setSuppliers(result.suppliers);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores.');
    } finally {
      setLoading(false);
    }
  }, [businessId, taxColumn]);

  const refreshSuppliers = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: 0,
      });

      setSuppliers(result.suppliers);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la lista de proveedores.');
    } finally {
      setRefreshing(false);
    }
  }, [businessId, taxColumn]);

  const refreshSuppliersSilently = useCallback(async () => {
    try {
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: 0,
      });
      setSuppliers(result.suppliers);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(1);
    } catch {
      // no-op
    }
  }, [businessId, taxColumn]);

  const loadMoreSuppliers = useCallback(async () => {
    if (loadingMore || !hasMoreSuppliers) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await listSuppliersForManagement({
        businessId,
        preferredTaxColumn: taxColumn,
        limit: SUPPLIERS_PAGE_SIZE,
        offset: (nextPage - 1) * SUPPLIERS_PAGE_SIZE,
      });
      setSuppliers((prev) => [...prev, ...result.suppliers]);
      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }
      setHasMoreSuppliers(result.suppliers.length === SUPPLIERS_PAGE_SIZE);
      setPage(nextPage);
    } catch {
      // no-op
    } finally {
      setLoadingMore(false);
    }
  }, [businessId, hasMoreSuppliers, loadingMore, page, taxColumn]);

  const checkManagePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanManageSuppliers(true);
      return;
    }

    setCheckingPermissions(true);
    try {
      const client = getSupabaseClient();
      const { data, error: roleError } = await client
        .from('employees')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (roleError) throw roleError;
      const role = normalizeRole(data?.role);
      setCanManageSuppliers(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageSuppliers(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    loadData();
    checkManagePermission();
  }, [checkManagePermission, loadData]);

  useEffect(() => {
    const normalizedBusinessId = String(businessId || '').trim();
    if (!normalizedBusinessId) return undefined;

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return undefined;
    }

    const scheduleSuppliersRefresh = () => {
      if (cancelled || suppliersRealtimeRefreshTimerRef.current) return;
      suppliersRealtimeRefreshTimerRef.current = setTimeout(() => {
        suppliersRealtimeRefreshTimerRef.current = null;
        void refreshSuppliersSilently();
      }, 120);
    };

    const channel = client
      .channel(`mobile-proveedores:${normalizedBusinessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'suppliers',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleSuppliersRefresh);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        scheduleSuppliersRefresh();
      }
    });

    fallbackTimer = setInterval(() => {
      scheduleSuppliersRefresh();
    }, 20000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (suppliersRealtimeRefreshTimerRef.current) {
        clearTimeout(suppliersRealtimeRefreshTimerRef.current);
        suppliersRealtimeRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [businessId, refreshSuppliersSilently]);

  useEffect(() => {
    if (!showFormModal) {
      setFormDetailsReady(false);
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setFormDetailsReady(true);
      }
    });

    return () => {
      cancelled = true;
      (task as { cancel?: () => void }).cancel?.();
    };
  }, [showFormModal]);

  const resetFormState = useCallback(() => {
    setError(null);
    setEditingSupplier(null);
    setForm(INITIAL_FORM);
  }, []);

  const openCreateModal = useCallback(() => {
    resetFormState();
    setShowFormModal(true);
  }, [resetFormState]);

  const openEditModal = useCallback((supplier: ProveedorRecord) => {
    setEditingSupplier(supplier);
    setForm({
      business_name: supplier.business_name || '',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      nit: supplier.nit || '',
      notes: supplier.notes || '',
    });
    setShowFormModal(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    resetFormState();
  }, [resetFormState]);

  const submitForm = useCallback(async () => {
    if (saving || !canManageSuppliers) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const businessName = String(form.business_name || '').trim();
      if (!businessName) {
        throw new Error('El nombre del proveedor es obligatorio.');
      }

      const result = await saveSupplierWithTaxFallback({
        businessId,
        supplierId: editingSupplier?.id || null,
        preferredTaxColumn: taxColumn,
        formData: {
          business_name: businessName,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          notes: form.notes,
          nit: form.nit,
        },
      });

      if (result.taxColumn !== taxColumn) {
        setTaxColumn(result.taxColumn);
      }

      setSupplierToastName(businessName);
      setSupplierToastNit(form.nit || supplierToastNit);
      if (editingSupplier?.id) {
        setShowSupplierUpdatedToast(true);
      } else {
        setShowSupplierCreatedToast(true);
      }
      setSuccess(
        editingSupplier?.id
          ? 'Proveedor actualizado correctamente.'
          : 'Proveedor creado correctamente.',
      );
      invalidatePurchaseCatalogCache(businessId);
      closeFormModal();
      await refreshSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el proveedor.');
    } finally {
      setSaving(false);
    }
  }, [businessId, canManageSuppliers, closeFormModal, editingSupplier?.id, form, refreshSuppliers, saving, taxColumn]);

  const askDeleteSupplier = useCallback((supplier: ProveedorRecord) => {
    if (!canManageSuppliers) return;
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  }, [canManageSuppliers]);

  const confirmDeleteSupplier = useCallback(async () => {
    if (!supplierToDelete?.id || deleting || !canManageSuppliers) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteSupplierById({
        supplierId: supplierToDelete.id,
        businessId,
      });
      setSupplierToastName(supplierToDelete.business_name || 'Proveedor');
      setSupplierToastNit(supplierToDelete.nit || '');
      setShowSupplierDeletedToast(true);
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      setSuccess('Proveedor eliminado correctamente.');
      invalidatePurchaseCatalogCache(businessId);
      await refreshSuppliers();
    } catch (err: any) {
      if (String(err?.code || '') === '23503') {
        setError('No se puede eliminar este proveedor porque tiene compras asociadas.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo eliminar el proveedor.');
      }
    } finally {
      setDeleting(false);
    }
  }, [businessId, canManageSuppliers, deleting, refreshSuppliers, supplierToDelete]);

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
        ListHeaderComponent={(
          <View style={styles.container}>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Ionicons name="business-outline" size={56} color="#C9CBD2" />
                <View style={styles.heroTitleWrap}>
                  <Text style={styles.heroTitle}>Proveedores</Text>
                  <Text style={styles.heroSubtitle}>Gestiona tu red de proveedores</Text>
                </View>
              </View>

              <Pressable
                style={[styles.heroCreateButtonWrap, (!canManageSuppliers || checkingPermissions) && styles.buttonDisabled]}
                onPress={openCreateModal}
                disabled={!canManageSuppliers || checkingPermissions}
              >
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.heroCreateButton}
                >
                  <Ionicons name="add" size={22} color="#D1D5DB" />
                  <Text style={styles.heroCreateButtonText}>Nuevo Proveedor</Text>
                </LinearGradient>
              </Pressable>
            </View>

            {(loading || refreshing) ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
          </View>
        )}
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
        renderItem={({ item: supplier }) => (
          <View style={styles.supplierCard}>
            <View style={styles.supplierHeader}>
              <View style={styles.supplierHeaderMain}>
                <Ionicons name="business-outline" size={24} color="#111827" />
                <Text style={styles.supplierTitle} numberOfLines={1}>
                  {supplier.business_name}
                </Text>
              </View>
            </View>

            <View style={styles.supplierTagRow}>
              <View style={styles.supplierNitTag}>
                <Ionicons name="document-text-outline" size={13} color="#111827" />
                <Text style={styles.supplierNitTagText}>NIT: {supplier.nit || 'Sin NIT'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.supplierInfoGrid}>
              <View style={styles.supplierInfoCell}>
                <View style={styles.infoTitleRow}>
                  <Ionicons name="person-outline" size={16} color="#111827" />
                  <Text style={styles.infoLabel}>CONTACTO</Text>
                </View>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {supplier.contact_name || 'Sin contacto'}
                </Text>
              </View>

              <View style={styles.supplierInfoCell}>
                <View style={styles.infoTitleRow}>
                  <Ionicons name="mail-outline" size={16} color="#111827" />
                  <Text style={styles.infoLabel}>EMAIL</Text>
                </View>
                <Text style={styles.infoLink} numberOfLines={2}>
                  {supplier.email || 'Sin email'}
                </Text>
              </View>

              <View style={styles.supplierInfoCell}>
                <View style={styles.infoTitleRow}>
                  <Ionicons name="call-outline" size={16} color="#111827" />
                  <Text style={styles.infoLabel}>TELÉFONO</Text>
                </View>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {supplier.phone || 'Sin teléfono'}
                </Text>
              </View>

              <View style={styles.supplierInfoCell}>
                <View style={styles.infoTitleRow}>
                  <Ionicons name="location-outline" size={16} color="#111827" />
                  <Text style={styles.infoLabel}>DIRECCIÓN</Text>
                </View>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {supplier.address || 'Sin dirección'}
                </Text>
              </View>

              {supplier.notes ? (
                <View style={[styles.supplierInfoCell, styles.supplierInfoCellFull]}>
                  <Text style={styles.notesLabel}>NOTAS</Text>
                  <Text style={styles.notesText}>{supplier.notes}</Text>
                </View>
              ) : null}
            </View>

            {canManageSuppliers ? (
              <>
                <View style={styles.divider} />
                <View style={styles.supplierActionsRow}>
                  <Pressable style={[styles.supplierEditButton, styles.supplierActionHalf]} onPress={() => openEditModal(supplier)}>
                    <Ionicons name="create-outline" size={18} color="#DDE6FF" />
                    <Text style={styles.supplierEditButtonText}>Editar</Text>
                  </Pressable>
                  <Pressable style={[styles.supplierDeleteButton, styles.supplierActionHalf]} onPress={() => askDeleteSupplier(supplier)}>
                    <Ionicons name="trash-outline" size={18} color="#FFE4E6" />
                    <Text style={styles.supplierDeleteButtonText}>Eliminar</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        )}
      />

      <StockyModal
        visible={showFormModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="fade"
        animationDurationMs={180}
        deferContent
        deferFallback={(
          <View style={styles.formDeferredFallback}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
            <Text style={styles.formDeferredFallbackText}>Cargando formulario...</Text>
          </View>
        )}
        bodyFlex
        sheetStyle={styles.supplierFormSheet}
        contentContainerStyle={styles.supplierFormContent}
        perfTag="proveedores.form_proveedor"
        onClose={closeFormModal}
        headerSlot={(
          <View style={styles.supplierFormHeader}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.supplierFormHeaderIconWrap}
            >
              <Ionicons name={editingSupplier ? 'create-outline' : 'add'} size={30} color="#D1D5DB" />
            </LinearGradient>
            <Text style={styles.supplierFormHeaderTitle}>
              {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </Text>
            <Pressable style={[styles.supplierFormHeaderClose, saving && styles.buttonDisabled]} onPress={closeFormModal} disabled={saving}>
              <Ionicons name="close" size={34} color="#111827" />
            </Pressable>
          </View>
        )}
        footerStyle={styles.supplierFormFooter}
        footer={(
          <View style={styles.supplierFormFooterRow}>
            <Pressable
              style={[styles.supplierFormCancelButton, saving && styles.buttonDisabled]}
              onPress={closeFormModal}
              disabled={saving}
            >
              <Text style={styles.supplierFormCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.supplierFormSaveButton, saving && styles.buttonDisabled]}
              onPress={submitForm}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#F5F3FF" /> : null}
              <Text style={styles.supplierFormSaveText}>
                {saving ? 'Guardando...' : (editingSupplier ? 'Actualizar' : 'Guardar')}
              </Text>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.supplierFormFields}>
          {error ? (
            <View style={styles.formErrorCard}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.formErrorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Nombre de la Empresa *</Text>
            <TextInput
              value={form.business_name}
              onChangeText={(next) => setForm((prev) => ({ ...prev, business_name: next }))}
              style={styles.input}
            />
          </View>

          {formDetailsReady ? (
            <>
              <View style={styles.formRow}>
                <View style={[styles.fieldGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Persona de Contacto</Text>
                  <TextInput
                    value={form.contact_name}
                    onChangeText={(next) => setForm((prev) => ({ ...prev, contact_name: next }))}
                    style={styles.input}
                  />
                </View>

                <View style={[styles.fieldGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>NIT</Text>
                  <TextInput
                    value={form.nit}
                    onChangeText={(next) => setForm((prev) => ({ ...prev, nit: next }))}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.fieldGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    value={form.email}
                    onChangeText={(next) => setForm((prev) => ({ ...prev, email: next }))}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>

                <View style={[styles.fieldGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Teléfono</Text>
                  <TextInput
                    value={form.phone}
                    onChangeText={(next) => setForm((prev) => ({ ...prev, phone: next }))}
                    style={styles.input}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.fieldGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Dirección</Text>
                  <TextInput
                    value={form.address}
                    onChangeText={(next) => setForm((prev) => ({ ...prev, address: next }))}
                    style={styles.input}
                  />
                </View>

                <View style={[styles.fieldGroup, styles.formCol]}>
                  <Text style={styles.inputLabel}>Notas</Text>
                  <TextInput
                    value={form.notes}
                    onChangeText={(next) => setForm((prev) => ({ ...prev, notes: next }))}
                    style={[styles.input, styles.textArea]}
                    multiline
                  />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.formSectionLoader}>
              <ActivityIndicator color={STOCKY_COLORS.primary900} />
              <Text style={styles.formSectionLoaderText}>Cargando campos adicionales...</Text>
            </View>
          )}
        </View>
      </StockyModal>

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title="Eliminar proveedor"
        message={`¿Seguro que deseas eliminar el proveedor "${supplierToDelete?.business_name || 'seleccionado'}"?`}
        warning="Si tiene compras asociadas no se podrá eliminar. En ese caso, mantenlo para historial."
        itemLabel={supplierToDelete?.business_name || null}
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setShowDeleteModal(false);
          setSupplierToDelete(null);
        }}
        onConfirm={confirmDeleteSupplier}
      />
      <StockyStatusToast
        visible={showSupplierCreatedToast}
        title="Proveedor Creado"
        primaryLabel="Proveedor"
        primaryValue={supplierToastName || 'Proveedor'}
        secondaryLabel="NIT"
        secondaryValue={supplierToastNit || 'Sin NIT'}
        durationMs={1200}
        onClose={() => setShowSupplierCreatedToast(false)}
      />
      <StockyStatusToast
        visible={showSupplierUpdatedToast}
        title="Proveedor Actualizado"
        primaryLabel="Proveedor"
        primaryValue={supplierToastName || 'Proveedor'}
        secondaryLabel="NIT"
        secondaryValue={supplierToastNit || 'Sin NIT'}
        durationMs={1200}
        onClose={() => setShowSupplierUpdatedToast(false)}
      />
      <StockyStatusToast
        visible={showSupplierDeletedToast}
        title="Proveedor Eliminado"
        primaryLabel="Proveedor"
        primaryValue={supplierToastName || 'Proveedor'}
        secondaryLabel="Estado"
        secondaryValue="Eliminado"
        durationMs={1200}
        onClose={() => setShowSupplierDeletedToast(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screenList: {
    flex: 1,
  },
  screenListContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
  },
  listHeader: {
    paddingBottom: 16,
  },
  container: {
    gap: 16,
  },
  listItemSeparator: {
    height: 16,
  },
  listFooterSpacer: {
    height: 4,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: '#111827',
    fontSize: 27 * 1.08,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#4B5563',
    fontSize: 17 * 1.08,
    fontWeight: '500',
  },
  heroCreateButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  heroCreateButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  heroCreateButtonText: {
    color: '#D1D5DB',
    fontSize: 18 * 1.08,
    fontWeight: '600',
  },
  loadingBlock: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  formErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  formErrorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  supplierCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supplierHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  supplierTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  supplierTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  supplierNitTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  supplierNitTagText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  supplierInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  supplierInfoCell: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  supplierInfoCellFull: {
    width: '100%',
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
  },
  infoLink: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  notesLabel: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  notesText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  supplierActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  supplierActionHalf: {
    flex: 1,
  },
  supplierEditButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },
  supplierEditButtonText: {
    color: '#DDE6FF',
    fontSize: 13,
    fontWeight: '600',
  },
  supplierDeleteButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#FF002A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },
  supplierDeleteButtonText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '600',
  },
  supplierFormSheet: {
    maxWidth: 900,
    maxHeight: '92%',
    borderRadius: 22,
    borderColor: '#D6DDE7',
    backgroundColor: '#FFFFFF',
  },
  supplierFormContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  supplierFormHeader: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supplierFormHeaderIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierFormHeaderTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  supplierFormHeaderClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierFormFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  supplierFormFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  supplierFormCancelButton: {
    minHeight: 40,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  supplierFormCancelText: {
    color: '#5B21B6',
    fontSize: 12,
    fontWeight: '800',
  },
  supplierFormSaveButton: {
    minHeight: 40,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    flex: 1,
  },
  supplierFormSaveText: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '800',
  },
  supplierFormFields: {
    gap: 10,
  },
  formDeferredFallback: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  formDeferredFallbackText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  formSectionLoader: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  formSectionLoaderText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  fieldGroup: {
    gap: 8,
  },
  inputLabel: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalCancelText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  modalSaveButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: STOCKY_COLORS.primary900,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalSaveText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: STOCKY_COLORS.errorText,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalDangerText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteText: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  deleteSubtext: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  loadMoreWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadMoreHint: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
