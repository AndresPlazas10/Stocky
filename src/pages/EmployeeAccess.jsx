import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Key, User, Lock } from 'lucide-react';

const EmployeeAccess = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    invitationCode: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { invitationCode, username, password, confirmPassword } = formData;

      // Validaciones básicas
      if (!invitationCode || !username || !password || !confirmPassword) {
        setError('Todos los campos son obligatorios');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        setLoading(false);
        return;
      }

      const cleanCode = invitationCode.trim().toUpperCase();
      const cleanUsername = username.trim().toLowerCase();

      // Buscar la invitación
      const { data: invitation, error: invitationError } = await supabase
        .from('employee_invitations')
        .select('*')
        .eq('invitation_code', cleanCode)
        .eq('username', cleanUsername)
        .eq('is_approved', false)
        .maybeSingle();

      if (invitationError) {
        console.error('Error al buscar invitación:', invitationError);
        setError('Error al buscar la invitación');
        setLoading(false);
        return;
      }

      if (!invitation) {
        setError('Código de invitación o usuario inválido');
        setLoading(false);
        return;
      }

      // Verificar si ya expiró
      const expirationDate = new Date(invitation.expires_at);
      const now = new Date();

      if (now > expirationDate) {
        setError('El código de invitación ha expirado. Contacta al propietario para obtener uno nuevo.');
        setLoading(false);
        return;
      }

      // Generar email automáticamente
      const cleanEmail = `${cleanUsername.replace(/_/g, '.')}@gmail.com`;

      // Verificar si ya existe una cuenta con ese username
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingBusiness) {
        setError('Este nombre de usuario ya está registrado como propietario de negocio');
        setLoading(false);
        return;
      }

      // Verificar si ya existe un empleado con ese username
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingEmployee) {
        setError('Este nombre de usuario ya está registrado como empleado');
        setLoading(false);
        return;
      }

      // Crear cuenta de Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: invitation.full_name,
            role: 'employee'
          }
        }
      });

      if (authError) {
        console.error('Error al crear cuenta:', authError);
        if (authError.message.includes('already registered')) {
          setError('Ya existe una cuenta con este correo. Usa un nombre de usuario diferente.');
        } else {
          setError('Error al crear la cuenta: ' + authError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Error al crear la cuenta. Verifica la configuración de Supabase.');
        setLoading(false);
        return;
      }

      // Verificar que haya sesión activa (confirmar que email confirmation está desactivado)
      if (!authData.session) {
        setError('Requiere confirmación de email. Contacta al administrador del sistema.');
        setLoading(false);
        return;
      }

      // Aprobar la invitación
      const { error: approvalError } = await supabase
        .from('employee_invitations')
        .update({
          is_approved: true,
          approved_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (approvalError) {
        console.error('Error al aprobar invitación:', approvalError);
        setError('Error al aprobar la invitación');
        setLoading(false);
        return;
      }

      // Crear registro de empleado
      const { error: employeeError } = await supabase
        .from('employees')
        .insert([{
          business_id: invitation.business_id,
          user_id: authData.user.id,
          full_name: invitation.full_name,
          role: invitation.role,
          username: cleanUsername,
          email: cleanEmail,
          is_active: true
        }]);

      if (employeeError) {
        console.error('Error al crear empleado:', employeeError);
        setError('Error al crear el registro de empleado');
        setLoading(false);
        return;
      }

      // Registro exitoso - redirigir al dashboard de empleados
      console.log('Empleado registrado exitosamente');
      navigate('/employee-dashboard');

    } catch (err) {
      console.error('Error inesperado:', err);
      setError('Error inesperado. Por favor intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mb-4">
            <Key className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Registro de Empleado</CardTitle>
          <CardDescription className="text-base">
            Ingresa tu código de invitación y crea tu cuenta
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invitationCode" className="text-sm font-medium">
                Código de Invitación
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="invitationCode"
                  name="invitationCode"
                  type="text"
                  placeholder="ABC123"
                  value={formData.invitationCode}
                  onChange={handleInputChange}
                  className="pl-10 uppercase"
                  maxLength={6}
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                El código de 6 caracteres que te compartió el propietario
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Usuario
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="tu_usuario"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                Debe coincidir con el usuario de tu invitación
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-10 pr-10"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmar Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="pl-10 pr-10"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={loading}
            >
              {loading ? 'Registrando...' : 'Crear Cuenta'}
            </Button>
            
            <div className="text-center text-sm text-gray-600">
              ¿No tienes un código?{' '}
              <span className="text-indigo-600 font-medium">
                Solicítalo al propietario del negocio
              </span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default EmployeeAccess;
