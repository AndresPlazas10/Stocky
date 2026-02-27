import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  getAuthenticatedUser,
  getBusinessById,
  getEmployeeByUserId
} from '../data/queries/authQueries.js';
import { signOutGlobalSession } from '../data/commands/authCommands.js';
import PaymentWarningModal from '../components/PaymentWarningModal.jsx';
import BusinessDisabledModal from '../components/BusinessDisabledModal.jsx';
import { shouldShowPaymentWarning } from '../config/unpaidBusinesses.js';
import Ventas from '../components/Dashboard/Ventas.jsx';
import Inventario from '../components/Dashboard/Inventario.jsx';
import Mesas from '../components/Dashboard/Mesas.jsx';
import { warmupDashboardData } from '../services/dashboardWarmupService.js';
import { useWarmupStatus } from '../hooks/useWarmupStatus.js';
import { WarmupStatusBadge } from '../components/WarmupStatusBadge.jsx';
import { 
  Home, 
  ShoppingCart, 
  Package, 
  LogOut, 
  Building2, 
  Shield,
  User,
  Menu,
  X
} from 'lucide-react';
// import Facturas from '../components/Dashboard/Facturas.jsx'; // DESHABILITADO

const _motionLintUsage = motion;

function EmployeeDashboard() {
  const [employee, setEmployee] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);
  const [isBusinessDisabled, setIsBusinessDisabled] = useState(false);
  const warmupStatus = useWarmupStatus(business?.id);

  useEffect(() => {
    checkEmployeeAuth();
  }, []);

  useEffect(() => {
    if (!business?.id) return;
    warmupDashboardData(business.id).catch(() => {});
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id || typeof window === 'undefined') return undefined;

    const handleOnline = () => {
      warmupDashboardData(business.id, { force: true }).catch(() => {});
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [business?.id]);

  const checkEmployeeAuth = async () => {
    try {
      // Verificar autenticación
      let user = null;
      let userError = null;
      try {
        user = await getAuthenticatedUser();
      } catch (error) {
        userError = error;
      }
      
      
      if (userError || !user) {
        window.location.href = '/login';
        return;
      }

      // Buscar el empleado directamente en la tabla employees
      let employeeData = null;
      let employeeError = null;
      try {
        employeeData = await getEmployeeByUserId(user.id, '*');
      } catch (error) {
        employeeError = error;
      }

      if (employeeError) {
        // Error al verificar empleado
        setError('❌ Error al verificar permisos de empleado');
        setLoading(false);
        return;
      }

      if (!employeeData) {
        setError('❌ No tienes permisos de empleado. Tu usuario no está registrado como empleado.');
        setLoading(false);
        return;
      }

      // Validar que el empleado tenga business_id
      if (!employeeData.business_id) {
        setError('❌ Tu cuenta de empleado no tiene un negocio asignado.');
        setLoading(false);
        return;
      }

      // Obtener el negocio
      let businessData = null;
      let businessError = null;
      try {
        businessData = await getBusinessById(employeeData.business_id, '*');
      } catch (error) {
        businessError = error;
      }

      if (businessError || !businessData) {
        // Error al cargar negocio
        setError('❌ Error al cargar información del negocio');
        setLoading(false);
        return;
      }

      setEmployee({
        email: user.email,
        fullName: employeeData.full_name,
        role: employeeData.role,
        username: employeeData.username
      });
      setBusiness(businessData);
      
      // � VERIFICAR SI EL NEGOCIO ESTÁ DESHABILITADO (PRIORIDAD MÁXIMA)
      if (businessData.is_active === false) {
        setIsBusinessDisabled(true);
        setLoading(false);
        return; // Detener ejecución y mostrar modal bloqueante
      }
      
      // 🚨 VERIFICAR SI HOY ES DÍA DE ADVERTENCIA DE PAGO (para todos los negocios)
      if (shouldShowPaymentWarning()) {
        // Mostrar el modal de advertencia después de 1 segundo
        setTimeout(() => {
          setShowPaymentWarning(true);
        }, 1000);
      }
      
      setLoading(false);

    } catch {
      // Error en checkEmployeeAuth
      setError('❌ Error al cargar información del empleado');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Limpiar el estado local primero
      localStorage.clear();
      sessionStorage.clear();
      
      // Cerrar sesión en Supabase con scope global
      await signOutGlobalSession();
      
      // Redirigir siempre, incluso si hay error
      window.location.href = '/';
    } catch {
      // Error inesperado al cerrar sesión
      // Forzar redirección de todas formas
      window.location.href = '/';
    }
  };

  const menuItems = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
    { id: 'inventario', label: 'Inventario', icon: Package }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Bienvenido, {employee?.fullName || employee?.email}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    <span className="text-sm text-purple-700 font-medium">Tu Rol</span>
                  </div>
                  <p className="text-lg font-bold text-purple-800 pl-8">
                    {employee?.role === 'admin' ? 'Administrador' : 'Empleado'}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">Negocio</span>
                  </div>
                  <p className="text-lg font-bold text-blue-800 pl-8">{business?.name}</p>
                </div>
              </div>
            </motion.div>
            
            {/* Gestión de mesas */}
            <Mesas businessId={business?.id} userRole={employee?.role || 'employee'} />
          </div>
        );
      
      case 'ventas':
        return <Ventas businessId={business?.id} />;
      
      case 'inventario':
        return <Inventario businessId={business?.id} userRole={employee?.role} />;
      
      // DESHABILITADO - Requiere dominio verificado en Resend
      // case 'facturas':
      //   return <Facturas />;
      
      default:
        return <p>Selecciona una opción del menú</p>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // 🔒 Si el negocio está deshabilitado, mostrar modal bloqueante
  if (isBusinessDisabled) {
    return <BusinessDisabledModal businessName={business?.name} onSignOut={handleSignOut} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full border border-gray-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={handleSignOut}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Modal de advertencia de pago pendiente */}
      <PaymentWarningModal 
        isOpen={showPaymentWarning}
        onClose={() => setShowPaymentWarning(false)}
        businessName={business?.name}
      />
      
      <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 text-white
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          flex flex-col shadow-2xl
        `}
        style={{ background: 'linear-gradient(to bottom, #4f46e5, #7c3aed)' }}
      >
        {/* Header del Sidebar */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{business?.name}</h2>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">
              {employee?.role === 'admin' ? 'Administrador' : 'Empleado'}
            </span>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveSection(item.id);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-white shadow-lg' 
                    : 'text-white/90 hover:bg-white/20 hover:text-white'
                  }
                `}
                style={isActive ? { color: '#4f46e5' } : {}}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        {/* Footer del Sidebar */}
        <div className="p-4 border-t border-white/10">
          <div className="mb-3 px-3 py-2 bg-white/10 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <User className="w-4 h-4" />
              <span className="truncate">{employee?.fullName || employee?.email}</span>
            </div>
          </div>
          
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all shadow-lg"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </motion.aside>

      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Superior */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-gray-800">Panel de Empleado</h1>
              <WarmupStatusBadge status={warmupStatus} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
            <User className="w-5 h-5 text-gray-600" />
            <span className="hidden md:inline text-sm font-medium text-gray-700">
              {employee?.fullName || employee?.email}
            </span>
          </div>
        </header>

        {/* Área de Contenido */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </main>
      </div>
      </div>
    </>
  );
}

export default EmployeeDashboard;
