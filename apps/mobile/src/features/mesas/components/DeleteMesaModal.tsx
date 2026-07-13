import React from 'react';
import { useTranslation } from 'react-i18next';
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

export const DeleteMesaModal = React.memo(function DeleteMesaModal({
  visible,
  mesaToDelete,
  isDeletingMesa,
  onCancel,
  onConfirm,
}: DeleteMesaModalProps) {
  const { t } = useTranslation('mesas');

  return (
    <StockyDeleteConfirmModal
      visible={visible}
      title={t('alerts.confirmDeleteTable', { defaultValue: 'Eliminar mesa' })}
      message={t('alerts.confirmDeleteTable', {
        defaultValue: 'Se eliminará la mesa y sus ordenes asociadas.',
      })}
      warning={t('alerts.confirmDeleteTableWarning', { defaultValue: 'No se puede deshacer.' })}
      itemLabel={mesaToDelete ? mesaDisplayName(mesaToDelete, t('labels.table')) : null}
      loading={isDeletingMesa}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
});
