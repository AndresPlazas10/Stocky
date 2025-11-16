import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client';
import {
  Settings,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Edit2,
  Save,
  X,
  LogOut,
  CheckCircle,
  AlertTriangle,
  Info,
  Database,
  Shield
} from 'lucide-react';

function Configuracion({ user, business, onBusinessUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingBusiness, setEditingBusiness] = useState(false);
  
  const [businessData, setBusinessData] = useState({
    name: '',
    tax_id: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (business) {
      setBusinessData({
        name: business.name || '',
        tax_id: business.tax_id || '',
        email: business.email || '',
        phone: business.phone || '',
        address: business.address || ''
      });
    }
  }, [business]);

  const handleBusinessChange = useCallback((e) => {
    const { name, value } = e.target;
    setBusinessData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleUpdateBusiness = useCallback(async (e) => {
    e.preventDefault();
    
    if (!businessData.name.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const { data, error: updateError } = await supabase
        .from('businesses')
        .update({
          name: businessData.name,
          tax_id: businessData.tax_id,
          email: businessData.email,
          phone: businessData.phone,
          address: businessData.address
        })
        .eq('id', business.id)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      setSuccess('Información actualizada correctamente');
      setEditingBusiness(false);
      
      // Actualizar business en el componente padre
      if (onBusinessUpdate && data) {
        onBusinessUpdate(data);
      }

      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      setError(error.message || 'Error al actualizar la información');
    } finally {
      setLoading(false);
    }
  }, [businessData, business, onBusinessUpdate]);

  const handleLogout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/';
    } catch (error) {
      setError('No se pudo cerrar la sesión correctamente');
    }
  }, []);

  useEffect(() => {
    let errorTimer, successTimer;
    if (error) errorTimer = setTimeout(() => setError(''), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(''), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#C4DFE6]/20 via-white to-[#66A5AD]/10 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#003B46] to-[#07575B] rounded-xl">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Configuración</h1>
              <p className="text-gray-600">Administra tu cuenta y negocio</p>
            </div>
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
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-700">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Información del Usuario */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Información del Usuario</h2>
                <p className="text-white/80">Datos de tu cuenta</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-[#003B46]" />
                  <span className="text-sm text-gray-600 font-medium">Email</span>
                </div>
                <p className="text-lg font-semibold text-gray-800 pl-8">{user?.email}</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-[#003B46]" />
                  <span className="text-sm text-gray-600 font-medium">ID de Usuario</span>
                </div>
                <p className="text-sm font-mono text-gray-600 pl-8 break-all">{user?.id?.substring(0, 30)}...</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-all duration-300 hover:shadow-md"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </button>
          </div>
        </motion.div>

        {/* Información del Negocio */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Información del Negocio</h2>
                  <p className="text-white/80">Datos de tu empresa</p>
                </div>
              </div>

              {!editingBusiness && (
                <button
                  onClick={() => setEditingBusiness(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all backdrop-blur-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {!editingBusiness ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="w-5 h-5 text-[#003B46]" />
                    <span className="text-sm text-gray-600 font-medium">Nombre del Negocio</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.name}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-[#003B46]" />
                    <span className="text-sm text-gray-600 font-medium">NIT/RUT</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.tax_id || 'No especificado'}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-[#003B46]" />
                    <span className="text-sm text-gray-600 font-medium">Email</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.email || 'No especificado'}</p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Phone className="w-5 h-5 text-[#003B46]" />
                    <span className="text-sm text-gray-600 font-medium">Teléfono</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-800 pl-8">{business?.phone || 'No especificado'}</p>
                </div>

                {business?.address && (
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 md:col-span-2">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="w-5 h-5 text-[#003B46]" />
                      <span className="text-sm text-gray-600 font-medium">Dirección</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-800 pl-8">{business.address}</p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleUpdateBusiness} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Building2 className="w-4 h-4 text-[#003B46]" />
                      Nombre del Negocio *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={businessData.name}
                      onChange={handleBusinessChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      placeholder="Mi Negocio S.A.S"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <FileText className="w-4 h-4 text-[#003B46]" />
                      NIT/RUT
                    </label>
                    <input
                      type="text"
                      name="tax_id"
                      value={businessData.tax_id}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      placeholder="123456789-0"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Mail className="w-4 h-4 text-[#003B46]" />
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={businessData.email}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      placeholder="contacto@negocio.com"
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
                      value={businessData.phone}
                      onChange={handleBusinessChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                      placeholder="+57 300 123 4567"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <MapPin className="w-4 h-4 text-[#003B46]" />
                      Dirección
                    </label>
                    <textarea
                      name="address"
                      value={businessData.address}
                      onChange={handleBusinessChange}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all resize-none"
                      placeholder="Calle 123 #45-67, Ciudad"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003B46] to-[#07575B] hover:from-[#07575B] hover:to-[#003B46] text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBusiness(false);
                      setBusinessData({
                        name: business?.name || '',
                        tax_id: business?.tax_id || '',
                        email: business?.email || '',
                        phone: business?.phone || '',
                        address: business?.address || ''
                      });
                    }}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* Información del Sistema */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Info className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Información del Sistema</h2>
                <p className="text-white/80">Detalles técnicos</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-blue-700 font-medium">Versión</span>
                </div>
                <p className="text-lg font-bold text-blue-800 pl-8">Stockly v1.0.0</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-purple-700 font-medium">Base de Datos</span>
                </div>
                <p className="text-lg font-bold text-purple-800 pl-8">Supabase PostgreSQL</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Estado</span>
                </div>
                <p className="text-lg font-bold text-green-800 pl-8 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Conectado
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Configuracion;
