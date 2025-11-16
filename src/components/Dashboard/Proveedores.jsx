import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client';
import { 
  Trash2, 
  AlertTriangle, 
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

  const loadProveedores = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProveedores(data || []);
    } catch (error) {
      setError('Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadProveedores();
    }
  }, [businessId, loadProveedores]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!formData.business_name.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (editingSupplier) {
        // Actualizar proveedor existente
        const { error } = await supabase
          .from('suppliers')
          .update({
            business_name: formData.business_name,
            contact_name: formData.contact_name || null,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            nit: formData.nit || null,
            notes: formData.notes || null
          })
          .eq('id', editingSupplier.id);

        if (error) throw error;
        setSuccess('Proveedor actualizado exitosamente');
      } else {
        // Crear nuevo proveedor
        const { error } = await supabase
          .from('suppliers')
          .insert({
            business_id: businessId,
            business_name: formData.business_name,
            contact_name: formData.contact_name || null,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            nit: formData.nit || null,
            notes: formData.notes || null
          });

        if (error) throw error;
        setSuccess('Proveedor creado exitosamente');
      }

      resetForm();
      loadProveedores();
      setShowModal(false);
    } catch (error) {
      setError(error.message || 'Error al guardar el proveedor');
    } finally {
      setLoading(false);
    }
  }, [businessId, formData, editingSupplier, loadProveedores]);

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
    } catch (error) {
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



  return (
    <div className="min-h-screen bg-gradient-to-br from-[#C4DFE6]/20 via-white to-[#66A5AD]/10 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-[#003B46] to-[#07575B] rounded-xl">
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
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003B46] to-[#07575B] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              <Plus className="w-5 h-5" />
              Nuevo Proveedor
            </button>
          </div>
        </motion.div>

        {/* Alertas */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </motion.div>
          )}
          
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg flex items-center gap-3"
            >
              <div className="w-5 h-5 text-green-500">✓</div>
              <span className="text-green-700">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

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
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex gap-4">
              <div className="px-6 py-3 bg-gradient-to-br from-[#003B46]/10 to-[#66A5AD]/10 rounded-xl">
                <div className="text-2xl font-bold text-[#003B46]">{proveedores.length}</div>
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
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#66A5AD] border-t-transparent"></div>
                <p className="text-gray-600">Cargando proveedores...</p>
              </div>
            </div>
          ) : proveedores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="p-6 bg-gradient-to-br from-[#003B46]/10 to-[#66A5AD]/10 rounded-full mb-6">
                <Package className="w-16 h-16 text-[#003B46]" />
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
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003B46] to-[#07575B] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white">
                    <th className="px-6 py-4 text-left text-sm font-semibold">Empresa</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Contacto</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Teléfono</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">NIT</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProveedores.map((proveedor, index) => (
                    <motion.tr
                      key={proveedor.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gradient-to-r hover:from-[#C4DFE6]/10 hover:to-transparent transition-all duration-300"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-[#003B46]/10 to-[#66A5AD]/10 rounded-lg">
                            <Building2 className="w-5 h-5 text-[#003B46]" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">{proveedor.business_name}</div>
                            {proveedor.notes && (
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {proveedor.notes.substring(0, 30)}{proveedor.notes.length > 30 ? '...' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {proveedor.contact_name ? (
                          <div className="flex items-center gap-2 text-gray-700">
                            <User className="w-4 h-4 text-gray-400" />
                            {proveedor.contact_name}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {proveedor.email ? (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <a href={`mailto:${proveedor.email}`} className="hover:text-[#003B46] transition-colors">
                              {proveedor.email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {proveedor.phone ? (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {proveedor.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {proveedor.nit ? (
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                            {proveedor.nit}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(proveedor)}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all duration-300 hover:scale-110"
                            title="Editar proveedor"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(proveedor.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all duration-300 hover:scale-110"
                            title="Eliminar proveedor"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Header del modal */}
              <div className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6">
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
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-6">
                  
                  {/* Nombre de la empresa */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Building2 className="w-4 h-4 text-[#003B46]" />
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      name="business_name"
                      value={formData.business_name}
                      onChange={handleChange}
                      placeholder="Ej: Distribuidora ABC S.A.S"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Fila: Contacto y NIT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <User className="w-4 h-4 text-[#003B46]" />
                        Persona de Contacto
                      </label>
                      <input
                        type="text"
                        name="contact_name"
                        value={formData.contact_name}
                        onChange={handleChange}
                        placeholder="Ej: Juan Pérez"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <FileText className="w-4 h-4 text-[#003B46]" />
                        NIT
                      </label>
                      <input
                        type="text"
                        name="nit"
                        value={formData.nit}
                        onChange={handleChange}
                        placeholder="123456789-0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Fila: Email y Teléfono */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Mail className="w-4 h-4 text-[#003B46]" />
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="contacto@empresa.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <Phone className="w-4 h-4 text-[#003B46]" />
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+57 300 123 4567"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Dirección */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <MapPin className="w-4 h-4 text-[#003B46]" />
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Calle 123 #45-67, Bogotá"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <FileText className="w-4 h-4 text-[#003B46]" />
                      Notas
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      placeholder="Información adicional sobre el proveedor, términos de pago, etc..."
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#003B46] to-[#07575B] hover:from-[#07575B] hover:to-[#003B46] text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        {editingSupplier ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
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

