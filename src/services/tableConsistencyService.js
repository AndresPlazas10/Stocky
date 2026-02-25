import LOCAL_SYNC_CONFIG from '../config/localSync.js';
import { getLocalDbClient } from '../localdb/client.js';
import { getOpenOrdersByBusiness, getTablesWithCurrentOrderByBusiness } from '../data/queries/ordersQueries.js';
import { supabaseAdapter } from '../data/adapters/supabaseAdapter.js';
import { logger } from '../utils/logger.js';
import { detectTableOrderInconsistencies } from './tableConsistencyDetect.js';

function normalizeText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function isFunctionUnavailableError(errorLike, functionName) {
  const message = String(errorLike?.message || errorLike || '').toLowerCase();
  if (!message) return false;

  const normalizedFn = String(functionName || '').toLowerCase();
  const referencesFunction = normalizedFn ? message.includes(normalizedFn) : true;

  return referencesFunction && (
    message.includes('does not exist')
    || message.includes('could not find the function')
    || message.includes('schema cache')
    || message.includes('not found')
    || message.includes('pgrst202')
    || message.includes('42883')
  );
}

async function appendConflict({
  businessId = null,
  mutationType = 'table.consistency.reconcile',
  mutationId = null,
  reason,
  details = null
}) {
  if (!LOCAL_SYNC_CONFIG.enabled) return;
  try {
    const db = getLocalDbClient();
    await db.init();
    await db.appendConflictLog({
      businessId,
      mutationType,
      mutationId,
      reason,
      details
    });
  } catch (error) {
    logger.warn('[table-consistency] no se pudo registrar conflicto local', {
      error: error?.message || String(error)
    });
  }
}

async function applyFixOperation(operation) {
  if (!operation) return { ok: false, reason: 'missing_operation' };

  if (operation.type === 'update_table') {
    const tableId = normalizeText(operation?.target?.tableId);
    const businessId = normalizeText(operation?.target?.businessId);
    if (!tableId || !businessId) return { ok: false, reason: 'missing_target' };

    const { error } = await supabaseAdapter.updateTableByBusinessAndId({
      businessId,
      tableId,
      payload: operation.payload || {}
    });
    if (error) {
      return {
        ok: false,
        reason: error?.message || 'update_table_failed'
      };
    }
    return { ok: true };
  }

  if (operation.type === 'update_order') {
    const orderId = normalizeText(operation?.target?.orderId);
    const businessId = normalizeText(operation?.target?.businessId);
    if (!orderId || !businessId) return { ok: false, reason: 'missing_target' };

    const { error } = await supabaseAdapter.updateOrderByBusinessAndId({
      businessId,
      orderId,
      payload: operation.payload || {}
    });
    if (error) {
      return {
        ok: false,
        reason: error?.message || 'update_order_failed'
      };
    }
    return { ok: true };
  }

  return { ok: false, reason: 'unsupported_operation' };
}

async function reconcileWithRpc({ businessId, maxFixes, source }) {
  const { data, error } = await supabaseAdapter.reconcileTablesOrdersConsistencyRpc({
    p_business_id: businessId,
    p_max_fixes: maxFixes,
    p_source: source
  });

  if (error) {
    throw error;
  }

  const payload = data || {};
  return {
    ok: Boolean(payload?.ok ?? true),
    reason: String(payload?.reason || 'reconciled'),
    findings: Array.isArray(payload?.findings) ? payload.findings : [],
    appliedFixes: Number(payload?.applied_fixes || 0)
  };
}

async function reconcileWithClientFallback({ businessId, dryRun, maxFixes, source }) {
  const [tables, openOrders] = await Promise.all([
    getTablesWithCurrentOrderByBusiness(businessId),
    getOpenOrdersByBusiness(businessId)
  ]);

  const { findings, fixes } = detectTableOrderInconsistencies({ tables, openOrders });
  if (findings.length === 0) {
    return {
      ok: true,
      reason: 'clean',
      findings: [],
      appliedFixes: 0
    };
  }

  const mutationId = `table-consistency:${businessId}:${Date.now()}`;
  const limitedFixes = fixes.slice(0, Math.max(0, Number(maxFixes || 0)));
  let appliedFixes = 0;

  if (!dryRun && limitedFixes.length > 0) {
    for (const fix of limitedFixes) {
      const result = await applyFixOperation(fix);
      if (result.ok) {
        appliedFixes += 1;
      } else {
        await appendConflict({
          businessId,
          mutationType: 'table.consistency.fix_failed',
          mutationId,
          reason: `No se pudo aplicar fix de consistencia: ${result.reason || 'unknown'}`,
          details: fix
        });
      }
    }
  }

  const highSeverityFindings = findings.filter((item) => item.severity === 'high');
  if (highSeverityFindings.length > 0) {
    await appendConflict({
      businessId,
      mutationType: 'table.consistency.detected',
      mutationId,
      reason: `Se detectaron ${highSeverityFindings.length} inconsistencias altas en mesas/ordenes (${source}).`,
      details: {
        source,
        findings: highSeverityFindings.slice(0, 10),
        total_findings: findings.length,
        attempted_fixes: limitedFixes.length,
        applied_fixes: appliedFixes
      }
    });
  }

  logger.warn('[table-consistency] inconsistencias detectadas (fallback cliente)', {
    businessId,
    source,
    findings: findings.length,
    attemptedFixes: limitedFixes.length,
    appliedFixes
  });

  return {
    ok: true,
    reason: 'reconciled',
    findings,
    appliedFixes
  };
}

export async function reconcileTableOrderConsistency({
  businessId,
  dryRun = false,
  maxFixes = 25,
  source = 'manual'
} = {}) {
  const normalizedBusinessId = normalizeText(businessId);
  if (!normalizedBusinessId) {
    return {
      ok: false,
      reason: 'missing_business_id',
      findings: [],
      appliedFixes: 0
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      reason: 'offline',
      findings: [],
      appliedFixes: 0
    };
  }

  if (!dryRun) {
    try {
      return await reconcileWithRpc({
        businessId: normalizedBusinessId,
        maxFixes: Math.max(1, Number(maxFixes || 25)),
        source
      });
    } catch (error) {
      if (!isFunctionUnavailableError(error, 'reconcile_tables_orders_consistency')) {
        throw error;
      }
      logger.warn('[table-consistency] RPC no disponible, usando fallback cliente', {
        businessId: normalizedBusinessId,
        source,
        error: error?.message || String(error)
      });
    }
  }

  return reconcileWithClientFallback({
    businessId: normalizedBusinessId,
    dryRun,
    maxFixes,
    source
  });
}

export { detectTableOrderInconsistencies };
export default reconcileTableOrderConsistency;
