import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Store, Building2, Hash, MapPin, Phone, Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
    address: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState('form');

  useEffect(() => {
    const checkAndSignOut = async () => {
      const savedBusinessData = localStorage.getItem('pendingBusinessData');
      if (savedBusinessData) {
        return;
      }
      
      try {
        await supabase.auth.signOut();
      } catch (error) {
        // Error silencioso
      }
    };
    checkAndSignOut();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const savedBusinessData = localStorage.getItem('pendingBusinessData');
        
        if (savedBusinessData) {
          const businessData = JSON.parse(savedBusinessData);
          setFormData(businessData);
          setStep('creating-business');
          localStorage.removeItem('pendingBusinessData');
          await createBusiness(session.user, businessData);
        } else {
          try {
            const { data: existingBusiness } = await supabase
              .from('businesses')
              .select('id')
              .eq('created_by', session.user.id)
              .maybeSingle();
            
            if (existingBusiness) {
              window.location.href = '/dashboard';
              return;
            }
            
            const { data: employeeInvitation } = await supabase
              .from('employee_invitations')
              .select('id, is_approved')
              .eq('email', session.user.email)
              .eq('is_approved', true)
              .maybeSingle();
            
            if (employeeInvitation) {
              window.location.href = '/employee-dashboard';
              return;
            }
          } catch (error) {
            // Error silencioso
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const createBusiness = async (user, businessData = formData) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert([
          {
            name: businessData.name.trim(),
            tax_id: businessData.tax_id.trim(),
            address: businessData.address.trim(),
            phone: businessData.phone.trim(),
            email: businessData.email.trim().toLowerCase(),
            created_by: user.id
          }
        ])
        .select();

      if (error) throw error;

      setSuccess(true);
      setFormData({
        name: '',
        tax_id: '',
        address: '',
        phone: '',
        email: '',
      });
      setStep('form');
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
      
    } catch (error) {
      setError(error.message || 'Error al crear el negocio');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('id, email')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingBusiness) {
        throw new Error('Ya existe un negocio registrado con este correo electrónico. Por favor inicia sesión.');
      }

      localStorage.setItem('pendingBusinessData', JSON.stringify({
        ...formData,
        email: cleanEmail
      }));
      
      // Usar variable de entorno o detectar automáticamente
      const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectUrl + '/register',
        }
      });

      if (authError) throw authError;

      setStep('waiting-auth');
      setLoading(false);
      
    } catch (error) {
      setError(error.message || 'Error al procesar el registro');
      localStorage.removeItem('pendingBusinessData');
      setStep('form');
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
        className="w-full max-w-2xl relative z-10"
      >
        <Card className="glass-card border-white/30 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 pointer-events-none"></div>
          
          <CardHeader className="space-y-4 text-center pb-8 relative">
            <div className="flex justify-center">
              <div className="gradient-primary p-6 rounded-3xl shadow-2xl">
                <Building2 className="h-14 w-14 text-white drop-shadow-md" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-primary-900 mb-2">
                Registrar Negocio
              </CardTitle>
              <CardDescription className="text-base text-primary-600">
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
                className="bg-accent-50 border-2 border-accent-200 rounded-xl p-4 flex items-start gap-3"
                role="alert"
                aria-live="polite"
              >
                <CheckCircle2 className="h-5 w-5 text-accent-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-accent-700 mb-1">¡Negocio registrado!</p>
                  <p className="text-sm text-primary-600">
                    Redirigiendo al dashboard...
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'waiting-auth' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-accent-50 border-2 border-accent-200 rounded-xl p-4 flex items-start gap-3"
                role="alert"
              >
                <Mail className="h-5 w-5 text-accent-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-accent-700 mb-1">Verifica tu correo</p>
                  <p className="text-sm text-primary-600">
                    Haz clic en el enlace de verificación. Tu negocio se creará automáticamente.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'creating-business' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-accent-50 border-2 border-accent-200 rounded-xl p-4 flex items-center gap-3"
              >
                <Loader2 className="h-5 w-5 text-accent-600 animate-spin" />
                <p className="text-sm text-primary-700">Creando tu negocio...</p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="text-base">
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
                      className="pl-10 h-12 text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id" className="text-base">
                    NIT / RUT <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="tax_id"
                      name="tax_id"
                      type="text"
                      placeholder="900123456-7"
                      value={formData.tax_id}
                      onChange={handleChange}
                      className="pl-10 h-12 text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base">
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
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="text-base">
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
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email" className="text-base">
                    Correo electrónico <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="contacto@negocio.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="pl-10 h-12 text-base"
                      required
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base gradient-primary text-white hover:opacity-90"
                disabled={loading || step !== 'form'}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : step === 'waiting-auth' ? (
                  'Esperando verificación...'
                ) : step === 'creating-business' ? (
                  'Creando negocio...'
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
              className="w-full h-12 text-base border-2 border-accent-300 text-accent-700 hover:bg-accent-50"
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

export default Register;
