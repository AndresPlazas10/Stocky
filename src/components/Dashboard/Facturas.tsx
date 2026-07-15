import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sendInvoiceEmail } from '../../utils/emailService.js';
import { formatPrice, formatDate } from '../../utils/formatters';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { AnimatePresence, motion } from 'framer-motion';
import { XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useAppToast } from '../../hooks/useAppToast';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import {
  cancelInvoiceAndRestoreStock,
  createInvoiceWithItemsAndStock,
  deleteInvoiceCascade,
  markInvoiceAsSent
} from '../../data/commands/invoicesCommands';
import {
  getBusinessContextByUserId,
  getInvoiceItemsByInvoiceId,
  getInvoiceWithItemsById,
  getInvoicesWithItemsByBusiness,
  getProductsForInvoicesByBusiness,
  getProductsStockByIds
} from '../../data/queries/invoicesQueries';
import { getAuthenticatedUser } from '../../data/queries/authQueries';
import { getPaymentMethodLabel } from '../ui/PaymentMethodBankLogo';

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

export default function Facturas({ userRole = 'admin', businessId: businessIdProp = null }: { userRole?: string; businessId?: string | null }) {
  const navigate = useNavigate();
  const { t } = useTranslation(['facturas', 'common']);
  const config = useBusinessConfig();
  const priceConfig = { locale: config.locale, currency: config.currency, currencySymbol: config.currencySymbol, decimals: config.decimals };
  const dateConfig = { timezone: config.timezone, locale: config.locale };
  
  const fmtPrice = (value, includeCurrency = true) => formatPrice(value, includeCurrency, priceConfig);
  const fmtDate = (timestamp, options = {}) => formatDate(timestamp, options, dateConfig);
  
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showError, showSuccess, ToastComponent } = useAppToast();
  
  // Refs
  const formRef = useRef(null);
  
  // Estados del formulario
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCliente] = useState('');
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
    setInvoices(await getInvoicesWithItemsByBusiness({
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
      const sessionError = new Error(t('facturas:errors.sessionRequired'));
      (sessionError as Error & { code: string }).code = 'SESSION_EXPIRED';
      throw sessionError;
    }

    const { businessId, employeeId } = await getBusinessContextByUserId(user.id);
    if (!businessId) {
      throw new Error(t('facturas:errors.loadFailed'));
    }

    return {
      userId: user.id,
      businessId,
      employeeId
    };
  }, [businessIdProp, t]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { businessId } = await resolveBusinessContext();

      // Cargar facturas
      const [, productsData] = await Promise.all([
        loadFacturas(businessId),
        getProductsForInvoicesByBusiness(businessId, PRODUCT_INVOICE_COLUMNS)
      ]);

      setProducts(productsData);

      // Tabla customers eliminada - no cargar clientes
      setCustomers([]);

    } catch (error) {
      if (error?.code === 'SESSION_EXPIRED') {
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [loadFacturas, resolveBusinessContext, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      showError('Error', t('facturas:errors.noStock', { name: producto.name }));
      return;
    }

    if (!producto.sale_price || producto.sale_price <= 0) {
      showError('Error', t('facturas:errors.noPrice', { name: producto.name }));
      return;
    }

    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.product_id === producto.id);
      
      if (existingItem) {
        if (existingItem.quantity >= producto.stock) {
          showError('Error', t('facturas:errors.insufficientStock', { stock: producto.stock, name: producto.name }));
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
  }, [t]);

  const handleRemoveItem = useCallback((productId) => {
    setItems(prevItems => prevItems.filter(item => item.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    setItems((prevItems) => prevItems.map((item) => {
      if (item.product_id !== productId) return item;

      const rawValue = String(newQuantity ?? '').trim();
      if (rawValue === '') {
        return { ...item, quantity: '', total: 0 };
      }

      const parsedValue = Number(rawValue);
      if (!Number.isFinite(parsedValue)) return item;
      if (parsedValue <= 0) {
        return { ...item, quantity: '', total: 0 };
      }

      return { ...item, quantity: parsedValue, total: parsedValue * item.unit_price };
    }));
  }, []);

  // Memoizar cálculo de total
  const totalFactura = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total, 0);
  }, [items]);

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    
    if (isCreatingInvoice) return;
    
    setIsCreatingInvoice(true);
    
    try {
      // Validaciones
      if (items.length === 0) {
        throw new Error(t('facturas:errors.noItems'));
      }

      const invalidItems = items.filter(item => item.quantity <= 0 || item.unit_price <= 0);
      if (invalidItems.length > 0) {
        throw new Error(t('facturas:errors.invalidItems'));
      }

      if (totalFactura <= 0) {
        throw new Error(t('facturas:errors.invalidTotal'));
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
            t('facturas:errors.stockCheckFailed', { name: item.product_name, available: product?.stock || 0, requested: item.quantity })
          );
        }
      }

      const customerData = {
        customer_name: t('form.consumerFinal', { ns: 'common' }),
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
      let successMessage = `✅ ${t('facturas:alerts.invoiceCreated', { number: invoiceNumber })}`;

      if (localOnly) {
        successMessage = `✅ ${t('facturas:alerts.invoiceSavedLocal', { number: invoiceNumber })}`;
      } else if (sendEmailOnCreate && customerData.customer_email) {
        try {
          const emailResult = await sendInvoiceEmail({
            email: customerData.customer_email,
            invoiceNumber: invoiceNumber,
            customerName: customerData.customer_name || t('facturas:labels.customer'),
            total: totalFactura,
            items: invoiceItems,
            businessId
          });
          
          if (!emailResult.demo) {
            await markInvoiceAsSent({
              invoiceId: invoice.id,
              businessId
            });
            successMessage = `✅ ${t('facturas:alerts.invoiceCreatedAndSent', { number: invoiceNumber, email: customerData.customer_email })}`;
          } else {
            successMessage = `✅ ${t('facturas:alerts.invoiceCreatedNoEmail', { number: invoiceNumber })}`;
          }
        } catch (emailError) {
          successMessage = `✅ ${t('facturas:alerts.invoiceCreatedEmailError', { number: invoiceNumber, error: emailError.message })}`;
        }
      } else if (!customerData.customer_email) {
        successMessage = `✅ ${t('facturas:alerts.invoiceCreatedNoCustomerEmail', { number: invoiceNumber })}`;
      }

      showSuccess('Éxito', successMessage);
      setShowForm(false);
      resetForm();
      if (localOnly) {
        setInvoices((prev) => [
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
          navigate('/login');
        }, 2000);
      }
      showError('Error', error.message || t('facturas:errors.processFailed'));
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
    let shouldReloadAfterSend = true;
    
    try {
      // Obtener los datos completos de la factura
      const invoice = await getInvoiceWithItemsById(facturaId, INVOICE_ITEM_LIST_COLUMNS);
      if (!invoice) throw new Error(t('facturas:errors.invoiceNotFound'));

      // Validar que la factura tenga email del cliente
      if (!invoice.customer_email) {
        showError('Error', t('facturas:errors.noCustomerEmail'));
        setLoading(false);
        return;
      }

      // Enviar factura por email
      try {
        const emailResult = await sendInvoiceEmail({
          email: invoice.customer_email,
          invoiceNumber: invoice.invoice_number,
            customerName: invoice.customer_name || t('facturas:labels.customer'),
          total: invoice.total,
          items: invoice.invoice_items || [],
          businessId: invoice.business_id
        });
        
        // Actualizar estado de la factura a 'sent'
        const sentResult = await markInvoiceAsSent({
          invoiceId: facturaId,
          businessId: invoice.business_id
        });

        if (sentResult?.localOnly) {
          shouldReloadAfterSend = false;
          setInvoices((prev) => prev.map((item) => (
            item.id === facturaId
              ? { ...item, status: 'sent', sent_at: new Date().toISOString() }
              : item
          )));
          showSuccess('Éxito', t('facturas:alerts.invoiceSentLocal', { number: invoice.invoice_number }));
        } else if (emailResult.demo) {
          showSuccess('Éxito', t('facturas:alerts.invoiceSentDemo', { number: invoice.invoice_number }));
        } else {
          showSuccess('Éxito', t('facturas:alerts.emailSent', { number: invoice.invoice_number, email: invoice.customer_email }));
        }
      } catch (emailError) {
        // Error al enviar email
        throw new Error(t('facturas:errors.emailFailed') + ': ' + emailError.message);
      }
      
      // Recargar facturas
      const { businessId } = await resolveBusinessContext();
      
      if (businessId && shouldReloadAfterSend) {
        await loadFacturas(businessId);
      }

    } catch (error) {
      if (error?.code === 'SESSION_EXPIRED' || String(error?.message || '').includes('sesión ha expirado')) {
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
      // Error al enviar factura
      showError('Error', error.message || t('facturas:errors.sendFailed'));
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
    
    try {
      const { businessId } = await resolveBusinessContext();

      // Primero obtener los items de la factura antes de cancelarla
      const invoiceItems = await getInvoiceItemsByInvoiceId(invoiceToCancel);
      const { restoreError, localOnly } = await cancelInvoiceAndRestoreStock({
        invoiceId: invoiceToCancel,
        businessId,
        invoiceItems
      });

      showSuccess(
        'Éxito',
        localOnly
          ? t('facturas:alerts.invoiceCancelledLocal')
          : restoreError
          ? t('facturas:alerts.invoiceCancelledStockWarning')
          : t('facturas:alerts.invoiceCancelled')
      );
      
      // Obtener business_id del usuario actual
      if (localOnly) {
        setInvoices((prev) => prev.map((item) => (
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
          navigate('/login');
        }, 2000);
      }
      // Error al cancelar factura
      showError('Error', error.message || t('facturas:errors.cancelFailed'));
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
    
    try {
      const { businessId } = await resolveBusinessContext();
      const deleteResult = await deleteInvoiceCascade({
        invoiceId: invoiceToDelete,
        businessId
      });

      showSuccess(
        'Éxito',
        deleteResult?.localOnly
          ? t('facturas:alerts.invoiceDeletedLocal')
          : t('facturas:alerts.invoiceDeleted')
      );

      if (deleteResult?.localOnly) {
        setInvoices((prev) => prev.filter((item) => item.id !== invoiceToDelete));
      } else if (businessId) {
        await loadFacturas(businessId);
      }

      setShowDeleteModal(false);
      setInvoiceToDelete(null);

    } catch (error) {
      if (error?.code === 'SESSION_EXPIRED' || String(error?.message || '').includes('sesión ha expirado')) {
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
      // Error al eliminar factura
      showError('Error', error.message || t('facturas:errors.deleteFailed'));
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
      pending: '📝 ' + t('facturas:status.pending'),
      sent: '🟢 ' + t('facturas:status.sent'),
      validated: '✅ ' + t('facturas:status.validated'),
      cancelled: '🔴 ' + t('facturas:status.cancelled')
    };
    return badges[status] || status;
  };

  // Memoizar productos y facturas filtradas
  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return [];
    
    const search = searchProduct.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.code && p.code.toLowerCase().includes(search))
    ).slice(0, 5);
  }, [products, searchProduct]);

  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices;

    const search = searchTerm.toLowerCase();
    return invoices.filter(f =>
      f.invoice_number?.toLowerCase().includes(search) ||
      f.customer_name?.toLowerCase().includes(search)
    );
  }, [invoices, searchTerm]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">📄 {t('title')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-500 w-full sm:w-auto whitespace-nowrap transition-colors"
        >
          {showForm ? '❌ ' + t('buttons.cancel') : '➕ ' + t('buttons.newInvoice')}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="mb-6 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">{t('form.createTitle')}</h3>
          
          <form onSubmit={handleCreateInvoice}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('facturas:labels.customer')}</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">{t('form.consumerFinal', { ns: 'common' })}</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.id_number || t('facturas:labels.noId')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('facturas:labels.paymentMethod')}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  required
                >
                  <option value="cash">💵 {t('paymentMethods.cash', { ns: 'common' })}</option>
                  <option value="card">💳 {t('paymentMethods.card', { ns: 'common' })}</option>
                  <option value="transfer">🏦 {t('paymentMethods.transfer', { ns: 'common' })}</option>
                  <option value="credit">📝 {t('paymentMethods.mixed', { ns: 'common' })}</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('facturas:labels.items')}</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('facturas:labels.searchProduct')}
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
                          {t('facturas:labels.code')}: {producto.code} | {t('facturas:labels.price')}: {fmtPrice(producto.sale_price)} | {t('facturas:labels.stock')}: {producto.stock}
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
                        <th className="p-2 text-left">{t('facturas:labels.product')}</th>
                        <th className="p-2 text-center">{t('facturas:form.quantity')}</th>
                        <th className="p-2 text-right">{t('facturas:form.unitPrice')}</th>
                        <th className="p-2 text-right">{t('facturas:labels.total')}</th>
                        <th className="p-2 text-center">{t('facturas:labels.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.product_id} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{item.product_name}</div>
                            {item.max_stock && (
                              <div className="text-xs text-gray-500">{t('facturas:labels.stockAvailable')}: {item.max_stock}</div>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product_id, Math.max(0, Number(item.quantity || 0) - 1))}
                                className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 text-sm"
                                title={t('facturas:labels.decreaseQuantity')}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.quantity === '' ? '' : item.quantity}
                                onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                                className="w-16 p-1 border rounded text-center"
                                min="0.01"
                                max={item.max_stock || 99999}
                                step="0.01"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product_id, Number(item.quantity || 0) + 1)}
                                className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 text-sm"
                                title={t('facturas:labels.increaseQuantity')}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-2 text-right">{fmtPrice(item.unit_price)}</td>
                          <td className="p-2 text-right font-semibold text-gray-600">{fmtPrice(item.total)}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.product_id)}
                              className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                              title={t('facturas:labels.removeProduct')}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr className="border-t-2">
                        <td colSpan={3} className="p-3 text-right text-lg">{t('facturas:labels.totalToPay')}:</td>
                        <td className="p-3 text-right text-xl text-gray-600">{fmtPrice(totalFactura)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('facturas:form.notesOptional')}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border rounded-lg"
                rows={3}
                placeholder={t('facturas:form.notesPlaceholder')}
              ></textarea>
            </div>

            {/* Checkbox para enviar email automáticamente */}
            {selectedCustomer && customers.find(c => c.id === selectedCustomer)?.email && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmailOnCreate}
                    onChange={(e) => setSendEmailOnCreate(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">
                    📧 {t('facturas:form.sendEmailOnCreate')} ({customers.find(c => c.id === selectedCustomer)?.email})
                  </span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  {t('facturas:form.sendEmailHint')}
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
                  {t('facturas:buttons.processing')}
                </>
              ) : (
                '✅ ' + t('facturas:buttons.createInvoice')
              )}
            </button>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('facturas:labels.search')}</label>
            <input
              type="text"
              placeholder={t('facturas:labels.searchInvoices')}
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
          error={filteredInvoices.length === 0 ? error : null}
          dataCount={filteredInvoices.length}
          onRetry={loadData}
          skeletonType="facturas"
          hasFilters={Boolean(searchTerm.trim())}
          noResultsTitle={t('facturas:empty.noResults')}
          emptyTitle={t('facturas:empty.noInvoices')}
          emptyDescription={t('facturas:empty.noInvoicesDescription')}
        >
          <div>
            {/* Vista móvil - Cards */}
            <div className="block sm:hidden divide-y">
              {filteredInvoices.map(invoice => (
                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-mono font-semibold text-sm">{invoice.invoice_number}</div>
                      <div className="text-sm font-medium">{invoice.customer_name}</div>
                      {invoice.customer_id_number && (
                        <div className="text-xs text-gray-600">{invoice.customer_id_number}</div>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      invoice.status === 'validated' ? 'bg-green-100' :
                      invoice.status === 'sent' ? 'bg-gray-100' :
                      invoice.status === 'cancelled' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {getStatusBadge(invoice.status)}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-2">
                    {fmtDate(invoice.issued_at)}
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm">{getPaymentMethodLabel(invoice.payment_method, t)}</div>
                    <div className="text-base font-semibold">{fmtPrice(invoice.total)}</div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {invoice.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleSendToClient(invoice.id)}
                          disabled={loading}
                          className="flex-1 px-3 py-1.5 bg-accent-600 text-white rounded hover:bg-accent-500 disabled:bg-gray-400 text-xs transition-colors"
                        >
                            📧 {t('buttons.send', { ns: 'common' })}
                        </button>
                        <button
                          onClick={() => handleCancelInvoice(invoice.id)}
                          disabled={loading}
                          className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-xs"
                        >
                            ❌ {t('buttons.cancel', { ns: 'common' })}
                        </button>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 text-xs"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                    {invoice.status === 'sent' && (
                      <button
                        onClick={() => handleSendToClient(invoice.id)}
                        disabled={loading}
                        className="flex-1 px-3 py-1.5 bg-accent-600 text-white rounded hover:bg-accent-500 disabled:bg-gray-400 text-xs transition-colors"
                      >
                        📧 {t('buttons.send', { ns: 'common' })}
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
                  <th className="p-3 text-left">{t('facturas:labels.invoiceNumberShort')}</th>
                  <th className="p-3 text-left">{t('facturas:labels.customer')}</th>
                  <th className="p-3 text-left">{t('facturas:labels.invoiceDate')}</th>
                  <th className="p-3 text-right">{t('facturas:labels.total')}</th>
                  <th className="p-3 text-left">{t('facturas:labels.payment')}</th>
                  <th className="p-3 text-left">{t('facturas:labels.status')}</th>
                  <th className="p-3 text-center">{t('facturas:labels.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(invoice => (
                  <tr key={invoice.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono font-semibold">{invoice.invoice_number}</td>
                    <td className="p-3">
                      <div>{invoice.customer_name}</div>
                      {invoice.customer_id_number && (
                      <div className="text-sm text-gray-600">{invoice.customer_id_number}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {fmtDate(invoice.issued_at)}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {fmtPrice(invoice.total)}
                  </td>
                  <td className="p-3">{getPaymentMethodLabel(invoice.payment_method, t)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-sm ${
                      invoice.status === 'validated' ? 'bg-green-100' :
                      invoice.status === 'sent' ? 'bg-gray-100' :
                      invoice.status === 'cancelled' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {getStatusBadge(invoice.status)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex gap-2 justify-center">
                      {invoice.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleSendToClient(invoice.id)}
                            disabled={loading}
                            className="px-3 py-1 bg-accent-600 text-white rounded hover:bg-accent-500 disabled:bg-gray-400 text-sm transition-colors"
                            title={t('facturas:titles.sendInvoice')}
                          >
                          📧 {t('buttons.send', { ns: 'common' })}
                          </button>
                          <button
                            onClick={() => handleCancelInvoice(invoice.id)}
                            disabled={loading}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                            title={t('facturas:titles.cancelInvoice')}
                          >
                          ❌ {t('buttons.cancel', { ns: 'common' })}
                          </button>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              disabled={loading}
                              className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-sm flex items-center gap-1"
                              title={t('facturas:titles.deleteInvoicePermanent')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      {invoice.status === 'sent' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-green-600 font-medium">✓ {t('facturas:status.sent')}</span>
                          {invoice.customer_email && (
                            <button
                              onClick={() => handleSendToClient(invoice.id)}
                              disabled={loading}
                              className="text-xs text-[#d89b6f] hover:underline transition-colors"
                              title={t('facturas:titles.resendInvoice')}
                            >
                              {t('buttons.send', { ns: 'common' })}
                            </button>
                          )}
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              disabled={loading}
                              className="mt-1 px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-xs flex items-center gap-1"
                              title={t('facturas:titles.deleteInvoice')}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {invoice.status === 'validated' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-gray-500">✓ {t('facturas:status.validated')}</span>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              disabled={loading}
                              className="mt-1 px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-xs flex items-center gap-1"
                              title={t('facturas:titles.deleteInvoice')}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {invoice.status === 'cancelled' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-gray-500">{t('facturas:status.cancelled')}</span>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              disabled={loading}
                              className="mt-1 px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:bg-gray-400 text-xs flex items-center gap-1"
                              title={t('facturas:titles.deleteInvoice')}
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
                  <h3 className="text-xl font-bold">{t('facturas:alerts.confirmCancelTitle')}</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  {t('facturas:alerts.confirmCancelMessage')}
                </p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-800">
                    ℹ️ {t('facturas:alerts.cancelActionDescription')}
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelCancelInvoice}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    {t('buttons.close', { ns: 'common' })}
                  </button>
                  <button
                    onClick={confirmCancelInvoice}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    {loading ? t('facturas:buttons.cancelling') : t('facturas:buttons.cancelInvoice')}
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
                  <h3 className="text-xl font-bold">{t('facturas:buttons.deleteInvoice')}</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-700 font-semibold">
                  ⚠️ {t('facturas:alerts.confirmDeleteMessage')}
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>{t('facturas:alerts.confirmDeleteWarning')}</strong> {t('facturas:alerts.deletePermanentDescription')}
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    {t('buttons.cancel', { ns: 'common' })}
                  </button>
                  <button
                    onClick={confirmDeleteInvoice}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {loading ? t('facturas:buttons.deleting') : t('buttons.delete', { ns: 'common' })}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ToastComponent />
    </div>
  );
}
