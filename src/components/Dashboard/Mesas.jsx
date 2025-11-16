import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { formatPrice, formatNumber } from '../../utils/formatters.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  Plus, 
  Layers, 
  Trash2, 
  X, 
  Search, 
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Save
} from 'lucide-react';

function Mesas({ businessId }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  
  // Estados para la orden
  const [orderItems, setOrderItems] = useState([]);
  const [productos, setProductos] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  // Estados para cerrar orden
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [clientes, setClientes] = useState([]);

  // Form data para crear mesa
  const [newTableNumber, setNewTableNumber] = useState('');

  // Estado para modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mesaToDelete, setMesaToDelete] = useState(null);

  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        return;
      }
      
      if (user) {
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', user.id)
          .maybeSingle();
        
        if (userError) {
          // Usar el ID de auth.users si no existe en users
          setCurrentUser({ id: user.id, role: 'admin' });
        } else {
          setCurrentUser(userData);
        }
      }
    } catch (error) {
    }
  }, []);

  const loadMesas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select(`
          *,
          orders!current_order_id (
            id,
            status,
            total,
            opened_at,
            order_items (
              id,
              quantity,
              price,
              subtotal,
              products (name)
            )
          )
        `)
        .eq('business_id', businessId)
        .order('table_number', { ascending: true });

      if (error) {
        console.error('Error al cargar mesas:', error);
        return;
      }
      
      setMesas(data || []);
    } catch (error) {
      console.error('Error al cargar mesas:', error);
    }
  }, [businessId]);

  const loadProductos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true);
        // Removido el filtro de stock para permitir ventas incluso con stock negativo

      if (error) {
        console.error('Error al cargar productos:', error);
        return;
      }
      
      
      if (data.length === 0) {
      }
      
      setProductos(data || []);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  }, [businessId]);

  const loadClientes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .order('full_name', { ascending: true });

      if (error) {
        // Tabla customers no disponible
        setClientes([]);
        return;
      }
      
      setClientes(data || []);
    } catch (err) {
      // Clientes no disponibles
      setClientes([]);
    }
  }, [businessId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMesas(),
        loadProductos(),
        loadClientes()
      ]);
    } catch (error) {
      setError('⚠️ No se pudo cargar la información de las mesas. Por favor, intenta recargar la página.');
    } finally {
      setLoading(false);
    }
  }, [loadMesas, loadProductos, loadClientes]);

  useEffect(() => {
    if (businessId) {
      loadData();
      getCurrentUser();
    }
  }, [businessId, loadData, getCurrentUser]);

  const handleCreateTable = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const tableNum = parseInt(newTableNumber);
      if (isNaN(tableNum) || tableNum <= 0) {
        throw new Error('Ingresa un número de mesa válido');
      }

      const { error } = await supabase
        .from('tables')
        .insert([{
          business_id: businessId,
          table_number: tableNum,
          status: 'available'
        }]);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este número de mesa ya existe');
        }
        throw error;
      }

      setSuccess('✅ Mesa creada exitosamente');
      setNewTableNumber('');
      setShowAddForm(false);
      await loadMesas();
    } catch (error) {
      setError('❌ Error al crear la mesa: ' + error.message);
    }
  }, [businessId, newTableNumber, loadMesas]);

  const handleOpenTable = useCallback(async (mesa) => {
    if (mesa.status === 'occupied' && mesa.current_order_id) {
      // Cargar la orden actual
      await loadOrderDetails(mesa);
    } else {
      // Crear nueva orden
      await createNewOrder(mesa);
    }
  }, [loadOrderDetails, createNewOrder]);

  const createNewOrder = useCallback(async (mesa) => {
    try {
      setError(null);


      // Crear la orden
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          business_id: businessId,
          table_id: mesa.id,
          user_id: currentUser?.id || null,
          status: 'open',
          total: 0
        }])
        .select()
        .maybeSingle();

      if (orderError) {
        setError(`❌ No se pudo crear la orden: ${orderError.message || 'Error desconocido'}`);
        throw orderError;
      }

      // Actualizar la mesa con la orden actual
      const { error: updateError } = await supabase
        .from('tables')
        .update({
          current_order_id: newOrder.id,
          status: 'occupied'
        })
        .eq('id', mesa.id);

      if (updateError) {
        setError(`❌ No se pudo actualizar la mesa: ${updateError.message || 'Error desconocido'}`);
        throw updateError;
      }

      setSelectedMesa({ ...mesa, current_order_id: newOrder.id, orders: newOrder });
      setOrderItems([]);
      setShowOrderDetails(true);
      await loadMesas();
    } catch (error) {
      setError('❌ No se pudo abrir la mesa. Por favor, intenta de nuevo.');
    }
  }, [businessId, currentUser, loadMesas]);

  const loadOrderDetails = useCallback(async (mesa) => {
    try {

      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, code)
          )
        `)
        .eq('id', mesa.current_order_id)
        .maybeSingle();

      if (error) {
        throw error;
      }


      setSelectedMesa({ ...mesa, orders: order });
      setOrderItems(order.order_items || []);
      
      
      setShowOrderDetails(true);
    } catch (error) {
      setError('❌ No se pudieron cargar los detalles de la orden. Por favor, intenta de nuevo.');
    }
  }, []);

  const handleRefreshOrder = useCallback(async () => {
    if (!selectedMesa) return;
    
    try {
      // Actualizar el total antes de cerrar
      await updateOrderTotal(selectedMesa.current_order_id);
      
      // Recargar todas las mesas para actualizar el estado
      await loadMesas();
      
      // Cerrar el modal
      setShowOrderDetails(false);
      setSelectedMesa(null);
      setOrderItems([]);
      setSearchProduct('');
      
      setSuccess('✅ Orden guardada correctamente');
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      console.error('Error saving order:', error);
      setError('❌ No se pudo guardar la orden');
    }
  }, [selectedMesa, updateOrderTotal, loadMesas]);

  const addProductToOrder = useCallback(async (producto) => {
    try {
      if (!selectedMesa?.current_order_id) return;


      // Validar que el producto tenga precio
      const precio = producto.sale_price || producto.price;
      if (!precio || precio === null || precio === undefined) {
        setError(`⚠️ El producto "${producto.name}" no tiene un precio válido`);
        return;
      }

      // Validar cantidad
      const qty = parseInt(quantityToAdd);
      if (isNaN(qty) || qty <= 0) {
        setError('⚠️ La cantidad debe ser mayor a 0');
        return;
      }

      // Verificar si el producto ya está en la orden
      const existingItem = orderItems.find(item => item.product_id === producto.id);

      if (existingItem) {
        // Incrementar cantidad con la cantidad especificada
        const newQuantity = existingItem.quantity + qty;
        
        const { error } = await supabase
          .from('order_items')
          .update({ 
            quantity: newQuantity
            // subtotal se calcula automáticamente con trigger
          })
          .eq('id', existingItem.id);

        if (error) throw error;
        
        // Recargar el item actualizado para obtener el subtotal correcto
        const { data: updatedItem } = await supabase
          .from('order_items')
          .select('*, products(name, code)')
          .eq('id', existingItem.id)
          .maybeSingle();
        
        // Actualización optimista del estado local con datos frescos
        setOrderItems(prevItems => 
          prevItems.map(item => 
            item.id === existingItem.id 
              ? updatedItem
              : item
          )
        );
      } else {
        // Agregar nuevo item con la cantidad especificada
        const { data: newItem, error } = await supabase
          .from('order_items')
          .insert([{
            order_id: selectedMesa.current_order_id,
            product_id: producto.id,
            quantity: qty,
            price: parseFloat(precio)
            // subtotal se calcula automáticamente con trigger
          }])
          .select('id')
          .maybeSingle();

        if (error) {
          console.error('Error inserting item:', error);
          throw error;
        }
        
        // Actualización optimista: agregar al estado local inmediatamente
        if (newItem?.id) {
          const optimisticItem = {
            id: newItem.id,
            order_id: selectedMesa.current_order_id,
            product_id: producto.id,
            quantity: qty,
            price: parseFloat(precio),
            subtotal: qty * parseFloat(precio),
            products: {
              name: producto.name,
              code: producto.code
            }
          };
          setOrderItems(prevItems => [...prevItems, optimisticItem]);
        }
      }

      // Actualizar el total de forma optimista
      await updateOrderTotal(selectedMesa.current_order_id);
      setSearchProduct('');
      setQuantityToAdd(1); // Resetear cantidad
    } catch (error) {
      console.error('Error adding product:', error);
      setError('❌ No se pudo agregar el producto. Por favor, intenta de nuevo.');
      // Revertir solo los items si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id);
      if (freshItems) setOrderItems(freshItems);
    }
  }, [selectedMesa, orderItems, quantityToAdd, updateOrderTotal]);

  const updateItemQuantity = useCallback(async (itemId, newQuantity) => {
    try {
      if (newQuantity <= 0) {
        await removeItem(itemId);
        return;
      }

      // Actualización optimista: actualizar estado local primero
      setOrderItems(prevItems => 
        prevItems.map(item => {
          if (item.id === itemId) {
            const newSubtotal = newQuantity * item.price;
            return { ...item, quantity: newQuantity, subtotal: newSubtotal };
          }
          return item;
        })
      );

      // Actualizar en base de datos en background
      const { error } = await supabase
        .from('order_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) {
        console.error('Error updating quantity:', error);
        throw error;
      }

      await updateOrderTotal(selectedMesa.current_order_id);
    } catch (error) {
      console.error('Error in updateItemQuantity:', error);
      setError('❌ No se pudo actualizar la cantidad. Por favor, intenta de nuevo.');
      // Revertir cambio optimista solo si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id);
      if (freshItems) setOrderItems(freshItems);
    }
  }, [selectedMesa, updateOrderTotal, removeItem]);

  const removeItem = useCallback(async (itemId) => {
    try {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Actualización optimista: remover del estado local
      setOrderItems(prevItems => prevItems.filter(item => item.id !== itemId));

      await updateOrderTotal(selectedMesa.current_order_id);
    } catch (error) {
      console.error('Error in removeItem:', error);
      setError('❌ No se pudo eliminar el producto. Por favor, intenta de nuevo.');
      // Revertir solo los items si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id);
      if (freshItems) setOrderItems(freshItems);
    }
  }, [selectedMesa, updateOrderTotal]);

  const updateOrderTotal = useCallback(async (orderId) => {
    try {
      // Calcular total desde el estado local (más rápido)
      const total = orderItems.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

      // Actualizar estado local primero (instantáneo)
      setMesas(prevMesas => 
        prevMesas.map(mesa => 
          mesa.current_order_id === orderId 
            ? { ...mesa, orders: { ...mesa.orders, total } }
            : mesa
        )
      );

      // Actualizar DB en background
      await supabase
        .from('orders')
        .update({ total })
        .eq('id', orderId);
    } catch (error) {
      console.error('Error updating order total:', error);
    }
  }, [orderItems]);

  const handleCloseModal = async () => {
    // Si la orden está vacía, eliminarla y liberar la mesa
    if (orderItems.length === 0 && selectedMesa?.current_order_id) {
      try {
        // Eliminar la orden vacía
        await supabase
          .from('orders')
          .delete()
          .eq('id', selectedMesa.current_order_id);

        // Liberar la mesa
        await supabase
          .from('tables')
          .update({
            current_order_id: null,
            status: 'available'
          })
          .eq('id', selectedMesa.id);

        await loadMesas();
      } catch (error) {
      }
    }

    setShowOrderDetails(false);
    setSelectedMesa(null);
    setOrderItems([]);
  };

  const handleCloseOrder = () => {
    // Abrir modal de pago en lugar de procesar directamente
    setShowPaymentModal(true);
  };

  const processPaymentAndClose = async () => {
    try {

      // Obtener los items de la orden para crear la venta
      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (id, name)
          )
        `)
        .eq('id', selectedMesa.current_order_id)
        .maybeSingle();

      if (!orderData || orderData.order_items.length === 0) {
        setError('⚠️ No hay productos en la orden para cerrar');
        return;
      }

      // 1. Crear la venta con el método de pago y cliente seleccionados
      const { data: sale, error: saleError} = await supabase
        .from('sales')
        .insert([{
          business_id: businessId,
          user_id: orderData.user_id,
          customer_id: selectedCustomer || null,
          total: orderData.total,
          payment_method: paymentMethod
        }])
        .select()
        .maybeSingle();

      if (saleError) {
        throw new Error('Error al crear la venta');
      }

      // 2. Crear los detalles de venta desde los items de la orden
      const saleDetails = orderData.order_items.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price
        // subtotal se calcula automáticamente en la BD (columna generada)
      }));

      const { error: detailsError } = await supabase
        .from('sale_details')
        .insert(saleDetails);

      if (detailsError) {
        throw new Error('Error al crear los detalles de la venta');
      }

      // 3. Cerrar la orden
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString()
        })
        .eq('id', selectedMesa.current_order_id);

      if (orderError) {
        throw orderError;
      }

      // 4. Liberar la mesa
      const { error: tableError } = await supabase
        .from('tables')
        .update({
          current_order_id: null,
          status: 'available'
        })
        .eq('id', selectedMesa.id);

      if (tableError) {
        throw tableError;
      }


      setSuccess(`✅ Venta registrada exitosamente. Total: ${formatPrice(orderData.total)}. Mesa liberada.`);
      setShowPaymentModal(false);
      setShowOrderDetails(false);
      setSelectedMesa(null);
      setOrderItems([]);
      setPaymentMethod('cash');
      setSelectedCustomer('');
      
      await loadMesas();

      // Mostrar mensaje por más tiempo
      setTimeout(() => {
        setSuccess(null);
      }, 5000);

    } catch (error) {
      setError(`❌ Error al cerrar la orden: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleDeleteTable = async (mesaId) => {
    setMesaToDelete(mesaId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTable = async () => {
    if (!mesaToDelete) return;

    try {
      // Primero, eliminar todas las órdenes asociadas a esta mesa
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .eq('table_id', mesaToDelete);

      if (ordersError) throw ordersError;

      // Luego eliminar la mesa
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', mesaToDelete);

      if (error) throw error;

      // Actualizar el estado local removiendo la mesa eliminada
      setMesas(prevMesas => prevMesas.filter(mesa => mesa.id !== mesaToDelete));
      
      setSuccess('✅ Mesa eliminada exitosamente');
      
      // Cerrar modal
      setShowDeleteModal(false);
      setMesaToDelete(null);
      
      // Recargar las mesas para asegurar sincronización
      await loadMesas();
    } catch (error) {
      setError('❌ No se pudo eliminar la mesa. Verifica que esté disponible e intenta de nuevo.');
      setShowDeleteModal(false);
      setMesaToDelete(null);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return [];
    const search = searchProduct.toLowerCase();
    return productos.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.code.toLowerCase().includes(search)
    ).slice(0, 5);
  }, [searchProduct, productos]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
  }, [orderItems]);

  useEffect(() => {
    let errorTimer, successTimer;
    if (error) errorTimer = setTimeout(() => setError(null), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(null), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);


  if (loading) return <div className="loading">Cargando mesas...</div>;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="space-y-6"
    >
      <Card className="border-accent-200 shadow-lg">
        <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-primary-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Layers className="w-6 h-6 text-white" />
              </div>
              Gestión de Mesas
            </CardTitle>
            <Button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="gradient-primary text-white hover:opacity-90"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Agregar Mesa
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Alertas */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-4 rounded-2xl bg-destructive/10 border-2 border-destructive/20 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">{error}</p>
              </motion.div>
            )}
            
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-4 rounded-2xl bg-green-50 border-2 border-green-200 flex items-start gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-700 font-medium">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario para agregar mesa */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <Card className="border-accent-200 bg-accent-50/30">
                  <CardContent className="pt-6">
                    <form onSubmit={handleCreateTable} className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-primary-700 mb-2">
                          Número de Mesa *
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={newTableNumber}
                          onChange={(e) => setNewTableNumber(e.target.value)}
                          placeholder="Ej: 1, 2, 3..."
                          className="h-12 border-accent-300"
                          required
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="gradient-primary text-white hover:opacity-90 h-12"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Crear Mesa
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewTableNumber('');
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid de mesas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {mesas.map((mesa, index) => (
              <motion.div
                key={mesa.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`relative cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    mesa.status === 'occupied' 
                      ? 'border-yellow-400 bg-yellow-50/30' 
                      : 'border-green-400 bg-green-50/30'
                  }`}
                  onClick={() => handleOpenTable(mesa)}
                >
                  <CardContent className="pt-6 text-center">
                    {/* Botón eliminar (solo si está disponible) */}
                    {mesa.status === 'available' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(mesa.id);
                        }}
                        className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Icono de estado */}
                    <div className="mb-4 flex justify-center">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                        mesa.status === 'occupied' 
                          ? 'bg-yellow-100 text-yellow-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        <Layers className="w-10 h-10" />
                      </div>
                    </div>

                    {/* Número de mesa */}
                    <h3 className="text-2xl font-bold text-primary-900 mb-2">
                      Mesa {mesa.table_number}
                    </h3>

                    {/* Estado */}
                    <Badge 
                      variant={mesa.status === 'occupied' ? 'warning' : 'success'}
                      className="mb-3 text-sm font-semibold"
                    >
                      {mesa.status === 'occupied' ? '🔴 Ocupada' : '🟢 Disponible'}
                    </Badge>

                    {/* Información de la orden si está ocupada */}
                    {mesa.status === 'occupied' && mesa.orders && (
                      <div className="mt-4 pt-4 border-t border-accent-200">
                        <p className="text-lg font-bold text-primary-900">
                          {formatPrice(parseFloat(mesa.orders.total || 0))}
                        </p>
                        <p className="text-sm text-primary-600">
                          {mesa.orders.order_items?.length || 0} productos
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Mensaje si no hay mesas */}
          {mesas.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-10 h-10 text-accent-600" />
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">
                No hay mesas creadas
              </h3>
              <p className="text-primary-600 mb-6">
                Comienza agregando tu primera mesa
              </p>
              <Button 
                onClick={() => setShowAddForm(true)}
                className="gradient-primary text-white hover:opacity-90"
              >
                <Plus className="w-5 h-5 mr-2" />
                Agregar Mesa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalles de la orden */}
      <AnimatePresence>
        {showOrderDetails && selectedMesa && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              <Card className="border-0 h-full flex flex-col">
                <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50 shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-bold text-primary-900 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-white" />
                      </div>
                      Mesa {selectedMesa.table_number} - Orden
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCloseModal}
                      className="h-10 w-10 p-0 hover:bg-red-100 hover:text-red-600 rounded-xl"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 overflow-y-auto flex-1">
                  {/* Buscar producto */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-primary-700 mb-3">
                      <Search className="w-4 h-4 inline mr-2" />
                      Agregar Producto
                    </label>
                    <Input
                      type="text"
                      placeholder="Buscar por nombre o código..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="h-12 border-accent-300"
                    />
                    
                    <AnimatePresence>
                      {searchProduct && filteredProducts.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-2 border-2 border-accent-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto shadow-lg"
                        >
                          {filteredProducts.map((producto, index) => (
                            <motion.div
                              key={producto.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              onClick={() => addProductToOrder(producto)}
                              className="p-4 cursor-pointer border-b border-accent-100 last:border-0 hover:bg-accent-50 transition-colors flex justify-between items-center"
                            >
                              <span className="font-semibold text-primary-900">
                                {producto.name} <span className="text-sm text-accent-600">({producto.code})</span>
                              </span>
                              <span className="text-lg font-bold text-green-600">
                                ${producto.sale_price || producto.price}
                              </span>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Items de la orden */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-primary-900 mb-4">Productos en la orden</h3>
                    {orderItems.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                          <ShoppingCart className="w-8 h-8 text-accent-600" />
                        </div>
                        <p className="text-accent-600">No hay productos en esta orden</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orderItems.map((item, index) => (
                          <motion.div
                            key={item.id || `temp-${item.product_id}-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card className="border-accent-200 hover:shadow-md transition-shadow">
                              <CardContent className="pt-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-primary-900">{item.products?.name}</h4>
                                    <p className="text-sm text-accent-600">{formatPrice(parseFloat(item.price))} c/u</p>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                      className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50"
                                    >
                                      -
                                    </Button>
                                    <span className="w-12 text-center font-bold text-primary-900">
                                      {item.quantity}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                      className="h-8 w-8 p-0 border-green-300 text-green-600 hover:bg-green-50"
                                    >
                                      +
                                    </Button>
                                  </div>

                                  <div className="text-right min-w-[100px]">
                                    <p className="text-lg font-bold text-primary-900">
                                      {formatPrice(parseFloat(item.subtotal))}
                                    </p>
                                  </div>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeItem(item.id)}
                                    className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Total y acciones */}
                <div className="border-t-2 border-accent-200 bg-accent-50/30 p-6 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-primary-600 mb-1">Total a pagar</p>
                      <h3 className="text-3xl font-bold text-primary-900">
                        {formatPrice(orderTotal)}
                      </h3>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleRefreshOrder}
                        variant="outline"
                        className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 px-6"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        Guardar
                      </Button>
                      <Button
                        onClick={handleCloseOrder}
                        disabled={orderItems.length === 0}
                        className="gradient-primary text-white hover:opacity-90 h-12 px-8 text-lg"
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Cerrar Orden
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de pago */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full"
            >
              <Card className="border-0">
                <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
                  <CardTitle className="text-2xl font-bold text-primary-900">
                    💳 Confirmar Pago
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  <div className="bg-accent-50 rounded-2xl p-6 text-center border-2 border-accent-200">
                    <p className="text-sm text-primary-600 mb-2">Total a pagar</p>
                    <h3 className="text-4xl font-bold text-primary-900">
                      {formatPrice(orderTotal)}
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primary-700 mb-2">
                      Método de Pago *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                    >
                      <option value="cash">💵 Efectivo</option>
                      <option value="card">💳 Tarjeta</option>
                      <option value="transfer">🏦 Transferencia</option>
                      <option value="mixed">🔄 Mixto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-primary-700 mb-2">
                      Cliente (Opcional)
                    </label>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                    >
                      <option value="">Venta general</option>
                      {clientes.map(cliente => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.full_name} - {cliente.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentMethod('cash');
                        setSelectedCustomer('');
                      }}
                      className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={processPaymentAndClose}
                      className="flex-1 h-12 gradient-primary text-white hover:opacity-90"
                    >
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Confirmar Venta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
            >
              <Card className="border-0">
                <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-red-50 to-orange-50">
                  <CardTitle className="text-2xl font-bold text-red-900 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    Confirmar Eliminación
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  <p className="text-lg text-primary-700">
                    ¿Estás seguro de que deseas eliminar esta mesa?
                  </p>
                  <p className="text-sm text-primary-600">
                    Esta acción no se puede deshacer.
                  </p>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setMesaToDelete(null);
                      }}
                      className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={confirmDeleteTable}
                      className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export default Mesas;
