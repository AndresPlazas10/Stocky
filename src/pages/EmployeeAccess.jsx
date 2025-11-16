import { useEffect, useState } from 'react';
import { supabase } from '../supabase/Client.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function EmployeeAccess() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    handleEmployeeAccess();
  }, []);

  const handleEmployeeAccess = async () => {
    try {
      // Verificar si el usuario está autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setError('No se pudo verificar tu autenticación. Por favor usa el enlace del correo.');
        setLoading(false);
        return;
      }

      // Buscar la invitación del empleado
      const { data: invitation, error: invitationError } = await supabase
        .from('employee_invitations')
        .select('*, businesses(name, tax_id)')
        .eq('email', user.email)
        .maybeSingle();

      if (invitationError || !invitation) {
        setError('No se encontró una invitación para este correo.');
        setLoading(false);
        return;
      }

      // Auto-crear usuario en la tabla users si no existe
      const { error: userError2 } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          business_id: invitation.business_id,
          full_name: invitation.full_name,
          email: invitation.email,
          role: invitation.role,
          is_active: true
        }]);

      // Ignorar error si ya existe
      if (userError2 && userError2.code !== '23505') {
        throw userError2;
      }

      // Redirigir directamente al dashboard de empleado
      window.location.href = '/employee-dashboard';

    } catch (err) {
      setError('Error al procesar la invitación: ' + err.message);
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background-50 via-background-100 to-accent-100">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-accent-300/30 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-primary-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-secondary-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10"
        >
          <Card className="w-full max-w-md glass-card border-primary-200">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
              <p className="text-lg text-primary-700 font-medium">Configurando tu acceso...</p>
              <p className="text-sm text-primary-600 mt-2">Serás redirigido en un momento</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background-50 via-background-100 to-accent-100">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-accent-300/30 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-primary-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-secondary-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <Card className="glass-card border-red-200">
            <CardContent className="text-center pt-8 pb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-red-700 mb-2">Error</h2>
              <p className="text-red-600 mb-6">{error}</p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Como se redirige automáticamente, este código nunca se alcanzará
  // pero lo dejamos por si hay algún error inesperado
  return null;
}

export default EmployeeAccess;
