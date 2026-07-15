import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createMesa } from '../../../services/mesasService';
import { getErrorCode, getErrorMessage } from '../../../utils/error';
import { normalizeTableIdentifier } from '../utils/mesaHelpers';
import type { BusinessContext, MesaRecord } from '../../../services/mesasService';

export type UseMesaCreateProps = {
  context: BusinessContext | null | undefined;
  onCreated: (mesa: MesaRecord) => void;
  onError: (msg: string) => void;
};

export type UseMesaCreateReturn = {
  showCreateMesaModal: boolean;
  setShowCreateMesaModal: (v: boolean) => void;
  newTableNumber: string;
  setNewTableNumber: (v: string) => void;
  isCreatingMesa: boolean;
  mesaPreviewName: string;
  handleCreateMesa: () => Promise<void>;
};

export function useMesaCreate({
  context,
  onCreated,
  onError,
}: UseMesaCreateProps): UseMesaCreateReturn {
  const { t } = useTranslation('mesas');
  const [showCreateMesaModal, setShowCreateMesaModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [isCreatingMesa, setIsCreatingMesa] = useState(false);

  const mesaPreviewName = useMemo(() => {
    const tableLabel = t('labels.table');
    const identifier = normalizeTableIdentifier(newTableNumber);
    if (!identifier) return tableLabel;
    if (new RegExp(`^${tableLabel}\\s+`, 'i').test(identifier)) return identifier;
    return `${tableLabel} ${identifier}`;
  }, [newTableNumber, t]);

  const handleCreateMesa = useCallback(async () => {
    if (isCreatingMesa) return;

    if (!context?.businessId) {
      onError(t('errors.loadFailed'));
      return;
    }

    const tableIdentifier = normalizeTableIdentifier(newTableNumber);
    if (!tableIdentifier) {
      onError(t('errors.tableIdentifierRequired') || t('errors.loadFailed'));
      return;
    }

    setIsCreatingMesa(true);
    onError('');

    try {
      const createdMesa = await createMesa({
        businessId: context.businessId,
        tableNumber: tableIdentifier,
      });

      onCreated(createdMesa);
      setShowCreateMesaModal(false);
      setNewTableNumber('');
    } catch (err) {
      const code = getErrorCode(err);
      if (code === '23505') {
        onError(t('errors.tableAlreadyExists') || t('errors.loadFailed'));
      } else if (code === '22P02') {
        onError(t('errors.tableMustBeNumeric') || t('errors.loadFailed'));
      } else {
        onError(getErrorMessage(err));
      }
    } finally {
      setIsCreatingMesa(false);
    }
  }, [context, isCreatingMesa, newTableNumber, onCreated, onError]);

  return {
    showCreateMesaModal,
    setShowCreateMesaModal,
    newTableNumber,
    setNewTableNumber,
    isCreatingMesa,
    mesaPreviewName,
    handleCreateMesa,
  };
}
