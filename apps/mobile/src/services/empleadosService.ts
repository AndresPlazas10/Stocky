import { createClient } from '@supabase/supabase-js';
import { EXPO_CONFIG } from '../config/env';
import { getSupabaseClient } from '../lib/supabase';

const EMPLOYEE_LIST_COLUMNS = 'id,business_id,user_id,full_name,username,role,is_active,created_at';

const isolatedAuthStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const isolatedAuthClient = (EXPO_CONFIG.supabaseUrl && EXPO_CONFIG.supabaseAnonKey)
  ? createClient(EXPO_CONFIG.supabaseUrl, EXPO_CONFIG.supabaseAnonKey, {
      auth: {
        storage: isolatedAuthStorage,
        storageKey: 'supabase.auth.employee',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export type EmpleadoRecord = {
  id: string;
  business_id: string;
  user_id: string | null;
  full_name: string;
  username: string;
  role: string;
  is_active: boolean;
  status: 'active' | 'inactive';
  created_at: string | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeReference(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return normalized;
}

function normalizeRole(role: unknown): string {
  return normalizeText(role).toLowerCase() || 'employee';
}

function normalizeEmpleado(row: any): EmpleadoRecord {
  const isActive = row?.is_active !== false;
  return {
    id: normalizeText(row?.id),
    business_id: normalizeText(row?.business_id),
    user_id: normalizeReference(row?.user_id),
    full_name: normalizeText(row?.full_name) || 'Empleado',
    username: normalizeText(row?.username).toLowerCase(),
    role: normalizeRole(row?.role),
    is_active: isActive,
    status: isActive ? 'active' : 'inactive',
    created_at: normalizeReference(row?.created_at),
  };
}

function wrapDbError(errorLike: any, fallbackMessage: string): Error & { code?: string } {
  const wrapped: Error & { code?: string } = new Error(errorLike?.message || fallbackMessage);
  wrapped.code = normalizeReference(errorLike?.code) || undefined;
  return wrapped;
}

function isMissingDeleteEmployeeFunction(errorLike: any): boolean {
  const message = String(errorLike?.message || '').toLowerCase();
  return message.includes('delete_employee') && message.includes('does not exist');
}

function isMissingBusinessUsernameColumn(errorLike: any): boolean {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes('username')
    && message.includes('relation')
    && message.includes('businesses')
    && message.includes('does not exist')
  );
}

function mapAuthSignUpError(errorLike: any): Error {
  const errorMsg = String(errorLike?.message || '');
  if (errorMsg.includes('already registered') || errorMsg === 'User already registered') {
    return new Error('Ya existe un empleado con este nombre de usuario.');
  }
  if (errorMsg.toLowerCase().includes('password')) {
    return new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  if (errorMsg.toLowerCase().includes('email')) {
    return new Error('El formato de correo es invalido.');
  }
  return new Error(`Error al crear la cuenta: ${errorMsg || 'desconocido'}.`);
}

function mapCreateEmployeeRpcError(errorLike: any): Error {
  const errorMsg = String(errorLike?.message || '');
  const lower = errorMsg.toLowerCase();

  if (lower.includes('23505') || lower.includes('duplicate key')) {
    if (lower.includes('username')) {
      return new Error('Ya existe un empleado con este nombre de usuario.');
    }
    if (lower.includes('email')) {
      return new Error('Ya existe un empleado con este correo.');
    }
    return new Error('Este empleado ya existe en tu negocio.');
  }

  if (lower.includes('permission denied') || lower.includes('42501') || lower.includes('no autorizado')) {
    return new Error('No tienes permisos para crear empleados.');
  }

  if (lower.includes('function') && lower.includes('does not exist')) {
    return new Error('Falta configurar funciones SQL de empleados en Supabase.');
  }

  return new Error(`Error al crear empleado: ${errorMsg || 'desconocido'}.`);
}

export function isOwnerRole(role: unknown): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'owner' || normalized === 'propietario';
}

export async function listEmployeesForManagement(businessId: string): Promise<EmpleadoRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('employees')
    .select(EMPLOYEE_LIST_COLUMNS)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    throw wrapDbError(error, 'No se pudieron cargar los empleados.');
  }

  return (Array.isArray(data) ? data : []).map(normalizeEmpleado);
}

export async function isEmployeeUsernameTaken({
  businessId,
  username,
}: {
  businessId: string;
  username: string;
}): Promise<boolean> {
  const client = getSupabaseClient();
  const normalizedUsername = normalizeText(username).toLowerCase();
  if (!normalizedUsername) return false;

  const { data, error } = await client
    .from('employees')
    .select('id')
    .eq('business_id', businessId)
    .eq('username', normalizedUsername)
    .maybeSingle();

  if (error) {
    throw wrapDbError(error, 'No se pudo validar el nombre de usuario.');
  }
  return Boolean(data?.id);
}

export async function getBusinessUsernameById(businessId: string): Promise<string | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('businesses')
    .select('username')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    if (isMissingBusinessUsernameColumn(error)) return null;
    throw wrapDbError(error, 'No se pudo validar el username del negocio.');
  }

  return normalizeReference(data?.username);
}

export async function createEmployeeWithRpc({
  businessId,
  fullName,
  username,
  password,
  role = 'employee',
}: {
  businessId: string;
  fullName: string;
  username: string;
  password: string;
  role?: string;
}): Promise<{ employeeId: string | null; username: string; password: string; fullName: string }> {
  if (!isolatedAuthClient) {
    throw new Error('Supabase no esta configurado para crear empleados.');
  }

  const cleanUsername = normalizeText(username).toLowerCase();
  const cleanPassword = normalizeText(password);
  const cleanFullName = normalizeText(fullName);
  const fixedRole = normalizeRole(role || 'employee');
  const employeeEmail = `${cleanUsername}@stockly-app.com`;

  const mainClient = getSupabaseClient();
  const {
    data: { session: adminSession },
    error: sessionError,
  } = await mainClient.auth.getSession();

  if (sessionError) throw sessionError;
  if (!adminSession?.user?.id) {
    throw new Error('No hay sesión activa para crear empleados.');
  }

  const { data: authData, error: authError } = await isolatedAuthClient.auth.signUp({
    email: employeeEmail,
    password: cleanPassword,
    options: {
      data: {
        full_name: cleanFullName,
        role: fixedRole,
      },
    },
  });

  if (authError) throw mapAuthSignUpError(authError);
  if (!authData?.user?.id) throw new Error('No se pudo crear la cuenta del empleado.');
  if (!authData?.session) {
    throw new Error('La confirmacion de email debe estar desactivada en Supabase.');
  }

  const { data: employeeId, error: createEmployeeError } = await mainClient.rpc('create_employee', {
    p_business_id: businessId,
    p_user_id: authData.user.id,
    p_role: fixedRole,
    p_full_name: cleanFullName,
    p_email: employeeEmail,
    p_username: cleanUsername,
    p_access_code: null,
    p_is_active: true,
    p_admin_user_id: adminSession.user.id,
  });

  if (createEmployeeError) throw mapCreateEmployeeRpcError(createEmployeeError);
  if (!employeeId) {
    throw new Error('No se pudo crear el empleado (la funcion retorno null).');
  }

  return {
    employeeId: normalizeReference(employeeId),
    username: cleanUsername,
    password: cleanPassword,
    fullName: cleanFullName,
  };
}

export async function deleteEmployeeWithRpcFallback({
  employeeId,
  businessId,
}: {
  employeeId: string;
  businessId: string;
}): Promise<boolean> {
  const client = getSupabaseClient();
  let finalError: any = null;

  const { error: rpcError } = await client.rpc('delete_employee', {
    p_employee_id: employeeId,
  });

  if (rpcError) {
    if (isMissingDeleteEmployeeFunction(rpcError)) {
      const { error: fallbackError } = await client
        .from('employees')
        .delete()
        .eq('id', employeeId)
        .eq('business_id', businessId);
      finalError = fallbackError || null;
    } else {
      finalError = rpcError;
    }
  }

  if (finalError) {
    throw wrapDbError(finalError, 'No se pudo eliminar el empleado.');
  }

  return true;
}
