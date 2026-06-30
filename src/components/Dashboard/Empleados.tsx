import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@/utils/logger';
import { SaleSuccessAlert } from '../ui/SaleSuccessAlert';
import { SaleErrorAlert } from '../ui/SaleErrorAlert';
import { AsyncStateWrapper } from '../../ui/system/async-state/index.js';
import { useRealtimeSubscription } from '../../hooks/useRealtime.js';
import {
  getBusinessUsernameById,
  getEmployeesForManagementPage,
  isEmployeeUsernameTaken
} from '../../data/queries/employeesQueries';
import {
  createEmployeeWithRpc,
  deleteEmployeeWithRpcFallback
} from '../../data/commands/employeesCommands';
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
import type { DashboardModuleProps } from '@/types/components';
import { INITIAL_EMPLOYEE_FORM } from './empleados/employeeFormConstants';

const EMPLOYEE_PAGE_SIZE = 50;

function isOwnerRole(role: string) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'owner' || normalized === 'propietario';
}

function Empleados({ businessId }: DashboardModuleProps) {
  const [employees, setEmployees] = useState<Array<{ id: string; full_name?: string; username?: string; role?: string; is_active?: boolean; status?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{ username: string; password: string; fullName: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMoreEmployees, setHasMoreEmployees] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string; full_name?: string } | null>(null);
  
  const [formData, setFormData] = useState(INITIAL_EMPLOYEE_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadEmployees = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const offset = (nextPage - 1) * EMPLOYEE_PAGE_SIZE;
      const { employees, hasMore } = await getEmployeesForManagementPage({
        businessId,
        limit: EMPLOYEE_PAGE_SIZE,
        offset
      });
      const normalized = (employees || []).filter((employee: { role?: string }) => !isOwnerRole(employee?.role));
      setEmployees((prev) => (append ? [...prev, ...normalized] : normalized));
      setPage(nextPage);
      setHasMoreEmployees(Boolean(hasMore));
    } catch {
      setError('❌ Error al cargar la lista de empleados');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId]);

  const loadMoreEmployees = useCallback(() => {
    if (loadingMore || !hasMoreEmployees || searchTerm.trim()) return;
    loadEmployees({ nextPage: page + 1, append: true });
  }, [hasMoreEmployees, loadingMore, loadEmployees, page, searchTerm]);

  useEffect(() => {
    if (businessId) {
      loadEmployees({ nextPage: 1, append: false });
    }
  }, [businessId, loadEmployees]);

  useRealtimeSubscription('employees', {
    filter: { business_id: businessId },
    enabled: !!businessId,
    debounceMs: 200,
    pollingIntervalMs: 45000,
    pollingMode: 'onError',
    onPoll: () => loadEmployees({ nextPage: 1, append: false }),
    onReconnect: () => {
      loadEmployees().catch((err) => { logger.warn('empleados:reconnect_reload failed', err); });
    },
    onInsert: (newEmployee: Record<string, unknown>) => {
      if (!newEmployee?.id) {
        loadEmployees().catch((err) => { logger.warn('empleados:insert_reload failed', err); });
        return;
      }
      if (isOwnerRole(newEmployee?.role as string)) return;
      const normalizedEmployee = {
        ...newEmployee,
        is_active: newEmployee?.is_active !== false,
        status: newEmployee?.is_active !== false ? 'active' : 'inactive'
      };
      setEmployees((prev) => {
        const exists = prev.some((employee) => employee.id === (normalizedEmployee as any).id);
        if (exists) {
          return prev.map((employee) => (
            employee.id === (normalizedEmployee as any).id ? { ...employee, ...normalizedEmployee } : employee
          ));
        }
        return [normalizedEmployee, ...prev] as typeof prev;
      });
    },
    onUpdate: (updatedEmployee: Record<string, unknown>) => {
      if (!updatedEmployee?.id) {
        loadEmployees().catch((err) => { logger.warn('empleados:update_reload failed', err); });
        return;
      }
      if (isOwnerRole(updatedEmployee?.role as string)) {
        setEmployees((prev) => prev.filter((employee) => employee.id !== updatedEmployee?.id));
        return;
      }
      const normalizedEmployee = {
        ...updatedEmployee,
        is_active: updatedEmployee?.is_active !== false,
        status: updatedEmployee?.is_active !== false ? 'active' : 'inactive'
      };
      setEmployees((prev) => prev.map((employee) => (
        employee.id === (normalizedEmployee as any).id ? { ...employee, ...normalizedEmployee } : employee
      )));
    },
    onDelete: (deletedEmployee: Record<string, unknown>) => {
      if (!deletedEmployee?.id) {
        loadEmployees().catch((err) => { logger.warn('empleados:delete_reload failed', err); });
        return;
      }
      setEmployees((prev) => prev.filter((employee) => employee.id !== deletedEmployee?.id));
    }
  } as any);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!businessId) {
        throw new Error('❌ Error: No se pudo identificar tu negocio. Recarga la página e intenta de nuevo.');
      }

      if (!formData.full_name.trim()) throw new Error('El nombre del empleado es requerido');
      
      if (/^\d+$/.test(formData.full_name.trim())) {
        throw new Error('❌ El nombre del empleado no puede ser solo números');
      }

      if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(formData.full_name.trim())) {
        throw new Error('❌ El nombre del empleado debe contener al menos una letra');
      }

      if (formData.full_name.trim().length < 2) {
        throw new Error('❌ El nombre del empleado debe tener al menos 2 caracteres');
      }

      if (!formData.username.trim()) throw new Error('El nombre de usuario es requerido');
      if (!formData.password.trim()) throw new Error('La contraseña es requerida');
      if (formData.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

      const cleanUsername = formData.username.toLowerCase().trim();
      const cleanPassword = formData.password.trim();
      const fixedRole = 'employee';

      if (/^\d+$/.test(cleanUsername)) {
        throw new Error('❌ El nombre de usuario no puede ser solo números');
      }

      const usernameRegex = /^[a-z0-9_]+$/;
      if (!usernameRegex.test(cleanUsername)) {
        throw new Error('El usuario solo puede contener letras minúsculas, números y guiones bajos');
      }

      const usernameTaken = await isEmployeeUsernameTaken({
        businessId,
        username: cleanUsername
      });
      if (usernameTaken) {
        throw new Error('❌ Ya existe un empleado con este nombre de usuario');
      }

      const businessUsername = await getBusinessUsernameById(businessId);
      if (businessUsername && businessUsername === cleanUsername) {
        throw new Error('No puedes usar el nombre de usuario del negocio');
      }

      const createdEmployee = await createEmployeeWithRpc({
        businessId,
        fullName: formData.full_name.trim(),
        username: cleanUsername,
        password: cleanPassword,
        role: fixedRole
      });

      const optimisticEmployee = {
        id: createdEmployee?.employeeId,
        business_id: businessId,
        user_id: null,
        full_name: formData.full_name.trim(),
        username: cleanUsername,
        role: fixedRole,
        is_active: true,
        status: 'active',
        created_at: new Date().toISOString()
      };
      setEmployees((prev) => {
        if (!optimisticEmployee.id) return prev;
        const exists = prev.some((employee) => employee.id === optimisticEmployee.id);
        if (exists) {
          return prev.map((employee) => (
            employee.id === optimisticEmployee.id ? { ...employee, ...optimisticEmployee } : employee
          ));
        }
        return [optimisticEmployee, ...prev] as typeof prev;
      });

      setGeneratedCode({
        username: cleanUsername,
        password: cleanPassword,
        fullName: formData.full_name.trim()
      });
      setShowCodeModal(true);
      setFormData(INITIAL_EMPLOYEE_FORM);
      setShowForm(false);
      setSuccess('✅ Empleado creado exitosamente');
      loadEmployees().catch((err) => { logger.warn('empleados:create_reload failed', err); });
      
    } catch (err) {
      setError((err as Error).message || 'Error al crear el empleado');
    } finally {
      setIsSubmitting(false);
    }
  }, [businessId, formData, loadEmployees, isSubmitting]);

  const handleDelete = useCallback((employee: { id: string; full_name?: string }) => {
    setEmployeeToDelete(employee);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!employeeToDelete) return;

    try {
      await deleteEmployeeWithRpcFallback({
        employeeId: employeeToDelete.id,
        businessId
      });

      setSuccess('✅ Empleado eliminado exitosamente');
      setEmployees((prev) => prev.filter((employee) => employee.id !== employeeToDelete.id));
      loadEmployees().catch((err) => { logger.warn('empleados:confirm_delete_reload failed', err); });
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    } catch {
      setError('❌ Error al eliminar el empleado');
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    }
  }, [employeeToDelete, businessId, loadEmployees]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setEmployeeToDelete(null);
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      logger.warn('empleados:copy_to_clipboard failed', err);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const search = searchTerm.toLowerCase();
    return employees.filter(employee =>
      employee.full_name?.toLowerCase().includes(search) ||
      employee.username?.toLowerCase().includes(search) ||
      employee.role?.toLowerCase().includes(search)
    );
  }, [employees, searchTerm]);

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.is_active).length,
    inactive: employees.filter(e => !e.is_active).length
  }), [employees]);

  const successTitle = useMemo(() => {
    if (!success) return '✨ Operación exitosa';
    const normalized = success.toLowerCase();
    if (normalized.includes('eliminad')) return '✨ Empleado eliminado';
    if (normalized.includes('cread')) return '✨ Empleado registrado';
    return '✨ Operación exitosa';
  }, [success]);

  useEffect(() => {
    let errorTimer: ReturnType<typeof setTimeout>, successTimer: ReturnType<typeof setTimeout>;
    if (error) errorTimer = setTimeout(() => setError(null), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(null), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-bg-primary/20 via-white to-[#C4DFE6]/10 p-4 md:p-6">
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
                <p className="text-gray-600">Gestiona empleados y accesos</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              <UserPlus className="w-5 h-5" />
              Invitar Empleado
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
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="w-5 h-5 text-gray-600" />
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
          title={successTitle}
          details={[]}
          duration={5000}
        />

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
          <AsyncStateWrapper
            loading={loading}
            error={filteredEmployees.length === 0 ? error : null}
            dataCount={filteredEmployees.length}
            onRetry={loadEmployees}
            skeletonType="empleados"
            hasFilters={Boolean(searchTerm.trim())}
            noResultsTitle="No se encontraron empleados"
            emptyTitle="Aun no hay empleados"
            emptyDescription='Haz clic en "Invitar Empleado" para crear el primero.'
            actionProcessing={isSubmitting}
          >
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
                   {filteredEmployees.map((employee) => {
                    return (
                      <tr
                        key={employee.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
                              {employee.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{employee.full_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{employee.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {employee.is_active ? (
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
                            {employee.role === 'admin' ? 'Administrador' : employee.role === 'owner' ? 'Propietario' : 'Empleado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(employee)}
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
            <div className="border-t border-gray-100 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Mostrando {filteredEmployees.length} de {employees.length} empleados
              </p>
              <button
                type="button"
                onClick={loadMoreEmployees}
                disabled={!hasMoreEmployees || loadingMore || Boolean(searchTerm.trim())}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>Cargar más empleados</>
                )}
              </button>
            </div>
          </AsyncStateWrapper>
        </div>
      </div>

      {/* Modal de nuevo empleado */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[55]"
            onClick={() => !isSubmitting && setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-accent-500" />
                  Nuevo Empleado
                </h2>
                <button
                  type="button"
                  onClick={() => !isSubmitting && setShowForm(false)}
                  className="h-9 w-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600"
                  disabled={isSubmitting}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                    className="w-full h-12 px-4 border-2 border-accent-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
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
                    className="w-full h-12 px-4 border-2 border-accent-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all lowercase"
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
                    className="w-full h-12 px-4 border-2 border-accent-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Esta será la contraseña que el empleado usará para acceder
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-accent-50 border border-accent-200">
                  <p className="text-sm text-primary-700">
                    Rol asignado: <span className="font-semibold">Empleado</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Creando employee...
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
          </motion.div>
        )}
      </AnimatePresence>

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
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Usuario</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-mono font-semibold text-gray-600">
                        {generatedCode.username}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedCode.username)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-1">Contraseña</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-mono font-semibold text-gray-600">
                        {generatedCode.password}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedCode.password)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Copiar contraseña"
                      >
                        {copiedCode ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    El empleado puede iniciar sesión inmediatamente en iniciar sesión con estas credenciales.
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
