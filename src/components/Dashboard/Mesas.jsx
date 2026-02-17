import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { closeOrderAsSplit, closeOrderSingle } from '../../services/ordersService.js';
import { formatPrice, formatDateTimeTicket } from '../../utils/formatters.js';
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
import { getThermalPaperWidthMm } from '../../utils/printer.js';

const getPaymentMethodLabel = (method) => {
  if (method === 'cash') return 'Efectivo';
  if (method === 'card') return 'Tarjeta';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'mixed') return 'Mixto';
  return method || '-';
};

const getTotalProductUnits = (items = []) =>
  items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);

const mergeOrderItemsPreservingPosition = (previousItems = [], incomingItems = []) => {
  const normalizedIncoming = Array.isArray(incomingItems) ? incomingItems.filter(Boolean) : [];
  if (!Array.isArray(previousItems) || previousItems.length === 0) {
    return normalizedIncoming;
  }

  const incomingById = new Map(
    normalizedIncoming
      .filter((item) => item?.id)
      .map((item) => [item.id, item])
  );
  const previousIds = new Set(previousItems.map((item) => item?.id).filter(Boolean));

  const preserved = previousItems
    .filter((item) => item?.id && incomingById.has(item.id))
    .map((item) => incomingById.get(item.id));

  const newItemsFirst = normalizedIncoming.filter((item) => !item?.id || !previousIds.has(item.id));

  return [...newItemsFirst, ...preserved];
};

const COLOMBIAN_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

const parseCopAmount = (value) => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;

  const raw = String(value).trim().replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return NaN;

  // Formato es-CO con miles "." y decimal "," (si llega decimal se redondea a pesos).
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  // Formato en-US con miles "," y decimal ".".
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  // Número simple (admite coma decimal).
  const simpleParsed = Number(raw.replace(',', '.'));
  if (Number.isFinite(simpleParsed)) return Math.round(simpleParsed);

  // Último fallback: tomar solo dígitos.
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return NaN;
  const digitsParsed = Number(digitsOnly);
  return Number.isFinite(digitsParsed) ? Math.round(digitsParsed) : NaN;
};

// Calcula cambio usando greedy para minimizar cantidad de billetes/monedas.
const calcularCambio = (total, pagado) => {
  const normalizedTotal = Math.round(Number(total) || 0);
  const normalizedPaid = parseCopAmount(pagado);

  if (normalizedTotal <= 0) {
    return { isValid: false, reason: 'invalid_total', change: 0, breakdown: [] };
  }

  if (!Number.isFinite(normalizedPaid) || normalizedPaid <= 0) {
    return { isValid: false, reason: 'invalid_paid', change: 0, breakdown: [] };
  }

  if (normalizedPaid < normalizedTotal) {
    return { isValid: false, reason: 'insufficient', change: 0, breakdown: [] };
  }

  let remaining = normalizedPaid - normalizedTotal;
  const breakdown = [];

  for (const denomination of COLOMBIAN_DENOMINATIONS) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      breakdown.push({ denomination, count });
      remaining -= count * denomination;
    }
  }

  return {
    isValid: true,
    reason: null,
    change: normalizedPaid - normalizedTotal,
    breakdown
  };
};

const normalizeTableIdentifier = (value) => String(value ?? '').trim();

const compareTableIdentifiers = (left, right) => {
  const a = normalizeTableIdentifier(left?.table_number);
  const b = normalizeTableIdentifier(right?.table_number);

  const aIsInteger = /^\d+$/.test(a);
  const bIsInteger = /^\d+$/.test(b);

  if (aIsInteger && bIsInteger) {
    return Number(a) - Number(b);
  }
  if (aIsInteger && !bIsInteger) return -1;
  if (!aIsInteger && bIsInteger) return 1;

  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
};

// eslint helper: `no-unused-vars` no detecta consistentemente `<motion.* />` en esta config.
const _motionLintUsage = motion;

const applyPendingQuantities = (items = [], pendingUpdates = {}) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (!pendingUpdates || Object.keys(pendingUpdates).length === 0) return items;

  return items.map((item) => {
    const pendingQuantity = pendingUpdates[item?.id];
    if (pendingQuantity === undefined || pendingQuantity === null) return item;

    const normalizedQuantity = Number(pendingQuantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return item;

    const normalizedPrice = Number(item?.price || 0);
    return {
      ...item,
      quantity: normalizedQuantity,
      subtotal: normalizedQuantity * normalizedPrice
    };
  });
};

function Mesas({ businessId }) {
  const MODAL_REOPEN_GUARD_MS = 600;
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
  const [pendingQuantityUpdates, setPendingQuantityUpdates] = useState({});
  const [productos, setProductos] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  // Estados para cerrar orden
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCloseOrderChoiceModal, setShowCloseOrderChoiceModal] = useState(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);
  const [isGeneratingSplitSales, setIsGeneratingSplitSales] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [amountReceivedError, setAmountReceivedError] = useState('');
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
  const [updatingItemId] = useState(null);
  const pendingQuantityUpdatesRef = useRef({});

  // Ref para prevenir que el modal se reabra después de completar una venta
  const justCompletedSaleRef = useRef(false);
  
  // Estado para bloquear completamente el renderizado del modal mientras se procesa la venta
  const [canShowOrderModal, setCanShowOrderModal] = useState(true);

  const setPendingQuantityUpdatesSafe = useCallback((updater) => {
    setPendingQuantityUpdates((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const normalizedNext = next && typeof next === 'object' ? next : {};
      pendingQuantityUpdatesRef.current = normalizedNext;
      return normalizedNext;
    });
  }, []);

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
    } catch {
      // no-op
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

      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .maybeSingle();

      // Si existe en employees, es empleado (NO puede eliminar mesas)
      setIsEmployee(!!data);
    } catch {
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
              product_id,
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
      
      setMesas((data || []).map(normalizeTableRecord).sort(compareTableIdentifiers));
    } catch {
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
    } catch {
      setError('No se pudo cargar los productos. Revisa tu conexión e intenta de nuevo.');
    }
  }, [businessId]);

  const loadClientes = useCallback(async () => {
    // Tabla customers eliminada - no hacer nada
    setClientes([]);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMesas(),
        loadProductos(),
        loadClientes()
      ]);
    } catch {
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
      return [...prev, normalizedTable].sort(compareTableIdentifiers);
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
          setOrderItems((prevItems) =>
            mergeOrderItemsPreservingPosition(
              prevItems,
              applyPendingQuantities(items, pendingQuantityUpdatesRef.current)
            )
          );
        }
      }
    }
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en items de orden (NIVEL NEGOCIO)
  // Callback para manejar cambios en order_items
  const handleOrderItemChange = useCallback(async (item) => {
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
            *,
            products (name, code, category)
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
                setOrderItems((prevItems) =>
                  mergeOrderItemsPreservingPosition(
                    prevItems,
                    applyPendingQuantities(updatedOrder.order_items || [], pendingQuantityUpdatesRef.current)
                  )
                );
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
      const tableIdentifier = normalizeTableIdentifier(newTableNumber);
      if (!tableIdentifier) {
        throw new Error('Ingresa un identificador de mesa válido');
      }

      const { error } = await supabase
        .from('tables')
        .insert([{
          business_id: businessId,
          table_number: tableIdentifier,
          status: 'available'
        }])
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este identificador de mesa ya existe');
        }
        throw error;
      }

      // Código de éxito
      setSuccess('✅ Mesa creada exitosamente');
      setNewTableNumber('');
      setShowAddForm(false);
      await loadMesas();
      
    } catch {
      
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
      setPendingQuantityUpdatesSafe({});
      setModalOpenIntent(true);
      setShowOrderDetails(true);
      await loadMesas();
    } catch {
      setError('❌ No se pudo abrir la mesa. Por favor, intenta de nuevo.');
    }
  }, [businessId, currentUser, loadMesas, setPendingQuantityUpdatesSafe]);

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
      setOrderItems((prevItems) =>
        mergeOrderItemsPreservingPosition(
          prevItems,
          applyPendingQuantities(order.order_items || [], pendingQuantityUpdatesRef.current)
        )
      );
      setPendingQuantityUpdatesSafe({});
      setModalOpenIntent(true);
      setShowOrderDetails(true);
    } catch {
      setError('❌ No se pudieron cargar los detalles de la orden. Por favor, intenta de nuevo.');
    }
  }, [setPendingQuantityUpdatesSafe]);

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
    } catch {
      // Error silencioso
    }
  }, [orderItems]);

  const persistPendingQuantityUpdates = useCallback(async (orderId) => {
    const pendingEntries = Object.entries(pendingQuantityUpdates || {});
    if (!orderId || pendingEntries.length === 0) return;

    const updateResults = await Promise.all(
      pendingEntries.map(([itemId, quantity]) =>
        supabase
          .from('order_items')
          .update({ quantity })
          .eq('id', itemId)
      )
    );

    const failedUpdate = updateResults.find((result) => result.error);
    if (failedUpdate?.error) throw failedUpdate.error;

    const { data: freshItems, error: reloadError } = await supabase
      .from('order_items')
      .select('*, products(name, code)')
      .eq('order_id', orderId)
      .order('id', { ascending: true });

    if (reloadError) throw reloadError;

    setPendingQuantityUpdatesSafe({});
    if (freshItems) {
      setOrderItems((prevItems) =>
        mergeOrderItemsPreservingPosition(
          prevItems,
          applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
        )
      );
    }
  }, [pendingQuantityUpdates, setPendingQuantityUpdatesSafe]);

  const removeItem = useCallback(async (itemId) => {
    try {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Actualización optimista: remover del estado local
      setOrderItems(prevItems => prevItems.filter(item => item.id !== itemId));
      setPendingQuantityUpdatesSafe(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });

      await updateOrderTotal(selectedMesa.current_order_id);
    } catch {
      setError('❌ No se pudo eliminar el producto. Por favor, intenta de nuevo.');
      // Revertir solo los items si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id)
        .order('id', { ascending: true });
      if (freshItems) {
        setOrderItems((prevItems) =>
          mergeOrderItemsPreservingPosition(
            prevItems,
            applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
          )
        );
      }
    }
  }, [selectedMesa, updateOrderTotal, setPendingQuantityUpdatesSafe]);

  const handleRefreshOrder = useCallback(async () => {
    if (!selectedMesa) return;
    
    try {
      await persistPendingQuantityUpdates(selectedMesa.current_order_id);

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
      setPendingQuantityUpdatesSafe({});
      setSearchProduct('');
      
      setSuccessTitle('✨ Mesa Actualizada');
      setSuccessDetails([
        { label: 'Mesa', value: `#${selectedMesa.table_number}` },
        { label: 'Estado', value: 'Actualizada' }
      ]);
      setAlertType('update');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('❌ No se pudo guardar la orden');
    }
  }, [selectedMesa, updateOrderTotal, persistPendingQuantityUpdates, setPendingQuantityUpdatesSafe]);

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
        setPendingQuantityUpdatesSafe(prev => {
          const next = { ...prev };
          delete next[existingItem.id];
          return next;
        });
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
          setOrderItems(prevItems => [optimisticItem, ...prevItems]);
        }
      }

      // Actualizar el total de forma optimista
      await updateOrderTotal(selectedMesa.current_order_id);
      setSearchProduct('');
      setQuantityToAdd(1); // Resetear cantidad
    } catch {
      setError('❌ No se pudo agregar el producto. Por favor, intenta de nuevo.');
      // Revertir solo los items si falla
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id)
        .order('id', { ascending: true });
      if (freshItems) {
        setOrderItems((prevItems) =>
          mergeOrderItemsPreservingPosition(
            prevItems,
            applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
          )
        );
      }
    }
  }, [selectedMesa, orderItems, quantityToAdd, updateOrderTotal, setPendingQuantityUpdatesSafe]);

  const updateItemQuantity = useCallback(async (itemId, newQuantity) => {
    try {
      if (newQuantity <= 0) {
        await removeItem(itemId);
        return;
      }

      // Actualizar solo estado local. Se persiste al presionar "Guardar".
      setOrderItems(prevItems =>
        prevItems.map(item => {
          if (item.id === itemId) {
            const newSubtotal = newQuantity * item.price;
            return { ...item, quantity: newQuantity, subtotal: newSubtotal };
          }
          return item;
        })
      );

      setPendingQuantityUpdatesSafe(prev => ({ ...prev, [itemId]: newQuantity }));
    } catch {
      setError('❌ No se pudo actualizar la cantidad. Por favor, intenta de nuevo.');
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('*, products(name, code)')
        .eq('order_id', selectedMesa.current_order_id)
        .order('id', { ascending: true });
      if (freshItems) {
        setOrderItems((prevItems) =>
          mergeOrderItemsPreservingPosition(
            prevItems,
            applyPendingQuantities(freshItems, pendingQuantityUpdatesRef.current)
          )
        );
      }
      setPendingQuantityUpdatesSafe({});
    }
  }, [selectedMesa, removeItem, setPendingQuantityUpdatesSafe]);

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
      } catch {
        // Rollback: recargar mesas para sincronizar estado
        try { await loadMesas(); } catch { /* no-op */ }
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
      setPendingQuantityUpdatesSafe({});
    }, backgroundWork);
  };

  const handleCloseOrder = () => {
    // Mostrar elección: pagar todo junto o dividir cuenta
    setShowCloseOrderChoiceModal(true);
  };

  const handlePayAllTogether = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(false);
    setAmountReceived(String(Math.round(orderTotal || 0)));
    setAmountReceivedError('');
    setShowPaymentModal(true);
  };

  const handleSplitBill = () => {
    setShowCloseOrderChoiceModal(false);
    setShowSplitBillModal(true);
  };

  const processSplitPaymentAndClose = async ({ subAccounts }) => {
    if (isClosingOrder) return;

    setIsClosingOrder(true);
    setIsGeneratingSplitSales(true);
    setError(null);

    const mesaSnapshot = selectedMesa ? { ...selectedMesa } : null;
    if (!mesaSnapshot?.id || !mesaSnapshot?.current_order_id) {
      setError('❌ No se encontró una orden activa para cerrar.');
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
      return;
    }

    try {
      await persistPendingQuantityUpdates(mesaSnapshot.current_order_id);

      const { totalSold } = await closeOrderAsSplit(businessId, {
        subAccounts,
        orderId: mesaSnapshot.current_order_id,
        tableId: mesaSnapshot.id
      });

      // Cerrar UI solo cuando la venta se confirmó en backend.
      justCompletedSaleRef.current = true;
      setCanShowOrderModal(false);
      setShowSplitBillModal(false);
      setShowCloseOrderChoiceModal(false);
      setShowPaymentModal(false);
      setShowOrderDetails(false);
      setModalOpenIntent(false);
      setSelectedMesa(null);
      setOrderItems([]);
      setPendingQuantityUpdatesSafe({});

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
        justCompletedSaleRef.current = false;
        setCanShowOrderModal(true);
      }, MODAL_REOPEN_GUARD_MS);
    } catch (error) {
      setError(`❌ ${error?.message || 'No se pudo cerrar la orden. Revirtiendo estado.'}`);
      try { await loadMesas(); } catch { /* no-op */ }
      try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch { /* no-op */ }
    } finally {
      setIsGeneratingSplitSales(false);
      setIsClosingOrder(false);
    }
  };

  const processPaymentAndClose = async () => {
    // Prevenir doble click
    if (isClosingOrder) return;

    const paymentSnapshot = paymentMethod;
    const amountReceivedSnapshot = amountReceived;
    const normalizedAmountReceived = parseCopAmount(amountReceivedSnapshot);
    const cashChangeData = paymentSnapshot === 'cash'
      ? calcularCambio(orderTotal, amountReceivedSnapshot)
      : null;

    if (paymentSnapshot === 'cash') {
      if (!cashChangeData?.isValid) {
        setError(cashChangeData?.reason === 'insufficient'
          ? '❌ El monto recibido es menor al total de la cuenta.'
          : '❌ Ingresa un monto recibido válido.');
        return;
      }
    }

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
    setPendingQuantityUpdatesSafe({});
    setPaymentMethod('cash');
    setAmountReceived('');
    setAmountReceivedError('');
    setSelectedCustomer('');

    // Prevent realtime reopens while background processes
    justCompletedSaleRef.current = true;
    setCanShowOrderModal(false);

    (async () => {
      try {
        await persistPendingQuantityUpdates(mesaSnapshot.current_order_id);

        const { saleTotal } = await closeOrderSingle(businessId, {
          orderId: mesaSnapshot.current_order_id,
          tableId: mesaSnapshot.id,
          paymentMethod: paymentSnapshot,
          amountReceived: paymentSnapshot === 'cash' ? normalizedAmountReceived : null,
          changeBreakdown: paymentSnapshot === 'cash' ? cashChangeData?.breakdown || [] : []
        });

        loadMesas().catch(() => {});

        setSuccessDetails([
          { label: 'Total', value: formatPrice(saleTotal) },
          { label: 'Mesa', value: `#${mesaSnapshot.table_number}` },
          { label: 'Método', value: getPaymentMethodLabel(paymentSnapshot) },
          ...(paymentSnapshot === 'cash'
            ? [
                { label: 'Recibido', value: formatPrice(Number.isFinite(normalizedAmountReceived) ? normalizedAmountReceived : 0) },
                { label: 'Cambio', value: formatPrice(Math.max((Number.isFinite(normalizedAmountReceived) ? normalizedAmountReceived : 0) - (Number(saleTotal) || 0), 0)) }
              ]
            : [])
        ]);
        setSuccessTitle('✨ Mesa Cerrada');
        setAlertType('success');
        setSuccess(true);

        setTimeout(() => {
          justCompletedSaleRef.current = false;
          setCanShowOrderModal(true);
        }, MODAL_REOPEN_GUARD_MS);
      } catch (error) {
        setError(`❌ ${error?.message || 'No se pudo cerrar la orden. Revirtiendo estado.'}`);
        try { await loadMesas(); } catch { /* no-op */ }
        try { justCompletedSaleRef.current = false; setCanShowOrderModal(true); } catch { /* no-op */ }
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
    const printerWidthMm = getThermalPaperWidthMm();
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Orden Mesa ${selectedMesa.table_number}</title>
        <style>
          @media print {
            @page {
              size: ${printerWidthMm}mm auto;
              margin: 2mm;
            }
            html, body {
              width: ${printerWidthMm}mm !important;
              height: auto !important;
              margin: 0;
              padding: 0;
            }
            .receipt {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
          
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            width: ${printerWidthMm}mm;
            max-width: ${printerWidthMm}mm;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            background: #fff;
          }

          .receipt {
            display: block;
            width: 100%;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
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
        <div class="receipt">
        <div class="header">
          <h1>ORDEN DE COCINA</h1>
          <p>Mesa #${selectedMesa.table_number}</p>
          <p>${formatDateTimeTicket(new Date())}</p>
        </div>
        
        <div class="info">
          <p><strong>Estado:</strong> ${selectedMesa.status === 'occupied' ? 'Ocupada' : 'Disponible'}</p>
          <p><strong>Productos:</strong> ${getTotalProductUnits(itemsParaCocina)} item${getTotalProductUnits(itemsParaCocina) !== 1 ? 's' : ''}</p>
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
      } catch {
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

  const cambioPago = useMemo(() => {
    if (paymentMethod !== 'cash') return null;
    if (amountReceived === '' || amountReceived === null) {
      return { isValid: false, reason: 'empty', change: 0, breakdown: [] };
    }
    return calcularCambio(orderTotal, amountReceived);
  }, [paymentMethod, orderTotal, amountReceived]);

  const isCashPaymentInvalid = useMemo(() => (
    paymentMethod === 'cash'
    && amountReceived !== ''
    && cambioPago
    && !cambioPago.isValid
  ), [paymentMethod, amountReceived, cambioPago]);

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
      emptyAction={
        <Button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          Crear Primera Mesa
        </Button>
      }
      bypassStateRendering={showAddForm}
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
            {/* Alerta de procesamiento de ventas divididas */}
            <SaleUpdateAlert
              isVisible={isGeneratingSplitSales}
              onClose={() => setIsGeneratingSplitSales(false)}
              title="Generando ventas...."
              details={[]}
              duration={600000}
            />

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
              isVisible={!!error}
              onClose={() => setError(null)}
              title="❌ Error"
              message={error || ''}
              details={[]}
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
                          Identificador de Mesa *
                        </label>
                        <Input
                          type="text"
                          value={newTableNumber}
                          onChange={(e) => setNewTableNumber(e.target.value)}
                          placeholder="Ej: 1, A1, Terraza-2..."
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
                          {getTotalProductUnits(mesa.orders.order_items || [])} productos
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
                                {producto.name}
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
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-primary-900 text-sm sm:text-base leading-tight">
                                        {item.products?.name}
                                      </h4>
                                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                          {formatPrice(parseFloat(item.price))} por unidad
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-lg font-bold text-primary-900">
                                        {formatPrice(parseFloat(item.subtotal))}
                                      </p>
                                      <p className="text-[11px] text-accent-600">Subtotal</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t border-accent-100">
                                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-white p-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                        disabled={updatingItemId !== null}
                                        className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        -
                                      </Button>
                                      <span className="w-10 text-center font-bold text-primary-900">
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-3 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full my-2 sm:my-4"
            >
              <Card className="border-0">
                <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-primary-900">
                    💳 Confirmar Pago
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1 bg-accent-50 rounded-2xl border-2 border-accent-200 p-4 sm:p-5">
                      <p className="text-xs uppercase tracking-wide text-primary-600 mb-1">Total a pagar</p>
                      <h3 className="text-3xl sm:text-4xl font-bold text-primary-900">
                        {formatPrice(orderTotal)}
                      </h3>
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-primary-600">Cambio a devolver</span>
                          <span className={`font-bold ${paymentMethod === 'cash' && cambioPago?.isValid ? 'text-green-700' : 'text-primary-900'}`}>
                            {paymentMethod === 'cash' && cambioPago?.isValid ? formatPrice(cambioPago.change) : formatPrice(0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-1 space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                          Método de Pago *
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => {
                            const nextMethod = e.target.value;
                            setPaymentMethod(nextMethod);
                            if (nextMethod !== 'cash') {
                              setAmountReceivedError('');
                            }
                          }}
                          className="w-full h-11 px-3 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        >
                          <option value="cash">💵 Efectivo</option>
                          <option value="card">💳 Tarjeta</option>
                          <option value="transfer">🏦 Transferencia</option>
                          <option value="mixed">🔄 Mixto</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                          Cliente (Opcional)
                        </label>
                        <select
                          value={selectedCustomer}
                          onChange={(e) => setSelectedCustomer(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border-2 border-accent-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                        >
                          <option value="">Venta general</option>
                          {clientes.map(cliente => (
                            <option key={cliente.id} value={cliente.id}>
                              {cliente.full_name} - {cliente.email}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-primary-700 mb-1.5">
                          Monto recibido
                        </label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="50"
                          value={amountReceived}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setAmountReceived(nextValue);

                            if (paymentMethod !== 'cash') {
                              setAmountReceivedError('');
                              return;
                            }

                            if (nextValue === '') {
                              setAmountReceivedError('Ingresa el monto recibido.');
                              return;
                            }

                            const validation = calcularCambio(orderTotal, nextValue);
                            if (!validation.isValid) {
                              if (validation.reason === 'insufficient') {
                                setAmountReceivedError('El monto recibido es menor al total.');
                                return;
                              }
                              setAmountReceivedError('Ingresa un monto recibido válido.');
                              return;
                            }

                            setAmountReceivedError('');
                          }}
                          className={`h-11 border-2 ${amountReceivedError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-accent-300 focus:border-primary-500 focus:ring-primary-200'} transition-all`}
                          placeholder="Ej: 100000"
                        />
                        {amountReceivedError && paymentMethod === 'cash' && (
                          <p className="mt-1.5 text-xs text-red-600">{amountReceivedError}</p>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-1 rounded-xl border border-accent-200 bg-white p-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-primary-600">Desglose del cambio</p>
                      {paymentMethod === 'cash' && cambioPago?.isValid && cambioPago.change > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
                          {cambioPago.breakdown.map(({ denomination, count }) => (
                            <p key={denomination} className="text-sm text-primary-700">
                              {count} x {formatPrice(denomination)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-primary-600">Sin cambio para devolver.</p>
                      )}
                    </div>
                  </div>

                  {insufficientItems.length > 0 && (
                    <div className="p-3 rounded-lg border border-red-200 bg-red-50 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">Stock insuficiente ({insufficientItems.length})</p>
                          <p className="text-xs text-red-700">Corrige antes de cerrar la orden.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {insufficientItems.map(it => (
                          <div key={it.id || `${it.product_id}-${it.quantity}`} className="text-xs text-red-700">
                            <strong className="text-primary-900">{it.product_name}</strong>
                            <div>Disp: {it.available_stock} / Ped: {it.quantity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentMethod('cash');
                        setAmountReceived('');
                        setAmountReceivedError('');
                        setSelectedCustomer('');
                      }}
                      disabled={isClosingOrder}
                      className="flex-1 h-12 border-2 border-accent-300 text-accent-700 hover:bg-accent-50 disabled:opacity-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={processPaymentAndClose}
                      disabled={isClosingOrder || (paymentMethod === 'cash' && (amountReceived === '' || isCashPaymentInvalid))}
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
