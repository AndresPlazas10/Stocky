import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/Client.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Store, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Cerrar sesión al cargar el componente
  useEffect(() => {
    const initAuth = async () => {
      await supabase.auth.signOut();
    };
    initAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Por favor ingresa un correo electrónico válido');
      }

      const { data: hasAccess, error: checkError } = await supabase
        .rpc('check_email_has_access', { user_email: cleanEmail });

      if (checkError) {
        throw new Error('Error al verificar permisos');
      }

      if (!hasAccess) {
        throw new Error('Este correo no tiene permisos de acceso. Registra tu negocio primero o solicita una invitación de empleado.');
      }
      
      // Usar variable de entorno o detectar automáticamente
      const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: `${redirectUrl}/dashboard`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Error al enviar el enlace de inicio de sesión');
      }
      
      setSuccess(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background-50 via-background-100 to-accent-100">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-accent-300/30 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-primary-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-secondary-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-6 left-6 z-10"
      >
        <Button
          variant="ghost"
          className="glass-card border-0 text-primary-700 hover:bg-white/50"
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
        className="w-full max-w-md relative z-10"
      >
        <Card className="glass-card border-white/30 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 pointer-events-none"></div>
          
          <CardHeader className="space-y-4 text-center pb-8 relative">
            <div className="flex justify-center">
              <div className="gradient-primary p-6 rounded-3xl shadow-2xl">
                <Store className="h-14 w-14 text-white drop-shadow-md" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-primary-900 mb-2">
                Iniciar sesión
              </CardTitle>
              <CardDescription className="text-base text-primary-600">
                Ingresa tu correo para recibir un enlace mágico de acceso
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border-2 border-destructive/20 rounded-xl p-4 flex items-start gap-3"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}
            
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-accent-50 border-2 border-accent-200 rounded-xl p-4 flex items-start gap-3"
                role="alert"
                aria-live="polite"
              >
                <CheckCircle2 className="h-5 w-5 text-accent-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-accent-700 mb-1">¡Enlace enviado!</p>
                  <p className="text-sm text-primary-600">
                    Revisa tu correo y haz clic en el enlace para acceder.
                  </p>
                </div>
              </motion.div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 text-base"
                    required
                    disabled={loading || success}
                    aria-label="Correo electrónico"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base gradient-primary text-white hover:opacity-90"
                disabled={loading || success}
                size="lg"
              >
                {loading ? 'Enviando...' : success ? 'Enlace enviado ✓' : 'Enviar enlace mágico'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card text-muted-foreground">
                  ¿No tienes cuenta?
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-12 text-base border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
              onClick={() => navigate('/register')}
            >
              Crear cuenta nueva
            </Button>
          </CardContent>
        </Card>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6 text-primary-600 text-sm font-medium"
        >
          Al iniciar sesión, aceptas nuestros términos y condiciones
        </motion.p>
      </motion.div>
      
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
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
