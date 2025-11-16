import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client';
import { sendInvoiceEmail } from '../../utils/emailService.js';
import { formatPrice, formatNumber } from '../../utils/formatters.js';
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
  User,
  Mail,
  FileText,
  Calendar,
  CreditCard
} from 'lucide-react';

// Función helper pura fuera del componente (no se recrea en renders)
const getVendedorName = (venta) => {
  if (!venta.employees) return '-';
  if (venta.employees.role === 'owner') return 'Administrador';
  return venta.employees.full_name;
};

function Ventas({ businessId }) {
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPOS, setShowPOS] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  // Funciones de carga memoizadas
  const loadVentas = useCallback(async () => {
    try {
      // Cargar datos en paralelo
      const [authResult, salesResult, customersResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('sales')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('customers')
          .select('id, full_name, email, id_number')
          .eq('business_id', businessId)
      ]);

      const { data: { user } } = authResult;
      const { data: salesData, error: salesError } = salesResult;
      const { data: customersData } = customersResult;

      if (salesError) throw salesError;

      // Crear mapa de clientes
      const customersMap = new Map();
      customersData?.forEach(customer => {
        customersMap.set(customer.id, customer);
      });

      // Verificar ownership y cargar empleados en paralelo
      const [businessResult, employeesResult] = await Promise.all([
        supabase
          .from('businesses')
          .select('created_by, name')
          .eq('id', businessId)
          .maybeSingle(),
        supabase
          .from('employees')
          .select('user_id, full_name, role')
          .eq('business_id', businessId)
      ]);

      const { data: business } = businessResult;
      const { data: employeesData } = employeesResult;

      // Crear mapa de empleados
      const employeeMap = new Map();
      employeesData?.forEach(emp => {
        employeeMap.set(emp.user_id, {
          full_name: emp.full_name || 'Usuario',
          role: emp.role
        });
      });

      // Combinar datos manualmente
      const salesWithEmployees = salesData?.map(sale => ({
        ...sale,
        customers: sale.customer_id ? customersMap.get(sale.customer_id) : null,
        employees: sale.user_id === business?.created_by
          ? { full_name: 'Administrador', role: 'owner' }
          : employeeMap.get(sale.user_id) || null
      })) || [];

      setVentas(salesWithEmployees);
    } catch (error) {
      console.error('Error loading ventas:', error);
      setVentas([]);
    }
  }, [businessId]);

  const loadProductos = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .gt('stock', 0)
      .order('name');

    if (error) throw error;
    setProductos(data || []);
  }, [businessId]);

  const loadClientes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .order('full_name');

      if (error) {
        setClientes([]);
        return;
      }
      setClientes(data || []);
    } catch (err) {
      setClientes([]);
    }
  }, [businessId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadVentas(),
        loadProductos(),
        loadClientes()
      ]);
    } catch (error) {
      setError('⚠️ No se pudo cargar la información. Por favor, intenta recargar la página.');
    } finally {
      setLoading(false);
    }
  }, [loadVentas, loadProductos, loadClientes]);

  useEffect(() => {
    if (businessId) {
      loadData();
    }
  }, [businessId, loadData]);

  // Memoizar mapa de clientes para acceso O(1)
  const clientesMap = useMemo(() => {
    const map = new Map();
    clientes.forEach(c => map.set(c.id, c));
    return map;
  }, [clientes]);

  // Cargar datos del cliente cuando se selecciona (optimizado)
  useEffect(() => {
    if (selectedCustomer && clientesMap.size > 0) {
      const cliente = clientesMap.get(selectedCustomer);
      if (cliente) {
        setCustomerName(cliente.full_name || cliente.name || '');
        setCustomerEmail(cliente.email || '');
        setCustomerIdNumber(cliente.id_number || '');
      }
    } else {
      setCustomerName('');
      setCustomerEmail('');
      setCustomerIdNumber('');
    }
  }, [selectedCustomer, clientesMap]);

  // Memoizar funciones del carrito
  const addToCart = useCallback((producto) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === producto.id);
      
      if (existingItem) {
        if (existingItem.quantity >= producto.stock) {
          setError(`⚠️ Stock insuficiente. Solo hay ${producto.stock} unidades disponibles`);
          return prevCart;
        }
        
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
      const item = prevCart.find(i => i.product_id === productId);
      if (newQuantity > item.available_stock) {
        setError(`⚠️ Stock insuficiente. Solo hay ${item.available_stock} unidades disponibles`);
        return prevCart;
      }

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

  const processSale = useCallback(async () => {
    if (cart.length === 0) {
      setError('⚠️ El carrito está vacío. Agrega productos antes de procesar la venta.');
      return;
    }

    // DESHABILITADO - Requiere dominio verificado en Resend
    // Validar datos de facturación si está marcada
    // if (generateInvoice) {
    //   if (!customerEmail || !customerEmail.includes('@')) {
    //     setError('Debes ingresar un email válido para generar la factura electrónica');
    //     return;
    //   }
    //   if (!customerName) {
    //     setError('Debes ingresar el nombre del cliente para generar la factura');
    //     return;
    //   }
    // }

    try {
      setLoading(true);
      setError(null);

      // Obtener el usuario actual autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('⚠️ Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      // Buscar si existe en la tabla users
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      // Obtener employee_id para la factura
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // 1. Crear la venta principal
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
          business_id: businessId,
          user_id: user?.id || null, // Rastrear quién hizo la venta
          payment_method: paymentMethod,
          total: total,
          customer_id: selectedCustomer || null
        }])
        .select()
        .maybeSingle();      if (saleError) throw saleError;

      // 2. Crear los detalles de venta
      const saleDetails = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
        // subtotal se calcula automáticamente en la BD (columna generada)
      }));

      const { error: detailsError } = await supabase
        .from('sale_details')
        .insert(saleDetails);

      if (detailsError) throw detailsError;

      // DESHABILITADO - Requiere dominio verificado en Resend
      // 3. Si está marcada la opción de factura, crear la factura electrónica
      // let invoiceNumber = null;
      // if (generateInvoice) {
      //   const total = calculateTotal(); // Total sin IVA adicional

      //   // Generar número de factura
      //   const { data: invNumber } = await supabase
      //     .rpc('generate_invoice_number', { p_business_id: businessId });

      //   invoiceNumber = invNumber;

      //   // Crear factura
      //   const { data: invoice, error: invoiceError } = await supabase
      //     .from('invoices')
      //     .insert({
      //       business_id: businessId,
      //       employee_id: employee?.id || null,
      //       invoice_number: invoiceNumber,
      //       customer_name: customerName || 'Consumidor Final',
      //       customer_email: customerEmail,
      //       customer_id_number: customerIdNumber || null,
      //       payment_method: paymentMethod,
      //       subtotal: total, // El total es el subtotal (sin IVA adicional)
      //       tax: 0, // Sin IVA adicional
      //       total,
      //       status: 'pending',
      //       issued_at: new Date().toISOString()
      //     })
      //     .select()
      //     .maybeSingle();

      //   if (invoiceError) throw invoiceError;

      //   // Crear items de factura
      //   const invoiceItems = cart.map(item => ({
      //     invoice_id: invoice.id,
      //     product_id: item.product_id,
      //     product_name: item.name,
      //     quantity: item.quantity,
      //     unit_price: item.unit_price,
      //     total: item.subtotal
      //   }));

      //   const { error: itemsError } = await supabase
      //     .from('invoice_items')
      //     .insert(invoiceItems);

      //   if (itemsError) throw itemsError;

      //   // Enviar factura por email
      //   try {
      //     const emailResult = await sendInvoiceEmail({
      //       email: customerEmail,
      //       invoiceNumber: invoiceNumber,
      //       customerName: customerName,
      //       total: total,
      //       pdfUrl: invoice.pdf_url || null
      //     });
          
      //     if (emailResult.demo) {
      //     } else {
      //     }
      //   } catch (emailError) {
      //     // No falla la venta si el email falla
      //   }
      // }

      const successMsg = `✅ Venta registrada exitosamente. Total: ${formatPrice(total)}`;
      
      setSuccess(successMsg);
      
      // Limpiar el carrito y cerrar POS
      setCart([]);
      setSelectedCustomer('');
      setPaymentMethod('cash');
      setShowPOS(false);

      // Recargar ventas inmediatamente
      await loadVentas();

    } catch (error) {
      setError('❌ ' + (error.message || 'No se pudo procesar la venta. Por favor, intenta de nuevo.'));
    } finally {
      setLoading(false);
    }
  }, [cart, businessId, paymentMethod, selectedCustomer, total, loadVentas]);

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
    // Usar datos de customer ya cargados si están disponibles
    if (venta.customers) {
      setInvoiceCustomerName(venta.customers.full_name || '');
      setInvoiceCustomerEmail(venta.customers.email || '');
      setInvoiceCustomerIdNumber(venta.customers.id_number || '');
    } else if (venta.customer_id && clientesMap.size > 0) {
      const cliente = clientesMap.get(venta.customer_id);
      if (cliente) {
        setInvoiceCustomerName(cliente.full_name || '');
        setInvoiceCustomerEmail(cliente.email || '');
        setInvoiceCustomerIdNumber(cliente.id_number || '');
      }
    } else {
      setInvoiceCustomerName('');
      setInvoiceCustomerEmail('');
      setInvoiceCustomerIdNumber('');
    }

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
  }, [clientesMap]);

  // Generar factura desde una venta existente (memoizado)
  const generateInvoiceFromSale = useCallback(async () => {
    if (!invoiceCustomerEmail || !invoiceCustomerEmail.includes('@')) {
      setError('⚠️ Debes ingresar un email válido para generar la factura');
      return;
    }
    if (!invoiceCustomerName) {
      setError('⚠️ Debes ingresar el nombre del cliente para generar la factura');
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

      // Obtener employee_id del usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('⚠️ Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const total = selectedSale.total;

      // Generar número de factura
      const { data: invNumber, error: numberError } = await supabase
        .rpc('generate_invoice_number', { p_business_id: businessId });

      if (numberError) throw new Error('Error al generar número de factura: ' + numberError.message);

      const invoiceNumber = invNumber;

      // Crear factura
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          business_id: businessId,
          employee_id: employee?.id || null,
          invoice_number: invoiceNumber,
          customer_name: invoiceCustomerName,
          customer_email: invoiceCustomerEmail,
          customer_id_number: invoiceCustomerIdNumber || null,
          payment_method: selectedSale.payment_method,
          subtotal: total,
          tax: 0,
          total,
          status: 'pending',
          issued_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (invoiceError) throw invoiceError;

      // Crear items de factura
      const invoiceItems = saleDetails.map(detail => ({
        invoice_id: invoice.id,
        product_id: detail.product_id,
        product_name: detail.products?.name || 'Producto',
        quantity: detail.quantity,
        unit_price: detail.unit_price,
        total: detail.quantity * detail.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // Enviar factura por email
      try {
        const emailResult = await sendInvoiceEmail({
          email: invoiceCustomerEmail,
          invoiceNumber: invoiceNumber,
          customerName: invoiceCustomerName,
          total: total,
          items: invoiceItems
        });

        if (!emailResult.demo) {
          await supabase
            .from('invoices')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', invoice.id);
        }

        setSuccess(emailResult.demo 
          ? `✅ Factura ${invoiceNumber} creada. ⚠️ Email NO enviado (configura EmailJS)`
          : `✅ Factura ${invoiceNumber} generada y enviada a ${invoiceCustomerEmail}`
        );
      } catch (emailError) {
        console.error('Error al enviar email:', emailError);
        setSuccess(`✅ Factura ${invoiceNumber} generada (⚠️ error al enviar email)`);
      }

      // Cerrar modal y limpiar
      setShowInvoiceModal(false);
      setInvoiceCustomerName('');
      setInvoiceCustomerEmail('');
      setInvoiceCustomerIdNumber('');
      setSelectedSale(null);

    } catch (error) {
      setError('❌ ' + (error.message || 'No se pudo generar la factura. Por favor, intenta de nuevo.'));
    } finally {
      setGeneratingInvoice(false);
    }
  }, [businessId, selectedSale, invoiceCustomerName, invoiceCustomerEmail, invoiceCustomerIdNumber]);

  if (loading && ventas.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4DFE6] to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B46] mx-auto mb-4"></div>
          <p className="text-[#07575B] font-medium">Cargando ventas...</p>
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
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Ventas</h1>
                <p className="text-white/80 mt-1">Sistema de punto de venta</p>
              </div>
            </div>
            <Button
              onClick={() => setShowPOS(!showPOS)}
              className="bg-white text-[#003B46] hover:bg-white/90 transition-all duration-300 shadow-lg font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
            >
              {showPOS ? (
                <>
                  <Receipt className="w-5 h-5" />
                  Ver Historial
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Nueva Venta
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

      {showPOS ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid lg:grid-cols-2 gap-6"
        >
          {/* Panel izquierdo - Productos */}
          <Card className="shadow-xl rounded-2xl bg-white border-none">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#003B46] to-[#07575B] rounded-lg">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#003B46]">Productos</h3>
              </div>
              
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  className="pl-10 h-12 rounded-xl border-gray-300 focus:border-[#003B46] focus:ring-[#003B46]"
                  placeholder="Buscar producto por nombre o código..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                />
              </div>
              
              <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
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
                        className="hover:shadow-lg transition-all duration-300 rounded-xl border-gray-200 bg-gradient-to-br from-white to-gray-50"
                        onClick={() => addToCart(producto)}
                      >
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-[#003B46] text-lg">{producto.name}</p>
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
                            <p className="text-2xl font-bold text-[#07575B]">
                              {formatPrice(producto.sale_price)}
                            </p>
                            <Plus className="w-6 h-6 text-[#003B46] mt-2 ml-auto" />
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
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-[#003B46] to-[#07575B] rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#003B46]">Carrito de Venta</h3>
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
                    className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#003B46] focus:ring-[#003B46] transition-all duration-300"
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
                    className="w-full h-11 px-4 border border-gray-300 rounded-xl focus:border-[#003B46] focus:ring-[#003B46] transition-all duration-300"
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
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
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
                                <p className="font-bold text-[#003B46]">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.code}</p>
                              </div>
                              <Button
                                onClick={() => removeFromCart(item.product_id)}
                                className="h-7 w-7 p-0 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg border-none"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
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
                                  max={item.available_stock}
                                  className="w-12 text-center border-none focus:outline-none focus:ring-0 font-bold text-[#003B46]"
                                />
                                <button
                                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors"
                                >
                                  +
                                </button>
                              </div>
                              <p className="text-lg font-bold text-[#07575B]">
                                {formatPrice(item.subtotal)}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              <Card className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white shadow-lg rounded-xl border-none mb-4">
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
                disabled={cart.length === 0 || loading}
                className="w-full h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold text-lg rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Procesando...
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
        </motion.div>
      ) : (
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
            <Card className="shadow-xl rounded-2xl bg-white border-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white">
                      <th className="px-6 py-4 text-left font-semibold">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Fecha
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left font-semibold">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Cliente
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left font-semibold">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Vendedor
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left font-semibold">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Total
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left font-semibold">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Método de Pago
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left font-semibold">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Acciones
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((venta, index) => (
                      <motion.tr
                        key={venta.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-[#C4DFE6]/20 hover:to-transparent transition-all duration-300"
                      >
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {new Date(venta.created_at + 'Z').toLocaleString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'America/Bogota'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-800">
                            {venta.customers?.full_name || 'Venta general'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {getVendedorName(venta)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-bold text-[#07575B]">
                            {formatPrice(venta.total)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            className={`${
                              venta.payment_method === 'cash' 
                                ? 'bg-green-100 text-green-800' 
                                : venta.payment_method === 'card'
                                ? 'bg-blue-100 text-blue-800'
                                : venta.payment_method === 'transfer'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {venta.payment_method === 'cash' && '💵 Efectivo'}
                            {venta.payment_method === 'card' && '💳 Tarjeta'}
                            {venta.payment_method === 'transfer' && '🏦 Transferencia'}
                            {venta.payment_method === 'mixed' && '🔀 Mixto'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            onClick={async () => {
                              // Cargar detalles de la venta
                              const { data: saleDetails } = await supabase
                                .from('sale_details')
                                .select('*, products(name)')
                                .eq('sale_id', venta.id);
                              
                              setSelectedSale({ ...venta, sale_details: saleDetails || [] });
                              setInvoiceCustomerName(venta.customers?.full_name || '');
                              setInvoiceCustomerEmail(venta.customers?.email || '');
                              setInvoiceCustomerIdNumber(venta.customers?.id_number || '');
                              setShowInvoiceModal(true);
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg px-4 py-2 flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg"
                          >
                            <FileText className="w-4 h-4" />
                            Generar Factura
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* Modal para generar factura desde venta */}
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
                      <h2 className="text-2xl font-bold">Generar Factura Electrónica</h2>
                      <p className="text-blue-100 mt-1">
                        Venta del {new Date(selectedSale.created_at + 'Z').toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })} por {formatPrice(selectedSale.total)}
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
                      La factura se enviará a este correo electrónico
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
                          Generando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Generar y Enviar Factura
                        </>
                      )}
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

export default Ventas;
