import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy loading de páginas para optimizar carga inicial
const Home = lazy(() => import('./pages/Home.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const EmployeeAccess = lazy(() => import('./pages/EmployeeAccess.jsx'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard.jsx'));

// Componente de carga
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
  </div>
);

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/employee-access' element={<EmployeeAccess />} />
        <Route path='/employee-dashboard' element={<EmployeeDashboard />} />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </Suspense>
  );
}

export default App
