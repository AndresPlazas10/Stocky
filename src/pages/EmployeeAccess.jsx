import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * PÁGINA DESHABILITADA
 * Esta página se usaba para el registro de empleados mediante códigos de invitación.
 * El flujo de invitaciones fue removido. Los empleados ahora se crean directamente
 * desde el panel de administración en Dashboard > Empleados.
 * 
 * Esta página redirige automáticamente al login.
 */
const EmployeeAccess = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);
  
  return null; // Redirigiendo...
};

export default EmployeeAccess;
