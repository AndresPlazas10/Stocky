import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, InteractionManager, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { LinearGradient } from 'expo-linear-gradient';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../../theme/tokens';
import { StockyDeleteConfirmModal } from '../../ui/StockyDeleteConfirmModal';
import { StockyMoneyText } from '../../ui/StockyMoneyText';
import { StockyModal } from '../../ui/StockyModal';
import { StockyStatusToast } from '../../ui/StockyStatusToast';
import { formatCop } from '../../services/mesasService';
import type { PaymentMethod } from '../../services/mesaCheckoutService';
import {
  calculateCashChange,
  evaluateOrderStockShortages,
  getOrderItemName,
  type MesaOrderCatalogItem,
  type MesaOrderItem,
} from '../../services/mesaOrderService';
import {
  createVenta,
  deleteVentaWithDetails,
  getFirstVentaDayKey,
  listRecentVentas,
  listVentaDetails,
  listVentasCatalog,
  type VentaCartItem,
  type VentaDetailRecord,
  type VentaRecord,
} from '../../services/ventasService';
import { getSupabaseClient } from '../../lib/supabase';
import { buildSaleReceiptHtml } from '../../utils/printTemplates';

type Props = {
  businessId: string;
  businessName: string | null;
  source: 'owner' | 'employee';
};

const PAGE_SIZE = 20;
const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getPaymentMethodLabel(method: PaymentMethod) {
  if (method === 'cash') return 'Efectivo';
  if (method === 'card') return 'Tarjeta';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'mixed') return 'Mixto';
  return method;
}

function getPaymentMethodTheme(method: PaymentMethod): {
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  textColor: string;
  iconColor: string;
} {
  if (method === 'card') {
    return {
      icon: 'card-outline',
      backgroundColor: '#DBEAFE',
      textColor: '#1D4ED8',
      iconColor: '#2563EB',
    };
  }
  if (method === 'transfer') {
    return {
      icon: 'swap-horizontal-outline',
      backgroundColor: '#E0E7FF',
      textColor: '#4338CA',
      iconColor: '#4F46E5',
    };
  }
  if (method === 'mixed') {
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

function formatSaleDateTime(value: string | null) {
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

function getSaleDayKey(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabelFromKey(key: string) {
  if (!key || key === 'all') return 'Todos los días';
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

function cartReferenceKey(item: { product_id?: string | null; combo_id?: string | null }) {
  if (item.combo_id) return `combo:${item.combo_id}`;
  if (item.product_id) return `product:${item.product_id}`;
  return 'unknown';
}

function buildCartItem(catalogItem: MesaOrderCatalogItem): VentaCartItem {
  return {
    id: `${catalogItem.item_type}:${catalogItem.id}`,
    item_type: catalogItem.item_type,
    product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
    combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
    name: catalogItem.name,
    code: catalogItem.code,
    manage_stock: catalogItem.manage_stock !== false,
    quantity: 1,
    unit_price: Number(catalogItem.sale_price || 0),
    subtotal: Number(catalogItem.sale_price || 0),
  };
}

function PaymentMethodSelector({
  value,
  onChange,
  blockInteractions,
  onBlockedInteraction,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  blockInteractions?: boolean;
  onBlockedInteraction?: () => void;
}) {
  const options: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'mixed', label: 'Mixto' },
  ];

  return (
    <View style={styles.paymentMethodGrid}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.paymentMethodOption, selected && styles.paymentMethodOptionSelected]}
            onPress={() => {
              if (blockInteractions) {
                onBlockedInteraction?.();
                return;
              }
              onChange(option.value);
            }}
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

export function VentasPanel({ businessId, businessName, source }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setSuccess] = useState<string | null>(null);

  const [catalogItems, setCatalogItems] = useState<MesaOrderCatalogItem[]>([]);
  const [ventas, setVentas] = useState<VentaRecord[]>([]);
  const [cart, setCart] = useState<VentaCartItem[]>([]);
  const [searchCatalog, setSearchCatalog] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [isAmountReceivedManual, setIsAmountReceivedManual] = useState(false);
  const [showCreateSaleModal, setShowCreateSaleModal] = useState(false);
  const [isSaleSearchFocused, setIsSaleSearchFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showSaleCreatedToast, setShowSaleCreatedToast] = useState(false);
  const [saleTotalLabel, setSaleTotalLabel] = useState('');
  const [salePaymentLabel, setSalePaymentLabel] = useState('');
  const [showSaleDeletedToast, setShowSaleDeletedToast] = useState(false);
  const [saleDeletedTotalLabel, setSaleDeletedTotalLabel] = useState('');

  const [dayFilter, setDayFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [showFiltersExpanded, setShowFiltersExpanded] = useState(false);
  const [firstVentaDayKey, setFirstVentaDayKey] = useState<string | null>(null);
  const [dayCalendarMonth, setDayCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [showDayFilterModal, setShowDayFilterModal] = useState(false);
  const [showSellerFilterModal, setShowSellerFilterModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedVenta, setSelectedVenta] = useState<VentaRecord | null>(null);
  const [selectedVentaDetails, setSelectedVentaDetails] = useState<VentaDetailRecord[]>([]);
  const [loadingVentaDetails, setLoadingVentaDetails] = useState(false);
  const [ventaDetailsError, setVentaDetailsError] = useState<string | null>(null);
  const [showVentaDetails, setShowVentaDetails] = useState(false);
  const [showDeleteVentaModal, setShowDeleteVentaModal] = useState(false);
  const [ventaToDelete, setVentaToDelete] = useState<VentaRecord | null>(null);
  const [deletingVenta, setDeletingVenta] = useState(false);
  const selectedVentaIdRef = useRef<string>('');
  const showVentaDetailsRef = useRef(false);
  const ventaDetailsLoadTokenRef = useRef(0);
  const salesRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogRealtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCatalogData = useCallback(async (forceRefresh = false) => {
    setLoadingCatalog(true);
    try {
      const [catalog, firstDay] = await Promise.all([
        listVentasCatalog(businessId, forceRefresh ? { forceRefresh: true } : { ttlMs: 90_000 }),
        getFirstVentaDayKey(businessId, { ttlMs: 5 * 60_000 }).catch(() => null),
      ]);
      setCatalogItems(catalog);
      setFirstVentaDayKey(firstDay);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo de ventas.');
    } finally {
      setLoadingCatalog(false);
    }
  }, [businessId]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const recentSales = await listRecentVentas(businessId, 50, { ttlMs: 45_000 });
      setVentas(recentSales);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas.');
    } finally {
      setLoading(false);
    }
    void loadCatalogData();
  }, [businessId, loadCatalogData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const refreshSales = useCallback(async () => {
    setLoadingSales(true);
    setError(null);
    try {
      const recentSales = await listRecentVentas(businessId, 50, { forceRefresh: true });
      setVentas(recentSales);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo refrescar el historial.');
    } finally {
      setLoadingSales(false);
    }
  }, [businessId]);

  const refreshSalesSilently = useCallback(async () => {
    try {
      const recentSales = await listRecentVentas(businessId, 50, { forceRefresh: true });
      setVentas(recentSales);
    } catch {
      // no-op
    }
  }, [businessId]);

  const refreshCatalogSilently = useCallback(async () => {
    try {
      const catalog = await listVentasCatalog(businessId, { forceRefresh: true });
      setCatalogItems(catalog);
    } catch {
      // no-op
    }
  }, [businessId]);

  const openCreateSaleModal = useCallback(() => {
    setShowCreateSaleModal(true);
    if (catalogItems.length === 0) {
      void loadCatalogData();
    }
  }, [catalogItems.length, loadCatalogData]);

  useFocusEffect(
    useCallback(() => {
      refreshSales();
    }, [refreshSales]),
  );

  useEffect(() => {
    selectedVentaIdRef.current = String(selectedVenta?.id || '').trim();
    showVentaDetailsRef.current = Boolean(showVentaDetails);
  }, [selectedVenta?.id, showVentaDetails]);

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

    const scheduleSalesRefresh = () => {
      if (cancelled || salesRealtimeRefreshTimerRef.current) return;
      salesRealtimeRefreshTimerRef.current = setTimeout(() => {
        salesRealtimeRefreshTimerRef.current = null;
        void refreshSalesSilently();
        const currentVentaId = selectedVentaIdRef.current;
        if (showVentaDetailsRef.current && currentVentaId) {
          void listVentaDetails(currentVentaId)
            .then((details) => {
              setSelectedVentaDetails(details);
              setVentaDetailsError(null);
            })
            .catch(() => {
              setVentaDetailsError('No se pudieron actualizar los detalles de la venta.');
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
      .channel(`mobile-ventas:${normalizedBusinessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sales',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleSalesRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sale_details',
      }, scheduleSalesRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleCatalogRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'combos',
        filter: `business_id=eq.${normalizedBusinessId}`,
      }, scheduleCatalogRefresh);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        scheduleSalesRefresh();
      }
    });

    fallbackTimer = setInterval(() => {
      scheduleSalesRefresh();
    }, 20000);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (salesRealtimeRefreshTimerRef.current) {
        clearTimeout(salesRealtimeRefreshTimerRef.current);
        salesRealtimeRefreshTimerRef.current = null;
      }
      if (catalogRealtimeRefreshTimerRef.current) {
        clearTimeout(catalogRealtimeRefreshTimerRef.current);
        catalogRealtimeRefreshTimerRef.current = null;
      }
      void client.removeChannel(channel);
    };
  }, [businessId, refreshCatalogSilently, refreshSalesSilently]);

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  const catalogQuery = useMemo(
    () => String(searchCatalog || '').trim().toLowerCase(),
    [searchCatalog],
  );
  const hasCatalogQuery = catalogQuery.length > 0;

  const catalogFiltered = useMemo(() => {
    const sourceData = Array.isArray(catalogItems) ? catalogItems : [];
    if (!hasCatalogQuery) return [];
    return sourceData
      .filter((item) => {
        const byName = String(item.name || '').toLowerCase().includes(catalogQuery);
        const byCode = String(item.code || '').toLowerCase().includes(catalogQuery);
        return byName || byCode;
      })
      .slice(0, 80);
  }, [catalogItems, catalogQuery, hasCatalogQuery]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.subtotal || item.quantity * item.unit_price || 0), 0),
    [cart],
  );

  const canDeleteSales = source === 'owner';
  const todayDayKey = formatDayKey(new Date());
  const fallbackFirstVentaDayKey = useMemo(() => {
    const unique = Array.from(
      new Set(
        ventas
          .map((venta) => getSaleDayKey(venta.created_at))
          .filter((value) => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return unique[0] || null;
  }, [ventas]);
  const minSelectableDayKey = firstVentaDayKey || fallbackFirstVentaDayKey || todayDayKey;
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

  const sellerOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        ventas
          .map((venta) => String(venta.seller_name || 'Administrador').trim())
          .filter((value) => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    return [
      { value: 'all', label: 'Todos los vendedores' },
      ...unique.map((value) => ({ value, label: value })),
    ];
  }, [ventas]);

  const filteredVentas = useMemo(() => {
    return ventas.filter((venta) => {
      if (dayFilter !== 'all' && getSaleDayKey(venta.created_at) !== dayFilter) return false;
      if (sellerFilter !== 'all' && String(venta.seller_name || 'Administrador').trim() !== sellerFilter) return false;
      return true;
    });
  }, [dayFilter, sellerFilter, ventas]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredVentas.length / PAGE_SIZE)), [filteredVentas.length]);

  useEffect(() => {
    setCurrentPage((prev) => Math.max(1, Math.min(prev, totalPages)));
  }, [totalPages]);

  const paginatedVentas = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredVentas.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredVentas]);

  const selectedVentaItemsCount = useMemo(
    () => selectedVentaDetails.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
    [selectedVentaDetails],
  );
  const selectedVentaPaymentTheme = useMemo(
    () => (selectedVenta ? getPaymentMethodTheme(selectedVenta.payment_method) : null),
    [selectedVenta],
  );

  const pageRange = useMemo(() => {
    if (filteredVentas.length === 0) return { from: 0, to: 0 };
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, filteredVentas.length);
    return { from, to };
  }, [currentPage, filteredVentas.length]);
  const canPrevPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;

  const cashChangeData = useMemo(() => {
    if (paymentMethod !== 'cash') return null;
    if (String(amountReceived || '').trim() === '') return { isValid: false, reason: 'empty' as const, change: 0, paid: 0 };
    return calculateCashChange(cartTotal, amountReceived);
  }, [amountReceived, cartTotal, paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== 'cash') return;
    if (isAmountReceivedManual) return;
    if (cartTotal <= 0) {
      if (amountReceived !== '') setAmountReceived('');
      return;
    }
    const suggested = `${Math.round(Number(cartTotal || 0))}`;
    if (amountReceived !== suggested) {
      setAmountReceived(suggested);
    }
  }, [amountReceived, cartTotal, isAmountReceivedManual, paymentMethod]);

  const addToCart = useCallback((catalogItem: MesaOrderCatalogItem) => {
    setError(null);
    setSuccess(null);
    setCart((prev) => {
      const referenceKey = cartReferenceKey({
        product_id: catalogItem.item_type === 'product' ? catalogItem.product_id : null,
        combo_id: catalogItem.item_type === 'combo' ? catalogItem.combo_id : null,
      });
      const existingIndex = prev.findIndex((row) => cartReferenceKey(row) === referenceKey);
      if (existingIndex < 0) {
        return [...prev, buildCartItem(catalogItem)];
      }

      return prev.map((row, index) => {
        if (index !== existingIndex) return row;
        const nextQuantity = Number(row.quantity || 0) + 1;
        const nextSubtotal = nextQuantity * Number(row.unit_price || 0);
        return {
          ...row,
          quantity: nextQuantity,
          subtotal: nextSubtotal,
        };
      });
    });
  }, []);

  const updateCartQuantity = useCallback((cartItem: VentaCartItem, nextQuantity: number) => {
    setCart((prev) => {
      const key = cartReferenceKey(cartItem);
      if (nextQuantity <= 0) {
        return prev.filter((item) => cartReferenceKey(item) !== key);
      }
      return prev.map((item) => {
        if (cartReferenceKey(item) !== key) return item;
        return {
          ...item,
          quantity: nextQuantity,
          subtotal: nextQuantity * Number(item.unit_price || 0),
        };
      });
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPaymentMethod('cash');
    setAmountReceived('');
    setIsAmountReceivedManual(false);
  }, []);

  const openVentaDetails = useCallback(async (venta: VentaRecord) => {
    const loadWithTimeout = async (saleId: string) => {
      const timeoutMs = 12_000;
      return await Promise.race([
        listVentaDetails(saleId),
        new Promise<VentaDetailRecord[]>((_, reject) => {
          setTimeout(() => reject(new Error('Tiempo de espera al cargar el detalle de venta.')), timeoutMs);
        }),
      ]);
    };

    setSelectedVenta(venta);
    setShowVentaDetails(true);
    setLoadingVentaDetails(true);
    setSelectedVentaDetails([]);
    setVentaDetailsError(null);
    const token = ++ventaDetailsLoadTokenRef.current;

    InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const details = await loadWithTimeout(venta.id);
          if (ventaDetailsLoadTokenRef.current !== token) return;
          setSelectedVentaDetails(details);
          setVentaDetailsError(null);
        } catch (err) {
          if (ventaDetailsLoadTokenRef.current !== token) return;
          setVentaDetailsError(err instanceof Error ? err.message : 'No se pudo cargar el detalle de venta.');
        } finally {
          if (ventaDetailsLoadTokenRef.current === token) {
            setLoadingVentaDetails(false);
          }
        }
      })();
    });
  }, []);

  const closeVentaDetails = useCallback(() => {
    ventaDetailsLoadTokenRef.current += 1;
    setShowVentaDetails(false);
    setSelectedVenta(null);
    setSelectedVentaDetails([]);
    setVentaDetailsError(null);
    setLoadingVentaDetails(false);
  }, []);

  const askDeleteVenta = useCallback((venta: VentaRecord) => {
    if (!canDeleteSales) return;
    setVentaToDelete(venta);
    setShowDeleteVentaModal(true);
  }, [canDeleteSales]);

  const confirmDeleteVenta = useCallback(async () => {
    if (!canDeleteSales || !ventaToDelete?.id) return;

    setDeletingVenta(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteVentaWithDetails({
        saleId: ventaToDelete.id,
        businessId,
      });

      setVentas((prev) => prev.filter((row) => row.id !== ventaToDelete.id));
      if (selectedVenta?.id === ventaToDelete.id) {
        setShowVentaDetails(false);
        setSelectedVenta(null);
        setSelectedVentaDetails([]);
      }

      setSaleDeletedTotalLabel(formatCop(ventaToDelete.total));
      setShowSaleDeletedToast(true);
      setShowDeleteVentaModal(false);
      setVentaToDelete(null);
      setSuccess('Venta eliminada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la venta.');
    } finally {
      setDeletingVenta(false);
    }
  }, [businessId, canDeleteSales, selectedVenta?.id, ventaToDelete]);

  const submitSale = useCallback(async () => {
    if (submitting) return;
    setError(null);
    setSuccess(null);

    if (cart.length === 0) {
      setError('El carrito está vacío. Agrega productos antes de vender.');
      return;
    }

    const validationOrderItems: MesaOrderItem[] = cart.map((item, index) => ({
      id: `${cartReferenceKey(item)}:${index}`,
      order_id: 'virtual-sale',
      product_id: item.product_id,
      combo_id: item.combo_id,
      quantity: Number(item.quantity || 0),
      price: Number(item.unit_price || 0),
      subtotal: Number(item.subtotal || 0),
      products: item.product_id ? { name: item.name, code: item.code || undefined } : null,
      combos: item.combo_id ? { nombre: item.name } : null,
    }));
    const { insufficientItems, insufficientComboComponents } = evaluateOrderStockShortages({
      orderItems: validationOrderItems,
      catalogItems,
    });

    if (insufficientItems.length > 0) {
      const first = insufficientItems[0];
      setError(`Stock insuficiente para "${first.product_name}" (disp: ${first.available_stock}, req: ${first.quantity}).`);
      return;
    }

    if (insufficientComboComponents.length > 0) {
      const first = insufficientComboComponents[0];
      setError(
        `Stock insuficiente para "${first.product_name}" (disp: ${first.available_stock}, req: ${first.required_quantity}).`,
      );
      return;
    }

    if (paymentMethod === 'cash' && !cashChangeData?.isValid) {
      setError(cashChangeData?.reason === 'insufficient'
        ? 'El monto recibido es menor al total.'
        : 'Ingresa un monto recibido válido.');
      return;
    }

    setSubmitting(true);
    try {
      const idempotencySeed = `${paymentMethod}:${cart.map((item) => `${cartReferenceKey(item)}:${item.quantity}`).sort().join('|')}`;
      const amount = paymentMethod === 'cash' ? Number(cashChangeData?.paid || 0) : null;
      const breakdown = paymentMethod === 'cash' && cashChangeData?.isValid ? [] : [];

      const result = await createVenta({
        businessId,
        cartItems: cart,
        paymentMethod,
        amountReceived: amount,
        changeBreakdown: breakdown,
        idempotencySeed,
      });

      clearCart();
      setShowCreateSaleModal(false);
      setSaleTotalLabel(formatCop(result.total));
      setSalePaymentLabel(getPaymentMethodLabel(paymentMethod));
      setShowSaleCreatedToast(true);
      setSuccess(`Venta registrada por ${formatCop(result.total)}.`);
      await Promise.all([refreshSales(), listVentasCatalog(businessId, { forceRefresh: true }).then(setCatalogItems)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la venta.');
    } finally {
      setSubmitting(false);
    }
  }, [
    businessId,
    catalogItems,
    cart,
    cashChangeData,
    clearCart,
    paymentMethod,
    refreshSales,
    submitting,
  ]);

  const selectedDayLabel = useMemo(() => formatDayLabelFromKey(dayFilter), [dayFilter]);

  const selectedSellerLabel = useMemo(
    () => sellerOptions.find((option) => option.value === sellerFilter)?.label || 'Todos los vendedores',
    [sellerFilter, sellerOptions],
  );

  const openDayFilterCalendar = useCallback(() => {
    const selectedDate = dayFilter !== 'all' ? parseDayKey(dayFilter) : null;
    const baseDate = selectedDate || maxSelectableDate;
    const clamped = clampDate(baseDate, minSelectableDate, maxSelectableDate);
    setDayCalendarMonth(startOfMonth(clamped));
    setShowDayFilterModal(true);
  }, [dayFilter, maxSelectableDate, minSelectableDate]);

  const clearFilters = useCallback(() => {
    setDayFilter('all');
    setSellerFilter('all');
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

  const handlePrintSale = useCallback(async (venta: VentaRecord) => {
    setError(null);
    setSuccess(null);

    try {
      const details = await listVentaDetails(venta.id);
      if (!Array.isArray(details) || details.length === 0) {
        setError('No se pudo imprimir: la venta no tiene items.');
        return;
      }

      const html = buildSaleReceiptHtml({
        sale: venta,
        saleDetails: details,
        sellerName: venta.seller_name || 'Empleado',
      });

      await Print.printAsync({ html });
      setSuccess(`Enviando a imprimir la venta ${venta.id.slice(0, 8)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo imprimir la venta.');
    }
  }, []);

  const salesCards = useMemo(() => (
    paginatedVentas.map((venta) => (
      <View key={venta.id} style={styles.saleCard}>
        <View style={styles.saleDateRow}>
          <Ionicons name="calendar-outline" size={26} color="#111827" />
          <Text style={styles.saleDateText}>{formatSaleDateTime(venta.created_at)}</Text>
        </View>

        <View style={styles.saleInfoGrid}>
          <View style={styles.saleInfoColumn}>
            <View style={styles.saleMetaBlock}>
              <Text style={styles.saleMetaLabel}>CLIENTE</Text>
              <Text style={styles.saleMetaValue} numberOfLines={1}>Venta general</Text>
            </View>
            <View style={styles.saleMetaBlock}>
              <Text style={styles.saleMetaLabel}>VENDEDOR</Text>
              <Text style={styles.saleMetaValue} numberOfLines={1}>
                {venta.seller_name || 'Administrador'}
              </Text>
            </View>
          </View>

          <View style={[styles.saleInfoColumn, styles.saleInfoColumnRight]}>
            <View style={styles.paymentRow}>
              <Ionicons name="wallet-outline" size={20} color="#111827" />
              <View style={styles.paymentPill}>
                <Ionicons name="cash-outline" size={13} color="#166534" style={styles.paymentIcon} />
                <Text style={styles.paymentPillText}>{getPaymentMethodLabel(venta.payment_method)}</Text>
              </View>
            </View>
            <View style={styles.saleTotalBlock}>
              <Text style={styles.saleCardTotalLabel}>TOTAL</Text>
              <StockyMoneyText value={venta.total} style={styles.saleCardTotalValue} />
            </View>
          </View>
        </View>

        <View style={styles.saleActionRow}>
          <Pressable style={[styles.saleDetailsButton, styles.saleActionHalf]} onPress={() => openVentaDetails(venta)}>
            <Ionicons name="eye-outline" size={20} color="#D1D5DB" />
            <Text style={styles.saleDetailsText}>Ver Detalles</Text>
          </Pressable>

          <Pressable style={[styles.salePrintButton, styles.saleActionHalf]} onPress={() => handlePrintSale(venta)}>
            <Ionicons name="print-outline" size={20} color="#DCFCE7" />
            <Text style={styles.salePrintText}>Imprimir</Text>
          </Pressable>
        </View>

        {canDeleteSales ? (
          <Pressable
            style={styles.saleDeleteButton}
            onPress={() => askDeleteVenta(venta)}
          >
            <Ionicons name="trash-outline" size={20} color="#FEE2E2" />
            <Text style={styles.saleDeleteText}>Eliminar</Text>
          </Pressable>
        ) : null}
      </View>
    ))
  ), [askDeleteVenta, canDeleteSales, handlePrintSale, openVentaDetails, paginatedVentas]);

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
              <Ionicons name="cart-outline" size={28} color={STOCKY_COLORS.white} />
            </View>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Ventas</Text>
              <Text style={styles.heroSubtitle}>Sistema de punto de venta</Text>
            </View>
          </View>

          <Pressable style={styles.heroCreateButton} onPress={openCreateSaleModal}>
            <Ionicons name="add" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={styles.heroCreateButtonText}>Nueva Venta</Text>
          </Pressable>
        </LinearGradient>

        {loading ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        {loadingSales ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        {error ? null : null}

        <View style={styles.filtersCard}>
          <View style={styles.filtersHeaderRow}>
            <View style={styles.filtersTitleRow}>
              <Ionicons name="filter-outline" size={25} color="#7C3AED" />
              <Text style={styles.filtersTitle}>Filtros de Ventas</Text>
            </View>
            <Pressable
              style={styles.filtersToggleButton}
              onPress={() => setShowFiltersExpanded((prev) => !prev)}
            >
              <Text style={styles.filtersToggleText}>
                {showFiltersExpanded ? 'Cerrar' : 'Abrir'}
              </Text>
              <Ionicons
                name={showFiltersExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#4F46E5"
              />
            </Pressable>
          </View>
          <Text style={styles.filtersSubTitle}>Filtra por un día específico.</Text>

          {showFiltersExpanded ? (
            <>
              <View style={styles.filterFieldCard}>
                <View style={styles.filterFieldHeader}>
                  <Ionicons name="calendar-clear-outline" size={22} color="#A21CAF" />
                  <Text style={styles.filterFieldLabel}>Día</Text>
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
                  <Ionicons name="person-outline" size={22} color="#A21CAF" />
                  <Text style={styles.filterFieldLabel}>Vendedor</Text>
                </View>
                <Pressable style={styles.filterSelectBox} onPress={() => setShowSellerFilterModal(true)}>
                  <Text
                    style={[
                      styles.filterSelectText,
                      sellerFilter === 'all' && styles.filterSelectPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedSellerLabel}
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
            Mostrando {pageRange.from} a {pageRange.to} de {filteredVentas.length} registros
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
              <Text style={styles.paginationPageText}>Página {currentPage} de {totalPages}</Text>
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

        {!loading && paginatedVentas.length === 0 ? (
          <Text style={styles.emptyText}>No hay ventas para esos filtros.</Text>
        ) : null}

        {salesCards}
      </View>

      <StockyModal
        visible={showCreateSaleModal}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={16}
        modalAnimationType="none"
        bodyFlex
        sheetStyle={styles.saleOrderModalSheet}
        onClose={() => {
          if (submitting) return;
          setShowCreateSaleModal(false);
        }}
        headerSlot={(
          <View style={styles.saleOrderModalHeader}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saleOrderModalHeaderIcon}
            >
              <Ionicons name="cart-outline" size={30} color="#D1D5DB" />
            </LinearGradient>
            <Text style={styles.saleOrderModalHeaderTitle}>Nueva Venta</Text>
            <Pressable
              style={[styles.saleOrderModalHeaderClose, submitting && styles.buttonDisabled]}
              onPress={() => {
                if (submitting) return;
                if (isKeyboardVisible) {
                  Keyboard.dismiss();
                  return;
                }
                setShowCreateSaleModal(false);
              }}
              disabled={submitting}
            >
              <Ionicons name="close" size={34} color="#111827" />
            </Pressable>
          </View>
        )}
        contentContainerStyle={styles.saleOrderModalContent}
        footerStyle={styles.saleOrderModalFooter}
        footer={(
          <View style={styles.saleOrderFooterContainer}>
            <View style={styles.saleOrderFooterTotalBlock}>
              <Text style={styles.saleOrderFooterTotalLabel}>Total a cobrar:</Text>
              <StockyMoneyText value={cartTotal} style={styles.saleOrderFooterTotalValue} />
            </View>

            <View style={styles.saleActions}>
              <Pressable
                style={styles.saleOrderSecondaryButton}
                onPress={() => {
                  if (isKeyboardVisible) {
                    Keyboard.dismiss();
                    return;
                  }
                  clearCart();
                }}
                disabled={submitting || cart.length === 0}
              >
                <Text style={styles.saleOrderSecondaryButtonText}>Limpiar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.saleOrderPrimaryButton,
                  (submitting || cart.length === 0 || (paymentMethod === 'cash' && !cashChangeData?.isValid)) && styles.buttonDisabled,
                ]}
                onPress={() => {
                  if (isKeyboardVisible) {
                    Keyboard.dismiss();
                    return;
                  }
                  void submitSale();
                }}
                disabled={submitting || cart.length === 0 || (paymentMethod === 'cash' && !cashChangeData?.isValid)}
              >
                <Text style={styles.saleOrderPrimaryButtonText}>{submitting ? 'Procesando...' : 'Confirmar venta'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      >
        <View style={styles.catalogSearchHeader}>
          <Ionicons name="search-outline" size={24} color="#111827" />
          <Text style={styles.catalogSearchHeaderText}>Agregar Producto o Combo</Text>
        </View>

        <TextInput
          value={searchCatalog}
          onChangeText={setSearchCatalog}
          placeholder="Buscar por nombre..."
          placeholderTextColor={STOCKY_COLORS.textMuted}
          style={[styles.searchInput, isSaleSearchFocused && styles.searchInputFocused]}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsSaleSearchFocused(true)}
          onBlur={() => setIsSaleSearchFocused(false)}
        />

        {loadingCatalog && hasCatalogQuery ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}

        {!hasCatalogQuery ? (
          <Text style={styles.emptyText}>Escribe para buscar productos o combos.</Text>
        ) : null}
        {!loadingCatalog && hasCatalogQuery && catalogFiltered.length === 0 ? (
          <Text style={styles.emptyText}>No hay resultados para esa búsqueda.</Text>
        ) : null}

        {hasCatalogQuery ? (
          <View style={styles.catalogResultsCard}>
            <ScrollView
              style={styles.catalogResultsScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="never"
              showsVerticalScrollIndicator
            >
              {catalogFiltered.map((item, index) => (
                <Pressable
                  key={`${item.item_type}:${item.id}`}
                  style={[styles.catalogResultRow, index < catalogFiltered.length - 1 && styles.catalogResultRowDivider]}
                  disabled={false}
                  onPress={() => {
                    if (isKeyboardVisible) {
                      Keyboard.dismiss();
                      return;
                    }
                    addToCart(item);
                    setSearchCatalog('');
                  }}
                >
                  <View style={styles.catalogResultLeft}>
                    <Text style={styles.catalogResultName} numberOfLines={1}>{item.name}</Text>
                    {item.item_type === 'combo' ? (
                      <View style={styles.comboPill}>
                        <Text style={styles.comboPillText}>Combo</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.catalogResultRight}>
                    <StockyMoneyText value={Number(item.sale_price || 0)} style={styles.catalogResultPrice} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.orderItemsTitle}>Items en la venta</Text>
        {cart.length === 0 ? (
          <View style={styles.orderItemsEmpty}>
            <Ionicons name="cart-outline" size={56} color="#0F172A" />
            <Text style={styles.orderItemsEmptyText}>No hay items en esta venta</Text>
          </View>
        ) : null}
        {cart.length > 0 ? (
          cart.map((item) => (
            <View key={cartReferenceKey(item)} style={styles.orderItemCard}>
              <View style={styles.orderItemTopRow}>
                <Text numberOfLines={1} style={styles.orderItemName}>{item.name}</Text>
                <StockyMoneyText value={Number(item.subtotal || 0)} style={styles.orderItemTotal} />
              </View>

              <View style={styles.orderItemMetaRow}>
                <View style={styles.orderItemUnitChip}>
                  <Text style={styles.orderItemUnitChipText}>
                    <StockyMoneyText value={Number(item.unit_price || 0)} style={styles.orderItemUnitChipText} />
                    {' '}por unidad
                  </Text>
                </View>
                <Text style={styles.orderItemSubtotalLabel}>Subtotal</Text>
              </View>

              <View style={styles.orderItemDivider} />

              <View style={styles.orderItemControlsRow}>
                <View style={styles.orderItemStepper}>
                  <Pressable
                    style={styles.orderItemStepperButton}
                    onPressIn={() => {
                      if (isKeyboardVisible) {
                        Keyboard.dismiss();
                        return;
                      }
                      updateCartQuantity(item, Number(item.quantity || 0) - 1);
                    }}
                  >
                    <Text style={styles.orderItemMinusText}>-</Text>
                  </Pressable>
                  <Text style={styles.orderItemQtyText}>{item.quantity}</Text>
                  <Pressable
                    style={styles.orderItemStepperButton}
                    onPressIn={() => {
                      if (isKeyboardVisible) {
                        Keyboard.dismiss();
                        return;
                      }
                      updateCartQuantity(item, Number(item.quantity || 0) + 1);
                    }}
                  >
                    <Text style={styles.orderItemPlusText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        ) : null}

        <View style={styles.salePaymentBlock}>
          <View style={styles.salePaymentHeader}>
            <Text style={styles.salePaymentTitle}>Pago</Text>
            <Text style={styles.salePaymentHint}>{getPaymentMethodLabel(paymentMethod)}</Text>
          </View>
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            blockInteractions={isKeyboardVisible}
            onBlockedInteraction={() => Keyboard.dismiss()}
          />
          {paymentMethod === 'cash' ? (
            <>
              <TextInput
                value={amountReceived}
                onChangeText={(value) => {
                  setIsAmountReceivedManual(true);
                  setAmountReceived(value);
                }}
                placeholder="Monto recibido"
                placeholderTextColor={STOCKY_COLORS.textMuted}
                keyboardType="numeric"
                style={styles.saleComposerCashInput}
              />
              <Text style={[styles.cashInfo, cashChangeData?.isValid ? styles.cashInfoOk : styles.cashInfoError]}>
                {cashChangeData?.isValid
                  ? `Cambio: ${formatCop(cashChangeData.change)}`
                  : 'Monto recibido inválido o insuficiente.'}
              </Text>
            </>
          ) : null}

        </View>
      </StockyModal>

      <StockyModal
        visible={showDayFilterModal}
        title="Seleccionar día"
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
        visible={showSellerFilterModal}
        title="Seleccionar vendedor"
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={30}
        bodyFlex
        onClose={() => setShowSellerFilterModal(false)}
      >
        {sellerOptions.map((option) => {
          const selected = option.value === sellerFilter;
          return (
            <Pressable
              key={option.value}
              style={[styles.modalOptionItem, selected && styles.modalOptionItemSelected]}
              onPress={() => {
                setSellerFilter(option.value);
                setCurrentPage(1);
                setShowSellerFilterModal(false);
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
        visible={showVentaDetails}
        layout="centered"
        backdropVariant="blur"
        centeredOffsetY={12}
        modalAnimationType="none"
        bodyFlex
        sheetStyle={styles.saleDetailsModalSheet}
        contentContainerStyle={styles.saleDetailsContentContainer}
        onClose={closeVentaDetails}
        headerSlot={(
          <LinearGradient
            colors={['#4338CA', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saleDetailsHeader}
          >
            <View style={styles.saleDetailsHeaderLeft}>
              <View style={styles.saleDetailsHeaderIconWrap}>
                <Ionicons name="receipt-outline" size={19} color="#EDE9FE" />
              </View>
              <View style={styles.saleDetailsHeaderTextWrap}>
                <Text style={styles.saleDetailsHeaderTitle}>Detalle de venta</Text>
                <Text style={styles.saleDetailsHeaderSubtitle}>
                  {selectedVenta ? `ID ${selectedVenta.id.slice(0, 8).toUpperCase()}` : 'Sin referencia'}
                </Text>
              </View>
            </View>
            <Pressable style={styles.saleDetailsHeaderClose} onPress={closeVentaDetails}>
              <Ionicons name="close" size={20} color="#EDE9FE" />
            </Pressable>
          </LinearGradient>
        )}
      >
        {selectedVenta ? (
          <View style={styles.saleDetailsHeroCard}>
            <View style={styles.saleDetailsHeroTopRow}>
              <View style={styles.saleDetailsHeroTotalWrap}>
                <Text style={styles.saleDetailsHeroLabel}>Total pagado</Text>
                <StockyMoneyText value={selectedVenta.total} style={styles.saleDetailsHeroTotal} />
              </View>
              <View
                style={[
                  styles.saleDetailsHeroMethodBadge,
                  { backgroundColor: selectedVentaPaymentTheme?.backgroundColor || '#DCFCE7' },
                ]}
              >
                <Ionicons
                  name={selectedVentaPaymentTheme?.icon || 'cash-outline'}
                  size={14}
                  color={selectedVentaPaymentTheme?.iconColor || '#16A34A'}
                />
                <Text
                  style={[
                    styles.saleDetailsHeroMethodBadgeText,
                    { color: selectedVentaPaymentTheme?.textColor || '#166534' },
                  ]}
                >
                  {getPaymentMethodLabel(selectedVenta.payment_method)}
                </Text>
              </View>
            </View>
            <View style={styles.saleDetailsHeroMetaGrid}>
              <View style={styles.saleDetailsHeroMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                <Text style={styles.saleDetailsHeroMetaText}>{formatSaleDateTime(selectedVenta.created_at)}</Text>
              </View>
              <View style={styles.saleDetailsHeroMetaItem}>
                <Ionicons name="person-outline" size={14} color="#64748B" />
                <Text style={styles.saleDetailsHeroMetaText}>{selectedVenta.seller_name || 'Vendedor'}</Text>
              </View>
              <View style={styles.saleDetailsHeroMetaItem}>
                <Ionicons name="basket-outline" size={14} color="#64748B" />
                <Text style={styles.saleDetailsHeroMetaText}>
                  {selectedVentaItemsCount} {selectedVentaItemsCount === 1 ? 'unidad' : 'unidades'}
                </Text>
              </View>
            </View>

            {selectedVenta.payment_method === 'cash' ? (
              <View style={styles.saleDetailsHeroCashGrid}>
                <View style={styles.saleDetailsHeroCashCard}>
                  <Text style={styles.saleDetailsHeroCashLabel}>Recibido</Text>
                  {selectedVenta.amount_received !== null ? (
                    <StockyMoneyText value={selectedVenta.amount_received} style={styles.saleDetailsHeroCashValue} />
                  ) : (
                    <Text style={styles.saleDetailsHeroCashEmpty}>-</Text>
                  )}
                </View>
                <View style={styles.saleDetailsHeroCashCard}>
                  <Text style={styles.saleDetailsHeroCashLabel}>Cambio</Text>
                  {selectedVenta.change_amount !== null ? (
                    <StockyMoneyText value={selectedVenta.change_amount} style={styles.saleDetailsHeroCashValue} />
                  ) : (
                    <Text style={styles.saleDetailsHeroCashEmpty}>-</Text>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        {ventaDetailsError ? (
          <View style={styles.saleDetailsErrorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.saleDetailsErrorText}>{ventaDetailsError}</Text>
          </View>
        ) : null}

        <View style={styles.saleDetailsItemsSectionHeader}>
          <Text style={styles.saleDetailsItemsSectionTitle}>Productos vendidos</Text>
          <View style={styles.saleDetailsItemsCountBadge}>
            <Text style={styles.saleDetailsItemsCountText}>
              {selectedVentaDetails.length} {selectedVentaDetails.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>
        {loadingVentaDetails ? <ActivityIndicator color={STOCKY_COLORS.primary900} /> : null}
        {!loadingVentaDetails && selectedVentaDetails.length === 0 ? (
          <Text style={styles.emptyText}>No hay detalles para esta venta.</Text>
        ) : null}
        {!loadingVentaDetails && selectedVentaDetails.length > 0 ? (
          <View style={styles.saleDetailsListCard}>
            <FlatList
              data={selectedVentaDetails}
              keyExtractor={(item) => item.id}
              style={styles.saleDetailsListScroll}
              contentContainerStyle={styles.saleDetailsListScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              initialNumToRender={12}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item, index }) => (
                <View
                  style={[
                    styles.saleDetailsListRow,
                    index < selectedVentaDetails.length - 1 && styles.saleDetailsListRowDivider,
                  ]}
                >
                  <View style={styles.saleDetailsListRowLeft}>
                    <View style={styles.saleDetailsQtyBadge}>
                      <Text style={styles.saleDetailsQtyBadgeText}>{item.quantity}</Text>
                    </View>
                    <View style={styles.saleDetailsListMain}>
                      <Text style={styles.saleDetailsListName}>{getOrderItemName(item as unknown as MesaOrderItem)}</Text>
                      <Text style={styles.saleDetailsListMeta}>
                        <StockyMoneyText value={item.unit_price} style={styles.saleDetailsListMeta} /> por unidad
                      </Text>
                    </View>
                  </View>
                  <StockyMoneyText value={item.subtotal} style={styles.saleDetailsListSubtotal} />
                </View>
              )}
              ListFooterComponent={(
                <View style={styles.saleDetailsListFooter}>
                  <Text style={styles.saleDetailsListFooterLabel}>Total final</Text>
                  <StockyMoneyText value={selectedVenta?.total || 0} style={styles.saleDetailsListFooterValue} />
                </View>
              )}
            />
          </View>
        ) : null}
      </StockyModal>

      <StockyDeleteConfirmModal
        visible={showDeleteVentaModal}
        title="Eliminar venta"
        message="Esta acción eliminará la venta y su detalle asociado."
        warning="No se puede deshacer."
        itemLabel={ventaToDelete ? `Total: ${formatCop(ventaToDelete.total)}` : null}
        loading={deletingVenta}
        onCancel={() => {
          if (deletingVenta) return;
          setShowDeleteVentaModal(false);
          setVentaToDelete(null);
        }}
        onConfirm={confirmDeleteVenta}
      />
      <StockyStatusToast
        visible={showSaleCreatedToast}
        title="Venta Registrada"
        primaryLabel="Total"
        primaryValue={saleTotalLabel || formatCop(cartTotal)}
        secondaryLabel="Método"
        secondaryValue={salePaymentLabel || getPaymentMethodLabel(paymentMethod)}
        durationMs={1200}
        onClose={() => setShowSaleCreatedToast(false)}
      />
      <StockyStatusToast
        visible={showSaleDeletedToast}
        title="Venta Eliminada"
        primaryLabel="Total"
        primaryValue={saleDeletedTotalLabel || formatCop(0)}
        secondaryLabel="Estado"
        secondaryValue="Eliminada"
        durationMs={1200}
        onClose={() => setShowSaleDeletedToast(false)}
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
    fontSize: 50 / 2,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#D1D5DB',
    fontSize: 32 / 2,
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
    fontSize: 44 / 2,
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
    fontSize: 34 / 2,
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
    fontSize: 38 / 2,
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
  totalLabel: {
    color: '#374151',
    fontSize: 17,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  totalValue: {
    color: '#111827',
    fontSize: 46 / 2,
    fontWeight: '800',
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
  emptyText: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  saleOrderModalSheet: {
    maxHeight: '88%',
    height: '88%',
    borderRadius: 26,
    borderColor: '#D9DEE8',
  },
  saleOrderModalHeader: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saleOrderModalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleOrderModalHeaderTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  saleOrderModalHeaderClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleOrderModalContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  saleOrderModalFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  saleOrderFooterContainer: {
    gap: 10,
  },
  saleOrderFooterTotalBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  saleOrderFooterTotalLabel: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  saleOrderFooterTotalValue: {
    color: '#0F172A',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
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
  searchInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  searchInputFocused: {
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 2,
  },
  catalogResultsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 2,
  },
  catalogResultsScroll: {
    maxHeight: 240,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catalogResultRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  catalogResultName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  catalogResultPrice: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  comboPill: {
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  comboPillText: {
    color: '#1D4ED8',
    fontSize: 10,
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
  orderItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderItemUnitChip: {
    borderRadius: 10,
    backgroundColor: '#EEF2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  orderItemUnitChipText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },
  orderItemSubtotalLabel: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '500',
  },
  orderItemDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 2,
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
  salePaymentBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  salePaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  salePaymentTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  salePaymentHint: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  saleComposerCashInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
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
  cashInfo: {
    fontSize: 12,
    fontWeight: '700',
  },
  cashInfoOk: {
    color: '#166534',
  },
  cashInfoError: {
    color: '#991B1B',
  },
  saleFooter: {
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: 'rgba(232, 244, 246, 0.6)',
    padding: 10,
    gap: 8,
  },
  saleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saleOrderSecondaryButton: {
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
  saleOrderSecondaryButtonText: {
    color: '#5B21B6',
    fontSize: 12,
    fontWeight: '800',
  },
  saleOrderPrimaryButton: {
    minHeight: 40,
    borderRadius: STOCKY_RADIUS.md,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },
  saleOrderPrimaryButtonText: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '800',
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
  saleDetailsModalSheet: {
    width: '100%',
    maxWidth: 470,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE2E8',
    backgroundColor: '#FFFFFF',
  },
  saleDetailsContentContainer: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  saleDetailsFooter: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  saleDetailsHeader: {
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  saleDetailsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  saleDetailsHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleDetailsHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  saleDetailsHeaderTitle: {
    color: '#F5F3FF',
    fontSize: 18,
    fontWeight: '800',
  },
  saleDetailsHeaderSubtitle: {
    color: '#DDD6FE',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  saleDetailsHeaderClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  saleDetailsHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  saleDetailsHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  saleDetailsHeroTotalWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  saleDetailsHeroLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  saleDetailsHeroTotal: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '800',
  },
  saleDetailsHeroMethodBadge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  saleDetailsHeroMethodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  saleDetailsHeroMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saleDetailsHeroMetaItem: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  saleDetailsHeroMetaText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  saleDetailsHeroCashGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  saleDetailsHeroCashCard: {
    flex: 1,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  saleDetailsHeroCashLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  saleDetailsHeroCashValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  saleDetailsHeroCashEmpty: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  saleDetailsItemsSectionHeader: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  saleDetailsItemsSectionTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  saleDetailsItemsCountBadge: {
    minHeight: 24,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleDetailsItemsCountText: {
    color: '#4338CA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  saleDetailsErrorCard: {
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
  saleDetailsErrorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  saleDetailsListCard: {
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
  saleDetailsListScroll: {
    maxHeight: 320,
  },
  saleDetailsListScrollContent: {
    paddingBottom: 4,
  },
  saleDetailsListRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  saleDetailsListRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  saleDetailsListRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saleDetailsQtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleDetailsQtyBadgeText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '800',
  },
  saleDetailsListMain: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  saleDetailsListName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  saleDetailsListMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  saleDetailsListSubtotal: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  saleDetailsListFooter: {
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saleDetailsListFooterLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  saleDetailsListFooterValue: {
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
