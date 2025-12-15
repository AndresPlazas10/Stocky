import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice, formatNumber } from '../../utils/formatters.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError('❌ Error al cargar el inventario');
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
      // Error silencioso
    }
  }, [businessId]);

  // ✅ OPTIMIZADO: Generación de código único sin intentos fallidos
  const generateProductCode = useCallback(async () => {
    try {
      // Obtener TODOS los códigos PRD-#### del negocio para encontrar el máximo
      const { data: products, error } = await supabase
        .from('products')
        .select('code')
        .eq('business_id', businessId)
        .ilike('code', 'PRD-%');
      
      if (error) throw error;
      
      let maxNumber = 0;
      
      // Encontrar el número más alto entre códigos secuenciales (PRD-0001, PRD-0002, etc.)
      // ✅ MEJORADO: Ignorar códigos con timestamp (6 dígitos como PRD-897571)
      if (products && products.length > 0) {
        products.forEach(product => {
          if (product.code) {
            // ✅ Solo aceptar códigos de 4 dígitos (PRD-0001 a PRD-9999)
            const match = product.code.match(/^PRD-(\d{4})$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNumber) {
                maxNumber = num;
              }
            }
          }
        });
      }
      
      // El siguiente código es maxNumber + 1
      const nextNumber = maxNumber + 1;
      const newCode = `PRD-${String(nextNumber).padStart(4, '0')}`;
      
      console.log(`📦 Código generado: ${newCode} (secuencia máxima: ${maxNumber})`);
      setGeneratedCode(newCode);
    } catch (error) {
      console.error('❌ Error generando código:', error);
      // Fallback: usar timestamp para garantizar unicidad
      setGeneratedCode(`PRD-${Date.now().toString().slice(-6)}`);
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

  // 🔥 TIEMPO REAL: Suscripción a cambios en productos
  useRealtimeSubscription('products', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: async (newProduct) => {
      // Cargar supplier data
      let productWithSupplier = newProduct;
      if (newProduct.supplier_id) {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('id, business_name, contact_name')
          .eq('id', newProduct.supplier_id)
          .single();
        productWithSupplier = { ...newProduct, supplier };
      }
      
      // Verificar si el producto ya existe antes de agregarlo
      setProductos(prev => {
        const exists = prev.some(p => p.id === newProduct.id);
        if (exists) {
          return prev;
        }
        return [productWithSupplier, ...prev];
      });
      
      setSuccess('✨ Nuevo producto agregado');
      setTimeout(() => setSuccess(null), 3000);
    },
    onUpdate: (updatedProduct) => {
      setProductos(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
    },
    onDelete: (deletedProduct) => {
      setProductos(prev => prev.filter(p => p.id !== deletedProduct.id));
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevenir doble click
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // ✅ VALIDACIONES MEJORADAS
      if (!formData.name?.trim()) {
        throw new Error('El nombre del producto es requerido');
      }

      if (!formData.category?.trim()) {
        throw new Error('La categoría del producto es requerida');
      }

      if (!formData.sale_price || parseFloat(formData.sale_price) <= 0) {
        throw new Error('El precio de venta debe ser mayor a 0');
      }

      if (formData.purchase_price && parseFloat(formData.purchase_price) < 0) {
        throw new Error('El precio de compra no puede ser negativo');
      }

      if (formData.sale_price && formData.purchase_price) {
        if (parseFloat(formData.sale_price) < parseFloat(formData.purchase_price)) {
          throw new Error('El precio de venta no puede ser menor al precio de compra');
        }
      }

      // ✅ VALIDAR código generado
      if (!generatedCode || !generatedCode.startsWith('PRD-')) {
        throw new Error('Error al generar código del producto. Recarga la página.');
      }

      // ✅ CORREGIDO: Insertar con el código pre-generado (evita 409)
      const productData = {
        name: formData.name.trim(),
        code: generatedCode, // ✅ Usar el código ya generado
        category: formData.category.trim(),
        purchase_price: parseFloat(formData.purchase_price) || 0,
        sale_price: parseFloat(formData.sale_price),
        stock: parseInt(formData.stock) || 0,
        min_stock: parseInt(formData.min_stock) || 5,
        unit: formData.unit || 'unit',
        supplier_id: formData.supplier_id || null,
        business_id: businessId,
        is_active: true
      };

      const { data: insertedProduct, error: insertError } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .maybeSingle();
      
      if (insertError) {
        // ✅ Manejo inteligente de error 409 (conflicto de código único)
        if (insertError.code === '23505') {
          // Regenerar código con timestamp para garantizar unicidad
          const fallbackCode = `PRD-${Date.now().toString().slice(-6)}`;
          productData.code = fallbackCode;
          
          const { data: retryData, error: retryError } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .maybeSingle();
          
          if (retryError) {
            throw new Error(`Error al crear producto: ${retryError.message || 'Código duplicado'}`);
          }
          
          // Éxito con retry
          await loadProductos();
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
          setSuccess('✅ Producto creado exitosamente');
          setTimeout(() => setSuccess(null), 3000);
          return;
        } else if (insertError.code === '42501') {
          // Error de permisos RLS
          throw new Error('No tienes permisos para crear productos. Contacta al administrador.');
        } else if (insertError.code === '23503') {
          // FK constraint
          throw new Error('Proveedor no válido. Selecciona uno existente.');
        } else {
          throw new Error(`Error al crear producto: ${insertError.message || 'Error desconocido'}`);
        }
      }
      
      // Código de éxito
      await loadProductos();
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
      setSuccess('✅ Producto creado exitosamente');
      
      // Auto-limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Error al crear el producto');
      
      // Auto-limpiar mensaje de error después de 5 segundos
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false); // SIEMPRE desbloquear
    }
  }, [businessId, formData, generatedCode, loadProductos, isSubmitting]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-light-bg-primary to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#edb886] mx-auto mb-4"></div>
          <p className="text-secondary-600 font-medium">Cargando inventario...</p>
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
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Inventario</h1>
                <p className="text-white/80 mt-1 text-sm sm:text-base">
                  {userRole === 'admin' ? 'Gestión de productos y stock' : 'Consulta de productos y stock'}
                </p>
              </div>
            </div>
            {userRole === 'admin' && (
              <Button
                onClick={() => setShowForm(!showForm)}
                className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-3 rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center whitespace-nowrap"
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
              <div className="gradient-primary text-white p-6 rounded-t-2xl">
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
                      className="h-11 rounded-xl border-gray-300 focus:border-[#edb886] focus:ring-[#edb886]"
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
                      className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#edb886] focus:ring-[#edb886] transition-all duration-300"
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
                      className="h-11 rounded-xl border-gray-300 focus:border-[#edb886] focus:ring-[#edb886]"
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
                      className="h-11 rounded-xl border-gray-300 focus:border-[#edb886] focus:ring-[#edb886]"
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
                      className="h-11 rounded-xl border-gray-300 focus:border-[#edb886] focus:ring-[#edb886]"
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
                      className="h-11 rounded-xl border-gray-300 focus:border-[#edb886] focus:ring-[#edb886]"
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
                      className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#edb886] focus:ring-[#edb886] transition-all duration-300"
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
                    className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#edb886] focus:ring-[#edb886] transition-all duration-300"
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
                    className="w-5 h-5 rounded border-gray-300 text-accent-600 focus:ring-[#edb886]"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Producto activo
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creando producto...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Guardar Producto
                    </>
                  )}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#edb886] mx-auto mb-4"></div>
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
          <div className="space-y-4">
            {/* Vista de tarjetas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {productos.map((producto, index) => (
                <motion.div
                  key={producto.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                >
                  <Card className={`shadow-lg rounded-2xl bg-white border-2 hover:shadow-xl transition-all duration-300 ${
                    producto.stock <= producto.min_stock 
                      ? 'border-red-300 bg-red-50/30' 
                      : 'border-accent-100 hover:border-primary-300'
                  }`}>
                    <div className="p-4 sm:p-6">
                      {/* Header con nombre y código */}
                      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-accent-200">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Box className="w-5 h-5 text-primary-600 shrink-0" />
                            <h3 className="text-lg font-bold text-primary-900 truncate">
                              {producto.name}
                            </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-accent-100 text-accent-700 border border-accent-200">
                              <Tag className="w-3 h-3 mr-1" />
                              {producto.code || 'Sin código'}
                            </Badge>
                            {producto.category && (
                              <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                                <BarChart3 className="w-3 h-3 mr-1" />
                                {producto.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Estado */}
                        <div className="shrink-0">
                          {userRole === 'admin' ? (
                            <Button
                              onClick={() => toggleActive(producto.id, producto.is_active)}
                              className={`h-9 px-3 rounded-xl font-medium text-xs transition-all duration-300 ${
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
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            } border`}>
                              {producto.is_active ? '✓ Activo' : '✗ Inactivo'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Grid de información */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Proveedor */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-accent-600" />
                            <span className="text-xs text-accent-500 uppercase tracking-wide">Proveedor</span>
                          </div>
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {producto.supplier ? (producto.supplier.business_name || producto.supplier.contact_name || 'Sin proveedor') : 'Sin proveedor'}
                          </p>
                        </div>

                        {/* Precio de Compra */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingDown className="w-4 h-4 text-orange-600" />
                            <span className="text-xs text-accent-500 uppercase tracking-wide">P. Compra</span>
                          </div>
                          <p className="text-base font-bold text-orange-600">
                            {formatPrice(producto.purchase_price)}
                          </p>
                        </div>

                        {/* Precio de Venta */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-accent-500 uppercase tracking-wide">P. Venta</span>
                          </div>
                          <p className="text-base font-bold text-green-600">
                            {formatPrice(producto.sale_price)}
                          </p>
                        </div>

                        {/* Stock */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="w-4 h-4 text-primary-600" />
                            <span className="text-xs text-accent-500 uppercase tracking-wide">Stock</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStockBadgeClass(producto.stock, producto.min_stock)}>
                              {producto.stock} {producto.unit}
                            </Badge>
                            {producto.stock <= producto.min_stock && (
                              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                            )}
                          </div>
                        </div>

                        {/* Mínimo */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-accent-600" />
                            <span className="text-xs text-accent-500 uppercase tracking-wide">Mínimo</span>
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {producto.min_stock} {producto.unit}
                          </p>
                        </div>
                      </div>

                      {/* Acciones */}
                      {userRole === 'admin' && (
                        <div className="pt-4 border-t border-accent-200">
                          <Button
                            onClick={() => handleDelete(producto.id)}
                            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-sm">Eliminar Producto</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
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
