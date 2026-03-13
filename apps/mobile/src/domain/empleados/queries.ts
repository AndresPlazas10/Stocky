import {
  getBusinessUsernameById,
  isEmployeeUsernameTaken,
  listEmployeesForManagement,
  type EmpleadoRecord,
} from '../../services/empleadosService';

export async function listEmpleadosByBusinessId(businessId: string): Promise<EmpleadoRecord[]> {
  return listEmployeesForManagement(businessId);
}

export async function isEmpleadoUsernameTaken({
  businessId,
  username,
}: {
  businessId: string;
  username: string;
}): Promise<boolean> {
  return isEmployeeUsernameTaken({
    businessId,
    username,
  });
}

export async function getBusinessUsernameForEmployees(businessId: string): Promise<string | null> {
  return getBusinessUsernameById(businessId);
}
