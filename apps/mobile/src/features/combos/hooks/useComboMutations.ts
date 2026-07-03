import { useCallback, useState } from 'react';
import {
  COMBO_STATUS,
  createComboByBusinessId,
  deleteComboByBusinessAndId,
  setComboStatusByBusinessAndId,
  updateComboByBusinessAndId,
  type ComboRecord,
  type ComboStatus,
} from '../../../services/combosService';
import { normalizeStatus, parseComboMoneyText, type ComboFormState } from '../comboUtils';

interface UseComboMutationsParams {
  businessId: string;
  canManageCombos: boolean;
  form: ComboFormState;
  editingCombo: ComboRecord | null;
  hasDuplicateProducts: boolean;
  closeFormModal: () => void;
  refreshCombos: () => Promise<void>;
  setCombos: (updater: (prev: ComboRecord[]) => ComboRecord[]) => void;
  setError: (error: string | null) => void;
  onComboSaved?: (isEdit: boolean, name: string) => void;
  onComboDeleted?: (name: string) => void;
}

export function useComboMutations({
  businessId,
  canManageCombos,
  form,
  editingCombo,
  hasDuplicateProducts,
  closeFormModal,
  refreshCombos,
  setCombos,
  setError,
  onComboSaved,
  onComboDeleted,
}: UseComboMutationsParams) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [comboToDelete, setComboToDelete] = useState<ComboRecord | null>(null);

  const submitForm = useCallback(async () => {
    if (saving || !canManageCombos) return;
    setSaving(true);
    setError(null);

    try {
      const nombre = String(form.nombre || '').trim();
      if (!nombre) {
        throw new Error('El nombre del combo es obligatorio.');
      }

      const precioVenta = parseComboMoneyText(form.precioVenta);
      if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
        throw new Error('El precio de venta debe ser mayor a 0.');
      }

      const selectedItems = (Array.isArray(form.items) ? form.items : []).filter(
        (item) => String(item.productoId || '').trim().length > 0,
      );

      if (selectedItems.length === 0) {
        throw new Error('Debes agregar al menos un producto al combo.');
      }
      if (hasDuplicateProducts) {
        throw new Error('No se permiten productos repetidos en el combo.');
      }

      const normalizedItems = selectedItems.map((item, index) => {
        const productoId = String(item.productoId || '').trim();
        const cantidad = Number(String(item.cantidad || '').replace(',', '.'));
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          throw new Error(`Cantidad invalida en la fila ${index + 1}.`);
        }
        return { producto_id: productoId, cantidad };
      });

      const payload = {
        nombre,
        precio_venta: precioVenta,
        descripcion: String(form.descripcion || '').trim() || null,
        estado: normalizeStatus(form.estado),
        items: normalizedItems,
      };

      if (editingCombo?.id) {
        await updateComboByBusinessAndId({
          businessId,
          comboId: editingCombo.id,
          payload,
        });
      } else {
        await createComboByBusinessId(businessId, payload);
      }

      onComboSaved?.(Boolean(editingCombo), nombre);
      closeFormModal();
      await refreshCombos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el combo.');
    } finally {
      setSaving(false);
    }
  }, [
    businessId,
    canManageCombos,
    closeFormModal,
    editingCombo,
    form,
    hasDuplicateProducts,
    refreshCombos,
    saving,
    setError,
    onComboSaved,
  ]);

  const askDeleteCombo = useCallback(
    (combo: ComboRecord) => {
      if (!canManageCombos) return;
      setError(null);
      setComboToDelete(combo);
      setShowDeleteModal(true);
    },
    [canManageCombos, setError],
  );

  const confirmDeleteCombo = useCallback(async () => {
    if (!comboToDelete?.id || deleting || !canManageCombos) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteComboByBusinessAndId({
        businessId,
        comboId: comboToDelete.id,
      });
      onComboDeleted?.(comboToDelete.nombre || 'Combo');
      setShowDeleteModal(false);
      setComboToDelete(null);
      await refreshCombos();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el combo.';
      if (message.toLowerCase().includes('movimientos asociados')) {
        try {
          await setComboStatusByBusinessAndId({
            businessId,
            comboId: comboToDelete.id,
            status: COMBO_STATUS.INACTIVE,
          });
          setCombos((prev) =>
            prev.map((item) =>
              item.id === comboToDelete.id ? { ...item, estado: COMBO_STATUS.INACTIVE } : item,
            ),
          );
          setShowDeleteModal(false);
          setComboToDelete(null);
          return;
        } catch (deactivateErr) {
          setError(deactivateErr instanceof Error ? deactivateErr.message : message);
          return;
        }
      }
      setError(message);
    } finally {
      setDeleting(false);
    }
  }, [businessId, canManageCombos, comboToDelete, deleting, refreshCombos, setCombos, setError, onComboDeleted]);

  const toggleComboStatus = useCallback(
    async (combo: ComboRecord) => {
      if (!canManageCombos || updatingStatusId) return;

      const currentStatus = normalizeStatus(combo.estado);
      const nextStatus: ComboStatus =
        currentStatus === COMBO_STATUS.ACTIVE ? COMBO_STATUS.INACTIVE : COMBO_STATUS.ACTIVE;

      setUpdatingStatusId(combo.id);
      setError(null);
      try {
        await setComboStatusByBusinessAndId({
          businessId,
          comboId: combo.id,
          status: nextStatus,
        });
        setCombos((prev) =>
          prev.map((item) => (item.id === combo.id ? { ...item, estado: nextStatus } : item)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del combo.');
      } finally {
        setUpdatingStatusId(null);
      }
    },
    [businessId, canManageCombos, updatingStatusId, setCombos, setError],
  );

  const closeDeleteModal = useCallback(() => {
    if (deleting) return;
    setShowDeleteModal(false);
    setComboToDelete(null);
  }, [deleting]);

  return {
    saving,
    deleting,
    updatingStatusId,
    showDeleteModal,
    comboToDelete,
    submitForm,
    askDeleteCombo,
    confirmDeleteCombo,
    toggleComboStatus,
    closeDeleteModal,
  };
}
