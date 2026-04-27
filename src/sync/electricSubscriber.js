import { listEnabledShapes } from './shapeRegistry.js';
import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { getSyncStateRecord, upsertSyncStateRecord } from '../localdb/syncStateStore.js';
import { upsertShapeRows } from '../localdb/shapeMaterializationStore.js';

const STATE = {
  running: false,
  startedAt: null,
  businessId: null,
  pollMs: 5000,
  shapes: [],
  ticks: 0,
  lastTickAt: null,
  lastPullSummary: null,
  lastError: null,
  timer: null
};

function nowIso() {
  return new Date().toISOString();
}

export function getElectricSubscriberState() {
  return {
    running: STATE.running,
    startedAt: STATE.startedAt,
    businessId: STATE.businessId,
    pollMs: STATE.pollMs,
    shapes: [...STATE.shapes],
    ticks: STATE.ticks,
    lastTickAt: STATE.lastTickAt,
    lastPullSummary: STATE.lastPullSummary,
    lastError: STATE.lastError
  };
}

function compareCursors(a, b) {
  const aTs = Date.parse(String(a || ''));
  const bTs = Date.parse(String(b || ''));
  if (Number.isFinite(aTs) && Number.isFinite(bTs)) {
    if (aTs === bTs) return 0;
    return aTs > bTs ? 1 : -1;
  }
  const aText = String(a || '').trim();
  const bText = String(b || '').trim();
  if (aText === bText) return 0;
  return aText > bText ? 1 : -1;
}

async function pullShapeCursor({ shape, businessId, previousCursor }) {
  const cursorColumn = String(shape?.cursorColumn || 'updated_at').trim() || 'updated_at';
  const rowsResult = shape?.key === 'order_items'
    ? await supabaseAdapter.getOrderItemsByBusinessSinceCursor({
      businessId,
      cursorColumn,
      cursorValue: previousCursor,
      limit: 300
    })
    : await supabaseAdapter.getShapeRowsSinceCursor({
      table: shape?.table,
      businessId,
      cursorColumn,
      cursorValue: previousCursor,
      limit: 200,
      selectSql: '*'
    });

  if (rowsResult?.error) {
    return {
      ok: false,
      pulled: 0,
      nextCursor: previousCursor,
      upserted: 0,
      error: rowsResult.error
    };
  }

  const rows = Array.isArray(rowsResult?.data) ? rowsResult.data : [];
  const latestRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const nextCursor = latestRow?.[cursorColumn] || previousCursor || null;

  const upsertResult = await upsertShapeRows({
    businessId,
    shapeKey: shape?.key || shape?.table,
    rows,
    cursorColumn
  });

  return {
    ok: true,
    pulled: rows.length,
    upserted: Number(upsertResult?.upserted || 0),
    nextCursor,
    error: null
  };
}

export async function startElectricSubscriber({
  businessId = null,
  pollMs = 5000,
  onTick = null,
  onError = null
} = {}) {
  if (STATE.running) {
    return getElectricSubscriberState();
  }

  const normalizedBusinessId = String(businessId || '').trim();
  const shapes = listEnabledShapes({ businessId: normalizedBusinessId });

  STATE.running = true;
  STATE.startedAt = nowIso();
  STATE.businessId = normalizedBusinessId || null;
  STATE.pollMs = Number.isFinite(Number(pollMs)) ? Math.max(1000, Number(pollMs)) : 5000;
  STATE.shapes = shapes;
  STATE.ticks = 0;
  STATE.lastTickAt = null;
  STATE.lastPullSummary = null;
  STATE.lastError = null;

  STATE.timer = setInterval(async () => {
    try {
      STATE.ticks += 1;
      STATE.lastTickAt = nowIso();

      const summary = {
        tick: STATE.ticks,
        pulled: 0,
        upserted: 0,
        updatedShapes: 0,
        errors: 0
      };

      for (const shape of STATE.shapes) {
        const shapeKey = String(shape?.key || shape?.table || '').trim();
        if (!shapeKey) continue;

        const currentState = await getSyncStateRecord({
          businessId: STATE.businessId,
          shapeKey
        });

        const previousCursor = currentState?.cursor_value || null;
        const pull = await pullShapeCursor({
          shape,
          businessId: STATE.businessId,
          previousCursor
        });

        if (!pull.ok) {
          summary.errors += 1;
          await upsertSyncStateRecord({
            businessId: STATE.businessId,
            shapeKey,
            cursorValue: previousCursor,
            lastError: String(pull.error?.message || pull.error || 'shape_pull_failed')
          });
          continue;
        }

        if (compareCursors(pull.nextCursor, previousCursor) > 0) {
          summary.updatedShapes += 1;
        }

        summary.pulled += Number(pull.pulled || 0);
        summary.upserted += Number(pull.upserted || 0);

        await upsertSyncStateRecord({
          businessId: STATE.businessId,
          shapeKey,
          cursorValue: pull.nextCursor,
          lastError: null
        });
      }

      STATE.lastPullSummary = summary;

      if (typeof onTick === 'function') {
        await onTick({
          tick: STATE.ticks,
          businessId: STATE.businessId,
          shapes: STATE.shapes,
          summary
        });
      }
    } catch (error) {
      STATE.lastError = String(error?.message || error || 'electric_subscriber_tick_failed');
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  }, STATE.pollMs);

  return getElectricSubscriberState();
}

export async function stopElectricSubscriber() {
  if (STATE.timer) {
    clearInterval(STATE.timer);
  }

  STATE.running = false;
  STATE.startedAt = null;
  STATE.businessId = null;
  STATE.shapes = [];
  STATE.ticks = 0;
  STATE.lastTickAt = null;
  STATE.lastPullSummary = null;
  STATE.timer = null;

  return true;
}

export default {
  startElectricSubscriber,
  stopElectricSubscriber,
  getElectricSubscriberState
};
