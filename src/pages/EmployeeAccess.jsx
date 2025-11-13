import { useEffect, useState } from 'react';
import { supabase } from '../supabase/Client.jsx';

function EmployeeAccess() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invitationData, setInvitationData] = useState(null);

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
        .single();

      if (invitationError || !invitation) {
        setError('No se encontró una invitación para este correo.');
        setLoading(false);
        return;
      }

      setInvitationData(invitation);
      setLoading(false);

    } catch (err) {
      setError('Error al procesar la invitación');
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    try {
      setLoading(true);

      // Obtener el usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Crear el registro en la tabla users
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          business_id: invitationData.business_id,
          full_name: invitationData.full_name,
          email: invitationData.email,
          role: invitationData.role,
          is_active: true
        }]);

      // Si ya existe, ignorar el error (puede que ya se haya creado antes)
      if (userError && userError.code !== '23505') {
        throw userError;
      }

      // 2. Aprobar la invitación
      const { error: updateError } = await supabase
        .from('employee_invitations')
        .update({ 
          is_approved: true,
          approved_at: new Date().toISOString()
        })
        .eq('id', invitationData.id);

      if (updateError) throw updateError;

      // Redirigir al dashboard de empleado
      window.location.href = '/employee-dashboard';

    } catch (err) {
      setError('Error al aceptar la invitación');
      setLoading(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!confirm('¿Estás seguro de rechazar esta invitación?')) return;

    try {
      setLoading(true);

      // Eliminar la invitación
      const { error: deleteError } = await supabase
        .from('employee_invitations')
        .delete()
        .eq('id', invitationData.id);

      if (deleteError) throw deleteError;

      // Cerrar sesión y redirigir
      await supabase.auth.signOut();
      window.location.href = '/';

    } catch (err) {
      setError('Error al rechazar la invitación');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="access-container">
        <div className="loading">Verificando invitación...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="access-container">
        <div className="error-card">
          <h2>❌ Error</h2>
          <p>{error}</p>
          <a href="/" className="btn-primary">Volver al inicio</a>
        </div>
      </div>
    );
  }

  return (
    <div className="access-container">
      <div className="invitation-card">
        <h1>🎉 Invitación de Empleado</h1>
        
        <div className="invitation-info">
          <h2>Has sido invitado a unirte a:</h2>
          <h3>{invitationData?.businesses?.name}</h3>
          <p><strong>NIT/RUT:</strong> {invitationData?.businesses?.tax_id}</p>
          
          <div className="role-info">
            <p><strong>Rol asignado:</strong></p>
            <span className={`role-badge ${invitationData?.role}`}>
              {invitationData?.role === 'admin' ? 'Administrador' : 'Empleado'}
            </span>
          </div>

          <div className="invitation-status">
            <p><strong>Estado:</strong></p>
            <span className={`status-badge ${invitationData?.is_approved ? 'approved' : 'pending'}`}>
              {invitationData?.is_approved ? '✓ Aprobado' : '⏳ Pendiente de aceptación'}
            </span>
          </div>
        </div>

        {!invitationData?.is_approved && (
          <div className="invitation-actions">
            <button 
              className="btn-success"
              onClick={handleAcceptInvitation}
            >
              ✓ Aceptar Invitación
            </button>
            <button 
              className="btn-danger"
              onClick={handleRejectInvitation}
            >
              ✗ Rechazar
            </button>
          </div>
        )}

        {invitationData?.is_approved && (
          <div className="approved-message">
            <p>✓ Ya has aceptado esta invitación</p>
            <a href="/employee-dashboard" className="btn-primary">
              Ir al Panel de Empleado
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeAccess;
