/**
 * Reconciliador scaffold (Fase B).
 *
 * Próxima etapa:
 * - comparar estado local DB vs cloud
 * - registrar divergencias en conflict_log
 * - aplicar compensaciones de inventario cuando corresponda
 */
import { listConflictLogRecords } from '../localdb/conflictLogStore.js';

export async function reconcileLocalState() {
  const conflicts = await listConflictLogRecords({ limit: 1000 });

  return {
    ok: true,
    reconciled: 0,
    conflicts: Array.isArray(conflicts) ? conflicts.length : 0,
    mode: 'scaffold'
  };
}

export async function listReconciliationConflicts(options = {}) {
  return listConflictLogRecords(options);
}

export default {
  reconcileLocalState,
  listReconciliationConflicts
};
