import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { closeOrderAsSplit, closeOrderSingle } from '../../services/ordersService.js';
import { formatPrice, formatNumber, formatDateTimeTicket } from '../../utils/formatters.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { SaleUpdateAlert } from '../ui/SaleUpdateAlert';
import { 
  Plus, 
  Layers, 
  Trash2, 
  X, 
  Search, 
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Save,
  Printer
} from 'lucide-react';
import SplitBillModal from './SplitBillModal';
import { closeModalImmediate } from '../../utils/closeModalImmediate';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { normalizeTableRecord } from '../../utils/tableStatus.js';

function Mesas({ businessId }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successDetails, setSuccessDetails] = useState([]);
  const [successTitle, setSuccessTitle] = useState('✨ Acción Completada');
  const [alertType, setAlertType] = useState('success'); // 'success', 'update', 'error'
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  // Nueva bandera: intención explícita de abrir el modal (evita aperturas automáticas)
  const [modalOpenIntent, setModalOpenIntent] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false); // Verificar si es empleado
  
  // Estados para la orden
  const [orderItems, setOrderItems] = useState([]);
  const [productos, setProductos] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  // Estados para cerrar orden
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCloseOrderChoiceModal, setShowCloseOrderChoiceModal] = useState(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [clientes, setClientes] = useState([]);
  const [isClosingOrder, setIsClosingOrder] = useState(false);
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  // Form data para crear mesa
  const [newTableNumber, setNewTableNumber] = useState('');

  // Estado para modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mesaToDelete, setMesaToDelete] = useState(null);
  
  // Estado para prevenir clics múltiples (almacena el ID del item siendo actualizado)
  const [updatingItemId, setUpdatingItemId] = useState(null);

  // Ref para prevenir que el modal se reabra después de completar una venta
  const justCompletedSaleRef = useRef(false);
  
  // Estado para bloquear completamente el renderizado del modal mientras se procesa la venta
  const [canShowOrderModal, setCanShowOrderModal] = useState(true);

  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        return;
      }
      
      if (user) {
        // Tabla users (public) no existe, usar auth.users
        setCurrentUser({ id: user.id, role: 'admin' });
      }
    } catch (error) {
    }
  }, []);

  // Verificar si el usuario autenticado es empleado
  const checkIfEmployee = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsEmployee(false);
        return;
      }

      const { data, error } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .single();

      // Si existe en employees, es empleado (NO puede eliminar mesas)
      setIsEmployee(!!data);
    } catch (error) {
      // Si hay error, asumimos que NO es empleado (es admin)
      setIsEmployee(false);
    }
  }, [businessId]);

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
              products (name, category)
            )
          )
        `)
        .eq('business_id', businessId)
        .order('table_number', { ascending: true });

      if (error) {
        setError('No se pudo cargar las mesas. Revisa tu conexión e intenta de nuevo.');
        return;
      }
      
      setMesas((data || []).map(normalizeTableRecord));
    } catch (err) {
      setError('No se pudo cargar las mesas. Revisa tu conexión e intenta de nuevo.');
    }
  }, [businessId]);

  const loadProductos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, sale_price, stock, category')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name')
        .limit(200);
        // Removido el filtro de stock para permitir ventas incluso con stock negativo

      if (error) {
        setError('No se pudo cargar los productos. Revisa tu conexión e intenta de nuevo.');
        return;
      }
      
      setProductos(data || []);
    } catch (err) {
      setError('No se pudo cargar los productos. Revisa tu conexión e intenta de nuevo.');
    }
  }, [businessId]);

  const loadClientes = useCallback(async () => {
    // Tabla customers eliminada - no hacer nada
    setClientes([]);
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
      checkIfEmployee();
    }
  }, [businessId, loadData, getCurrentUser, checkIfEmployee]);

  // Callbacks memoizados para Realtime
  const handleTableInsert = useCallback((newTable) => {
    const normalizedTable = normalizeTableRecord(newTable);
    setMesas(prev => {
      const exists = prev.some(m => m.id === normalizedTable.id);
      if (exists) {
        return prev;
      }
      return [...prev, normalizedTable].sort((a, b) => a.table_number - b.table_number);
    });
    setSuccess(`✨ Nueva mesa #${normalizedTable.table_number} agregada`);
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  const handleTableUpdate = useCallback((updatedTable) => {
    const normalizedTable = normalizeTableRecord(updatedTable);
    // ❌ IGNORAR COMPLETAMENTE cualquier actualización si acabamos de completar una venta
    if (justCompletedSaleRef.current) {
      return;
    }
    
    setMesas(prev => prev.map(m => m.id === normalizedTable.id ? normalizedTable : m));
    // Si estamos viendo esta mesa, actualizar sus detalles
    setSelectedMesa(prev => {
      if (prev?.id === normalizedTable.id) {
        // Si la mesa se liberó (pasó a available), cerrar el modal
        if (normalizedTable.status === 'available' && !normalizedTable.current_order_id) {
          setShowOrderDetails(false);
          setModalOpenIntent(false);
          return null;
        }
        return { ...prev, ...normalizedTable };
      }
      return prev;
    });
  }, []);

  const handleTableDelete = useCallback((deletedTable) => {
    setMesas(prev => {
      const filtered = prev.filter(m => m.id !== deletedTable.id);
      return filtered;
    });
    setSelectedMesa(prev => {
      if (prev?.id === deletedTable.id) {
        setShowOrderDetails(false);
        setModalOpenIntent(false);
        return null;
      }
      return prev;
    });
  }, []);

  // 🔥 TIEMPO REAL: Suscripción a cambios en mesas
  useRealtimeSubscription('tables', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: handleTableInsert,
    onUpdate: handleTableUpdate,
    onDelete: handleTableDelete
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en órdenes
  useRealtimeSubscription('orders', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onUpdate: async (updatedOrder) => {
      // NO procesar actualizaciones si acabamos de completar una venta
      if (justCompletedSaleRef.current) {
        return;
      }
      
      // Actualizar la mesa correspondiente en el estado global
      setMesas(prev => prev.map(mesa => {
        if (mesa.current_order_id === updatedOrder.id) {
          return { ...mesa, orders: { ...mesa.orders, ...updatedOrder } };
        }
        return mesa;
      }));
      
      // Si es la orden actualmente abierta, recargar los items
      if (selectedMesa?.current_order_id === updatedOrder.id) {
        const { data: items } = await supabase
          .from('order_items')
          .select('*, products(name, code)')
          .eq('order_id', updatedOrder.id)
          .order('id', { ascending: true });
        
        if (items) {
          setOrderItems(items);
        }
      }
    }
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en items de orden (NIVEL NEGOCIO)
  // Callback para manejar cambios en order_items
  const handleOrderItemChange = useCallback(async (item, eventType) => {
    // Obtener el order_id del item
    const orderId = item.order_id;
    
    // Usar función de actualización de estado para evitar problemas de stale state
    setMesas(prevMesas => {
      // Encontrar la mesa asociada a esta orden
      const mesaAfectada = prevMesas.find(m => m.current_order_id === orderId);
      if (!mesaAfectada) return prevMesas;
      
      // NO actualizar si ya completamos una venta (bandera activa)
      if (justCompletedSaleRef.current) {
        return prevMesas;
      }
      
      // Recargar los detalles de la orden para actualizar el total (async)
      supabase
        .from('orders')
        .select(`
          *,
          order_items!order_items_order_id_fkey (
            id,
            quantity,
            price,
            subtotal,
            products (name, category)
          )
        `)
        .eq('id', orderId)
        .order('id', { foreignTable: 'order_items', ascending: true })
        .single()
        .then(({ data: updatedOrder }) => {
          if (updatedOrder) {
            // NO actualizar si ya completamos una venta
            if (justCompletedSaleRef.current) {
              return;
            }
            
            // Actualizar el estado de mesas
            setMesas(prev => prev.map(mesa => {
              if (mesa.id === mesaAfectada.id) {
                return { ...mesa, orders: updatedOrder };
              }
              return mesa;
            }));
            
            // Si esta es la mesa abierta actualmente, actualizar también orderItems
            setSelectedMesa(prevSelected => {
              if (prevSelected?.id === mesaAfectada.id) {
                setOrderItems(updatedOrder.order_items || []);
                return { ...prevSelected, orders: updatedOrder };
              }
              return prevSelected;
            });
          }
        });
      
      return prevMesas;
    });
  }, []);

  // Suscripción a order_items a nivel de negocio (sin filtrar por order_id específico)
  // Nota: RLS automáticamente filtra por business_id del usuario autenticado
  useRealtimeSubscription('order_items', {
    enabled: !!businessId,
    filter: {}, // RLS se encarga del filtrado por business_id
    onInsert: (newItem) => handleOrderItemChange(newItem, 'INSERT'),
    onUpdate: (updatedItem) => handleOrderItemChange(updatedItem, 'UPDATE'),
    onDelete: (deletedItem) => handleOrderItemChange(deletedItem, 'DELETE')
  });

  const handleCreateTable = useCallback(async (e) => {
    e.preventDefault();
    
    if (isCreatingTable) return; // Prevenir doble click
    
    setIsCreatingTable(true);
    setError(null);
    setSuccess(null);
    
    try {
      const tableNum = parseInt(newTableNumber);
      if (isNaN(tableNum) || tableNum <= 0) {
        throw new Error('Ingresa un número de mesa válido');
      }

      const { data, error } = await supabase
        .from('tables')
        .insert([{
          business_id: businessId,
          table_number: tableNum,
          status: 'available'
        }])
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este número de mesa ya existe');
        }
        throw error;
      }

      // Código de éxito
      setSuccess('✅ Mesa creada exitosamente');
      setNewTableNumber('');
      setShowAddForm(false);
      await loadMesas();
      
    } catch (error) {
      
      setError('❌ No se pudo crear la mesa. Por favor, intenta de nuevo.');
    } finally {
      setIsCreatingTable(false); // SIEMPRE desbloquear
    }
  }, [isCreatingTable, newTableNumber, businessId, loadMesas]);

  // IMPORTANTE: Definir estas funciones ANTES de handleOpenTable
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
        setError('❌ No se pudo crear la orden. Por favor, intenta de nuevo.');
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
        setError('❌ No se pudo actualizar la mesa. Por favor, intenta de nuevo.');
        throw updateError;
      }

      setSelectedMesa({ ...mesa, current_order_id: newOrder.id, orders: newOrder });
      setOrderItems([]);
      setModalOpenIntent(true);
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
          order_items!order_items_order_id_fkey (
            *,
            products (name, code, category)
          )
        `)
        .eq('id', mesa.current_order_id)
        .order('id', { foreignTable: 'order_items', ascending: true })
        .maybeSingle();

      if (error) {
        throw error;
      }


      setSelectedMesa({ ...mesa, orders: order });
      setOrderItems(order.order_items || []);
      setModalOpenIntent(true);
      setShowOrderDetails(true);
    } catch (error) {
      setError('❌ No se pudieron cargar los detalles de la orden. Por favor, intenta de nuevo.');
    }
  }, []);

  const handleOpenTable = useCallback(async (mesa) => {
    // Actualizar estado local inmediatamente para UI responsive
    setSelectedMesa(mesa);
    setModalOpenIntent(true);
    setShowOrderDetails(true);
    
    if (mesa.status === 'occupied' && mesa.current_order_id) {
      // Cargar la orden actual
      await loadOrderDetails(mesa);
    } else {
      // Crear nueva orden
      await createNewOrder(mesa);
    }
  }, [loadOrderDetails, createNewOrder]);

  // IMPORTANTE: Definir updateOrderTotal PRIMERO (otras funciones dependen de esta)
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
      // Error silencioso
    }
  }, [orderItems]);

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
      setError('❌ No se pudo eliminar el producto. Por favor, intenta de nuevo.');
      // Revertir solo los items si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id)
        .order('id', { ascending: true });
      if (freshItems) setOrderItems(freshItems);
    }
  }, [selectedMesa, updateOrderTotal]);

  const handleRefreshOrder = useCallback(async () => {
    if (!selectedMesa) return;
    
    try {
      // Actualizar el total antes de cerrar
      await updateOrderTotal(selectedMesa.current_order_id);
      
      // Actualización optimista: actualizar solo la mesa actual en el estado
      setMesas(prevMesas => 
        prevMesas.map(m => 
          m.id === selectedMesa.id 
            ? { ...m, status: 'occupied', current_order_id: selectedMesa.current_order_id }
            : m
        )
      );
      
      // Cerrar el modal
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      setOrderItems([]);
      setSearchProduct('');
      
      setSuccessTitle('✨ Mesa Actualizada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${selectedMesa.table_number}` },
        { label: 'Estado', value: 'Actualizada' }
      ]);
      setAlertType('update');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError('❌ No se pudo guardar la orden');
    }
  }, [selectedMesa, updateOrderTotal]);

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

      // Aviso transitorio si la cantidad solicitada supera el stock disponible
      if (typeof producto.stock === 'number' && qty > producto.stock) {
        setError(`⚠️ Stock insuficiente para ${producto.name}. Disponibles: ${producto.stock}. Considera crear una compra.`);
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
      setError('❌ No se pudo agregar el producto. Por favor, intenta de nuevo.');
      // Revertir solo los items si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id)
        .order('id', { ascending: true });
      if (freshItems) setOrderItems(freshItems);
    }
  }, [selectedMesa, orderItems, quantityToAdd, updateOrderTotal]);

  const updateItemQuantity = useCallback(async (itemId, newQuantity) => {
    // Prevenir clics múltiples: verificar si ya hay una actualización en progreso
    if (updatingItemId !== null) {
      return;
    }

    try {
      if (newQuantity <= 0) {
        await removeItem(itemId);
        return;
      }

      // Aviso transitorio si la cantidad nueva supera el stock del producto
      const existing = orderItems.find(i => i.id === itemId);
      if (existing) {
        const prod = productos.find(p => p.id === existing.product_id);
        if (prod && typeof prod.stock === 'number' && newQuantity > prod.stock) {
          setError(`⚠️ Stock insuficiente para ${prod.name}. Disponibles: ${prod.stock}. Considera crear una compra.`);
        }
      }
      // Marcar como actualizando
      setUpdatingItemId(itemId);

      // Actualización optimista: actualizar UI primero para respuesta instantánea
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
        throw error;
      }

      await updateOrderTotal(selectedMesa.current_order_id);
    } catch (error) {
      setError('❌ No se pudo actualizar la cantidad. Por favor, intenta de nuevo.');
      // Revertir cambio optimista si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id)
        .order('id', { ascending: true });
      if (freshItems) setOrderItems(freshItems);
    } finally {
      // Siempre liberar el bloqueo
      setUpdatingItemId(null);
    }
  }, [selectedMesa, updateOrderTotal, removeItem, updatingItemId]);

  const handleCloseModal = () => {
    // Capturar snapshot para uso en background o rollback
    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    const itemsSnapshot = [...orderItems];

    // Función que ejecuta la limpieza en background (elim/actualiza en DB)
    const backgroundWork = async () => {
      if (!mesaSnapshot) return;
      try {
        if (itemsSnapshot.length === 0 && mesaSnapshot.current_order_id) {
          // Eliminar la orden vacía
          await supabase.from('orders').delete().eq('id', mesaSnapshot.current_order_id);

          // Liberar la mesa en BD
          await supabase
            .from('tables')
            .update({ current_order_id: null, status: 'available' })
            .eq('id', mesaSnapshot.id);
        }
      } catch (error) {
        // Rollback: recargar mesas para sincronizar estado
        try { await loadMesas(); } catch (e) { /* no-op */ }
      }
    };

    // Aplicar actualización optimista de UI inmediatamente
    if (itemsSnapshot.length === 0 && mesaSnapshot) {
      setMesas(prevMesas => 
        prevMesas.map(m => m.id === mesaSnapshot.id ? { ...m, status: 'available', current_order_id: null } : m)
      );
    }

    // Cerrar modal y limpiar estado local inmediatamente, delegando trabajo a background
    closeModalImmediate(() => {
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      setOrderItems([]);
    }, backgroundWork);
  };

  const handleCloseOrder = () => {
    // Mostrar elección: pagar todo junto o dividir cuenta
    setShowCloseOrderChoiceModal(true);
  };

  const handlePayAllTogether = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(false);
    setShowPaymentModal(true);
  };

  const handleSplitBill = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(true);
  };

  const processSplitPaymentAndClose = async ({ subAccounts }) => {
    if (isClosingOrder) return;

    setIsClosingOrder(true);
    setError(null);

    // Prepare snapshot
    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;

    // Apply optimistic UI: mark mesa as available and close UI immediately
    if (mesaSnapshot) {
      setMesas(prevMesas => prevMesas.map(m => m.id === mesaSnapshot.id ? { ...m, status: 'available', current_order_id: null } : m));
    }
    setShowSplitBillModal(false);
    setShowCloseOrderChoiceModal(false);
    setShowPaymentModal(false);
    setShowOrderDetails(false);
    setModalOpenIntent(false);
    setSelectedMesa(null);
    setOrderItems([]);

    // Prevent realtime reopens while background processes
    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);

    (async () => {
      try {
        const { totalSold } = await closeOrderAsSplit(businessId, {
          subAccounts,
          orderId: mesaSnapshot.current_order_id,
          tableId: mesaSnapshot.id
        });

        loadMesas().catch(() => {});

        setSuccessDetails([
          { label: 'Total', value: formatPrice(totalSold) },
          { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
          { label: 'Cuentas', value: subAccounts.length }
        ]);
        setSuccessTitle('✨ Mesa Cerrada');
        setAlertType('success');
        setSuccess(true);

        setTimeout(() => {
          setSuccess(false);
          justCompletedSaleRef.current = false;
          setCanShowOrderModal(true);
        }, 8000);
      } catch (error) {
        setError('❌ No se pudo cerrar la orden. Revirtiendo estado.');
        // Rollback: reload mesas
        try { await loadMesas(); } catch (e) { /* no-op */ }
        try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch (e) {}
      } finally {
        setIsClosingOrder(false);
      }
    })();
  };

  const processPaymentAndClose = async () => {
    // Prevenir doble click
    if (isClosingOrder) return;

    setIsClosingOrder(true);
    setError(null);

    // Snapshot
    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;

    // Optimistic UI: mark mesa available and close modal immediately
    if (mesaSnapshot) {
      setMesas(prevMesas => prevMesas.map(m => m.id === mesaSnapshot.id ? { ...m, status: 'available', current_order_id: null } : m));
    }
    setShowPaymentModal(false);
    setShowOrderDetails(false);
    setModalOpenIntent(false);
    setSelectedMesa(null);
    setOrderItems([]);
    setPaymentMethod('cash');
    setSelectedCustomer('');

    // Prevent realtime reopens while background processes
    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);

    (async () => {
      try {
        const { saleTotal } = await closeOrderSingle(businessId, {
          orderId: mesaSnapshot.current_order_id,
          tableId: mesaSnapshot.id,
          paymentMethod
        });

        loadMesas().catch(() => {});

        setSuccessDetails([
          { label: 'Total', value: formatPrice(saleTotal) },
          { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
          { label: 'Método', value: paymentMethod }
        ]);
        setSuccessTitle('✨ Mesa Cerrada');
        setAlertType('success');
        setSuccess(true);

        setTimeout(() => {
          setSuccess(false);
          justCompletedSaleRef.current = false;
          setCanShowOrderModal(true);
        }, 8000);
      } catch (error) {
        setError('❌ No se pudo cerrar la orden. Revirtiendo estado.');
        try { await loadMesas(); } catch (e) { /* no-op */ }
        try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch (e) {}
      } finally {
        setIsClosingOrder(false);
      }
    })();
  };

  // Función para imprimir la orden (formato para cocina)
  const handlePrintOrder = () => {
    if (!selectedMesa || orderItems.length === 0) {
      setError('No hay productos en la orden para imprimir');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Filtrar solo productos que van a cocina (solo Platos)
    const categoriasParaCocina = ['Platos'];
    const itemsParaCocina = orderItems.filter(item => 
      categoriasParaCocina.includes(item.products?.category)
    );

    // Si no hay nada para cocina, mostrar mensaje
    if (itemsParaCocina.length === 0) {
      setError('No hay productos que requieran preparación en cocina');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Crear contenido HTML para impresión
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Orden Mesa ${selectedMesa.table_number}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10px;
          }
          
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          
          .header h1 {
            font-size: 20px;
            margin: 0 0 5px 0;
            font-weight: bold;
          }
          
          .header p {
            margin: 2px 0;
            font-size: 11px;
          }
          
          .info {
            margin: 10px 0;
            font-size: 13px;
          }
          
          .info strong {
            font-weight: bold;
          }
          
          .items {
            margin: 15px 0;
          }
          
          .item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px dashed #ccc;
          }
          
          .item-name {
            flex: 1;
            font-weight: bold;
            font-size: 13px;
          }
          
          .item-qty {
            width: 60px;
            text-align: right;
            font-size: 13px;
            font-weight: bold;
          }
          
          .total {
            display: none;
          }
          
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 11px;
          }
          
          .separator {
            border-top: 2px dashed #000;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ORDEN DE COCINA</h1>
          <p>Mesa #${selectedMesa.table_number}</p>
          <p>${formatDateTimeTicket(new Date())}</p>
        </div>
        
        <div class="info">
          <p><strong>Estado:</strong> ${selectedMesa.status === 'occupied' ? 'Ocupada' : 'Disponible'}</p>
          <p><strong>Productos:</strong> ${itemsParaCocina.length} item${itemsParaCocina.length !== 1 ? 's' : ''}</p>
        </div>
        
        <div class="separator"></div>
        
        <div class="items">
          ${itemsParaCocina.map(item => `
            <div class="item">
              <div class="item-name">${item.products?.name || 'Producto'}</div>
              <div class="item-qty">x${item.quantity}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="total">
          TOTAL: ${formatPrice(orderTotal)}
        </div>
        
        <div class="footer">
          <p>*** ORDEN PARA COCINA ***</p>
          <p>Sistema Stocky</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 100);
          };
        </script>
      </body>
      </html>
    `;

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      setError('No se pudo abrir la ventana de impresión. Verifica los permisos del navegador.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteTable = async (mesaId) => {
    setMesaToDelete(mesaId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTable = async () => {
    if (!mesaToDelete) return;

    // Snapshot antes de eliminar
    const mesaId = mesaToDelete;
    const snapshotMesas = mesas.slice();

    // Aplicar cambio optimista: remover de UI inmediatamente
    setMesas(prevMesas => prevMesas.filter(m => m.id !== mesaId));
    setShowDeleteModal(false);
    setMesaToDelete(null);

    // Ejecutar eliminación en background
    (async () => {
      try {
        // Primero, eliminar todas las órdenes asociadas a esta mesa
        const { error: ordersError } = await supabase
          .from('orders')
          .delete()
          .eq('table_id', mesaId);

        if (ordersError) throw ordersError;

        // Luego eliminar la mesa
        const { error } = await supabase
          .from('tables')
          .delete()
          .eq('id', mesaId);

        if (error) throw error;

        setSuccess('✅ Mesa eliminada exitosamente');
        setTimeout(() => setSuccess(null), 3000);

        // Recargar mesas en background para asegurar sincronización
        loadMesas().catch(() => {});
      } catch (error) {
        setError('❌ No se pudo eliminar la mesa. Revirtiendo estado.');
        // Rollback: restaurar snapshot
        setMesas(snapshotMesas);
        setTimeout(() => setError(null), 5000);
      }
    })();
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

  // Items que exceden el stock disponible (para mostrar en el modal de pago)
  const insufficientItems = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return [];
    return orderItems
      .map(item => {
        const prod = productos.find(p => p.id === item.product_id);
        return prod ? { ...item, available_stock: prod.stock, product_name: prod.name } : null;
      })
      .filter(Boolean)
      .filter(i => typeof i.available_stock === 'number' && i.quantity > i.available_stock);
  }, [orderItems, productos]);

  useEffect(() => {
    let errorTimer, successTimer;
    if (error) errorTimer = setTimeout(() => setError(null), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(null), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);


  return (
    <AsyncStateWrapper
      loading={loading}
      error={mesas.length === 0 ? error : null}
      dataCount={mesas.length}
      onRetry={loadData}
      skeletonType="mesas"
      emptyTitle="Aun no hay mesas creadas"
      emptyDescription="Crea tu primera mesa para empezar a registrar ordenes."
      actionProcessing={isCreatingTable || isClosingOrder || !!updatingItemId}
    >
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
              className="gradient-primary text-white hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-11"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
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
            
            {/* Alerta de éxito - verde */}
            <SaleSuccessAlert 
              isVisible={success && alertType === 'success'}
              onClose={() => setSuccess(false)}
              title={successTitle}
              details={successDetails}
              duration={6000}
            />
            
            {/* Alerta de actualización - amarillo */}
            <SaleUpdateAlert 
              isVisible={success && alertType === 'update'}
              onClose={() => setSuccess(false)}
              title={successTitle}
              details={successDetails}
              duration={5000}
            />
            
            {/* Alerta de error - rojo */}
            <SaleErrorAlert 
              isVisible={success && alertType === 'error'}
              onClose={() => setSuccess(false)}
              title={successTitle}
              details={successDetails}
              duration={7000}
            />
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
                    <form onSubmit={handleCreateTable} className="flex flex-col sm:flex-row gap-4 sm:items-end">
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
                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Button 
                          type="submit"
                          disabled={isCreatingTable}
                          className="gradient-primary text-white h-12 w-full sm:w-auto disabled:opacity-50"
                        >
                          {isCreatingTable ? (
                            <>
                              Creando mesa...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Crear Mesa
                            </>
                          )}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 w-full sm:w-auto"
                          onClick={() => {
                            setShowAddForm(false);
                            setNewTableNumber('');
                          }}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancelar
                        </Button>
                      </div>
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
                    {/* Botón eliminar (solo si está disponible y no es empleado) */}
                    {mesa.status === 'available' && !isEmployee && (
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
        {modalOpenIntent && showOrderDetails && selectedMesa && canShowOrderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8"
            >
              <Card className="border-0 flex flex-col max-h-[85vh]">
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
                                <div className="flex flex-col gap-3">
                                  {/* Nombre y precio - Siempre visible completo */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-primary-900 text-sm sm:text-base leading-tight">
                                        {item.products?.name}
                                      </h4>
                                      <p className="text-xs sm:text-sm text-accent-600 mt-1">
                                        {formatPrice(parseFloat(item.price))} c/u
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-base sm:text-lg font-bold text-primary-900">
                                        {formatPrice(parseFloat(item.subtotal))}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Controles - Cantidad y eliminar */}
                                  <div className="flex items-center justify-between pt-2 border-t border-accent-100">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                      <span className="text-xs sm:text-sm text-accent-600 font-medium">Cantidad:</span>
                                      <div className="flex items-center gap-1 sm:gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                          disabled={updatingItemId !== null}
                                          className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          -
                                        </Button>
                                        <span className="w-10 sm:w-12 text-center font-bold text-primary-900">
                                          {item.quantity}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                          disabled={updatingItemId !== null}
                                          className="h-8 w-8 p-0 border-green-300 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          +
                                        </Button>
                                      </div>
                                    </div>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeItem(item.id)}
                                      className="h-9 px-3 hover:bg-red-100 hover:text-red-600 text-xs sm:text-sm"
                                    >
                                      <Trash2 className="w-4 h-4 mr-1.5" />
                                      Eliminar
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                              {/* Aviso inline si cantidad excede stock */}
                              {(() => {
                                const prod = productos.find(p => p.id === item.product_id);
                                const prodStock = prod ? prod.stock : null;
                                if (typeof prodStock === 'number' && item.quantity > prodStock) {
                                  return (
                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                      <div className="flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                        <div>
                                          <p className="text-sm font-semibold text-red-800">⚠️ Stock insuficiente</p>
                                          <p className="text-xs text-red-700">Disponibles: {prodStock} — Pedido: {item.quantity}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Total y acciones */}
                <div className="border-t-2 border-accent-200 bg-accent-50/30 p-4 sm:p-6 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-sm text-primary-600 mb-1">Total a pagar</p>
                      <h3 className="text-2xl sm:text-3xl font-bold text-primary-900">
                        {formatPrice(orderTotal)}
                      </h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <Button
                        onClick={handleRefreshOrder}
                        variant="outline"
                        className="border-2 border-accent-300 text-accent-700 hover:bg-accent-50 h-12 px-6 w-full sm:w-auto"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        Guardar
                      </Button>
                      <Button
                        onClick={handlePrintOrder}
                        variant="outline"
                        className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 h-12 px-6 w-full sm:w-auto"
                        disabled={orderItems.length === 0}
                      >
                        <Printer className="w-5 h-5 mr-2" />
                        Imprimir para cocina
                      </Button>
                      <Button
                        onClick={handleCloseOrder}
                        disabled={orderItems.length === 0}
                        className="gradient-primary text-white hover:opacity-90 h-12 px-8 text-lg w-full sm:w-auto"
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

      {/* Modal de elección: pagar todo junto o dividir cuenta */}
      <AnimatePresence>
        {showCloseOrderChoiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[58] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
            >
              <Card className="border-0">
                <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
                  <CardTitle className="text-xl font-bold text-primary-900">
                    💳 ¿Cómo cerrar la orden?
                  </CardTitle>
                  <p className="text-sm text-primary-600 mt-1">
                    Total: {formatPrice(orderTotal)}
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  <Button
                    onClick={handlePayAllTogether}
                    className="w-full h-12 gradient-primary text-white hover:opacity-90"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Pagar todo junto
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSplitBill}
                    className="w-full h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
                  >
                    <Layers className="w-5 h-5 mr-2" />
                    Dividir cuenta
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowCloseOrderChoiceModal(false)}
                    className="w-full h-10 text-primary-600 hover:bg-accent-50"
                  >
                    Cancelar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal dividir cuenta */}
      <AnimatePresence>
        {showSplitBillModal && (
          <SplitBillModal
            orderItems={orderItems}
            onConfirm={processSplitPaymentAndClose}
            onCancel={() => {
              setShowSplitBillModal(false);
              setShowCloseOrderChoiceModal(true);
            }}
          />
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

                  {insufficientItems.length > 0 && (
                    <div className="p-4 rounded-lg border border-red-200 bg-red-50 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">⚠️ Hay productos con stock insuficiente</p>
                          <p className="text-xs text-red-700">Revisa los siguientes productos o crea una compra antes de cerrar la orden.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {insufficientItems.map(it => (
                          <div key={it.id || `${it.product_id}-${it.quantity}`} className="text-sm text-red-700">
                            <strong className="text-primary-900">{it.product_name}</strong>
                            <div>Disponibles: {it.available_stock} — Pedido: {it.quantity}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end" />
                    </div>
                  )}

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
                      disabled={isClosingOrder}
                      className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50 disabled:opacity-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={processPaymentAndClose}
                      disabled={isClosingOrder}
                      className="flex-1 h-12 gradient-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClosingOrder ? (
                        <>
                          <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Procesando venta...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Confirmar Venta
                        </>
                      )}
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
    </AsyncStateWrapper>
  );
}

export default Mesas;
