// @ts-nocheck — FIXME: Migración incremental Phase 8
import { LOCAL_SYNC_CONFIG } from '../config/localSync';
import { enqueueLocalOutboxEvent } from '../localdb/outboxEventsStore.js';

interface OutboxMutationOptions {
  businessId?: string | null;
  mutationType?: string;
  payload?: Record<string, unknown>;
  mutationId?: string;
  baseVersions?: Record<string, number> | null;
}

export async function enqueueOutboxMutation({
  businessId,
  mutationType,
  payload,
  mutationId,
  baseVersions = null
}: OutboxMutationOptions = {}) {
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
