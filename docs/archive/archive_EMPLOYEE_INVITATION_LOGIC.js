// ============================================
// NUEVA LÓGICA: INVITACIÓN DE EMPLEADOS CON USERNAME/PASSWORD
// ============================================

// FLUJO PROPUESTO:

// 1. OWNER CREA INVITACIÓN
// - Ingresa: nombre completo del empleado, username, rol
// - Sistema genera contraseña temporal: "Temporal123!"
// - Se crea invitación en employee_invitations con estado "pending"

// 2. OWNER COMPARTE CREDENCIALES
// - Muestra modal con: username y contraseña temporal
// - Owner las comparte manualmente (WhatsApp, presencial, etc.)

// 3. EMPLEADO HACE PRIMER LOGIN
// - Va a /employee-access
// - Ingresa username y contraseña temporal
// - Sistema detecta que es primer login
// - Fuerza cambio de contraseña
// - Crea cuenta en Supabase Auth
// - Marca invitación como "approved"
// - Crea registro en employees
// - Redirige a employee-dashboard

// ============================================
// IMPLEMENTACIÓN SUGERIDA
// ============================================

// A. CREAR INVITACIÓN (Owner lado)
const createEmployeeInvitation = async (employeeData) => {
  const { fullName, username, role } = employeeData;
  
  // Generar email temporal para Supabase Auth
  const tempEmail = `${username}.employee@gmail.com`;
  
  // Contraseña temporal que el empleado debe cambiar
  const temporalPassword = "Temporal123!";
  
  // Crear invitación en la base de datos
  const { data: invitation, error } = await supabase
    .from('employee_invitations')
    .insert([{
      business_id: currentBusiness.id,
      full_name: fullName,
      username: username,
      email: tempEmail, // Solo para Supabase Auth
      role: role,
      is_approved: false,
      temporal_password_hash: await hashPassword(temporalPassword), // Hash para verificar
      must_change_password: true
    }])
    .select()
    .single();
  
  if (error) throw error;
  
  // Mostrar credenciales al owner
  return {
    username,
    temporalPassword,
    message: "Comparte estas credenciales con el empleado. Deberá cambiar la contraseña en su primer login."
  };
};

// B. PRIMER LOGIN DE EMPLEADO
const employeeFirstLogin = async (username, password) => {
  // 1. Buscar invitación pendiente
  const { data: invitation, error: invError } = await supabase
    .from('employee_invitations')
    .select('*')
    .eq('username', username)
    .eq('is_approved', false)
    .maybeSingle();
  
  if (!invitation) {
    throw new Error('No se encontró invitación para este usuario');
  }
  
  // 2. Verificar contraseña temporal
  const isValidTempPassword = await verifyPassword(password, invitation.temporal_password_hash);
  
  if (!isValidTempPassword) {
    throw new Error('Contraseña temporal incorrecta');
  }
  
  // 3. Forzar cambio de contraseña
  if (invitation.must_change_password) {
    // Mostrar formulario de cambio de contraseña
    return {
      requirePasswordChange: true,
      invitation
    };
  }
};

// C. COMPLETAR REGISTRO DE EMPLEADO
const completeEmployeeRegistration = async (invitation, newPassword) => {
  const { username, email, full_name, business_id, role } = invitation;
  
  // 1. Crear cuenta en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: newPassword,
    options: {
      data: {
        username: username,
        full_name: full_name,
        is_employee: true,
        business_id: business_id
      }
    }
  });
  
  if (authError) throw authError;
  
  // 2. Marcar invitación como aprobada
  await supabase
    .from('employee_invitations')
    .update({ 
      is_approved: true,
      must_change_password: false,
      approved_at: new Date().toISOString()
    })
    .eq('id', invitation.id);
  
  // 3. Crear registro en employees
  await supabase
    .from('employees')
    .insert([{
      user_id: authData.user.id,
      business_id: business_id,
      username: username,
      full_name: full_name,
      role: role
    }]);
  
  // 4. Redirigir a employee-dashboard
  window.location.href = '/employee-dashboard';
};

// ============================================
// CAMBIOS NECESARIOS EN LA BASE DE DATOS
// ============================================

/*
-- Agregar campos a employee_invitations:

ALTER TABLE employee_invitations 
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS temporal_password_hash TEXT,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Agregar username a employees:

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS username TEXT;

*/

// ============================================
// FLUJO ALTERNATIVO MÁS SIMPLE
// ============================================

// OPCIÓN B: Sin contraseña temporal
// 1. Owner crea invitación solo con username
// 2. Sistema genera código de invitación de 6 dígitos
// 3. Empleado va a /employee-access
// 4. Ingresa código + elige su propia contraseña
// 5. Se crea la cuenta y registro

const createInvitationSimple = async (fullName, username, role) => {
  const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  await supabase
    .from('employee_invitations')
    .insert([{
      business_id: currentBusiness.id,
      full_name: fullName,
      username: username,
      role: role,
      invitation_code: invitationCode,
      is_approved: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    }]);
  
  return {
    username,
    invitationCode,
    message: `Comparte este código con el empleado: ${invitationCode}`
  };
};

const employeeRegisterWithCode = async (code, username, password) => {
  // 1. Validar código
  const { data: invitation } = await supabase
    .from('employee_invitations')
    .select('*')
    .eq('invitation_code', code)
    .eq('username', username)
    .eq('is_approved', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  if (!invitation) {
    throw new Error('Código de invitación inválido o expirado');
  }
  
  // 2. Crear cuenta
  const email = `${username}.employee@gmail.com`;
  
  const { data: authData } = await supabase.auth.signUp({
    email,
    password
  });
  
  // 3. Aprobar invitación y crear empleado
  await Promise.all([
    supabase.from('employee_invitations')
      .update({ is_approved: true })
      .eq('id', invitation.id),
    
    supabase.from('employees')
      .insert([{
        user_id: authData.user.id,
        business_id: invitation.business_id,
        username: username,
        full_name: invitation.full_name,
        role: invitation.role
      }])
  ]);
  
  window.location.href = '/employee-dashboard';
};

// ============================================
// RESUMEN DE OPCIONES
// ============================================

/*
OPCIÓN A: Contraseña temporal
✅ Más seguro
✅ Owner tiene control
❌ Empleado debe cambiar contraseña
❌ Más pasos

OPCIÓN B: Código de invitación
✅ Más simple
✅ Empleado elige su contraseña
✅ Menos pasos
❌ Código puede ser interceptado
✅ Código expira en 7 días

RECOMENDACIÓN: Opción B (código de invitación)
- Más user-friendly
- Seguro con expiración
- Menos fricción
*/
