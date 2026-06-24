import { readAdapter } from '../adapters/localAdapter';
import { supabaseAdapter } from '../adapters/supabaseAdapter';
import type { Employee } from '../../types';

const EMPLOYEE_LIST_COLUMNS = 'id, business_id, user_id, full_name, username, role, is_active, created_at';

interface EmployeeWithStatus extends Employee {
  username?: string;
  status: 'active' | 'inactive';
}

export async function getEmployeesForManagement(businessId: string): Promise<EmployeeWithStatus[]> {
  const { data, error } = await supabaseAdapter.getEmployeesByBusinessWithSelect(
    businessId,
    EMPLOYEE_LIST_COLUMNS
  );
  if (error) throw error;

  return ((data || []) as unknown as Record<string, unknown>[]).map((employee) => ({
    id: String(employee.id || ''),
    business_id: String(employee.business_id || ''),
    user_id: employee.user_id as string | null,
    name: String(employee.full_name || employee.name || ''),
    email: employee.email as string | null,
    phone: employee.phone as string | null,
    role: (employee.role as Employee['role']) || 'employee',
    is_active: employee.is_active !== false,
    pin: employee.pin as string | null,
    created_at: String(employee.created_at || ''),
    updated_at: String(employee.updated_at || ''),
    username: employee.username as string | undefined,
    status: employee.is_active !== false ? 'active' : 'inactive'
  })) as EmployeeWithStatus[];
}

export async function isEmployeeUsernameTaken({
  businessId,
  username
}: {
  businessId: string;
  username: string;
}): Promise<boolean> {
  const { data, error } = await readAdapter.getEmployeeByBusinessAndUsername({
    businessId,
    username,
    selectSql: 'id'
  });
  if (error) throw error;
  return Boolean((data as { id?: string })?.id);
}

export async function getBusinessUsernameById(businessId: string): Promise<string | null> {
  const { data, error } = await readAdapter.getBusinessById(businessId, 'username');
  if (error) throw error;
  return (data as { username?: string })?.username || null;
}

interface PaginatedEmployeesResult {
  employees: EmployeeWithStatus[];
  hasMore: boolean;
}

export async function getEmployeesForManagementPage({
  businessId,
  limit = 50,
  offset = 0
}: {
  businessId: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedEmployeesResult> {
  const { data, error } = await supabaseAdapter.getPaginatedTableRows({
    tableName: 'employees',
    selectSql: EMPLOYEE_LIST_COLUMNS,
    filters: { business_id: businessId },
    orderBy: { column: 'created_at', ascending: false },
    from: offset,
    to: offset + limit - 1,
    countMode: null
  });
  if (error) throw error;

  const normalized: EmployeeWithStatus[] = ((data || []) as unknown as Record<string, unknown>[]).map((employee) => ({
    id: String(employee.id || ''),
    business_id: String(employee.business_id || ''),
    user_id: employee.user_id as string | null,
    name: String(employee.full_name || employee.name || ''),
    email: employee.email as string | null,
    phone: employee.phone as string | null,
    role: (employee.role as Employee['role']) || 'employee',
    is_active: employee.is_active !== false,
    pin: employee.pin as string | null,
    created_at: String(employee.created_at || ''),
    updated_at: String(employee.updated_at || ''),
    username: employee.username as string | undefined,
    status: employee.is_active !== false ? 'active' : 'inactive'
  })) as EmployeeWithStatus[];

  return {
    employees: normalized,
    hasMore: (data || []).length === limit
  };
}
