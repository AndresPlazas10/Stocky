import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { sendInvoiceEmail } from '../../utils/emailService.js';
import { formatPrice, formatDate } from '../../utils/formatters.js';
import { AnimatePresence } from 'framer-motion';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import {
  cancelInvoiceAndRestoreStock,
  createInvoiceWithItemsAndStock,
  deleteInvoiceCascade,
  markInvoiceAsSent
} from '../../data/commands/invoicesCommands.js';
import {
  getBusinessContextByUserId,
  getInvoiceItemsByInvoiceId,
  getInvoiceWithItemsById,
  getInvoicesWithItemsByBusiness,
  getProductsForInvoicesByBusiness,
  getProductsStockByIds
} from '../../data/queries/invoicesQueries.js';
import { getAuthenticatedUser } from '../../data/queries/authQueries.js';

const INVOICE_LIST_COLUMNS = `
  id,
  business_id,
  employee_id,
  invoice_number,
  customer_name,
  customer_email,
  customer_id_number,
  payment_method,
  subtotal,
  tax,
  total,
  notes,
  status,
  issued_at,
  created_at,
  sent_at,
  cancelled_at
`;

const INVOICE_ITEM_LIST_COLUMNS = `
  id,
  product_name,
  quantity,
  unit_price,
  total
`;

const PRODUCT_INVOICE_COLUMNS = 'id, code, name, sale_price, stock, business_id, is_active';

export default function Facturas({ userRole = 'admin', businessId: businessIdProp = null }) {
  const [facturas, setFacturas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Refs
  const formRef = useRef(null);
  
  // Estados del formulario
  const [showForm, setShowForm] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(true); // Enviar email automáticamente
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  
  // Estados del modal de cancelación
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState(null);
  
  // Estados del modal de eliminación (solo admin)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  
  // Búsqueda de productos
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');

  const loadFacturas = useCallback(async (businessId) => {
    setFacturas(await getInvoicesWithItemsByBusiness({
      businessId,
      invoiceColumns: INVOICE_LIST_COLUMNS,
      invoiceItemsColumns: INVOICE_ITEM_LIST_COLUMNS
    }));
  }, []);

  const resolveBusinessContext = useCallback(async () => {
    if (businessIdProp) {
      return {
        userId: null,
        businessId: businessIdProp,
        employeeId: null
      };
    }

    const user = await getAuthenticatedUser();

    if (!user) {
      const sessionError = new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      sessionError.code = 'SESSION_EXPIRED';
      throw sessionError;
    }

    const { businessId, employeeId } = await getBusinessContextByUserId(user.id);
    if (!businessId) {
      throw new Error('No se encontró información del negocio');
    }

    return {
      userId: user.id,
      businessId,
      employeeId
    };
  }, [businessIdProp]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { businessId } = await resolveBusinessContext();

      // Cargar facturas
      const [, productsData] = await Promise.all([
        loadFacturas(businessId),
        getProductsForInvoicesByBusiness(businessId, PRODUCT_INVOICE_COLUMNS)
      ]);

      setProductos(productsData);

      // Tabla customers eliminada - no cargar clientes
      setClientes([]);

    } catch (error) {
      if (error?.code === 'SESSION_EXPIRED') {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [loadFacturas, resolveBusinessContext]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cleanup de mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Scroll al formulario cuando se abre (especialmente útil en móvil)
  useEffect(() => {
    if (showForm && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showForm]);

  const handleAddProduct = useCallback((producto) => {
    if (!producto.stock || producto.stock <= 0) {
      setError(`El producto "${producto.name}" no tiene stock disponible`);
      return;
    }

    if (!producto.sale_price || producto.sale_price <= 0) {
      setError(`El producto "${producto.name}" no tiene precio de venta configurado`);
      return;
    }

    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.product_id === producto.id);
      
      if (existingItem) {
        if (existingItem.quantity >= producto.stock) {
          setError(`Stock insuficiente. Solo hay ${producto.stock} unidades de "${producto.name}"`);
          return prevItems;
        }

        return prevItems.map(item =>
          item.product_id === producto.id
            ? { 
              ...item, 
              quantity: item.quantity + 1, 
              total: (item.quantity + 1) * item.unit_price,
              max_stock: producto.stock
            }
          : item
        );
      } else {
        return [...prevItems, {
          product_id: producto.id,
          product_name: producto.name,
          quantity: 1,
          unit_price: producto.sale_price || 0,
          total: producto.sale_price || 0,
          max_stock: producto.stock
        }];
      }
    });
    
    setSearchProduct('');
    setShowProductSearch(false);
  }, []);

  const handleRemoveItem = useCallback((productId) => {
    setItems(prevItems => prevItems.filter(item => item.product_id !== productId));
  }, []);

    const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(productId);
      return;
    }

    setItems(prevItems => prevItems.map(item =>
      item.product_id === productId
        ? { ...item, quantity: newQuantity, total: newQuantity * item.unit_price }
        : item
    ));
  }, [handleRemoveItem]);

  // Memoizar cálculo de total
  const totalFactura = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total, 0);
  }, [items]);

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    
    if (isCreatingInvoice) return;
    
    setIsCreatingInvoice(true);
    setError('');
    
    try {
      // Validaciones
      if (items.length === 0) {
        throw new Error('Debes agregar al menos un producto');
      }

      const invalidItems = items.filter(item => item.quantity <= 0 || item.unit_price <= 0);
      if (invalidItems.length > 0) {
        throw new Error('Hay productos con cantidad o precio inválido');
      }

      if (totalFactura <= 0) {
        throw new Error('El total de la factura debe ser mayor a 0');
      }

      const { businessId, employeeId } = await resolveBusinessContext();

      // Verificar stock disponible en una sola consulta
      const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
      const stockProducts = await getProductsStockByIds(productIds);

      const stockById = new Map((stockProducts || []).map((p) => [p.id, p]));
      for (const item of items) {
        const product = stockById.get(item.product_id);
        if (!product || Number(product.stock || 0) < Number(item.quantity || 0)) {
          throw new Error(
            `Stock insuficiente de "${item.product_name}". Disponible: ${product?.stock || 0}, Solicitado: ${item.quantity}`
          );
        }
      }

      let customerData = {
        customer_name: 'Consumidor Final',
        customer_email: null,
        customer_id_number: null
      };

      const {
        invoice,
        invoiceNumber,
        invoiceItems,
        localOnly
      } = await createInvoiceWithItemsAndStock({
        businessId,
        employeeId,
        paymentMethod,
        total: totalFactura,
        notes,
        items
      });

      // Enviar factura por email si está habilitado
      let successMessage = `✅ Factura ${invoiceNumber} creada exitosamente`;

      if (localOnly) {
        successMessage = `✅ Factura ${invoiceNumber} guardada localmente (pendiente sincronización)`;
      } else if (sendEmailOnCreate && customerData.customer_email) {
        try {
          const emailResult = await sendInvoiceEmail({
            email: customerData.customer_email,
            invoiceNumber: invoiceNumber,
            customerName: customerData.customer_name || 'Cliente',
            total: totalFactura,
            items: invoiceItems,
            businessId
          });
          
          if (!emailResult.demo) {
            await markInvoiceAsSent({
              invoiceId: invoice.id,
              businessId
            });
            successMessage = `✅ Factura ${invoiceNumber} creada y enviada a ${customerData.customer_email}`;
          } else {
            successMessage = `✅ Factura ${invoiceNumber} creada. ⚠️ Email NO enviado (configura EmailJS en Configuración)`;
          }
        } catch (emailError) {
          successMessage = `✅ Factura ${invoiceNumber} creada (⚠️ error al enviar email: ${emailError.message})`;
        }
      } else if (!customerData.customer_email) {
        successMessage = `✅ Factura ${invoiceNumber} creada exitosamente (sin email del cliente)`;
      }

      setSuccess(successMessage);
      setTimeout(() => setSuccess(''), 8000);
      setShowForm(false);
      resetForm();
      if (localOnly) {
        setFacturas((prev) => [
          {
            ...(invoice || {}),
            invoice_items: invoiceItems || []
          },
          ...prev
        ]);
      } else {
        await loadFacturas(businessId);
      }
      
    } catch (error) {
      
      // Si es error de sesión, redirigir
      if (error?.code === 'SESSION_EXPIRED' || String(error?.message || '').includes('sesión ha expirado')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      setError(error.message || 'Error desconocido al crear factura');
      setTimeout(() => setError(''), 8000);
    } finally {
      setIsCreatingInvoice(false);
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
    let shouldReloadAfterSend = true;
    
    try {
      // Obtener los datos completos de la factura
      const factura = await getInvoiceWithItemsById(facturaId, INVOICE_ITEM_LIST_COLUMNS);
      if (!factura) throw new Error('Factura no encontrada');

      // Validar que la factura tenga email del cliente
      if (!factura.customer_email) {
        setError('⚠️ Esta factura no tiene email del cliente. No se puede enviar.');
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
          items: factura.invoice_items || [],
          businessId: factura.business_id
        });
        
        // Actualizar estado de la factura a 'sent'
        const sentResult = await markInvoiceAsSent({
          invoiceId: facturaId,
          businessId: factura.business_id
        });

        if (sentResult?.localOnly) {
          shouldReloadAfterSend = false;
          setFacturas((prev) => prev.map((item) => (
            item.id === facturaId
              ? { ...item, status: 'sent', sent_at: new Date().toISOString() }
              : item
          )));
          setSuccess(`✅ Factura ${factura.invoice_number} marcada como enviada localmente (pendiente sincronización)`);
        } else if (emailResult.demo) {
          setSuccess(`✅ Factura ${factura.invoice_number} marcada como enviada. ⚠️ Email NO enviado (modo demo - configura EmailJS)`);
        } else {
          setSuccess(`✅ Factura ${factura.invoice_number} enviada exitosamente a ${factura.customer_email}`);
        }
      } catch (emailError) {
        // Error al enviar email
        throw new Error('Error al enviar email: ' + emailError.message);
      }
      
      setTimeout(() => setSuccess(''), 8000);
      
      // Recargar facturas
      const { businessId } = await resolveBusinessContext();
      
      if (businessId && shouldReloadAfterSend) {
        await loadFacturas(businessId);
      }

    } catch (error) {
      if (error?.code === 'SESSION_EXPIRED' || String(error?.message || '').includes('sesión ha expirado')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      // Error al enviar factura
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
      const { businessId } = await resolveBusinessContext();

      // Primero obtener los items de la factura antes de cancelarla
      const invoiceItems = await getInvoiceItemsByInvoiceId(invoiceToCancel);
      const { restoreError, localOnly } = await cancelInvoiceAndRestoreStock({
        invoiceId: invoiceToCancel,
        businessId,
        invoiceItems
      });

      setSuccess(
        localOnly
          ? '✅ Factura cancelada localmente (pendiente sync)'
          : restoreError
          ? '✅ Factura cancelada (⚠️ revisar restauración automática de stock)'
          : '✅ Factura cancelada y stock restaurado'
      );
      setTimeout(() => setSuccess(''), 5000);
      
      // Obtener business_id del usuario actual
      if (localOnly) {
        setFacturas((prev) => prev.map((item) => (
          item.id === invoiceToCancel
            ? { ...item, status: 'cancelled', cancelled_at: new Date().toISOString() }
            : item
        )));
      } else if (businessId) {
        await loadFacturas(businessId);
      }

      setShowCancelModal(false);
      setInvoiceToCancel(null);

    } catch (error) {
      if (error?.code === 'SESSION_EXPIRED' || String(error?.message || '').includes('sesión ha expirado')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      // Error al cancelar factura
      setError(error.message || 'Error desconocido al cancelar factura');
      setTimeout(() => setError(''), 8000);
      setShowCancelModal(false);
      setInvoiceToCancel(null);
    } finally {
      setLoading(false);
    }
  };

  // Funciones de eliminación (solo admin)
  const handleDeleteInvoice = (invoiceId) => {
    setInvoiceToDelete(invoiceId);
    setShowDeleteModal(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    setLoading(true);
    setError('');
    
    try {
      const { businessId } = await resolveBusinessContext();
      const deleteResult = await deleteInvoiceCascade({
        invoiceId: invoiceToDelete,
        businessId
      });

      setSuccess(
        deleteResult?.localOnly
          ? '✅ Factura eliminada localmente (pendiente sync)'
          : '✅ Factura eliminada exitosamente'
      );
      setTimeout(() => setSuccess(''), 4000);

      if (deleteResult?.localOnly) {
        setFacturas((prev) => prev.filter((item) => item.id !== invoiceToDelete));
      } else if (businessId) {
        await loadFacturas(businessId);
      }

      setShowDeleteModal(false);
      setInvoiceToDelete(null);

    } catch (error) {
      if (error?.code === 'SESSION_EXPIRED' || String(error?.message || '').includes('sesión ha expirado')) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      // Error al eliminar factura
      setError(error.message || 'Error desconocido al eliminar factura');
      setTimeout(() => setError(''), 8000);
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setInvoiceToDelete(null);
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

  // Memoizar productos y facturas filtradas
  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return [];
    
    const search = searchProduct.toLowerCase();
    return productos.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.code && p.code.toLowerCase().includes(search))
    ).slice(0, 5);
  }, [productos, searchProduct]);

  const filteredFacturas = useMemo(() => {
    if (!searchTerm.trim()) return facturas;
    
    const search = searchTerm.toLowerCase();
    return facturas.filter(f =>
      f.invoice_number?.toLowerCase().includes(search) ||
      f.customer_name?.toLowerCase().includes(search)
    );
  }, [facturas, searchTerm]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">📄 Facturación Electrónica</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-500 w-full sm:w-auto whitespace-nowrap transition-colors"
        >
          {showForm ? '❌ Cancelar' : '➕ Nueva Factura'}
        </button>
      </div>

      {/* Alertas mejoradas */}
      <SaleErrorAlert 
        isVisible={!!error}
        onClose={() => setError('')}
        title="Error"
        message={error}
        duration={5000}
      />

      <SaleSuccessAlert 
        isVisible={!!success}
        onClose={() => setSuccess('')}
        title="✨ Factura Creada"
        details={[{ label: 'Acción', value: success }]}
        duration={5000}
      />

      {showForm && (
        <div ref={formRef} className="mb-6 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Nueva Factura</h3>
          
          <form onSubmit={handleCreateInvoice}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
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
                
                {showProductSearch && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.map(producto => (
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
                                onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 text-sm"
                                title="Disminuir cantidad"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                                className="w-16 p-1 border rounded text-center"
                                min="0.01"
                                max={item.max_stock || 99999}
                                step="0.01"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
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
                        <td className="p-3 text-right text-xl text-blue-600">{formatPrice(totalFactura)}</td>
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
              disabled={isCreatingInvoice || items.length === 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreatingInvoice ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando factura...
                </>
              ) : (
                '✅ Crear Factura'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
        <AsyncStateWrapper
          loading={loading && !showForm}
          error={filteredFacturas.length === 0 ? error : null}
          dataCount={filteredFacturas.length}
          onRetry={loadData}
          skeletonType="facturas"
          hasFilters={Boolean(searchTerm.trim())}
          noResultsTitle="No hay facturas para esos filtros"
          emptyTitle="No hay facturas para mostrar"
          emptyDescription="Cuando generes una factura, aparecera en esta lista."
        >
          <div>
            {/* Vista móvil - Cards */}
            <div className="block sm:hidden divide-y">
              {filteredFacturas.map(factura => (
                <div key={factura.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-mono font-semibold text-sm">{factura.invoice_number}</div>
                      <div className="text-sm font-medium">{factura.customer_name}</div>
                      {factura.customer_id_number && (
                        <div className="text-xs text-gray-600">{factura.customer_id_number}</div>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      factura.status === 'validated' ? 'bg-green-100' :
                      factura.status === 'sent' ? 'bg-blue-100' :
                      factura.status === 'cancelled' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {getStatusBadge(factura.status)}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-2">
                    {formatDate(factura.issued_at)}
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm">{getPaymentMethodLabel(factura.payment_method)}</div>
                    <div className="text-base font-semibold">{formatPrice(factura.total)}</div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {factura.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleSendToClient(factura.id)}
                          disabled={loading}
                          className="flex-1 px-3 py-1.5 bg-accent-600 text-white rounded hover:bg-accent-500 disabled:bg-gray-400 text-xs transition-colors"
                        >
                          📧 Enviar
                        </button>
                        <button
                          onClick={() => handleCancelInvoice(factura.id)}
                          disabled={loading}
                          className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-xs"
                        >
                          ❌ Cancelar
                        </button>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDeleteInvoice(factura.id)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 text-xs"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                    {factura.status === 'sent' && (
                      <button
                        onClick={() => handleSendToClient(factura.id)}
                        disabled={loading}
                        className="flex-1 px-3 py-1.5 bg-accent-600 text-white rounded hover:bg-accent-500 disabled:bg-gray-400 text-xs transition-colors"
                      >
                        📧 Reenviar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Vista desktop - Tabla */}
            <table className="w-full hidden sm:table">
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
                {filteredFacturas.map(factura => (
                  <tr key={factura.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono font-semibold">{factura.invoice_number}</td>
                    <td className="p-3">
                      <div>{factura.customer_name}</div>
                      {factura.customer_id_number && (
                      <div className="text-sm text-gray-600">{factura.customer_id_number}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {formatDate(factura.issued_at)}
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
                            className="px-3 py-1 bg-accent-600 text-white rounded hover:bg-accent-500 disabled:bg-gray-400 text-sm transition-colors"
                            title="Enviar factura al cliente por email"
                          >
                            📧 Enviar
                          </button>
                          <button
                            onClick={() => handleCancelInvoice(factura.id)}
                            disabled={loading}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                            title="Cancelar factura"
                          >
                            ❌ Cancelar
                          </button>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(factura.id)}
                              disabled={loading}
                              className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-sm flex items-center gap-1"
                              title="Eliminar factura permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      {factura.status === 'sent' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-green-600 font-medium">✓ Enviada</span>
                          {factura.customer_email && (
                            <button
                              onClick={() => handleSendToClient(factura.id)}
                              disabled={loading}
                              className="text-xs text-[#d89b6f] hover:underline transition-colors"
                              title="Reenviar factura"
                            >
                              Reenviar
                            </button>
                          )}
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(factura.id)}
                              disabled={loading}
                              className="mt-1 px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-xs flex items-center gap-1"
                              title="Eliminar factura"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {factura.status === 'validated' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-gray-500">✓ Validada</span>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(factura.id)}
                              disabled={loading}
                              className="mt-1 px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-xs flex items-center gap-1"
                              title="Eliminar factura"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {factura.status === 'cancelled' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-gray-500">Cancelada</span>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(factura.id)}
                              disabled={loading}
                              className="mt-1 px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-xs flex items-center gap-1"
                              title="Eliminar factura"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </AsyncStateWrapper>
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

      {/* Modal de confirmación de eliminación de factura (solo admin) */}
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
              className="w-full max-w-md bg-white rounded-xl shadow-2xl"
            >
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-xl">
                <div className="flex items-center gap-3 text-white">
                  <Trash2 className="w-6 h-6" />
                  <h3 className="text-xl font-bold">Eliminar Factura</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-700 font-semibold">
                  ⚠️ ¿Estás seguro de eliminar esta factura permanentemente?
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>Esta acción no se puede deshacer.</strong> La factura será eliminada del sistema de forma permanente.
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
                    onClick={confirmDeleteInvoice}
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
  );
}
