import { Routes, Route, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import LOCAL_SYNC_CONFIG from './config/localSync.js';
import PricingAnnouncementModal from './components/PricingAnnouncementModal';
import OnlineSyncBlockingAlert from './components/OnlineSyncBlockingAlert.jsx';
import { registerLocalSyncDevtools } from './sync/devtools.js';
import { bootstrapLocalSync, runOutboxTick, stopLocalSync } from './sync/syncBootstrap.js';
import { isBraveBrowser } from './utils/braveDetection';

// Lazy loading de páginas para optimizar carga inicial
const Home = lazy(() => import('./pages/Home.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const EmployeeAccess = lazy(() => import('./pages/EmployeeAccess.jsx'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard.jsx'));

// Componente de carga
const PageLoader = () => (
  <div className="h-screen flex items-center justify-center bg-gray-50">
    <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
  </div>
);

function App() {
  const [showBraveWarning, setShowBraveWarning] = useState(false);
  const location = useLocation();
  const showOnlineSyncBlockingAlert = (
    location.pathname === '/dashboard'
    || location.pathname === '/employee-dashboard'
  );

  useEffect(() => {
    // Detectar Brave y mostrar advertencia si es necesario
    async function detectBrave() {
      try {
        const isBrave = await isBraveBrowser();
        if (isBrave) {
          const hasSeenWarning = sessionStorage.getItem('braveWarningShown');
          if (!hasSeenWarning) {
            setShowBraveWarning(true);
            sessionStorage.setItem('braveWarningShown', 'true');
          }
        }
      } catch {
      }
    }
    detectBrave();
  }, []);

  useEffect(() => {
    registerLocalSyncDevtools();
  }, []);

  useEffect(() => {
    if (!LOCAL_SYNC_CONFIG.enabled) return undefined;

    let mounted = true;
    bootstrapLocalSync().catch(() => {});

    return () => {
      if (!mounted) return;
      mounted = false;
      stopLocalSync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!LOCAL_SYNC_CONFIG.enabled || typeof window === 'undefined') return undefined;

    const flushOutbox = () => {
      runOutboxTick().catch(() => {});
    };

    const handleOnline = () => {
      flushOutbox();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      flushOutbox();
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <>
      {showOnlineSyncBlockingAlert && <OnlineSyncBlockingAlert />}
      {/* Advertencia para Brave */}
      {showBraveWarning && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-orange-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-start gap-2 sm:gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs sm:text-sm">Usando Brave Browser</p>
              <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1">
                Si la app no carga, desactiva Brave Shields (icono del león) para este sitio.
              </p>
            </div>
            <button
              onClick={() => setShowBraveWarning(false)}
              className="text-white hover:bg-orange-600 rounded p-1 transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Modal de novedades eliminado */}
      
      {/* Modal de precios y planes (se muestra solo en Dashboard) */}
      
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/login' element={<Login />} />
          <Route path='/register' element={<Register />} />
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/employee-access' element={<EmployeeAccess />} />
          <Route path='/employee-dashboard' element={<EmployeeDashboard />} />
        </Routes>
        {import.meta.env.PROD && (
          <>
            <Analytics mode="production" debug={false} />
            <SpeedInsights />
          </>
        )}
      </Suspense>
    </>
  );
}

    export default App;
