import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/Client';
import { sendInvoiceEmail } from '../../utils/emailService.js';
import { formatPrice, formatNumber } from '../../utils/formatters.js';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, AlertTriangle } from 'lucide-react';

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados del formulario
  const [showForm, setShowForm] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(true); // Enviar email automáticamente
  
  // Estados del modal de cancelación
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState(null);
  
  // Búsqueda de productos
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      let businessId = null;
      let employeeId = null;

      // Primero intentar obtener desde users (para administradores)
      const { data: userRecord } = await supabase
        .from('users')
        .select('business_id')
        .eq('id', user.id)
        .single();

      if (userRecord) {
        businessId = userRecord.business_id;
      }

      // Si no es admin, buscar en employees
      if (!businessId) {
        const { data: employee } = await supabase
          .from('employees')
          .select('id, business_id')
          .eq('user_id', user.id)
          .single();

        if (employee) {
          businessId = employee.business_id;
          employeeId = employee.id;
        }
      }

      if (!businessId) {
        throw new Error('No se encontró información del negocio');
      }

      // Cargar facturas
      await loadFacturas(businessId);

      // Cargar productos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name');

      if (productsError) throw productsError;
      setProductos(productsData || []);

      // Cargar clientes (opcional si la tabla existe)
      try {
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .eq('business_id', businessId)
          .order('full_name');

        if (customersError) {
          // Tabla customers no existe, se omite
          setClientes([]);
        } else {
          setClientes(customersData || []);
        }
      } catch (err) {
        // Clientes no disponibles
        setClientes([]);
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFacturas = async (businessId) => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (
          id,
          product_name,
          quantity,
          unit_price,
          total
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setFacturas(data || []);
  };

  const handleAddProduct = (producto) => {
    // Validar que el producto tenga stock
    if (!producto.stock || producto.stock <= 0) {
      setError(`El producto "${producto.name}" no tiene stock disponible`);
      return;
    }

    // Validar que el producto tenga precio
    if (!producto.sale_price || producto.sale_price <= 0) {
      setError(`El producto "${producto.name}" no tiene precio de venta configurado`);
      return;
    }

    const existingItem = items.find(item => item.product_id === producto.id);
    
    if (existingItem) {
      // Verificar que no se exceda el stock disponible
      if (existingItem.quantity >= producto.stock) {
        setError(`Stock insuficiente. Solo hay ${producto.stock} unidades de "${producto.name}"`);
        return;
      }

      setItems(items.map(item =>
        item.product_id === producto.id
          ? { 
              ...item, 
              quantity: item.quantity + 1, 
              total: (item.quantity + 1) * item.unit_price,
              max_stock: producto.stock // Guardar el stock máximo disponible
            }
          : item
      ));
    } else {
      setItems([...items, {
        product_id: producto.id,
        product_name: producto.name,
        quantity: 1,
        unit_price: producto.sale_price || 0,
        total: producto.sale_price || 0,
        max_stock: producto.stock // Guardar el stock máximo disponible
      }]);
    }
    
    setSearchProduct('');
    setShowProductSearch(false);
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      setItems(items.filter(item => item.product_id !== productId));
      return;
    }

    // Validar que no se exceda el stock disponible
    const item = items.find(i => i.product_id === productId);
    if (item && item.max_stock && newQuantity > item.max_stock) {
      setError(`Stock insuficiente. Solo hay ${item.max_stock} unidades disponibles de "${item.product_name}"`);
      return;
    }

    setItems(items.map(item =>
      item.product_id === productId
        ? { ...item, quantity: newQuantity, total: newQuantity * item.unit_price }
        : item
    ));
  };

  const handleRemoveItem = (productId) => {
    setItems(items.filter(item => item.product_id !== productId));
  };

  const calculateTotals = () => {
    const total = items.reduce((sum, item) => sum + item.total, 0);
    return { total };
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (items.length === 0) {
      setError('Debes agregar al menos un producto');
      return;
    }

    // Validar que todos los items tengan cantidad y precio válidos
    const invalidItems = items.filter(item => item.quantity <= 0 || item.unit_price <= 0);
    if (invalidItems.length > 0) {
      setError('Hay productos con cantidad o precio inválido');
      return;
    }

    // Validar que el total sea mayor a 0
    const { total } = calculateTotals();
    if (total <= 0) {
      setError('El total de la factura debe ser mayor a 0');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      let businessId = null;
      let employeeId = null;

      // Primero intentar obtener desde users (para administradores)
      const { data: userRecord } = await supabase
        .from('users')
        .select('business_id')
        .eq('id', user.id)
        .single();

      if (userRecord) {
        businessId = userRecord.business_id;
      }

      // Si no es admin, buscar en employees
      if (!businessId) {
        const { data: employee } = await supabase
          .from('employees')
          .select('id, business_id')
          .eq('user_id', user.id)
          .single();

        if (employee) {
          businessId = employee.business_id;
          employeeId = employee.id;
        }
      }

      if (!businessId) {
        throw new Error('No se encontró información del negocio');
      }

      // Verificar stock disponible antes de crear la factura
      for (const item of items) {
        const { data: product, error: stockError } = await supabase
          .from('products')
          .select('stock, name')
          .eq('id', item.product_id)
          .single();

        if (stockError) throw new Error(`Error al verificar stock del producto ${item.product_name}`);
        
        if (!product || product.stock < item.quantity) {
          throw new Error(
            `Stock insuficiente de "${item.product_name}". Disponible: ${product?.stock || 0}, Solicitado: ${item.quantity}`
          );
        }
      }

      // Obtener información del cliente si se seleccionó
      let customerData = {
        customer_name: 'Consumidor Final',
        customer_email: null,
        customer_id_number: null
      };

      if (selectedCliente) {
        try {
          const { data: cliente } = await supabase
            .from('customers')
            .select('full_name, email, id_number')
            .eq('id', selectedCliente)
            .single();

          if (cliente) {
            customerData = {
              customer_name: cliente.full_name,
              customer_email: cliente.email,
              customer_id_number: cliente.id_number
            };
          }
        } catch (err) {
          // Cliente no disponible, usar consumidor final
        }
      }

      // Generar número de factura
      const { data: invoiceNumber, error: numberError } = await supabase
        .rpc('generate_invoice_number', { p_business_id: businessId });

      if (numberError) throw new Error('Error al generar número de factura: ' + numberError.message);

      // Crear factura
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          business_id: businessId,
          employee_id: employeeId,
          invoice_number: invoiceNumber,
          ...customerData,
          payment_method: paymentMethod,
          subtotal: total,
          tax: 0,
          total,
          notes,
          status: 'pending',
          issued_at: new Date().toISOString()
        })
        .select()
        .single();

      if (invoiceError) throw new Error('Error al crear factura: ' + invoiceError.message);

      // Crear items de factura
      const invoiceItems = items.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw new Error('Error al crear items de factura: ' + itemsError.message);

      // Reducir stock de productos
      const stockErrors = [];
      for (const item of items) {
        const { error: stockError } = await supabase.rpc('reduce_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        });
        
        if (stockError) {
          stockErrors.push(`${item.product_name}: ${stockError.message}`);
        }
      }

      if (stockErrors.length > 0) {
        console.warn('Errores al reducir stock:', stockErrors);
        // No lanzar error, la factura ya fue creada
      }

      // Enviar factura por email si está habilitado y hay email del cliente
      let emailSent = false;
      if (sendEmailOnCreate && customerData.customer_email) {
        try {
          const emailResult = await sendInvoiceEmail({
            email: customerData.customer_email,
            invoiceNumber: invoiceNumber,
            customerName: customerData.customer_name || 'Cliente',
            total: total,
            items: invoiceItems
          });
          
          // Actualizar estado a 'sent' si se envió exitosamente
          if (!emailResult.demo) {
            await supabase
              .from('invoices')
              .update({ 
                status: 'sent',
                sent_at: new Date().toISOString()
              })
              .eq('id', invoice.id);
            emailSent = true;
          }

          if (emailResult.demo) {
            setSuccess(`✅ Factura ${invoiceNumber} creada. ⚠️ Email NO enviado (configura EmailJS en Configuración)`);
          } else {
            setSuccess(`✅ Factura ${invoiceNumber} creada y enviada a ${customerData.customer_email}`);
          }
        } catch (emailError) {
          console.error('Error al enviar email:', emailError);
          setSuccess(`✅ Factura ${invoiceNumber} creada (⚠️ error al enviar email: ${emailError.message})`);
        }
      } else if (!customerData.customer_email) {
        setSuccess(`✅ Factura ${invoiceNumber} creada exitosamente (sin email del cliente)`);
      } else {
        setSuccess(`✅ Factura ${invoiceNumber} creada exitosamente`);
      }
      
      setTimeout(() => setSuccess(''), 8000);
      setShowForm(false);
      resetForm();
      await loadFacturas(businessId);

    } catch (error) {
      console.error('Error al crear factura:', error);
      setError(error.message || 'Error desconocido al crear factura');
      setTimeout(() => setError(''), 8000);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCliente('');
    setPaymentMethod('cash');
    setNotes('');
    setItems([]);
    setSearchProduct('');
    setSendEmailOnCreate(true); // Reset a true por defecto
  };

  const handleSendToClient = async (facturaId) => {
    setLoading(true);
    setError('');
    
    try {
      // Obtener los datos completos de la factura
      const { data: factura, error: facturaError } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (
            id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq('id', facturaId)
        .single();

      if (facturaError) throw new Error('Error al obtener factura: ' + facturaError.message);

      // Validar que la factura tenga email del cliente
      if (!factura.customer_email) {
        setError('Esta factura no tiene email del cliente. No se puede enviar.');
        setTimeout(() => setError(''), 5000);
        setLoading(false);
        return;
      }

      // Enviar factura por email
      try {
        const emailResult = await sendInvoiceEmail({
          email: factura.customer_email,
          invoiceNumber: factura.invoice_number,
          customerName: factura.customer_name || 'Cliente',
          total: factura.total,
          items: factura.invoice_items || []
        });
        
        // Actualizar estado de la factura a 'sent'
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', facturaId);

        if (updateError) throw updateError;

        if (emailResult.demo) {
          setSuccess(`✅ Factura ${factura.invoice_number} marcada como enviada. ⚠️ Email NO enviado (modo demo - configura EmailJS)`);
        } else {
          setSuccess(`✅ Factura ${factura.invoice_number} enviada exitosamente a ${factura.customer_email}`);
        }
      } catch (emailError) {
        console.error('Error al enviar email:', emailError);
        throw new Error('Error al enviar email: ' + emailError.message);
      }
      
      setTimeout(() => setSuccess(''), 8000);
      
      // Recargar facturas
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('business_id')
        .eq('id', user.id)
        .single();
      
      let businessId = userRecord?.business_id;
      
      if (!businessId) {
        const { data: employee } = await supabase
          .from('employees')
          .select('business_id')
          .eq('user_id', user.id)
          .single();
        businessId = employee?.business_id;
      }
      
      if (businessId) {
        await loadFacturas(businessId);
      }

    } catch (error) {
      console.error('Error al enviar factura:', error);
      setError(error.message || 'Error desconocido al enviar factura');
      setTimeout(() => setError(''), 8000);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvoice = async (facturaId) => {
    setInvoiceToCancel(facturaId);
    setShowCancelModal(true);
  };

  const confirmCancelInvoice = async () => {
    if (!invoiceToCancel) return;

    setLoading(true);
    setError('');
    
    try {
      // Primero obtener los items de la factura antes de cancelarla
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('invoice_items')
        .select('product_id, quantity, product_name')
        .eq('invoice_id', invoiceToCancel);

      if (itemsError) throw new Error('Error al obtener items de la factura: ' + itemsError.message);

      // Cancelar la factura (el trigger restaurará el stock automáticamente)
      const { error: cancelError } = await supabase
        .from('invoices')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', invoiceToCancel);

      if (cancelError) throw new Error('Error al cancelar factura: ' + cancelError.message);

      // Si el trigger no está configurado, restaurar stock manualmente
      if (invoiceItems && invoiceItems.length > 0) {
        try {
          const { error: restoreError } = await supabase.rpc('restore_stock_from_invoice', {
            p_invoice_id: invoiceToCancel
          });
          
          if (restoreError) {
            // Si la función RPC no existe, restaurar manualmente
            for (const item of invoiceItems) {
              await supabase.rpc('increase_stock', {
                p_product_id: item.product_id,
                p_quantity: item.quantity
              });
            }
          }
        } catch (restoreErr) {
          console.warn('Advertencia al restaurar stock:', restoreErr);
          // No fallar la cancelación por esto
        }
      }

      setSuccess(`✅ Factura cancelada y stock restaurado`);
      setTimeout(() => setSuccess(''), 5000);
      
      // Obtener business_id del usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('business_id')
        .eq('id', user.id)
        .single();
      
      let businessId = userRecord?.business_id;
      
      if (!businessId) {
        const { data: employee } = await supabase
          .from('employees')
          .select('business_id')
          .eq('user_id', user.id)
          .single();
        businessId = employee?.business_id;
      }
      
      if (businessId) {
        await loadFacturas(businessId);
      }

      setShowCancelModal(false);
      setInvoiceToCancel(null);

    } catch (error) {
      console.error('Error al cancelar factura:', error);
      setError(error.message || 'Error desconocido al cancelar factura');
      setTimeout(() => setError(''), 8000);
      setShowCancelModal(false);
      setInvoiceToCancel(null);
    } finally {
      setLoading(false);
    }
  };

  const cancelCancelInvoice = () => {
    setShowCancelModal(false);
    setInvoiceToCancel(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: '📝 Guardado',
      sent: '🟢 Enviada',
      validated: '✅ Validada',
      cancelled: '🔴 Cancelada'
    };
    return badges[status] || status;
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: '💵 Efectivo',
      card: '💳 Tarjeta',
      transfer: '🏦 Transferencia',
      credit: '📝 Crédito'
    };
    return labels[method] || method;
  };

  const getFilteredProducts = () => {
    if (!searchProduct.trim()) return [];
    return productos.filter(p =>
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchProduct.toLowerCase()))
    ).slice(0, 5);
  };

  const getFilteredFacturas = () => {
    let filtered = facturas;

    if (searchTerm.trim()) {
      filtered = filtered.filter(f =>
        f.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  useEffect(() => {
    if (error) setTimeout(() => setError(''), 5000);
    if (success) setTimeout(() => setSuccess(''), 5000);
  }, [error, success]);

  const { total } = calculateTotals();

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">📄 Facturación Electrónica</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? '❌ Cancelar' : '➕ Nueva Factura'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Nueva Factura</h3>
          
          <form onSubmit={handleCreateInvoice}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Cliente</label>
                <select
                  value={selectedCliente}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">Consumidor Final</option>
                  {clientes.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.full_name} - {cliente.id_number || 'Sin ID'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  required
                >
                  <option value="cash">💵 Efectivo</option>
                  <option value="card">💳 Tarjeta</option>
                  <option value="transfer">🏦 Transferencia</option>
                  <option value="credit">📝 Crédito</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Productos</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  value={searchProduct}
                  onChange={(e) => {
                    setSearchProduct(e.target.value);
                    setShowProductSearch(true);
                  }}
                  onFocus={() => setShowProductSearch(true)}
                  className="w-full p-2 border rounded-lg"
                />
                
                {showProductSearch && getFilteredProducts().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {getFilteredProducts().map(producto => (
                      <div
                        key={producto.id}
                        onClick={() => handleAddProduct(producto)}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium">{producto.name}</div>
                        <div className="text-sm text-gray-600">
                          Código: {producto.code} | Precio: {formatPrice(producto.sale_price)} | Stock: {producto.stock}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="mb-4 border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Producto</th>
                        <th className="p-2 text-center">Cantidad</th>
                        <th className="p-2 text-right">Precio Unit.</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.product_id} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{item.product_name}</div>
                            {item.max_stock && (
                              <div className="text-xs text-gray-500">Stock disponible: {item.max_stock}</div>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                                className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 text-sm"
                                title="Disminuir cantidad"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleUpdateQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                                className="w-16 p-1 border rounded text-center"
                                min="0.01"
                                max={item.max_stock || 99999}
                                step="0.01"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                                className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 text-sm"
                                title="Aumentar cantidad"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-2 text-right">{formatPrice(item.unit_price)}</td>
                          <td className="p-2 text-right font-semibold text-blue-600">{formatPrice(item.total)}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.product_id)}
                              className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                              title="Eliminar producto"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr className="border-t-2">
                        <td colSpan="3" className="p-3 text-right text-lg">Total a pagar:</td>
                        <td className="p-3 text-right text-xl text-blue-600">{formatPrice(total)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Notas (Opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border rounded-lg"
                rows="3"
                placeholder="Observaciones adicionales..."
              ></textarea>
            </div>

            {/* Checkbox para enviar email automáticamente */}
            {selectedCliente && clientes.find(c => c.id === selectedCliente)?.email && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmailOnCreate}
                    onChange={(e) => setSendEmailOnCreate(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">
                    📧 Enviar factura por email al crear ({clientes.find(c => c.id === selectedCliente)?.email})
                  </span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  Si no está marcado, podrás enviarla manualmente después desde la lista de facturas
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
            >
              {loading ? 'Creando...' : '✅ Crear Factura'}
            </button>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Buscar</label>
            <input
              type="text"
              placeholder="Número de factura o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Lista de Facturas */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading && !showForm ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : getFilteredFacturas().length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay facturas para mostrar
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">N° Factura</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Fecha</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-left">Pago</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredFacturas().map(factura => (
                <tr key={factura.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono font-semibold">{factura.invoice_number}</td>
                  <td className="p-3">
                    <div>{factura.customer_name}</div>
                    {factura.customer_id_number && (
                      <div className="text-sm text-gray-600">{factura.customer_id_number}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {new Date(factura.issued_at).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {formatPrice(factura.total)}
                  </td>
                  <td className="p-3">{getPaymentMethodLabel(factura.payment_method)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-sm ${
                      factura.status === 'validated' ? 'bg-green-100' :
                      factura.status === 'sent' ? 'bg-blue-100' :
                      factura.status === 'cancelled' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {getStatusBadge(factura.status)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex gap-2 justify-center">
                      {factura.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleSendToClient(factura.id)}
                            disabled={loading}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                            title="Enviar factura al cliente por email"
                          >
                            � Enviar
                          </button>
                          <button
                            onClick={() => handleCancelInvoice(factura.id)}
                            disabled={loading}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                            title="Cancelar factura"
                          >
                            ❌ Cancelar
                          </button>
                        </>
                      )}
                      {factura.status === 'sent' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-green-600 font-medium">✓ Enviada</span>
                          {factura.customer_email && (
                            <button
                              onClick={() => handleSendToClient(factura.id)}
                              disabled={loading}
                              className="text-xs text-blue-600 hover:underline"
                              title="Reenviar factura"
                            >
                              Reenviar
                            </button>
                          )}
                        </div>
                      )}
                      {factura.status === 'validated' && (
                        <span className="text-sm text-gray-500">✓ Validada</span>
                      )}
                      {factura.status === 'cancelled' && (
                        <span className="text-sm text-gray-500">Cancelada</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de confirmación de cancelación de factura */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelCancelInvoice}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-xl shadow-2xl"
            >
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 rounded-t-xl">
                <div className="flex items-center gap-3 text-white">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-xl font-bold">Confirmar Cancelación</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  ¿Estás seguro de cancelar esta factura? El stock se restaurará automáticamente.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ Esta acción cancelará la factura y devolverá todos los productos al inventario.
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelCancelInvoice}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    onClick={confirmCancelInvoice}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    {loading ? 'Cancelando...' : 'Cancelar Factura'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
