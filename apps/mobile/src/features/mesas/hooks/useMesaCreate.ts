import { useCallback, useMemo, useState } from 'react';
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
  const [showCreateMesaModal, setShowCreateMesaModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [isCreatingMesa, setIsCreatingMesa] = useState(false);

  const mesaPreviewName = useMemo(() => {
    const identifier = normalizeTableIdentifier(newTableNumber);
    if (!identifier) return 'Mesa';
    if (/^mesa\s+/i.test(identifier)) return identifier;
    return `Mesa ${identifier}`;
  }, [newTableNumber]);

  const handleCreateMesa = useCallback(async () => {
    if (isCreatingMesa) return;

    if (!context?.businessId) {
      onError('No se encontro el negocio activo.');
      return;
    }

    const tableIdentifier = normalizeTableIdentifier(newTableNumber);
    if (!tableIdentifier) {
      onError('Ingresa un identificador de mesa valido.');
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
        onError('Ese identificador de mesa ya existe.');
      } else if (code === '22P02') {
        onError('En esta base de datos el identificador de mesa debe ser numerico.');
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
