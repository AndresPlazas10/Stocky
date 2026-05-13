import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getOwnedBusinessByUserId } from '../data/queries/authQueries.js';
import { signInWithUsernamePassword } from '../data/commands/authCommands.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaleErrorAlert } from '@/components/ui/SaleErrorAlert';

import { User, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import logoStocky from '../assets/logoStocky.png';

const _motionLintUsage = motion;

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { username, password } = formData;
      
      if (!username || !password) {
        throw new Error('⚠️ Por favor ingresa usuario y contraseña');
      }

      // Generar el email basado en el username (igual que en el registro)
      const { user } = await signInWithUsernamePassword({
        username,
        password
      });

      // Login exitoso

      // Verificar si es propietario de un negocio
      const business = await getOwnedBusinessByUserId(user?.id, 'id');

      // Redireccionar según el rol (SPA, sin recargar)
      if (business) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/employee-dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[#fafaf9]">

      {/* Fondo animado */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-amber-100/40 blur-3xl animate-[drift_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-stone-200/30 blur-3xl animate-[drift_18s_ease-in-out_infinite_3s]" />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-amber-50/50 blur-3xl animate-[drift_20s_ease-in-out_infinite_6s]" />
        <div className="absolute top-1/2 left-1/3 h-[16rem] w-[16rem] rounded-full bg-neutral-200/20 blur-3xl animate-[drift_16s_ease-in-out_infinite_9s]" />
      </div>

      <style>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-6 left-6 z-10"
      >
        <Button
          variant="ghost"
          className="bg-white/85 backdrop-blur-sm border border-neutral-200 text-neutral-700 hover:bg-white shadow-sm"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10 max-h-[calc(100vh-120px)] overflow-auto"
      >
        <Card className="bg-white/95 border border-neutral-200/60 shadow-[0_20px_45px_-22px_rgba(0,0,0,0.15)] rounded-3xl">
          <CardHeader className="space-y-3 pb-6">
            <div className="mx-auto w-16 h-16 rounded-2xl border border-neutral-200 bg-neutral-50 flex items-center justify-center shadow-sm">
              <img src={logoStocky} alt="Stocky" className="w-12 h-12 object-contain" />
            </div>
            <CardTitle className="text-3xl font-bold text-center text-neutral-900">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-center text-base text-neutral-500">
              Ingresa tu usuario y contraseña para continuar en Stocky
            </CardDescription>
          </CardHeader>

          <CardContent>
            <SaleErrorAlert
              isVisible={!!error}
              onClose={() => setError(null)}
              title="Error de acceso"
              message={error || ''}
              duration={5000}
            />

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-base font-semibold text-neutral-700">
                  Usuario
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Tu nombre de usuario"
                    value={formData.username}
                    onChange={handleChange}
                    className="pl-10 h-12 text-base border border-neutral-200 bg-neutral-50 focus:border-neutral-400 focus-visible:ring-neutral-400/30"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-semibold text-neutral-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tu contraseña"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10 h-12 text-base border border-neutral-200 bg-neutral-50 focus:border-neutral-400 focus-visible:ring-neutral-400/30"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-all duration-300 rounded-xl"
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-neutral-500">
                ¿No tienes cuenta?{' '}
                <button
                  onClick={() => navigate('/register')}
                  className="font-semibold text-neutral-900 hover:text-neutral-700 transition-colors"
                >
                  Registrar negocio
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default Login;
