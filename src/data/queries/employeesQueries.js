import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter.js';

const EMPLOYEE_LIST_COLUMNS = 'id, business_id, user_id, full_name, username, role, is_active, created_at';

export async function getEmployeesForManagement(businessId) {
  // Para gestión de empleados necesitamos consistencia inmediata tras create/delete.
  // Evitamos cache local para que la UI refleje cambios sin refrescar.
  const { data, error } = await supabaseAdapter.getEmployeesByBusinessWithSelect(
    businessId,
    EMPLOYEE_LIST_COLUMNS
  );
  if (error) throw error;

  return (data || []).map((employee) => ({
    ...employee,
    is_active: employee?.is_active !== false,
    status: employee?.is_active !== false ? 'active' : 'inactive'
  }));
}

export async function isEmployeeUsernameTaken({
  businessId,
  username
}) {
  const { data, error } = await readAdapter.getEmployeeByBusinessAndUsername({
    businessId,
    username,
    selectSql: 'id'
  });
  if (error) throw error;
  return Boolean(data?.id);
}

export async function getBusinessUsernameById(businessId) {
  const { data, error } = await readAdapter.getBusinessById(businessId, 'username');
  if (error) throw error;
  return data?.username || null;
}
