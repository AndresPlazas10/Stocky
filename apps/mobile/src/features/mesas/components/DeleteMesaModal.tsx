import { StockyDeleteConfirmModal } from '../../../ui/StockyDeleteConfirmModal';
import { mesaDisplayName } from '../utils/mesaHelpers';
import type { MesaRecord } from '../../../services/mesasService';

interface DeleteMesaModalProps {
  visible: boolean;
  mesaToDelete: MesaRecord | null;
  isDeletingMesa: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteMesaModal({
  visible,
  mesaToDelete,
  isDeletingMesa,
  onCancel,
  onConfirm,
}: DeleteMesaModalProps) {
  return (
    <StockyDeleteConfirmModal
      visible={visible}
      title="Eliminar mesa"
      message="Se eliminará la mesa y sus ordenes asociadas."
      warning="No se puede deshacer."
      itemLabel={mesaToDelete ? mesaDisplayName(mesaToDelete) : null}
      loading={isDeletingMesa}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
