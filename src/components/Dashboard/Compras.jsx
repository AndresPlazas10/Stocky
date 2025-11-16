import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice } from '../../utils/formatters.js';
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

  const loadCompras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          supplier:suppliers(business_name, contact_name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setCompras(data || []);
    } catch (error) {
      console.error('Error al cargar compras:', error);
      setError('Error al cargar las compras');
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
      console.error('Error loading products:', error);
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
      console.error('Error loading suppliers:', error);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadCompras();
      loadProductos();
      loadProveedores();
    }
  }, [businessId, loadCompras, loadProductos, loadProveedores]);

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

    if (!supplierId) {
      setError('Selecciona un proveedor');
      return;
    }

    if (cart.length === 0) {
      setError('Agrega al menos un producto a la compra');
      return;
    }

    try {
      // Insertar compra (el total se calculará automáticamente por trigger)
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert([{
          business_id: businessId,
          supplier_id: supplierId,
          payment_method: paymentMethod,
          notes: notes || null
        }])
        .select()
        .maybeSingle();

      if (purchaseError) {
        console.error('Error al insertar compra:', purchaseError);
        throw purchaseError;
      }

      // Insertar detalles de compra (el trigger calculará el total automáticamente)
      const purchaseDetails = cart.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const { error: detailsError } = await supabase
        .from('purchase_details')
        .insert(purchaseDetails);

      if (detailsError) {
        console.error('Error al insertar detalles:', detailsError);
        throw detailsError;
      }

      // Actualizar stock de productos
      for (const item of cart) {
        const producto = productos.find(p => p.id === item.product_id);
        const newStock = (producto.stock || 0) + item.quantity;

        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.product_id);

        if (updateError) {
          console.error('Error al actualizar stock:', updateError);
          throw updateError;
        }
      }

      setSuccess('✅ Compra registrada exitosamente');
      resetForm();
      setShowModal(false);
      loadCompras();
      loadProductos();
    } catch (error) {
      console.error('Error completo:', error);
      setError('❌ Error al registrar la compra: ' + error.message);
    }
  }, [businessId, cart, supplierId, paymentMethod, notes, productos, loadCompras, loadProductos]);

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
      setError('Error al cargar los detalles');
    }
  }, []);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B46] mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando compras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#C4DFE6] to-white p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white shadow-xl rounded-2xl border-none mb-6">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Compras</h1>
                <p className="text-white/80 mt-1">Gestión de compras a proveedores</p>
              </div>
            </div>
            <Button
              onClick={() => setShowModal(true)}
              className="bg-white text-[#003B46] hover:bg-white/90 transition-all duration-300 shadow-lg font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nueva Compra
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
            className="pl-10 h-12 rounded-xl border-gray-300 focus:border-[#003B46] focus:ring-[#003B46]"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompras.map((compra, index) => (
              <motion.div
                key={compra.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="shadow-lg rounded-2xl bg-white border-none hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-4">
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
                            {new Date(compra.created_at).toLocaleDateString()}
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

                    <Button
                      onClick={() => viewDetails(compra)}
                      className="w-full h-10 bg-gradient-to-r from-[#003B46] to-[#07575B] text-white hover:shadow-lg transition-all duration-300 rounded-xl flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Ver Detalles
                    </Button>
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
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6 rounded-t-2xl flex items-center justify-between z-10">
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

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 focus:border-[#003B46] focus:ring-1 focus:ring-[#003B46] outline-none"
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
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 focus:border-[#003B46] focus:ring-1 focus:ring-[#003B46] outline-none"
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
                        addToCart(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full h-11 px-4 rounded-xl border border-gray-300 focus:border-[#003B46] focus:ring-1 focus:ring-[#003B46] outline-none"
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
                      <span className="text-2xl font-bold text-green-600">{formatPrice(calculateTotal())}</span>
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
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:border-[#003B46] focus:ring-1 focus:ring-[#003B46] outline-none"
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
                    disabled={cart.length === 0}
                    className="flex-1 h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed border-none"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Registrar Compra
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
              <div className="sticky top-0 bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6 rounded-t-2xl flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Detalles de Compra</h3>
                    <p className="text-white/80 text-sm">
                      {new Date(selectedPurchase.created_at).toLocaleDateString()}
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
    </div>
  );
}

export default Compras;
