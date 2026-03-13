import { openCloseMesa, type MesaRecord } from '../../services/mesasService';

export async function setMesaOpenState({
  accessToken,
  userId,
  tableId,
  action,
}: {
  accessToken: string;
  userId: string;
  tableId: string;
  action: 'open' | 'close';
}): Promise<MesaRecord> {
  return openCloseMesa({
    accessToken,
    userId,
    tableId,
    action,
  });
}
