import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout.jsx';
import PaymentWarningModal from '../components/PaymentWarningModal.jsx';
import BusinessDisabledModal from '../components/BusinessDisabledModal.jsx';
import PricingAnnouncementModal from '../components/PricingAnnouncementModal.jsx';
import PlatformUpdateModal from '../components/PlatformUpdateModal.jsx';
import { shouldShowPaymentWarning } from '../config/unpaidBusinesses.js';
import Home from '../components/Dashboard/Home.jsx';
import Ventas from '../components/Dashboard/Ventas.jsx';
import Compras from '../components/Dashboard/Compras.jsx';
import Inventario from '../components/Dashboard/Inventario.jsx';
import Combos from '../components/Dashboard/Combos.jsx';
import Proveedores from '../components/Dashboard/Proveedores.jsx';
import Empleados from '../components/Dashboard/Empleados.jsx';
import Facturas from '../components/Dashboard/Facturas.jsx';
import Clientes from '../components/Dashboard/Clientes.jsx';
import Reportes from '../components/Dashboard/Reportes.jsx';
import Configuracion from '../components/Dashboard/Configuracion.jsx';
import IncidentesSync from '../components/Dashboard/IncidentesSync.jsx';
import { AsyncStateWrapper } from '../ui/system/async-state/index.js';
import { ModernToast } from '../components/ui/modern-alert.jsx';
import { useToast } from '../hooks/useToast.js';
import {
  getAuthenticatedUser,
  getBusinessById,
  getOwnedBusinessByUserId,
  getActiveEmployeeByUserId
} from '../data/queries/authQueries.js';
import {
  updateBusinessLogo
} from '../data/commands/businessCommands.js';
import { signOutGlobalSession } from '../data/commands/authCommands.js';
import { warmupDashboardData } from '../services/dashboardWarmupService.js';
import { useWarmupStatus } from '../hooks/useWarmupStatus.js';
import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { reconcileTableOrderConsistency } from '../services/tableConsistencyService.js';

const TABLE_CONSISTENCY_RECONCILE_MS = 60000;
const TABLE_RECONCILE_TOAST_COOLDOWN_MS = 120000;
const LAST_BUSINESS_ID_STORAGE_KEY = 'stocky.last_business_id';

function Dashboard() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('home');
  const [businessLogo, setBusinessLogo] = useState(null);
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);
  const [isBusinessDisabled, setIsBusinessDisabled] = useState(false);
  const lastTableReconcileToastRef = useRef(0);
  const warmupStatus = useWarmupStatus(business?.id);
  const { message: toastMessage, showWarning, clear: clearToast } = useToast(1000);

  // Sincronizar logo cuando cambia el business
  useEffect(() => {
    if (business?.logo_url !== undefined) {
      setBusinessLogo(business.logo_url || null);
    }
  }, [business?.id, business?.logo_url]);

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

  const runTableConsistencyReconcile = useCallback(async ({ source = 'manual' } = {}) => {
    if (!business?.id) return null;
    const result = await reconcileTableOrderConsistency({
      businessId: business.id,
      source,
      dryRun: false,
      maxFixes: 25
    });
    return result;
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id || !LOCAL_SYNC_CONFIG.enabled) return undefined;

    const runBackgroundReconcile = () => {
      runTableConsistencyReconcile({ source: 'scheduler' })
        .then((result) => {
          if (!result || result.reason === 'clean' || result.reason === 'offline') return;
          if (Number(result.appliedFixes || 0) > 0) {
            const now = Date.now();
            if (now - lastTableReconcileToastRef.current >= TABLE_RECONCILE_TOAST_COOLDOWN_MS) {
              showWarning(`Auto-reconciliación aplicada: ${result.appliedFixes} ajustes en mesas.`);
              lastTableReconcileToastRef.current = now;
            }
          }
        })
        .catch(() => {});
    };

    runBackgroundReconcile();
    const timer = setInterval(runBackgroundReconcile, TABLE_CONSISTENCY_RECONCILE_MS);
    return () => clearInterval(timer);
  }, [business?.id, runTableConsistencyReconcile, showWarning]);

  const checkAuthAndLoadBusiness = useCallback(async () => {
    try {
      const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
      // Verificar autenticación con retry para dar tiempo a la sesión
      let user = null;
      let attempts = 0;
      const maxAttempts = offlineMode ? 1 : 3;
      
      while (!user && attempts < maxAttempts) {
        let currentUser = null;

        try {
          currentUser = await getAuthenticatedUser();
        } catch {
          currentUser = null;
        }

        if (currentUser?.id) {
          user = currentUser;
          break;
        }

        attempts++;
        if (attempts < maxAttempts) {
          // Esperando sesión
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!user) {
        if (offlineMode) {
          const lastBusinessId = localStorage.getItem(LAST_BUSINESS_ID_STORAGE_KEY);
          if (lastBusinessId) {
            try {
              const cachedBusiness = await getBusinessById(lastBusinessId);
              if (cachedBusiness?.id) {
                setUser(null);
                setBusiness(cachedBusiness);
                setBusinessLogo(cachedBusiness.logo_url || null);
                showWarning('Sin internet (modo offline). Trabajando con datos locales.');
                return;
              }
            } catch {
              // no-op
            }
          }
          setError('⚠️ Sin internet y no hay sesión local disponible. Conéctate una vez para habilitar modo offline.');
          return;
        }

        window.location.href = '/login';
        return;
      }

      // Usuario autenticado
      setUser(user);

      // Verificar si acabamos de crear un negocio
      const justCreatedId = sessionStorage.getItem('justCreatedBusiness');
      const createdAt = sessionStorage.getItem('businessCreatedAt');
      const isRecent = createdAt && (Date.now() - parseInt(createdAt)) < 30000; // Últimos 30 segundos

      let finalBusiness = null;

      // Si acabamos de crear un negocio, intentar cargarlo directamente
      if (justCreatedId && isRecent) {
        // Detectado negocio recién creado
        const newBusiness = await getBusinessById(justCreatedId);
        
        if (newBusiness) {
          finalBusiness = newBusiness;
          sessionStorage.removeItem('justCreatedBusiness');
          sessionStorage.removeItem('businessCreatedAt');
          // Negocio recién creado encontrado
        }
      }

      // Si no encontramos el negocio recién creado, buscar normalmente
      if (!finalBusiness) {
        // Buscando negocio para usuario

        // Verificar si el usuario tiene un negocio (SOLO por created_by)
        finalBusiness = await getOwnedBusinessByUserId(user.id);
      }

      const employee = await getActiveEmployeeByUserId(user.id, 'id, business_id, role, is_active');

      // Si es empleado, redirigir al dashboard de empleados
      if (!finalBusiness && employee) {
        if (offlineMode) {
          setError('⚠️ Sin internet no se puede validar el contexto de empleado. Intenta de nuevo con conexión.');
          return;
        }
        window.location.href = '/employee-dashboard';
        return;
      }

      // Si no es ni dueño ni empleado
      if (!finalBusiness) {
        // No se encontró negocio
        // Dar un poco de tiempo para replicación de BD si acabamos de crear
        if (justCreatedId && isRecent) {
          // Reintentando
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        }
        if (offlineMode) {
          setError('⚠️ Sin internet y no se encontró negocio local cacheado para este usuario.');
          return;
        }
        window.location.href = '/register';
        return;
      }

      // Si llegamos aquí, es dueño del negocio
      setBusiness(finalBusiness);
      setBusinessLogo(finalBusiness.logo_url || null);
      localStorage.setItem(LAST_BUSINESS_ID_STORAGE_KEY, finalBusiness.id);

      // � VERIFICAR SI EL NEGOCIO ESTÁ DESHABILITADO (PRIORIDAD MÁXIMA)
      if (finalBusiness.is_active === false) {
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

      // Tabla users (public) no existe - no crear registro
      
    } catch {
      setError('❌ Error al cargar la información del negocio');
    } finally {
      setLoading(false);
    }
  }, [showWarning]);

  useEffect(() => {
    checkAuthAndLoadBusiness();

    // Limpiar localStorage viejo (solo la primera vez)
    if (localStorage.getItem('businessLogo')) {
      localStorage.removeItem('businessLogo');
    }
  }, [checkAuthAndLoadBusiness]);

  const handleSignOut = async () => {
    try {
      // Limpiar el estado local primero
      localStorage.clear();
      sessionStorage.clear();
      
      // Cerrar sesión en Supabase con scope global
      await signOutGlobalSession();
      
      // Redirigir siempre, incluso si hay error
      window.location.href = '/login';
    } catch {
      // Error inesperado al cerrar sesión
      // Forzar redirección de todas formas
      window.location.href = '/login';
    }
  };

  const handleLogoChange = async (newLogoUrl) => {
    if (!business) return;

    try {
      // Actualizar en Supabase
      await updateBusinessLogo({
        businessId: business.id,
        logoUrl: newLogoUrl
      });

      // Actualizar estado local
      setBusinessLogo(newLogoUrl);
      setBusiness({ ...business, logo_url: newLogoUrl });
    } catch {
      setError('Error al actualizar el logo');
    }
  };

  const handleSectionChange = (nextSection) => setActiveSection(nextSection);

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <Home key="home" business={business} />;
      
      case 'ventas':
        return <Ventas key="ventas" businessId={business?.id} />;
      
      case 'compras':
        return <Compras key="compras" businessId={business?.id} />;
      
      case 'inventario':
        return <Inventario key="inventario" businessId={business?.id} userRole="admin" />;

      case 'combos':
        return <Combos key="combos" businessId={business?.id} />;
      
      case 'proveedores':
        return <Proveedores key="proveedores" businessId={business?.id} />;
      
      case 'empleados':
        return <Empleados key="empleados" businessId={business?.id} />;
      
      case 'facturas':
        return <Facturas key="facturas" userRole="admin" businessId={business?.id} />;
      
      case 'clientes':
        return <Clientes key="clientes" businessId={business?.id} />;
      
      case 'reportes':
        return <Reportes key="reportes" businessId={business?.id} />;
      
      case 'configuracion':
        return <Configuracion key="configuracion" user={user} business={business} onBusinessUpdate={setBusiness} />;

      case 'incidentes-sync':
        return <IncidentesSync key="incidentes-sync" businessId={business?.id} />;
      
      default:
        return <p>Selecciona una opción del menú</p>;
    }
  };

  // 🔒 Si el negocio está deshabilitado, mostrar modal bloqueante
  if (isBusinessDisabled) {
    return <BusinessDisabledModal businessName={business?.name} onSignOut={handleSignOut} />;
  }

  if (loading || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
        <AsyncStateWrapper
          loading={loading}
          error={error}
          dataCount={business ? 1 : 0}
          onRetry={checkAuthAndLoadBusiness}
          skeletonType="dashboard"
          emptyTitle="Preparando tu negocio"
          emptyDescription="Estamos cargando tu configuracion y permisos."
        />
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
      {/* Modal de planes y precios (se muestra según fecha: día 1-5 de cada mes) */}
      <PricingAnnouncementModal />
      {/* Modal de novedades/versionado (se muestra 1 vez por versión y usuario/negocio) */}
      <PlatformUpdateModal userId={user?.id} businessId={business?.id} />
      
      <DashboardLayout
        userName={business?.owner_name || 'Usuario'}
        userEmail={user?.email || ''}
        userRole="Administrador"
        businessName={business?.name}
        businessId={business?.id}
        businessLogo={businessLogo}
        onLogoChange={handleLogoChange}
        onSignOut={handleSignOut}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        warmupStatus={warmupStatus}
      >
        <div className="space-y-4">
          {renderContent()}
        </div>
      </DashboardLayout>
      <ModernToast
        isOpen={Boolean(toastMessage?.text)}
        type={toastMessage?.type || 'info'}
        message={toastMessage?.text || ''}
        onClose={clearToast}
      />
    </>
  );
}

export default Dashboard;
