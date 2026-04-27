import { LOCAL_SYNC_CONFIG } from '../config/localSync.js';
import { enqueueLocalOutboxEvent } from '../localdb/outboxEventsStore.js';

export async function enqueueOutboxMutation({
  businessId,
  mutationType,
  payload,
  mutationId,
  baseVersions = null
} = {}) {
  if (!LOCAL_SYNC_CONFIG?.enabled || !LOCAL_SYNC_CONFIG?.shadowWritesEnabled) {
    return null;
  }

  return enqueueLocalOutboxEvent({
    businessId,
    mutationType,
    payload,
    mutationId,
    baseVersions
  });
}

export default {
  enqueueOutboxMutation
};
