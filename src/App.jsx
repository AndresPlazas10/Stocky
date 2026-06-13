import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Suspense, lazy, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import OfflineBanner from './components/OfflineBanner.jsx';
import { isOfflinePersistenceEnabled } from './utils/offlineSnapshot.js';
import { startSalesOutboxAutoSync } from './data/commands/salesCommands.js';
import { supabaseAdapter } from './data/adapters/supabaseAdapter.js';
import {
  getWebPushSupportStatus,
  registerPwaPushSubscription,
} from './services/pwaPushNotificationsService.js';

// Lazy loading de páginas para optimizar carga inicial
const Home = lazy(() => import('./pages/Home.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const EmployeeAccess = lazy(() => import('./pages/EmployeeAccess.jsx'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard.jsx'));
const DownloadPage = lazy(() => import('./pages/Download.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));

// Componente de carga
const PageLoader = () => (
  <div className="h-screen flex items-center justify-center bg-gray-50">
    <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
  </div>
);

function App() {

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOfflinePersistenceEnabled()) return;
    try {
      const keysToDelete = [];
      for (let i = 0; i < (window.localStorage?.length || 0); i += 1) {
        const key = window.localStorage.key(i);
        if (
          typeof key === 'string'
          && (key.startsWith('stocky.local_sync.') || key.startsWith('stocky.offline_snapshot.'))
        ) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!isOfflinePersistenceEnabled()) return undefined;
    return startSalesOutboxAutoSync();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const support = getWebPushSupportStatus();
    if (!support.supported) return undefined;

    const tryRegister = async () => {
      try {
        const sessionResult = await supabaseAdapter.getCurrentSession();
        const hasSession = Boolean(sessionResult?.data?.session?.access_token);
        if (!hasSession || cancelled) return;
        await registerPwaPushSubscription({ askPermission: false });
      } catch {
        // no-op: solo registro silencioso best-effort
      }
    };

    void tryRegister();

    const {
      data: { subscription },
    } = supabaseAdapter.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      const hasSession = Boolean(nextSession?.access_token);
      if (!hasSession) return;
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED') return;
      void registerPwaPushSubscription({ askPermission: false });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <OfflineBanner />
      {/* Modal de novedades eliminado */}
      
      {/* Modal de precios y planes (se muestra solo en Dashboard) */}
      
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/login' element={<Login />} />
          <Route path='/register' element={<Register />} />
          <Route path='/descargar' element={<DownloadPage />} />
          <Route path='/terms' element={<Terms />} />
          <Route path='/privacy' element={<Privacy />} />
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
