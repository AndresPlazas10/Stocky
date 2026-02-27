import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PurchaseFilters from '../Filters/PurchaseFilters';
import { getFilteredPurchases } from '../../services/purchasesService';
import {
  createPurchaseWithRpcFallback,
  deletePurchaseWithStockFallback
} from '../../data/commands/purchasesCommands.js';
import {
  getEmployeeRoleByBusinessAndUser,
  getEmployeesByBusiness,
  getProductsForPurchase,
  getPurchaseDetailsWithProductByPurchaseId,
  getSupplierById,
  getSuppliersForBusiness
} from '../../data/queries/purchasesQueries.js';
import {
  getAuthenticatedUser,
  getBusinessOwnerById
} from '../../data/queries/authQueries.js';
import { formatPrice, formatDateOnly } from '../../utils/formatters.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { SaleUpdateAlert } from '../ui/SaleUpdateAlert';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import Pagination from '../Pagination';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Eye,
  Package,
  DollarSign,
  Calendar,
  Building2,
  X,
  CheckCircle2,
  AlertCircle,
  Search
} from 'lucide-react';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { isOfflineMode, readOfflineSnapshot, saveOfflineSnapshot } from '../../utils/offlineSnapshot.js';

const _motionLintUsage = motion;

const getPaymentMethodLabel = (method) => {
  const value = String(method || '').toLowerCase();
  if (value === 'cash') return 'Efectivo';
  if (value === 'card') return 'Tarjeta';
  if (value === 'transfer') return 'Transferencia';
  if (value === 'mixed') return 'Mixto';
  return method || '-';
};

const isConnectivityError = (errorLike) => {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('load failed')
    || message.includes('network')
    || message.includes('sin conexión')
    || message.includes('sin conexion')
  );
};

const formatLoadError = (resourceLabel, errorLike) => {
  if (isConnectivityError(errorLike)) {
    return `⚠️ Sin conexión. No se pudieron cargar ${resourceLabel}. Verifica tu internet y reintenta.`;
  }
  return `❌ Error al cargar ${resourceLabel}: ${errorLike?.message || 'Error desconocido'}`;
};


function Compras({ businessId }) {
  const [compras, setCompras] = useState([]);
  const [pagePurchases, setPagePurchases] = useState(1);
  const [limitPurchases] = useState(50);
  const [totalCountPurchases, setTotalCountPurchases] = useState(0);
  const [currentFiltersPurchases, setCurrentFiltersPurchases] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState([]);
  const [isCreatingPurchase, setIsCreatingPurchase] = useState(false);
  
  // Estados para eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadCompras = useCallback(async (filters = currentFiltersPurchases, pagination = {}) => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `compras.list:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setCompras(offlineSnapshot);
      setTotalCountPurchases(offlineSnapshot.length);
    }

    try {
      setLoading(true);
      const lim = Number(pagination.limit ?? limitPurchases);
      const off = Number(pagination.offset ?? ((pagePurchases - 1) * lim));
      const includeCount = typeof pagination.includeCount === 'boolean'
        ? pagination.includeCount
        : off === 0;
      const countMode = pagination.countMode || 'planned';
      const { data: purchasesData, count, error: purchasesError } = await getFilteredPurchases(businessId, filters, {
        limit: lim,
        offset: off,
        includeCount,
        countMode
      });
      if (purchasesError) {
        throw new Error(purchasesError);
      }

      if (!purchasesData || purchasesData.length === 0) {
        if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
          setCompras(offlineSnapshot);
          setTotalCountPurchases(offlineSnapshot.length);
          return;
        }
        setCompras([]);
        if (typeof count === 'number') {
          setTotalCountPurchases(count);
        } else if (!includeCount) {
          setTotalCountPurchases(off);
        }
        return;
      }

      const alreadyEnriched = Array.isArray(purchasesData) && purchasesData.length > 0
        && !!purchasesData[0].supplier
        && !!purchasesData[0].employees;

      if (alreadyEnriched) {
        setCompras(purchasesData);
        if (!offline || purchasesData.length > 0) {
          saveOfflineSnapshot(offlineSnapshotKey, purchasesData);
        }
        if (typeof count === 'number') {
          setTotalCountPurchases(count);
        } else if (!includeCount) {
          setTotalCountPurchases(off + purchasesData.length);
        }
        return;
      }

      // Obtener business y datos relacionados
      const [business, employeesData, suppliersData] = await Promise.all([
        getBusinessOwnerById(businessId),
        getEmployeesByBusiness(businessId),
        getSuppliersForBusiness(businessId)
      ]);

      const employeeMap = new Map();
      employeesData.forEach(emp => employeeMap.set(emp.user_id, { full_name: emp.full_name || 'Usuario', role: emp.role }));

      const supplierMap = new Map();
      suppliersData.forEach(s => supplierMap.set(s.id, s));

      const purchasesWithEmployees = (purchasesData || []).map(purchase => {
        const employee = employeeMap.get(purchase.user_id);
        const supplier = supplierMap.get(purchase.supplier_id) || purchase.supplier || null;
        const userId = String(purchase.user_id || '').trim();
        const createdBy = String(business?.created_by || '').trim();
        const isOwner = userId === createdBy;
        const isAdmin = employee?.role === 'admin';

        return {
          ...purchase,
          supplier,
          employees: isOwner ? { full_name: 'Administrador', role: 'owner' } : isAdmin ? { full_name: 'Administrador', role: 'admin' } : employee || { full_name: 'Responsable desconocido', role: 'employee' }
        };
      });

      setCompras(purchasesWithEmployees);
      if (!offline || purchasesWithEmployees.length > 0) {
        saveOfflineSnapshot(offlineSnapshotKey, purchasesWithEmployees);
      }
      if (typeof count === 'number') {
        setTotalCountPurchases(count);
      } else if (!includeCount) {
        setTotalCountPurchases(off + purchasesWithEmployees.length);
      }
    } catch (error) {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        const safe = Array.isArray(cached) ? cached : [];
        setCompras(safe);
        setTotalCountPurchases(safe.length);
      } else {
        setError(formatLoadError('las compras', error));
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, pagePurchases, limitPurchases, currentFiltersPurchases]);

  const loadProductos = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `compras.productos:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setProductos(offlineSnapshot);
    }

    try {
      const data = await getProductsForPurchase(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setProductos(offlineSnapshot);
        return;
      }

      setProductos(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setProductos(Array.isArray(cached) ? cached : []);
      }
    }
  }, [businessId]);

  const loadProveedores = useCallback(async () => {
    const offline = isOfflineMode();
    const offlineSnapshotKey = `compras.proveedores:${businessId}`;
    const offlineSnapshot = readOfflineSnapshot(offlineSnapshotKey, []);

    if (offline && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
      setProveedores(offlineSnapshot);
    }

    try {
      setLoadingSuppliers(true);
      const data = await getSuppliersForBusiness(businessId);
      const normalizedData = Array.isArray(data) ? data : [];
      const hasLocalData = normalizedData.length > 0;

      if (offline && !hasLocalData && Array.isArray(offlineSnapshot) && offlineSnapshot.length > 0) {
        setProveedores(offlineSnapshot);
        return;
      }

      setProveedores(normalizedData);
      if (!offline || hasLocalData) {
        saveOfflineSnapshot(offlineSnapshotKey, normalizedData);
      }
    } catch (error) {
      if (offline) {
        const cached = readOfflineSnapshot(offlineSnapshotKey, []);
        setProveedores(Array.isArray(cached) ? cached : []);
      } else {
        setProveedores([]);
        setError(formatLoadError('proveedores', error));
      }
    } finally {
      setLoadingSuppliers(false);
    }
  }, [businessId]);

  // Verificar permisos de admin
  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const user = await getAuthenticatedUser();
        if (!user || !businessId) return;

        const [business, employeeRole] = await Promise.all([
          getBusinessOwnerById(businessId),
          getEmployeeRoleByBusinessAndUser({
            businessId,
            userId: user.id
          })
        ]);

        const isOwner = user.id === business?.created_by;
        const isAdminRole = employeeRole === 'admin';
        
        setIsAdmin(isOwner || isAdminRole);
      } catch {
        // no-op
      }
    };

    checkAdminRole();
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadCompras(currentFiltersPurchases, { limit: limitPurchases, offset: (pagePurchases - 1) * limitPurchases });
      loadProductos();
      loadProveedores();
    }
  }, [
    businessId,
    currentFiltersPurchases,
    limitPurchases,
    pagePurchases,
    loadCompras,
    loadProductos,
    loadProveedores
  ]);

  // 🔥 TIEMPO REAL: Suscripción a cambios en compras
  useRealtimeSubscription('purchases', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: async (newPurchase) => {
      // Cargar datos del proveedor, business y empleados
      const [supplier, business, employeesData] = await Promise.all([
        getSupplierById(newPurchase.supplier_id),
        getBusinessOwnerById(businessId),
        getEmployeesByBusiness(businessId)
      ]);

      // Crear mapa de empleados
      const employeeMap = new Map();
      employeesData?.forEach(emp => {
        employeeMap.set(emp.user_id, { full_name: emp.full_name || 'Usuario', role: emp.role });
      });

      const employee = employeeMap.get(newPurchase.user_id);
      const isOwner = newPurchase.user_id === business?.created_by;
      const isAdmin = employee?.role === 'admin';
      
      const purchaseWithDetails = {
        ...newPurchase,
        supplier,
        employees: isOwner
          ? { full_name: 'Administrador', role: 'owner' }
          : isAdmin
          ? { full_name: 'Administrador', role: 'admin' }
          : employee || { full_name: 'Responsable desconocido', role: 'employee' }
      };
      
      // Verificar si la compra ya existe antes de agregarla
      setCompras(prev => {
        const exists = prev.some(c => c.id === newPurchase.id);
        if (exists) {
          return prev;
        }
        return [purchaseWithDetails, ...prev];
      });
      
      setSuccess('✨ Nueva compra registrada');
      setTimeout(() => setSuccess(''), 3000);
    },
    onUpdate: (updatedPurchase) => {
      setCompras(prev => prev.map(c => c.id === updatedPurchase.id ? { ...c, ...updatedPurchase } : c));
    },
    onDelete: (deletedPurchase) => {
      setCompras(prev => prev.filter(c => c.id !== deletedPurchase.id));
    }
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en productos (para stock)
  useRealtimeSubscription('products', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onUpdate: (updatedProduct) => {
      setProductos(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    },
    onInsert: (newProduct) => {
      setProductos(prev => {
        const exists = prev.some(p => p.id === newProduct.id);
        if (exists) {
          return prev;
        }
        return [newProduct, ...prev];
      });
    }
  });

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const addToCart = useCallback((producto) => {
    if (producto?.manage_stock === false) {
      setError('❌ Este producto no maneja stock y no puede registrarse en compras.');
      return;
    }

    setCart(prevCart => {
      const existing = prevCart.find(item => item.product_id === producto.id);
      
      if (existing) {
        return prevCart.map(item =>
          item.product_id === producto.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      return [...prevCart, {
        product_id: producto.id,
        product_name: producto.name,
        quantity: 1,
        unit_price: producto.purchase_price || 0,
        manage_stock: producto.manage_stock !== false
      }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    setCart(prevCart => prevCart.map(item =>
      item.product_id !== productId
        ? item
        : (() => {
          const rawValue = String(newQuantity ?? '').trim();
          if (rawValue === '') {
            return { ...item, quantity: '' };
          }
          const parsedValue = Number(rawValue);
          if (!Number.isFinite(parsedValue)) return item;
          return { ...item, quantity: parsedValue };
        })()
    ));
  }, []);

  const updatePrice = useCallback((productId, newPrice) => {
    setCart(prevCart => prevCart.map(item =>
      item.product_id !== productId
        ? item
        : (() => {
          const rawValue = String(newPrice ?? '').trim();
          if (rawValue === '') {
            return { ...item, unit_price: '' };
          }
          const parsedValue = Number(rawValue);
          if (!Number.isFinite(parsedValue)) return item;
          return { ...item, unit_price: parsedValue };
        })()
    ));
  }, []);

  // Memoizar cálculo de total
  const total = useMemo(() => {
    return cart.reduce((sum, item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
      return sum + (safeQuantity * safeUnitPrice);
    }, 0);
  }, [cart]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Prevenir múltiples clicks
    if (isCreatingPurchase) return;
    
    setIsCreatingPurchase(true);
    setError('');
    setSuccess('');
    
    try {
      if (!supplierId) throw new Error('Selecciona un proveedor');
      if (cart.length === 0) throw new Error('Agrega al menos un producto a la compra');
      if (cart.some((item) => item?.manage_stock === false)) {
        throw new Error('Hay productos sin control de stock en el carrito. Retíralos para continuar.');
      }
      if (cart.some((item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        return (
          !Number.isFinite(quantity)
          || quantity <= 0
          || !Number.isFinite(unitPrice)
          || unitPrice < 0
        );
      })) {
        throw new Error('Hay productos con cantidad o precio inválido.');
      }
      if (!total || total <= 0) throw new Error('El total de la compra debe ser mayor a 0');

      const user = await getAuthenticatedUser();
      if (!user) throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');

      const result = await createPurchaseWithRpcFallback({
        businessId,
        userId: user.id,
        supplierId,
        paymentMethod,
        notes,
        total,
        cart: cart.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price)
        }))
      });

      setSuccess('✅ Compra registrada exitosamente');
      resetForm();
      setShowModal(false);
      void result;
      loadCompras(currentFiltersPurchases, { limit: limitPurchases, offset: (pagePurchases - 1) * limitPurchases });
      loadProductos();
      
    } catch (err) {
      setError('❌ Error al registrar la compra: ' + err.message);
    } finally {
      setIsCreatingPurchase(false);
    }
  }, [
    isCreatingPurchase,
    supplierId,
    cart,
    total,
    businessId,
    paymentMethod,
    notes,
    currentFiltersPurchases,
    limitPurchases,
    pagePurchases,
    loadCompras,
    loadProductos
  ]);

  const resetForm = () => {
    setSupplierId('');
    setPaymentMethod('efectivo');
    setNotes('');
    setCart([]);
  };

  const viewDetails = useCallback(async (purchase) => {
    setSelectedPurchase(purchase);
    try {
      const data = await getPurchaseDetailsWithProductByPurchaseId(purchase.id);
      setSelectedPurchase({ ...purchase, details: data });
      setShowDetailsModal(true);
    } catch {
      setError('❌ Error al cargar los detalles de la compra');
    }
  }, []);

  // Funciones de eliminación de compra (solo admin)
  const handleDeletePurchase = (purchaseId) => {
    setPurchaseToDelete(purchaseId);
    setShowDeleteModal(true);
  };

  const confirmDeletePurchase = async () => {
    if (!purchaseToDelete) return;

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const { appliedManualFallback } = await deletePurchaseWithStockFallback({
        purchaseId: purchaseToDelete,
        businessId
      });

      setSuccess(
        appliedManualFallback
          ? '✅ Compra eliminada y stock ajustado manualmente'
          : '✅ Compra eliminada exitosamente y stock revertido'
      );
      setTimeout(() => setSuccess(''), 4000);

      // Recargar datos
      await loadCompras(currentFiltersPurchases, { limit: limitPurchases, offset: (pagePurchases - 1) * limitPurchases });
      await loadProductos();

      setShowDeleteModal(false);
      setPurchaseToDelete(null);

    } catch (error) {
      setError('❌ ' + (error.message || 'Error al eliminar la compra'));
      setTimeout(() => setError(''), 8000);
      setShowDeleteModal(false);
      setPurchaseToDelete(null);
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPurchaseToDelete(null);
  };

  // Memoizar compras filtradas
  const filteredCompras = useMemo(() => {
    if (!searchTerm.trim()) return compras;
    
    const search = searchTerm.toLowerCase();
    return compras.filter(compra =>
      compra.supplier?.business_name?.toLowerCase().includes(search) ||
      compra.supplier?.contact_name?.toLowerCase().includes(search) ||
      compra.payment_method?.toLowerCase().includes(search)
    );
  }, [compras, searchTerm]);

  const hasSuppliers = proveedores.length > 0;
  return (
    <AsyncStateWrapper
      loading={loading}
      error={filteredCompras.length === 0 ? error : null}
      dataCount={filteredCompras.length}
      onRetry={() => loadCompras(currentFiltersPurchases, { limit: limitPurchases, offset: (pagePurchases - 1) * limitPurchases })}
      skeletonType="compras"
      hasFilters={Boolean(searchTerm.trim() || Object.keys(currentFiltersPurchases || {}).length > 0)}
      noResultsTitle="No hay compras para esos filtros"
      noResultsDescription="Ajusta los filtros o registra una nueva compra."
      noResultsAction={
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setCurrentFiltersPurchases({});
              setPagePurchases(1);
              loadCompras({}, { limit: limitPurchases, offset: 0, includeCount: false });
            }}
            className="bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-100 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            Limpiar Filtros
          </Button>
          <Button
            type="button"
            onClick={() => setShowModal(true)}
            className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
          >
            Nueva Compra
          </Button>
        </div>
      }
      emptyTitle="No hay compras registradas"
      emptyDescription="Crea la primer compra para poder visualizarlas."
      emptyAction={
        <Button
          type="button"
          onClick={() => setShowModal(true)}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          Crear Primera Compra
        </Button>
      }
      bypassStateRendering={showModal}
      actionProcessing={isCreatingPurchase}
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
                <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Compras</h1>
                <p className="text-white/80 mt-1 text-sm sm:text-base">Gestión de compras a proveedores</p>
              </div>
            </div>
            <Button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Nueva Compra</span>
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Alertas mejoradas */}
      <SaleErrorAlert 
        isVisible={!!error}
        onClose={() => setError('')}
        title="Error"
        message={error}
        duration={5000}
      />

      <SaleUpdateAlert
        isVisible={isCreatingPurchase}
        onClose={() => {}}
        title="Generando compra..."
        details={[]}
        duration={600000}
      />

      <SaleSuccessAlert 
        isVisible={!!success}
        onClose={() => setSuccess('')}
        title="✨ Compra Registrada"
        details={[{ label: 'Acción', value: success }]}
        duration={5000}
      />

        {/* Filtros */}
        <PurchaseFilters
          businessId={businessId}
          onApply={(filters) => {
            setCurrentFiltersPurchases(filters || {});
            setPagePurchases(1);
            loadCompras(filters || {}, { limit: limitPurchases, offset: 0, includeCount: false });
          }}
          onClear={() => {
            setCurrentFiltersPurchases({});
            setPagePurchases(1);
            loadCompras({}, { limit: limitPurchases, offset: 0, includeCount: false });
          }}
        />

        {/* Buscador */}
      <Card className="mb-6 p-4 shadow-lg rounded-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por proveedor o monto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 rounded-xl border-gray-300 focus:border-[#edb886] focus:ring-[#edb886]"
          />
        </div>
      </Card>

      {/* Lista de Compras */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {filteredCompras.length === 0 ? (
          <Card className="shadow-xl rounded-2xl bg-white border-none">
            <div className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 font-medium text-lg mb-2">No hay compras registradas</p>
              <p className="text-gray-400">Haz clic en "Nueva Compra" para comenzar</p>
            </div>
          </Card>
          ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCompras.map((compra, index) => (
              <motion.div
                key={compra.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="shadow-lg rounded-2xl bg-white border-none hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="gradient-primary text-white p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">
                            {compra.supplier?.business_name || compra.supplier?.contact_name || 'Sin proveedor'}
                          </p>
                          <p className="text-white/80 text-sm flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDateOnly(compra.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Total
                      </span>
                      <span className="text-lg font-bold text-green-600">
                        {formatPrice(compra.total)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Método de pago</span>
                      <Badge className="bg-blue-100 text-blue-800 capitalize">
                        {getPaymentMethodLabel(compra.payment_method)}
                      </Badge>
                    </div>

                    {compra.notes && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 italic">"{compra.notes}"</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => viewDetails(compra)}
                        className="flex-1 h-10 gradient-primary text-white hover:shadow-lg transition-all duration-300 rounded-xl flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalles
                      </Button>
                      {isAdmin && (
                        <Button
                          onClick={() => handleDeletePurchase(compra.id)}
                          className="h-10 px-3 bg-red-500 hover:bg-red-600 text-white transition-all duration-300 rounded-xl"
                          title="Eliminar compra"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Paginación inferior */}
          <Pagination
            currentPage={pagePurchases}
            totalItems={totalCountPurchases}
            itemsPerPage={limitPurchases}
            onPageChange={async (newPage) => {
              setPagePurchases(newPage);
              await loadCompras(currentFiltersPurchases, {
                limit: limitPurchases,
                offset: (newPage - 1) * limitPurchases,
                includeCount: false
              });
            }}
            disabled={loading}
          />
          </>
        )}
      </motion.div>

      {/* Modal Nueva Compra */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
            style={{ zIndex: 9999 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-hidden my-1 sm:my-0"
            >
              <div className="sticky top-0 gradient-primary text-white p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold">Nueva Compra</h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {!hasSuppliers && !loadingSuppliers ? (
                <div className="p-4 sm:p-6">
                  <Card className="border-dashed border-gray-300 bg-gray-50 shadow-none">
                    <div className="p-8 text-center">
                      <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-lg font-semibold text-gray-700 mb-2">No hay proveedores registrados</p>
                      <p className="text-sm text-gray-500 mb-5">No es posible registrar compras hasta que exista al menos un proveedor.</p>
                      <Button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
                      >
                        Entendido
                      </Button>
                    </div>
                  </Card>
                </div>
              ) : loadingSuppliers ? (
                <div className="p-4 sm:p-6">
                  <Card className="border-dashed border-gray-300 bg-gray-50 shadow-none">
                    <div className="p-8 text-center">
                      <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400 animate-pulse" />
                      <p className="text-lg font-semibold text-gray-700 mb-2">Cargando proveedores...</p>
                    </div>
                  </Card>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[calc(92vh-86px)] overflow-y-auto">
                {/* Proveedor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Proveedor *
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 focus:border-[#edb886] focus:ring-1 focus:ring-[#edb886] outline-none"
                  >
                    <option value="">Seleccionar proveedor</option>
                    {proveedores.map(proveedor => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.business_name || proveedor.contact_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Método de pago */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Método de pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 focus:border-[#edb886] focus:ring-1 focus:ring-[#edb886] outline-none"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>

                {/* Agregar productos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Agregar producto
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const producto = productos.find(p => p.id === e.target.value);
                        if (producto) {
                          addToCart(producto);
                        }
                        e.target.value = '';
                      }
                    }}
                    disabled={!supplierId}
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 focus:border-[#edb886] focus:ring-1 focus:ring-[#edb886] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!supplierId ? 'Primero selecciona un proveedor...' : 'Seleccionar producto...'}
                    </option>
                    {productos
                      .filter(producto => (!supplierId || producto.supplier_id === supplierId))
                      .map(producto => (
                        <option
                          key={producto.id}
                          value={producto.id}
                          disabled={producto.manage_stock === false}
                        >
                          {producto.name} - {formatPrice(producto.purchase_price)}
                          {producto.manage_stock === false ? ' (Sin control de stock)' : ''}
                        </option>
                      ))
                    }
                  </select>
                  {supplierId && productos.filter(p => p.supplier_id === supplierId).length === 0 && (
                    <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Este proveedor no tiene productos asignados. Puedes asignar productos en Inventario.
                    </p>
                  )}
                </div>

                {/* Carrito */}
                {cart.length > 0 && (
                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5" />
                      Productos ({cart.length})
                    </h4>
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div key={item.product_id} className="p-3 bg-gray-50 rounded-xl space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 break-words">{item.product_name}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product_id)}
                              className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors shrink-0"
                              aria-label="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-[88px_120px_1fr] gap-2 sm:gap-3 items-center">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity === '' ? '' : item.quantity}
                              onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                              className="w-full h-10 text-center border-gray-300"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price === '' ? '' : item.unit_price}
                              onChange={(e) => updatePrice(item.product_id, e.target.value)}
                              className="w-full h-10 border-gray-300"
                            />
                            <span className="text-left sm:text-right font-semibold text-gray-700">
                              {formatPrice((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-700">Total:</span>
                      <span className="text-2xl font-bold text-green-600">{formatPrice(total)}</span>
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-[#edb886] focus:ring-1 focus:ring-[#edb886] outline-none"
                    placeholder="Observaciones adicionales..."
                  />
                </div>

                {/* Botones */}
                <div className="sticky bottom-0 bg-white flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 border-t border-gray-200">
                  <Button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="order-2 sm:order-1 w-full sm:flex-1 h-10 sm:h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl border-none"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={cart.length === 0 || isCreatingPurchase}
                    className="order-1 sm:order-2 w-full sm:flex-1 h-10 sm:h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed border-none"
                  >
                    {isCreatingPurchase ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Registrar Compra
                      </>
                    )}
                  </Button>
                </div>
              </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detalles */}
      <AnimatePresence>
        {showDetailsModal && selectedPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 gradient-primary text-white p-6 rounded-t-2xl flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Detalles de Compra</h3>
                    <p className="text-white/80 text-sm">
                      {formatDateOnly(selectedPurchase.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Información general */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Proveedor</p>
                    <p className="font-semibold text-gray-800">
                      {selectedPurchase.supplier?.business_name || selectedPurchase.supplier?.contact_name}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Método de pago</p>
                    <p className="font-semibold text-gray-800 capitalize">
                      {getPaymentMethodLabel(selectedPurchase.payment_method)}
                    </p>
                  </div>
                </div>

                {/* Productos */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Productos
                  </h4>
                  <div className="space-y-2">
                    {selectedPurchase.details?.map(detail => (
                      <div key={detail.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-800">{detail.product?.name}</p>
                          <p className="text-sm text-gray-600">
                            {detail.quantity} x {formatPrice(detail.product?.purchase_price || 0)}
                          </p>
                        </div>
                        <span className="font-semibold text-gray-700">
                          {formatPrice(detail.quantity * (detail.product?.purchase_price || 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-semibold text-gray-700">Total:</span>
                    <span className="text-3xl font-bold text-green-600">
                      {formatPrice(selectedPurchase.total)}
                    </span>
                  </div>
                </div>

                {selectedPurchase.notes && (
                  <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-blue-800 mb-1">Notas</p>
                    <p className="text-blue-700">{selectedPurchase.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmación de Eliminación */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 10000 }}
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Eliminar Compra</h3>
                  <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Importante:</strong> Al eliminar esta compra, el stock de los productos se revertirá automáticamente.
                </p>
              </div>

              <p className="text-gray-700 mb-6">
                ¿Estás seguro de que deseas eliminar esta compra? El inventario se ajustará restando las cantidades compradas.
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={cancelDelete}
                  className="flex-1 h-11 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmDeletePurchase}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </AsyncStateWrapper>
  );
}

export default Compras;
