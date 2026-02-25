import { createClient } from '@supabase/supabase-js';
import { supabaseAdapter } from '../adapters/supabaseAdapter';

const isolatedAuthClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

function isMissingDeleteEmployeeFunction(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('delete_employee') && message.includes('does not exist');
}

function mapAuthSignUpError(error) {
  const errorMsg = String(error?.message || '');

  if (errorMsg.includes('already registered') || errorMsg === 'User already registered') {
    return new Error('❌ Ya existe un empleado con este nombre de usuario');
  }
  if (errorMsg.includes('password')) {
    return new Error('❌ La contraseña debe tener al menos 6 caracteres');
  }
  if (errorMsg.includes('email')) {
    return new Error('❌ El formato del correo es inválido');
  }

  return new Error(`❌ Error al crear la cuenta: ${errorMsg || 'Error desconocido'}`);
}

function mapCreateEmployeeRpcError(error) {
  const errorMsg = String(error?.message || '');

  if (errorMsg.includes('23505') || errorMsg.includes('duplicate key')) {
    if (errorMsg.includes('username')) {
      return new Error('❌ Ya existe un empleado con este nombre de usuario');
    }
    if (errorMsg.includes('email')) {
      return new Error('❌ Ya existe un empleado con este correo');
    }
    return new Error('❌ Este empleado ya existe en tu negocio');
  }

  if (errorMsg.includes('permission denied') || errorMsg.includes('42501')) {
    return new Error('❌ No tienes permisos para crear empleados. Contacta al administrador');
  }

  if (errorMsg.includes('function') && errorMsg.includes('does not exist')) {
    return new Error('❌ Error de configuración. Ejecuta las migraciones de hardening de empleados en Supabase');
  }

  return new Error(`❌ Error al crear el registro: ${errorMsg || 'Error desconocido'}`);
}

export async function createEmployeeWithRpc({
  businessId,
  fullName,
  username,
  password,
  role = 'employee'
}) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '').trim();
  const cleanFullName = String(fullName || '').trim();
  const fixedRole = String(role || 'employee');
  const email = `${cleanUsername}@stockly-app.com`;

  const {
    data: { session: adminSession },
    error: sessionError
  } = await supabaseAdapter.getCurrentSession();
  if (sessionError) throw sessionError;
  if (!adminSession?.user?.id) {
    throw new Error('No hay sesión activa de administrador');
  }

  const { data: authData, error: authError } = await isolatedAuthClient.auth.signUp({
    email,
    password: cleanPassword,
    options: {
      data: {
        full_name: cleanFullName,
        role: fixedRole
      }
    }
  });

  if (authError) throw mapAuthSignUpError(authError);
  if (!authData?.user?.id) throw new Error('❌ Error al crear la cuenta del empleado');
  if (!authData?.session) throw new Error('❌ La confirmación de email debe estar desactivada en Supabase');

  const { data: employeeId, error: createEmployeeError } = await supabaseAdapter.createEmployeeRpc({
    p_business_id: businessId,
    p_user_id: authData.user.id,
    p_role: fixedRole,
    p_full_name: cleanFullName,
    p_email: email,
    p_username: cleanUsername,
    p_access_code: null,
    p_is_active: true,
    p_admin_user_id: adminSession.user.id
  });

  if (createEmployeeError) throw mapCreateEmployeeRpcError(createEmployeeError);
  if (!employeeId) throw new Error('No se pudo crear el empleado (función retornó null)');

  return {
    employeeId,
    username: cleanUsername,
    password: cleanPassword,
    fullName: cleanFullName
  };
}

export async function deleteEmployeeWithRpcFallback({
  employeeId,
  businessId
}) {
  let finalError = null;

  const { error: deleteEmployeeError } = await supabaseAdapter.deleteEmployeeRpc(employeeId);
  if (deleteEmployeeError) {
    if (isMissingDeleteEmployeeFunction(deleteEmployeeError)) {
      const { error: fallbackError } = await supabaseAdapter.deleteEmployeeByBusinessAndId({
        employeeId,
        businessId
      });
      finalError = fallbackError || null;
    } else {
      finalError = deleteEmployeeError;
    }
  }

  if (finalError) throw finalError;
  return true;
}
