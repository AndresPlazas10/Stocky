import { useCallback, useState } from 'react';
import { deleteMesaCascade, type MesaRecord, type BusinessContext } from '../../../services/mesasService';
import { mesaDisplayName } from '../utils/mesaHelpers';

type UseMesaDeleteModalParams = {
  context: BusinessContext | null;
  selectedMesa: MesaRecord | null;
  setMesas: React.Dispatch<React.SetStateAction<MesaRecord[]>>;
  closeOrderModal: () => void;
  setError: (msg: string | null) => void;
  showDeletedToast: (label: string) => void;
};

export function useMesaDeleteModal({
  context,
  selectedMesa,
  setMesas,
  closeOrderModal,
  setError,
  showDeletedToast,
}: UseMesaDeleteModalParams) {
  const [showDeleteMesaModal, setShowDeleteMesaModal] = useState(false);
  const [mesaToDelete, setMesaToDelete] = useState<MesaRecord | null>(null);
  const [isDeletingMesa, setIsDeletingMesa] = useState(false);

  const askDeleteMesa = useCallback(
    (mesa: MesaRecord) => {
      if (context?.source === 'employee') {
        setError('No tienes permisos para eliminar mesas.');
        return;
      }
      setMesaToDelete(mesa);
      setShowDeleteMesaModal(true);
    },
    [context?.source, setError],
  );

  const confirmDeleteMesa = useCallback(async () => {
    if (context?.source === 'employee') {
      setError('No tienes permisos para eliminar mesas.');
      return;
    }
    if (!context?.businessId || !mesaToDelete) return;

    setIsDeletingMesa(true);
    setError(null);

    try {
      const deletedLabel = mesaDisplayName(mesaToDelete);
      await deleteMesaCascade({
        businessId: context.businessId,
        tableId: mesaToDelete.id,
      });

      setMesas((prev) => prev.filter((mesa) => mesa.id !== mesaToDelete.id));
      if (selectedMesa?.id === mesaToDelete.id) {
        closeOrderModal();
      }

      setShowDeleteMesaModal(false);
      setMesaToDelete(null);
      showDeletedToast(deletedLabel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la mesa.');
    } finally {
      setIsDeletingMesa(false);
    }
  }, [closeOrderModal, context, mesaToDelete, selectedMesa, showDeletedToast, setError, setMesas]);

  const handleCancelDeleteMesa = useCallback(() => {
    if (!isDeletingMesa) {
      setShowDeleteMesaModal(false);
      setMesaToDelete(null);
    }
  }, [isDeletingMesa]);

  return {
    showDeleteMesaModal,
    mesaToDelete,
    isDeletingMesa,
    askDeleteMesa,
    confirmDeleteMesa,
    handleCancelDeleteMesa,
  };
}
