import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice, formatNumber } from '../../utils/formatters.js';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Package,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Box,
  Tag,
  Building2,
  X
} from 'lucide-react';

function Inventario({ businessId, userRole = 'admin' }) {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para modales de confirmación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    purchase_price: '',
    sale_price: '',
    stock: '',
    min_stock: '',
    unit: 'unit',
    supplier_id: '',
    is_active: true
  });
  const [generatedCode, setGeneratedCode] = useState('');

  // Memoizar funciones de carga
  const loadProductos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          supplier:suppliers(id, business_name, contact_name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setProductos(data || []);
    } catch (error) {
      setError('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const loadProveedores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, business_name, contact_name')
        .eq('business_id', businessId)
        .order('business_name', { ascending: true });

      if (error) throw error;
      setProveedores(data || []);
    } catch (error) {
      console.error('Error loading proveedores:', error);
    }
  }, [businessId]);

  // Unificar generación de código (reemplaza generateAndSetCode y generateProductCode)
  const generateProductCode = useCallback(async () => {
    try {
      // Obtener TODOS los códigos existentes
      const { data: allProducts } = await supabase
        .from('products')
        .select('code')
        .eq('business_id', businessId);
      
      // Crear un Set con todos los códigos existentes para búsqueda rápida
      const existingCodes = new Set();
      let maxNumber = 0;
      
      if (allProducts && allProducts.length > 0) {
        allProducts.forEach(product => {
          if (product.code) {
            existingCodes.add(product.code);
            if (product.code.startsWith('PRD-')) {
              const match = product.code.match(/PRD-(\d+)/);
              if (match) {
                const num = parseInt(match[1]);
                if (num > maxNumber) {
                  maxNumber = num;
                }
              }
            }
          }
        });
      }
      
      // Generar código empezando desde maxNumber + 1
      let nextNumber = maxNumber + 1;
      let newCode = `PRD-${String(nextNumber).padStart(4, '0')}`;
      
      // Verificar que no exista, si existe incrementar hasta encontrar uno libre
      while (existingCodes.has(newCode)) {
        nextNumber++;
        newCode = `PRD-${String(nextNumber).padStart(4, '0')}`;
      }
      
      setGeneratedCode(newCode);
    } catch (error) {
      console.error('Error generating code:', error);
      setGeneratedCode(`PRD-${Date.now()}`);
    }
  }, [businessId]);

  // useEffects optimizados
  useEffect(() => {
    if (businessId) {
      loadProductos();
      loadProveedores();
    }
  }, [businessId, loadProductos, loadProveedores]);

  useEffect(() => {
    if (showForm && businessId) {
      generateProductCode();
    }
  }, [showForm, businessId, generateProductCode]);

  // Cleanup de mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      // Validaciones
      if (!formData.name.trim()) {
        throw new Error('El nombre del producto es requerido');
      }

      if (formData.sale_price && formData.purchase_price) {
        if (parseFloat(formData.sale_price) < parseFloat(formData.purchase_price)) {
          throw new Error('El precio de venta no puede ser menor al precio de compra');
        }
      }

      // Generar código único intentando inserciones hasta encontrar uno libre
      // Como RLS bloquea SELECT, intentaremos INSERT directamente
      let nextNumber = 1;
      let insertSuccess = false;
      let finalCode = '';
      let attempts = 0;
      const maxAttempts = 100;
      
      while (!insertSuccess && attempts < maxAttempts) {
        finalCode = `PRD-${String(nextNumber).padStart(4, '0')}`;
        
        const { data: insertedProduct, error: insertError } = await supabase
          .from('products')
          .insert([{
            name: formData.name,
            code: finalCode,
            category: formData.category,
            purchase_price: parseFloat(formData.purchase_price) || 0,
            sale_price: parseFloat(formData.sale_price) || 0,
            stock: parseInt(formData.stock) || 0,
            min_stock: parseInt(formData.min_stock) || 0,
            unit: formData.unit,
            supplier_id: formData.supplier_id || null,
            business_id: businessId,
            is_active: true
          }])
          .select()
          .single();
        
        if (insertError) {
          if (insertError.code === '23505') {
            // Código duplicado, intentar con el siguiente
            nextNumber++;
            attempts++;
          } else {
            // Error diferente, lanzar
            throw insertError;
          }
        } else {
          // Inserción exitosa
          insertSuccess = true;
          
          // Actualizar la lista de productos
          await loadProductos();
          
          // Cerrar modal y limpiar formulario
          setShowForm(false);
          setFormData({
            name: '',
            category: '',
            purchase_price: '',
            sale_price: '',
            stock: '',
            min_stock: '',
            unit: 'unit',
            supplier_id: ''
          });
          setGeneratedCode('');
        }
      }
      
      if (!insertSuccess) {
        alert('No se pudo generar un código único para el producto después de ' + maxAttempts + ' intentos. Por favor, contacte al administrador.');
        return;
      }

    } catch (error) {
      alert('Error al crear el producto: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [businessId, formData, generatedCode, loadProductos]);

  const handleDelete = useCallback(async (productId) => {
    setProductToDelete(productId);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!productToDelete) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete);

      if (error) {
        if (error.code === '23503') {
          setShowDeleteModal(false);
          setShowDeactivateModal(true);
          return;
        }
        throw error;
      }

      setSuccess('✅ Producto eliminado exitosamente');
      await loadProductos();
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      setError('❌ Error al eliminar el producto');
      setShowDeleteModal(false);
      setProductToDelete(null);
    }
  }, [productToDelete, loadProductos]);

  const confirmDeactivate = useCallback(async () => {
    if (!productToDelete) return;

    try {
      const { error: deactivateError } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productToDelete);
      
      if (deactivateError) throw deactivateError;
      
      setSuccess('✅ Producto desactivado exitosamente');
      await loadProductos();
      setShowDeactivateModal(false);
      setProductToDelete(null);
    } catch (error) {
      setError('❌ Error al desactivar el producto');
      setShowDeactivateModal(false);
      setProductToDelete(null);
    }
  }, [productToDelete, loadProductos]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setShowDeactivateModal(false);
    setProductToDelete(null);
  }, []);

  const toggleActive = useCallback(async (productId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) throw error;

      setSuccess(`✅ Producto ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
      await loadProductos();
    } catch (error) {
      setError('❌ Error al actualizar el estado del producto');
    }
  }, [loadProductos]);

  // Helper para clases de badge de stock (memoizado)
  const getStockBadgeClass = useCallback((stock, minStock) => {
    if (stock <= minStock) return 'bg-red-100 text-red-800';
    if (stock <= minStock * 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }, []);

  if (loading && productos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4DFE6] to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B46] mx-auto mb-4"></div>
          <p className="text-[#07575B] font-medium">Cargando inventario...</p>
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
                <Package className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Inventario</h1>
                <p className="text-white/80 mt-1">
                  {userRole === 'admin' ? 'Gestión de productos y stock' : 'Consulta de productos y stock'}
                </p>
              </div>
            </div>
            {userRole === 'admin' && (
              <Button
                onClick={() => setShowForm(!showForm)}
                className="bg-white text-[#003B46] hover:bg-white/90 transition-all duration-300 shadow-lg font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
              >
                {showForm ? (
                  <>
                    <X className="w-5 h-5" />
                    Cancelar
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Agregar Producto
                  </>
                )}
              </Button>
            )}
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
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-red-50 border-red-200 shadow-md rounded-2xl mb-4">
              <div className="p-4 flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-green-50 border-green-200 shadow-md rounded-2xl mb-4">
              <div className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <p className="text-green-800 font-medium">{success}</p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulario */}
      <AnimatePresence>
        {showForm && userRole === 'admin' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-xl rounded-2xl bg-white border-none mb-6">
              <div className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Agregar Nuevo Producto</h3>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Box className="w-4 h-4" />
                      Nombre del producto *
                    </label>
                    <Input
                      name="name"
                      type="text" 
                      placeholder="Ej: Laptop HP" 
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-[#003B46] focus:ring-[#003B46]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Categoría *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#003B46] focus:ring-[#003B46] transition-all duration-300"
                    >
                      <option value="">Seleccionar categoría</option>
                      <option value="Bebidas Alcohólicas">Bebidas Alcohólicas</option>
                      <option value="Cervezas">Cervezas</option>
                      <option value="Vinos">Vinos</option>
                      <option value="Licores">Licores</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Comida">Comida</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Precio de compra *
                    </label>
                    <Input
                      name="purchase_price"
                      type="number" 
                      min="0"
                      step="0.01"
                      placeholder="0.00" 
                      value={formData.purchase_price}
                      onChange={handleChange}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-[#003B46] focus:ring-[#003B46]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Precio de venta *
                    </label>
                    <Input
                      name="sale_price"
                      type="number" 
                      min="0"
                      step="0.01"
                      placeholder="0.00" 
                      value={formData.sale_price}
                      onChange={handleChange}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-[#003B46] focus:ring-[#003B46]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Stock inicial *
                    </label>
                    <Input
                      name="stock"
                      type="number" 
                      min="0"
                      placeholder="0" 
                      value={formData.stock}
                      onChange={handleChange}
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-[#003B46] focus:ring-[#003B46]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Stock mínimo
                    </label>
                    <Input
                      name="min_stock"
                      type="number" 
                      min="0"
                      placeholder="0" 
                      value={formData.min_stock}
                      onChange={handleChange}
                      className="h-11 rounded-xl border-gray-300 focus:border-[#003B46] focus:ring-[#003B46]"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alerta cuando el stock baje de este nivel</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unidad
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#003B46] focus:ring-[#003B46] transition-all duration-300"
                    >
                      <option value="unit">Unidad</option>
                      <option value="kg">Kilogramo</option>
                      <option value="l">Litro</option>
                      <option value="box">Caja</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Proveedor (opcional)
                  </label>
                  <select
                    name="supplier_id"
                    value={formData.supplier_id}
                    onChange={handleChange}
                    className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#003B46] focus:ring-[#003B46] transition-all duration-300"
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.id}>
                        {prov.business_name || prov.contact_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-xl">
                  <input 
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-gray-300 text-[#003B46] focus:ring-[#003B46]"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Producto activo
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Guardar Producto
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla de Inventario */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {loading ? (
          <Card className="shadow-xl rounded-2xl bg-white border-none p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B46] mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando inventario...</p>
            </div>
          </Card>
        ) : productos.length === 0 ? (
          <Card className="shadow-xl rounded-2xl bg-white border-none">
            <div className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 font-medium text-lg mb-2">No hay productos en el inventario</p>
              <p className="text-gray-400">Haz clic en "Agregar Producto" para comenzar</p>
            </div>
          </Card>
        ) : (
          <Card className="shadow-xl rounded-2xl bg-white border-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white">
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Código
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4" />
                        Nombre
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Categoría
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Proveedor
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        P. Compra
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        P. Venta
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Stock
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Min.
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold">Unidad</th>
                    <th className="px-6 py-4 text-left font-semibold">Estado</th>
                    <th className="px-6 py-4 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((producto, index) => (
                    <motion.tr
                      key={producto.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.02 }}
                      className={`border-b border-gray-100 hover:bg-gradient-to-r hover:from-[#C4DFE6]/20 hover:to-transparent transition-all duration-300 ${
                        producto.stock <= producto.min_stock ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {producto.code || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-[#003B46]">{producto.name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {producto.category || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {producto.supplier ? (producto.supplier.business_name || producto.supplier.contact_name || '-') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                        {formatPrice(producto.purchase_price)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">
                        {formatPrice(producto.sale_price)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getStockBadgeClass(producto.stock, producto.min_stock)}>
                          {producto.stock}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {producto.min_stock}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {producto.unit}
                      </td>
                      <td className="px-6 py-4">
                        {userRole === 'admin' ? (
                          <Button
                            onClick={() => toggleActive(producto.id, producto.is_active)}
                            className={`h-9 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${
                              producto.is_active
                                ? 'bg-green-100 hover:bg-green-200 text-green-800 border-none'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-none'
                            }`}
                          >
                            {producto.is_active ? '✓ Activo' : '✗ Inactivo'}
                          </Button>
                        ) : (
                          <Badge className={`${
                            producto.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {producto.is_active ? '✓ Activo' : '✗ Inactivo'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {userRole === 'admin' ? (
                          <Button
                            onClick={() => handleDelete(producto.id)}
                            className="h-9 px-4 bg-red-100 hover:bg-red-200 text-red-600 font-medium rounded-lg border-none transition-all duration-300 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </Button>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Solo admin</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </motion.div>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card className="bg-white shadow-2xl rounded-2xl border-none">
                <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Eliminar Producto</h2>
                      <p className="text-red-100 mt-1">Esta acción no se puede deshacer</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-gray-700 text-lg mb-6">
                    ¿Estás seguro de que deseas eliminar este producto del inventario?
                  </p>

                  <div className="flex gap-3">
                    <Button
                      onClick={cancelDelete}
                      className="flex-1 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={confirmDelete}
                      className="flex-1 h-12 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de desactivación (cuando el producto tiene ventas asociadas) */}
      <AnimatePresence>
        {showDeactivateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg"
            >
              <Card className="bg-white shadow-2xl rounded-2xl border-none">
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">No se puede eliminar</h2>
                      <p className="text-orange-100 mt-1">Producto con historial de ventas</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-gray-700 text-lg">
                    Este producto tiene pedidos o ventas asociados y no puede eliminarse.
                  </p>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-blue-800 text-sm">
                      <strong>💡 Tip:</strong> Puedes desactivarlo en su lugar. Los productos desactivados no aparecerán en nuevas ventas pero mantendrán su historial.
                    </p>
                  </div>

                  <p className="text-gray-600">
                    ¿Deseas desactivar este producto en lugar de eliminarlo?
                  </p>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={cancelDelete}
                      className="flex-1 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={confirmDeactivate}
                      className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Desactivar
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Inventario;
