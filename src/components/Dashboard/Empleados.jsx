import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase/Client.jsx';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { 
  Trash2, 
  Users, 
  UserPlus, 
  XCircle,
  Search,
  Copy,
  CheckCircle,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';

function Empleados({ businessId }) {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [successDetails, setSuccessDetails] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Estados para modal de confirmación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'employee'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadEmpleados = useCallback(async () => {
    try {
      setLoading(true);
      
      // ✅ CORREGIDO: Cargar solo empleados (ya no existe employee_invitations)
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (empError) throw empError;

      // Todos los empleados son activos (ya no hay estado pendiente)
      const employeesWithStatus = (employees || []).map(emp => ({
        ...emp,
        is_active: emp.is_active !== false, // Asegurar que is_active sea booleano
        status: emp.is_active !== false ? 'active' : 'inactive'
      }));
      
      setEmpleados(employeesWithStatus);
    } catch (error) {
      // Error al cargar empleados
      setError('❌ Error al cargar la lista de empleados');
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
    
    if (isSubmitting) return; // Prevenir doble click
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!businessId) {
        throw new Error('❌ Error: No se pudo identificar tu negocio. Recarga la página e intenta de nuevo.');
      }

      // Validaciones
      if (!formData.full_name.trim()) throw new Error('El nombre del empleado es requerido');
      
      // Validar que el nombre no sea solo números
      if (/^\d+$/.test(formData.full_name.trim())) {
        throw new Error('❌ El nombre del empleado no puede ser solo números');
      }

      // Validar que el nombre contenga al menos una letra
      if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(formData.full_name.trim())) {
        throw new Error('❌ El nombre del empleado debe contener al menos una letra');
      }

      // Validar longitud mínima
      if (formData.full_name.trim().length < 2) {
        throw new Error('❌ El nombre del empleado debe tener al menos 2 caracteres');
      }

      if (!formData.username.trim()) throw new Error('El nombre de usuario es requerido');
      if (!formData.password.trim()) throw new Error('La contraseña es requerida');
      if (formData.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

      const cleanUsername = formData.username.toLowerCase().trim();
      const cleanPassword = formData.password.trim();

      // Validar que el usuario no sea solo números
      if (/^\d+$/.test(cleanUsername)) {
        throw new Error('❌ El nombre de usuario no puede ser solo números');
      }

      const usernameRegex = /^[a-z0-9_]+$/;
      if (!usernameRegex.test(cleanUsername)) {
        throw new Error('El usuario solo puede contener letras minúsculas, números y guiones bajos');
      }

      // Verificar username duplicado
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('business_id', businessId)
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingEmployee) {
        throw new Error('Este nombre de usuario ya está asociado a un empleado activo');
      }

      // Verificar que no sea el username del negocio
      const { data: businessData } = await supabase
        .from('businesses')
        .select('username')
        .eq('id', businessId)
        .maybeSingle();

      if (businessData && businessData.username === cleanUsername) {
        throw new Error('No puedes usar el nombre de usuario del negocio');
      }

      const cleanEmail = `${cleanUsername}@stockly-app.com`;

      // 💾 GUARDAR SESIÓN DEL ADMIN ANTES DE CREAR EL EMPLEADO
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      
      if (!adminSession) {
        throw new Error('No hay sesión activa de administrador');
      }

      // Crear cuenta Auth para el empleado
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            full_name: formData.full_name.trim(),
            role: formData.role
          }
        }
      });

      if (authError) {
        // Mensajes de error mejorados
        const errorMsg = authError.message || '';
        
        if (errorMsg.includes('already registered') || errorMsg === 'User already registered') {
          throw new Error('❌ Ya existe un empleado con este nombre de usuario');
        }
        if (errorMsg.includes('password')) {
          throw new Error('❌ La contraseña debe tener al menos 6 caracteres');
        }
        if (errorMsg.includes('email')) {
          throw new Error('❌ El formato del correo es inválido');
        }
        throw new Error(`❌ Error al crear la cuenta: ${errorMsg}`);
      }

      if (!authData.user) throw new Error('❌ Error al crear la cuenta del empleado');
      if (!authData.session) throw new Error('❌ La confirmación de email debe estar desactivada en Supabase');

      // Crear empleado usando función SECURITY DEFINER (bypasea RLS)
      // Pasamos adminSession.user.id como p_admin_user_id porque la sesión ya cambió
      const { data: employeeId, error: createEmployeeError } = await supabase
        .rpc('create_employee', {
          p_business_id: businessId,
          p_user_id: authData.user.id,
          p_role: formData.role,
          p_full_name: formData.full_name.trim(),
          p_email: cleanEmail,
          p_username: cleanUsername,
          p_access_code: null,
          p_is_active: true,
          p_admin_user_id: adminSession.user.id  // ⚡ Pasar el ID del admin explícitamente
        });

      if (createEmployeeError) {
        // Errores mejorados de la base de datos
        const errorMsg = createEmployeeError.message || '';
        
        // Error 23505: Violación de constraint único
        if (errorMsg.includes('23505') || errorMsg.includes('duplicate key')) {
          if (errorMsg.includes('username')) {
            throw new Error('❌ Ya existe un empleado con este nombre de usuario');
          }
          if (errorMsg.includes('email')) {
            throw new Error('❌ Ya existe un empleado con este correo');
          }
          throw new Error('❌ Este empleado ya existe en tu negocio');
        }
        
        // Error de permisos
        if (errorMsg.includes('permission denied') || errorMsg.includes('42501')) {
          throw new Error('❌ No tienes permisos para crear empleados. Contacta al administrador');
        }
        
        // Función no existe
        if (errorMsg.includes('function') && errorMsg.includes('does not exist')) {
          throw new Error('❌ Error de configuración. Ejecuta FUNCIONES_EMPLEADOS_SECURITY_DEFINER.sql en Supabase');
        }
        
        // Error genérico
        throw new Error(`❌ Error al crear el registro: ${errorMsg}`);
      }
      
      if (!employeeId) {
        throw new Error('No se pudo crear el empleado (función retornó null)');
      }

      // 🔄 RESTAURAR SESIÓN DEL ADMIN
      
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });

      if (restoreError) {
        // No lanzar error aquí - el empleado se creó correctamente
        // Solo advertir al usuario
        setError('⚠️ Empleado creado pero la sesión cambió. Recarga la página.');
      }

      // Código de éxito
      setGeneratedCode({
        username: cleanUsername,
        password: cleanPassword,
        fullName: formData.full_name.trim()
      });
      setShowCodeModal(true);
      setFormData({ full_name: '', username: '', password: '', role: 'employee' });
      setShowForm(false);
      setSuccess('✅ Empleado creado exitosamente');
      loadEmpleados();
      
    } catch (err) {
      
      setError(err.message || 'Error al crear el empleado');
    } finally {
      setIsSubmitting(false); // SIEMPRE desbloquear
    }
  }, [businessId, formData, loadEmpleados, isSubmitting]);

  const handleDelete = useCallback((empleado) => {
    setEmployeeToDelete(empleado);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!employeeToDelete) return;

    try {
      // ✅ CORREGIDO: Solo manejar empleados activos (ya no hay invitaciones pendientes)
      
      // Primero eliminar el usuario de Auth usando la función SQL
      if (employeeToDelete.user_id) {
        const { error: authError } = await supabase.rpc('delete_auth_user', {
          user_id_to_delete: employeeToDelete.user_id
        });

        if (authError) {
          // Error al eliminar usuario de Auth
          // Continuar aunque falle (el admin puede eliminarlo manualmente)
        }
      }

      // Eliminar el registro de employees
      const { error: empError } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeToDelete.id)
        .eq('business_id', businessId);

      if (empError) {
        // Error al eliminar empleado
        throw new Error('Error al eliminar el empleado');
      }

      setSuccess('✅ Empleado eliminado exitosamente');

      await loadEmpleados();
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    } catch (error) {
      // Error al eliminar
      setError('❌ Error al eliminar la invitación');
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    }
  }, [employeeToDelete, businessId, loadEmpleados]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setEmployeeToDelete(null);
  }, []);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      // Error al copiar
    }
  };

  // Memoizar empleados filtrados
  const filteredEmpleados = useMemo(() => {
    if (!searchTerm.trim()) return empleados;
    const search = searchTerm.toLowerCase();
    return empleados.filter(empleado =>
      empleado.full_name?.toLowerCase().includes(search) ||
      empleado.username?.toLowerCase().includes(search) ||
      empleado.role?.toLowerCase().includes(search)
    );
  }, [empleados, searchTerm]);

  // ✅ CORREGIDO: Memoizar estadísticas (ya no hay estado pending)
  const stats = useMemo(() => ({
    total: empleados.length,
    active: empleados.filter(e => e.is_active).length,
    inactive: empleados.filter(e => !e.is_active).length
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
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Empleados</h1>
                <p className="text-gray-600">Gestiona invitaciones y accesos</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
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

        {/* Estadísticas */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow p-4 border border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow p-4 border border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Activos</p>
                <p className="text-2xl font-bold text-gray-800">{stats.active}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Mensajes de error/éxito */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alertas mejoradas */}
        <SaleErrorAlert 
          isVisible={!!error}
          onClose={() => setError(null)}
          title="Error"
          message={error}
          duration={5000}
        />

        <SaleSuccessAlert 
          isVisible={!!success}
          onClose={() => setSuccess(null)}
          title="✨ Empleado Registrado"
          details={successDetails}
          duration={5000}
        />

        {/* Formulario de invitación */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-accent-500" />
                Nuevo Empleado
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usuario
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="juan_perez"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent lowercase"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Solo letras minúsculas, números y guiones bajos
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <input
                    type="text"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Esta será la contraseña que el empleado usará para acceder
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  >
                    <option value="employee">Empleado</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Creando empleado...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Crear Empleado
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buscador */}
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, usuario o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Lista de empleados */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-500 mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando empleados...</p>
            </div>
          ) : filteredEmpleados.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? 'No se encontraron empleados' : 'No hay invitaciones aún'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {!searchTerm && 'Haz clic en "Invitar Empleado" para crear la primera invitación'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Empleado
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEmpleados.map((empleado, index) => {
                    return (
                      <tr
                        key={empleado.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
                              {empleado.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{empleado.full_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{empleado.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {empleado.is_active ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 capitalize">
                            {empleado.role === 'admin' ? 'Administrador' : empleado.role === 'owner' ? 'Propietario' : 'Empleado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(empleado)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de código generado */}
      <AnimatePresence>
        {showCodeModal && generatedCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCodeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  ¡Empleado Creado!
                </h3>
                
                <p className="text-gray-600 mb-6">
                  Comparte estas credenciales con {generatedCode.fullName}
                </p>

                <div className="space-y-4 mb-6">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Usuario</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-mono font-semibold text-blue-600">
                        {generatedCode.username}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedCode.username)}
                        className="p-1 hover:bg-blue-200 rounded transition-colors"
                      >
                        <Copy className="w-4 h-4 text-blue-500" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Contraseña</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-mono font-semibold text-purple-600">
                        {generatedCode.password}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedCode.password)}
                        className="p-1 hover:bg-purple-200 rounded transition-colors"
                        title="Copiar contraseña"
                      >
                        {copiedCode ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-purple-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    El empleado puede iniciar sesión inmediatamente en <strong>/login</strong> con estas credenciales.
                  </p>
                </div>

                <button
                  onClick={() => setShowCodeModal(false)}
                  className="w-full px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Entendido
                </button>
              </div>
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  ¿Eliminar Invitación?
                </h3>
                
                <p className="text-gray-600 mb-6">
                  Esta acción no se puede deshacer. Si el empleado ya se registró, también se eliminará su acceso.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
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
