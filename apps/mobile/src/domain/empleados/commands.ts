import {
  createEmployeeWithRpc,
  deleteEmployeeWithRpcFallback,
} from '../../services/empleadosService';

export async function createEmpleado({
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
}) {
  return createEmployeeWithRpc({
    businessId,
    fullName,
    username,
    password,
    role,
  });
}

export async function removeEmpleado({
  businessId,
  employeeId,
}: {
  businessId: string;
  employeeId: string;
}): Promise<boolean> {
  return deleteEmployeeWithRpcFallback({
    businessId,
    employeeId,
  });
}

// Alias de compatibilidad.
export async function mutateEmpleados({
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
}) {
  return createEmpleado({
    businessId,
    fullName,
    username,
    password,
    role,
  });
}
