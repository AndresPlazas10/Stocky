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
      title={t('alerts.confirmDeleteTable')}
      message={t('alerts.confirmDeleteTableMessage')}
      warning={t('alerts.confirmDeleteTableWarning')}
      itemLabel={mesaToDelete ? mesaDisplayName(mesaToDelete, t('labels.table')) : null}
      loading={isDeletingMesa}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
});
