import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/Client.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaleErrorAlert } from '@/components/ui/SaleErrorAlert';
import { motion } from 'framer-motion';
import { Store, User, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';

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
      const cleanUsername = username.trim().toLowerCase();
      const emailToUse = `${cleanUsername}@stockly-app.com`;

      // Intentando login

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password
      });

      if (signInError) {
        // Error de login
        throw new Error('❌ Usuario o contraseña incorrectos');
      }

      // Login exitoso

      // Verificar si es propietario de un negocio
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('created_by', data.user.id)
        .maybeSingle();

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
    <div className="h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-100">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-300/30 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-6 left-6 z-10"
      >
        <Button
          variant="ghost"
          className="bg-white/80 backdrop-blur-sm border-0 text-indigo-700 hover:bg-white shadow-md"
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
        <Card className="bg-white/90 backdrop-blur-xl border-2 border-white/50 shadow-2xl">
          <CardHeader className="space-y-3 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Store className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-center text-base text-gray-600">
              Ingresa tus credenciales para acceder
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
                <Label htmlFor="username" className="text-base font-semibold text-gray-700">
                  Usuario
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Tu nombre de usuario"
                    value={formData.username}
                    onChange={handleChange}
                    className="pl-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-semibold text-gray-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tu contraseña"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-indigo-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all duration-300"
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                ¿No tienes cuenta?{' '}
                <button
                  onClick={() => navigate('/register')}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Registrar negocio
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(20px, -50px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          75% {
            transform: translate(50px, 50px) scale(1.05);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

export default Login;
