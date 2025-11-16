import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { 
  Trash2, 
  AlertTriangle, 
  Users, 
  UserPlus, 
  Mail, 
  UserCheck, 
  Shield, 
  CheckCircle,
  XCircle,
  Search
} from 'lucide-react';

function Empleados({ businessId }) {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para modal de confirmación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'employee'
  });

  const loadEmpleados = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_invitations')
        .select('*')
        .eq('business_id', businessId)
        .order('invited_at', { ascending: false });

      if (error) throw error;
      
      setEmpleados(data || []);
    } catch (error) {
      setError('Error al cargar la lista de empleados');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      loadEmpleados();
    }
  }, [businessId, loadEmpleados]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      // Validaciones
      if (!formData.full_name.trim()) {
        throw new Error('El nombre del empleado es requerido');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Por favor ingresa un email válido');
      }

      const cleanEmail = formData.email.toLowerCase().trim();

      // 1. Verificar que no sea el correo del negocio
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('email')
        .eq('id', businessId)
        .maybeSingle();

      if (businessError) {
        throw new Error('Error al verificar el negocio');
      }

      if (!businessData) {
        throw new Error('No se encontró el negocio');
      }

      if (businessData.email.toLowerCase() === cleanEmail) {
        throw new Error('No puedes usar el correo del negocio como correo de empleado');
      }

      // 2. Verificar que no exista en employee_invitations
      const { data: existingInvitation, error: invitationError } = await supabase
        .from('employee_invitations')
        .select('id')
        .eq('business_id', businessId)
        .eq('email', cleanEmail)
        .maybeSingle();

      if (invitationError) throw invitationError;

      if (existingInvitation) {
        throw new Error('Este correo ya está asociado a un empleado');
      }

      // 3. Verificar que no exista en users (empleados activos)
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('business_id', businessId)
        .eq('email', cleanEmail)
        .maybeSingle();

      if (userError) throw userError;

      if (existingUser) {
        throw new Error('Este correo ya está asociado a un empleado activo');
      }

      // Insertar invitación de empleado con nombre
      const { data, error } = await supabase
        .from('employee_invitations')
        .insert([
          {
            business_id: businessId,
            full_name: formData.full_name.trim(),
            email: cleanEmail,
            role: formData.role,
            is_approved: true,
            approved_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        // Manejar error de duplicado
        if (error.code === '23505') {
          throw new Error('Este empleado ya ha sido invitado');
        }
        throw error;
      }

      // Enviar Magic Link al empleado
      const { error: inviteError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/employee-access`,
          data: {
            business_id: businessId,
            full_name: formData.full_name.trim(),
            role: formData.role,
            invitation_id: data[0].id
          }
        }
      });

      if (inviteError) {
        // Eliminar la invitación si no se pudo enviar el email
        await supabase
          .from('employee_invitations')
          .delete()
          .eq('id', data[0].id);
        
        throw new Error('Error al enviar la invitación por correo. Por favor verifica que el email esté configurado correctamente en Supabase.');
      }

      setSuccess('✅ Invitación enviada exitosamente. El empleado puede acceder inmediatamente usando el enlace del correo.');
      setFormData({ full_name: '', email: '', role: 'employee' });
      setShowForm(false);
      
      // Recargar lista de empleados
      await loadEmpleados();

    } catch (error) {
      setError(error.message || 'Error al enviar la invitación');
    }
  }, [businessId, formData, loadEmpleados]);

  const handleDelete = useCallback((invitationId) => {
    setEmployeeToDelete(invitationId);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!employeeToDelete) return;

    try {
      // Primero obtener el email del empleado para borrarlo de users
      const { data: invitation } = await supabase
        .from('employee_invitations')
        .select('email')
        .eq('id', employeeToDelete)
        .maybeSingle();

      if (invitation) {
        // Eliminar de la tabla users
        await supabase
          .from('users')
          .delete()
          .eq('email', invitation.email)
          .eq('business_id', businessId);
      }

      // Eliminar la invitación
      const { error } = await supabase
        .from('employee_invitations')
        .delete()
        .eq('id', employeeToDelete);

      if (error) throw error;

      setSuccess('✅ Empleado eliminado exitosamente');
      await loadEmpleados();
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    } catch (error) {
      setError('❌ Error al eliminar el empleado');
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    }
  }, [employeeToDelete, businessId, loadEmpleados]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setEmployeeToDelete(null);
  }, []);

  // Memoizar empleados filtrados
  const filteredEmpleados = useMemo(() => {
    if (!searchTerm.trim()) return empleados;
    const search = searchTerm.toLowerCase();
    return empleados.filter(empleado =>
      empleado.full_name?.toLowerCase().includes(search) ||
      empleado.email?.toLowerCase().includes(search) ||
      empleado.role?.toLowerCase().includes(search)
    );
  }, [empleados, searchTerm]);

  // Memoizar estadísticas
  const stats = useMemo(() => ({
    total: empleados.length,
    approved: empleados.filter(e => e.is_approved).length,
    admins: empleados.filter(e => e.role === 'admin').length
  }), [empleados]);

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
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Empleados</h1>
                <p className="text-gray-600">Gestiona el equipo de tu negocio</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003B46] to-[#07575B] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              {showForm ? (
                <>
                  <XCircle className="w-5 h-5" />
                  Cancelar
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Invitar Empleado
                </>
              )}
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
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-700">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Formulario de invitación */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-[#003B46] to-[#07575B] text-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Invitar Nuevo Empleado</h2>
                      <p className="text-white/80 mt-1">Se enviará una invitación por correo electrónico</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <UserCheck className="w-4 h-4 text-[#003B46]" />
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="Ej: Juan Pérez García"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Mail className="w-4 h-4 text-[#003B46]" />
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="empleado@ejemplo.com"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                    />
                    <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Se enviará una invitación a este correo
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <Shield className="w-4 h-4 text-[#003B46]" />
                      Rol *
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
                    >
                      <option value="employee">Empleado</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-sm text-blue-800">
                        <strong>Empleado:</strong> Permisos básicos para ventas e inventario.<br/>
                        <strong>Administrador:</strong> Acceso completo al sistema.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#003B46] to-[#07575B] hover:from-[#07575B] hover:to-[#003B46] text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    Enviar Invitación
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estadísticas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#003B46]/10 to-[#66A5AD]/10 rounded-lg">
                <Users className="w-6 h-6 text-[#003B46]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                <div className="text-sm text-gray-600">Activos</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.admins}</div>
                <div className="text-sm text-gray-600">Admins</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Barra de búsqueda */}
        {empleados.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o rol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#66A5AD] focus:border-transparent transition-all"
              />
            </div>
          </motion.div>
        )}

        {/* Tabla de empleados */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#66A5AD] border-t-transparent"></div>
                <p className="text-gray-600">Cargando empleados...</p>
              </div>
            </div>
          ) : empleados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="p-6 bg-gradient-to-br from-[#003B46]/10 to-[#66A5AD]/10 rounded-full mb-6">
                <Users className="w-16 h-16 text-[#003B46]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No hay empleados invitados</h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                Comienza invitando empleados para gestionar mejor tu equipo
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003B46] to-[#07575B] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Invitar Primer Empleado
              </button>
            </div>
          ) : filteredEmpleados.length === 0 ? (
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
                    <th className="px-6 py-4 text-left text-sm font-semibold">Empleado</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Rol</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Estado</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Fecha Invitación</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmpleados.map((empleado, index) => (
                    <motion.tr
                      key={empleado.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gradient-to-r hover:from-[#C4DFE6]/10 hover:to-transparent transition-all duration-300"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-[#003B46]/10 to-[#66A5AD]/10 rounded-lg">
                            <UserCheck className="w-5 h-5 text-[#003B46]" />
                          </div>
                          <div className="font-semibold text-gray-800">{empleado.full_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {empleado.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {empleado.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                            <Shield className="w-4 h-4" />
                            Administrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            <UserCheck className="w-4 h-4" />
                            Empleado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Activo
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {new Date(empleado.invited_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDelete(empleado.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all duration-300 hover:scale-110"
                            title="Eliminar empleado"
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
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Confirmar Eliminación</h3>
                    <p className="text-red-100 mt-1">Esta acción no se puede deshacer</p>
                  </div>
                </div>
              </div>
              
              {/* Contenido */}
              <div className="p-6">
                <p className="text-gray-700 text-lg mb-4">
                  ¿Estás seguro de eliminar este empleado? Se eliminará completamente del sistema.
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Advertencia:</p>
                      <p>Esta acción eliminará al empleado tanto de invitaciones como del sistema de usuarios.</p>
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

export default Empleados;
