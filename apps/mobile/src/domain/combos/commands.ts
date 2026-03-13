import {
  createComboByBusinessId,
  deleteComboByBusinessAndId,
  setComboStatusByBusinessAndId,
  updateComboByBusinessAndId,
  type ComboStatus,
  type ComboUpsertPayload,
} from '../../services/combosService';

export async function createComboForBusiness(
  businessId: string,
  payload: ComboUpsertPayload,
): Promise<{ comboId: string | null }> {
  return createComboByBusinessId(businessId, payload);
}

export async function updateComboForBusiness({
  businessId,
  comboId,
  payload,
}: {
  businessId: string;
  comboId: string;
  payload: ComboUpsertPayload;
}): Promise<void> {
  await updateComboByBusinessAndId({
    businessId,
    comboId,
    payload,
  });
}

export async function setComboStatusForBusiness({
  businessId,
  comboId,
  status,
}: {
  businessId: string;
  comboId: string;
  status: ComboStatus;
}): Promise<void> {
  await setComboStatusByBusinessAndId({
    businessId,
    comboId,
    status,
  });
}

export async function deleteComboForBusiness({
  businessId,
  comboId,
}: {
  businessId: string;
  comboId: string;
}): Promise<void> {
  await deleteComboByBusinessAndId({
    businessId,
    comboId,
  });
}

// Alias de compatibilidad.
export async function mutateCombos(
  businessId: string,
  payload: ComboUpsertPayload,
): Promise<{ comboId: string | null }> {
  return createComboForBusiness(businessId, payload);
}
