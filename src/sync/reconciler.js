import { logger } from '../utils/logger.js';

export class SyncReconciler {
  constructor({ db } = {}) {
    this.db = db;
  }

  async handleRejectedEvent(event, reason, details = null) {
    if (!this.db || !event) return;

    await this.db.appendConflictLog({
      businessId: event.business_id || null,
      mutationType: event.mutation_type || null,
      mutationId: event.mutation_id || null,
      reason,
      details
    });

    logger.warn('[sync] evento rechazado', {
      eventId: event.id,
      mutationType: event.mutation_type,
      reason
    });
  }
}

export default SyncReconciler;

