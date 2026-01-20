/**
 * 🛒 COMPONENTE DE VENTAS - VERSIÓN OPTIMIZADA Y ROBUSTA
 * 
 * Características:
 * - Manejo centralizado de estado
 * - Servicio de ventas separado
 * - Validación exhaustiva
 * - Sin dependencias de tablas inexistentes
 * - Manejo de errores robusto
 * - Genera comprobantes informativos (NO válidos ante DIAN)
 * - Para facturación oficial: usar Siigo directamente
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice, formatNumber, formatDate } from '../../utils/formatters.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Receipt, 
  Search,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  FileText
} from 'lucide-react';

// Importar componentes legales
import PrimeraVentaModal from '../Modals/PrimeraVentaModal';
import ComprobanteDisclaimer from '../Legal/ComprobanteDisclaimer';

// Importar servicios
import {
  getSales,
  createSale,
  getAvailableProducts,
  deleteSale,
  getCurrentUser
} from '../../services/salesService';

// Importar componentes de facturación
import { InvoicingProvider, useInvoicing } from '../../context/InvoicingContext';
import DocumentTypeSelector, { DOCUMENT_TYPES } from '../POS/DocumentTypeSelector';

// Helper para obtener nombre del vendedor
const getVendedorName = (venta) => {
  if (venta?.seller_name) return venta.seller_name;
  if (!venta.employees) return 'Empleado';
  if (venta.employees.role === 'owner' || venta.employees.role === 'admin') {
    return 'Administrador';
  }
  return venta.employees.full_name || 'Empleado';
};

function Ventas({ businessId, userRole = 'admin' }) {
  // Estados principales
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sessionValid, setSessionValid] = useState(false);

  // Estados del POS
  const [showPOS, setShowPOS] = useState(false);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchProduct, setSearchProduct] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Estado del tipo de documento (comprobante - factura deshabilitada)
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES.RECEIPT);

  // Estados del modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);
  
  // Modal educativo de primera venta
  const [showFirstSaleModal, setShowFirstSaleModal] = useState(false);
  
  // Hook de facturación (DESHABILITADO - usar Siigo directamente)
  const { canGenerateElectronicInvoice, isLoading: invoicingLoading } = useInvoicing();

  // ========================================
  // CARGA INICIAL DE DATOS
  // ========================================

  const loadData = useCallback(async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      setError(null);

      // Validar sesión
      const { user, error: userError } = await getCurrentUser();
      if (userError) {
        setError('⚠️ Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setSessionValid(false);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      setSessionValid(true);

      // Cargar ventas y productos en paralelo
      const [salesData, productsData] = await Promise.all([
        getSales(businessId),
        getAvailableProducts(businessId)
      ]);

      setVentas(salesData);
      setProductos(productsData);
    } catch (err) {
      // Error cargando datos
      setError('❌ Error al cargar los datos. Por favor recarga la página.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ========================================
  // TIEMPO REAL - Suscripción a cambios
  // ========================================

  useRealtimeSubscription('sales', {
    filter: { business_id: businessId },
    enabled: !!businessId && sessionValid,
    onInsert: async (newSale) => {
      // Enriquecer venta nueva con datos de empleado
      const enrichedSale = {
        ...newSale,
        employees: {
          full_name: newSale.seller_name || 'Vendedor',
          role: 'employee'
        }
      };

      setVentas(prev => {
        const exists = prev.some(v => v.id === newSale.id);
        if (exists) return prev;
        return [enrichedSale, ...prev];
      });

      setSuccess('✨ Nueva venta registrada');
      setTimeout(() => setSuccess(null), 3000);
    },
    onUpdate: (updatedSale) => {
      setVentas(prev => prev.map(v => 
        v.id === updatedSale.id ? { ...v, ...updatedSale } : v
      ));
    },
    onDelete: (deletedSale) => {
      setVentas(prev => prev.filter(v => v.id !== deletedSale.id));
    }
  });

  // Realtime para productos (actualizar stock)
  useRealtimeSubscription('products', {
    filter: { business_id: businessId },
    enabled: !!businessId && sessionValid,
    onUpdate: (updatedProduct) => {
      setProductos(prev => prev.map(p => 
        p.id === updatedProduct.id ? updatedProduct : p
      ));
    }
  });

  // ========================================
  // FUNCIONES DEL CARRITO
  // ========================================

  const addToCart = useCallback((producto) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === producto.id);
      
      if (existingItem) {
        // Verificar stock disponible
        if (existingItem.quantity >= producto.stock) {
          setError(`⚠️ Stock insuficiente. Solo hay ${producto.stock} unidades`);
          return prevCart;
        }

        return prevCart.map(item =>
          item.product_id === producto.id
            ? { 
                ...item, 
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unit_price 
              }
            : item
        );
      }

      return [...prevCart, {
        product_id: producto.id,
        name: producto.name,
        unit_price: producto.price,
        quantity: 1,
        subtotal: producto.price,
        available_stock: producto.stock
      }];
    });

    setError(null);
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => {
      const item = prevCart.find(i => i.product_id === productId);
      if (!item) return prevCart;

      if (newQuantity > item.available_stock) {
        setError(`⚠️ Stock insuficiente. Solo hay ${item.available_stock} unidades`);
        return prevCart;
      }

      return prevCart.map(i =>
        i.product_id === productId
          ? { ...i, quantity: newQuantity, subtotal: newQuantity * i.unit_price }
          : i
      );
    });
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
    setPaymentMethod('cash');
    setSearchProduct('');
    setDocumentType(DOCUMENT_TYPES.RECEIPT);
  }, []);

  // ========================================
  // PROCESAMIENTO DE VENTA
  // ========================================

  const processSale = useCallback(async () => {
    if (cart.length === 0) {
      setError('⚠️ El carrito está vacío');
      return;
    }

    if (!sessionValid) {
      setError('⚠️ Tu sesión ha expirado. Recarga la página');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

      const result = await createSale({
        businessId,
        cart,
        paymentMethod,
        total,
      });

      if (!result.success) {
        throw new Error(result.error || 'Error al procesar la venta');
      }

      // Mensaje para comprobante de venta
      setSuccess(`✅ Venta registrada. Comprobante generado. Total: ${formatPrice(total)}`);
      
      clearCart();
      setShowPOS(false);

      // Recargar datos
      await loadData();
      
      // Verificar si es la primera venta y mostrar modal educativo
      const hideModal = localStorage.getItem('stockly_hide_first_sale_modal');
      if (!hideModal && ventas.length === 0) {
        setTimeout(() => {
          setShowFirstSaleModal(true);
        }, 1000);
      }

    } catch (err) {
      // Error procesando venta
      setError('❌ ' + (err.message || 'Error al procesar la venta'));
    } finally {
      setProcessing(false);
    }
  }, [cart, businessId, paymentMethod, sessionValid, clearCart, loadData, ventas.length]);

  // ========================================
  // ELIMINACIÓN DE VENTA
  // ========================================

  const handleDeleteSale = useCallback((saleId) => {
    setSaleToDelete(saleId);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteSale = useCallback(async () => {
    if (!saleToDelete) return;

    try {
      setLoading(true);
      const result = await deleteSale(saleToDelete);

      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar la venta');
      }

      setSuccess('✅ Venta eliminada correctamente');
      await loadData();
    } catch (err) {
      // Error eliminando venta
      setError('❌ ' + (err.message || 'Error al eliminar la venta'));
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setSaleToDelete(null);
    }
  }, [saleToDelete, loadData]);

  // ========================================
  // MEMOIZACIONES
  // ========================================

  const totalCart = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return productos;
    
    const search = searchProduct.toLowerCase();
    return productos.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.barcode?.toLowerCase().includes(search)
    );
  }, [productos, searchProduct]);

  // ========================================
  // RENDER
  // ========================================

  if (loading && ventas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando ventas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Mensajes de Error/Éxito */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-600 mt-1">Gestiona las ventas de tu negocio</p>
        </div>
        
        <Button
          onClick={() => setShowPOS(true)}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={!sessionValid}
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Venta
        </Button>
      </div>

      {/* Lista de Ventas */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          {ventas.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay ventas registradas
              </h3>
              <p className="text-gray-600">
                Comienza registrando tu primera venta
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Vendedor</th>
                    <th className="text-left py-3 px-4">Método de Pago</th>
                    <th className="text-right py-3 px-4">Total</th>
                    <th className="text-left py-3 px-4">Fecha</th>
                    {userRole === 'admin' && (
                      <th className="text-center py-3 px-4">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((venta) => (
                    <tr key={venta.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        #{venta.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{getVendedorName(venta)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={venta.payment_method === 'cash' ? 'default' : 'secondary'}>
                          {venta.payment_method === 'cash' ? 'Efectivo' : 
                           venta.payment_method === 'card' ? 'Tarjeta' : 
                           venta.payment_method === 'transfer' ? 'Transferencia' : 
                           venta.payment_method}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatPrice(venta.total)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(venta.created_at)}
                      </td>
                      {userRole === 'admin' && (
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSale(venta.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal POS */}
      {showPOS && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Punto de Venta</h2>
              <button
                onClick={() => setShowPOS(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Productos */}
              <div>
                <div className="mb-4">
                  <Input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {filteredProducts.map((producto) => (
                    <button
                      key={producto.id}
                      onClick={() => addToCart(producto)}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                    >
                      <div className="font-medium text-gray-900">{producto.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Stock: {producto.stock}
                      </div>
                      <div className="text-lg font-bold text-blue-600 mt-2">
                        {formatPrice(producto.price)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Carrito */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Carrito</h3>
                
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p>Carrito vacío</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.product_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-600">
                            {formatPrice(item.unit_price)} × {item.quantity}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>

                        <div className="font-bold text-lg">
                          {formatPrice(item.subtotal)}
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <>
                    <div className="mt-6 space-y-4">
                      {/* Total */}
                      <div className="flex justify-between items-center text-2xl font-bold">
                        <span>Total:</span>
                        <span className="text-blue-600">{formatPrice(totalCart)}</span>
                      </div>

                      {/* Selector de método de pago */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Método de pago
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                          <option value="cash">Efectivo</option>
                          <option value="card">Tarjeta</option>
                          <option value="transfer">Transferencia</option>
                        </select>
                      </div>

                      <Button
                        onClick={processSale}
                        disabled={processing}
                        className="w-full py-4 text-lg bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {processing 
                          ? 'Procesando...' 
                          : '🧾 Generar Comprobante'
                        }
                      </Button>

                      <Button
                        onClick={clearCart}
                        variant="outline"
                        className="w-full"
                      >
                        Limpiar Carrito
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-xl font-bold mb-4">Confirmar Eliminación</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar esta venta? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowDeleteModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteSale}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal educativo de primera venta */}
      <PrimeraVentaModal 
        isOpen={showFirstSaleModal}
        onClose={() => setShowFirstSaleModal(false)}
      />
    </div>
  );
}

// Componente wrapper que proporciona el contexto de facturación
function VentasWrapper(props) {
  return (
    <InvoicingProvider businessId={props.businessId}>
      <Ventas {...props} />
    </InvoicingProvider>
  );
}

export default VentasWrapper;
