import { useCallback, useState } from 'react';
import {
  createEmployeeWithRpc,
  deleteEmployeeWithRpcFallback,
  getBusinessUsernameById,
  isEmployeeUsernameTaken,
  type EmpleadoRecord,
} from '../../../services/empleadosService';
import { type UseEmpleadoFormReturn } from './useEmpleadoForm';

type UseEmpleadoMutationsParams = {
  form: UseEmpleadoFormReturn;
  businessId: string;
  userId: string;
  canManageEmployees: boolean;
  onRefresh: () => Promise<void>;
  onEmployeeCreated?: (name: string) => void;
  onEmployeeDeleted?: () => void;
};

export function useEmpleadoMutations(params: UseEmpleadoMutationsParams) {
  const {
    form,
    businessId,
    userId,
    canManageEmployees,
    onRefresh,
    onEmployeeCreated,
    onEmployeeDeleted,
  } = params;
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCreateEmployee = useCallback(async () => {
    if (creating || !canManageEmployees) return;

    setCreating(true);
    setError(null);
    try {
      if (!businessId) {
        throw new Error('No se detecto un negocio activo.');
      }

      const cleanFullName = String(form.form.full_name || '').trim();
      const cleanUsername = String(form.form.username || '')
        .trim()
        .toLowerCase();
      const cleanPassword = String(form.form.password || '').trim();

      if (!cleanFullName) throw new Error('El nombre del empleado es requerido.');
      if (/^\d+$/.test(cleanFullName)) throw new Error('El nombre no puede ser solo numeros.');
      if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(cleanFullName))
        throw new Error('El nombre debe contener al menos una letra.');
      if (cleanFullName.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres.');

      if (!cleanUsername) throw new Error('El username es requerido.');
      if (/^\d+$/.test(cleanUsername)) throw new Error('El username no puede ser solo numeros.');
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        throw new Error('El username solo puede contener letras minusculas, numeros y guion bajo.');
      }

      if (!cleanPassword) throw new Error('La contraseña es requerida.');
      if (cleanPassword.length < 6)
        throw new Error('La contraseña debe tener al menos 6 caracteres.');

      const usernameTaken = await isEmployeeUsernameTaken({
        businessId,
        username: cleanUsername,
      });
      if (usernameTaken) {
        throw new Error('Ya existe un empleado con ese username.');
      }

      const businessUsername = await getBusinessUsernameById(businessId);
      if (businessUsername && businessUsername.toLowerCase() === cleanUsername) {
        throw new Error('No puedes usar el username del negocio.');
      }

      const created = await createEmployeeWithRpc({
        businessId,
        fullName: cleanFullName,
        username: cleanUsername,
        password: cleanPassword,
        role: 'employee',
      });

      onEmployeeCreated?.(cleanFullName);
      form.setGeneratedCredentials({
        fullName: created.fullName,
        username: created.username,
        password: created.password,
      });
      form.setShowCredentialsModal(true);
      form.closeCreateModal();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el empleado.');
    } finally {
      setCreating(false);
    }
  }, [businessId, canManageEmployees, creating, form, onRefresh, onEmployeeCreated]);

  const askDeleteEmployee = useCallback(
    (employee: EmpleadoRecord) => {
      if (!canManageEmployees) return;
      form.setEmployeeToDelete(employee);
      form.setShowDeleteModal(true);
    },
    [canManageEmployees, form],
  );

  const confirmDeleteEmployee = useCallback(async () => {
    if (!form.employeeToDelete?.id || deleting || !canManageEmployees) return;

    setDeleting(true);
    setError(null);
    try {
      if (form.employeeToDelete.user_id && form.employeeToDelete.user_id === userId) {
        throw new Error('No puedes eliminar tu propio usuario desde este modulo.');
      }

      await deleteEmployeeWithRpcFallback({
        employeeId: form.employeeToDelete.id,
        businessId,
      });
      onEmployeeDeleted?.();
      form.setShowDeleteModal(false);
      form.setEmployeeToDelete(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el empleado.');
    } finally {
      setDeleting(false);
    }
  }, [businessId, canManageEmployees, deleting, form, onRefresh, userId, onEmployeeDeleted]);

  return {
    creating,
    deleting,
    error,
    setError,
    submitCreateEmployee,
    askDeleteEmployee,
    confirmDeleteEmployee,
  };
}

export type UseEmpleadoMutationsReturn = ReturnType<typeof useEmpleadoMutations>;
