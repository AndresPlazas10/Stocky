import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { logger } from '@/utils/logger';
import {
  getAuthenticatedUser,
  getBusinessById,
  getEmployeeByUserId
} from '../data/queries/authQueries';
import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { signOutGlobalSession } from '../data/commands/authCommands';
import BusinessDisabledModal from '../components/BusinessDisabledModal';
import WhatsNewModal from '../components/Modals/WhatsNewModal';
import Ventas from '../components/Dashboard/Ventas.jsx';
import Inventario from '../components/Dashboard/Inventario.jsx';
import Mesas from '../components/Dashboard/Mesas';
import { useWarmupStatus } from '../hooks/useWarmupStatus.js';
import { WarmupStatusBadge } from '../components/WarmupStatusBadge';
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
import { notifyAdminEmployeeLoginWeb } from '../services/webNotificationsService.js';
import { logSecurityEvent } from '../services/securityAuditService.js';
import type { Business, Employee } from '@/types';
import type { UserRole } from '@/types';


interface EmployeeInfo {
  email: string;
  fullName: string;
  role: string;
  username: string;
}

function EmployeeDashboard() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isBusinessDisabled, setIsBusinessDisabled] = useState(false);
  const warmupStatus = useWarmupStatus(business?.id);

  const checkEmployeeAuth = useCallback(async () => {
    try {
      let user = null;
      let userError = null;
      try {
        user = await getAuthenticatedUser();
      } catch (err) {
        userError = err;
      }
      
      
      if (userError || !user) {
        navigate('/login');
        return;
      }

      let employeeData = null;
      let employeeError = null;
      try {
        employeeData = await getEmployeeByUserId(user.id, '*');
      } catch (err) {
        employeeError = err;
      }

      if (employeeError) {
        setError('❌ Error al verificar permisos de empleado');
        setLoading(false);
        return;
      }

      if (!employeeData) {
        setError('❌ No tienes permisos de empleado. Tu usuario no está registrado como empleado.');
        setLoading(false);
        return;
      }

      if (!employeeData.business_id) {
        setError('❌ Tu cuenta de empleado no tiene un negocio asignado.');
        setLoading(false);
        return;
      }

      let businessData = null;
      let businessError = null;
      try {
        businessData = await getBusinessById(employeeData.business_id, '*');
      } catch (err) {
        businessError = err;
      }

      if (businessError || !businessData) {
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

      if (user.id) {
        const notifyKey = `stocky.employee-login:${user.id}:${String(user.last_sign_in_at || '')}`;
        if (typeof window !== 'undefined') {
          const storedValue = window.sessionStorage?.getItem(notifyKey) || '';
          const isSent = storedValue === 'sent';
          const pendingMatch = storedValue.match(/^pending:(\d+)$/);
          const pendingAt = pendingMatch ? Number(pendingMatch[1]) : null;
          const pendingFresh = Number.isFinite(pendingAt) && Date.now() - pendingAt < 30000;

          if (!isSent && !pendingFresh) {
            const resolveAccessToken = async () => {
              for (let attempt = 0; attempt < 3; attempt += 1) {
                const sessionResult = await supabaseAdapter.getCurrentSession();
                const token = sessionResult?.data?.session?.access_token || null;
                if (token) return token;
                await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
              }
              return null;
            };

            const accessToken = await resolveAccessToken();
            if (accessToken) {
              window.sessionStorage?.setItem(notifyKey, `pending:${Date.now()}`);
              const employeeName = (
                user?.user_metadata?.full_name
                || user?.user_metadata?.name
                || user?.user_metadata?.username
                || user?.email?.split('@')[0]
                || employeeData.full_name
                || 'Empleado'
              );
              const result = await notifyAdminEmployeeLoginWeb({
                accessToken,
                businessId: employeeData.business_id,
                employeeName,
              });
              if (result?.ok && typeof window !== 'undefined') {
                window.sessionStorage?.setItem(notifyKey, 'sent');
              } else if (typeof window !== 'undefined') {
                window.sessionStorage?.removeItem(notifyKey);
              }
            }
          }
        }
      }
      
      if (businessData.is_active === false) {
        try {
          await logSecurityEvent({
            businessId: businessData.id,
            action: 'business_inactive_blocked',
            metadata: { source: 'web', role: 'employee' }
          });
        } catch (err) {
          logger.warn('employee_dashboard:log_business_inactive failed', err);
        }
        setIsBusinessDisabled(true);
        setLoading(false);
        return;
      }
      
      setLoading(false);

    } catch {
      setError('❌ Error al cargar información del empleado');
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkEmployeeAuth();
  }, [checkEmployeeAuth]);

  const handleSignOut = async () => {
    try {
      await logSecurityEvent({
        businessId: business?.id,
        action: 'sign_out',
        metadata: { source: 'web', role: 'employee' }
      });

      localStorage.clear();
      sessionStorage.clear();
      
      await signOutGlobalSession();
      
      navigate('/');
    } catch {
      navigate('/');
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
                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <span className="text-sm text-gray-700 font-medium">Tu Rol</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800 pl-8">
                    {employee?.role === 'admin' ? 'Administrador' : 'Empleado'}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="w-5 h-5 text-gray-600" />
                    <span className="text-sm text-gray-700 font-medium">Negocio</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800 pl-8">{business?.name}</p>
                </div>
              </div>
            </motion.div>
            
            <Mesas businessId={business?.id} userRole={employee?.role || 'employee'} />
          </div>
        );
      
      case 'ventas':
        return <Ventas businessId={business?.id} />;
      
      case 'inventario':
        return <Inventario businessId={business?.id} userRole={employee?.role as UserRole} />;
      
      default:
        return <p>Selecciona una opción del menú</p>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-transparent"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (isBusinessDisabled) {
    // @ts-expect-error BusinessDisabledModal is a .jsx component with untyped props
    return <BusinessDisabledModal businessName={business?.name} onSignOut={handleSignOut} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full border border-gray-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={handleSignOut}
              className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
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
      {activeSection === 'home' ? <WhatsNewModal /> : null}
      <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 overflow-hidden">
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
        style={{ background: 'linear-gradient(to bottom, #059669, #047857)' }}
      >
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
                style={isActive ? { color: '#059669' } : {}}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

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

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
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
