import { useCallback, useState } from 'react';
import { type EmpleadoRecord } from '../../../services/empleadosService';
import { INITIAL_FORM, type EmployeeFormState } from '../empleadosUtils';

export function useEmpleadoForm() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(INITIAL_FORM);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmpleadoRecord | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    fullName: string;
    username: string;
    password: string;
  } | null>(null);

  const openCreateModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setShowFormModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowFormModal(false);
    setForm(INITIAL_FORM);
  }, []);

  return {
    showFormModal,
    form,
    setForm,
    showDeleteModal,
    setShowDeleteModal,
    employeeToDelete,
    setEmployeeToDelete,
    showCredentialsModal,
    setShowCredentialsModal,
    generatedCredentials,
    setGeneratedCredentials,
    openCreateModal,
    closeCreateModal,
  };
}

export type UseEmpleadoFormReturn = ReturnType<typeof useEmpleadoForm>;
