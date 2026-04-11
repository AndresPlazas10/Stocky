import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '../../lib/supabase';
import { formatCop } from '../../services/mesasService';
import {
  COMBO_STATUS,
  createComboByBusinessId,
  deleteComboByBusinessAndId,
  listComboProducts,
  listCombosByBusiness,
  setComboStatusByBusinessAndId,
  updateComboByBusinessAndId,
  type ComboProductRecord,
  type ComboRecord,
  type ComboStatus,
} from '../../services/combosService';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyMoneyText } from '../../ui/StockyMoneyText';
import { StockyModal } from '../../ui/StockyModal';
import { StockyStatusToast } from '../../ui/StockyStatusToast';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

type ComboStatusFilter = 'all' | ComboStatus;

type ComboFormItemState = {
  productoId: string;
  cantidad: string;
};

type ComboFormState = {
  nombre: string;
  precioVenta: string;
  descripcion: string;
  estado: ComboStatus;
  items: ComboFormItemState[];
};

const EMPTY_FORM_ITEM: ComboFormItemState = {
  productoId: '',
  cantidad: '1',
};

function createInitialForm(): ComboFormState {
  return {
    nombre: '',
    precioVenta: '',
    descripcion: '',
    estado: COMBO_STATUS.ACTIVE,
    items: [{ ...EMPTY_FORM_ITEM }],
  };
}

function normalizeRole(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeStatus(value: unknown): ComboStatus {
  return String(value || '').trim().toLowerCase() === COMBO_STATUS.INACTIVE
    ? COMBO_STATUS.INACTIVE
    : COMBO_STATUS.ACTIVE;
}

function parseMoneyText(value: string): number {
  const raw = String(value || '').trim().replace(/\s+/g, '');
  if (!raw) return NaN;
  if (raw.includes(',')) {
    return Number(raw.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    return Number(raw.replace(/\./g, ''));
  }
  return Number(raw.replace(/,/g, ''));
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

function formatComboStatusLabel(status: ComboStatus): string {
  return status === COMBO_STATUS.ACTIVE ? 'Activo' : 'Inactivo';
}

function buildComboCompositionText(combo: ComboRecord): string {
  const items = Array.isArray(combo.combo_items) ? combo.combo_items : [];
  if (items.length === 0) return 'Sin productos';

  const text = items
    .map((item) => `${item.cantidad} x ${item.product?.name || 'Producto'}`)
    .join(', ');

  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}

function ComboStatusSelector({
  value,
  onChange,
}: {
  value: ComboStatusFilter;
  onChange: (next: ComboStatusFilter) => void;
}) {
  const options: Array<{ value: ComboStatusFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: COMBO_STATUS.ACTIVE, label: 'Activos' },
    { value: COMBO_STATUS.INACTIVE, label: 'Inactivos' },
  ];

  return (
    <View style={styles.filterRow}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.filterChip, selected && styles.filterChipSelected]}
          >
            <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CombosPanel({ businessId, businessName, userId, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);

  const [combos, setCombos] = useState<ComboRecord[]>([]);
  const [products, setProducts] = useState<ComboProductRecord[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComboStatusFilter>('all');
  const [productSearch, setProductSearch] = useState('');

  const [canManageCombos, setCanManageCombos] = useState(source === 'owner');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboRecord | null>(null);
  const [form, setForm] = useState<ComboFormState>(createInitialForm);
  const [showProductPickerModal, setShowProductPickerModal] = useState(false);
  const [productPickerRowIndex, setProductPickerRowIndex] = useState<number | null>(null);
  const [showComboCreatedToast, setShowComboCreatedToast] = useState(false);
  const [showComboUpdatedToast, setShowComboUpdatedToast] = useState(false);
  const [showComboDeletedToast, setShowComboDeletedToast] = useState(false);
  const [showComboDeactivatedToast, setShowComboDeactivatedToast] = useState(false);
  const [comboToastName, setComboToastName] = useState('');
  const [comboToastPrice, setComboToastPrice] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [comboToDelete, setComboToDelete] = useState<ComboRecord | null>(null);
  const combosRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const combosProductsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productsById = useMemo(() => {
    const map = new Map<string, ComboProductRecord>();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const hasDuplicateProducts = useMemo(() => {
    const seen = new Set<string>();
    for (const item of form.items) {
      const id = String(item.productoId || '').trim();
      if (!id) continue;
      if (seen.has(id)) return true;
      seen.add(id);
    }
    return false;
  }, [form.items]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCombos, nextProducts] = await Promise.all([
        listCombosByBusiness(businessId),
        listComboProducts(businessId),
      ]);
      setCombos(nextCombos);
      setProducts(nextProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los combos.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const refreshCombos = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const nextCombos = await listCombosByBusiness(businessId);
      setCombos(nextCombos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la lista de combos.');
    } finally {
      setRefreshing(false);
    }
  }, [businessId]);

  const refreshCombosSilently = useCallback(async () => {
    try {
      const nextCombos = await listCombosByBusiness(businessId);
      setCombos(nextCombos);
    } catch {
      // no-op
    }
  }, [businessId]);

  const refreshProductsSilently = useCallback(async () => {
    try {
      const nextProducts = await listComboProducts(businessId);
      setProducts(nextProducts);
    } catch {
      // no-op
    }
  }, [businessId]);

  const checkManagePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanManageCombos(true);
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
      setCanManageCombos(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageCombos(false);
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

    const scheduleCombosRefresh = () => {
      if (cancelled || combosRealtimeRefreshTimerRef.current) return;
      combosRealtimeRefreshTimerRef.current = setTimeout(() => {
        combosRealtimeRefreshTimerRef.current = null;
        void refreshCombosSilently();
      }, 120);
    };

    const scheduleProductsRefresh = () => {
      if (cancelled || combosProductsRefreshTimerRef.current) return;
      combosProductsRefreshTimerRef.current = setTimeout(() => {
        combosProductsRefreshTimerRef.current = null;
        void refreshProductsSilently();
      }, 180);
    };

    const channel = client
      .channel(`mobile-combos:${normalizedBusinessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'combos',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleCombosRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'combo_items',
      }, scheduleCombosRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleProductsRefresh);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        scheduleCombosRefresh();
      }
    });

    fallbackTimer = setInterval(() => {
      scheduleCombosRefresh();
    }, 20000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (combosRealtimeRefreshTimerRef.current) {
        clearTimeout(combosRealtimeRefreshTimerRef.current);
        combosRealtimeRefreshTimerRef.current = null;
      }
      if (combosProductsRefreshTimerRef.current) {
        clearTimeout(combosProductsRefreshTimerRef.current);
        combosProductsRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [businessId, refreshCombosSilently, refreshProductsSilently]);

  const filteredCombos = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    return combos.filter((combo) => {
      if (statusFilter !== 'all' && normalizeStatus(combo.estado) !== statusFilter) {
        return false;
      }

      if (!term) return true;
      const byName = String(combo.nombre || '').toLowerCase().includes(term);
      const byDescription = String(combo.descripcion || '').toLowerCase().includes(term);
      const byId = String(combo.id || '').toLowerCase().includes(term);
      const byPrice = String(Math.round(Number(combo.precio_venta || 0))).includes(term);
      const byItems = (combo.combo_items || []).some((item) =>
        String(item.product?.name || '').toLowerCase().includes(term));

      return byName || byDescription || byId || byPrice || byItems;
    });
  }, [combos, search, statusFilter]);

  const totalActive = useMemo(
    () => combos.filter((combo) => normalizeStatus(combo.estado) === COMBO_STATUS.ACTIVE).length,
    [combos],
  );

  const productCatalogFiltered = useMemo(() => {
    const term = String(productSearch || '').trim().toLowerCase();
    return products
      .filter((product) => {
        if (!term) return true;
        return String(product.name || '').toLowerCase().includes(term)
          || String(product.code || '').toLowerCase().includes(term);
      })
      .slice(0, 120);
  }, [productSearch, products]);

  const resetFormState = useCallback(() => {
    setEditingCombo(null);
    setForm(createInitialForm());
    setProductSearch('');
    setShowProductPickerModal(false);
    setProductPickerRowIndex(null);
  }, []);

  const openCreateModal = useCallback(() => {
    resetFormState();
    setShowFormModal(true);
  }, [resetFormState]);

  const openEditModal = useCallback((combo: ComboRecord) => {
    setEditingCombo(combo);
    setForm({
      nombre: combo.nombre || '',
      precioVenta: String(combo.precio_venta ?? ''),
      descripcion: combo.descripcion || '',
      estado: normalizeStatus(combo.estado),
      items: (Array.isArray(combo.combo_items) ? combo.combo_items : []).length > 0
        ? (Array.isArray(combo.combo_items) ? combo.combo_items : []).map((item) => ({
          productoId: item.producto_id,
          cantidad: String(item.cantidad ?? 1),
        }))
        : [{ ...EMPTY_FORM_ITEM }],
    });
    setProductSearch('');
    setShowFormModal(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowFormModal(false);
    resetFormState();
  }, [resetFormState]);

  const handleAddItemRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_FORM_ITEM }],
    }));
  }, []);

  const handleRemoveItemRow = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }, []);

  const handleItemChange = useCallback((index: number, field: 'productoId' | 'cantidad', value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }));
  }, []);

  const openProductPicker = useCallback((rowIndex: number) => {
    setProductPickerRowIndex(rowIndex);
    setProductSearch('');
    setShowProductPickerModal(true);
  }, []);

  const closeProductPicker = useCallback(() => {
    setShowProductPickerModal(false);
    setProductPickerRowIndex(null);
    setProductSearch('');
  }, []);

  const selectProductForRow = useCallback((productId: string) => {
    if (productPickerRowIndex === null) return;

    const target = productsById.get(productId);
    const duplicated = form.items.some((item, index) => (
      index !== productPickerRowIndex && String(item.productoId || '') === String(productId)
    ));
    if (duplicated) {
      setError(`"${target?.name || 'Producto'}" ya esta agregado en el combo.`);
      return;
    }

    setError(null);
    closeProductPicker();
    requestAnimationFrame(() => {
      handleItemChange(productPickerRowIndex, 'productoId', productId);
    });
  }, [closeProductPicker, form.items, handleItemChange, productPickerRowIndex, productsById]);

  const submitForm = useCallback(async () => {
    if (saving || !canManageCombos) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const nombre = String(form.nombre || '').trim();
      if (!nombre) {
        throw new Error('El nombre del combo es obligatorio.');
      }

      const precioVenta = parseMoneyText(form.precioVenta);
      if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
        throw new Error('El precio de venta debe ser mayor a 0.');
      }

      const selectedItems = (Array.isArray(form.items) ? form.items : []).filter((item) =>
        String(item.productoId || '').trim().length > 0);

      if (selectedItems.length === 0) {
        throw new Error('Debes agregar al menos un producto al combo.');
      }
      if (hasDuplicateProducts) {
        throw new Error('No se permiten productos repetidos en el combo.');
      }

      const normalizedItems = selectedItems.map((item, index) => {
        const productoId = String(item.productoId || '').trim();

        const cantidad = Number(String(item.cantidad || '').replace(',', '.'));
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          throw new Error(`Cantidad invalida en la fila ${index + 1}.`);
        }

        return {
          producto_id: productoId,
          cantidad,
        };
      });

      const payload = {
        nombre,
        precio_venta: precioVenta,
        descripcion: String(form.descripcion || '').trim() || null,
        estado: normalizeStatus(form.estado),
        items: normalizedItems,
      };

      if (editingCombo?.id) {
        await updateComboByBusinessAndId({
          businessId,
          comboId: editingCombo.id,
          payload,
        });
        setComboToastName(nombre);
        setComboToastPrice(formatCop(precioVenta));
        setShowComboUpdatedToast(true);
        setSuccess('Combo actualizado correctamente.');
      } else {
        await createComboByBusinessId(businessId, payload);
        setComboToastName(nombre);
        setComboToastPrice(formatCop(precioVenta));
        setShowComboCreatedToast(true);
        setSuccess('Combo creado correctamente.');
      }

      closeFormModal();
      await refreshCombos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el combo.');
    } finally {
      setSaving(false);
    }
  }, [businessId, canManageCombos, closeFormModal, editingCombo?.id, form, hasDuplicateProducts, refreshCombos, saving]);

  const askDeleteCombo = useCallback((combo: ComboRecord) => {
    if (!canManageCombos) return;
    setError(null);
    setComboToDelete(combo);
    setShowDeleteModal(true);
  }, [canManageCombos]);

  const confirmDeleteCombo = useCallback(async () => {
    if (!comboToDelete?.id || deleting || !canManageCombos) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteComboByBusinessAndId({
        businessId,
        comboId: comboToDelete.id,
      });
      setComboToastName(comboToDelete.nombre || 'Combo');
      setShowComboDeletedToast(true);
      setShowDeleteModal(false);
      setComboToDelete(null);
      setSuccess('Combo eliminado correctamente.');
      await refreshCombos();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el combo.';
      if (message.toLowerCase().includes('movimientos asociados')) {
        try {
          await setComboStatusByBusinessAndId({
            businessId,
            comboId: comboToDelete.id,
            status: COMBO_STATUS.INACTIVE,
          });
          setCombos((prev) => prev.map((item) => (
            item.id === comboToDelete.id
              ? { ...item, estado: COMBO_STATUS.INACTIVE }
              : item
          )));
          setComboToastName(comboToDelete.nombre || 'Combo');
          setShowComboDeactivatedToast(true);
          setShowDeleteModal(false);
          setComboToDelete(null);
          return;
        } catch (deactivateErr) {
          setError(deactivateErr instanceof Error ? deactivateErr.message : message);
          return;
        }
      }
      setError(message);
    } finally {
      setDeleting(false);
    }
  }, [businessId, canManageCombos, comboToDelete, deleting, refreshCombos]);

  const toggleComboStatus = useCallback(async (combo: ComboRecord) => {
    if (!canManageCombos || updatingStatusId) return;

    const currentStatus = normalizeStatus(combo.estado);
    const nextStatus = currentStatus === COMBO_STATUS.ACTIVE
      ? COMBO_STATUS.INACTIVE
      : COMBO_STATUS.ACTIVE;

    setUpdatingStatusId(combo.id);
    setError(null);
    setSuccess(null);
    try {
      await setComboStatusByBusinessAndId({
        businessId,
        comboId: combo.id,
        status: nextStatus,
      });
      setCombos((prev) => prev.map((item) => (
        item.id === combo.id
          ? { ...item, estado: nextStatus }
          : item
      )));
      setSuccess(
        nextStatus === COMBO_STATUS.ACTIVE
          ? 'Combo activado correctamente.'
          : 'Combo desactivado correctamente.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del combo.');
    } finally {
      setUpdatingStatusId(null);
    }
  }, [businessId, canManageCombos, updatingStatusId]);

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
        ListHeaderComponent={(
          <View style={styles.container}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTop}>
                <View style={styles.heroIconBox}>
                  <Ionicons name="layers-outline" size={32} color="#D1D5DB" />
                </View>
                <View style={styles.heroTitleWrap}>
                  <Text style={styles.heroTitle}>Combos</Text>
                  <Text style={styles.heroSubtitle}>Gestiona combos estructurados de productos</Text>
                </View>
              </View>

              <Pressable
                style={[styles.heroCreateButton, (!canManageCombos || checkingPermissions) && styles.buttonDisabled]}
                onPress={openCreateModal}
                disabled={!canManageCombos || checkingPermissions}
              >
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.88)" />
                <Text style={styles.heroCreateButtonText}>Nuevo Combo</Text>
              </Pressable>
            </LinearGradient>

            {loading || refreshing ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {!canManageCombos && !checkingPermissions ? null : null}
          </View>
        )}
        ListEmptyComponent={!suspendBackgroundList && !loading ? (
          <Text style={styles.emptyText}>No hay combos para los filtros seleccionados.</Text>
        ) : null}
        ItemSeparatorComponent={() => <View style={styles.listItemSeparator} />}
        ListFooterComponent={<View style={styles.listFooterSpacer} />}
        renderItem={({ item: combo }) => {
          const status = normalizeStatus(combo.estado);
          const isActive = status === COMBO_STATUS.ACTIVE;

          return (
            <View style={styles.comboCard}>
              <View style={styles.comboHeader}>
                <View style={styles.comboNameRow}>
                  <Ionicons name="layers-outline" size={24} color="#111827" />
                  <Text style={styles.comboTitle} numberOfLines={1}>{combo.nombre}</Text>
                </View>
              </View>

              <View style={styles.comboTagRow}>
                <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                  {isActive ? <Ionicons name="checkmark" size={14} color="#067647" /> : null}
                  <Text style={[styles.statusBadgeText, isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                    {formatComboStatusLabel(status)}
                  </Text>
                </View>

                <View style={styles.comboCountTag}>
                  <Ionicons name="cube-outline" size={13} color="#1D4ED8" />
                  <Text style={styles.comboCountTagText}>{combo.combo_items.length} productos</Text>
                </View>
              </View>

              {combo.descripcion ? (
                <Text style={styles.comboDescription} numberOfLines={2}>
                  {combo.descripcion}
                </Text>
              ) : null}

              <View style={styles.divider} />

              <View style={styles.comboInfoGrid}>
                <View style={styles.comboInfoCell}>
                  <View style={styles.comboMetaTitleRow}>
                    <Ionicons name="cash-outline" size={16} color="#111827" />
                    <Text style={styles.metaLabel}>PRECIO</Text>
                  </View>
                  <StockyMoneyText value={combo.precio_venta} style={styles.metaValue} />
                </View>

                <View style={styles.comboInfoCell}>
                  <View style={styles.comboMetaTitleRow}>
                    <Ionicons name="layers-outline" size={16} color="#111827" />
                    <Text style={styles.metaLabel}>PRODUCTOS</Text>
                  </View>
                  <Text style={styles.metaValue}>{combo.combo_items.length}</Text>
                </View>

                <View style={[styles.comboInfoCell, styles.comboInfoCellFull]}>
                  <Text style={styles.compositionTitle}>Composición</Text>
                  <Text style={styles.compositionText}>{buildComboCompositionText(combo)}</Text>
                </View>
              </View>

              {canManageCombos ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.comboActionsRow}>
                    <Pressable style={[styles.comboEditButton, styles.comboActionHalf]} onPress={() => openEditModal(combo)}>
                      <Ionicons name="create-outline" size={18} color="#DDE6FF" />
                      <Text style={styles.comboEditButtonText}>Editar</Text>
                    </Pressable>

                    <Pressable style={[styles.comboDeleteButton, styles.comboActionHalf]} onPress={() => askDeleteCombo(combo)}>
                      <Ionicons name="trash-outline" size={18} color="#FFE4E6" />
                      <Text style={styles.comboDeleteButtonText}>Eliminar</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          );
        }}
      />

      <StockyModal
        visible={showFormModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="fade"
        animationDurationMs={180}
        bodyFlex
        sheetStyle={styles.comboFormSheet}
        contentContainerStyle={styles.comboFormContent}
        perfTag="combos.form_combo"
        onClose={closeFormModal}
        headerSlot={(
          <View style={styles.comboFormHeader}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.comboFormHeaderIconWrap}
            >
              <Ionicons name={editingCombo ? 'create-outline' : 'layers-outline'} size={30} color="#D1D5DB" />
            </LinearGradient>
            <Text style={styles.comboFormHeaderTitle}>
              {editingCombo ? 'Editar Combo' : 'Nuevo Combo'}
            </Text>
            <Pressable style={[styles.comboFormHeaderClose, saving && styles.buttonDisabled]} onPress={closeFormModal} disabled={saving}>
              <Ionicons name="close" size={34} color="#111827" />
            </Pressable>
          </View>
        )}
        footerStyle={styles.comboFormFooter}
        footer={(
          <View style={styles.comboFormFooterRow}>
            <Pressable style={[styles.comboFormCancelButton, saving && styles.buttonDisabled]} onPress={closeFormModal} disabled={saving}>
              <Text style={styles.comboFormCancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.comboFormSaveButton, saving && styles.buttonDisabled]}
              onPress={submitForm}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#F5F3FF" /> : null}
              <Text style={styles.comboFormSaveButtonText}>
                {saving ? 'Guardando...' : (editingCombo ? 'Actualizar' : 'Guardar')}
              </Text>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.comboFormFields}>
          <View style={styles.comboFormRow}>
            <View style={[styles.modalSection, styles.comboFormCol]}>
              <Text style={styles.inputLabel}>Nombre del combo *</Text>
              <TextInput
                value={form.nombre}
                onChangeText={(next) => setForm((prev) => ({ ...prev, nombre: next }))}
                placeholder="Ej: Cubetazo"
                placeholderTextColor={STOCKY_COLORS.textMuted}
                style={styles.input}
              />
            </View>

            <View style={[styles.modalSection, styles.comboFormCol]}>
              <Text style={styles.inputLabel}>Precio de venta *</Text>
              <TextInput
                value={form.precioVenta}
                onChangeText={(next) => setForm((prev) => ({ ...prev, precioVenta: next }))}
                placeholder="Ej: 25000"
                placeholderTextColor={STOCKY_COLORS.textMuted}
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Descripción (opcional)</Text>
            <TextInput
              value={form.descripcion}
              onChangeText={(next) => setForm((prev) => ({ ...prev, descripcion: next }))}
              placeholder="Descripción del combo"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={[styles.input, styles.textArea]}
              multiline
            />
          </View>

          <View style={styles.modalSection}>
            <View style={styles.comboItemsHeaderRow}>
              <Text style={styles.inputLabel}>Productos del combo *</Text>
              <Pressable style={styles.comboAddItemButton} onPress={handleAddItemRow}>
                <Ionicons name="add" size={16} color="#4338CA" />
                <Text style={styles.comboAddItemButtonText}>Agregar producto</Text>
              </Pressable>
            </View>

            <View style={styles.comboItemsList}>
              {form.items.map((item, index) => {
                const selectedProduct = productsById.get(item.productoId);
                return (
                  <View key={`combo-item-${index}`} style={styles.comboItemRowWrap}>
                    <View style={styles.comboItemEditorRow}>
                      <Pressable style={styles.comboItemSelect} onPress={() => openProductPicker(index)}>
                        <Text style={[styles.comboItemSelectText, !item.productoId && styles.comboItemSelectPlaceholder]} numberOfLines={1}>
                          {selectedProduct?.name || 'Selecciona un producto'}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#64748B" />
                      </Pressable>

                      <TextInput
                        value={item.cantidad}
                        onChangeText={(next) => handleItemChange(index, 'cantidad', next)}
                        keyboardType="numeric"
                        style={styles.comboItemQtyInput}
                        placeholder="Cantidad"
                        placeholderTextColor={STOCKY_COLORS.textMuted}
                      />

                      <Pressable
                        style={[styles.comboItemRemoveButton, form.items.length <= 1 && styles.buttonDisabled]}
                        onPress={() => handleRemoveItemRow(index)}
                        disabled={form.items.length <= 1}
                      >
                        <Ionicons name="close" size={18} color="#DC2626" />
                      </Pressable>
                    </View>

                    <Text style={styles.comboItemMeta} numberOfLines={1}>
                      {selectedProduct ? `${selectedProduct.code || 'Sin código'} · Stock: ${selectedProduct.stock}` : 'Producto requerido'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {hasDuplicateProducts ? (
              <Text style={styles.comboFieldError}>No se permiten productos repetidos en el combo.</Text>
            ) : null}
          </View>

          {form.items.length > 0 ? (
            <View style={styles.comboSummaryBox}>
              <Text style={styles.comboSummaryTitle}>Resumen de composición</Text>
              {form.items.map((item, index) => {
                const product = productsById.get(item.productoId);
                const quantity = Number(String(item.cantidad || '').replace(',', '.'));
                return (
                  <Text key={`combo-summary-${index}`} style={styles.comboSummaryText}>
                    {Number.isFinite(quantity) && quantity > 0 ? quantity : 0} x {product?.name || 'Producto sin seleccionar'}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
      </StockyModal>

      <StockyModal
        visible={showProductPickerModal}
        title="Selecciona un producto"
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={24}
        modalAnimationType="fade"
        animationDurationMs={150}
        bodyFlex
        perfTag="combos.picker_producto"
        onClose={closeProductPicker}
      >
        <View style={styles.modalSection}>
          <TextInput
            value={productSearch}
            onChangeText={setProductSearch}
            placeholder="Buscar por nombre o codigo..."
            placeholderTextColor={STOCKY_COLORS.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {productCatalogFiltered.length === 0 ? (
          <Text style={styles.emptyText}>No se encontraron productos para seleccionar.</Text>
        ) : null}

        {productCatalogFiltered.map((product) => {
          const selected = productPickerRowIndex !== null && form.items[productPickerRowIndex]?.productoId === product.id;
          const takenByOther = form.items.some((item, index) => (
            index !== productPickerRowIndex && item.productoId === product.id
          ));
          return (
            <Pressable
              key={product.id}
              style={[
                styles.comboPickerItem,
                selected && styles.comboPickerItemSelected,
                takenByOther && styles.comboPickerItemDisabled,
              ]}
              onPress={() => selectProductForRow(product.id)}
              disabled={takenByOther}
            >
              <Text style={[styles.comboPickerItemTitle, selected && styles.comboPickerItemTitleSelected]}>
                {product.name}
              </Text>
              <Text style={[styles.comboPickerItemMeta, selected && styles.comboPickerItemMetaSelected]}>
                {product.code || 'Sin código'} · Stock {product.stock}
                {takenByOther ? ' · Ya agregado' : ''}
              </Text>
            </Pressable>
          );
        })}
      </StockyModal>

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title="Eliminar combo"
        message={`¿Seguro que deseas eliminar el combo "${comboToDelete?.nombre || 'seleccionado'}"?`}
        warning="Esta acción no se puede deshacer. Si el combo tiene movimientos asociados, desactívalo."
        itemLabel={comboToDelete?.nombre || null}
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setShowDeleteModal(false);
          setComboToDelete(null);
        }}
        onConfirm={confirmDeleteCombo}
      />
      <StockyStatusToast
        visible={showComboCreatedToast}
        title="Combo Creado"
        primaryLabel="Combo"
        primaryValue={comboToastName || 'Combo'}
        secondaryLabel="Precio"
        secondaryValue={comboToastPrice || formatCop(parseMoneyText(form.precioVenta))}
        durationMs={1200}
        onClose={() => setShowComboCreatedToast(false)}
      />
      <StockyStatusToast
        visible={showComboUpdatedToast}
        title="Combo Actualizado"
        primaryLabel="Combo"
        primaryValue={comboToastName || 'Combo'}
        secondaryLabel="Precio"
        secondaryValue={comboToastPrice || formatCop(parseMoneyText(form.precioVenta))}
        durationMs={1200}
        onClose={() => setShowComboUpdatedToast(false)}
      />
      <StockyStatusToast
        visible={showComboDeletedToast}
        title="Combo Eliminado"
        primaryLabel="Combo"
        primaryValue={comboToastName || 'Combo'}
        secondaryLabel="Estado"
        secondaryValue="Eliminado"
        durationMs={1200}
        onClose={() => setShowComboDeletedToast(false)}
      />
      <StockyStatusToast
        visible={showComboDeactivatedToast}
        title="Combo Desactivado"
        primaryLabel="Combo"
        primaryValue={comboToastName || 'Combo'}
        secondaryLabel="Estado"
        secondaryValue="Inactivo"
        durationMs={1200}
        onClose={() => setShowComboDeactivatedToast(false)}
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
  heroCard: {
    borderRadius: 22,
    padding: 18,
    gap: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 7,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconBox: {
    width: 78,
    height: 78,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: '#D1D5DB',
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '500',
  },
  heroCreateButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  heroCreateButtonText: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  statLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    color: STOCKY_COLORS.primary900,
    fontSize: 16,
    fontWeight: '800',
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: STOCKY_COLORS.primary900,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primaryButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 42,
    minWidth: 110,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  searchInput: {
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(102, 165, 173, 0.2)',
    borderColor: STOCKY_COLORS.accent500,
  },
  filterChipText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: STOCKY_COLORS.primary900,
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
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorCard: {
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
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  comboCard: {
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
  comboHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comboNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  comboTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  comboTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  comboDescription: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  statusBadge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusActive: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A6F4C5',
  },
  statusInactive: {
    backgroundColor: '#F2F4F7',
    borderColor: '#D0D5DD',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusActiveText: {
    color: '#067647',
  },
  statusInactiveText: {
    color: '#344054',
  },
  comboCountTag: {
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  comboCountTagText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '600',
  },
  comboInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  comboInfoCell: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
    alignItems: 'center',
  },
  comboInfoCellFull: {
    width: '100%',
  },
  comboMetaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  metaLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  compositionTitle: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  compositionText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    width: '100%',
  },
  comboCreatedAt: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  comboActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  comboActionHalf: {
    flex: 1,
  },
  comboEditButton: {
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
  comboEditButtonText: {
    color: '#DDE6FF',
    fontSize: 13,
    fontWeight: '600',
  },
  comboDeleteButton: {
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
  comboDeleteButtonText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '600',
  },
  comboFormSheet: {
    maxHeight: '88%',
    height: '88%',
    borderRadius: 26,
    borderColor: '#D9DEE8',
  },
  comboFormContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  comboFormHeader: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  comboFormHeaderIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboFormHeaderTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  comboFormHeaderClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboFormFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  comboFormFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  comboFormCancelButton: {
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
  comboFormCancelButtonText: {
    color: '#5B21B6',
    fontSize: 12,
    fontWeight: '800',
  },
  comboFormSaveButton: {
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
  comboFormSaveButtonText: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '800',
  },
  comboFormFields: {
    gap: 10,
  },
  comboFormRow: {
    flexDirection: 'row',
    gap: 10,
  },
  comboFormCol: {
    flex: 1,
  },
  modalSection: {
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
  comboItemsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  comboAddItemButton: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comboAddItemButtonText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '700',
  },
  comboItemsList: {
    gap: 9,
  },
  comboItemRowWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  comboItemEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comboItemSelect: {
    flex: 1,
    minHeight: 43,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  comboItemSelectText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  comboItemSelectPlaceholder: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  comboItemQtyInput: {
    width: 92,
    minHeight: 43,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  comboItemRemoveButton: {
    width: 43,
    height: 43,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboItemMeta: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '500',
  },
  comboFieldError: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
  },
  comboSummaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  comboSummaryTitle: {
    color: '#3730A3',
    fontSize: 12,
    fontWeight: '800',
  },
  comboSummaryText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '600',
  },
  comboPickerItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 2,
  },
  comboPickerItemSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  comboPickerItemDisabled: {
    opacity: 0.5,
  },
  comboPickerItemTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  comboPickerItemTitleSelected: {
    color: '#3730A3',
  },
  comboPickerItemMeta: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '500',
  },
  comboPickerItemMetaSelected: {
    color: '#4F46E5',
  },
  statusEditorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusEditorChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STOCKY_COLORS.surface,
  },
  statusEditorChipSelected: {
    borderColor: STOCKY_COLORS.accent500,
    backgroundColor: 'rgba(102, 165, 173, 0.2)',
  },
  statusEditorChipText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  statusEditorChipTextSelected: {
    color: STOCKY_COLORS.primary900,
  },
  productsScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  productChip: {
    width: 180,
    borderRadius: STOCKY_RADIUS.sm,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  productChipSelected: {
    backgroundColor: 'rgba(102, 165, 173, 0.2)',
    borderColor: STOCKY_COLORS.accent500,
  },
  productChipText: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  productChipTextSelected: {
    color: STOCKY_COLORS.primary900,
  },
  productChipMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  productChipMetaSelected: {
    color: STOCKY_COLORS.textSecondary,
  },
  formItemRow: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  formItemMain: {
    gap: 4,
  },
  formItemTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  formItemMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 244, 246, 0.6)',
  },
  qtyButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 16,
    fontWeight: '800',
  },
  quantityInput: {
    width: 70,
    borderRadius: STOCKY_RADIUS.sm,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  formItemRemove: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(153, 27, 27, 0.24)',
    backgroundColor: 'rgba(254, 226, 226, 0.68)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  formItemRemoveText: {
    color: STOCKY_COLORS.errorText,
    fontSize: 11,
    fontWeight: '800',
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 8,
  },
  modalCancelButtonText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  modalSaveButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STOCKY_COLORS.primary900,
    paddingHorizontal: 8,
  },
  modalSaveButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STOCKY_COLORS.errorText,
    paddingHorizontal: 8,
  },
  modalDangerButtonText: {
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
});
