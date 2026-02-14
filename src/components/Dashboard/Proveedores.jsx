import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';

import { 
  Trash2, 
  Plus, 
  Edit2, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText,
  Search,
  Package
} from 'lucide-react';

const BASE_SUPPLIER_COLUMNS = 'id, business_id, business_name, contact_name, email, phone, address, notes, created_at';
const isMissingColumnError = (err, columnName) => {
  const text = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  return (
    err?.code === '42703' ||
    err?.code === 'PGRST204' ||
    (text.includes('column') && text.includes(columnName.toLowerCase()))
  );
};

function Proveedores({ businessId }) {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para modal de confirmación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [supplierTaxColumn, setSupplierTaxColumn] = useState('nit');

  // Estado del formulario
  const [formData, setFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    nit: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProveedores = useCallback(async () => {
    try {
      setLoading(true);
      const candidates = supplierTaxColumn === 'nit' ? ['nit', 'tax_id'] : ['tax_id', 'nit'];
      let data = null;
      let lastError = null;
      let resolvedColumn = supplierTaxColumn;

      for (const column of candidates) {
        const result = await supabase
          .from('suppliers')
          .select(`${BASE_SUPPLIER_COLUMNS}, ${column}`)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });

        if (!result.error) {
          data = result.data;
          resolvedColumn = column;
          lastError = null;
          break;
        }

        lastError = result.error;
        if (!isMissingColumnError(result.error, column)) {
          break;
        }
      }

      if (lastError) throw lastError;
      if (resolvedColumn !== supplierTaxColumn) {
        setSupplierTaxColumn(resolvedColumn);
      }

      setProveedores((data || []).map((supplier) => ({
        ...supplier,
        nit: supplier.nit ?? supplier.tax_id ?? null
      })));
    } catch (error) {
      setError(`❌ Error al cargar los proveedores: ${error?.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  }, [businessId, supplierTaxColumn]);

  useEffect(() => {
    if (businessId) {
      loadProveedores();
    }
  }, [businessId, loadProveedores]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevenir doble click
    
    setIsSubmitting(true);
    setError('');
    
    try {
      if (!businessId) {
        throw new Error('No se detectó el negocio actual');
      }

      if (!formData.business_name.trim()) {
        throw new Error('El nombre del negocio es obligatorio');
      }

      const supplierPayload = {
        business_name: formData.business_name,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
        [supplierTaxColumn]: formData.nit || null
      };
      const fallbackTaxColumn = supplierTaxColumn === 'nit' ? 'tax_id' : 'nit';

      if (editingSupplier) {
        // Actualizar proveedor existente
        let { error } = await supabase
          .from('suppliers')
          .update(supplierPayload)
          .eq('id', editingSupplier.id)
          .select()
          .maybeSingle();

        if (error && isMissingColumnError(error, supplierTaxColumn)) {
          const retryPayload = { ...supplierPayload };
          delete retryPayload[supplierTaxColumn];
          retryPayload[fallbackTaxColumn] = formData.nit || null;

          const retry = await supabase
            .from('suppliers')
            .update(retryPayload)
            .eq('id', editingSupplier.id)
            .select()
            .maybeSingle();

          error = retry.error;
          if (!retry.error) {
            setSupplierTaxColumn(fallbackTaxColumn);
          }
        }

        if (error) throw error;
      } else {
        // Crear nuevo proveedor
        let { error } = await supabase
          .from('suppliers')
          .insert({
            business_id: businessId,
            ...supplierPayload,
            created_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (error && isMissingColumnError(error, supplierTaxColumn)) {
          const retryPayload = { ...supplierPayload };
          delete retryPayload[supplierTaxColumn];
          retryPayload[fallbackTaxColumn] = formData.nit || null;

          const retry = await supabase
            .from('suppliers')
            .insert({
              business_id: businessId,
              ...retryPayload,
              created_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();

          error = retry.error;
          if (!retry.error) {
            setSupplierTaxColumn(fallbackTaxColumn);
          }
        }

        if (error) throw error;
      }

      // Código de éxito
      setSuccess(editingSupplier ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente');
      resetForm();
      await loadProveedores();
      setShowModal(false);
      
    } catch (error) {
      
      setError(error.message || 'Error al guardar el proveedor');
    } finally {
      setIsSubmitting(false); // SIEMPRE desbloquear
    }
  }, [editingSupplier, formData, businessId, loadProveedores, isSubmitting, supplierTaxColumn]);

  const handleEdit = useCallback((supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      business_name: supplier.business_name || '',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      nit: supplier.nit || '',
      notes: supplier.notes || ''
    });
    setShowModal(true);
  }, []);

  const handleDelete = useCallback((supplierId) => {
    setSupplierToDelete(supplierId);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!supplierToDelete) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierToDelete);

      if (error) {
        if (error.code === '23503') {
          setError('❌ No se puede eliminar este proveedor porque tiene compras asociadas');
          setShowDeleteModal(false);
          setSupplierToDelete(null);
          return;
        }
        throw error;
      }

      setSuccess('✅ Proveedor eliminado exitosamente');
      loadProveedores();
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    } catch {
      setError('❌ Error al eliminar el proveedor');
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    }
  }, [supplierToDelete, loadProveedores]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setSupplierToDelete(null);
  }, []);

  const resetForm = () => {
    setFormData({
      business_name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      nit: '',
      notes: ''
    });
    setEditingSupplier(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => {
    let errorTimer, successTimer;
    if (error) errorTimer = setTimeout(() => setError(''), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(''), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);

  // Memoizar proveedores filtrados
  const filteredProveedores = useMemo(() => {
    if (!searchTerm.trim()) return proveedores;
    const search = searchTerm.toLowerCase();
    return proveedores.filter(proveedor => 
      proveedor.business_name?.toLowerCase().includes(search) ||
      proveedor.contact_name?.toLowerCase().includes(search) ||
      proveedor.email?.toLowerCase().includes(search) ||
      proveedor.nit?.toLowerCase().includes(search)
    );
  }, [proveedores, searchTerm]);

  const successTitle = useMemo(() => {
    const normalized = success.toLowerCase();
    if (normalized.includes('eliminad')) return '✨ Proveedor eliminado';
    if (normalized.includes('actualizad')) return '✨ Proveedor actualizado';
    if (normalized.includes('cread')) return '✨ Proveedor creado';
    return '✨ Proveedor guardado';
  }, [success]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary/20 via-white to-[#ffe498]/10 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-accent-500 to-secondary-500 rounded-xl">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Proveedores</h1>
                <p className="text-gray-600">Gestiona tu red de proveedores</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              <Plus className="w-5 h-5" />
              Nuevo Proveedor
            </button>
          </div>
        </motion.div>

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
          title={successTitle}
          details={[{ label: 'Acción', value: success }]}
          duration={5000}
        />

        {/* Barra de búsqueda y estadísticas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por empresa, contacto, email o NIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex gap-4">
              <div className="px-6 py-3 bg-gradient-to-br from-accent-500/10 to-[#ffe498]/10 rounded-xl">
                <div className="text-2xl font-bold text-accent-600">{proveedores.length}</div>
                <div className="text-sm text-gray-600">Total Proveedores</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contenido principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          {loading && proveedores.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ffe498] border-t-transparent"></div>
                <p className="text-gray-600">Cargando proveedores...</p>
              </div>
            </div>
          ) : proveedores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="p-6 bg-gradient-to-br from-accent-500/10 to-[#ffe498]/10 rounded-full mb-6">
                <Package className="w-16 h-16 text-accent-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No hay proveedores registrados</h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                Comienza agregando proveedores para gestionar mejor tus compras e inventario
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                <Plus className="w-5 h-5" />
                Agregar Primer Proveedor
              </button>
            </div>
          ) : filteredProveedores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <Search className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">No se encontraron resultados</h3>
              <p className="text-gray-600">Intenta con otros términos de búsqueda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Vista de tarjetas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredProveedores.map((proveedor, index) => (
                  <motion.div
                    key={proveedor.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="bg-white rounded-2xl shadow-lg border-2 border-accent-100 hover:border-primary-300 hover:shadow-xl transition-all duration-300">
                      <div className="p-4 sm:p-6">
                        {/* Header con empresa */}
                        <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-accent-200">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-3 bg-gradient-to-br from-primary-100 to-accent-100 rounded-xl shrink-0">
                              <Building2 className="w-6 h-6 text-primary-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-bold text-primary-900 mb-1 break-words">
                                {proveedor.business_name}
                              </h3>
                              {proveedor.nit && (
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-accent-100 text-accent-700 rounded-lg text-xs font-medium">
                                  <FileText className="w-3 h-3" />
                                  NIT: {proveedor.nit}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleEdit(proveedor)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-all duration-300 hover:scale-110"
                              title="Editar proveedor"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(proveedor.id)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-all duration-300 hover:scale-110"
                              title="Eliminar proveedor"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Información de contacto */}
                        <div className="space-y-3">
                          {/* Contacto */}
                          {proveedor.contact_name && (
                            <div className="flex items-center gap-3">
                              <User className="w-4 h-4 text-accent-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">Contacto</p>
                                <p className="text-sm font-medium text-gray-700 truncate">
                                  {proveedor.contact_name}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Email */}
                          {proveedor.email && (
                            <div className="flex items-center gap-3">
                              <Mail className="w-4 h-4 text-accent-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">Email</p>
                                <a 
                                  href={`mailto:${proveedor.email}`} 
                                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors truncate block"
                                >
                                  {proveedor.email}
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Teléfono */}
                          {proveedor.phone && (
                            <div className="flex items-center gap-3">
                              <Phone className="w-4 h-4 text-accent-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">Teléfono</p>
                                <a 
                                  href={`tel:${proveedor.phone}`}
                                  className="text-sm font-medium text-gray-700 hover:text-primary-700 transition-colors"
                                >
                                  {proveedor.phone}
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Dirección */}
                          {proveedor.address && (
                            <div className="flex items-start gap-3">
                              <MapPin className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">Dirección</p>
                                <p className="text-sm font-medium text-gray-700 break-words">
                                  {proveedor.address}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Notas */}
                          {proveedor.notes && (
                            <div className="flex items-start gap-3 pt-3 border-t border-accent-100">
                              <FileText className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-accent-500 uppercase tracking-wide">Notas</p>
                                <p className="text-sm text-gray-600 break-words">
                                  {proveedor.notes}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Mensaje si no hay información */}
                          {!proveedor.contact_name && !proveedor.email && !proveedor.phone && !proveedor.address && !proveedor.notes && (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-400 italic">
                                No hay información de contacto adicional
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal para crear/editar proveedor */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-3 sm:p-4 overflow-y-auto"
            onClick={() => setShowModal(false)}
          >
              <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden my-2 sm:my-0"
            >
              {/* Header del modal */}
              <div className="gradient-primary text-white p-4 sm:p-6 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    {editingSupplier ? (
                      <Edit2 className="w-8 h-8" />
                    ) : (
                      <Plus className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                    </h2>
                    <p className="text-white/80 mt-1">
                      {editingSupplier ? 'Actualiza la información del proveedor' : 'Completa los datos del nuevo proveedor'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido del modal */}
              <form onSubmit={handleSubmit} className="max-h-[calc(92vh-96px)] overflow-y-auto">
                <div className="p-4 sm:p-6 space-y-4">
                  
                  {/* Nombre de la empresa */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Building2 className="w-4 h-4 text-accent-600" />
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      name="business_name"
                      value={formData.business_name}
                      onChange={handleChange}
                      placeholder="Ej: Distribuidora ABC S.A.S"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Fila: Contacto y NIT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <User className="w-4 h-4 text-accent-600" />
                        Persona de Contacto
                      </label>
                      <input
                        type="text"
                        name="contact_name"
                        value={formData.contact_name}
                        onChange={handleChange}
                        placeholder="Ej: Juan Pérez"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <FileText className="w-4 h-4 text-accent-600" />
                        NIT
                      </label>
                      <input
                        type="text"
                        name="nit"
                        value={formData.nit}
                        onChange={handleChange}
                        placeholder="123456789-0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Fila: Email y Teléfono */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Mail className="w-4 h-4 text-accent-600" />
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="contacto@empresa.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Phone className="w-4 h-4 text-accent-600" />
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+57 300 123 4567"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 text-accent-600" />
                        Dirección
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Calle 123 #45-67, Bogotá"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <FileText className="w-4 h-4 text-accent-600" />
                        Notas
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Información adicional sobre el proveedor, términos de pago, etc..."
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ffe498] focus:border-transparent transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="sticky bottom-4 bg-white flex flex-col sm:flex-row gap-2 mt-5 pt-3 pb-2 px-2 sm:px-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    disabled={isSubmitting}
                    className="order-2 sm:order-1 w-full sm:flex-1 h-10 sm:h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-all duration-300 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="order-1 sm:order-2 w-full sm:flex-1 h-10 sm:h-10 px-4 gradient-primary hover:from-[#f1c691] hover:to-[#edb886] text-white rounded-lg font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        {editingSupplier ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        {editingSupplier ? 'Actualizar' : 'Crear Proveedor'}
                      </>
                    )}
                  </button>
                </div>
              </form>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Header del modal */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Eliminar Proveedor</h2>
                    <p className="text-red-100 mt-1">Esta acción no se puede deshacer</p>
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6">
                <p className="text-gray-700 text-lg mb-4">
                  ¿Estás seguro de que deseas eliminar este proveedor?
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Importante:</p>
                      <p>Si este proveedor tiene compras asociadas, no podrá ser eliminado. En ese caso, considera desactivarlo en su lugar.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Eliminar
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

export default Proveedores;
