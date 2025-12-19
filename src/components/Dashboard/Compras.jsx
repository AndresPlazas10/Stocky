import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice, formatNumber, parseFormattedNumber, formatDate, formatDateOnly } from '../../utils/formatters.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
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

// Función helper para obtener el nombre del responsable
const getResponsableName = (compra) => {
  if (!compra.employees) return 'Responsable desconocido';
  if (compra.employees.role === 'owner' || compra.employees.role === 'admin') return 'Administrador';
  return compra.employees.full_name || 'Responsable desconocido';
};

function Compras({ businessId }) {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
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

  const loadCompras = useCallback(async () => {
    try {
      // Cargar compras y business en paralelo
      const [purchasesResult, businessResult] = await Promise.all([
        supabase
          .from('purchases')
          .select(`
            *,
            supplier:suppliers(business_name, contact_name)
          `)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabase
          .from('businesses')
          .select('created_by')
          .eq('id', businessId)
          .maybeSingle()
      ]);

      const { data: purchasesData, error: purchasesError } = purchasesResult;
      const { data: business } = businessResult;

      if (purchasesError) throw purchasesError;

      // Cargar empleados
      const { data: employeesData } = await supabase
        .from('employees')
        .select('user_id, full_name, role')
        .eq('business_id', businessId);

      // Crear mapa de empleados
      const employeeMap = new Map();
      employeesData?.forEach(emp => {
        employeeMap.set(emp.user_id, {
          full_name: emp.full_name || 'Usuario',
          role: emp.role
        });
      });

      // Combinar datos con información del empleado
      const purchasesWithEmployees = purchasesData?.map(purchase => {
        const employee = employeeMap.get(purchase.user_id);
        // Comparación estricta con trim por si acaso
        const userId = String(purchase.user_id || '').trim();
        const createdBy = String(business?.created_by || '').trim();
        const isOwner = userId === createdBy;
        const isAdmin = employee?.role === 'admin';
        
        return {
          ...purchase,
          employees: isOwner
            ? { full_name: 'Administrador', role: 'owner' }
            : isAdmin
            ? { full_name: 'Administrador', role: 'admin' }
            : employee || { full_name: 'Responsable desconocido', role: 'employee' }
        };
      }) || [];
      
      setCompras(purchasesWithEmployees);
    } catch (error) {
      setError('❌ Error al cargar las compras');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const loadProductos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true);

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      // Error silencioso
    }
  }, [businessId]);

  const loadProveedores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessId);

      if (error) throw error;
      setProveedores(data || []);
    } catch (error) {
      // Error silencioso
    }
  }, [businessId]);

  // Verificar permisos de admin
  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !businessId) return;

        const [businessResult, employeeResult] = await Promise.all([
          supabase
            .from('businesses')
            .select('created_by')
            .eq('id', businessId)
            .maybeSingle(),
          supabase
            .from('employees')
            .select('role')
            .eq('business_id', businessId)
            .eq('user_id', user.id)
            .maybeSingle()
        ]);

        const isOwner = user.id === businessResult.data?.created_by;
        const isAdminRole = employeeResult.data?.role === 'admin';
        
        setIsAdmin(isOwner || isAdminRole);
      } catch (error) {
        console.error('Error checking admin role:', error);
      }
    };

    checkAdminRole();
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadCompras();
      loadProductos();
      loadProveedores();
    }
  }, [businessId, loadCompras, loadProductos, loadProveedores]);

  // 🔥 TIEMPO REAL: Suscripción a cambios en compras
  useRealtimeSubscription('purchases', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: async (newPurchase) => {
      // Cargar datos del proveedor, business y empleados
      const [supplierResult, businessResult, employeesResult] = await Promise.all([
        supabase
          .from('suppliers')
          .select('business_name, contact_name')
          .eq('id', newPurchase.supplier_id)
          .single(),
        supabase
          .from('businesses')
          .select('created_by')
          .eq('id', businessId)
          .single(),
        supabase
          .from('employees')
          .select('user_id, full_name, role')
          .eq('business_id', businessId)
      ]);

      const { data: supplier } = supplierResult;
      const { data: business } = businessResult;
      const { data: employeesData } = employeesResult;

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
        unit_price: producto.purchase_price || 0
      }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    setCart(prevCart => prevCart.map(item =>
      item.product_id === productId
        ? { ...item, quantity: parseInt(newQuantity) || 0 }
        : item
    ));
  }, []);

  const updatePrice = useCallback((productId, newPrice) => {
    setCart(prevCart => prevCart.map(item =>
      item.product_id === productId
        ? { ...item, unit_price: parseFloat(newPrice) || 0 }
        : item
    ));
  }, []);

  // Memoizar cálculo de total
  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
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
      if (!total || total <= 0) throw new Error('El total de la compra debe ser mayor a 0');

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');

      // Insertar compra
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert([{
          business_id: businessId,
          user_id: user.id,
          supplier_id: supplierId,
          payment_method: paymentMethod,
          notes: notes || null,
          total: total,
          created_at: new Date().toISOString()
        }])
        .select()
        .maybeSingle();

      if (purchaseError) throw purchaseError;

      // Insertar detalles
      const purchaseDetails = cart.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_price,
        subtotal: item.quantity * item.unit_price
      }));

      const { error: detailsError } = await supabase
        .from('purchase_details')
        .insert(purchaseDetails);

      if (detailsError) {
        // Intentar rollback manual
        await supabase.from('purchases').delete().eq('id', purchase.id);
        throw detailsError;
      }

      // Actualizar stock
      for (const item of cart) {
        const producto = productos.find(p => p.id === item.product_id);
        const newStock = (producto.stock || 0) + item.quantity;
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.product_id);
        if (updateError) throw updateError;
      }

      setSuccess('✅ Compra registrada exitosamente');
      resetForm();
      setShowModal(false);
      loadCompras();
      loadProductos();
      
    } catch (err) {
      console.error('Error al registrar compra:', err);
      setError('❌ Error al registrar la compra: ' + err.message);
    } finally {
      setIsCreatingPurchase(false);
    }
  }, [isCreatingPurchase, supplierId, cart, total, businessId, paymentMethod, notes, productos, loadCompras, loadProductos]);

  const resetForm = () => {
    setSupplierId('');
    setPaymentMethod('efectivo');
    setNotes('');
    setCart([]);
  };

  const viewDetails = useCallback(async (purchase) => {
    setSelectedPurchase(purchase);
    try {
      const { data, error } = await supabase
        .from('purchase_details')
        .select(`
          *,
          product:products(name, code, purchase_price)
        `)
        .eq('purchase_id', purchase.id);

      if (error) throw error;
      setSelectedPurchase({ ...purchase, details: data });
      setShowDetailsModal(true);
    } catch (error) {
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
      // Obtener detalles de la compra para revertir el stock
      const { data: purchaseDetails, error: detailsError } = await supabase
        .from('purchase_details')
        .select('product_id, quantity')
        .eq('purchase_id', purchaseToDelete);

      if (detailsError) throw new Error('Error al obtener detalles: ' + detailsError.message);

      // Revertir el stock de cada producto
      for (const detail of purchaseDetails) {
        // Obtener el stock actual de la base de datos
        const { data: producto, error: getError } = await supabase
          .from('products')
          .select('stock')
          .eq('id', detail.product_id)
          .single();

        if (getError) throw new Error('Error al obtener producto: ' + getError.message);
        
        if (producto) {
          // Restar la cantidad que se había agregado en la compra
          const newStock = Math.max(0, (producto.stock || 0) - detail.quantity);
          const { error: updateError } = await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', detail.product_id);
          
          if (updateError) throw new Error('Error al revertir stock: ' + updateError.message);
        }
      }

      // Eliminar detalles de compra
      const { error: deleteDetailsError } = await supabase
        .from('purchase_details')
        .delete()
        .eq('purchase_id', purchaseToDelete);

      if (deleteDetailsError) throw new Error('Error al eliminar detalles: ' + deleteDetailsError.message);

      // Eliminar la compra
      const { error: deleteError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseToDelete);

      if (deleteError) throw new Error('Error al eliminar compra: ' + deleteError.message);

      setSuccess('✅ Compra eliminada exitosamente y stock revertido');
      setTimeout(() => setSuccess(''), 4000);

      // Recargar datos
      await loadCompras();
      await loadProductos();

      setShowDeleteModal(false);
      setPurchaseToDelete(null);

    } catch (error) {
      console.error('Error al eliminar compra:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#edb886] mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando compras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary to-white p-6">
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

      {/* Mensajes */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
                        {compra.payment_method}
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
        )}
      </motion.div>

      {/* Modal Nueva Compra */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto"
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

              <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 focus:border-[#edb886] focus:ring-1 focus:ring-[#edb886] outline-none"
                  >
                    <option value="">Seleccionar producto...</option>
                    {productos.map(producto => (
                      <option key={producto.id} value={producto.id}>
                        {producto.name} - {formatPrice(producto.purchase_price)}
                      </option>
                    ))}
                  </select>
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
                        <div key={item.product_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{item.product_name}</p>
                          </div>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                            className="w-20 h-9 text-center border-gray-300"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updatePrice(item.product_id, e.target.value)}
                            className="w-28 h-9 border-gray-300"
                          />
                          <span className="w-24 text-right font-semibold text-gray-700">
                            {formatPrice(item.quantity * item.unit_price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product_id)}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl border-none"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={cart.length === 0 || isCreatingPurchase}
                    className="flex-1 h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed border-none"
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
                      {selectedPurchase.payment_method}
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
  );
}

export default Compras;
