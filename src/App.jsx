import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import PricingAnnouncementModal from './components/PricingAnnouncementModal';
import OfflineBanner from './components/OfflineBanner.jsx';
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
    if (typeof window === 'undefined') return;
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

  return (
    <>
      <OfflineBanner />
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
