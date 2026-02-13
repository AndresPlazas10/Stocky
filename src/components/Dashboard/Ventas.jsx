import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client';
import { getFilteredSales } from '../../services/salesService';
import { createSaleOptimized, recordSaleCreationTime } from '../../services/salesServiceOptimized';
import SalesFilters from '../Filters/SalesFilters';
import { sendInvoiceEmail } from '../../utils/emailService.js';
import { formatPrice, formatNumber, formatDate, formatDateOnly, formatDateTimeTicket } from '../../utils/formatters.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import { queryCache } from '../../utils/queryCache.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import Pagination from '../Pagination';
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
  Printer
} from 'lucide-react';
import ComprobanteDisclaimer from '../Legal/ComprobanteDisclaimer';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';

// Función helper pura fuera del componente (no se recrea en renders)
const getVendedorName = (venta) => {
  // Prioridad 1: rol resuelto por joins (evita mostrar "Empleado" si el user es admin/owner)
  if (venta?.employees?.role === 'owner' || venta?.employees?.role === 'admin') {
    return 'Administrador';
  }

  // Prioridad 1: seller_name guardado en la venta (ventas nuevas)
  if (venta?.seller_name && typeof venta.seller_name === 'string' && venta.seller_name.trim() !== '') {
    return venta.seller_name;
  }
  
  // Prioridad 2: Fallback a employees join (ventas antiguas)
  if (!venta.employees) return 'Empleado';
  if (venta.employees.role === 'owner' || venta.employees.role === 'admin') return 'Administrador';
  return venta.employees.full_name || 'Empleado';
};

function Ventas({ businessId, userRole = 'admin' }) {
  const [ventas, setVentas] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [currentFilters, setCurrentFilters] = useState({});
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successDetails, setSuccessDetails] = useState([]);
  const [successTitle, setSuccessTitle] = useState('✨ Venta Registrada');
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
  
  // Estados para facturación electrónica
  const [generateInvoice, setGenerateInvoice] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerIdNumber, setCustomerIdNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  
  // Modal de facturación
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
  const [invoiceCustomerEmail, setInvoiceCustomerEmail] = useState('');
  const [invoiceCustomerIdNumber, setInvoiceCustomerIdNumber] = useState('');
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Funciones de carga memoizadas SIN cache para evitar problemas de actualización
  const loadVentas = useCallback(async (filters = currentFilters, pagination = {}) => {
    try {
      const lim = Number(pagination.limit ?? limit);
      const off = Number(pagination.offset ?? ((page - 1) * lim));
      const includeCount = pagination.includeCount !== false;
      const countMode = pagination.countMode || 'exact';
      
      // SIEMPRE cargar datos frescos - sin caché
      const { data, count } = await getFilteredSales(businessId, filters, {
        limit: lim,
        offset: off,
        includeCount,
        countMode
      });
      
      setVentas(data || []);
      if (typeof count === 'number') {
        setTotalCount(count);
      }
    } catch (err) {
      setVentas([]);
      setTotalCount(0);
    }
  }, [businessId, page, limit, currentFilters]);

  const loadProductos = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, sale_price, stock, category')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
      .limit(200);

    if (error) throw error;
    setProductos(data || []);
  }, [businessId]);

  const loadClientes = useCallback(async () => {
    // Tabla customers eliminada - ya no se usa
    setClientes([]);
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
        .maybeSingle();

      // Si existe en employees, es empleado (NO puede eliminar ventas)
      setIsEmployee(!!data);
    } catch (error) {
      // Si hay error, asumimos que NO es empleado (es admin)
      setIsEmployee(false);
    }
  }, [businessId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Verificar sesión ANTES de cargar datos
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user?.id) {
        setError('⚠️ Tu sesión ha expirado. Redirigiendo al login...');
        setLoading(false);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      setSessionChecked(true);
      
      await Promise.all([
        loadVentas(),
        loadProductos(),
        checkIfEmployee()
      ]);
    } catch (error) {
      setError('⚠️ No se pudo cargar la información. Por favor, intenta recargar la página.');
    } finally {
      setLoading(false);
    }
  }, [loadVentas, loadProductos]);

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId, loadData]);

  // 🔥 TIEMPO REAL: Suscripción a cambios en ventas
  useRealtimeSubscription('sales', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onInsert: (newSale) => {
      const sellerName = typeof newSale?.seller_name === 'string' ? newSale.seller_name.trim() : '';
      const isAdminSeller = sellerName.toLowerCase() === 'administrador';

      const saleWithDetails = {
        ...newSale,
        employees: isAdminSeller
          ? { full_name: 'Administrador', role: 'owner' }
          : { full_name: sellerName || 'Vendedor desconocido', role: 'employee' }
      };

      // Verificar si la venta ya existe antes de agregarla
      setVentas(prev => {
        const exists = prev.some(v => v.id === newSale.id);
        if (exists) {
          return prev;
        }
        return [saleWithDetails, ...prev];
      });
      
      // Incrementar el contador total
      setTotalCount(prev => prev + 1);
      
      setSuccess('✨ Nueva venta registrada');
      setTimeout(() => setSuccess(null), 3000);
    },
    onUpdate: (updatedSale) => {
      setVentas(prev => prev.map(v => v.id === updatedSale.id ? { ...v, ...updatedSale } : v));
    },
    onDelete: (deletedSale) => {
      setVentas(prev => prev.filter(v => v.id !== deletedSale.id));
      setTotalCount(prev => Math.max(0, prev - 1));
    }
  });

  // 🔥 TIEMPO REAL: Suscripción a cambios en productos (para stock)
  useRealtimeSubscription('products', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    onUpdate: (updatedProduct) => {
      setProductos(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      // Mantener stock disponible del carrito sincronizado con cambios en tiempo real
      setCart(prevCart => prevCart.map(item =>
        item.product_id === updatedProduct.id
          ? { ...item, available_stock: updatedProduct.stock }
          : item
      ));
    },
    onDelete: (deletedProduct) => {
      setProductos(prev => prev.filter(p => p.id !== deletedProduct.id));
      setCart(prevCart => prevCart.map(item =>
        item.product_id === deletedProduct.id
          ? { ...item, available_stock: 0 }
          : item
      ));
    }
  });

  // Memoizar funciones del carrito
  const addToCart = useCallback((producto) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === producto.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.product_id === producto.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        );
      } else {
        return [...prevCart, {
          product_id: producto.id,
          name: producto.name,
          code: producto.code,
          quantity: 1,
          unit_price: producto.sale_price,
          subtotal: producto.sale_price,
          available_stock: producto.stock
        }];
      }
    });
    setSearchProduct('');
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => {
      return prevCart.map(item =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.unit_price }
          : item
      );
    });
  }, [removeFromCart]);

  // Memoizar cálculo de total
  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  // Stock en vivo por producto para evitar desincronización en carrito
  const stockByProductId = useMemo(() => {
    const map = new Map();
    productos.forEach((producto) => map.set(producto.id, Number(producto.stock ?? 0)));
    return map;
  }, [productos]);

  const processSale = useCallback(async () => {
    if (isSubmitting) return; // Prevenir doble click
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (cart.length === 0) {
        throw new Error('⚠️ El carrito está vacío. Agrega productos antes de procesar la venta.');
      }

      // Verificar sesión antes de procesar
      if (!sessionChecked) {
        throw new Error('⚠️ Verificando sesión...');
      }

      // Calcular total del carrito
      const saleTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // 🚀 USAR FUNCIÓN OPTIMIZADA: Una sola llamada RPC
      const startTime = performance.now();
      
      const result = await createSaleOptimized({
        businessId,
        cart,
        paymentMethod,
        total: saleTotal
      });

      const elapsedMs = performance.now() - startTime;
      
      if (!result.success) {
        throw new Error(result.error || 'Error al procesar la venta');
      }

      // Registrar latencia para debugging
      recordSaleCreationTime(elapsedMs);

      // Mostrar alerta con detalles de la venta
      setSuccessTitle('✨ Venta Registrada');
      setSuccessDetails([
        { label: 'Total', value: formatPrice(saleTotal) },
        { label: 'Tiempo', value: `${elapsedMs.toFixed(0)}ms` },
        { label: 'Artículos', value: cart.length }
      ]);
      setAlertType('success');
      setSuccess(true);
      
      // Limpiar el carrito y cerrar POS
      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('cash');
      setShowSaleModal(false);

      // Recargar ventas inmediatamente
      await loadVentas(currentFilters, { limit, offset: (page - 1) * limit, includeCount: false });
      
    } catch (error) {
      
      // Si es error de sesión, redirigir a login
      if (error.message.includes('sesión ha expirado')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      setError('❌ ' + (error.message || 'No se pudo procesar la venta. Por favor, intenta de nuevo.'));
    } finally {
      setIsSubmitting(false); // SIEMPRE desbloquear
    }
  }, [cart, sessionChecked, businessId, paymentMethod, total, loadVentas, isSubmitting]);

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
      // Eliminar detalles de venta primero
      const { error: detailsError } = await supabase
        .from('sale_details')
        .delete()
        .eq('sale_id', saleToDelete);

      if (detailsError) throw new Error('Error al eliminar detalles: ' + detailsError.message);

      // Eliminar la venta
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleToDelete);

      if (deleteError) throw new Error('Error al eliminar venta: ' + deleteError.message);

      setSuccessTitle('🗑️ Venta Eliminada');
      setSuccessDetails([
        { label: 'Acción', value: 'Venta eliminada correctamente' }
      ]);
      setAlertType('error');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      // Recargar ventas
      await loadVentas(currentFilters, { limit, offset: (page - 1) * limit, includeCount: false });

      setShowDeleteModal(false);
      setSaleToDelete(null);

    } catch (error) {
      setError('❌ ' + (error.message || 'Error al eliminar la venta'));
      setTimeout(() => setError(null), 8000);
      setShowDeleteModal(false);
      setSaleToDelete(null);
    } finally {
      setLoading(false);
    }
  };

  // Función para imprimir factura física
  const handlePrintInvoice = async (venta) => {
    // Cargar detalles de la venta
    const { data: saleDetails } = await supabase
      .from('sale_details')
      .select('*, products(name, code)')
      .eq('sale_id', venta.id);

    if (!saleDetails || saleDetails.length === 0) {
      setError('No se pudieron cargar los detalles de la venta');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Crear contenido HTML para impresión
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprobante de Pago #${venta.id}</title>
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
            font-size: 18px;
            margin: 0 0 5px 0;
            font-weight: bold;
          }
          
          .header p {
            margin: 2px 0;
            font-size: 11px;
          }
          
          .info {
            margin: 10px 0;
            font-size: 11px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          
          .separator {
            border-top: 1px dashed #000;
            margin: 10px 0;
          }
          
          .items-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            border-bottom: 1px solid #000;
            padding: 5px 0;
            font-size: 11px;
          }
          
          .item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 11px;
          }
          
          .item-name {
            flex: 1;
            padding-right: 5px;
          }
          
          .item-qty {
            width: 40px;
            text-align: center;
          }
          
          .item-price {
            width: 70px;
            text-align: right;
          }
          
          .totals {
            margin-top: 15px;
            border-top: 2px solid #000;
            padding-top: 10px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
          }
          
          .total-row.final {
            font-size: 16px;
            font-weight: bold;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #000;
          }
          
          .payment-info {
            margin: 15px 0;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 5px;
            text-align: center;
            font-size: 11px;
          }
          
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 10px;
          }
          
          .legal-notice {
            margin-top: 15px;
            padding: 8px;
            border-top: 1px dashed #000;
            font-size: 9px;
            text-align: center;
            line-height: 1.4;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>═══════════════════════════════════</h1>
          <h1>COMPROBANTE DE VENTA</h1>
          <h1>═══════════════════════════════════</h1>
          <p style="margin: 10px 0; font-size: 9px; border-top: 1px dashed #000; padding-top: 8px;">
            Sistema Stocky<br>
            ${venta.created_at ? formatDateTimeTicket(venta.created_at) : 'Fecha no disponible'}
          </p>
        </div>
        
        <div class="info">
          <div class="info-row">
            <span><strong>Comprobante #:</strong></span>
            <span>CPV-${String(venta.id).substring(0, 8).toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span><strong>Vendedor:</strong></span>
            <span>${getVendedorName(venta)}</span>
          </div>
          <div class="info-row">
            <span><strong>Cliente:</strong></span>
            <span>Venta general</span>
          </div>
        </div>
        
        <div class="separator"></div>
        
        <div class="items-header">
          <span style="flex: 1;">Producto</span>
          <span style="width: 40px; text-align: center;">Cant.</span>
          <span style="width: 70px; text-align: right;">Total</span>
        </div>
        
        ${saleDetails.map(item => `
          <div class="item">
            <div class="item-name">${item.products?.name || 'Producto'}</div>
            <div class="item-qty">x${item.quantity}</div>
            <div class="item-price">${formatPrice(item.subtotal)}</div>
          </div>
        `).join('')}
        
        <div class="totals">
          <div class="total-row final">
            <span>TOTAL:</span>
            <span>${formatPrice(venta.total)}</span>
          </div>
        </div>
        
        <div class="payment-info">
          <strong>Método de Pago:</strong><br>
          ${venta.payment_method === 'cash' ? '💵 Efectivo' : 
            venta.payment_method === 'card' ? '💳 Tarjeta' :
            venta.payment_method === 'transfer' ? '🏦 Transferencia' :
            '🔀 Mixto'}
        </div>
        
        <div class="footer">
          <p>¡Gracias por su compra!</p>
          <div style="margin: 12px 0; padding: 8px; background: #f9f9f9; border-radius: 4px; border-left: 3px solid #666;">
            <p style="margin: 0 0 4px 0; font-size: 8px; font-weight: bold; color: #333; text-transform: uppercase; letter-spacing: 0.5px;">
              💬 Frase del día
            </p>
            <p style="margin: 0; font-size: 9px; font-style: italic; color: #555; line-height: 1.4;">
              "${(() => {
                const frases = [
                  'El éxito es la suma de pequeños esfuerzos repetidos día tras día.', 
                  'La mejor manera de predecir el futuro es crearlo.', 
                  'El cliente no siempre tiene la razón, pero siempre es el cliente.',
                  'La calidad nunca es un accidente; siempre es el resultado del esfuerzo.',
                  'Haz que cada cliente se sienta único y especial.',
                  'El secreto del cambio es enfocar toda tu energía no en luchar contra lo viejo, sino en construir lo nuevo.',
                  'Tu actitud determina tu dirección.',
                  'Los negocios exitosos se construyen con relaciones, no con transacciones.',
                  'La excelencia no es un acto, es un hábito.',
                  'Cada día es una nueva oportunidad para mejorar.'
                ];
                const hoy = new Date();
                const inicioDia = new Date(hoy.getFullYear(), 0, 0);
                const diff = hoy - inicioDia;
                const unDia = 1000 * 60 * 60 * 24;
                const diaDelAno = Math.floor(diff / unDia);
                return frases[diaDelAno % frases.length];
              })()}"
            </p>
          </div>
          <p style="margin: 10px 0; font-size: 8px; border-top: 1px dashed #000; padding-top: 5px;">
            Generado por Stocky - Sistema de Gestión POS<br>
            www.stockypos.app
          </p>
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

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSaleToDelete(null);
  };

  // Memoizar productos filtrados
  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return productos;
    
    const search = searchProduct.toLowerCase();
    return productos.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.code?.toLowerCase().includes(search)
    );
  }, [productos, searchProduct]);
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

  // Memoizar función de modal de factura
  const openInvoiceModal = useCallback(async (venta) => {
    // Campos de cliente vacíos (tabla customers eliminada)
    setInvoiceCustomerName('');
    setInvoiceCustomerEmail('');
    setInvoiceCustomerIdNumber('');

    // Cargar detalles de la venta
    const { data: saleDetails } = await supabase
      .from('sale_details')
      .select(`
        *,
        products(name)
      `)
      .eq('sale_id', venta.id);
    
    setSelectedSale({ ...venta, sale_details: saleDetails || [] });
    setShowInvoiceModal(true);
  }, []);

  // Generar factura desde una venta existente (memoizado)
  const generateInvoiceFromSale = useCallback(async () => {
    if (!invoiceCustomerEmail || !invoiceCustomerEmail.includes('@')) {
      setError('⚠️ Debes ingresar un email válido para enviar el comprobante');
      return;
    }
    if (!invoiceCustomerName) {
      setError('⚠️ Debes ingresar el nombre del cliente para enviar el comprobante');
      return;
    }

    try {
      setGeneratingInvoice(true);
      setError(null);

      // Obtener detalles de la venta
      const { data: saleDetails, error: detailsError } = await supabase
        .from('sale_details')
        .select(`
          *,
          products(name)
        `)
        .eq('sale_id', selectedSale.id);

      if (detailsError) throw detailsError;

      const total = selectedSale.total;

      // Generar número de comprobante (usando la venta existente)
      const comprobanteNumber = `COMP-${selectedSale.id.substring(0, 8).toUpperCase()}`;

      // Preparar items para el email
      const emailItems = saleDetails.map(detail => ({
        product_name: detail.products?.name || detail.product_name || 'Producto',
        quantity: detail.quantity,
        unit_price: detail.unit_price
      }));

      // Obtener nombre del negocio
      const { data: businessData } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', businessId)
        .single();

      // Enviar comprobante por email
      const emailResult = await sendInvoiceEmail({
        email: invoiceCustomerEmail,
        invoiceNumber: comprobanteNumber,
        customerName: invoiceCustomerName,
        total: total,
        items: emailItems,
        businessName: businessData?.name || 'Stocky',
        issuedAt: selectedSale?.created_at || new Date().toISOString()
      });

      if (emailResult.success) {
        setSuccess(`✅ Comprobante enviado exitosamente a ${invoiceCustomerEmail}`);
      } else {
        throw new Error(emailResult.error || 'Error al enviar el comprobante');
      }

      // Cerrar modal y limpiar
      setShowInvoiceModal(false);
      setInvoiceCustomerName('');
      setInvoiceCustomerEmail('');
      setInvoiceCustomerIdNumber('');
      setSelectedSale(null);

    } catch (error) {
      setError('❌ ' + (error.message || 'No se pudo enviar el comprobante. Por favor, intenta de nuevo.'));
    } finally {
      setGeneratingInvoice(false);
    }
  }, [businessId, selectedSale, invoiceCustomerName, invoiceCustomerEmail, invoiceCustomerIdNumber]);

  return (
    <AsyncStateWrapper
      loading={loading}
      error={ventas.length === 0 ? error : null}
      dataCount={ventas.length}
      onRetry={loadData}
      skeletonType="ventas"
      hasFilters={Boolean(currentFilters && Object.keys(currentFilters).length > 0)}
      noResultsTitle="No hay ventas para esos filtros"
      noResultsDescription="Ajusta los filtros o registra una nueva venta."
      noResultsAction={
        <Button
          type="button"
          onClick={() => setShowSaleModal(true)}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          Nueva Venta
        </Button>
      }
      emptyTitle="Aun no hay ventas registradas"
      emptyDescription="Las ventas apareceran aqui en tiempo real cuando registres la primera."
      emptyAction={
        <Button
          type="button"
          onClick={() => setShowSaleModal(true)}
          className="gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 py-2 rounded-xl"
        >
          Crear Primera Venta
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
                <h1 className="text-2xl sm:text-3xl font-bold">Ventas</h1>
                <p className="text-white/80 mt-1 text-sm sm:text-base">Sistema de punto de venta</p>
              </div>
            </div>
            <Button
              onClick={() => setShowSaleModal(!showSaleModal)}
              className="w-full sm:w-auto gradient-primary text-white hover:opacity-90 transition-all duration-300 shadow-lg font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showSaleModal ? (
                <>
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="whitespace-nowrap">Ver Historial</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="whitespace-nowrap">Nueva Venta</span>
                </>
              )}
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
        <SaleSuccessAlert 
          isVisible={success && alertType === 'success'}
          onClose={() => setSuccess(false)}
          title={successTitle}
          details={successDetails}
          duration={6000}
        />
        <SaleErrorAlert 
          isVisible={success && alertType === 'error'}
          onClose={() => setSuccess(false)}
          title={successTitle}
          details={successDetails}
          duration={7000}
        />
      </AnimatePresence>

      {!showSaleModal && (
        <SalesFilters
          businessId={businessId}
          onApply={(filters) => {
            setCurrentFilters(filters || {});
            setPage(1);
            loadVentas(filters || {}, { limit, offset: 0, includeCount: true, countMode: 'exact' });
          }}
          onClear={() => {
            setCurrentFilters({});
            setPage(1);
            loadVentas({}, { limit, offset: 0, includeCount: true, countMode: 'exact' });
          }}
        />
      )}

      {/* Modal para Nueva Venta */}
      <AnimatePresence>
        {showSaleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => {
              setShowSaleModal(false);
              // Limpiar carrito al cerrar
              setCart([]);
              setSelectedCustomer('');
              setPaymentMethod('cash');
              setSearchProduct('');
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[94vh] overflow-hidden my-1 sm:my-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del Modal */}
              <div className="gradient-primary p-4 sm:p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Nueva Venta</h2>
                </div>
                <button
                  onClick={() => {
                    setShowSaleModal(false);
                    setCart([]);
                    setSelectedCustomer('');
                    setPaymentMethod('cash');
                    setSearchProduct('');
                  }}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Contenido del Modal */}
              <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(94vh-80px)]">
                <div className="grid xl:grid-cols-2 gap-3 sm:gap-6">
          {/* Panel izquierdo - Productos */}
          <Card className="shadow-xl rounded-2xl bg-white border-none">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 gradient-primary rounded-lg">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-accent-600">Productos</h3>
              </div>
              
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  className="pl-10 h-12 rounded-xl border-gray-300 focus:border-[#edb886] focus:ring-[#edb886]"
                  placeholder="Buscar producto por nombre o código..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[42vh] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 lg:col-span-2">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No hay productos disponibles</p>
                  </div>
                ) : (
                  filteredProducts.map(producto => (
                    <motion.div
                      key={producto.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="cursor-pointer"
                    >
                      <Card
                        className="h-full hover:shadow-lg transition-all duration-300 rounded-xl border-gray-200 bg-gradient-to-br from-white to-gray-50 overflow-hidden"
                        onClick={() => addToCart(producto)}
                      >
                        <div className="p-3 sm:p-4 h-full flex flex-col gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-accent-600 text-base sm:text-lg truncate" title={producto.name}>
                              {producto.name}
                            </p>
                            <p className="text-sm text-gray-500 mt-1 truncate" title={producto.code}>
                              Código: {producto.code}
                            </p>
                            <Badge 
                              className={`mt-2 ${
                                producto.stock > 10 
                                  ? 'bg-green-100 text-green-800' 
                                  : producto.stock > 0 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              Stock: {producto.stock}
                            </Badge>
                          </div>
                          <div className="mt-auto flex items-end justify-between gap-3">
                            <p className="text-lg sm:text-xl font-bold text-secondary-600">
                              {formatPrice(producto.sale_price)}
                            </p>
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                              <Plus className="w-5 h-5" />
                            </span>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </Card>

          {/* Panel derecho - Carrito */}
          <Card className="shadow-xl rounded-2xl bg-white border-none">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 gradient-primary rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-accent-600">Carrito de Venta</h3>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Cliente (opcional)
                  </label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#edb886] focus:ring-[#edb886] transition-all duration-300"
                  >
                    <option value="">Venta general</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Método de pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#edb886] focus:ring-[#edb886] transition-all duration-300"
                  >
                    <option value="cash">💵 Efectivo</option>
                    <option value="card">💳 Tarjeta</option>
                    <option value="transfer">🏦 Transferencia</option>
                    <option value="mixed">🔀 Mixto</option>
                  </select>
                </div>
              </div>

              {/* DESHABILITADO - Requiere dominio verificado en Resend */}
              {/* Opción de Facturación Electrónica */}

              <div className="border-t border-gray-200 pt-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Items en el carrito:</p>
                <div className="space-y-2 max-h-[34vh] sm:max-h-[280px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">El carrito está vacío</p>
                      <p className="text-sm mt-1">Selecciona productos para agregar</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <motion.div
                        key={item.product_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 rounded-xl">
                          <div className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-bold text-accent-600">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.code}</p>
                              </div>
                              <Button
                                onClick={() => removeFromCart(item.product_id)}
                                className="h-7 w-7 p-0 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg border-none"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1 w-fit">
                                <button
                                  onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                                  min="1"
                                  className="w-12 text-center border-none focus:outline-none focus:ring-0 font-bold text-accent-600"
                                />
                                <button
                                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors"
                                >
                                  +
                                </button>
                              </div>
                              <p className="text-lg font-bold text-secondary-600">
                                {formatPrice(item.subtotal)}
                              </p>
                            </div>
                            {(() => {
                              const liveStock = stockByProductId.get(item.product_id);
                              const available = Number.isFinite(liveStock) ? liveStock : item.available_stock;
                              return typeof available === 'number' && item.quantity > available;
                            })() && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                <div className="flex items-center gap-3">
                                  <AlertCircle className="w-5 h-5 text-red-600" />
                                  <div>
                                    <p className="text-sm font-semibold text-red-800">⚠️ Stock quedará negativo</p>
                                    <p className="text-xs text-red-700">
                                      Disponibles: {Number.isFinite(stockByProductId.get(item.product_id)) ? stockByProductId.get(item.product_id) : item.available_stock} — Pedido: {item.quantity}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              <Card className="gradient-primary text-white shadow-lg rounded-xl border-none mb-3 sm:mb-4">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-6 h-6" />
                    <span className="text-lg font-semibold">Total:</span>
                  </div>
                  <span className="text-3xl font-bold">{formatPrice(total)}</span>
                </div>
              </Card>

              <Button
                onClick={processSale}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full h-11 sm:h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold text-sm sm:text-lg rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Procesando venta...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    Completar Venta
                  </>
                )}
              </Button>
            </div>
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
          {ventas.length === 0 ? (
            <Card className="shadow-xl rounded-2xl bg-white border-none">
              <div className="p-12 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium text-lg mb-2">No hay ventas registradas</p>
                <p className="text-gray-400">Haz clic en "Nueva Venta" para comenzar</p>
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
                {ventas.map((venta, index) => (
                  <motion.div
                    key={venta.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="shadow-lg rounded-2xl bg-white border-2 border-accent-100 hover:border-primary-300 hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Información principal */}
                          <div className="flex-1 space-y-3">
                            {/* Fecha y hora */}
                            <div className="flex items-center gap-2 text-accent-600">
                              <Calendar className="w-4 h-4 shrink-0" />
                              <span className="text-sm font-medium">
                                {venta.created_at ? formatDate(venta.created_at) : 'Fecha no disponible'}
                              </span>
                            </div>

                            {/* Cliente y Vendedor */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-primary-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-accent-500 uppercase tracking-wide">Cliente</p>
                                  <p className="text-sm font-semibold text-primary-900 truncate">
                                    Venta general
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-accent-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-accent-500 uppercase tracking-wide">Vendedor</p>
                                  <p className="text-sm font-medium text-gray-700 truncate">
                                    {getVendedorName(venta)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Método de pago */}
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-accent-600 shrink-0" />
                              <Badge 
                                className={`${
                                  venta.payment_method === 'cash' 
                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                    : venta.payment_method === 'card'
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : venta.payment_method === 'transfer'
                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                                    : 'bg-orange-100 text-orange-800 border-orange-200'
                                } border`}
                              >
                                {venta.payment_method === 'cash' && '💵 Efectivo'}
                                {venta.payment_method === 'card' && '💳 Tarjeta'}
                                {venta.payment_method === 'transfer' && '🏦 Transferencia'}
                                {venta.payment_method === 'mixed' && '🔀 Mixto'}
                              </Badge>
                            </div>
                          </div>

                          {/* Total y Acciones */}
                          <div className="flex flex-col sm:items-end gap-3 sm:border-l sm:border-accent-200 sm:pl-6">
                            {/* Total */}
                            <div className="text-left sm:text-right">
                              <p className="text-xs text-accent-500 uppercase tracking-wide mb-1">Total</p>
                              <p className="text-2xl sm:text-3xl font-bold text-primary-900">
                                {formatPrice(venta.total)}
                              </p>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <Button
                                onClick={async () => {
                                  // Cargar detalles de la venta
                                  const { data: saleDetails } = await supabase
                                    .from('sale_details')
                                    .select('*, products(name)')
                                    .eq('sale_id', venta.id);
                                  
                                  setSelectedSale({ ...venta, sale_details: saleDetails || [] });
                                  setInvoiceCustomerName('');
                                  setInvoiceCustomerEmail('');
                                  setInvoiceCustomerIdNumber('');
                                  setShowInvoiceModal(true);
                                }}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                              >
                                <Mail className="w-4 h-4" />
                                <span className="text-sm">Enviar Comprobante</span>
                              </Button>
                              <Button
                                onClick={() => handlePrintInvoice(venta)}
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                              >
                                <Printer className="w-4 h-4" />
                                <span className="text-sm">Imprimir Comprobante</span>
                              </Button>
                              {userRole === 'admin' && !isEmployee && (
                                <Button
                                  onClick={() => handleDeleteSale(venta.id)}
                                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg w-full sm:w-auto"
                                  title="Eliminar venta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="text-sm sm:hidden lg:inline">Eliminar</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Enviar Comprobante de Pago</h2>
                      <p className="text-blue-100 mt-1">
                        Venta del {selectedSale?.created_at ? formatDateOnly(selectedSale.created_at) : 'fecha no disponible'} por {formatPrice(selectedSale.total)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Nombre del Cliente *
                    </label>
                    <Input
                      type="text"
                      value={invoiceCustomerName}
                      onChange={(e) => setInvoiceCustomerName(e.target.value)}
                      placeholder="Nombre completo del cliente"
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email del Cliente *
                    </label>
                    <Input
                      type="email"
                      value={invoiceCustomerEmail}
                      onChange={(e) => setInvoiceCustomerEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      required
                      className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      El comprobante de pago se enviará a este correo electrónico
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      NIT/Cédula (opcional)
                    </label>
                    <Input
                      type="text"
                      value={invoiceCustomerIdNumber}
                      onChange={(e) => setInvoiceCustomerIdNumber(e.target.value)}
                      placeholder="123456789-0"
                      className="h-11 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {selectedSale.sale_details && selectedSale.sale_details.length > 0 && (
                    <div className="mt-6">
                      <p className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Productos:
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
                                <td className="px-4 py-3 text-gray-800">{detail.products?.name || detail.product_name}</td>
                                <td className="px-4 py-3 text-center text-gray-700">{detail.quantity}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{formatPrice(detail.unit_price)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                  {formatPrice(detail.quantity * detail.unit_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 shadow-md rounded-xl mt-6">
                    <div className="p-4">
                      <p className="text-sm font-medium text-blue-800 mb-2">Resumen:</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-blue-900">Total:</span>
                        <span className="text-2xl font-bold text-blue-900">{formatPrice(selectedSale.total)}</span>
                      </div>
                    </div>
                  </Card>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => setShowInvoiceModal(false)}
                      disabled={generatingInvoice}
                      className="flex-1 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={generateInvoiceFromSale}
                      disabled={generatingInvoice || !invoiceCustomerName || !invoiceCustomerEmail}
                      className="flex-1 h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {generatingInvoice ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Enviar Comprobante
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Nota informativa */}
                  <p className="text-gray-500 text-xs text-center mt-4 italic">
                    El presente comprobante es informativo. La responsabilidad tributaria recae exclusivamente en el establecimiento emisor.
                  </p>
                </div>
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
                  <h3 className="text-xl font-bold">Eliminar Venta</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-700 font-semibold">
                  ⚠️ ¿Estás seguro de eliminar esta venta permanentemente?
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>Esta acción no se puede deshacer.</strong> La venta y todos sus detalles serán eliminados del sistema de forma permanente.
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDeleteSale}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {loading ? 'Eliminando...' : 'Eliminar Definitivamente'}
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

// =====================================================
// COMPONENTES MEMOIZADOS PARA OPTIMIZACIÓN
// =====================================================

// ProductCard memoizado - solo se renderiza si producto cambia
const ProductCard = memo(({ producto, onAdd }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
    >
      <Card 
        className="hover:shadow-lg transition-all duration-300 rounded-xl border-gray-200 bg-gradient-to-br from-white to-gray-50"
        onClick={() => onAdd(producto)}
      >
        <div className="p-3 sm:p-4 flex items-center justify-between">
          <div className="flex-1">
            <p className="font-bold text-accent-600 text-lg">{producto.name}</p>
            <p className="text-sm text-gray-500 mt-1">Código: {producto.code}</p>
            <Badge 
              className={`mt-2 ${
                producto.stock > 10 
                  ? 'bg-green-100 text-green-800' 
                  : producto.stock > 0 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-red-100 text-red-800'
              }`}
            >
              Stock: {producto.stock}
            </Badge>
          </div>
          <div className="text-right ml-4">
            <p className="text-2xl font-bold text-secondary-600">
              {formatPrice(producto.sale_price)}
            </p>
            <Plus className="w-6 h-6 text-accent-600 mt-2 ml-auto" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Solo re-render si cambia el ID o el stock
  return prevProps.producto.id === nextProps.producto.id &&
         prevProps.producto.stock === nextProps.producto.stock;
});

export default Ventas;
