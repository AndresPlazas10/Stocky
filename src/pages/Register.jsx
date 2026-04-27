import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  getAuthenticatedUser,
  getBusinessByEmail,
  getOwnedBusinessByUserId,
  getCurrentSession,
  isBusinessUsernameTaken
} from '../data/queries/authQueries.js';
import {
  createBusinessRecord,
  createEmployeeRecord,
  normalizeUsernameToEmail,
  signInWithUsernamePassword,
  signOutSession,
  signUpBusinessOwner
} from '../data/commands/authCommands.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaleErrorAlert } from '@/components/ui/SaleErrorAlert';
import { SaleSuccessAlert } from '@/components/ui/SaleSuccessAlert';

import { Store, Building2, MapPin, Phone, User, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';

const _motionLintUsage = motion;

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    nit: '',
    address: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const { name, address, phone, username, password, confirmPassword } = formData;
      
      // Validaciones
      if (!name || !username || !password) {
        throw new Error('⚠️ Por favor completa todos los campos requeridos');
      }

      // Validar que el nombre del negocio no sea solo números
      if (/^\d+$/.test(name.trim())) {
        throw new Error('❌ El nombre del negocio no puede ser solo números');
      }

      // Validar que el nombre del negocio contenga al menos una letra
      if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(name.trim())) {
        throw new Error('❌ El nombre del negocio debe contener al menos una letra');
      }

      // Validar longitud mínima del nombre
      if (name.trim().length < 2) {
        throw new Error('❌ El nombre del negocio debe tener al menos 2 caracteres');
      }

      if (password !== confirmPassword) {
        throw new Error('❌ Las contraseñas no coinciden');
      }

      if (password.length < 6) {
        throw new Error('❌ La contraseña debe tener al menos 6 caracteres');
      }

      const cleanUsername = username.trim().toLowerCase();

      // Validar que el usuario no sea solo números
      if (/^\d+$/.test(cleanUsername)) {
        throw new Error('❌ El nombre de usuario no puede ser solo números');
      }

      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new Error('❌ El usuario debe tener entre 3-20 caracteres (solo letras, números y guiones bajos)');
      }

      const usernameTaken = await isBusinessUsernameTaken(cleanUsername);
      if (usernameTaken) {
        throw new Error('❌ Este nombre de usuario ya está en uso');
      }

      const { email: cleanEmail } = normalizeUsernameToEmail(cleanUsername);

      // Crear usuario en Auth
      let authData = null;
      try {
        const signUpResult = await signUpBusinessOwner({
          username: cleanUsername,
          password,
          businessName: name.trim(),
          emailRedirectTo: `${window.location.origin}/dashboard`
        });
        authData = signUpResult?.authData || null;
      } catch (authError) {
        // Mensajes de error mejorados
        const errorMsg = authError?.message || '';

        if (errorMsg.includes('already registered') || errorMsg === 'User already registered') {
          throw new Error('❌ Ya existe una cuenta con este nombre de usuario. Intenta con otro nombre.');
        }
        if (errorMsg.includes('password')) {
          throw new Error('❌ La contraseña debe tener al menos 6 caracteres');
        }
        if (errorMsg.includes('email')) {
          throw new Error('❌ El formato del correo es inválido');
        }
        throw new Error(`❌ Error al crear la cuenta: ${errorMsg || 'Error desconocido'}`);
      }
      
      if (!authData.user) throw new Error('❌ Error al crear la cuenta');

      if (!authData.session) {
        await signOutSession();
        throw new Error('⚠️ Supabase requiere confirmación de email. Ve a Dashboard → Authentication → Providers → Email y desactiva "Confirm email"');
      }

      // Garantizar sesión REAL activa antes de insertar en businesses (evita RLS por rol anon).
      let activeUserId = authData?.session?.user?.id || null;
      if (!activeUserId) {
        try {
          await signInWithUsernamePassword({ username: cleanUsername, password });
        } catch {
          // noop: se valida justo después
        }
      }

      const [activeSession, activeUser] = await Promise.all([
        getCurrentSession(),
        getAuthenticatedUser()
      ]);
      activeUserId = activeUser?.id || activeSession?.user?.id || activeUserId;

      if (!activeUserId || !activeSession?.access_token) {
        throw new Error('❌ No hay sesión activa para crear el negocio. Inicia sesión nuevamente e intenta otra vez.');
      }

      // Crear negocio
      let businessData = null;
      try {
        businessData = await createBusinessRecord({
          name: name.trim(),
          nit: formData.nit.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: cleanEmail,
          username: cleanUsername,
          created_by: activeUserId
        });
      } catch (businessError) {
        await signOutSession().catch(() => {});
        throw new Error(`❌ Error al crear el negocio: ${businessError?.message || 'Verifica las políticas RLS en Supabase'}`);
      }

      // Crear registro de empleado
      await createEmployeeRecord({
        user_id: activeUserId,
        business_id: businessData.id,
        role: 'owner',
        full_name: name.trim() + ' (Propietario)'
      });

      sessionStorage.setItem('justCreatedBusiness', businessData.id);
      sessionStorage.setItem('businessCreatedAt', Date.now().toString());
      setError('');
      setSuccess(true);
      
      // Redirigir al dashboard
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      
    } catch (err) {
      
      setError(err.message || '❌ Error al crear el negocio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const session = await getCurrentSession();
      if (session) {
        const [ownedBusiness, emailBusiness] = await Promise.all([
          getOwnedBusinessByUserId(session.user.id, 'id'),
          session.user.email
            ? getBusinessByEmail(session.user.email, 'id')
            : Promise.resolve(null)
        ]);
        const business = ownedBusiness || emailBusiness || null;
        
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

  return (
    <div className="min-h-screen relative overflow-x-hidden overflow-y-auto flex items-start md:items-center justify-center p-3 bg-gradient-to-br from-[#E1E8F8] via-[#E8EEF8] to-[#EDE9FB]">

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed md:absolute top-3 left-3 z-10"
      >
        <Button
          variant="ghost"
          className="h-9 bg-white/85 backdrop-blur-sm border border-[#D7E2F3] text-[#1F4E8F] hover:bg-white shadow-sm"
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
        className="w-full max-w-5xl relative z-10 mt-12 md:mt-0 pb-4 md:pb-0"
      >
        <Card className="bg-white/95 border border-[#DEE6F4] shadow-[0_20px_45px_-22px_rgba(37,99,235,0.55)] rounded-3xl overflow-hidden">
          
          <CardHeader className="space-y-2 text-center pb-4 pt-5 relative">
            <div className="flex justify-center">
              <div className="bg-gradient-to-br from-[#1F4E8F] to-[#2D6FC9] p-3 rounded-2xl shadow-sm">
                <Building2 className="h-8 w-8 text-white drop-shadow-md" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900 mb-1">
                Registrar Negocio
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Completa la información de tu negocio para comenzar
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pb-5">
            <SaleErrorAlert
              isVisible={!!error}
              onClose={() => setError('')}
              title="Error de registro"
              message={error}
              duration={5000}
            />

            <SaleSuccessAlert
              isVisible={success}
              onClose={() => setSuccess(false)}
              title="✨ Negocio registrado"
              details={[{ label: 'Estado', value: 'Redirigiendo al dashboard...' }]}
              duration={2000}
            />

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="name" className="text-sm font-semibold">
                    Nombre del Negocio <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Ej: Mi Cafetería"
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-[#D7E2F3] bg-[#F5F8FD] focus:border-[#8FB3E5] focus-visible:ring-[#8FB3E5]/30"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="username" className="text-sm font-semibold">
                    Nombre de Usuario <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="usuario_negocio"
                      value={formData.username}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-[#D7E2F3] bg-[#F5F8FD] focus:border-[#8FB3E5] focus-visible:ring-[#8FB3E5]/30"
                      required
                      pattern="[a-z0-9_]{3,20}"
                      title="Solo letras minúsculas, números y guiones bajos (3-20 caracteres)"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="nit" className="text-sm font-semibold">
                    NIT <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="nit"
                      name="nit"
                      type="text"
                      placeholder="900.123.456-7"
                      value={formData.nit}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-[#D7E2F3] bg-[#F5F8FD] focus:border-[#8FB3E5] focus-visible:ring-[#8FB3E5]/30"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm font-semibold">
                    Teléfono
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+57 300 123 4567"
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-[#D7E2F3] bg-[#F5F8FD] focus:border-[#8FB3E5] focus-visible:ring-[#8FB3E5]/30"
                    />
                  </div>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="address" className="text-sm font-semibold">
                    Dirección
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      placeholder="Calle 123 #45-67"
                      value={formData.address}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-[#D7E2F3] bg-[#F5F8FD] focus:border-[#8FB3E5] focus-visible:ring-[#8FB3E5]/30"
                    />
                  </div>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="password" className="text-sm font-semibold">
                    Contraseña <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 pr-10 h-10 border border-[#D7E2F3] bg-[#F5F8FD] focus:border-[#8FB3E5] focus-visible:ring-[#8FB3E5]/30"
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

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                    Confirmar Contraseña <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repite la contraseña"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10 pr-10 h-10 border border-[#D7E2F3] bg-[#F5F8FD] focus:border-[#8FB3E5] focus-visible:ring-[#8FB3E5]/30"
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
                className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-[#1F4E8F] to-[#2D6FC9] text-white hover:opacity-95 transition-all duration-300 rounded-xl"
                disabled={isSubmitting || success}
                size="lg"
              >
                {isSubmitting ? (
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
              className="w-full h-10 text-sm border border-[#8FB3E5] text-[#1F4E8F] hover:bg-[#EDF3FB] rounded-xl"
              onClick={() => navigate('/login')}
            >
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default Register;
