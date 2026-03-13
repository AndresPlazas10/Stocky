#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadEnvFiles } from '../realtime-audit/env-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
loadEnvFiles(repoRoot);

const DEFAULT_RUNS = Number(process.env.PERF_BASELINE_RUNS || 7);
const DEFAULT_WARMUP = Number(process.env.PERF_BASELINE_WARMUP || 1);

function parseArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return fallback;
  return next;
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeLoginToEmail(login) {
  const normalized = String(login || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;
  return `${normalized}@stockly-app.com`;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx] ?? 0);
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return Number(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function min(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return Number(Math.min(...values));
}

function max(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return Number(Math.max(...values));
}

function formatMs(value) {
  if (!Number.isFinite(Number(value))) return '-';
  return `${Number(value).toFixed(1)}ms`;
}

function formatUnknownError(errorLike) {
  if (errorLike instanceof Error) {
    return errorLike.stack || errorLike.message;
  }
  if (!errorLike || typeof errorLike !== 'object') {
    return String(errorLike);
  }

  const enriched = {
    message: errorLike.message ?? null,
    code: errorLike.code ?? null,
    details: errorLike.details ?? null,
    hint: errorLike.hint ?? null,
    status: errorLike.status ?? null,
    name: errorLike.name ?? null,
  };

  return JSON.stringify(enriched, null, 2);
}

function summarizeSamples(samples) {
  return {
    samples: samples.length,
    avg_ms: average(samples),
    min_ms: min(samples),
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    p99_ms: percentile(samples, 99),
    max_ms: max(samples),
  };
}

function hrtimeMs(startNs) {
  const diff = process.hrtime.bigint() - startNs;
  return Number(diff) / 1_000_000;
}

function buildClient({ url, key }) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signInClient(client, { email, password, label }) {
  const normalizedEmail = normalizeLoginToEmail(email);
  const { error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) {
    throw new Error(`No se pudo autenticar ${label}: ${error.message}`);
  }

  const userResult = await client.auth.getUser();
  if (userResult.error || !userResult.data?.user?.id) {
    throw new Error(`Sesion invalida para ${label}`);
  }

  return {
    userId: String(userResult.data.user.id),
    email: normalizedEmail,
  };
}

function isMissingColumnError(errorLike, { tableName, columnName }) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    message.includes('column')
    && message.includes(`"${String(columnName || '').toLowerCase()}"`)
    && message.includes('relation')
    && message.includes(`"${String(tableName || '').toLowerCase()}"`)
    && message.includes('does not exist')
  );
}

function isMissingRelationError(errorLike, tableName) {
  const message = String(errorLike?.message || '').toLowerCase();
  return message.includes('relation') && message.includes(`"${String(tableName || '').toLowerCase()}"`) && message.includes('does not exist');
}

function isMissingFunctionError(errorLike, functionName) {
  const code = String(errorLike?.code || '').toLowerCase();
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    code === 'pgrst202'
    || code === '42883'
    || (
      message.includes(String(functionName || '').toLowerCase())
      && (
        message.includes('does not exist')
        || message.includes('could not find the function')
        || message.includes('schema cache')
        || message.includes('not found')
      )
    )
  );
}

function asArray(data) {
  return Array.isArray(data) ? data : [];
}

function selectFirstOpenOrderId(rows) {
  const normalizedRows = asArray(rows);
  const firstWithOpenOrder = normalizedRows.find((row) => String(row?.current_order_id || '').trim());
  return String(firstWithOpenOrder?.current_order_id || '').trim() || null;
}

function serializeSize(data) {
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch {
    return 0;
  }
}

function buildQueryCollector() {
  const map = new Map();

  async function runMeasuredQuery(name, queryRunner, options = {}) {
    const startNs = process.hrtime.bigint();
    const result = await queryRunner();
    const durationMs = hrtimeMs(startNs);

    const rowCount = Array.isArray(result?.data)
      ? result.data.length
      : (result?.data ? 1 : 0);
    const payloadBytes = serializeSize(result?.data);

    if (!map.has(name)) {
      map.set(name, {
        query: name,
        durations_ms: [],
        total_rows: 0,
        total_payload_bytes: 0,
        calls: 0,
      });
    }

    const row = map.get(name);
    row.durations_ms.push(durationMs);
    row.total_rows += rowCount;
    row.total_payload_bytes += payloadBytes;
    row.calls += 1;

    if (result?.error) {
      if (options.allowError) {
        return result;
      }
      if (options.optional && (
        (options.optionalColumn && isMissingColumnError(result.error, options.optionalColumn))
        || (options.optionalRelation && isMissingRelationError(result.error, options.optionalRelation))
      )) {
        return { ...result, skipped_optional: true };
      }
      throw result.error;
    }

    return result;
  }

  function summarize() {
    return Array.from(map.values())
      .map((row) => ({
        query: row.query,
        calls: row.calls,
        rows_total: row.total_rows,
        payload_kb_total: Number((row.total_payload_bytes / 1024).toFixed(2)),
        ...summarizeSamples(row.durations_ms),
      }))
      .sort((a, b) => Number(b.p95_ms || 0) - Number(a.p95_ms || 0));
  }

  return { runMeasuredQuery, summarize };
}

async function resolveBusinessId({ ownerClient, ownerUserId, envBusinessId, runMeasuredQuery }) {
  const explicit = String(envBusinessId || '').trim();
  if (explicit) return explicit;

  const owned = await runMeasuredQuery(
    'bootstrap.businesses_by_owner',
    () => ownerClient
      .from('businesses')
      .select('id,created_at')
      .eq('created_by', ownerUserId)
      .order('created_at', { ascending: false })
      .limit(1),
  );

  const businessId = String(owned?.data?.[0]?.id || '').trim();
  if (!businessId) throw new Error('No se encontro business_id para owner en staging.');
  return businessId;
}

async function opResolveBusinessContext({ client, userId, runMeasuredQuery }) {
  const contextRpc = await runMeasuredQuery(
    'context.resolve_mobile_business_context_rpc',
    () => client.rpc('resolve_mobile_business_context', {
      p_user_id: userId,
      p_preferred_business_id: null,
    }),
    { allowError: true },
  );

  if (!contextRpc?.error) {
    // First-paint: solo resolucion de contexto. El conteo de mesas se mueve
    // al flujo de carga de mesas y no bloquea el bootstrap de contexto.
    return;
  }

  if (!isMissingFunctionError(contextRpc.error, 'resolve_mobile_business_context')) {
    throw contextRpc.error;
  }

  const ownedBusiness = await runMeasuredQuery(
    'context.businesses_by_owner',
    () => client
      .from('businesses')
      .select('id,name,created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  const ownerBusinessId = String(ownedBusiness?.data?.id || '').trim();
  if (ownerBusinessId) return;

  const employeeRow = await runMeasuredQuery(
    'context.employees_by_user',
    () => client
      .from('employees')
      .select('business_id,is_active,created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  const employeeBusinessId = String(employeeRow?.data?.business_id || '').trim();
  if (!employeeBusinessId) return;

  await runMeasuredQuery(
    'context.businesses_by_employee_ids',
    () => client
      .from('businesses')
      .select('id,name,created_at')
      .eq('id', employeeBusinessId)
      .limit(1)
      .maybeSingle(),
  );

  // En fallback tampoco bloqueamos first-paint con conteos secundarios.
}

async function opMesasInitialLoad({ client, businessId, runMeasuredQuery, sharedState }) {
  const summaryFastRpc = await runMeasuredQuery(
    'mesas.tables_summary_fast_rpc',
    () => client.rpc('list_tables_with_order_summary_fast', { p_business_id: businessId }),
    { allowError: true },
  );

  if (!summaryFastRpc.error) {
    sharedState.openOrderId = selectFirstOpenOrderId(summaryFastRpc.data);
    return;
  }

  if (!isMissingFunctionError(summaryFastRpc.error, 'list_tables_with_order_summary_fast')) {
    throw summaryFastRpc.error;
  }

  const summaryRpc = await runMeasuredQuery(
    'mesas.tables_summary_rpc',
    () => client.rpc('list_tables_with_order_summary', { p_business_id: businessId }),
    { allowError: true },
  );

  if (!summaryRpc.error) {
    sharedState.openOrderId = selectFirstOpenOrderId(summaryRpc.data);
    return;
  }

  if (!isMissingFunctionError(summaryRpc.error, 'list_tables_with_order_summary')) {
    throw summaryRpc.error;
  }

  let mesas = await runMeasuredQuery(
    'mesas.tables_with_current_order',
    () => client
      .from('tables')
      .select(`
        id,
        business_id,
        table_number,
        name,
        status,
        current_order_id,
        orders:orders!current_order_id (
          id,
          status,
          total
        )
      `)
      .eq('business_id', businessId)
      .order('table_number', { ascending: true }),
    {
      allowError: true,
    },
  );

  if (mesas.error && isMissingColumnError(mesas.error, { tableName: 'tables', columnName: 'name' })) {
    mesas = await runMeasuredQuery(
      'mesas.tables_with_current_order_no_name',
      () => client
        .from('tables')
        .select(`
          id,
          business_id,
          table_number,
          status,
          current_order_id,
          orders:orders!current_order_id (
            id,
            status,
            total
          )
        `)
        .eq('business_id', businessId)
        .order('table_number', { ascending: true }),
    );
  }

  sharedState.openOrderId = selectFirstOpenOrderId(mesas.data);
}

async function opMesaOpenOrderLoad({ client, businessId, runMeasuredQuery, sharedState }) {
  let orderId = String(sharedState?.openOrderId || '').trim();
  if (!orderId) {
    const mesaWithOrder = await runMeasuredQuery(
      'mesa_open.find_open_order',
      () => client
        .from('tables')
        .select('id,current_order_id')
        .eq('business_id', businessId)
        .not('current_order_id', 'is', null)
        .limit(1),
    );
    orderId = String(mesaWithOrder?.data?.[0]?.current_order_id || '').trim();
    if (orderId) {
      sharedState.openOrderId = orderId;
    }
  }

  if (!orderId) return { skipped: true, reason: 'No hay mesas ocupadas con orden abierta en staging.' };

  const fastSnapshotRpc = await runMeasuredQuery(
    'mesa_open.order_snapshot_fast_rpc',
    () => client.rpc('list_open_order_snapshot_fast', { p_order_id: orderId }),
    { allowError: true },
  );

  if (!fastSnapshotRpc.error) {
    const rpcRow = Array.isArray(fastSnapshotRpc.data) ? fastSnapshotRpc.data[0] : fastSnapshotRpc.data;
    const items = Array.isArray(rpcRow?.items) ? rpcRow.items : [];
    return {
      skipped: false,
      order_id: orderId,
      items: items.length,
    };
  }

  if (!isMissingFunctionError(fastSnapshotRpc.error, 'list_open_order_snapshot_fast')) {
    throw fastSnapshotRpc.error;
  }

  const snapshotRpc = await runMeasuredQuery(
    'mesa_open.order_snapshot_rpc',
    () => client.rpc('list_open_order_snapshot', { p_order_id: orderId }),
    { allowError: true },
  );

  if (!snapshotRpc.error) {
    const rpcRow = Array.isArray(snapshotRpc.data) ? snapshotRpc.data[0] : snapshotRpc.data;
    const items = Array.isArray(rpcRow?.items) ? rpcRow.items : [];
    return {
      skipped: false,
      order_id: orderId,
      items: items.length,
    };
  }

  if (!isMissingFunctionError(snapshotRpc.error, 'list_open_order_snapshot')) {
    throw snapshotRpc.error;
  }

  const orderItems = await runMeasuredQuery(
    'mesa_open.order_items',
    () => client
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        combo_id,
        quantity,
        price,
        subtotal,
        products:products!order_items_product_id_fkey (id,name),
        combos:combos!order_items_combo_id_fkey (id,nombre)
      `)
      .eq('order_id', orderId)
      .order('id', { ascending: true }),
  );

  return {
    skipped: false,
    order_id: orderId,
    items: Array.isArray(orderItems?.data) ? orderItems.data.length : 0,
  };
}

async function opVentasInitialLoad({ client, businessId, runMeasuredQuery }) {
  const rpcResult = await runMeasuredQuery(
    'ventas.sales_recent_rpc',
    () => client.rpc('list_recent_sales_mobile', {
      p_business_id: businessId,
      p_limit: 50,
    }),
    {
      allowError: true,
    },
  );

  if (!rpcResult?.error) return;
  if (!isMissingFunctionError(rpcResult.error, 'list_recent_sales_mobile')) {
    throw rpcResult.error;
  }

  const full = await runMeasuredQuery(
    'ventas.sales_recent_with_cash_meta',
    () => client
      .from('sales')
      .select('id,business_id,user_id,seller_name,payment_method,total,created_at,amount_received,change_amount,change_breakdown')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50),
    {
      allowError: true,
    },
  );

  if (full.error && (
    isMissingColumnError(full.error, { tableName: 'sales', columnName: 'amount_received' })
    || isMissingColumnError(full.error, { tableName: 'sales', columnName: 'change_amount' })
    || isMissingColumnError(full.error, { tableName: 'sales', columnName: 'change_breakdown' })
  )) {
    await runMeasuredQuery(
      'ventas.sales_recent_fallback',
      () => client
        .from('sales')
        .select('id,business_id,user_id,seller_name,payment_method,total,created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(50),
    );
    return;
  }

  if (full.error) throw full.error;
}

async function opComprasInitialLoad({ client, businessId, runMeasuredQuery }) {
  const fastRpcResult = await runMeasuredQuery(
    'compras.purchases_recent_fast_rpc',
    () => client.rpc('list_recent_purchases_fast', {
      p_business_id: businessId,
      p_limit: 50,
    }),
    {
      allowError: true,
    },
  );

  if (!fastRpcResult?.error) return;
  if (!isMissingFunctionError(fastRpcResult.error, 'list_recent_purchases_fast')) {
    throw fastRpcResult.error;
  }

  const rpcResult = await runMeasuredQuery(
    'compras.purchases_recent_rpc',
    () => client.rpc('list_recent_purchases_with_supplier', {
      p_business_id: businessId,
      p_limit: 50,
    }),
    {
      allowError: true,
    },
  );

  if (!rpcResult?.error) return;
  if (!isMissingFunctionError(rpcResult.error, 'list_recent_purchases_with_supplier')) {
    throw rpcResult.error;
  }

  const withSupplierJoin = await runMeasuredQuery(
    'compras.purchases_recent_with_supplier',
    () => client
      .from('purchases')
      .select(`
        id,
        business_id,
        user_id,
        supplier_id,
        payment_method,
        notes,
        total,
        created_at,
        supplier:suppliers!purchases_supplier_id_fkey (
          id,
          business_name,
          contact_name
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50),
    {
      allowError: true,
    },
  );

  if (!withSupplierJoin?.error) return;
  const message = String(withSupplierJoin.error?.message || '').toLowerCase();
  if (!message.includes('relationship') && !message.includes('purchases_supplier_id_fkey')) {
    throw withSupplierJoin.error;
  }

  await runMeasuredQuery(
    'compras.purchases_recent',
    () => client
      .from('purchases')
      .select('id,business_id,user_id,supplier_id,payment_method,notes,total,created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50),
  );
}

async function opInventarioInitialLoad({ client, businessId, runMeasuredQuery }) {
  const fastRpcResult = await runMeasuredQuery(
    'inventario.products_fast_rpc',
    () => client.rpc('list_inventory_products_fast', {
      p_business_id: businessId,
      p_active_only: false,
    }),
    {
      allowError: true,
    },
  );

  if (!fastRpcResult?.error) return;
  if (!isMissingFunctionError(fastRpcResult.error, 'list_inventory_products_fast')) {
    throw fastRpcResult.error;
  }

  const rpcResult = await runMeasuredQuery(
    'inventario.products_with_supplier_rpc',
    () => client.rpc('list_inventory_products_with_supplier', {
      p_business_id: businessId,
      p_active_only: false,
    }),
    {
      allowError: true,
    },
  );

  if (!rpcResult?.error) return;
  if (!isMissingFunctionError(rpcResult.error, 'list_inventory_products_with_supplier')) {
    throw rpcResult.error;
  }

  await runMeasuredQuery(
    'inventario.products_full',
    () => client
      .from('products')
      .select('id,business_id,code,name,category,purchase_price,sale_price,stock,min_stock,unit,supplier_id,is_active,manage_stock,created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
  );
}

async function opEmpleadosLoad({ client, businessId, runMeasuredQuery }) {
  await runMeasuredQuery(
    'empleados.list_management',
    () => client
      .from('employees')
      .select('id,business_id,user_id,username,full_name,role,is_active,created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
  );
}

async function measureOperation({ name, runs, warmup, runner }) {
  const samples = [];
  let skipped = false;
  let skipReason = null;

  for (let i = 0; i < warmup + runs; i += 1) {
    const startNs = process.hrtime.bigint();
    const result = await runner();
    const durationMs = hrtimeMs(startNs);

    if (result?.skipped) {
      skipped = true;
      skipReason = result.reason || 'Operation skipped';
      break;
    }

    if (i >= warmup) {
      samples.push(durationMs);
    }
  }

  return {
    name,
    status: skipped ? 'SKIPPED' : 'PASS',
    skip_reason: skipReason,
    samples_ms: samples,
    stats: skipped ? null : summarizeSamples(samples),
  };
}

function buildTopBottlenecks({ operations, queryStats }) {
  const operationCandidates = operations
    .filter((row) => row.status === 'PASS' && row.stats)
    .map((row) => ({
      type: 'operation',
      name: row.name,
      p95_ms: Number(row.stats?.p95_ms || 0),
      avg_ms: Number(row.stats?.avg_ms || 0),
    }));

  const queryCandidates = (Array.isArray(queryStats) ? queryStats : [])
    .map((row) => ({
      type: 'query',
      name: row.query,
      p95_ms: Number(row.p95_ms || 0),
      avg_ms: Number(row.avg_ms || 0),
    }));

  return [...operationCandidates, ...queryCandidates]
    .sort((a, b) => b.p95_ms - a.p95_ms)
    .slice(0, 10);
}

function buildRecommendations({ topBottlenecks, queryStats }) {
  const recs = [];
  const names = new Set(topBottlenecks.map((item) => item.name));
  const measuredQueryNames = new Set(
    (Array.isArray(queryStats) ? queryStats : [])
      .map((row) => String(row?.query || '').trim())
      .filter(Boolean),
  );
  const hasMesaSnapshotRpc = (
    (
      measuredQueryNames.has('mesa_open.order_snapshot_fast_rpc')
      || measuredQueryNames.has('mesa_open.order_snapshot_rpc')
    )
    && !measuredQueryNames.has('mesa_open.order_items')
  );
  const hasComprasRecentRpc = (
    (
      measuredQueryNames.has('compras.purchases_recent_fast_rpc')
      || measuredQueryNames.has('compras.purchases_recent_rpc')
    )
    && !measuredQueryNames.has('compras.purchases_recent_with_supplier')
    && !measuredQueryNames.has('compras.purchases_recent')
  );
  const hasComprasInventarioRpc = (
    hasComprasRecentRpc
    && (
      measuredQueryNames.has('inventario.products_fast_rpc')
      || measuredQueryNames.has('inventario.products_with_supplier_rpc')
    )
    && !measuredQueryNames.has('inventario.products_full')
  );
  const hasVentasRecentRpc = (
    measuredQueryNames.has('ventas.sales_recent_rpc')
    && !measuredQueryNames.has('ventas.sales_recent_with_cash_meta')
    && !measuredQueryNames.has('ventas.sales_recent_fallback')
  );

  if (
    !hasComprasInventarioRpc
    && Array.from(names).some((name) => name.startsWith('inventario.') || name.startsWith('compras.'))
  ) {
    recs.push('Reducir joins/mapeos N+1 en compras/inventario consolidando proveedores en RPC enriquecido por pantalla.');
  }
  if (
    !hasMesaSnapshotRpc
    && Array.from(names).some((name) => name.startsWith('mesas.') || name.startsWith('mesa_open.'))
  ) {
    recs.push('Precalcular datos de mesa abierta (total, unidades) en una vista/RPC para evitar queries múltiples al abrir mesa.');
  }
  if (!hasVentasRecentRpc && Array.from(names).some((name) => name.startsWith('ventas.'))) {
    recs.push('Separar carga inicial de ventas en “first paint” (sales list) y “background” (catalogo/first day) para bajar TTI.');
  }
  if (recs.length === 0) {
    recs.push('Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.');
  }

  return recs;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Performance Baseline - Semana 1');
  lines.push('');
  lines.push(`Fecha: ${report.generated_at}`);
  lines.push(`Business ID: ${report.environment.business_id}`);
  lines.push(`Runs por operación: ${report.environment.runs} (warmup ${report.environment.warmup})`);
  lines.push('');
  lines.push('## Resumen Ejecutivo');
  lines.push('');
  lines.push(`- Operaciones medidas: ${report.operations.length}`);
  lines.push(`- Queries medidas: ${report.query_stats.length}`);
  lines.push(`- Bottlenecks top: ${report.top_bottlenecks.length}`);
  lines.push('');
  lines.push('## SLA Tracking Inicial');
  lines.push('');
  lines.push('| Operación | p50 | p95 | p99 | Estado objetivo |');
  lines.push('|---|---:|---:|---:|---|');
  for (const op of report.operations) {
    if (op.status !== 'PASS') {
      lines.push(`| ${op.name} | - | - | - | SKIPPED |`);
      continue;
    }
    const p95 = Number(op.stats?.p95_ms || 0);
    const target = p95 <= 900 ? 'OK (<900ms)' : 'DEGRADADO';
    lines.push(`| ${op.name} | ${formatMs(op.stats?.p50_ms)} | ${formatMs(op.stats?.p95_ms)} | ${formatMs(op.stats?.p99_ms)} | ${target} |`);
  }
  lines.push('');
  lines.push('## Top Bottlenecks (p95)');
  lines.push('');
  lines.push('| # | Tipo | Nombre | p95 | promedio |');
  lines.push('|---:|---|---|---:|---:|');
  report.top_bottlenecks.forEach((item, index) => {
    lines.push(`| ${index + 1} | ${item.type} | ${item.name} | ${formatMs(item.p95_ms)} | ${formatMs(item.avg_ms)} |`);
  });
  lines.push('');
  lines.push('## Recomendaciones P0 (Siguiente Iteración)');
  lines.push('');
  report.recommendations.forEach((rec, index) => {
    lines.push(`${index + 1}. ${rec}`);
  });
  lines.push('');
  lines.push('## Archivos de evidencia');
  lines.push('');
  lines.push('- `testing/perf/perf-baseline.json`');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const outJsonArg = parseArg('--out-json', path.join('testing', 'perf', 'perf-baseline.json'));
  const outMdArg = parseArg('--out-md', path.join('docs', 'perf', 'PERF_BASELINE.md'));
  const outJsonPath = path.isAbsolute(outJsonArg) ? outJsonArg : path.join(repoRoot, outJsonArg);
  const outMdPath = path.isAbsolute(outMdArg) ? outMdArg : path.join(repoRoot, outMdArg);

  const supabaseUrl = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan SUPABASE_URL y/o SUPABASE_ANON_KEY (o sus variantes VITE_/EXPO_).');
  }

  const ownerEmail = process.env.REALTIME_OWNER_EMAIL || process.env.PERF_OWNER_EMAIL || '';
  const ownerPassword = process.env.REALTIME_OWNER_PASSWORD || process.env.PERF_OWNER_PASSWORD || '';
  const employeeEmail = process.env.REALTIME_EMPLOYEE_EMAIL || process.env.PERF_EMPLOYEE_EMAIL || '';
  const employeePassword = process.env.REALTIME_EMPLOYEE_PASSWORD || process.env.PERF_EMPLOYEE_PASSWORD || '';
  const envBusinessId = process.env.REALTIME_TEST_BUSINESS_ID || process.env.PERF_TEST_BUSINESS_ID || '';

  if (!ownerEmail || !ownerPassword) {
    throw new Error('Faltan credenciales owner (REALTIME_OWNER_EMAIL / REALTIME_OWNER_PASSWORD).');
  }
  if (!employeeEmail || !employeePassword) {
    throw new Error('Faltan credenciales employee (REALTIME_EMPLOYEE_EMAIL / REALTIME_EMPLOYEE_PASSWORD).');
  }

  const runs = Number(parseArg('--runs', String(DEFAULT_RUNS)));
  const warmup = Number(parseArg('--warmup', String(DEFAULT_WARMUP)));
  if (!Number.isFinite(runs) || runs <= 0) throw new Error('--runs debe ser > 0');
  if (!Number.isFinite(warmup) || warmup < 0) throw new Error('--warmup debe ser >= 0');

  const queryCollector = buildQueryCollector();
  const { runMeasuredQuery } = queryCollector;

  const ownerClient = buildClient({ url: supabaseUrl, key: supabaseAnonKey });
  const employeeClient = buildClient({ url: supabaseUrl, key: supabaseAnonKey });

  const ownerAuth = await signInClient(ownerClient, {
    email: ownerEmail,
    password: ownerPassword,
    label: 'owner',
  });
  const employeeAuth = await signInClient(employeeClient, {
    email: employeeEmail,
    password: employeePassword,
    label: 'employee',
  });

  const businessId = await resolveBusinessId({
    ownerClient,
    ownerUserId: ownerAuth.userId,
    envBusinessId,
    runMeasuredQuery,
  });
  const sharedState = {
    openOrderId: null,
  };

  const operations = [];
  operations.push(await measureOperation({
    name: 'resolve_business_context_owner',
    runs,
    warmup,
    runner: () => opResolveBusinessContext({
      client: ownerClient,
      userId: ownerAuth.userId,
      runMeasuredQuery,
    }),
  }));

  operations.push(await measureOperation({
    name: 'resolve_business_context_employee',
    runs,
    warmup,
    runner: () => opResolveBusinessContext({
      client: employeeClient,
      userId: employeeAuth.userId,
      runMeasuredQuery,
    }),
  }));

  operations.push(await measureOperation({
    name: 'mesas_initial_load',
    runs,
    warmup,
    runner: () => opMesasInitialLoad({
      client: ownerClient,
      businessId,
      runMeasuredQuery,
      sharedState,
    }),
  }));

  operations.push(await measureOperation({
    name: 'mesa_open_order_load',
    runs,
    warmup,
    runner: () => opMesaOpenOrderLoad({
      client: ownerClient,
      businessId,
      runMeasuredQuery,
      sharedState,
    }),
  }));

  operations.push(await measureOperation({
    name: 'ventas_initial_load',
    runs,
    warmup,
    runner: () => opVentasInitialLoad({
      client: ownerClient,
      businessId,
      runMeasuredQuery,
    }),
  }));

  operations.push(await measureOperation({
    name: 'compras_initial_load',
    runs,
    warmup,
    runner: () => opComprasInitialLoad({
      client: ownerClient,
      businessId,
      runMeasuredQuery,
    }),
  }));

  operations.push(await measureOperation({
    name: 'inventario_initial_load',
    runs,
    warmup,
    runner: () => opInventarioInitialLoad({
      client: ownerClient,
      businessId,
      runMeasuredQuery,
    }),
  }));

  operations.push(await measureOperation({
    name: 'empleados_load',
    runs,
    warmup,
    runner: () => opEmpleadosLoad({
      client: ownerClient,
      businessId,
      runMeasuredQuery,
    }),
  }));

  const queryStats = queryCollector.summarize();
  const topBottlenecks = buildTopBottlenecks({ operations, queryStats });
  const recommendations = buildRecommendations({
    topBottlenecks,
    queryStats,
  });

  const report = {
    generated_at: new Date().toISOString(),
    scope: 'week1_mobile_speed_baseline',
    environment: {
      business_id: businessId,
      owner_email: ownerAuth.email,
      employee_email: employeeAuth.email,
      runs,
      warmup,
    },
    operations,
    query_stats: queryStats,
    top_bottlenecks: topBottlenecks,
    recommendations,
  };

  ensureDirSync(path.dirname(outJsonPath));
  ensureDirSync(path.dirname(outMdPath));
  fs.writeFileSync(outJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMdPath, buildMarkdown(report), 'utf8');

  process.stdout.write(`Performance baseline JSON: ${path.relative(repoRoot, outJsonPath)}\n`);
  process.stdout.write(`Performance baseline MD: ${path.relative(repoRoot, outMdPath)}\n`);

  const worstOp = operations
    .filter((row) => row.status === 'PASS')
    .sort((a, b) => Number(b.stats?.p95_ms || 0) - Number(a.stats?.p95_ms || 0))[0];

  if (worstOp?.stats?.p95_ms) {
    process.stdout.write(`Worst operation p95: ${worstOp.name} (${formatMs(worstOp.stats.p95_ms)})\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${formatUnknownError(error)}\n`);
  process.exitCode = 1;
});
