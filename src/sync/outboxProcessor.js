import { logger } from '../utils/logger.js';
import SyncReconciler from './reconciler.js';
import { invalidateFromOutboxEvent } from '../data/adapters/cacheInvalidation.js';

const DURABLE_MUTATION_TYPES = new Set([
  'sale.create',
  'sale.delete',
  'purchase.create',
  'purchase.delete',
  'table.create',
  'table.delete_cascade_orders',
  'order.create',
  'order.total.update',
  'order.close.single',
  'order.close.split',
  'order.delete_and_release_table',
  'order.item.insert',
  'order.item.update_quantity',
  'order.item.bulk_quantity_update',
  'order.item.delete',
  'product.create',
  'product.update',
  'product.status.update',
  'product.delete',
  'supplier.create',
  'supplier.update',
  'supplier.delete',
  'invoice.create',
  'invoice.sent',
  'invoice.cancel',
  'invoice.delete'
]);

function isRetryableRejectedReason(reasonLike) {
  const reason = String(reasonLike || '').toLowerCase();
  if (!reason) return false;
  return (
    reason.includes('failed to fetch')
    || reason.includes('networkerror')
    || reason.includes('network request failed')
    || reason.includes('fetch failed')
    || reason.includes('load failed')
    || reason.includes('network')
    || reason.includes('connection')
    || reason.includes('timeout')
    || reason.includes('temporarily unavailable')
    || reason.includes('service unavailable')
    || reason.includes('gateway')
    || reason.includes('too many requests')
    || reason.includes('status 408')
    || reason.includes('status 429')
    || reason.includes('status 500')
    || reason.includes('status 502')
    || reason.includes('status 503')
    || reason.includes('status 504')
    || reason.includes('57014')
    || reason.includes('pgrst301')
    || reason.includes('schema cache')
    || reason.includes('created_at')
    || reason.includes('does not exist')
    || reason.includes('pgrst')
  );
}

function collectRejectedReasonCandidates(reasonLike, detailsLike) {
  const candidates = [];
  const seenTexts = new Set();
  const seenObjects = new WeakSet();
  const queue = [reasonLike, detailsLike];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
      const normalized = String(current).trim();
      if (!normalized) continue;
      if (seenTexts.has(normalized)) continue;
      seenTexts.add(normalized);
      candidates.push(normalized);
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === 'object') {
      if (seenObjects.has(current)) continue;
      seenObjects.add(current);

      queue.push(current.error, current.reason, current.message, current.code, current.hint);
      if (Object.prototype.hasOwnProperty.call(current, 'status')) {
        queue.push(`status ${current.status}`);
      }
      if (Object.prototype.hasOwnProperty.call(current, 'statusCode')) {
        queue.push(`status ${current.statusCode}`);
      }
    }
  }

  return candidates;
}

function buildRejectedReason({
  reason,
  details
}) {
  const baseReason = String(reason || 'Handler rechazó la mutación').trim() || 'Handler rechazó la mutación';
  const candidates = collectRejectedReasonCandidates(null, details);
  const detailReason = candidates.find((candidate) => (
    String(candidate || '').trim()
    && String(candidate || '').trim().toLowerCase() !== baseReason.toLowerCase()
  ));

  if (!detailReason) return baseReason;

  const baseLooksGeneric = (
    baseReason.toLowerCase().includes('no se pudo sincronizar')
    || baseReason.toLowerCase().includes('handler rechazó')
  );
  if (!baseLooksGeneric) return baseReason;

  return `${baseReason} | ${String(detailReason).trim()}`;
}

function analyzeRejectedResult({
  reason,
  details,
  retryable = null
}) {
  const reasonToPersist = buildRejectedReason({ reason, details });
  const candidates = collectRejectedReasonCandidates(reason, details);
  const retryableReason = candidates.find((candidate) => isRetryableRejectedReason(candidate)) || null;
  const isRetryable = (
    retryable === true
    || Boolean(retryableReason)
  );

  return {
    retryable: isRetryable,
    retryReason: retryableReason || reasonToPersist,
    reasonToPersist
  };
}

export class OutboxProcessor {
  constructor({
    db,
    handlers = {},
    pollMs = 4000,
    batchSize = 20,
    maxRetries = 5
  } = {}) {
    this.db = db;
    this.handlers = handlers;
    this.pollMs = pollMs;
    this.batchSize = batchSize;
    this.maxRetries = maxRetries;
    this.reconciler = new SyncReconciler({ db });
    this.timer = null;
    this.processing = false;
  }

  start() {
    if (this.timer) return;
    this.tick().catch(() => {});
    this.timer = setInterval(() => {
      this.tick().catch(() => {});
    }, this.pollMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async canSyncNow() {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine === true;
  }

  async tick() {
    if (this.processing || !this.db) return;
    const canSync = await this.canSyncNow();
    if (!canSync) return;

    this.processing = true;
    try {
      await this.reviveDurableRejectedEvents();

      const events = await this.db.listOutboxEvents({
        status: 'pending',
        limit: this.batchSize
      });

      for (const event of events) {
        await this.processEvent(event);
      }
    } finally {
      this.processing = false;
    }
  }

  async processEvent(event) {
    await this.db.markOutboxSyncing(event.id);

    const handler = this.handlers[event.mutation_type] || this.handlers['*'];
    if (!handler) {
      const reason = `No existe handler para ${event.mutation_type}`;
      await this.db.markOutboxRejected(event.id, reason);
      await this.reconciler.handleRejectedEvent(event, reason);
      return;
    }

    try {
      const result = await handler(event);
      if (result?.ok === false) {
        const reason = result?.error || 'Handler rechazó la mutación';
        const mutationType = String(event?.mutation_type || '').trim();
        const isDurableMutation = DURABLE_MUTATION_TYPES.has(mutationType);
        const rejectedAnalysis = analyzeRejectedResult({
          reason,
          details: result?.details || null,
          retryable: result?.retryable
        });
        const retryableReject = isDurableMutation && rejectedAnalysis.retryable;

        if (retryableReject) {
          const retryReason = rejectedAnalysis.retryReason || reason;
          const retried = await this.db.markOutboxPendingWithRetry(event.id, retryReason);
          logger.warn('[sync] retry outbox (handler reject)', {
            eventId: event.id,
            mutationType,
            retries: Number(retried?.retry_count || 0),
            reason: retryReason
          });
          return;
        }

        const reasonToPersist = rejectedAnalysis.reasonToPersist || reason;
        await this.db.markOutboxRejected(event.id, reasonToPersist);
        await this.reconciler.handleRejectedEvent(event, reasonToPersist, result?.details || null);
        return;
      }

      await this.db.markOutboxAcked(event.id, result?.ackPayload || null);
      await this.handlePostAck(event);
      await this.recordConvergenceMetric(event);
    } catch (error) {
      const retried = await this.db.markOutboxPendingWithRetry(event.id, error?.message || String(error));
      const retries = Number(retried?.retry_count || 0);
      const mutationType = String(event?.mutation_type || '').trim();
      const isDurableMutation = DURABLE_MUTATION_TYPES.has(mutationType);

      if (retries >= this.maxRetries && !isDurableMutation) {
        const reason = error?.message || `Superó reintentos (${this.maxRetries})`;
        await this.db.markOutboxRejected(event.id, reason);
        await this.reconciler.handleRejectedEvent(event, reason);
      } else {
        logger.warn('[sync] retry outbox', {
          eventId: event.id,
          mutationType: event.mutation_type,
          retries,
          durable: isDurableMutation
        });
      }
    }
  }

  async handlePostAck(event) {
    try {
      await invalidateFromOutboxEvent(event);
    } catch (error) {
      logger.warn('[sync] post-ack cache invalidation failed', {
        eventId: event?.id,
        mutationType: event?.mutation_type,
        error: error?.message || String(error)
      });
    }
  }

  async reviveDurableRejectedEvents() {
    try {
      if (!this.db?.listOutboxEvents || !this.db?.updateOutboxEvent) return;
      const rejected = await this.db.listOutboxEvents({
        status: 'rejected',
        limit: Math.max(this.batchSize, 50)
      });

      for (const event of rejected || []) {
        const mutationType = String(event?.mutation_type || '').trim();
        if (!DURABLE_MUTATION_TYPES.has(mutationType)) continue;
        if (!isRetryableRejectedReason(event?.last_error)) continue;

        await this.db.updateOutboxEvent(event.id, {
          status: 'pending',
          last_error: null
        });
      }
    } catch (error) {
      logger.warn('[sync] revive durable rejected failed', {
        error: error?.message || String(error)
      });
    }
  }

  async recordConvergenceMetric(event) {
    try {
      if (!this.db?.recordConvergenceMetric) return;
      const createdAtMs = Date.parse(event?.created_at || '');
      if (!Number.isFinite(createdAtMs)) return;

      const durationMs = Math.max(0, Date.now() - createdAtMs);
      await this.db.recordConvergenceMetric({
        eventId: event?.id || null,
        mutationType: event?.mutation_type || null,
        durationMs,
        details: {
          mutation_id: event?.mutation_id || null
        }
      });
    } catch (error) {
      logger.warn('[sync] convergence metric failed', {
        eventId: event?.id,
        mutationType: event?.mutation_type,
        error: error?.message || String(error)
      });
    }
  }
}

export default OutboxProcessor;
