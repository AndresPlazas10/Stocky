import {
  fetchMesasByBusinessId,
  resolveBusinessContext,
  type BusinessContext,
  type MesaRecord,
} from '../../services/mesasService';

export async function resolveMesasBusinessContext(userId: string): Promise<BusinessContext | null> {
  return resolveBusinessContext(userId);
}

export async function listMesasByBusinessId(businessId: string): Promise<MesaRecord[]> {
  return fetchMesasByBusinessId(businessId);
}
