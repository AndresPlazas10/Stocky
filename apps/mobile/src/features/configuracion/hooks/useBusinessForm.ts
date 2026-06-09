import { useCallback, useState } from 'react';
import { updateConfiguracionBusinessProfile } from '../../../domain/configuracion/commands';
import type { ConfiguracionSnapshot } from '../../../domain/configuracion/contracts';
import { createInitialBusinessForm, type BusinessFormState } from '../configuracionUtils';

interface UseBusinessFormParams {
  snapshot: ConfiguracionSnapshot | null;
  businessId: string | null;
  businessName: string | null;
  source: 'owner' | 'employee' | null;
  onRefreshBusiness: () => Promise<void>;
  loadSnapshot: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useBusinessForm({
  snapshot,
  businessId,
  businessName,
  source,
  onRefreshBusiness,
  loadSnapshot,
  setError,
}: UseBusinessFormParams) {
  const [showBusinessEditModal, setShowBusinessEditModal] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessForm, setBusinessForm] = useState<BusinessFormState>(createInitialBusinessForm());

  const buildBusinessFormFromSnapshot = useCallback((): BusinessFormState => ({
    nit: String(snapshot?.businessNit || ''),
    phone: String(snapshot?.businessPhone || ''),
    address: String(snapshot?.businessAddress || ''),
  }), [snapshot?.businessAddress, snapshot?.businessNit, snapshot?.businessPhone]);

  const openBusinessEditModal = useCallback(() => {
    setError(null);
    setBusinessForm(buildBusinessFormFromSnapshot());
    setShowBusinessEditModal(true);
  }, [buildBusinessFormFromSnapshot, setError]);

  const closeBusinessEditModal = useCallback(() => {
    if (savingBusiness) return;
    setShowBusinessEditModal(false);
  }, [savingBusiness]);

  const handleSaveBusinessProfile = useCallback(async () => {
    if (savingBusiness) return;

    if (source === 'employee') {
      setError('Solo el propietario puede editar la informacion del negocio.');
      return;
    }

    const normalizedName = String(snapshot?.businessName || businessName || '').trim();
    if (!normalizedName) {
      setError('El nombre del negocio es obligatorio.');
      return;
    }
    if (!businessId) {
      setError('No se encontro el negocio activo para actualizar.');
      return;
    }

    setSavingBusiness(true);
    setError(null);
    try {
      await updateConfiguracionBusinessProfile({
        businessId,
        payload: {
          name: normalizedName,
          nit: businessForm.nit,
          phone: businessForm.phone,
          address: businessForm.address,
        },
      });

      await onRefreshBusiness();
      await loadSnapshot();
      setShowBusinessEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la información del negocio.');
    } finally {
      setSavingBusiness(false);
    }
  }, [businessForm, businessId, businessName, loadSnapshot, onRefreshBusiness, savingBusiness, snapshot?.businessName, source, setError]);

  return {
    showBusinessEditModal,
    savingBusiness,
    businessForm,
    setBusinessForm,
    openBusinessEditModal,
    closeBusinessEditModal,
    handleSaveBusinessProfile,
  };
}
