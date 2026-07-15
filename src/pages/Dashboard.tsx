import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import BusinessDisabledModal from '../components/BusinessDisabledModal';
import WhatsNewModal from '../components/Modals/WhatsNewModal';
import { AsyncStateWrapper } from '../ui/system/async-state/index';
import { useAppToast } from '../hooks/useAppToast';
import { BusinessConfigProvider } from '../contexts/BusinessConfigContext';
import {
  getAuthenticatedUser,
  getBusinessById,
  getOwnedBusinessByUserId,
  getActiveEmployeeByUserId
} from '../data/queries/authQueries';
import {
  updateBusinessLogo
} from '../data/commands/businessCommands';
import { signOutGlobalSession } from '../data/commands/authCommands';
import { useWarmupStatus } from '../hooks/useWarmupStatus.js';
import PerformanceHud from '../components/perf/PerformanceHud';
import { logSecurityEvent } from '../services/securityAuditService.js';
import type { Business } from '@/types';

interface DashboardBusiness extends Business {
  logo_url?: string | null;
  owner_name?: string;
}

declare global {
  interface Window {
    __STOCKY_PERF_MODE__?: boolean;
  }
}

const LAST_BUSINESS_ID_STORAGE_KEY = 'stocky.last_business_id';
const PERF_HUD_STORAGE_KEY = 'stocky.perf_hud';

const isPerfHudInitiallyEnabled = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('perf') === '1') return true;
  return localStorage.getItem(PERF_HUD_STORAGE_KEY) === '1';
};

const Home = lazy(() => import('../components/Dashboard/Home'));
const Ventas = lazy(() => import('../components/Dashboard/Ventas.jsx'));
const Compras = lazy(() => import('../components/Dashboard/Compras.jsx'));
const Inventario = lazy(() => import('../components/Dashboard/Inventario.jsx'));
const Combos = lazy(() => import('../components/Dashboard/Combos.jsx'));
const Proveedores = lazy(() => import('../components/Dashboard/Proveedores.jsx'));
const Empleados = lazy(() => import('../components/Dashboard/Empleados.jsx'));
const Facturas = lazy(() => import('../components/Dashboard/Facturas.jsx'));
const Reports = lazy(() => import('../components/Dashboard/Reports'));
const Configuracion = lazy(() => import('../components/Dashboard/Configuracion.jsx'));
const IncidentesSync = lazy(() => import('../components/Dashboard/IncidentesSync.jsx'));

const SectionLoader = () => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-xl border border-gray-100 bg-white/80 p-4 text-sm text-gray-700">
      {t('dashboard.loadingModule')}
    </div>
  );
};

function Dashboard() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [business, setBusiness] = useState<DashboardBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [perfHudEnabled, setPerfHudEnabled] = useState(isPerfHudInitiallyEnabled);
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [isBusinessDisabled, setIsBusinessDisabled] = useState(false);
  const warmupStatus = useWarmupStatus(business?.id);
  const { showWarning, ToastComponent } = useAppToast();

  useEffect(() => {
    if (business?.logo_url !== undefined) {
      setBusinessLogo(business.logo_url || null);
    }
  }, [business?.id, business?.logo_url]);

  const checkAuthAndLoadBusiness = useCallback(async () => {
    try {
      const offlineMode = typeof navigator !== 'undefined' && navigator.onLine === false;
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
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!user) {
        if (offlineMode) {
          const lastBusinessId = localStorage.getItem(LAST_BUSINESS_ID_STORAGE_KEY);
          if (lastBusinessId) {
            try {
              const cachedBusiness = await getBusinessById(lastBusinessId) as DashboardBusiness | null;
              if (cachedBusiness?.id) {
                setUser(null);
                setBusiness(cachedBusiness);
                setBusinessLogo(cachedBusiness.logo_url || null);
                showWarning(t('dashboard.offlineMode'));
                return;
              }
            } catch (err) {
              logger.warn('dashboard:offline_fallback_business failed', err);
            }
          }
          setError(t('dashboard.noLocalSession'));
          return;
        }

        navigate('/login');
        return;
      }

      setUser(user);

      const justCreatedId = sessionStorage.getItem('justCreatedBusiness');
      const createdAt = sessionStorage.getItem('businessCreatedAt');
      const isRecent = createdAt && (Date.now() - parseInt(createdAt)) < 30000;

      let finalBusiness = null;

      if (justCreatedId && isRecent) {
        const newBusiness = await getBusinessById(justCreatedId);
        
        if (newBusiness) {
          finalBusiness = newBusiness;
          sessionStorage.removeItem('justCreatedBusiness');
          sessionStorage.removeItem('businessCreatedAt');
        }
      }

      if (!finalBusiness) {
        finalBusiness = await getOwnedBusinessByUserId(user.id);
      }

      const employee = await getActiveEmployeeByUserId(user.id, 'id, business_id, role, is_active');

      if (!finalBusiness && employee) {
        if (offlineMode) {
          setError(t('dashboard.employeeContextError'));
          return;
        }
        navigate('/employee-dashboard');
        return;
      }

      if (!finalBusiness) {
        if (justCreatedId && isRecent) {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        }
        if (offlineMode) {
          setError(t('dashboard.noCachedBusiness'));
          return;
        }
        navigate('/register');
        return;
      }

      setBusiness(finalBusiness);
      setBusinessLogo(finalBusiness.logo_url || null);
      localStorage.setItem(LAST_BUSINESS_ID_STORAGE_KEY, finalBusiness.id);

      if (finalBusiness.is_active === false) {
        try {
          await logSecurityEvent({
            businessId: finalBusiness.id,
            action: 'business_inactive_blocked',
            metadata: { source: 'web', role: 'owner' }
          });
        } catch (err) {
          logger.warn('dashboard:log_business_inactive failed', err);
        }
        setIsBusinessDisabled(true);
        setLoading(false);
        return;
      }
      
    } catch {
      setError(t('dashboard.loadBusinessError'));
    } finally {
      setLoading(false);
    }
  }, [t, showWarning, navigate]);

  useEffect(() => {
    checkAuthAndLoadBusiness();

    if (localStorage.getItem('businessLogo')) {
      localStorage.removeItem('businessLogo');
    }
  }, [checkAuthAndLoadBusiness]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (perfHudEnabled) {
      localStorage.setItem(PERF_HUD_STORAGE_KEY, '1');
      window.__STOCKY_PERF_MODE__ = true;
      return;
    }

    localStorage.removeItem(PERF_HUD_STORAGE_KEY);
    window.__STOCKY_PERF_MODE__ = false;
  }, [perfHudEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event || typeof event.key !== 'string') return;
      const isShortcut = (event.ctrlKey || event.metaKey)
        && event.shiftKey
        && event.key.toLowerCase() === 'p';
      if (!isShortcut) return;
      event.preventDefault();
      setPerfHudEnabled((prev) => !prev);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await logSecurityEvent({
        businessId: business?.id,
        action: 'sign_out',
        metadata: { source: 'web', role: 'owner' }
      });

      localStorage.clear();
      sessionStorage.clear();
      
      await signOutGlobalSession();
      
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const handleLogoChange = async (newLogoUrl: string) => {
    if (!business) return;

    try {
      await updateBusinessLogo({
        businessId: business.id,
        logoUrl: newLogoUrl
      });

      setBusinessLogo(newLogoUrl);
      setBusiness({ ...business, logo_url: newLogoUrl } as DashboardBusiness);
    } catch {
      setError(t('dashboard.updateLogoError'));
    }
  };

  const handleSectionChange = (nextSection: string) => setActiveSection(nextSection);

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <Home key="home" business={business} userRole="admin" />;
      
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
      
      case 'reportes':
        return <Reports key="reportes" businessId={business?.id} />;
      
      case 'configuracion':
        return <Configuracion key="configuracion" user={user} business={business} onBusinessUpdate={setBusiness as (b: Business) => void} />;

      case 'incidentes-sync':
        return <IncidentesSync key="incidentes-sync" businessId={business?.id} />;
      
      default:
        return <p>{t('dashboard.selectMenuOption')}</p>;
    }
  };

  if (isBusinessDisabled) {
    return (
      <BusinessConfigProvider business={business}>
        <BusinessDisabledModal businessName={business?.name} onSignOut={handleSignOut} />
      </BusinessConfigProvider>
    );
  }

  if (loading || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6">
        {/* @ts-expect-error AsyncStateWrapper is a .jsx component with untyped children prop */}
        <AsyncStateWrapper
          loading={loading}
          error={error}
          dataCount={business ? 1 : 0}
          onRetry={checkAuthAndLoadBusiness}
          skeletonType="dashboard"
          emptyTitle={t('dashboard.preparingBusiness')}
          emptyDescription={t('dashboard.loadingConfig')}
        />
      </div>
    );
  }

  return (
    <BusinessConfigProvider business={business}>
      {activeSection === 'home' ? <WhatsNewModal /> : null}
      
      <DashboardLayout
        userName={business?.owner_name || t('dashboard.user')}
        userEmail={(user as Record<string, unknown>)?.email as string || ''}
        userRole={t('roles.admin')}
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
          <Suspense fallback={<SectionLoader />}>
            {renderContent()}
          </Suspense>
        </div>
      </DashboardLayout>
      <ToastComponent />
      <PerformanceHud
        enabled={perfHudEnabled}
        activeSection={activeSection}
        onClose={() => setPerfHudEnabled(false)}
      />
    </BusinessConfigProvider>
  );
}

export default Dashboard;
