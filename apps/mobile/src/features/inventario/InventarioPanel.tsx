import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  createInventoryProductWithRpcFallback,
  deleteInventoryProductById,
  listInventoryProducts,
  listInventorySuppliers,
  setInventoryProductActiveStatus,
  updateInventoryProductById,
  type InventoryProductRecord,
  type InventorySupplierRecord,
} from '../../services/inventoryService';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyButton } from '../../ui/StockyButton';
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

type StatusFilter = 'all' | 'active' | 'inactive';

type ProductFormState = {
  name: string;
  category: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  unit: string;
  supplierId: string;
  manageStock: boolean;
  isActive: boolean;
};

const INITIAL_FORM: ProductFormState = {
  name: '',
  category: '',
  purchasePrice: '',
  salePrice: '',
  stock: '0',
  minStock: '5',
  unit: 'unit',
  supplierId: '',
  manageStock: true,
  isActive: true,
};

const INVENTORY_CATEGORY_OPTIONS = [
  'Platos',
  'Bebidas Alcohólicas',
  'Cervezas',
  'Vinos',
  'Licores',
  'Bebidas',
  'Snacks',
  'Comida',
  'Otros',
];

const UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'unit', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'l', label: 'Litro' },
  { value: 'box', label: 'Caja' },
];
const INVENTORY_PAGE_SIZE = 40;

function normalizeRole(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function parseMoneyText(value: string, fallback = 0): number {
  const raw = String(value || '').trim().replace(/\s+/g, '');
  const normalized = (() => {
    if (!raw) return '';
    if (raw.includes(',')) {
      return raw.replace(/\./g, '').replace(',', '.');
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      return raw.replace(/\./g, '');
    }
    return raw.replace(/,/g, '');
  })();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntegerText(value: string, fallback = 0): number {
  const parsed = Number(String(value || '').replace(/[^\d-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
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

function getSupplierDisplayName(supplier: InventorySupplierRecord | null | undefined): string {
  if (!supplier) return 'Sin proveedor';
  return supplier.business_name || supplier.contact_name || 'Proveedor';
}

function hydrateProductsWithSuppliers(
  products: InventoryProductRecord[],
  suppliers: InventorySupplierRecord[],
): InventoryProductRecord[] {
  const supplierMap = new Map(
    (Array.isArray(suppliers) ? suppliers : []).map((supplier) => [supplier.id, supplier] as const),
  );
  return (Array.isArray(products) ? products : []).map((product) => {
    if (!product?.supplier_id) return { ...product, supplier: null };
    return {
      ...product,
      supplier: supplierMap.get(product.supplier_id) || product.supplier || null,
    };
  });
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <View style={[styles.statusBadge, active ? styles.statusActive : styles.statusInactive]}>
      {active ? <Ionicons name="checkmark" size={16} color="#067647" /> : null}
      <Text style={[styles.statusBadgeText, active ? styles.statusActiveText : styles.statusInactiveText]}>
        {active ? 'Activo' : 'Inactivo'}
      </Text>
    </View>
  );
}

function StatusFilterSelector({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (next: StatusFilter) => void;
}) {
  const options: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
  ];

  return (
    <View style={styles.filterRow}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.filterOption, selected && styles.filterOptionSelected]}
          >
            <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InventarioPanel({ businessId, businessName, userId, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);

  const [products, setProducts] = useState<InventoryProductRecord[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplierRecord[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const [canManageProducts, setCanManageProducts] = useState(source === 'owner');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProductRecord | null>(null);
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductCreatedToast, setShowProductCreatedToast] = useState(false);
  const [showProductUpdatedToast, setShowProductUpdatedToast] = useState(false);
  const [showProductDeletedToast, setShowProductDeletedToast] = useState(false);
  const [productToastName, setProductToastName] = useState('');
  const [productToastCategory, setProductToastCategory] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [productTarget, setProductTarget] = useState<InventoryProductRecord | null>(null);
  const suppliersRef = useRef<InventorySupplierRecord[]>([]);
  const inventoryRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inventorySuppliersRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    suppliersRef.current = suppliers;
  }, [suppliers]);

  const refreshSuppliersSilently = useCallback(async () => {
    try {
      const nextSuppliers = await listInventorySuppliers(businessId);
      setSuppliers(nextSuppliers);
      setProducts((prev) => hydrateProductsWithSuppliers(prev, nextSuppliers));
    } catch {
      // no-op
    }
  }, [businessId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProducts, nextSuppliers] = await Promise.all([
        listInventoryProducts(businessId, {
          includeSuppliers: false,
          limit: INVENTORY_PAGE_SIZE,
          offset: 0,
        }),
        listInventorySuppliers(businessId),
      ]);
      setSuppliers(nextSuppliers);
      setProducts(hydrateProductsWithSuppliers(nextProducts, nextSuppliers));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar inventario.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const refreshProducts = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [nextProducts, nextSuppliers] = await Promise.all([
        listInventoryProducts(businessId, {
          includeSuppliers: false,
          limit: INVENTORY_PAGE_SIZE,
          offset: 0,
        }),
        listInventorySuppliers(businessId),
      ]);
      setSuppliers(nextSuppliers);
      setProducts(hydrateProductsWithSuppliers(nextProducts, nextSuppliers));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar inventario.');
    } finally {
      setRefreshing(false);
    }
  }, [businessId]);

  const refreshProductsSilently = useCallback(async () => {
    try {
      const nextProducts = await listInventoryProducts(businessId, {
        includeSuppliers: false,
        limit: INVENTORY_PAGE_SIZE,
        offset: 0,
      });
      setProducts(hydrateProductsWithSuppliers(nextProducts, suppliersRef.current));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(1);
    } catch {
      // no-op
    }
  }, [businessId]);

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMoreProducts) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const nextProducts = await listInventoryProducts(businessId, {
        includeSuppliers: false,
        limit: INVENTORY_PAGE_SIZE,
        offset: (nextPage - 1) * INVENTORY_PAGE_SIZE,
      });
      setProducts((prev) => hydrateProductsWithSuppliers([...prev, ...nextProducts], suppliersRef.current));
      setHasMoreProducts(nextProducts.length === INVENTORY_PAGE_SIZE);
      setPage(nextPage);
    } catch {
      // no-op
    } finally {
      setLoadingMore(false);
    }
  }, [businessId, hasMoreProducts, loadingMore, page]);

  const checkPermissions = useCallback(async () => {
    if (source === 'owner') {
      setCanManageProducts(true);
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
      setCanManageProducts(role === 'admin' || role.includes('admin'));
    } catch {
      setCanManageProducts(false);
    } finally {
      setCheckingPermissions(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    loadData();
    checkPermissions();
  }, [checkPermissions, loadData]);

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

    const scheduleProductsRefresh = () => {
      if (cancelled || inventoryRealtimeRefreshTimerRef.current) return;
      inventoryRealtimeRefreshTimerRef.current = setTimeout(() => {
        inventoryRealtimeRefreshTimerRef.current = null;
        void refreshProductsSilently();
      }, 120);
    };

    const scheduleSuppliersRefresh = () => {
      if (cancelled || inventorySuppliersRefreshTimerRef.current) return;
      inventorySuppliersRefreshTimerRef.current = setTimeout(() => {
        inventorySuppliersRefreshTimerRef.current = null;
        void refreshSuppliersSilently();
      }, 180);
    };

    const channel = client
      .channel(`mobile-inventario:${normalizedBusinessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleProductsRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'suppliers',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleSuppliersRefresh);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        scheduleProductsRefresh();
        scheduleSuppliersRefresh();
      }
    });

    fallbackTimer = setInterval(() => {
      scheduleProductsRefresh();
      scheduleSuppliersRefresh();
    }, 20000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (inventoryRealtimeRefreshTimerRef.current) {
        clearTimeout(inventoryRealtimeRefreshTimerRef.current);
        inventoryRealtimeRefreshTimerRef.current = null;
      }
      if (inventorySuppliersRefreshTimerRef.current) {
        clearTimeout(inventorySuppliersRefreshTimerRef.current);
        inventorySuppliersRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [businessId, refreshProductsSilently, refreshSuppliersSilently]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = String(search || '').trim().toLowerCase();
    return products.filter((product) => {
      if (statusFilter === 'active' && !product.is_active) return false;
      if (statusFilter === 'inactive' && product.is_active) return false;

      if (!normalizedSearch) return true;
      return String(product.name || '').toLowerCase().includes(normalizedSearch);
    });
  }, [products, search, statusFilter]);

  const selectedUnitLabel = useMemo(
    () => UNIT_OPTIONS.find((item) => item.value === form.unit)?.label || 'Unidad',
    [form.unit],
  );

  const selectedSupplierLabel = useMemo(() => {
    if (!form.supplierId) return 'Sin proveedor';
    const selected = suppliers.find((item) => item.id === form.supplierId);
    return getSupplierDisplayName(selected || null);
  }, [form.supplierId, suppliers]);

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingProduct(null);
    setShowCategoryModal(false);
    setShowUnitModal(false);
    setShowSupplierModal(false);
    setForm(INITIAL_FORM);
  };

  const openCreateModal = () => {
    setError(null);
    setSuccess(null);
    setEditingProduct(null);
    setForm(INITIAL_FORM);
    setShowFormModal(true);
  };

  const openEditModal = (product: InventoryProductRecord) => {
    setError(null);
    setSuccess(null);
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category || '',
      purchasePrice: String(Number(product.purchase_price || 0)),
      salePrice: String(Number(product.sale_price || 0)),
      stock: String(Number(product.stock || 0)),
      minStock: String(Number(product.min_stock || 0)),
      unit: product.unit || 'unit',
      supplierId: product.supplier_id || '',
      manageStock: product.manage_stock !== false,
      isActive: product.is_active !== false,
    });
    setShowFormModal(true);
  };

  const openCategoryPicker = () => {
    setShowFormModal(false);
    setShowCategoryModal(true);
  };

  const closeCategoryPicker = () => {
    setShowCategoryModal(false);
    setShowFormModal(true);
  };

  const openUnitPicker = () => {
    setShowFormModal(false);
    setShowUnitModal(true);
  };

  const closeUnitPicker = () => {
    setShowUnitModal(false);
    setShowFormModal(true);
  };

  const openSupplierPicker = () => {
    void refreshSuppliersSilently();
    setShowFormModal(false);
    setShowSupplierModal(true);
  };

  const closeSupplierPicker = () => {
    setShowSupplierModal(false);
    setShowFormModal(true);
  };

  const handleSaveProduct = async () => {
    if (!canManageProducts) {
      setError('No tienes permisos para gestionar productos.');
      return;
    }

    const normalizedName = String(form.name || '').trim();
    const normalizedCategory = String(form.category || '').trim();
    const purchasePrice = parseMoneyText(form.purchasePrice, 0);
    const salePrice = parseMoneyText(form.salePrice, NaN);
    const stock = form.manageStock ? parseIntegerText(form.stock, 0) : 0;
    const minStock = form.manageStock ? parseIntegerText(form.minStock, 5) : 0;

    if (!normalizedName) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!normalizedCategory) {
      setError('La categoría es obligatoria.');
      return;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      setError('El precio de compra no es válido.');
      return;
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      setError('El precio de venta no es válido.');
      return;
    }
    if (form.manageStock && (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(minStock) || minStock < 0)) {
      setError('Stock y stock mínimo deben ser valores válidos.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingProduct) {
        await updateInventoryProductById({
          businessId,
          productId: editingProduct.id,
          name: normalizedName,
          category: normalizedCategory,
          purchasePrice,
          salePrice,
          minStock,
          unit: form.unit || 'unit',
          supplierId: form.supplierId,
          isActive: form.isActive,
          manageStock: form.manageStock,
        });

        setProductToastName(normalizedName);
        setProductToastCategory(normalizedCategory || 'General');
        setShowProductUpdatedToast(true);
        setSuccess('Producto actualizado.');
      } else {
        const result = await createInventoryProductWithRpcFallback({
          businessId,
          name: normalizedName,
          category: normalizedCategory,
          purchasePrice,
          salePrice,
          stock,
          minStock,
          unit: form.unit || 'unit',
          supplierId: form.supplierId,
          isActive: true,
          manageStock: form.manageStock,
        });

        setProductToastName(normalizedName);
        setProductToastCategory(normalizedCategory || 'General');
        setShowProductCreatedToast(true);
        setSuccess(result.usedLegacyFallback
          ? 'Producto creado con fallback legacy.'
          : 'Producto creado.');
      }

      closeFormModal();
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  const askDeleteProduct = (product: InventoryProductRecord) => {
    setProductTarget(product);
    setShowDeleteModal(true);
    setShowDeactivateModal(false);
  };

  const askDeactivateProduct = (product: InventoryProductRecord) => {
    setProductTarget(product);
    setShowDeactivateModal(true);
    setShowDeleteModal(false);
  };

  const confirmDeleteProduct = async () => {
    if (!productTarget) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteInventoryProductById({
        businessId,
        productId: productTarget.id,
      });
      setProductToastName(productTarget.name || 'Producto');
      setProductToastCategory(productTarget.category || 'General');
      setShowProductDeletedToast(true);
      setSuccess('Producto eliminado.');
      setShowDeleteModal(false);
      setProductTarget(null);
      await refreshProducts();
    } catch (err: any) {
      if (String(err?.code || '').trim() === '23503') {
        setShowDeleteModal(false);
        setShowDeactivateModal(true);
        return;
      }

      setError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeactivateProduct = async () => {
    if (!productTarget) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await setInventoryProductActiveStatus({
        businessId,
        productId: productTarget.id,
        isActive: false,
      });
      setSuccess('Producto desactivado.');
      setShowDeactivateModal(false);
      setProductTarget(null);
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desactivar el producto.');
    } finally {
      setDeleting(false);
    }
  };

  const activateProduct = async (product: InventoryProductRecord) => {
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await setInventoryProductActiveStatus({
        businessId,
        productId: product.id,
        isActive: true,
      });
      setSuccess('Producto activado.');
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el producto.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={STOCKY_COLORS.primary900} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroIconBox}>
            <Ionicons name="cube-outline" size={40} color="#D1D5DB" />
          </View>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle}>Inventario</Text>
            <Text style={styles.heroSubtitle}>Gestión de productos y stock</Text>
          </View>
        </View>

        <Pressable
          style={[styles.heroCreateButton, (!canManageProducts || checkingPermissions) && styles.buttonDisabled]}
          onPress={openCreateModal}
          disabled={!canManageProducts || checkingPermissions}
        >
          <Ionicons name="add" size={22} color="rgba(255,255,255,0.88)" />
          <Text style={styles.heroCreateButtonText}>Agregar Producto</Text>
        </Pressable>
      </LinearGradient>

      {!canManageProducts ? (
        <Text style={styles.permissionText}>Modo consulta: sin permisos de edición</Text>
      ) : null}

      <View style={styles.searchCard}>
        <View style={styles.searchTitleRow}>
          <Ionicons name="search-outline" size={18} color="#1E3A8A" />
          <Text style={styles.searchTitle}>Buscar producto por nombre</Text>
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Ej: Coca Cola, Arroz, Cerveza..."
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <StatusFilterSelector value={statusFilter} onChange={setStatusFilter} />
        <Text style={styles.searchResultText}>
          Mostrando {filteredProducts.length} de {products.length} productos
        </Text>
      </View>

      {refreshing ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}

      {filteredProducts.length === 0 ? (
        <Text style={styles.emptyText}>No hay productos para los filtros actuales.</Text>
      ) : null}

      {filteredProducts.map((product) => {
        const lowStock = product.manage_stock !== false
          && Number(product.stock || 0) <= Number(product.min_stock || 5);

        return (
          <View key={product.id} style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.productNameRow}>
                <Ionicons name="cube-outline" size={24} color="#111827" />
                <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
              </View>
            </View>

            <View style={styles.productTagRow}>
              <View style={styles.metaTag}>
                <Ionicons name="pricetag-outline" size={15} color="#111827" />
                <Text style={styles.metaTagText}>{product.code || 'Sin código'}</Text>
              </View>
              <View style={styles.categoryTag}>
                <Ionicons name="bar-chart-outline" size={15} color="#1D4ED8" />
                <Text style={styles.categoryTagText}>{product.category || 'General'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.productInfoGrid}>
              <View style={styles.infoCell}>
                <View style={styles.providerBlock}>
                  <View style={styles.providerTitleRow}>
                    <Ionicons name="business-outline" size={17} color="#111827" />
                    <Text style={styles.providerLabel}>PROVEEDOR</Text>
                  </View>
                  <Text style={styles.providerValue}>{getSupplierDisplayName(product.supplier)}</Text>
                </View>
              </View>

              <View style={styles.infoCell}>
                <View style={styles.metricCell}>
                  <View style={styles.metricTitleRow}>
                    <Ionicons name="checkmark-done-outline" size={16} color="#111827" />
                    <Text style={styles.metricLabel}>ESTADO</Text>
                  </View>
                  <StatusBadge active={product.is_active} />
                </View>
              </View>

              <View style={styles.infoCell}>
                <View style={styles.metricCell}>
                  <View style={styles.metricTitleRow}>
                    <Ionicons name="trending-down-outline" size={16} color="#C2410C" />
                    <Text style={styles.metricLabel}>P. COMPRA</Text>
                  </View>
                  <StockyMoneyText value={product.purchase_price} style={styles.purchaseValue} />
                </View>
              </View>

              <View style={styles.infoCell}>
                <View style={styles.metricCell}>
                  <View style={styles.metricTitleRow}>
                    <Ionicons name="trending-up-outline" size={16} color="#059669" />
                    <Text style={styles.metricLabel}>P. VENTA</Text>
                  </View>
                  <StockyMoneyText value={product.sale_price} style={styles.saleValue} />
                </View>
              </View>

              <View style={styles.infoCell}>
                <View style={styles.metricCell}>
                  <View style={styles.metricTitleRow}>
                    <Ionicons name="cube-outline" size={16} color="#111827" />
                    <Text style={styles.metricLabel}>STOCK</Text>
                  </View>
                  <View style={styles.stockPill}>
                    <Text style={[styles.stockText, lowStock && styles.lowStockText]}>
                      {product.manage_stock !== false ? `${product.stock} ${product.unit}` : 'Sin control'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoCell}>
                <View style={styles.metricCell}>
                  <View style={styles.metricTitleRow}>
                    <Ionicons name="warning-outline" size={16} color="#111827" />
                    <Text style={styles.metricLabel}>MÍNIMO</Text>
                  </View>
                  <Text style={styles.minValue}>
                    {product.manage_stock !== false ? `${product.min_stock} ${product.unit}` : 'No aplica'}
                  </Text>
                </View>
              </View>
            </View>

            {canManageProducts ? (
              <>
                <View style={styles.divider} />
                <View style={styles.productActionsRow}>
                  <Pressable style={[styles.editButton, styles.productActionHalf]} onPress={() => openEditModal(product)}>
                    <Ionicons name="create-outline" size={18} color="#DDE6FF" />
                    <Text style={styles.editButtonText}>Editar</Text>
                  </Pressable>

                  {product.is_active ? (
                    <Pressable style={[styles.deleteButton, styles.productActionHalf]} onPress={() => askDeleteProduct(product)}>
                      <Ionicons name="trash-outline" size={18} color="#FFE4E6" />
                      <Text style={styles.deleteButtonText}>Eliminar</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.activateButton, styles.productActionHalf]}
                      onPress={() => activateProduct(product)}
                      disabled={deleting}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#DCFCE7" />
                      <Text style={styles.activateButtonText}>Activar</Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : null}
          </View>
        );
      })}

      {hasMoreProducts ? (
        <View style={styles.loadMoreWrap}>
          <Text style={styles.loadMoreHint}>Mostrando {products.length} productos</Text>
          <StockyButton onPress={loadMoreProducts} loading={loadingMore} variant="ghost">
            Cargar más productos
          </StockyButton>
        </View>
      ) : null}

      <StockyModal
        visible={showFormModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="none"
        bodyFlex
        sheetStyle={styles.productFormSheet}
        onClose={closeFormModal}
        headerSlot={(
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.productFormHeader}
          >
            <View style={styles.productFormHeaderLeft}>
              <View style={styles.productFormHeaderIconWrap}>
                <Ionicons name={editingProduct ? 'create-outline' : 'add'} size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.productFormHeaderTitle}>
                {editingProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
              </Text>
            </View>
            <Pressable onPress={closeFormModal} style={styles.productFormHeaderClose} disabled={saving}>
              <Ionicons name="close" size={24} color="#E5E7EB" />
            </Pressable>
          </LinearGradient>
        )}
        footerStyle={styles.productFormFooter}
        footer={(
          <View style={styles.productFormFooterRow}>
            <Pressable style={[styles.productFormCancelButton, saving && styles.buttonDisabled]} onPress={closeFormModal} disabled={saving}>
              <Text style={styles.productFormCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.productFormSaveWrap, saving && styles.buttonDisabled]} onPress={handleSaveProduct} disabled={saving}>
              <LinearGradient
                colors={editingProduct ? ['#2563EB', '#1D4ED8'] : ['#16A34A', '#15803D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.productFormSaveButton}
              >
                {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />}
                <Text style={styles.productFormSaveText}>
                  {saving ? (editingProduct ? 'Actualizando...' : 'Creando...') : (editingProduct ? 'Actualizar Producto' : 'Guardar Producto')}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      >
        <View style={styles.formFields}>
          {error ? (
            <View style={styles.formErrorCard}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.formErrorText}>{error}</Text>
            </View>
          ) : null}
          {editingProduct ? (
            <View style={styles.readOnlyCode}>
              <Text style={styles.readOnlyCodeLabel}>Código</Text>
              <Text style={styles.readOnlyCodeValue}>{editingProduct.code || 'n/a'}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Nombre del producto *</Text>
            <TextInput
              value={form.name}
              onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
              placeholder="Ej: Laptop HP"
              placeholderTextColor={STOCKY_COLORS.textMuted}
              style={styles.textInput}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Categoría *</Text>
            <Pressable style={styles.selectInput} onPress={openCategoryPicker}>
              <Text style={[styles.selectInputText, !form.category && styles.selectInputPlaceholder]}>
                {form.category || 'Seleccionar categoría'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </Pressable>
          </View>

          <View style={styles.warningCard}>
            <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
            <Text style={styles.warningText}>
              Nota importante: para que los productos aparezcan en los recibos de cocina, deben estar en la
              categoría "Platos". Los productos de otras categorías no se incluirán.
            </Text>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.fieldGroup, styles.formCol]}>
              <Text style={styles.inputLabel}>Precio compra *</Text>
              <TextInput
                value={form.purchasePrice}
                onChangeText={(value) => setForm((prev) => ({ ...prev, purchasePrice: value }))}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={STOCKY_COLORS.textMuted}
                style={styles.textInput}
              />
            </View>
            <View style={[styles.fieldGroup, styles.formCol]}>
              <Text style={styles.inputLabel}>Precio venta *</Text>
              <TextInput
                value={form.salePrice}
                onChangeText={(value) => setForm((prev) => ({ ...prev, salePrice: value }))}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={STOCKY_COLORS.textMuted}
                style={styles.textInput}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Control de stock</Text>
            <Pressable
              style={styles.stockControlRow}
              onPress={() => setForm((prev) => (
                prev.manageStock
                  ? { ...prev, manageStock: false, stock: '0', minStock: '0' }
                  : { ...prev, manageStock: true }
              ))}
            >
              <Text style={styles.stockControlText}>¿Este producto lleva control de stock?</Text>
              <Ionicons
                name={form.manageStock ? 'checkbox' : 'square-outline'}
                size={22}
                color={form.manageStock ? '#6D28D9' : '#64748B'}
              />
            </Pressable>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.fieldGroup, styles.formColThird]}>
              <Text style={styles.inputLabel}>Stock {editingProduct ? 'actual' : 'inicial'} {form.manageStock ? '*' : '(deshabilitado)'}</Text>
              <TextInput
                value={form.stock}
                onChangeText={(value) => setForm((prev) => ({ ...prev, stock: value }))}
                placeholder="0"
                keyboardType="numeric"
                editable={!editingProduct && form.manageStock}
                placeholderTextColor={STOCKY_COLORS.textMuted}
                style={[styles.textInput, (!form.manageStock || !!editingProduct) && styles.textInputDisabled]}
              />
            </View>
            <View style={[styles.fieldGroup, styles.formColThird]}>
              <Text style={styles.inputLabel}>Stock mínimo</Text>
              <TextInput
                value={form.minStock}
                onChangeText={(value) => setForm((prev) => ({ ...prev, minStock: value }))}
                placeholder="5"
                keyboardType="numeric"
                editable={form.manageStock}
                placeholderTextColor={STOCKY_COLORS.textMuted}
                style={[styles.textInput, !form.manageStock && styles.textInputDisabled]}
              />
            </View>
            <View style={[styles.fieldGroup, styles.formColThird]}>
              <Text style={styles.inputLabel}>Unidad</Text>
              <Pressable style={styles.selectInput} onPress={openUnitPicker}>
                <Text style={styles.selectInputText}>{selectedUnitLabel}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>Proveedor (opcional)</Text>
            <Pressable style={styles.selectInput} onPress={openSupplierPicker}>
              <Text style={[styles.selectInputText, !form.supplierId && styles.selectInputPlaceholder]} numberOfLines={1}>
                {selectedSupplierLabel}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </Pressable>
          </View>
        </View>
      </StockyModal>

      <StockyModal
        visible={showCategoryModal}
        title="Seleccionar categoría"
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={26}
        bodyFlex
        onClose={closeCategoryPicker}
      >
        {INVENTORY_CATEGORY_OPTIONS.map((category) => {
          const selected = form.category === category;
          return (
            <Pressable
              key={category}
              style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
              onPress={() => {
                setForm((prev) => ({ ...prev, category }));
                closeCategoryPicker();
              }}
            >
              <Text style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}>{category}</Text>
            </Pressable>
          );
        })}
      </StockyModal>

      <StockyModal
        visible={showUnitModal}
        title="Seleccionar unidad"
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={26}
        bodyFlex
        onClose={closeUnitPicker}
      >
        {UNIT_OPTIONS.map((unit) => {
          const selected = form.unit === unit.value;
          return (
            <Pressable
              key={unit.value}
              style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
              onPress={() => {
                setForm((prev) => ({ ...prev, unit: unit.value }));
                closeUnitPicker();
              }}
            >
              <Text style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}>{unit.label}</Text>
            </Pressable>
          );
        })}
      </StockyModal>

      <StockyModal
        visible={showSupplierModal}
        title="Seleccionar proveedor"
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={26}
        bodyFlex
        onClose={closeSupplierPicker}
      >
        <Pressable
          style={[styles.modalOptionItem, !form.supplierId && styles.modalOptionItemSelected]}
          onPress={() => {
            setForm((prev) => ({ ...prev, supplierId: '' }));
            closeSupplierPicker();
          }}
        >
          <Text style={[styles.modalOptionItemText, !form.supplierId && styles.modalOptionItemTextSelected]}>Sin proveedor</Text>
        </Pressable>
        {suppliers.map((supplier) => {
          const selected = form.supplierId === supplier.id;
          return (
            <Pressable
              key={supplier.id}
              style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
              onPress={() => {
                setForm((prev) => ({ ...prev, supplierId: supplier.id }));
                closeSupplierPicker();
              }}
            >
              <Text style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}>
                {getSupplierDisplayName(supplier)}
              </Text>
            </Pressable>
          );
        })}
      </StockyModal>

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title="Eliminar producto"
        message={`¿Seguro que quieres eliminar ${productTarget?.name || 'este producto'}?`}
        warning="Si tiene historial en ventas/compras, se te ofrecerá desactivarlo en su lugar."
        itemLabel={productTarget?.name || null}
        loading={deleting}
        onCancel={() => {
          setShowDeleteModal(false);
          setProductTarget(null);
        }}
        onConfirm={confirmDeleteProduct}
      />

      <StockyModal
        visible={showDeactivateModal}
        title="Desactivar producto"
        onClose={() => {
          setShowDeactivateModal(false);
          setProductTarget(null);
        }}
        footer={(
          <View style={styles.modalFooterRow}>
            <StockyButton
              variant="ghost"
              onPress={() => {
                setShowDeactivateModal(false);
                setProductTarget(null);
              }}
              disabled={deleting}
            >
              Cancelar
            </StockyButton>
            <StockyButton onPress={confirmDeactivateProduct} loading={deleting} disabled={deleting}>
              Desactivar
            </StockyButton>
          </View>
        )}
      >
        <Text style={styles.modalText}>
          {productTarget?.name || 'Este producto'} no se puede eliminar por historial.
        </Text>
        <Text style={styles.modalSubText}>Puedes desactivarlo para ocultarlo del catálogo activo.</Text>
      </StockyModal>
      <StockyStatusToast
        visible={showProductCreatedToast}
        title="Producto Creado"
        primaryLabel="Producto"
        primaryValue={productToastName || 'Producto'}
        secondaryLabel="Categoría"
        secondaryValue={productToastCategory || 'General'}
        durationMs={1200}
        onClose={() => setShowProductCreatedToast(false)}
      />
      <StockyStatusToast
        visible={showProductUpdatedToast}
        title="Producto Actualizado"
        primaryLabel="Producto"
        primaryValue={productToastName || 'Producto'}
        secondaryLabel="Categoría"
        secondaryValue={productToastCategory || 'General'}
        durationMs={1200}
        onClose={() => setShowProductUpdatedToast(false)}
      />
      <StockyStatusToast
        visible={showProductDeletedToast}
        title="Producto Eliminado"
        primaryLabel="Producto"
        primaryValue={productToastName || 'Producto'}
        secondaryLabel="Estado"
        secondaryValue="Eliminado"
        durationMs={1200}
        onClose={() => setShowProductDeletedToast(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingContainer: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 100,
    height: 100,
    borderRadius: 20,
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
    fontSize: 24,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#D1D5DB',
    fontSize: 17,
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
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  permissionText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  searchCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchInput: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  searchResultText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterOption: {
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    borderRadius: STOCKY_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: STOCKY_COLORS.surface,
  },
  filterOptionSelected: {
    borderColor: STOCKY_COLORS.primary700,
    backgroundColor: 'rgba(17, 138, 178, 0.12)',
  },
  filterOptionText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterOptionTextSelected: {
    color: STOCKY_COLORS.primary900,
  },
  emptyText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  productCard: {
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
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  productName: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  productTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaTag: {
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
  metaTagText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryTag: {
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryTagText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  productInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoCell: {
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
  providerBlock: {
    gap: 2,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  providerLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  providerValue: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  metricCell: {
    gap: 2,
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  metricLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  purchaseValue: {
    color: '#C2410C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  saleValue: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  stockPill: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stockText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  lowStockText: {
    color: '#C62828',
  },
  minValue: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  productActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  productActionHalf: {
    flex: 1,
  },
  editButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#2E7DF2',
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
  editButtonText: {
    color: '#DDE6FF',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
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
  deleteButtonText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '600',
  },
  activateButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#00C951',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  activateButtonText: {
    color: '#DCFCE7',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
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
  modalFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formFields: {
    gap: 10,
  },
  productFormSheet: {
    maxHeight: '88%',
    height: '88%',
    borderRadius: 26,
    borderColor: '#D9DEE8',
  },
  productFormHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productFormHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  productFormHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productFormHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  productFormHeaderClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  productFormFooter: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productFormFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  productFormCancelButton: {
    minHeight: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7DEE8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  productFormCancelText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '700',
  },
  productFormSaveWrap: {
    flex: 1,
  },
  productFormSaveButton: {
    minHeight: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  productFormSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  readOnlyCode: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  readOnlyCodeLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  readOnlyCodeValue: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  textInput: {
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
  textInputDisabled: {
    backgroundColor: 'rgba(232, 244, 246, 0.6)',
    color: STOCKY_COLORS.textMuted,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formCol: {
    flex: 1,
  },
  formColThird: {
    flex: 1,
    minWidth: 92,
  },
  selectInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectInputText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  selectInputPlaceholder: {
    color: '#9CA3AF',
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
  warningCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  warningText: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    flex: 1,
  },
  stockControlRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stockControlText: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  modalOptionItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  modalOptionItemSelected: {
    borderColor: '#6D28D9',
    backgroundColor: '#F3E8FF',
  },
  modalOptionItemText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOptionItemTextSelected: {
    color: '#5B21B6',
  },
  supplierList: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  supplierChip: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 220,
  },
  supplierChipSelected: {
    borderColor: STOCKY_COLORS.primary700,
    backgroundColor: 'rgba(17, 138, 178, 0.12)',
  },
  supplierChipText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  supplierChipTextSelected: {
    color: STOCKY_COLORS.primary900,
  },
  modalText: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  modalSubText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
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
