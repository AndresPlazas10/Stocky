import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Store, Building2, MapPin, Phone, User, Lock, ArrowLeft, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .or(`created_by.eq.${session.user.id},email.eq.${session.user.email}`)
          .maybeSingle();
        
        if (business) {
          window.location.href = '/dashboard';
        }
      }
    };
    checkSession();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { name, address, phone, username, password, confirmPassword } = formData;
      
      if (!name || !username || !password) {
        throw new Error('Por favor completa todos los campos requeridos');
      }

      if (password !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      const cleanUsername = username.trim().toLowerCase();

      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new Error('El usuario debe tener entre 3-20 caracteres (solo letras, números y guiones bajos)');
      }

      const { data: existingUsername } = await supabase
        .from('businesses')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUsername) {
        throw new Error('Este nombre de usuario ya está en uso');
      }

      // Generar email automáticamente basado en username
      // Reemplazar guiones bajos por puntos para que Gmail lo acepte
      const cleanEmail = `${cleanUsername.replace(/_/g, '.')}@gmail.com`;

      console.log('🚀 Iniciando registro de negocio...');

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            username: cleanUsername,
            business_name: name.trim()
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Error al crear la cuenta');
      }

      console.log('✅ Usuario creado:', authData.user.id);
      console.log('🔐 Sesión:', authData.session ? 'Activa ✅' : 'Requiere confirmación de email ⚠️');

      // Si no hay sesión, significa que Supabase requiere confirmación de email
      if (!authData.session) {
        setError('Supabase requiere confirmación de email. Ve a Dashboard → Authentication → Providers → Email y desactiva "Confirm email"');
        setLoading(false);
        // Limpiar el usuario creado
        await supabase.auth.signOut();
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert([{
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: cleanEmail,
          username: cleanUsername,
          created_by: authData.user.id
        }])
        .select()
        .single();

      if (businessError) {
        console.error('❌ Error al crear negocio:', businessError);
        await supabase.auth.signOut();
        throw new Error('Error al crear el negocio. Por favor intenta de nuevo.');
      }

      console.log('✅ Negocio creado:', businessData.id);

      const { error: employeeError } = await supabase
        .from('employees')
        .insert([{
          user_id: authData.user.id,
          business_id: businessData.id,
          role: 'owner',
          full_name: name.trim() + ' (Propietario)'
        }]);

      if (employeeError) {
        console.warn('⚠️ Error al crear registro de empleado:', employeeError);
      } else {
        console.log('✅ Registro de empleado creado');
      }

      setSuccess(true);
      
      sessionStorage.setItem('justCreatedBusiness', businessData.id);
      sessionStorage.setItem('businessCreatedAt', Date.now().toString());
      
      console.log('🎉 Registro completado, redirigiendo...');
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error en registro:', error);
      setError(error.message || 'Error al procesar el registro');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
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
        className="w-full max-w-2xl relative z-10"
      >
        <Card className="bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 pointer-events-none"></div>
          
          <CardHeader className="space-y-4 text-center pb-8 relative">
            <div className="flex justify-center">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 rounded-3xl shadow-2xl">
                <Building2 className="h-14 w-14 text-white drop-shadow-md" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                Registrar Negocio
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                Completa la información de tu negocio para comenzar
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
                className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 flex items-start gap-3"
                role="alert"
                aria-live="polite"
              >
                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-indigo-700 mb-1">¡Negocio registrado!</p>
                  <p className="text-sm text-gray-600">
                    Redirigiendo al dashboard...
                  </p>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="text-base font-semibold">
                    Nombre del Negocio <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Ej: Mi Cafetería"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="username" className="text-base font-semibold">
                    Nombre de Usuario <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="usuario_negocio"
                      value={formData.username}
                      onChange={handleChange}
                      className="pl-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                      required
                      pattern="[a-z0-9_]{3,20}"
                      title="Solo letras minúsculas, números y guiones bajos (3-20 caracteres)"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Solo letras, números y guiones bajos (3-20 caracteres)
                  </p>
                </div>



                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base font-semibold">
                    Teléfono
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+57 300 123 4567"
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-base font-semibold">
                    Dirección
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      placeholder="Calle 123 #45-67"
                      value={formData.address}
                      onChange={handleChange}
                      className="pl-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base font-semibold">
                    Contraseña <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 pr-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                      required
                      minLength={6}
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-base font-semibold">
                    Confirmar Contraseña <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repite la contraseña"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10 pr-10 h-12 text-base border-2 border-gray-200 focus:border-indigo-400"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-indigo-700 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all duration-300"
                disabled={loading || success}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando negocio...
                  </>
                ) : success ? (
                  'Redirigiendo...'
                ) : (
                  'Registrar Negocio'
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card text-muted-foreground">
                  ¿Ya tienes cuenta?
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-12 text-base border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              onClick={() => navigate('/login')}
            >
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6 text-primary/70 text-sm font-medium"
        >
          Al registrarte, aceptas nuestros términos y condiciones
        </motion.p>
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

export default Register;
