import type { DashboardModuleProps } from '@/types/components';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { getFilteredSales } from '../../services/salesService';
import { recordSaleCreationTime } from '../../services/salesServiceOptimized';
import { fetchComboCatalog } from '../../services/combosService';
import {
  createSaleWithOutbox,
  deleteSaleWithDetails,
  flushSalesOutbox,
  getSalesOutboxSnapshot,
  retryAllSalesOutboxErrorEvents,
  retrySalesOutboxEventByTempSaleId,
  subscribeSalesOutboxUpdates,
  subscribeSalesSyncUpdates
} from '../../data/commands/salesCommands.js';
import {
  getBusinessNameById,
  getProductsForSale,
  getSaleCashMetadataBySaleId,
  getSaleDetailsBySaleId,
  getSaleForPrintById
} from '../../data/queries/salesQueries';
import {
  getAuthenticatedUser,
  isEmployeeInBusiness,
  getEmployeeRoleInBusiness
} from '../../data/queries/authQueries';
import { isAdminRole } from '../../utils/roles.js';
import SalesFilters from '../Filters/SalesFilters';
import { sendInvoiceEmail } from '../../utils/emailService.js';
import { formatPrice, formatDate, formatDateOnly } from '../../utils/formatters';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { isAutoPrintReceiptEnabled } from '../../utils/printer.js';
import { printSaleReceipt } from '../../utils/saleReceiptPrint.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import PaymentMethodSelect from '../ui/PaymentMethodSelect.jsx';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { SaleUpdateAlert } from '../ui/SaleUpdateAlert';
import { PrintReceiptConfirmModal } from '../ui/PrintReceiptConfirmModal';
import Pagination from '../Pagination';
import { useLowMotionMode } from '../../hooks/useLowMotionMode.js';
import { useProgressiveList } from '../../hooks/useProgressiveList.js';
import { useRafBatchedQueue } from '../../hooks/useRafBatchedQueue.js';
import { useDebounce } from '../../hooks/optimized.js';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Receipt, 
  Search,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  User,
  Mail,
  FileText,
  Calendar,
  CreditCard,
  X,
  Printer,
  Eye
} from 'lucide-react';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../../utils/offlineSnapshot.js';
import { PaymentMethodBankLogo, getPaymentMethodLabel } from '../ui/PaymentMethodBankLogo';
import {
  applyOfflineStockConsumption,
  buildCartConsumptionByProduct,
  evaluateOfflineStockShortages
} from '../../utils/offlineStockGuards.js';
import { isConnectivityError, formatLoadError } from '../../utils/connectivity';


// Función helper pura fuera del componente (no se recrea en renders)
const getVendedorName = (sale, t) => {
  if (sale?.employees?.role === 'owner' || sale?.employees?.role === 'admin') {
    return t('roles.admin', { ns: 'common' });
  }

  if (sale?.seller_name && typeof sale.seller_name === 'string' && sale.seller_name.trim() !== '') {
    return sale.seller_name;
  }
  
  if (!sale.employees) return t('roles.employee', { ns: 'common' });
  if (sale.employees.role === 'owner' || sale.employees.role === 'admin') return t('roles.admin', { ns: 'common' });
  return sale.employees.full_name || t('roles.employee', { ns: 'common' });
};


const buildDiagnosticAlertMessage = (errorLike, fallback = 'Error desconocido') => {
  const message = String(errorLike?.message || errorLike || fallback).trim() || fallback;
  const code = String(errorLike?.code || '').trim();
  const status = String(errorLike?.status || errorLike?.statusCode || '').trim();
  const hint = String(errorLike?.hint || '').trim();
  const details = String(errorLike?.details || '').trim();

  const diagnosticParts = [
    code ? `code=${code}` : null,
    status ? `status=${status}` : null,
    hint ? `hint=${hint}` : null,
    details ? `details=${details}` : null
  ].filter(Boolean);

  if (diagnosticParts.length === 0) return `❌ ${message}`;
  return `❌ ${message} [diag: ${diagnosticParts.join(' | ')}]`;
};

const getActionableSyncErrorMessage = (errorLike, t) => {
  const message = String(errorLike || '').trim();
  const normalized = message.toLowerCase();

  if (normalized.includes('idx_sales_prevent_duplicates')) {
    return t('ventas:errors.alreadySynced');
  }

  if (normalized.includes('sesión no válida') || normalized.includes('sesion no valida') || normalized.includes('unauthorized')) {
    return t('ventas:errors.invalidSession');
  }

  if (normalized.includes('permission denied') || normalized.includes('row-level security') || normalized.includes('forbidden')) {
    return t('ventas:errors.noPermission');
  }

  if (normalized.includes('datos de venta inválidos') || normalized.includes('datos de venta invalidos') || normalized.includes('item inválido') || normalized.includes('item invalido')) {
    return t('ventas:errors.invalidData');
  }

  return message || t('ventas:errors.syncFailed');
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const SALE_ITEM_TYPE = {
  PRODUCT: 'product',
  COMBO: 'combo'
};

const buildCartItemKey = (itemType, id) => `${itemType}:${id}`;

const getSaleDetailDisplayName = (detail, t) => (
  detail?.products?.name
  || detail?.combos?.nombre
  || detail?.combos?.name
  || detail?.product_name
  || t('ventas:labels.item')
);

function Ventas({ businessId, userRole = 'admin' }: DashboardModuleProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(['ventas', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  const dateConfig = { timezone: config.timezone, locale: config.locale };
  
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  const fmtDate = (timestamp, options = {}) => formatDate(timestamp, options, dateConfig);
  const fmtDateOnly = (timestamp) => formatDateOnly(timestamp, dateConfig);
  
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 30));
  const [totalCount, setTotalCount] = useState(0);
  const [currentFilters, setCurrentFilters] = useState({});
  const [products, setProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  const customers = [];
  const [loading, setLoading] = useState(true);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successDetails, setSuccessDetails] = useState([]);
  const [successTitle, setSuccessTitle] = useState(t('alerts.saleCreated'));
  const [alertType, setAlertType] = useState('success'); // 'success' o 'error'
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false); // Verificar si es empleado
  
  // Estados para modal de eliminación de venta (solo admin)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);

  // Estado del carrito de venta
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchProduct, setSearchProduct] = useState('');
  const debouncedSearch = useDebounce(searchProduct, 200);
  const [saleModalPanel, setSaleModalPanel] = useState('catalog');
  const lowMotionMode = useLowMotionMode();
  const enqueueRealtimeUpdate = useRafBatchedQueue();
  
  // Modal de facturación
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoiceCustomerEmail, setInvoiceCustomerEmail] = useState('');
  const [invoiceCustomerIdNumber, setInvoiceCustomerIdNumber] = useState('');
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);
  const [saleDetailsLoading, setSaleDetailsLoading] = useState(false);
  const [saleDetailsError, setSaleDetailsError] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [salesOutboxState, setSalesOutboxState] = useState(() => getSalesOutboxSnapshot());
  const saleIntentKeyRef = useRef(null);
  const saleIntentSignatureRef = useRef('');

  // Estados para modal de impresión
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSaleData, setPrintSaleData] = useState(null);
  const [printSaleDetails, setPrintSaleDetails] = useState([]);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [printCustomerName, setPrintCustomerName] = useState(t('ventas:print.defaultCustomer'));

  const closeSaleModal = useCallback(() => {
    setShowSaleModal(false);
    setCart([]);
    setSelectedCustomer('');
    setPaymentMethod('cash');
    setSearchProduct('');
    setSaleModalPanel('catalog');
  }, []);

  // Callbacks para modal de impresión
  const handlePrintConfirm = useCallback(async () => {
    if (!printSaleData) {
      setError('⚠️ ' + t('ventas:errors.noPrintData'));
      return;
    }

    setIsPrintingReceipt(true);
    try {
      const printResult = await printSaleReceipt({
        sale: printSaleData,
        saleDetails: printSaleDetails,
        sellerName: printSaleData.seller_name || getVendedorName(printSaleData, t),
        businessName: await getBusinessNameById(businessId),
        customerName: printCustomerName,
      });

      if (!printResult.ok) {
        setError('⚠️ ' + t('ventas:errors.printFailed'));
      }
    } catch (err) {
      logger.error('print_receipt_failed', err);
      setError('⚠️ ' + t('ventas:errors.printFailed'));
    } finally {
      setIsPrintingReceipt(false);
      setShowPrintModal(false);
      setPrintSaleData(null);
      setPrintSaleDetails([]);
    }
  }, [printSaleData, printSaleDetails, printCustomerName, businessId, t]);

  const handlePrintCancel = useCallback(() => {
    setShowPrintModal(false);
    setPrintSaleData(null);
    setPrintSaleDetails([]);
    setPrintCustomerName(t('ventas:print.defaultCustomer'));
  }, [t]);

  // Funciones de carga memoizadas SIN cache para evitar problemas de actualización
  const loadVentas = useCallback(async (filters = currentFilters, pagination: any = {}) => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `ventas.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setSales(offlineSnapshot);
      setTotalCount(offlineSnapshot.length);
    }

    try {
      const lim = Number(pagination.limit ?? limit);
      const off = Number(pagination.offset ?? ((page - 1) * lim));
      const includeCount = typeof pagination.includeCount === 'boolean'
        ? pagination.includeCount
        : off === 0;
      const countMode = pagination.countMode || 'planned';
      
      // SIEMPRE cargar datos frescos - sin caché
      const { data, count, error: salesError } = await getFilteredSales(businessId, filters, {
        limit: lim,
        offset: off,
        includeCount,
        countMode
      }) as any;
      if (salesError) {
        throw new Error(salesError);
      }
      
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setSales(offlineSnapshot);
        setTotalCount(offlineSnapshot.length);
        return;
      }

      setSales(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
      if (typeof count === 'number') {
        setTotalCount(count);
      } else if (!includeCount) {
        setTotalCount(off + normalizedData.length);
      }
    } catch (err) {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        const safe = Array.isArray(cached) ? cached : [];
        setSales(safe);
        setTotalCount(safe.length);
      } else {
        setSales([]);
        setTotalCount(0);
        setError(formatLoadError(t('ventas:labels.sales'), err));
      }
    }
  }, [businessId, page, limit, currentFilters, t]);

  const loadProductos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `ventas.productos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setProducts(offlineSnapshot);
    }

    try {
      const data = await getProductsForSale(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;
      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setProducts(offlineSnapshot);
        return;
      }

      setProducts(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setProducts(Array.isArray(cached) ? cached : []);
      } else {
        throw new Error(t('ventas:errors.loadProductsFailed'));
      }
    }
  }, [businessId, t]);

  const loadCombos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `ventas.combos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setCombos(offlineSnapshot);
    }

    try {
      const data = await fetchComboCatalog(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setCombos(offlineSnapshot);
        return;
      }

      setCombos(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setCombos(Array.isArray(cached) ? cached : []);
      } else {
        throw new Error(t('ventas:errors.loadCombosFailed'));
      }
    }
  }, [businessId, t]);

  // Verificar si el usuario autenticado es empleado
  const checkIfEmployee = useCallback(async () => {
    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        setIsEmployee(false);
        return;
      }

      const employeeRole = await getEmployeeRoleInBusiness({ userId: user.id, businessId });
      if (employeeRole) {
        // owner/admin/propietario/administrador deben conservar permisos de gestión.
        setIsEmployee(!isAdminRole(employeeRole));
        return;
      }

      // Fallback: si existe en employees pero sin rol resoluble, tratar como empleado restringido.
      setIsEmployee(await isEmployeeInBusiness({ userId: user.id, businessId }));
    } catch {
      // Si hay error, asumimos que NO es empleado (es admin)
      setIsEmployee(false);
    }
  }, [businessId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
      
      // Verificar sesión ANTES de cargar datos
      let user = null;
      let authError = null;
      try {
        user = await getAuthenticatedUser();
      } catch (error) {
        authError = error;
      }
      
      if (authError || !user?.id) {
        if (offlineMode) {
          setSessionChecked(true);
          setError('⚠️ ' + t('ventas:errors.offlineMode'));
        } else {
          setError('⚠️ ' + t('ventas:errors.sessionExpired'));
          setLoading(false);
          setTimeout(() => {
            navigate('/login');
          }, 2000);
          return;
        }
      } else {
        setSessionChecked(true);
      }
      
      await Promise.all([
        loadVentas(),
        loadProductos(),
        loadCombos(),
        checkIfEmployee()
      ]);
    } catch {
      setError('⚠️ ' + t('ventas:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadVentas, loadProductos, loadCombos, checkIfEmployee, navigate, t]);

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId, loadData]);

  useEffect(() => {
    const syncState = () => setSalesOutboxState(getSalesOutboxSnapshot());
    syncState();

    const unsubscribe = subscribeSalesOutboxUpdates((snapshot) => {
      setSalesOutboxState(snapshot);
    });

    const timer = setInterval(() => {
      const snapshot = getSalesOutboxSnapshot();
      setSalesOutboxState((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(snapshot)) return prev;
        return snapshot;
      });
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSalesSyncUpdates((payload) => {
      const tempSaleId = String(payload?.tempSaleId || '').trim();
      const remoteSaleId = String(payload?.remoteSaleId || '').trim();
      const syncedAt = payload?.syncedAt || new Date().toISOString();
      const payloadBusinessId = String(payload?.businessId || '').trim();

      if (!tempSaleId || !remoteSaleId) return;
      if (payloadBusinessId && String(businessId || '').trim() && payloadBusinessId !== String(businessId || '').trim()) {
        return;
      }

      setSales((prevVentas) => {
        const list = Array.isArray(prevVentas) ? [...prevVentas] : [];
        const tempIndex = list.findIndex((sale) => String(sale?.id || '').trim() === tempSaleId);
        if (tempIndex < 0) return prevVentas;

        const remoteIndex = list.findIndex((sale) => String(sale?.id || '').trim() === remoteSaleId);
        if (remoteIndex >= 0 && remoteIndex !== tempIndex) {
          const tempSale = list[tempIndex] || {};
          const remoteSale = list[remoteIndex] || {};
          list[remoteIndex] = {
            ...tempSale,
            ...remoteSale,
            id: remoteSaleId,
            pending_sync: false,
            synced_at: syncedAt
          };
          list.splice(tempIndex, 1);
          return list;
        }

        list[tempIndex] = {
          ...(list[tempIndex] || {}),
          id: remoteSaleId,
          pending_sync: false,
          synced_at: syncedAt
        };
        return list;
      });

      setSelectedSale((prevSelected) => {
        if (!prevSelected) return prevSelected;
        const selectedId = String(prevSelected?.id || '').trim();
        if (selectedId !== tempSaleId) return prevSelected;
        return {
          ...prevSelected,
          id: remoteSaleId,
          pending_sync: false,
          synced_at: syncedAt
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, [businessId]);

  // 🔥 TIEMPO REAL: Suscripción a cambios en ventas
  useRealtimeSubscription('sales', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: (newSale) => {
      enqueueRealtimeUpdate(() => {
        const sellerName = typeof newSale?.seller_name === 'string' ? newSale.seller_name.trim() : '';
        const isAdminSeller = sellerName.toLowerCase() === t('roles.admin', { ns: 'common' }).toLowerCase();

        const saleWithDetails = {
          ...newSale,
          employees: isAdminSeller
            ? { full_name: t('roles.admin', { ns: 'common' }), role: 'owner' }
            : { full_name: sellerName || t('ventas:labels.unknownSeller'), role: 'employee' }
        };

        // Verificar si la venta ya existe antes de agregarla
        setSales(prev => {
          const exists = prev.some(v => v.id === newSale.id);
          if (exists) {
            return prev;
          }
          return [saleWithDetails, ...prev];
        });

        // Incrementar el contador total
        setTotalCount(prev => prev + 1);

        setSuccess(t('ventas:alerts.saleCreated'));
        setTimeout(() => setSuccess(null), 3000);
      });
    },
    onUpdate: (updatedSale) => {
      enqueueRealtimeUpdate(() => {
        setSales(prev => prev.map(v => v.id === updatedSale.id ? { ...v, ...updatedSale } : v));
      });
    },
    onDelete: (deletedSale) => {
      enqueueRealtimeUpdate(() => {
        setSales(prev => prev.filter(v => v.id !== deletedSale.id));
        setTotalCount(prev => Math.max(0, prev - 1));
      });
    }
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en productos (para stock)
  useRealtimeSubscription('products', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onUpdate: (updatedProduct) => {
      enqueueRealtimeUpdate(() => {
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        // Mantener stock disponible del carrito sincronizado con cambios en tiempo real
        setCart(prevCart => prevCart.map(item =>
          item.product_id === updatedProduct.id
            ? {
                ...item,
                available_stock: updatedProduct.manage_stock === false ? null : updatedProduct.stock,
                manage_stock: updatedProduct.manage_stock !== false
              }
            : item
        ));
      });
    },
    onDelete: (deletedProduct) => {
      enqueueRealtimeUpdate(() => {
        setProducts(prev => prev.filter(p => p.id !== deletedProduct.id));
        setCart(prevCart => prevCart.map(item =>
          item.product_id === deletedProduct.id
            ? { ...item, available_stock: 0 }
            : item
        ));
      });
    },
    onInsert: () => {}
  });

  useRealtimeSubscription('combos', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: () => {
      loadCombos().catch((err) => { logger.warn('ventas:combos_sync_insert failed', err); });
    },
    onUpdate: () => {
      loadCombos().catch((err) => { logger.warn('ventas:combos_sync_update failed', err); });
    },
    onDelete: () => {
      loadCombos().catch((err) => { logger.warn('ventas:combos_sync_delete failed', err); });
    }
  });

  useEffect(() => {
    if (!businessId || !Array.isArray(sales) || loading) return;

    const snapshotKey = `ventas.list:${businessId}`;
    if (sales.length === 0) {
      const offline = isOfflineMode();
      const existing = readOfflineSnapshot(snapshotKey, []);
      if (offline && Array.isArray(existing) && existing.length > 0) {
        return;
      }
    }

    saveOfflineSnapshot(snapshotKey, sales);
  }, [businessId, sales, loading]);

  const comboById = useMemo(() => {
    const map = new Map();
    combos.forEach((combo) => map.set(combo.id, combo));
    return map;
  }, [combos]);

  const catalogItems = useMemo(() => {
      const productItems = products.map((product) => ({
      item_type: SALE_ITEM_TYPE.PRODUCT,
      item_id: product.id,
      product_id: product.id,
      combo_id: null,
      name: product.name,
      code: product.code || '',
      sale_price: Number(product.sale_price || 0),
      stock: Number(product.stock || 0),
      manage_stock: product.manage_stock !== false,
      combo_items: []
    }));

    const comboItems = combos.map((combo) => ({
      item_type: SALE_ITEM_TYPE.COMBO,
      item_id: combo.id,
      product_id: null,
      combo_id: combo.id,
      name: combo.nombre,
      code: `COMBO-${String(combo.id).slice(0, 4).toUpperCase()}`,
      sale_price: Number(combo.precio_venta || 0),
      stock: null,
      combo_items: combo.combo_items || []
    }));

    return [...comboItems, ...productItems];
  }, [products, combos]);

  // Memoizar funciones del carrito
  const addToCart = useCallback((catalogItem) => {
    const itemType = catalogItem?.item_type || SALE_ITEM_TYPE.PRODUCT;
    const itemId = catalogItem?.item_id || catalogItem?.id;
    if (!itemId) return;

    const itemKey = buildCartItemKey(itemType, itemId);

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.item_key === itemKey);

      if (existingItem) {
        return prevCart.map((item) => (
          item.item_key === itemKey
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        ));
      }

      const unitPrice = Number(catalogItem.sale_price || 0);
      const quantity = 1;
      return [
        ...prevCart,
        {
          item_key: itemKey,
          item_type: itemType,
          item_id: itemId,
          product_id: itemType === SALE_ITEM_TYPE.PRODUCT ? itemId : null,
          combo_id: itemType === SALE_ITEM_TYPE.COMBO ? itemId : null,
          name: catalogItem.name,
          code: catalogItem.code || '',
          quantity,
          unit_price: unitPrice,
          subtotal: quantity * unitPrice,
          available_stock: itemType === SALE_ITEM_TYPE.PRODUCT && catalogItem.manage_stock !== false
            ? Number(catalogItem.stock || 0)
            : null,
          manage_stock: itemType === SALE_ITEM_TYPE.PRODUCT ? catalogItem.manage_stock !== false : true
        }
      ];
    });
    setSearchProduct('');
  }, []);

  const removeFromCart = useCallback((itemKey) => {
    setCart((prevCart) => prevCart.filter((item) => item.item_key !== itemKey));
  }, []);

  const updateQuantity = useCallback((itemKey, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemKey);
      return;
    }

    setCart((prevCart) => prevCart.map((item) => (
      item.item_key === itemKey
        ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.unit_price }
        : item
    )));
  }, [removeFromCart]);

  const {
    comboStockShortages,
    simpleStockShortages
  } = useMemo(() => evaluateOfflineStockShortages({
    cart,
    products: products,
    comboById
  }), [cart, products, comboById]);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const saleIntentSignature = useMemo(() => {
    const normalizedItems = [...cart]
      .map((item) => ({
        item_type: item.item_type || SALE_ITEM_TYPE.PRODUCT,
        product_id: item.product_id || null,
        combo_id: item.combo_id || null,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0)
      }))
      .sort((a, b) => String(a.product_id || a.combo_id || '').localeCompare(String(b.product_id || b.combo_id || '')));

    return JSON.stringify({
      businessId,
      paymentMethod,
      items: normalizedItems
    });
  }, [businessId, paymentMethod, cart]);

  useEffect(() => {
    if (cart.length === 0) {
      saleIntentKeyRef.current = null;
      saleIntentSignatureRef.current = '';
    }
  }, [cart.length]);

  const processSale = useCallback(async () => {
    if (isSubmitting) return; // Prevenir doble click
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (cart.length === 0) {
        throw new Error('⚠️ ' + t('errors.emptyCart'));
      }

      // Verificar sesión antes de procesar
      if (!sessionChecked) {
        throw new Error('⚠️ ' + t('ventas:errors.sessionRequired'));
      }

      if (comboStockShortages.length > 0) {
        const firstShortage = comboStockShortages[0];
        throw new Error(
          t('ventas:labels.insufficientComboStock') + ` "${firstShortage.product_name}". ` +
          t('ventas:labels.availableRequired', { available: firstShortage.available_stock, required: firstShortage.required_quantity })
        );
      }

      if (simpleStockShortages.length > 0) {
        const firstShortage = simpleStockShortages[0];
        throw new Error(
          t('ventas:labels.insufficientProductStock') + ` "${firstShortage.product_name}". ` +
          t('ventas:labels.availableRequired', { available: firstShortage.available_stock, required: firstShortage.required_quantity })
        );
      }

      // Calcular total del carrito
      const saleTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // 🚀 USAR FUNCIÓN OPTIMIZADA: Una sola llamada RPC
      const startTime = performance.now();
      if (saleIntentSignatureRef.current !== saleIntentSignature) {
        saleIntentSignatureRef.current = saleIntentSignature;
        saleIntentKeyRef.current = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
      }
      
      const result = await createSaleWithOutbox({
        businessId,
        cart,
        paymentMethod,
        total: saleTotal,
        idempotencyKey: saleIntentKeyRef.current
      });

      const elapsedMs = performance.now() - startTime;
      
      if (!(result as any).success) {
        throw new Error((result as any).error || t('ventas:errors.processFailed'));
      }

      // Registrar latencia para debugging
      recordSaleCreationTime(elapsedMs);

      // Mostrar alerta con detalles de la venta
      setSuccessTitle(t('alerts.saleCreated'));
      setSuccessDetails([
        { label: t('labels.total', { ns: 'common' }), value: fmtPrice(saleTotal) },
        { label: t('ventas:labels.paymentMethodLabel'), value: getPaymentMethodLabel(paymentMethod, t) },
        { label: t('ventas:labels.time'), value: `${elapsedMs.toFixed(0)}ms` },
        { label: t('ventas:labels.articles'), value: cart.length },
        ...(result?.data?.pending_sync ? [{ label: t('ventas:labels.status'), value: t('ventas:labels.pendingSync') }] : [])
      ]);
      setAlertType('success');
      setSuccess(true);

      if (result?.data?.pending_sync) {
        const pendingSale = {
          id: result?.data?.id,
          business_id: businessId,
          user_id: null,
          seller_name: t('ventas:labels.offlineSale'),
          payment_method: paymentMethod,
          total: Number(saleTotal || 0),
          created_at: result?.data?.created_at || new Date().toISOString(),
          notes: t('ventas:labels.pendingSync'),
          pending_sync: true,
          employees: { full_name: t('status.pendingSync', { ns: 'common' }), role: 'employee' }
        };

        setSales((prev) => {
          const next = [pendingSale, ...prev];
          saveOfflineSnapshot(`ventas.list:${businessId}`, next);
          return next;
        });
        setTotalCount((prev) => prev + 1);

        const consumptionByProduct = buildCartConsumptionByProduct({ cart, comboById });

        setProducts((prevProducts) => {
          const nextProducts = applyOfflineStockConsumption({
            products: prevProducts,
            consumptionByProduct
          });

          saveOfflineSnapshot(`ventas.productos:${businessId}`, nextProducts);
          return nextProducts;
        });
      }

      // Mostrar modal de impresión después de que la venta se registre
      if (isAutoPrintReceiptEnabled()) {
        // Preparar datos para impresión
        const isPendingSync = !!result?.data?.pending_sync;

        let saleForPrint = null;
        let detailsForPrint = [];

        if (isPendingSync) {
          saleForPrint = {
            id: result.data.id,
            total: saleTotal,
            payment_method: paymentMethod,
            created_at: result?.data?.created_at || new Date().toISOString(),
            seller_name: t('ventas:labels.offlineSale')
          };
          detailsForPrint = cart.map((item) => ({
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
            subtotal: Number(item.subtotal || (Number(item.quantity || 0) * Number(item.unit_price || 0))),
            product_name: item.name || t('ventas:labels.item')
          }));
        } else {
          try {
            const [saleRow, saleDetails] = await Promise.all([
              getSaleForPrintById(result.data.id),
              getSaleDetailsBySaleId(result.data.id)
            ]);

            saleForPrint = saleRow || {
              id: result.data.id,
              total: saleTotal,
              payment_method: paymentMethod,
              created_at: new Date().toISOString(),
              seller_name: t('roles.employee', { ns: 'common' })
            };

            detailsForPrint = Array.isArray(saleDetails) ? saleDetails : [];
          } catch {
            saleForPrint = {
              id: result.data.id,
              total: saleTotal,
              payment_method: paymentMethod,
              created_at: new Date().toISOString(),
              seller_name: t('roles.employee', { ns: 'common' })
            };
            detailsForPrint = [];
          }
        }

        // Guardar datos para el modal
        setPrintSaleData(saleForPrint);
        setPrintSaleDetails(detailsForPrint);

        // Mostrar el modal después de un pequeño delay para que se vea el toast primero
        setTimeout(() => {
          setShowPrintModal(true);
        }, 500);
      }
      
      // Limpiar el carrito y cerrar POS
      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('cash');
      setShowSaleModal(false);
      saleIntentKeyRef.current = null;
      saleIntentSignatureRef.current = '';
      setSaleModalPanel('catalog');

      // Recargar ventas inmediatamente
      await loadVentas(currentFilters, { limit, offset: (page - 1) * limit, includeCount: false });
      
    } catch (error) {
      
      // Si es error de sesión, redirigir a login
      if (String(error?.message || '').includes('sesión ha expirado') && (typeof navigator === 'undefined' || navigator.onLine)) {
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
      setError(buildDiagnosticAlertMessage(error, t('ventas:errors.processFailed')));
    } finally {
      setIsSubmitting(false); // SIEMPRE desbloquear
    }
  }, [cart, sessionChecked, comboStockShortages, simpleStockShortages, comboById, businessId, paymentMethod, loadVentas, isSubmitting, currentFilters, limit, page, saleIntentSignature, navigate, fmtPrice, t]);

  // Funciones de eliminación de venta (solo admin)
  const handleDeleteSale = (saleId) => {
    setSaleToDelete(saleId);
    setShowDeleteModal(true);
  };

  const confirmDeleteSale = async () => {
    if (!saleToDelete) return;

    setLoading(true);
    setError(null);
    
    try {
      await deleteSaleWithDetails(saleToDelete, businessId);

      setSuccessTitle(t('ventas:alerts.saleDeleted'));
      setSuccessDetails([
        { label: t('ventas:labels.action'), value: t('ventas:alerts.saleDeletedCorrectly') }
      ]);
      setAlertType('error');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      // Recargar ventas
      await loadVentas(currentFilters, { limit, offset: (page - 1) * limit, includeCount: false });

      setShowDeleteModal(false);
      setSaleToDelete(null);

    } catch (error) {
      setError('❌ ' + (error.message || t('ventas:errors.deleteFailed')));
      setTimeout(() => setError(null), 8000);
      setShowDeleteModal(false);
      setSaleToDelete(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSaleDetails = useCallback(async (saleId) => {
    if (!saleId) return [];
    return getSaleDetailsBySaleId(saleId);
  }, []);

  const openSaleDetailsModal = useCallback(async (sale) => {
    setSelectedSale({ ...sale, sale_details: [] });
    setShowSaleDetailsModal(true);
    setSaleDetailsError('');

    try {
      setSaleDetailsLoading(true);
      const details = await fetchSaleDetails(sale.id);
      let saleInfo = {};
      try {
        const infoData = await getSaleCashMetadataBySaleId(sale.id);
        if (infoData) {
          saleInfo = infoData;
        }
      } catch (err) {
        logger.warn('ventas:fetch_sale_cash_metadata failed', err);
      }

      setSelectedSale({
        ...sale,
        amount_received: (saleInfo as any).amount_received ?? sale.amount_received ?? null,
        change_amount: (saleInfo as any).change_amount ?? sale.change_amount ?? null,
        change_breakdown: (saleInfo as any).change_breakdown ?? sale.change_breakdown ?? [],
        sale_details: details
      });
    } catch (err) {
      setSaleDetailsError(err?.message || t('ventas:errors.detailsFailed'));
    } finally {
      setSaleDetailsLoading(false);
    }
  }, [fetchSaleDetails, t]);

  // Función para imprimir factura física
  const handlePrintInvoice = useCallback(async (sale) => {
    let saleDetails = [];
    try {
      saleDetails = await fetchSaleDetails(sale.id);
    } catch {
      setError(t('ventas:errors.detailsFailed'));
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!saleDetails || saleDetails.length === 0) {
      setError(t('ventas:errors.detailsFailed'));
      setTimeout(() => setError(null), 3000);
      return;
    }

    const printResult = await printSaleReceipt({
      sale: sale,
      saleDetails,
      sellerName: getVendedorName(sale, t),
      businessName: await getBusinessNameById(businessId),
    });

    if (!printResult.ok) {
      setError(t('ventas:errors.printWindowFailed'));
      setTimeout(() => setError(null), 3000);
    }
  }, [fetchSaleDetails, businessId, t]);

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSaleToDelete(null);
  };

  // Memoizar catálogo filtrado (productos + combos)
  const filteredCatalog = useMemo(() => {
    if (!debouncedSearch.trim()) return catalogItems;

    const search = debouncedSearch.toLowerCase();
    return catalogItems.filter((item) =>
      item.name.toLowerCase().includes(search) ||
      item.code?.toLowerCase().includes(search)
    );
  }, [catalogItems, debouncedSearch]);

  const {
    visibleItems: visibleFilteredCatalog,
    hasMore: hasMoreFilteredCatalog,
    totalCount: totalFilteredCatalog,
    sentinelRef: filteredCatalogSentinelRef,
    loadMore: loadMoreFilteredCatalog
  } = useProgressiveList(filteredCatalog, {
    initialCount: lowMotionMode ? 12 : 20,
    step: lowMotionMode ? 10 : 18,
    rootMargin: '260px',
    resetKey: `${searchProduct.trim().toLowerCase()}:${filteredCatalog.length}:${lowMotionMode ? 'low' : 'full'}`
  });

  const {
    visibleItems: visibleCartItems,
    hasMore: hasMoreCartItems,
    totalCount: totalCartItems,
    sentinelRef: cartSentinelRef,
    loadMore: loadMoreCartItems
  } = useProgressiveList(cart, {
    initialCount: lowMotionMode ? 10 : 16,
    step: lowMotionMode ? 8 : 14,
    rootMargin: '220px',
    resetKey: `${cart.length}:${lowMotionMode ? 'low' : 'full'}`
  });
  // Cleanup de timers de mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Generar factura desde una venta existente (memoizado)
  const generateInvoiceFromSale = useCallback(async () => {
    if (!invoiceCustomerEmail || !invoiceCustomerEmail.includes('@')) {
      setError('⚠️ ' + t('ventas:errors.emailRequired'));
      return;
    }
    if (!invoiceCustomerName) {
      setError('⚠️ ' + t('ventas:errors.nameRequired'));
      return;
    }

    try {
      setGeneratingInvoice(true);
      setError(null);

      // Obtener detalles de la venta
      const saleDetails = await fetchSaleDetails(selectedSale.id);

      const total = selectedSale.total;

      // Generar número de comprobante (usando la venta existente)
      const comprobanteNumber = `COMP-${selectedSale.id.substring(0, 8).toUpperCase()}`;

      // Preparar items para el email
      const emailItems = saleDetails.map(detail => ({
        product_name: getSaleDetailDisplayName(detail, t),
        quantity: detail.quantity,
        unit_price: detail.unit_price
      }));

      // Obtener nombre del negocio
      const businessName = await getBusinessNameById(businessId);

      // Enviar comprobante por email
      const emailResult = await sendInvoiceEmail({
        email: invoiceCustomerEmail,
        invoiceNumber: comprobanteNumber,
        customerName: invoiceCustomerName,
        total: total,
        items: emailItems,
        businessName: businessName || 'Stocky',
        businessId,
        issuedAt: selectedSale?.created_at || new Date().toISOString()
      });

      if (emailResult.success) {
        setSuccess(`✅ ${t('ventas:email.sentSuccessfully')} ${invoiceCustomerEmail}`);
      } else {
        throw new Error(emailResult.error || t('ventas:errors.sendFailed'));
      }

      // Cerrar modal y limpiar
      setShowInvoiceModal(false);
      setInvoiceCustomerName('');
      setInvoiceCustomerEmail('');
      setInvoiceCustomerIdNumber('');
      setSelectedSale(null);

    } catch (error) {
      setError('❌ ' + (error.message || t('ventas:errors.sendFailedRetry')));
    } finally {
      setGeneratingInvoice(false);
    }
  }, [businessId, selectedSale, invoiceCustomerName, invoiceCustomerEmail, fetchSaleDetails, t]);

  const selectedSaleAmountReceived = toNumberOrNull(selectedSale?.amount_received);
  const selectedSaleChangeAmount = toNumberOrNull(selectedSale?.change_amount);
  const hasAmountReceivedValue = selectedSale?.amount_received !== null
    && selectedSale?.amount_received !== undefined;
  const hasChangeAmountValue = selectedSale?.change_amount !== null
    && selectedSale?.change_amount !== undefined;
  const selectedSaleChangeBreakdown = Array.isArray(selectedSale?.change_breakdown)
    ? selectedSale.change_breakdown
    : [];
  const selectedSaleTotal = toNumberOrNull(selectedSale?.total) ?? 0;
  const changeFromBreakdown = selectedSaleChangeBreakdown.reduce((sum, entry) => {
    const denomination = Number(entry?.denomination || 0);
    const count = Number(entry?.count || 0);
    if (!Number.isFinite(denomination) || !Number.isFinite(count) || count <= 0) return sum;
    return sum + (denomination * count);
  }, 0);
  const changeFromDifference = selectedSaleAmountReceived !== null
    ? Math.max(selectedSaleAmountReceived - selectedSaleTotal, 0)
    : null;
  const resolvedChangeAmount = selectedSaleChangeAmount !== null
    ? selectedSaleChangeAmount
    : (changeFromBreakdown > 0 ? changeFromBreakdown : changeFromDifference);
  const hasChangeBreakdown = changeFromBreakdown > 0;
  const showCashPaymentDetails = selectedSale?.payment_method === 'cash'
    && (hasAmountReceivedValue || hasChangeAmountValue || hasChangeBreakdown);
  const shouldBlockWithError = Boolean(sales.length === 0 && error && !isConnectivityError(error));
  const lastSuccessfulSyncText = salesOutboxState?.lastSuccessfulSyncAt
    ? fmtDate(salesOutboxState.lastSuccessfulSyncAt)
    : t('ventas:sync.noSyncYet');

  return (
    <AsyncStateWrapper
      loading={loading}
      error={shouldBlockWithError ? error : null}
      dataCount={sales.length}
      onRetry={loadData}
      skeletonType="ventas"
      hasFilters={Boolean(currentFilters && Object.keys(currentFilters).length > 0)}
      noResultsTitle={t('ventas:empty.noResultsTitle')}
      noResultsDescription={t('ventas:empty.noResultsDescription')}
      noResultsAction={
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={() => {
              setCurrentFilters({});
              setPage(1);
              loadVentas({}, { limit, offset: 0, includeCount: false });
            }}
            className="bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-100 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            {t('ventas:buttons.clearFilters')}
          </Button>
        </div>
      }
      emptyTitle={t('ventas:empty.noSales')}
      emptyDescription={t('ventas:empty.noSalesDescription')}
      emptyAction={
        <Button
          type="button"
          onClick={() => setShowSaleModal(true)}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          {t('ventas:empty.createFirstSale')}
        </Button>
      }
      bypassStateRendering={showSaleModal}
      actionProcessing={isSubmitting || generatingInvoice}
      className="min-h-screen bg-gradient-to-br from-light-bg-primary to-white p-6"
    >
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="gradient-primary text-white shadow-xl rounded-2xl border-none mb-6">
          <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{t('ventas:title')}</h1>
                <p className="text-white/80 mt-1 text-sm sm:text-base">{t('ventas:subtitle')}</p>
              </div>
            </div>
            <Button
              onClick={() => setShowSaleModal(!showSaleModal)}
              className="w-full sm:w-auto gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showSaleModal ? (
                <>
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="whitespace-nowrap">{t('ventas:buttons.viewHistory')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="whitespace-nowrap">{t('buttons.newSale')}</span>
                </>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Mensajes */}
      <AnimatePresence>
        <SaleUpdateAlert
          key="sale-submit-loading"
          isVisible={isSubmitting}
          onClose={() => {}}
          title={t('ventas:labels.generating')}
          details={[]}
          duration={600000}
        />
        <SaleSuccessAlert 
          key="sale-success"
          isVisible={success && alertType === 'success'}
          onClose={() => setSuccess(false)}
          title={successTitle}
          details={successDetails}
          duration={6000}
        />
        <SaleErrorAlert 
          key="sale-error"
          isVisible={success && alertType === 'error'}
          onClose={() => setSuccess(false)}
          title={successTitle}
          details={successDetails}
          duration={7000}
        />
        <PrintReceiptConfirmModal
          key="print-receipt-confirm"
          isOpen={showPrintModal}
          onConfirm={handlePrintConfirm}
          onCancel={handlePrintCancel}
          isLoading={isPrintingReceipt}
          customerName={printCustomerName}
          onCustomerNameChange={setPrintCustomerName}
        />
      </AnimatePresence>

      {!showSaleModal && (
        <SalesFilters
          {...({ businessId } as any)}
          onApply={(filters) => {
            setCurrentFilters(filters || {});
            setPage(1);
            loadVentas(filters || {}, { limit, offset: 0, includeCount: false });
          }}
          onClear={() => {
            setCurrentFilters({});
            setPage(1);
            loadVentas({}, { limit, offset: 0, includeCount: false });
          }}
        />
      )}

      {!showSaleModal && (
        <Card className="mb-6 rounded-2xl border border-accent-200 bg-white shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-accent-700">{t('ventas:sync.title')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('ventas:sync.description')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('ventas:sync.lastSync')} {lastSuccessfulSyncText}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-slate-100 text-slate-800 border border-slate-200">{t('ventas:sync.queue')} {salesOutboxState.total}</Badge>
              <Badge className="bg-amber-100 text-amber-800 border border-amber-200">{t('ventas:sync.pending')} {salesOutboxState.pending}</Badge>
              <Badge className="bg-gray-100 text-gray-800 border border-gray-200">{t('ventas:sync.processing')} {salesOutboxState.processing}</Badge>
              <Badge className="bg-red-100 text-red-800 border border-red-200">{t('ventas:sync.errors')} {salesOutboxState.error}</Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={salesOutboxState.error <= 0}
                className="h-8 border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                onClick={() => {
                  const retried = retryAllSalesOutboxErrorEvents();
                  if (retried <= 0) {
                    setError('⚠️ ' + t('ventas:sync.noErrors'));
                    return;
                  }
                  setSuccessTitle(t('ventas:sync.retryStarted'));
                  setSuccessDetails([
                    { label: t('ventas:title'), value: retried },
                    { label: t('ventas:labels.status'), value: t('ventas:sync.retrying') }
                  ]);
                  setAlertType('update');
                  setSuccess(true);
                }}
              >
                {t('ventas:buttons.retryErrors')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal para Nueva Venta */}
      <AnimatePresence>
        {showSaleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-2 sm:p-4 flex items-center justify-center"
            onClick={closeSaleModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-[1260px] max-h-[95vh] overflow-hidden rounded-3xl border border-accent-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del Modal */}
              <div className="gradient-primary p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-white">
                  <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold leading-tight">{t('buttons.newSale')}</h2>
                    <p className="text-xs sm:text-sm text-white/80">{t('labels.products')}</p>
                  </div>
                </div>
                <button
                  onClick={closeSaleModal}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/15 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="xl:hidden border-b border-accent-100 bg-white px-3 py-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaleModalPanel('catalog')}
                    className={`h-10 rounded-lg text-sm font-semibold transition ${
                      saleModalPanel === 'catalog'
                        ? 'gradient-primary text-white shadow-sm'
                        : 'bg-accent-50 text-accent-600'
                    }`}
                  >
                    {t('ventas:labels.products')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleModalPanel('cart')}
                    className={`h-10 rounded-lg text-sm font-semibold transition ${
                      saleModalPanel === 'cart'
                        ? 'gradient-primary text-white shadow-sm'
                        : 'bg-accent-50 text-accent-600'
                    }`}
                  >
                    {t('ventas:labels.cartTab')} ({cart.length})
                  </button>
                </div>
              </div>

              {/* Contenido del Modal */}
              <div className="p-3 sm:p-5 xl:p-6 overflow-y-auto max-h-[calc(95vh-136px)] xl:max-h-[calc(95vh-88px)]">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                  {/* Panel izquierdo - Productos y combos */}
                  <Card className={`rounded-2xl border border-accent-200 bg-white shadow-sm ${saleModalPanel === 'cart' ? 'hidden xl:block' : ''}`}>
                    <CardHeader className="pb-4 border-b border-accent-100">
                      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl text-accent-600">{t('ventas:labels.productsAndCombos')}</CardTitle>
                          <p className="text-sm text-gray-500 mt-1">{t('ventas:labels.exploreAndAdd')}</p>
                        </div>
                        <Badge className="w-fit bg-accent-100 text-accent-700 border border-accent-200">
                          {totalFilteredCatalog} resultados
                        </Badge>
                      </div>
                      <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          type="text"
                          className="pl-9 h-11 rounded-xl border-gray-300 focus:border-[#66A5AD] focus:ring-[#66A5AD]"
                          placeholder={t('labels.searchProduct')}
                          value={searchProduct}
                          onChange={(e) => setSearchProduct(e.target.value)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5">
                      {totalFilteredCatalog === 0 ? (
                        <div className="text-center py-16 text-gray-500 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                          <p className="font-medium">{t('ventas:labels.noItemsAvailable')}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 xl:max-h-[56vh] xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                          {visibleFilteredCatalog.map((catalogItem) => (
                            <motion.button
                              key={`${catalogItem.item_type}:${catalogItem.item_id}`}
                              type="button"
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => addToCart(catalogItem)}
                              className="text-left rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-3.5 transition hover:border-primary-300 hover:shadow-md"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-accent-600 text-base truncate" title={catalogItem.name}>
                                  {catalogItem.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 truncate" title={catalogItem.code}>
                                  {t('ventas:labels.code')} {catalogItem.code || 'N/A'}
                                </p>
                                {catalogItem.item_type === SALE_ITEM_TYPE.COMBO ? (
                                  <Badge className="mt-2 bg-gray-100 text-gray-800 border border-gray-200">
                                    {t('ventas:labels.combo')} ({catalogItem.combo_items?.length || 0} {t('ventas:labels.productsSuffix')})
                                  </Badge>
                                ) : catalogItem.manage_stock === false ? (
                                  <Badge className="mt-2 bg-slate-100 text-slate-700 border border-slate-200">
                                    {t('ventas:labels.noStockControl')}
                                  </Badge>
                                ) : (
                                  <Badge
                                    className={`mt-2 border ${
                                      catalogItem.stock > 10
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : catalogItem.stock > 0
                                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                        : 'bg-red-100 text-red-800 border-red-200'
                                    }`}
                                  >
                                    {t('ventas:labels.stock')} {catalogItem.stock}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-4 flex items-center justify-between gap-2">
                                <p className="text-lg font-bold text-secondary-600">
                                  {fmtPrice(catalogItem.sale_price)}
                                </p>
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                                  <Plus className="w-4 h-4" />
                                </span>
                              </div>
                            </motion.button>
                          ))}
                          {hasMoreFilteredCatalog && (
                            <div className="sm:col-span-2 2xl:col-span-3 mt-1 flex flex-col items-center gap-2">
                              <p className="text-xs text-gray-500">
                                {t('ventas:labels.showing')} {visibleFilteredCatalog.length} {t('ventas:labels.of')} {totalFilteredCatalog}
                              </p>
                              <div ref={filteredCatalogSentinelRef} className="h-2 w-full" aria-hidden="true" />
                              <Button
                                type="button"
                                onClick={loadMoreFilteredCatalog}
                                variant="outline"
                                className="w-full sm:w-auto rounded-xl"
                              >
                                {t('ventas:labels.loadMoreCatalog')}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Panel derecho - Carrito */}
                  <Card className={`rounded-2xl border border-accent-200 bg-white shadow-sm ${saleModalPanel === 'catalog' ? 'hidden xl:block' : ''} xl:sticky xl:top-0 xl:h-fit`}>
                    <CardHeader className="pb-4 border-b border-accent-100">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-xl text-accent-600">{t('labels.cart')}</CardTitle>
                          <p className="text-sm text-gray-500 mt-1">{cart.length} {t('labels.items')}</p>
                        </div>
                        <Badge className="bg-accent-50 text-accent-700 border border-accent-200">
                          {fmtPrice(total)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5">
                      <div className="space-y-4 mb-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {t('ventas:labels.customer')} ({t('ventas:labels.optional')})
                          </label>
                          <select
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#66A5AD] focus:ring-[#66A5AD] transition-all duration-300"
                          >
                            <option value="">{t('form.generalSale', { ns: 'common' })}</option>
                             {customers.map((customer) => (
                               <option key={customer.id} value={customer.id}>
                                 {customer.full_name}
                               </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            {t('labels.paymentMethod')}
                          </label>
                          <PaymentMethodSelect
                            value={paymentMethod}
                            onChange={setPaymentMethod}
                            allowedMethods={config.country.paymentMethods}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4 mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-3">{t('ventas:labels.itemsInCart')}</p>
                        <div className="space-y-2 xl:max-h-[30vh] xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                          {cart.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                              <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                              <p className="font-medium">{t('labels.noItems')}</p>
                              <p className="text-sm mt-1">{t('labels.selectProducts')}</p>
                            </div>
                          ) : (
                            visibleCartItems.map((item) => (
                              <motion.div
                                key={item.item_key}
                                initial={{ opacity: 0, x: -14 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 14 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 rounded-xl shadow-none">
                                  <div className="p-3">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-bold text-accent-600 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{item.code}</p>
                                        {item.item_type === SALE_ITEM_TYPE.COMBO && (
                                          <Badge className="mt-1 bg-gray-100 text-gray-700 border border-gray-200">Combo</Badge>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => removeFromCart(item.item_key)}
                                        className="h-7 w-7 p-0 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg border-none"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                      <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1 w-fit">
                                        <button
                                          type="button"
                                          onClick={() => updateQuantity(item.item_key, item.quantity - 1)}
                                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors"
                                        >
                                          -
                                        </button>
                                        <input
                                          type="number"
                                          value={item.quantity}
                                          onChange={(e) => updateQuantity(item.item_key, parseInt(e.target.value, 10) || 0)}
                                          min="1"
                                          className="w-12 text-center border-none focus:outline-none focus:ring-0 font-bold text-accent-600 bg-transparent"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => updateQuantity(item.item_key, item.quantity + 1)}
                                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors"
                                        >
                                          +
                                        </button>
                                      </div>
                                      <p className="text-lg font-bold text-secondary-600">
                                        {fmtPrice(item.subtotal)}
                                      </p>
                                    </div>
                                    {(() => {
                                      if (item.item_type !== SALE_ITEM_TYPE.PRODUCT || !item.product_id) return false;
                                      if (item.manage_stock === false) return false;
                                      const available = Number.isFinite(item.available_stock) ? item.available_stock : 0;
                                      return typeof available === 'number' && item.quantity > available;
                                    })() && (
                                      <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md">
                                        <div className="flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                                          <p className="text-xs text-red-700">
                                            {t('ventas:labels.available')}: {item.available_stock} - {t('ventas:labels.ordered')}: {item.quantity}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              </motion.div>
                            ))
                          )}
                          {hasMoreCartItems && (
                            <div className="mt-2 flex flex-col items-center gap-2">
                              <p className="text-xs text-gray-500">
                                {t('ventas:labels.showing')} {visibleCartItems.length} {t('ventas:labels.of')} {totalCartItems}
                              </p>
                              <div ref={cartSentinelRef} className="h-2 w-full" aria-hidden="true" />
                              <Button
                                type="button"
                                onClick={loadMoreCartItems}
                                variant="outline"
                                className="w-full rounded-xl"
                              >
                                {t('ventas:labels.loadMoreCart')}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {comboStockShortages.length > 0 && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <p className="text-sm font-semibold text-red-800">{t('ventas:labels.insufficientComboStock')}</p>
                          </div>
                          <div className="space-y-1 text-xs text-red-700">
                            {comboStockShortages.map((item) => (
                              <p key={item.product_id}>
                                {item.product_name}: {t('ventas:labels.available')} {item.available_stock} / {t('ventas:labels.required')} {item.required_quantity}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {simpleStockShortages.length > 0 && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <p className="text-sm font-semibold text-red-800">{t('ventas:labels.insufficientProductStock')}</p>
                          </div>
                          <div className="space-y-1 text-xs text-red-700">
                            {simpleStockShortages.map((item) => (
                              <p key={`simple-shortage-${item.product_id}`}>
                                {item.product_name}: {t('ventas:labels.available')} {item.available_stock} / {t('ventas:labels.required')} {item.required_quantity}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      <Card className="gradient-primary text-white shadow-md rounded-xl border-none mb-3">
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            <span className="text-sm sm:text-base font-semibold">{t('ventas:labels.totalLabel')}</span>
                          </div>
                          <span className="text-2xl sm:text-3xl font-bold">{fmtPrice(total)}</span>
                        </div>
                      </Card>

                      <Button
                        onClick={processSale}
                        disabled={cart.length === 0 || isSubmitting || comboStockShortages.length > 0 || simpleStockShortages.length > 0}
                        className="w-full h-11 sm:h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            {t('ventas:labels.processing')}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            {t('ventas:buttons.completeSale')}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historial de Ventas */}
      {!showSaleModal && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {sales.length === 0 ? (
            <Card className="shadow-xl rounded-2xl bg-white border-none">
              <div className="p-12 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium text-lg mb-2">{t('empty.noSales')}</p>
                <p className="text-gray-400">{t('empty.noSalesDescription')}</p>
              </div>
            </Card>
              ) : (
            <div className="space-y-4">
                {/* Paginación superior */}
                <Pagination
                  currentPage={page}
                  totalItems={totalCount}
                  itemsPerPage={limit}
                  onPageChange={async (newPage) => {
                    setPage(newPage);
                    await loadVentas(currentFilters, {
                      limit,
                      offset: (newPage - 1) * limit,
                      includeCount: false
                    });
                  }}
                  disabled={loading}
                />

                <div className="space-y-4">
              {/* Vista de tarjetas en móvil y desktop */}
              <div className="grid grid-cols-1 gap-4">
                {sales.map((sale, index) => (
                  <motion.div
                    key={sale.id}
                    initial={lowMotionMode ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={lowMotionMode ? { duration: 0 } : { duration: 0.2, delay: index * 0.02 }}
                  >
                    {(() => {
                      const outboxEntry = salesOutboxState.byTempSaleId?.[sale.id] || null;
                      const saleSyncStatus = outboxEntry?.status || (sale?.pending_sync ? 'pending' : 'synced');
                      const saleSyncError = outboxEntry?.last_error || null;

                      return (
                    <Card className="shadow-lg rounded-2xl bg-white border-2 border-accent-100 hover:border-primary-300 hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Información principal */}
                          <div className="flex-1 space-y-3">
                            {/* Fecha y hora */}
                            <div className="flex items-center gap-2 text-accent-600">
                              <Calendar className="w-4 h-4 shrink-0" />
                              <span className="text-sm font-medium">
                                {sale.created_at ? fmtDate(sale.created_at) : t('ventas:labels.dateNotAvailable')}
                              </span>
                            </div>

                            {/* Cliente y Vendedor */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-primary-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-accent-500 uppercase tracking-wide">{t('ventas:labels.customer')}</p>
                                  <p className="text-sm font-semibold text-primary-900 truncate">
                                    {t('form.generalSale', { ns: 'common' })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-accent-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-accent-500 uppercase tracking-wide">{t('ventas:labels.seller')}</p>
                                  <p className="text-sm font-medium text-gray-700 truncate">
                                    {getVendedorName(sale, t)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Método de pago */}
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-accent-600 shrink-0" />
                              <Badge 
                                className={`${
                                  sale.payment_method === 'cash' 
                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                    : sale.payment_method === 'card'
                                    ? 'bg-gray-100 text-gray-800 border-gray-200'
                                    : sale.payment_method === 'transfer'
                                    ? 'bg-gray-100 text-gray-800 border-gray-200'
                                    : 'bg-orange-100 text-orange-800 border-orange-200'
                                } border inline-flex items-center gap-1.5`}
                              >
                                {sale.payment_method === 'cash' && (
                                  <>
                                    <span>💵</span>
                                    <span>{t('ventas:paymentMethods.cash')}</span>
                                  </>
                                )}
                                {sale.payment_method === 'card' && (
                                  <>
                                    <span>💳</span>
                                    <span>{t('ventas:paymentMethods.card')}</span>
                                  </>
                                )}
                                {sale.payment_method === 'transfer' && (
                                  <>
                                    <span>🏦</span>
                                    <span>{t('ventas:paymentMethods.transfer')}</span>
                                  </>
                                )}
                                {sale.payment_method === 'mixed' && (
                                  <>
                                    <span>🔀</span>
                                    <span>{t('ventas:paymentMethods.mixed')}</span>
                                  </>
                                )}
                                {![ 'cash', 'card', 'transfer', 'mixed' ].includes(sale.payment_method) && (
                                  <>
                                    <PaymentMethodBankLogo method={sale.payment_method} sizeClass="h-4" />
                                    <span>{getPaymentMethodLabel(sale.payment_method, t)}</span>
                                  </>
                                )}
                              </Badge>

                              {saleSyncStatus === 'pending' && (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-200">{t('status.pendingSync', { ns: 'common' })}</Badge>
                              )}
                              {saleSyncStatus === 'processing' && (
                                <Badge className="bg-gray-100 text-gray-800 border border-gray-200">{t('status.syncing', { ns: 'common' })}</Badge>
                              )}
                              {saleSyncStatus === 'error' && (
                                <Badge className="bg-red-100 text-red-800 border border-red-200">{t('status.errorSync', { ns: 'common' })}</Badge>
                              )}
                              {saleSyncStatus === 'synced' && (
                                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">{t('status.synced', { ns: 'common' })}</Badge>
                              )}
                            </div>

                            {saleSyncStatus === 'error' && saleSyncError && (
                              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                                {getActionableSyncErrorMessage(saleSyncError, t)}
                              </p>
                            )}

                            {saleSyncStatus === 'error' && (
                              <div className="pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    const retried = retrySalesOutboxEventByTempSaleId(sale.id);
                                    if (!retried) {
                                      setError('⚠️ ' + t('ventas:errors.retryNotFound'));
                                      return;
                                    }
                                    void flushSalesOutbox();
                                  }}
                                >
                                  {t('ventas:details.retrySync')}
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Total y Acciones */}
                          <div className="flex flex-col sm:items-end gap-3 sm:border-l sm:border-accent-200 sm:pl-6">
                            {/* Total */}
                            <div className="text-left sm:text-right">
                              <p className="text-xs text-accent-500 uppercase tracking-wide mb-1">{t('labels.total', { ns: 'common' })}</p>
                              <p className="text-2xl sm:text-3xl font-bold text-primary-900">
                                {fmtPrice(sale.total)}
                              </p>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <Button
                                onClick={async () => {
                                  try {
                                    const saleDetails = await fetchSaleDetails(sale.id);
                                    setSelectedSale({ ...sale, sale_details: saleDetails });
                                  } catch {
                                    setSelectedSale({ ...sale, sale_details: [] });
                                  }
                                  setInvoiceCustomerName('');
                                  setInvoiceCustomerEmail('');
                                  setInvoiceCustomerIdNumber('');
                                  setShowInvoiceModal(true);
                                }}
                                className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                              >
                                <Mail className="w-4 h-4" />
                                <span className="text-sm">{t('ventas:buttons.sendEmail')}</span>
                              </Button>
                              <Button
                                onClick={() => openSaleDetailsModal(sale)}
                                disabled={saleDetailsLoading}
                                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto disabled:opacity-60"
                              >
                                <Eye className="w-4 h-4" />
                                <span className="text-sm">{t('buttons.viewDetails', { ns: 'common' })}</span>
                              </Button>
                              <Button
                                onClick={() => handlePrintInvoice(sale)}
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                              >
                                <Printer className="w-4 h-4" />
                                <span className="text-sm">{t('buttons.print', { ns: 'common' })}</span>
                              </Button>
                              {userRole === 'admin' && !isEmployee && (
                                <Button
                                  onClick={() => handleDeleteSale(sale.id)}
                                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                                  title={t('ventas:buttons.deleteSale')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                      );
                    })()}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          )}
        </motion.div>
      )}

      {/* Modal para generar comprobante de pago desde venta */}
      <AnimatePresence>
        {showInvoiceModal && selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowInvoiceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <Card className="bg-white shadow-2xl rounded-2xl border-none">
                <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{t('ventas:email.title')}</h2>
                      <p className="text-gray-100 mt-1">
                        {t('ventas:email.description', { date: selectedSale?.created_at ? fmtDateOnly(selectedSale.created_at) : t('ventas:labels.dateNotAvailable'), total: fmtPrice(selectedSale.total) })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {t('ventas:email.customerName')} *
                    </label>
                    <Input
                      type="text"
                      value={invoiceCustomerName}
                      onChange={(e) => setInvoiceCustomerName(e.target.value)}
                      placeholder={t('ventas:email.customerNamePlaceholder')}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {t('ventas:email.customerEmail')} *
                    </label>
                    <Input
                      type="email"
                      value={invoiceCustomerEmail}
                      onChange={(e) => setInvoiceCustomerEmail(e.target.value)}
                      placeholder={t('ventas:email.emailPlaceholder')}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('ventas:email.emailHelp')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {t('ventas:email.nitOptional')}
                    </label>
                    <Input
                      type="text"
                      value={invoiceCustomerIdNumber}
                      onChange={(e) => setInvoiceCustomerIdNumber(e.target.value)}
                      placeholder="123456789-0"
                      className="h-11 rounded-xl border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                    />
                  </div>

                  {selectedSale.sale_details && selectedSale.sale_details.length > 0 && (
                    <div className="mt-6">
                      <p className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        {t('ventas:email.products')}
                      </p>
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                              <th className="px-4 py-3 text-center font-semibold text-gray-700">Cant.</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-700">Precio</th>
                              <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSale.sale_details.map((detail, index) => (
                              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-800">{getSaleDetailDisplayName(detail, t)}</td>
                                <td className="px-4 py-3 text-center text-gray-700">{detail.quantity}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{fmtPrice(detail.unit_price)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                  {fmtPrice(detail.quantity * detail.unit_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 shadow-md rounded-xl mt-6">
                    <div className="p-4">
                      <p className="text-sm font-medium text-gray-800 mb-2">{t('ventas:email.summary')}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-gray-900">{t('ventas:labels.totalLabel')}</span>
                        <span className="text-2xl font-bold text-gray-900">{fmtPrice(selectedSale.total)}</span>
                      </div>
                    </div>
                  </Card>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => setShowInvoiceModal(false)}
                      disabled={generatingInvoice}
                      className="flex-1 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                    >
                      {t('buttons.cancel', { ns: 'common' })}
                    </Button>
                    <Button
                      onClick={generateInvoiceFromSale}
                      disabled={generatingInvoice || !invoiceCustomerName || !invoiceCustomerEmail}
                      className="flex-1 h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {generatingInvoice ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          {t('ventas:email.sending')}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          {t('ventas:email.sendReceipt')}
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Nota informativa */}
                  <p className="text-gray-500 text-xs text-center mt-4 italic">
                    {t('ventas:email.disclaimer')}
                  </p>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de detalle de venta */}
      <AnimatePresence>
        {showSaleDetailsModal && selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowSaleDetailsModal(false);
              setSaleDetailsError('');
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <Card className="bg-white shadow-2xl rounded-2xl border-none">
                <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-2xl">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Eye className="w-5 h-5" />
                    {t('ventas:details.title')}
                  </CardTitle>
                  <p className="text-sm text-slate-100">
                    {selectedSale?.created_at ? fmtDate(selectedSale.created_at) : t('ventas:labels.dateNotAvailable')} • {getPaymentMethodLabel(selectedSale?.payment_method, t)}
                  </p>
                </CardHeader>

                <CardContent className="p-6">
                  <div className={`grid grid-cols-1 sm:grid-cols-3 ${showCashPaymentDetails ? 'lg:grid-cols-5' : ''} gap-3 mb-6`}>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 uppercase">{t('ventas:labels.seller')}</p>
                      <p className="font-semibold text-slate-900">{getVendedorName(selectedSale, t)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 uppercase">{t('ventas:details.items')}</p>
                      <p className="font-semibold text-slate-900">{selectedSale?.sale_details?.length || 0}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 uppercase">{t('labels.total', { ns: 'common' })}</p>
                      <p className="font-semibold text-slate-900">{fmtPrice(selectedSale?.total || 0)}</p>
                    </div>
                    {showCashPaymentDetails && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700 uppercase">{t('ventas:details.received')}</p>
                        <p className="font-semibold text-emerald-900">{fmtPrice(selectedSaleAmountReceived)}</p>
                      </div>
                    )}
                    {showCashPaymentDetails && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs text-gray-700 uppercase">{t('ventas:details.change')}</p>
                        <p className="font-semibold text-gray-900">
                          {resolvedChangeAmount !== null ? fmtPrice(resolvedChangeAmount) : t('ventas:details.notRegistered')}
                        </p>
                      </div>
                    )}
                  </div>

                  {showCashPaymentDetails && selectedSaleChangeBreakdown.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
                      <p className="text-xs text-slate-500 uppercase mb-2">{t('ventas:details.breakdown')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedSaleChangeBreakdown.map((entry, idx) => {
                          const denomination = Number(entry?.denomination || 0);
                          const count = Number(entry?.count || 0);
                          if (!Number.isFinite(denomination) || !Number.isFinite(count) || count <= 0) return null;
                          return (
                            <p key={`change-${idx}`} className="text-sm text-slate-700">
                              {count} x {fmtPrice(denomination)}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {saleDetailsLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm">
                      {t('ventas:details.loading')}
                    </div>
                  ) : saleDetailsError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
                      {saleDetailsError}
                    </div>
                  ) : !selectedSale.sale_details || selectedSale.sale_details.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
                      {t('ventas:details.noItems')}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">{t('labels.product', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">{t('labels.code', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-center font-semibold text-slate-700">{t('form.quantity', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">{t('labels.unitPrice', { ns: 'common' })}</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">{t('labels.subtotal', { ns: 'common' })}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSale.sale_details.map((item, idx) => (
                            <tr key={`${selectedSale.id}-${idx}`} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-4 py-3 text-slate-800">{getSaleDetailDisplayName(item, t)}</td>
                              <td className="px-4 py-3 text-slate-600">{item.products?.code || (item.combo_id ? 'COMBO' : '-')}</td>
                              <td className="px-4 py-3 text-center text-slate-700">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-slate-700">{fmtPrice(item.unit_price)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                {fmtPrice(item.subtotal ?? (Number(item.quantity || 0) * Number(item.unit_price || 0)))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-5 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        setShowSaleDetailsModal(false);
                        setSaleDetailsError('');
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl px-5 py-2"
                    >
                      {t('buttons.close', { ns: 'common' })}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación de venta (solo admin) */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl"
            >
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center gap-3 text-white">
                  <Trash2 className="w-6 h-6" />
                  <h3 className="text-xl font-bold">{t('ventas:buttons.deleteSale')}</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-700 font-semibold">
                  ⚠️ {t('alerts.confirmDeleteMessage')}
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>{t('alerts.confirmDeleteWarning')}</strong> {t('alerts.saleDeletedStockReverted')}
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    {t('buttons.cancel')}
                  </button>
                  <button
                    onClick={confirmDeleteSale}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {loading ? t('buttons.loading') : t('buttons.delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </AsyncStateWrapper>
  );
}

export default Ventas;
