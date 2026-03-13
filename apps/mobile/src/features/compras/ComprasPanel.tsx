import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '../../lib/supabase';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyMoneyText } from '../../ui/StockyMoneyText';
import { StockyModal } from '../../ui/StockyModal';
import { StockyProcessingOverlay } from '../../ui/StockyProcessingOverlay';
import { StockyStatusToast } from '../../ui/StockyStatusToast';
import { formatCop } from '../../services/mesasService';
import {
  createCompraWithRpcFallback,
  deleteCompraWithStockFallback,
  listCompraDetails,
  listPurchaseProducts,
  listPurchaseSuppliers,
  listRecentCompras,
  type CompraCartItem,
  type CompraDetailRecord,
  type CompraProductRecord,
  type CompraRecord,
  type CompraSupplierRecord,
} from '../../services/comprasService';

type Props = {
  businessId: string;
  businessName: string | null;
  userId: string;
  source: 'owner' | 'employee';
};

const PAGE_SIZE = 20;
const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getPaymentMethodLabel(method: string) {
  const value = String(method || '').toLowerCase();
  if (value === 'cash') return 'Efectivo';
  if (value === 'card') return 'Tarjeta';
  if (value === 'transfer') return 'Transferencia';
  if (value === 'mixed') return 'Mixto';
  if (value === 'efectivo') return 'Efectivo';
  if (value === 'tarjeta') return 'Tarjeta';
  if (value === 'transferencia') return 'Transferencia';
  return method || '-';
}

function getPurchasePaymentTheme(method: string): {
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  textColor: string;
  iconColor: string;
} {
  const value = String(method || '').toLowerCase();
  if (value === 'card' || value === 'tarjeta') {
    return {
      icon: 'card-outline',
      backgroundColor: '#DBEAFE',
      textColor: '#1D4ED8',
      iconColor: '#2563EB',
    };
  }
  if (value === 'transfer' || value === 'transferencia') {
    return {
      icon: 'swap-horizontal-outline',
      backgroundColor: '#E0E7FF',
      textColor: '#4338CA',
      iconColor: '#4F46E5',
    };
  }
  if (value === 'mixed' || value === 'mixto') {
    return {
      icon: 'layers-outline',
      backgroundColor: '#F3E8FF',
      textColor: '#7E22CE',
      iconColor: '#9333EA',
    };
  }
  return {
    icon: 'cash-outline',
    backgroundColor: '#DCFCE7',
    textColor: '#166534',
    iconColor: '#16A34A',
  };
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function getPurchaseDayKey(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabelFromKey(key: string) {
  if (!key || key === 'all') return 'Todos los dias';
  const parsed = new Date(`${key}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return key;
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function parseDayKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return null;
  const [yearRaw, monthRaw, dayRaw] = key.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatDayKey(date: Date) {
  const base = startOfDay(date);
  const year = base.getFullYear();
  const month = `${base.getMonth() + 1}`.padStart(2, '0');
  const day = `${base.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampDate(date: Date, minDate: Date, maxDate: Date) {
  const ts = startOfDay(date).getTime();
  const minTs = startOfDay(minDate).getTime();
  const maxTs = startOfDay(maxDate).getTime();
  if (ts < minTs) return startOfDay(minDate);
  if (ts > maxTs) return startOfDay(maxDate);
  return startOfDay(date);
}

function capitalizeLabel(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function PaymentMethodSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options: Array<{ value: string; label: string }> = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'mixed', label: 'Mixto' },
  ];

  return (
    <View style={styles.paymentMethodGrid}>
      {options.map((option) => {
        const selected = String(value || '').toLowerCase() === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.paymentMethodOption, selected && styles.paymentMethodOptionSelected]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.paymentMethodOptionText, selected && styles.paymentMethodOptionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ComprasPanel({ businessId, businessName, userId, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [creatingPurchase, setCreatingPurchase] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);

  const [products, setProducts] = useState<CompraProductRecord[]>([]);
  const [suppliers, setSuppliers] = useState<CompraSupplierRecord[]>([]);
  const [purchases, setPurchases] = useState<CompraRecord[]>([]);

  const [productSearch, setProductSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cart, setCart] = useState<CompraCartItem[]>([]);
  const [showCreatePurchaseModal, setShowCreatePurchaseModal] = useState(false);
  const [showPurchaseCreatedToast, setShowPurchaseCreatedToast] = useState(false);
  const [purchaseTotalLabel, setPurchaseTotalLabel] = useState('');
  const [purchaseSupplierToastLabel, setPurchaseSupplierToastLabel] = useState('');
  const [showPurchaseDeletedToast, setShowPurchaseDeletedToast] = useState(false);
  const [purchaseDeletedTotalLabel, setPurchaseDeletedTotalLabel] = useState('');

  const [dayFilter, setDayFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [showFiltersExpanded, setShowFiltersExpanded] = useState(false);
  const [dayCalendarMonth, setDayCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [showDayFilterModal, setShowDayFilterModal] = useState(false);
  const [showSupplierFilterModal, setShowSupplierFilterModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [canDeletePurchases, setCanDeletePurchases] = useState(source === 'owner');

  const [selectedPurchase, setSelectedPurchase] = useState<CompraRecord | null>(null);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<CompraDetailRecord[]>([]);
  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);
  const [loadingPurchaseDetails, setLoadingPurchaseDetails] = useState(false);

  const [purchaseToDelete, setPurchaseToDelete] = useState<CompraRecord | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const selectedPurchaseIdRef = useRef<string>('');
  const showPurchaseDetailsRef = useRef(false);
  const purchasesRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const purchaseSupplierLabel = useMemo(() => {
    if (!supplierId) return 'Sin proveedor seleccionado';
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) return 'Sin proveedor seleccionado';
    return supplier.business_name || supplier.contact_name || supplier.id.slice(0, 6);
  }, [supplierId, suppliers]);

  const loadCatalogData = useCallback(async (forceRefresh = false) => {
    setLoadingCatalog(true);
    try {
      const [productsResult, suppliersResult] = await Promise.all([
        listPurchaseProducts(businessId, { forceRefresh }),
        listPurchaseSuppliers(businessId, { forceRefresh }),
      ]);
      setProducts(productsResult);
      setSuppliers(suppliersResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catalogo de compras.');
    } finally {
      setLoadingCatalog(false);
    }
  }, [businessId]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const purchasesResult = await listRecentCompras(businessId, 50, { ttlMs: 45_000 });
      setPurchases(purchasesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las compras.');
    } finally {
      setLoading(false);
    }

    void loadCatalogData();
  }, [businessId, loadCatalogData]);

  const refreshPurchases = useCallback(async () => {
    setLoadingPurchases(true);
    setError(null);
    try {
      const purchasesResult = await listRecentCompras(businessId, 50, { forceRefresh: true });
      setPurchases(purchasesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo refrescar el historial de compras.');
    } finally {
      setLoadingPurchases(false);
    }
  }, [businessId]);

  const refreshPurchasesSilently = useCallback(async () => {
    try {
      const purchasesResult = await listRecentCompras(businessId, 50, { forceRefresh: true });
      setPurchases(purchasesResult);
    } catch {
      // no-op
    }
  }, [businessId]);

  const refreshProducts = useCallback(async () => {
    try {
      const productsResult = await listPurchaseProducts(businessId, { forceRefresh: true });
      setProducts(productsResult);
    } catch {
      // no-op
    }
  }, [businessId]);

  const refreshCatalogSilently = useCallback(async () => {
    try {
      const [productsResult, suppliersResult] = await Promise.all([
        listPurchaseProducts(businessId, { forceRefresh: true }),
        listPurchaseSuppliers(businessId, { forceRefresh: true }),
      ]);
      setProducts(productsResult);
      setSuppliers(suppliersResult);
    } catch {
      // no-op
    }
  }, [businessId]);

  const openCreatePurchaseModal = useCallback(() => {
    setShowCreatePurchaseModal(true);
    if (products.length === 0 || suppliers.length === 0) {
      void loadCatalogData();
    }
  }, [loadCatalogData, products.length, suppliers.length]);

  const checkDeletePermission = useCallback(async () => {
    if (source === 'owner') {
      setCanDeletePurchases(true);
      return;
    }

    setCheckingAdmin(true);
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
      const role = String(data?.role || '').trim().toLowerCase();
      setCanDeletePurchases(role === 'admin' || role.includes('admin'));
    } catch {
      setCanDeletePurchases(false);
    } finally {
      setCheckingAdmin(false);
    }
  }, [businessId, source, userId]);

  useEffect(() => {
    loadInitialData();
    checkDeletePermission();
  }, [checkDeletePermission, loadInitialData]);

  useEffect(() => {
    selectedPurchaseIdRef.current = String(selectedPurchase?.id || '').trim();
    showPurchaseDetailsRef.current = Boolean(showPurchaseDetails);
  }, [selectedPurchase?.id, showPurchaseDetails]);

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

    const schedulePurchasesRefresh = () => {
      if (cancelled || purchasesRealtimeRefreshTimerRef.current) return;
      purchasesRealtimeRefreshTimerRef.current = setTimeout(() => {
        purchasesRealtimeRefreshTimerRef.current = null;
        void refreshPurchasesSilently();
        const currentPurchaseId = selectedPurchaseIdRef.current;
        if (showPurchaseDetailsRef.current && currentPurchaseId) {
          void listCompraDetails(currentPurchaseId)
            .then((details) => setSelectedPurchaseDetails(details))
            .catch(() => {
              // no-op
            });
        }
      }, 120);
    };

    const scheduleCatalogRefresh = () => {
      if (cancelled || catalogRealtimeRefreshTimerRef.current) return;
      catalogRealtimeRefreshTimerRef.current = setTimeout(() => {
        catalogRealtimeRefreshTimerRef.current = null;
        void refreshCatalogSilently();
      }, 180);
    };

    const channel = client
      .channel(`mobile-compras:${normalizedBusinessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'purchases',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, schedulePurchasesRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'purchase_details',
      }, schedulePurchasesRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleCatalogRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'suppliers',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleCatalogRefresh);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        schedulePurchasesRefresh();
      }
    });

    fallbackTimer = setInterval(() => {
      schedulePurchasesRefresh();
    }, 20000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (purchasesRealtimeRefreshTimerRef.current) {
        clearTimeout(purchasesRealtimeRefreshTimerRef.current);
        purchasesRealtimeRefreshTimerRef.current = null;
      }
      if (catalogRealtimeRefreshTimerRef.current) {
        clearTimeout(catalogRealtimeRefreshTimerRef.current);
        catalogRealtimeRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [businessId, refreshCatalogSilently, refreshPurchasesSilently]);

  const productsFiltered = useMemo(() => {
    const cartProductIds = new Set(cart.map((item) => item.product_id));
    const search = String(productSearch || '').trim().toLowerCase();
    return products
      .filter((product) => {
        if (cartProductIds.has(product.id)) return false;
        if (supplierId && product.supplier_id !== supplierId) return false;
        if (!search) return true;
        return String(product.name || '').toLowerCase().includes(search);
      })
      .slice(0, 120);
  }, [cart, productSearch, products, supplierId]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0),
    [cart],
  );

  const supplierNameById = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((supplier) => {
      const label = supplier.business_name || supplier.contact_name || supplier.id.slice(0, 6);
      map.set(supplier.id, label);
    });
    return map;
  }, [suppliers]);

  const resolvePurchaseSupplierLabel = useCallback((purchase: CompraRecord) => {
    const embedded = purchase.supplier?.business_name || purchase.supplier?.contact_name;
    if (embedded) return embedded;
    const supplierIdRef = String(purchase.supplier_id || '').trim();
    if (!supplierIdRef) return 'Sin proveedor';
    return supplierNameById.get(supplierIdRef) || 'Sin proveedor';
  }, [supplierNameById]);

  const todayDayKey = formatDayKey(new Date());
  const fallbackFirstCompraDayKey = useMemo(() => {
    const unique = Array.from(
      new Set(
        purchases
          .map((purchase) => getPurchaseDayKey(purchase.created_at))
          .filter((value) => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return unique[0] || null;
  }, [purchases]);
  const minSelectableDayKey = fallbackFirstCompraDayKey || todayDayKey;
  const maxSelectableDayKey = todayDayKey;
  const minSelectableDate = parseDayKey(minSelectableDayKey) || startOfDay(new Date());
  const maxSelectableDate = parseDayKey(maxSelectableDayKey) || startOfDay(new Date());
  const minSelectableMonth = startOfMonth(minSelectableDate);
  const maxSelectableMonth = startOfMonth(maxSelectableDate);
  const currentCalendarMonth = startOfMonth(dayCalendarMonth);
  const canGoPrevMonth = currentCalendarMonth.getTime() > minSelectableMonth.getTime();
  const canGoNextMonth = currentCalendarMonth.getTime() < maxSelectableMonth.getTime();
  const currentCalendarMonthLabel = useMemo(
    () => capitalizeLabel(new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(dayCalendarMonth)),
    [dayCalendarMonth],
  );
  const calendarDayCells = useMemo(() => {
    const monthStart = startOfMonth(dayCalendarMonth);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdayOffset = (monthStart.getDay() + 6) % 7;
    const cells: Array<{ key: string; day: number; disabled: boolean; selected: boolean; isToday: boolean } | null> = [];

    for (let index = 0; index < weekdayOffset; index += 1) {
      cells.push(null);
    }

    const minTs = startOfDay(minSelectableDate).getTime();
    const maxTs = startOfDay(maxSelectableDate).getTime();
    const selectedKey = dayFilter === 'all' ? '' : dayFilter;
    const todayKey = formatDayKey(new Date());

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = formatDayKey(date);
      const ts = startOfDay(date).getTime();
      const disabled = ts < minTs || ts > maxTs;
      cells.push({
        key,
        day,
        disabled,
        selected: key === selectedKey,
        isToday: key === todayKey,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [dayCalendarMonth, dayFilter, maxSelectableDate, minSelectableDate]);

  const supplierOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        purchases
          .map((purchase) => purchase.supplier_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return [
      { value: 'all', label: 'Todos los proveedores' },
      ...unique.map((value) => ({
        value,
        label: supplierNameById.get(value) || 'Sin proveedor',
      })),
    ];
  }, [purchases, supplierNameById]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      if (dayFilter !== 'all' && getPurchaseDayKey(purchase.created_at) !== dayFilter) return false;
      if (supplierFilter !== 'all' && purchase.supplier_id !== supplierFilter) return false;
      return true;
    });
  }, [dayFilter, purchases, supplierFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE)), [filteredPurchases.length]);

  useEffect(() => {
    setCurrentPage((prev) => Math.max(1, Math.min(prev, totalPages)));
  }, [totalPages]);

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPurchases.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredPurchases]);

  const pageRange = useMemo(() => {
    if (filteredPurchases.length === 0) return { from: 0, to: 0 };
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, filteredPurchases.length);
    return { from, to };
  }, [currentPage, filteredPurchases.length]);
  const canPrevPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;

  const addProductToCart = useCallback((product: CompraProductRecord) => {
    setError(null);
    setSuccess(null);

    if (!supplierId) {
      setError('Selecciona un proveedor antes de agregar productos.');
      return;
    }
    if (product.supplier_id && product.supplier_id !== supplierId) {
      setError('Ese producto pertenece a otro proveedor.');
      return;
    }
    if (product.manage_stock === false) {
      setError('Este producto no maneja stock y no puede registrarse en compras.');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (!existing) {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: Number(product.purchase_price || 0),
            manage_stock: product.manage_stock !== false,
          },
        ];
      }

      return prev.map((item) => (
        item.product_id === product.id
          ? { ...item, quantity: Number(item.quantity || 0) + 1 }
          : item
      ));
    });
  }, [supplierId]);

  const updateCartQuantity = useCallback((productId: string, nextQuantity: number) => {
    setCart((prev) => {
      if (nextQuantity <= 0) {
        return prev.filter((item) => item.product_id !== productId);
      }

      return prev.map((item) => (
        item.product_id === productId
          ? { ...item, quantity: nextQuantity }
          : item
      ));
    });
  }, []);

  const clearForm = useCallback(() => {
    setSupplierId('');
    setPaymentMethod('cash');
    setCart([]);
    setProductSearch('');
  }, []);

  const submitPurchase = useCallback(async () => {
    if (creatingPurchase) return;
    setError(null);
    setSuccess(null);

    if (!supplierId) {
      setError('Selecciona un proveedor.');
      return;
    }
    if (cart.length === 0) {
      setError('Agrega al menos un producto a la compra.');
      return;
    }
    if (cart.some((item) => item.manage_stock === false)) {
      setError('Hay productos sin control de stock en el carrito. Retiralos para continuar.');
      return;
    }
    if (cart.some((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0;
    })) {
      setError('Hay productos con cantidad o precio invalido.');
      return;
    }
    if (!Number.isFinite(cartTotal) || cartTotal <= 0) {
      setError('El total de la compra debe ser mayor a 0.');
      return;
    }

    setCreatingPurchase(true);
    try {
      await createCompraWithRpcFallback({
        businessId,
        userId,
        supplierId,
        paymentMethod,
        notes: null,
        cart,
      });

      setPurchaseTotalLabel(formatCop(cartTotal));
      setPurchaseSupplierToastLabel(purchaseSupplierLabel);
      setShowPurchaseCreatedToast(true);
      clearForm();
      setSuccess('Compra registrada exitosamente.');
      await Promise.all([refreshPurchases(), refreshProducts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar compra.');
    } finally {
      setCreatingPurchase(false);
    }
  }, [
    businessId,
    cart,
    cartTotal,
    clearForm,
    creatingPurchase,
    paymentMethod,
    refreshProducts,
    refreshPurchases,
    supplierId,
    userId,
  ]);

  const openPurchaseDetails = useCallback(async (purchase: CompraRecord) => {
    setSelectedPurchase(purchase);
    setSelectedPurchaseDetails([]);
    setShowPurchaseDetails(true);
    setLoadingPurchaseDetails(true);
    try {
      const details = await listCompraDetails(purchase.id);
      setSelectedPurchaseDetails(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar detalle de la compra.');
    } finally {
      setLoadingPurchaseDetails(false);
    }
  }, []);

  const closePurchaseDetails = useCallback(() => {
    setShowPurchaseDetails(false);
    setSelectedPurchase(null);
    setSelectedPurchaseDetails([]);
  }, []);

  const askDeletePurchase = useCallback((purchase: CompraRecord) => {
    if (!canDeletePurchases) return;
    setPurchaseToDelete(purchase);
    setShowDeleteModal(true);
  }, [canDeletePurchases]);

  const confirmDeletePurchase = useCallback(async () => {
    if (!purchaseToDelete?.id || !canDeletePurchases) return;

    setDeletingPurchase(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteCompraWithStockFallback({
        purchaseId: purchaseToDelete.id,
        businessId,
      });

      setPurchases((prev) => prev.filter((item) => item.id !== purchaseToDelete.id));
      if (selectedPurchase?.id === purchaseToDelete.id) {
        setShowPurchaseDetails(false);
        setSelectedPurchase(null);
        setSelectedPurchaseDetails([]);
      }

      setPurchaseDeletedTotalLabel(formatCop(purchaseToDelete.total));
      setShowPurchaseDeletedToast(true);
      setShowDeleteModal(false);
      setPurchaseToDelete(null);
      setSuccess(
        result.appliedManualFallback
          ? 'Compra eliminada y stock ajustado manualmente.'
          : 'Compra eliminada exitosamente y stock revertido.',
      );
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar compra.');
    } finally {
      setDeletingPurchase(false);
    }
  }, [businessId, canDeletePurchases, purchaseToDelete, refreshProducts, selectedPurchase?.id]);

  const selectedDayLabel = useMemo(() => formatDayLabelFromKey(dayFilter), [dayFilter]);

  const selectedSupplierLabel = useMemo(
    () => supplierOptions.find((option) => option.value === supplierFilter)?.label || 'Todos los proveedores',
    [supplierFilter, supplierOptions],
  );
  const selectedPurchaseItemsCount = useMemo(
    () => selectedPurchaseDetails.reduce((sum, detail) => sum + Math.max(0, Number(detail.quantity || 0)), 0),
    [selectedPurchaseDetails],
  );
  const selectedPurchasePaymentTheme = useMemo(
    () => (selectedPurchase ? getPurchasePaymentTheme(selectedPurchase.payment_method) : null),
    [selectedPurchase],
  );
  const isProcessingAction = creatingPurchase || deletingPurchase || checkingAdmin;
  const processingLabel = creatingPurchase
    ? 'Registrando compra...'
    : (deletingPurchase
      ? 'Eliminando compra...'
      : (checkingAdmin ? 'Validando permisos...' : 'Procesando...'));

  const openDayFilterCalendar = useCallback(() => {
    const selectedDate = dayFilter !== 'all' ? parseDayKey(dayFilter) : null;
    const baseDate = selectedDate || maxSelectableDate;
    const clamped = clampDate(baseDate, minSelectableDate, maxSelectableDate);
    setDayCalendarMonth(startOfMonth(clamped));
    setShowDayFilterModal(true);
  }, [dayFilter, maxSelectableDate, minSelectableDate]);

  const clearFilters = useCallback(() => {
    setDayFilter('all');
    setSupplierFilter('all');
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    if (dayFilter === 'all') return;
    const selected = parseDayKey(dayFilter);
    if (!selected) {
      setDayFilter('all');
      return;
    }
    const minTs = startOfDay(minSelectableDate).getTime();
    const maxTs = startOfDay(maxSelectableDate).getTime();
    const selectedTs = startOfDay(selected).getTime();
    if (selectedTs < minTs || selectedTs > maxTs) {
      setDayFilter('all');
      setCurrentPage(1);
    }
  }, [dayFilter, maxSelectableDate, minSelectableDate]);

  const handlePrintPurchase = useCallback((_purchase: CompraRecord) => {
    setError(null);
    setSuccess('Enviando compra a imprimir.');
  }, []);

  return (
    <>
      <View style={styles.container}>
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroIconBox}>
              <Ionicons name="bag-handle-outline" size={28} color={STOCKY_COLORS.white} />
            </View>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Compras</Text>
              <Text style={styles.heroSubtitle}>{businessName || businessId}</Text>
            </View>
          </View>

          <Pressable style={styles.heroCreateButton} onPress={openCreatePurchaseModal}>
            <Ionicons name="add" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={styles.heroCreateButtonText}>Nueva Compra</Text>
          </Pressable>
        </LinearGradient>

        {loading ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        {loadingPurchases ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        {error ? null : null}

        <View style={styles.filtersCard}>
          <View style={styles.filtersHeaderRow}>
            <View style={styles.filtersTitleRow}>
              <Ionicons name="filter-outline" size={25} color="#7C3AED" />
              <Text style={styles.filtersTitle}>Filtros de Compras</Text>
            </View>
            <Pressable
              style={styles.filtersToggleButton}
              onPress={() => setShowFiltersExpanded((prev) => !prev)}
            >
              <Text style={styles.filtersToggleText}>{showFiltersExpanded ? 'Cerrar' : 'Abrir'}</Text>
              <Ionicons
                name={showFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#4F46E5"
              />
            </Pressable>
          </View>
          <Text style={styles.filtersSubTitle}>Filtra por un dia especifico.</Text>

          {showFiltersExpanded ? (
            <>
              <View style={styles.filterFieldCard}>
                <View style={styles.filterFieldHeader}>
                  <Ionicons name="calendar-clear-outline" size={22} color="#A21CAF" />
                  <Text style={styles.filterFieldLabel}>Dia</Text>
                </View>
                <Pressable style={styles.filterSelectBox} onPress={openDayFilterCalendar}>
                  <Text
                    style={[
                      styles.filterSelectText,
                      dayFilter === 'all' && styles.filterSelectPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedDayLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#64748B" />
                </Pressable>
              </View>

              <View style={styles.filterFieldCard}>
                <View style={styles.filterFieldHeader}>
                  <Ionicons name="storefront-outline" size={22} color="#A21CAF" />
                  <Text style={styles.filterFieldLabel}>Proveedor</Text>
                </View>
                <Pressable style={styles.filterSelectBox} onPress={() => setShowSupplierFilterModal(true)}>
                  <Text
                    style={[
                      styles.filterSelectText,
                      supplierFilter === 'all' && styles.filterSelectPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedSupplierLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#64748B" />
                </Pressable>
              </View>

              <Pressable style={styles.clearFilterButton} onPress={clearFilters}>
                <Ionicons name="close" size={24} color="#334155" />
                <Text style={styles.clearFilterButtonText}>Limpiar</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        <View style={styles.paginationCard}>
          <Text style={styles.paginationText}>
            Mostrando {pageRange.from} a {pageRange.to} de {filteredPurchases.length} registros
          </Text>
          <View style={styles.paginationControls}>
            <Pressable
              style={[
                styles.paginationArrowButton,
                canPrevPage && styles.paginationArrowButtonActive,
                !canPrevPage && styles.buttonDisabled,
              ]}
              onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={!canPrevPage}
            >
              <Ionicons name="chevron-back" size={19} color={canPrevPage ? '#4F46E5' : '#9CA3AF'} />
            </Pressable>
            <View style={styles.paginationPageBadge}>
              <Text style={styles.paginationPageText}>Pagina {currentPage} de {totalPages}</Text>
            </View>
            <Pressable
              style={[
                styles.paginationArrowButton,
                canNextPage && styles.paginationArrowButtonActive,
                !canNextPage && styles.buttonDisabled,
              ]}
              onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={!canNextPage}
            >
              <Ionicons name="chevron-forward" size={19} color={canNextPage ? '#4F46E5' : '#9CA3AF'} />
            </Pressable>
          </View>
        </View>

        {!loading && paginatedPurchases.length === 0 ? (
          <Text style={styles.emptyText}>No hay compras para esos filtros.</Text>
        ) : null}

        {paginatedPurchases.map((purchase) => (
          <View key={purchase.id} style={styles.saleCard}>
            <View style={styles.saleDateRow}>
              <Ionicons name="calendar-outline" size={26} color="#111827" />
              <Text style={styles.saleDateText}>{formatDateTime(purchase.created_at)}</Text>
            </View>

            <View style={styles.saleInfoGrid}>
              <View style={styles.saleInfoColumn}>
                <View style={styles.saleMetaBlock}>
                  <Text style={styles.saleMetaLabel}>PROVEEDOR</Text>
                  <Text style={styles.saleMetaValue} numberOfLines={1}>
                    {resolvePurchaseSupplierLabel(purchase)}
                  </Text>
                </View>
              </View>

              <View style={[styles.saleInfoColumn, styles.saleInfoColumnRight]}>
                <View style={styles.paymentRow}>
                  <Ionicons name="wallet-outline" size={20} color="#111827" />
                  <View style={styles.paymentPill}>
                    <Ionicons name="card-outline" size={13} color="#166534" style={styles.paymentIcon} />
                    <Text style={styles.paymentPillText}>{getPaymentMethodLabel(purchase.payment_method)}</Text>
                  </View>
                </View>
                <View style={styles.saleTotalBlock}>
                  <Text style={styles.saleCardTotalLabel}>TOTAL</Text>
                  <StockyMoneyText value={purchase.total} style={styles.saleCardTotalValue} />
                </View>
              </View>
            </View>

            <View style={styles.saleActionRow}>
              <Pressable style={[styles.saleDetailsButton, styles.saleActionHalf]} onPress={() => openPurchaseDetails(purchase)}>
                <Ionicons name="eye-outline" size={20} color="#D1D5DB" />
                <Text style={styles.saleDetailsText}>Ver Detalles</Text>
              </Pressable>

              <Pressable style={[styles.salePrintButton, styles.saleActionHalf]} onPress={() => handlePrintPurchase(purchase)}>
                <Ionicons name="print-outline" size={20} color="#DCFCE7" />
                <Text style={styles.salePrintText}>Imprimir</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.saleDeleteButton, !canDeletePurchases && styles.buttonDisabled]}
              onPress={() => askDeletePurchase(purchase)}
              disabled={!canDeletePurchases}
            >
              <Ionicons name="trash-outline" size={20} color="#FEE2E2" />
              <Text style={styles.saleDeleteText}>Eliminar</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <StockyModal
        visible={showCreatePurchaseModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="none"
        sheetStyle={styles.purchaseOrderModalSheet}
        onClose={() => {
          if (creatingPurchase) return;
          setShowCreatePurchaseModal(false);
        }}
        headerSlot={(
          <View style={styles.purchaseOrderModalHeader}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.purchaseOrderModalHeaderIcon}
            >
              <Ionicons name="cart-outline" size={30} color="#D1D5DB" />
            </LinearGradient>
            <Text style={styles.purchaseOrderModalHeaderTitle}>Nueva Compra</Text>
            <Pressable
              style={[styles.purchaseOrderModalHeaderClose, creatingPurchase && styles.buttonDisabled]}
              onPress={() => {
                if (creatingPurchase) return;
                setShowCreatePurchaseModal(false);
              }}
              disabled={creatingPurchase}
            >
              <Ionicons name="close" size={34} color="#111827" />
            </Pressable>
          </View>
        )}
        contentContainerStyle={styles.purchaseOrderModalContent}
        footerStyle={styles.purchaseOrderModalFooter}
        footer={(
          <View style={styles.purchaseOrderFooterContainer}>
            <View style={styles.purchaseOrderFooterTotalBlock}>
              <Text style={styles.purchaseOrderFooterTotalLabel}>Total compra:</Text>
              <StockyMoneyText value={cartTotal} style={styles.purchaseOrderFooterTotalValue} />
            </View>

            <View style={styles.saleActions}>
              <Pressable
                style={styles.purchaseOrderSecondaryButton}
                onPress={clearForm}
                disabled={creatingPurchase || cart.length === 0}
              >
                <Text style={styles.purchaseOrderSecondaryButtonText}>Limpiar</Text>
              </Pressable>
              <Pressable
                style={[styles.purchaseOrderPrimaryButton, (creatingPurchase || cart.length === 0) && styles.buttonDisabled]}
                onPress={submitPurchase}
                disabled={creatingPurchase || cart.length === 0}
              >
                <Text style={styles.purchaseOrderPrimaryButtonText}>
                  {creatingPurchase ? 'Registrando...' : 'Registrar compra'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      >
        <View style={styles.purchaseOrderBlock}>
          <View style={styles.purchaseOrderBlockHeader}>
            <Text style={styles.purchaseOrderBlockTitle}>Proveedor</Text>
            <Text style={styles.purchaseOrderBlockHint}>{purchaseSupplierLabel}</Text>
          </View>
          <Text style={styles.helperText}>Selecciona proveedor para filtrar productos.</Text>
          <View style={styles.filterRow}>
            {suppliers.map((supplier) => {
              const selected = supplierId === supplier.id;
              const label = supplier.business_name || supplier.contact_name || supplier.id.slice(0, 6);
              return (
                <Pressable
                  key={supplier.id}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  onPress={() => {
                    setSupplierId((prev) => (prev === supplier.id ? '' : supplier.id));
                    setCart([]);
                  }}
                >
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.catalogSearchHeader}>
          <Ionicons name="search-outline" size={24} color="#111827" />
          <Text style={styles.catalogSearchHeaderText}>Agregar Producto</Text>
        </View>
        <TextInput
          value={productSearch}
          onChangeText={setProductSearch}
          placeholder={supplierId ? 'Buscar producto...' : 'Primero selecciona un proveedor...'}
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          editable={Boolean(supplierId)}
        />

        {!supplierId ? (
          <Text style={styles.emptyText}>Selecciona proveedor para habilitar catalogo de compra.</Text>
        ) : loadingCatalog ? (
          <View style={styles.modalLoadingInline}>
            <ActivityIndicator color={STOCKY_COLORS.primary900} />
            <Text style={styles.emptyText}>Cargando productos...</Text>
          </View>
        ) : productsFiltered.length === 0 ? (
          <Text style={styles.emptyText}>No hay productos para este proveedor.</Text>
        ) : (
          <View style={styles.catalogResultsCard}>
            {productsFiltered.map((product, index) => (
              <Pressable
                key={product.id}
                style={[styles.catalogResultRow, index < productsFiltered.length - 1 && styles.catalogResultRowDivider]}
                onPress={() => addProductToCart(product)}
                disabled={creatingPurchase}
              >
                <View style={styles.catalogResultLeft}>
                  <Text style={styles.catalogResultName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.catalogResultMeta}>Stock: {product.stock}</Text>
                </View>
                <View style={styles.catalogResultRight}>
                  <StockyMoneyText value={product.purchase_price} style={styles.catalogResultPrice} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.orderItemsTitle}>Items de la compra</Text>
        {cart.length === 0 ? (
          <View style={styles.orderItemsEmpty}>
            <Ionicons name="cart-outline" size={56} color="#0F172A" />
            <Text style={styles.orderItemsEmptyText}>Aun no hay productos en el carrito</Text>
          </View>
        ) : (
          cart.map((item) => (
            <View key={item.product_id} style={styles.orderItemCard}>
              <View style={styles.orderItemTopRow}>
                <Text style={styles.orderItemName}>{item.product_name}</Text>
                <StockyMoneyText
                  value={Number(item.quantity || 0) * Number(item.unit_price || 0)}
                  style={styles.orderItemTotal}
                />
              </View>

              <View style={styles.orderItemControlsRow}>
                <View style={styles.orderItemStepper}>
                  <Pressable
                    style={styles.orderItemStepperButton}
                    onPress={() => updateCartQuantity(item.product_id, Number(item.quantity || 0) - 1)}
                  >
                    <Text style={styles.orderItemMinusText}>-</Text>
                  </Pressable>
                  <Text style={styles.orderItemQtyText}>{item.quantity}</Text>
                  <Pressable
                    style={styles.orderItemStepperButton}
                    onPress={() => updateCartQuantity(item.product_id, Number(item.quantity || 0) + 1)}
                  >
                    <Text style={styles.orderItemPlusText}>+</Text>
                  </Pressable>
                </View>
              </View>

            </View>
          ))
        )}

        <View style={styles.purchasePaymentBlock}>
          <View style={styles.purchasePaymentHeader}>
            <Text style={styles.purchasePaymentTitle}>Pago</Text>
            <Text style={styles.purchasePaymentHint}>{getPaymentMethodLabel(paymentMethod)}</Text>
          </View>
          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
        </View>
      </StockyModal>

      <StockyModal
        visible={showDayFilterModal}
        title="Seleccionar dia"
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={30}
        onClose={() => setShowDayFilterModal(false)}
      >
        <View style={styles.calendarRangeHint}>
          <Text style={styles.calendarRangeHintText}>
            Desde {formatDayLabelFromKey(minSelectableDayKey)} hasta {formatDayLabelFromKey(maxSelectableDayKey)}
          </Text>
        </View>

        <View style={styles.calendarHeaderRow}>
          <Pressable
            style={[styles.calendarNavButton, !canGoPrevMonth && styles.buttonDisabled]}
            onPress={() => setDayCalendarMonth((prev) => startOfMonth(addMonths(prev, -1)))}
            disabled={!canGoPrevMonth}
          >
            <Ionicons name="chevron-back" size={18} color="#475569" />
          </Pressable>

          <Text style={styles.calendarMonthLabel}>{currentCalendarMonthLabel}</Text>

          <Pressable
            style={[styles.calendarNavButton, !canGoNextMonth && styles.buttonDisabled]}
            onPress={() => setDayCalendarMonth((prev) => startOfMonth(addMonths(prev, 1)))}
            disabled={!canGoNextMonth}
          >
            <Ionicons name="chevron-forward" size={18} color="#475569" />
          </Pressable>
        </View>

        <View style={styles.calendarWeekRow}>
          {WEEKDAY_LABELS.map((dayLabel) => (
            <View key={dayLabel} style={styles.calendarWeekDayCell}>
              <Text style={styles.calendarWeekDayText}>{dayLabel}</Text>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDayCells.map((cell, index) => {
            if (!cell) {
              return <View key={`empty-${index}`} style={styles.calendarDayCellEmpty} />;
            }

            return (
              <Pressable
                key={cell.key}
                style={[
                  styles.calendarDayCell,
                  cell.disabled && styles.calendarDayCellDisabled,
                  cell.selected && styles.calendarDayCellSelected,
                ]}
                onPress={() => {
                  if (cell.disabled) return;
                  setDayFilter(cell.key);
                  setCurrentPage(1);
                  setShowDayFilterModal(false);
                }}
                disabled={cell.disabled}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    cell.disabled && styles.calendarDayTextDisabled,
                    cell.selected && styles.calendarDayTextSelected,
                    cell.isToday && !cell.selected && styles.calendarDayTextToday,
                  ]}
                >
                  {cell.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </StockyModal>

      <StockyModal
        visible={showSupplierFilterModal}
        title="Seleccionar proveedor"
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={30}
        onClose={() => setShowSupplierFilterModal(false)}
      >
        {supplierOptions.map((option) => {
          const selected = option.value === supplierFilter;
          return (
            <Pressable
              key={option.value}
              style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
              onPress={() => {
                setSupplierFilter(option.value);
                setCurrentPage(1);
                setShowSupplierFilterModal(false);
              }}
            >
              <Text style={[styles.modalOptionItemText, selected && styles.modalOptionItemTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </StockyModal>

      <StockyModal
        visible={showPurchaseDetails}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={12}
        modalAnimationType="none"
        sheetStyle={styles.purchaseDetailsModalSheet}
        contentContainerStyle={styles.purchaseDetailsContentContainer}
        footerStyle={styles.purchaseDetailsFooter}
        onClose={closePurchaseDetails}
        headerSlot={(
          <LinearGradient
            colors={['#4338CA', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.purchaseDetailsHeader}
          >
            <View style={styles.purchaseDetailsHeaderLeft}>
              <View style={styles.purchaseDetailsHeaderIconWrap}>
                <Ionicons name="bag-handle-outline" size={19} color="#EDE9FE" />
              </View>
              <View style={styles.purchaseDetailsHeaderTextWrap}>
                <Text style={styles.purchaseDetailsHeaderTitle}>Detalle de compra</Text>
                <Text style={styles.purchaseDetailsHeaderSubtitle}>
                  {selectedPurchase ? `ID ${selectedPurchase.id.slice(0, 8).toUpperCase()}` : 'Sin referencia'}
                </Text>
              </View>
            </View>
            <Pressable style={styles.purchaseDetailsHeaderClose} onPress={closePurchaseDetails}>
              <Ionicons name="close" size={20} color="#EDE9FE" />
            </Pressable>
          </LinearGradient>
        )}
        footer={(
          <View style={styles.modalFooter}>
            <Pressable
              style={styles.secondaryButton}
              onPress={closePurchaseDetails}
            >
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </Pressable>
          </View>
        )}
      >
        {selectedPurchase ? (
          <View style={styles.purchaseDetailsHeroCard}>
            <View style={styles.purchaseDetailsHeroTopRow}>
              <View style={styles.purchaseDetailsHeroTotalWrap}>
                <Text style={styles.purchaseDetailsHeroLabel}>Total de la compra</Text>
                <StockyMoneyText value={selectedPurchase.total} style={styles.purchaseDetailsHeroTotal} />
              </View>
              <View
                style={[
                  styles.purchaseDetailsHeroMethodBadge,
                  { backgroundColor: selectedPurchasePaymentTheme?.backgroundColor || '#DCFCE7' },
                ]}
              >
                <Ionicons
                  name={selectedPurchasePaymentTheme?.icon || 'cash-outline'}
                  size={14}
                  color={selectedPurchasePaymentTheme?.iconColor || '#16A34A'}
                />
                <Text
                  style={[
                    styles.purchaseDetailsHeroMethodBadgeText,
                    { color: selectedPurchasePaymentTheme?.textColor || '#166534' },
                  ]}
                >
                  {getPaymentMethodLabel(selectedPurchase.payment_method)}
                </Text>
              </View>
            </View>

            <View style={styles.purchaseDetailsHeroMetaGrid}>
              <View style={styles.purchaseDetailsHeroMetaItem}>
                <Ionicons name="business-outline" size={14} color="#64748B" />
                <Text style={styles.purchaseDetailsHeroMetaText}>
                  {resolvePurchaseSupplierLabel(selectedPurchase)}
                </Text>
              </View>
              <View style={styles.purchaseDetailsHeroMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                <Text style={styles.purchaseDetailsHeroMetaText}>{formatDateTime(selectedPurchase.created_at)}</Text>
              </View>
              <View style={styles.purchaseDetailsHeroMetaItem}>
                <Ionicons name="basket-outline" size={14} color="#64748B" />
                <Text style={styles.purchaseDetailsHeroMetaText}>
                  {selectedPurchaseItemsCount} {selectedPurchaseItemsCount === 1 ? 'unidad' : 'unidades'}
                </Text>
              </View>
            </View>

            {selectedPurchase.notes ? (
              <View style={styles.purchaseDetailsNoteCard}>
                <Text style={styles.purchaseDetailsNoteLabel}>Notas</Text>
                <Text style={styles.purchaseDetailsNoteText}>{selectedPurchase.notes}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.purchaseDetailsItemsSectionHeader}>
          <Text style={styles.purchaseDetailsItemsSectionTitle}>Productos comprados</Text>
          <View style={styles.purchaseDetailsItemsCountBadge}>
            <Text style={styles.purchaseDetailsItemsCountText}>
              {selectedPurchaseDetails.length} {selectedPurchaseDetails.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>
        {loadingPurchaseDetails ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        {!loadingPurchaseDetails && selectedPurchaseDetails.length === 0 ? (
          <Text style={styles.emptyText}>No hay detalles para esta compra.</Text>
        ) : null}
        {!loadingPurchaseDetails && selectedPurchaseDetails.length > 0 ? (
          <View style={styles.purchaseDetailsListCard}>
            {selectedPurchaseDetails.map((detail, index) => (
              <View
                key={detail.id}
                style={[
                  styles.purchaseDetailsListRow,
                  index < selectedPurchaseDetails.length - 1 && styles.purchaseDetailsListRowDivider,
                ]}
              >
                <View style={styles.purchaseDetailsListRowLeft}>
                  <View style={styles.purchaseDetailsQtyBadge}>
                    <Text style={styles.purchaseDetailsQtyBadgeText}>{detail.quantity}</Text>
                  </View>
                  <View style={styles.purchaseDetailsListMain}>
                    <Text style={styles.purchaseDetailsListName}>{detail.product?.name || 'Producto'}</Text>
                    <Text style={styles.purchaseDetailsListMeta}>
                      <StockyMoneyText value={detail.unit_cost} style={styles.purchaseDetailsListMeta} /> por unidad
                    </Text>
                  </View>
                </View>
                <StockyMoneyText value={detail.subtotal} style={styles.purchaseDetailsListSubtotal} />
              </View>
            ))}

            <View style={styles.purchaseDetailsListFooter}>
              <Text style={styles.purchaseDetailsListFooterLabel}>Total final</Text>
              <StockyMoneyText value={selectedPurchase?.total || 0} style={styles.purchaseDetailsListFooterValue} />
            </View>
          </View>
        ) : null}
      </StockyModal>

      <StockyDeleteConfirmModal
        visible={showDeleteModal}
        title="Eliminar compra"
        message="Al eliminar esta compra, el stock de productos se revertirá automáticamente."
        warning="No se puede deshacer."
        itemLabel={purchaseToDelete ? `Total: ${formatCop(purchaseToDelete.total)}` : null}
        loading={deletingPurchase || checkingAdmin}
        onCancel={() => {
          if (deletingPurchase) return;
          setShowDeleteModal(false);
          setPurchaseToDelete(null);
        }}
        onConfirm={confirmDeletePurchase}
      />
      <StockyProcessingOverlay visible={isProcessingAction} label={processingLabel} />
      <StockyStatusToast
        visible={showPurchaseCreatedToast}
        title="Compra Registrada"
        primaryLabel="Total"
        primaryValue={purchaseTotalLabel || formatCop(cartTotal)}
        secondaryLabel="Proveedor"
        secondaryValue={purchaseSupplierToastLabel || purchaseSupplierLabel}
        durationMs={1200}
        onClose={() => setShowPurchaseCreatedToast(false)}
      />
      <StockyStatusToast
        visible={showPurchaseDeletedToast}
        title="Compra Eliminada"
        primaryLabel="Total"
        primaryValue={purchaseDeletedTotalLabel || formatCop(0)}
        secondaryLabel="Estado"
        secondaryValue="Eliminada"
        durationMs={1200}
        onClose={() => setShowPurchaseDeletedToast(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
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
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    color: '#E5E7EB',
    fontSize: 25,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '500',
  },
  heroCreateButton: {
    minHeight: 46,
    borderRadius: 14,
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
  filtersCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    backgroundColor: '#F8EFFC',
    padding: 16,
    gap: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  filtersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  filtersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  filtersTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  filtersToggleButton: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filtersToggleText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
  },
  filtersSubTitle: {
    color: '#6B7280',
    fontSize: 17,
    fontWeight: '500',
    marginTop: -4,
  },
  filterFieldCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  filterFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterFieldLabel: {
    color: '#334155',
    fontSize: 19,
    fontWeight: '600',
  },
  filterSelectBox: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterSelectText: {
    flex: 1,
    color: '#1F2937',
    fontSize: 19,
    fontWeight: '500',
  },
  filterSelectPlaceholder: {
    color: '#6B7280',
  },
  applyFilterButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  applyFilterButtonText: {
    color: '#F3F4F6',
    fontSize: 18,
    fontWeight: '600',
  },
  clearFilterButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  clearFilterButtonText: {
    color: '#334155',
    fontSize: 18,
    fontWeight: '500',
  },
  calendarRangeHint: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  calendarRangeHintText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarWeekDayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  calendarWeekDayText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  calendarDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCellEmpty: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 2,
  },
  calendarDayCellDisabled: {
    opacity: 0.3,
  },
  calendarDayCellSelected: {
    borderRadius: 10,
    backgroundColor: '#4F46E5',
  },
  calendarDayText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarDayTextDisabled: {
    color: '#94A3B8',
  },
  calendarDayTextSelected: {
    color: '#EDE9FE',
    fontWeight: '700',
  },
  calendarDayTextToday: {
    color: '#2563EB',
    fontWeight: '800',
  },
  paginationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 14,
    alignItems: 'center',
  },
  paginationText: {
    color: '#4B5563',
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'center',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paginationArrowButton: {
    width: 58,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationArrowButtonActive: {
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  paginationPageBadge: {
    minHeight: 42,
    minWidth: 154,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  paginationPageText: {
    color: '#374151',
    fontSize: 17,
    fontWeight: '600',
  },
  saleCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  saleDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saleDateText: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '500',
  },
  saleInfoGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  saleInfoColumn: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  saleInfoColumnRight: {
    alignItems: 'flex-end',
  },
  saleMetaBlock: {
    gap: 3,
  },
  saleMetaLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  saleMetaValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentPill: {
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paymentIcon: {
    marginRight: 4,
  },
  paymentPillText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  saleTotalBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  saleCardTotalLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  saleCardTotalValue: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '800',
  },
  saleActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saleActionHalf: {
    flex: 1,
  },
  saleDetailsButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#475569',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },
  saleDetailsText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  salePrintButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#00C951',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },
  salePrintText: {
    color: '#DCFCE7',
    fontSize: 14,
    fontWeight: '600',
  },
  saleDeleteButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#FF002A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },
  saleDeleteText: {
    color: '#FEE2E2',
    fontSize: 14,
    fontWeight: '700',
  },
  purchaseOrderModalSheet: {
    maxHeight: '88%',
    borderRadius: 26,
    borderColor: '#D9DEE8',
  },
  purchaseOrderModalHeader: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  purchaseOrderModalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseOrderModalHeaderTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  purchaseOrderModalHeaderClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseOrderModalContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  purchaseOrderModalFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  purchaseOrderFooterContainer: {
    gap: 10,
  },
  purchaseOrderFooterTotalBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  purchaseOrderFooterTotalLabel: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  purchaseOrderFooterTotalValue: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  purchaseOrderSecondaryButton: {
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
  purchaseOrderSecondaryButtonText: {
    color: '#5B21B6',
    fontSize: 12,
    fontWeight: '800',
  },
  purchaseOrderPrimaryButton: {
    minHeight: 40,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  purchaseOrderPrimaryButtonText: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '800',
  },
  purchaseOrderBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  purchaseOrderBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  purchaseOrderBlockTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  purchaseOrderBlockHint: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: '54%',
    textAlign: 'right',
  },
  catalogSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  catalogSearchHeaderText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  catalogResultsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  catalogResultRow: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  catalogResultRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  catalogResultLeft: {
    flex: 1,
    gap: 2,
  },
  catalogResultName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  catalogResultMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  catalogResultRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  catalogResultPrice: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  orderItemsTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
  },
  orderItemsEmpty: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  orderItemsEmptyText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  orderItemCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  orderItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderItemName: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  orderItemTotal: {
    color: '#111827',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  orderItemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingTop: 2,
  },
  orderItemStepper: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 3,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderItemStepperButton: {
    width: 34,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  orderItemMinusText: {
    color: '#BE123C',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  orderItemPlusText: {
    color: '#16A34A',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  orderItemQtyText: {
    minWidth: 34,
    textAlign: 'center',
    color: '#111827',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
  },
  purchasePaymentBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  purchasePaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  purchasePaymentTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  purchasePaymentHint: {
    color: '#64748B',
    fontSize: 11,
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
    backgroundColor: 'rgba(232, 244, 246, 0.75)',
    padding: 10,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: STOCKY_COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 17,
    color: STOCKY_COLORS.primary900,
    fontWeight: '800',
  },
  sectionTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  helperText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  modalLoadingInline: {
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchInput: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1.5,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  notesInput: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  filterLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipSelected: {
    borderColor: STOCKY_COLORS.primary700,
    backgroundColor: 'rgba(7, 87, 91, 0.14)',
  },
  filterChipText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: STOCKY_COLORS.primary900,
  },
  catalogRow: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catalogMain: {
    flex: 1,
    gap: 3,
  },
  catalogTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  catalogMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  addButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: STOCKY_COLORS.primary700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  cartRow: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartMain: {
    flex: 1,
    gap: 4,
  },
  cartTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyButton: {
    minWidth: 30,
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 244, 246, 0.75)',
  },
  qtyButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 14,
    fontWeight: '800',
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  removeButton: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '800',
  },
  cartSubtotal: {
    color: STOCKY_COLORS.primary900,
    fontSize: 12,
    fontWeight: '800',
  },
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  paymentMethodOptionSelected: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  paymentMethodOptionText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  paymentMethodOptionTextSelected: {
    color: STOCKY_COLORS.white,
  },
  saleFooter: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.6)',
    padding: 10,
    gap: 8,
  },
  totalLabel: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  totalValue: {
    color: STOCKY_COLORS.primary900,
    fontSize: 22,
    fontWeight: '800',
  },
  saleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  secondaryButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 40,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: STOCKY_COLORS.primary700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  primaryButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  purchaseRow: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  purchaseMain: {
    flex: 1,
    gap: 2,
  },
  purchaseTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  purchaseMeta: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  purchaseActions: {
    flexDirection: 'row',
    gap: 6,
  },
  inlineSecondaryButton: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.75)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSecondaryButtonText: {
    color: STOCKY_COLORS.primary900,
    fontSize: 11,
    fontWeight: '800',
  },
  inlineDeleteButton: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(153, 27, 27, 0.92)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineDeleteButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  modalOptionItem: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalOptionItemSelected: {
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  modalOptionItemText: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOptionItemTextSelected: {
    color: '#5B21B6',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteFooterButton: {
    minHeight: 40,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  deleteFooterButtonText: {
    color: STOCKY_COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  purchaseDetailsModalSheet: {
    width: '100%',
    maxWidth: 470,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
  },
  purchaseDetailsContentContainer: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  purchaseDetailsFooter: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  purchaseDetailsHeader: {
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  purchaseDetailsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  purchaseDetailsHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseDetailsHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  purchaseDetailsHeaderTitle: {
    color: '#F5F3FF',
    fontSize: 18,
    fontWeight: '800',
  },
  purchaseDetailsHeaderSubtitle: {
    color: '#DDD6FE',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  purchaseDetailsHeaderClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  purchaseDetailsHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  purchaseDetailsHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  purchaseDetailsHeroTotalWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  purchaseDetailsHeroLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  purchaseDetailsHeroTotal: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '800',
  },
  purchaseDetailsHeroMethodBadge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  purchaseDetailsHeroMethodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  purchaseDetailsHeroMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  purchaseDetailsHeroMetaItem: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  purchaseDetailsHeroMetaText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  purchaseDetailsNoteCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  purchaseDetailsNoteLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  purchaseDetailsNoteText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '500',
  },
  purchaseDetailsItemsSectionHeader: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  purchaseDetailsItemsSectionTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  purchaseDetailsItemsCountBadge: {
    minHeight: 24,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseDetailsItemsCountText: {
    color: '#4338CA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  purchaseDetailsListCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  purchaseDetailsListRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  purchaseDetailsListRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  purchaseDetailsListRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  purchaseDetailsQtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseDetailsQtyBadgeText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '800',
  },
  purchaseDetailsListMain: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  purchaseDetailsListName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  purchaseDetailsListMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  purchaseDetailsListSubtotal: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  purchaseDetailsListFooter: {
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  purchaseDetailsListFooterLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  purchaseDetailsListFooterValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  detailMeta: {
    color: STOCKY_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailMain: {
    flex: 1,
    gap: 2,
  },
  detailTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  detailSub: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  detailTotal: {
    color: STOCKY_COLORS.primary900,
    fontSize: 12,
    fontWeight: '800',
  },
});
