#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import { loadEnvFiles } from './env-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
loadEnvFiles(repoRoot);
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const CRITICAL_TABLES = [
  'tables',
  'orders',
  'order_items',
  'sales',
  'purchases',
  'products',
  'employees',
  'combos',
  'sale_details',
];
const DEFAULT_EVENT_TIMEOUT_MS = Number(process.env.REALTIME_EVENT_TIMEOUT_MS || 4500);
const DEFAULT_EVENT_LOOKBACK_MS = Number(process.env.REALTIME_EVENT_LOOKBACK_MS || 2000);
const DEBUG_SMOKE = String(process.env.REALTIME_SMOKE_DEBUG || '').trim() === '1';

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

function normalizePath(input) {
  if (path.isAbsolute(input)) return input;
  return path.join(repoRoot, input);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs() {
  return Date.now();
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

function isBusinessScopedTable(table) {
  return ['tables', 'orders', 'sales', 'purchases', 'products', 'employees', 'combos'].includes(table);
}

function extractPayloadId(payload, expectedEvent) {
  if (!payload) return null;
  if (expectedEvent === 'DELETE') return payload.old?.id || payload.new?.id || null;
  return payload.new?.id || payload.old?.id || null;
}

function isCannotInsertProvidedColumnError(errorLike, columnName) {
  const message = String(errorLike?.message || '').toLowerCase();
  return (
    (
      (message.includes('cannot insert') && message.includes('non-default value'))
      || (message.includes('can only be updated to default'))
    )
    && message.includes(`"${String(columnName || '').toLowerCase()}"`)
  );
}

function classifyFailure({ ownerOk, employeeOk, outsiderReceived }) {
  if (!ownerOk && !employeeOk) return { type: 'filtro/config_roto', severity: 'critical' };
  if (ownerOk && !employeeOk) return { type: 'realtime_roto', severity: 'critical' };
  if (outsiderReceived) return { type: 'filtro/config_roto', severity: 'critical' };
  return { type: 'realtime_roto', severity: 'high' };
}

class EventCollector {
  constructor() {
    this.events = [];
  }

  push(event) {
    this.events.push(event);
  }

  async waitFor({ actor, table, eventType, recordId, afterMs, timeoutMs = 9000 }) {
    const started = nowMs();

    while (nowMs() - started < timeoutMs) {
      const found = this.events.find((entry) => {
        if (entry.actor !== actor) return false;
        if (entry.table !== table) return false;
        if (entry.eventType !== eventType) return false;
        if (entry.receivedAt < afterMs) return false;
        if (!recordId) return true;
        return extractPayloadId(entry.payload, eventType) === recordId;
      });

      if (found) return found;
      await sleep(40);
    }

    return null;
  }
}

function createRealtimeClient({ url, key, persistSession = false }) {
  return createClient(url, key, {
    auth: {
      persistSession,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 15,
      },
    },
  });
}

function normalizeLoginToEmail(login) {
  const normalized = String(login || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;
  return `${normalized}@stockly-app.com`;
}

async function signInClient(client, { email, password, label }) {
  const normalizedEmail = normalizeLoginToEmail(email);
  const { error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
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

async function subscribeActorTable({ client, actor, table, businessId, collector }) {
  const channelName = `realtime-audit:${actor}:${table}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  const filter = isBusinessScopedTable(table) ? `business_id=eq.${businessId}` : undefined;

  let status = 'INITIAL';
  let lastError = null;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      (payload) => {
        collector.push({
          actor,
          table,
          eventType: payload.eventType,
          payload,
          receivedAt: nowMs(),
        });
      },
    );

  const subscribed = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (DEBUG_SMOKE) {
        process.stdout.write(`[smoke][subscribe-timeout] actor=${actor} table=${table} status=${status}\\n`);
      }
      resolve(false);
    }, 10000);

    channel.subscribe((nextStatus, err) => {
      status = nextStatus;
      if (err) lastError = err;
      if (DEBUG_SMOKE) {
        process.stdout.write(`[smoke][subscribe-status] actor=${actor} table=${table} status=${nextStatus} err=${err?.message || 'none'}\\n`);
      }

      if (nextStatus === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve(true);
      }

      if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT' || nextStatus === 'CLOSED') {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  });

  return {
    channel,
    actor,
    table,
    filter,
    subscribed,
    status,
    lastError: lastError ? (lastError.message || String(lastError)) : null,
  };
}

async function safeDelete(client, table, id) {
  if (!id) return;
  try {
    await client.from(table).delete().eq('id', id);
  } catch {
    // no-op
  }
}

function randomTag(prefix = 'rt') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function runTablesScenario(ctx) {
  const tag = randomTag('mesa');
  const tableNumber = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
  let tableId = null;

  try {
    let insert = await ctx.mutationClient
      .from('tables')
      .insert([{ business_id: ctx.businessId, table_number: tableNumber, name: tag, status: 'available' }])
      .select('id,business_id,status')
      .maybeSingle();

    if (insert.error) {
      insert = await ctx.mutationClient
        .from('tables')
        .insert([{ business_id: ctx.businessId, table_number: tableNumber, status: 'available' }])
        .select('id,business_id,status')
        .maybeSingle();
    }

    if (insert.error || !insert.data?.id) throw new Error(insert.error?.message || 'insert tables failed');
    tableId = String(insert.data.id);

    const insertAt = nowMs();

    const update = await ctx.mutationClient
      .from('tables')
      .update({ status: 'occupied' })
      .eq('id', tableId)
      .eq('business_id', ctx.businessId)
      .select('id,status')
      .maybeSingle();

    if (update.error) throw new Error(update.error.message || 'update tables failed');
    const updateAt = nowMs();

    const del = await ctx.mutationClient
      .from('tables')
      .delete()
      .eq('id', tableId)
      .eq('business_id', ctx.businessId);

    if (del.error) throw new Error(del.error.message || 'delete tables failed');
    const deleteAt = nowMs();

    tableId = null;

    return {
      scenario: 'tables_crud',
      expected: [
        { table: 'tables', eventType: 'INSERT', recordId: String(insert.data.id), emittedAt: insertAt },
        { table: 'tables', eventType: 'UPDATE', recordId: String(update.data?.id || insert.data.id), emittedAt: updateAt },
        { table: 'tables', eventType: 'DELETE', recordId: String(insert.data.id), emittedAt: deleteAt },
      ],
      cleanup: async () => {
        if (tableId) await safeDelete(ctx.mutationClient, 'tables', tableId);
      },
    };
  } catch (error) {
    if (tableId) await safeDelete(ctx.mutationClient, 'tables', tableId);
    throw error;
  }
}

async function runProductsScenario(ctx) {
  const tag = randomTag('prd');
  let productId = null;

  try {
    const insert = await ctx.mutationClient
      .from('products')
      .insert([{
        business_id: ctx.businessId,
        code: `RT-${Date.now().toString().slice(-6)}`,
        name: `Realtime ${tag}`,
        category: 'Realtime Audit',
        purchase_price: 1000,
        sale_price: 1500,
        stock: 5,
        min_stock: 1,
        unit: 'unit',
        is_active: true,
        manage_stock: true,
      }])
      .select('id,business_id,stock')
      .maybeSingle();

    if (insert.error || !insert.data?.id) throw new Error(insert.error?.message || 'insert products failed');
    productId = String(insert.data.id);
    const insertAt = nowMs();

    const update = await ctx.mutationClient
      .from('products')
      .update({ stock: 7 })
      .eq('id', productId)
      .eq('business_id', ctx.businessId)
      .select('id,stock')
      .maybeSingle();

    if (update.error) throw new Error(update.error.message || 'update products failed');
    const updateAt = nowMs();

    const del = await ctx.mutationClient
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('business_id', ctx.businessId);

    if (del.error) throw new Error(del.error.message || 'delete products failed');
    const deleteAt = nowMs();
    productId = null;

    return {
      scenario: 'products_crud',
      expected: [
        { table: 'products', eventType: 'INSERT', recordId: String(insert.data.id), emittedAt: insertAt },
        { table: 'products', eventType: 'UPDATE', recordId: String(update.data?.id || insert.data.id), emittedAt: updateAt },
        { table: 'products', eventType: 'DELETE', recordId: String(insert.data.id), emittedAt: deleteAt },
      ],
      cleanup: async () => {
        if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
      },
    };
  } catch (error) {
    if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
    throw error;
  }
}

async function runOrdersAndItemsScenario(ctx) {
  const tableNumber = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 10)}`;
  let tableId = null;
  let orderId = null;
  let productId = null;
  let itemId = null;

  try {
    const tableInsert = await ctx.mutationClient
      .from('tables')
      .insert([{ business_id: ctx.businessId, table_number: tableNumber, status: 'occupied' }])
      .select('id')
      .maybeSingle();

    if (tableInsert.error || !tableInsert.data?.id) throw new Error(tableInsert.error?.message || 'seed table failed');
    tableId = String(tableInsert.data.id);

    const productInsert = await ctx.mutationClient
      .from('products')
      .insert([{
        business_id: ctx.businessId,
        code: `RTI-${Date.now().toString().slice(-6)}`,
        name: `Realtime Item ${randomTag('x')}`,
        category: 'Realtime Audit',
        purchase_price: 1000,
        sale_price: 2000,
        stock: 20,
        min_stock: 1,
        unit: 'unit',
        is_active: true,
        manage_stock: true,
      }])
      .select('id,sale_price')
      .maybeSingle();

    if (productInsert.error || !productInsert.data?.id) throw new Error(productInsert.error?.message || 'seed product failed');
    productId = String(productInsert.data.id);

    const orderInsert = await ctx.mutationClient
      .from('orders')
      .insert([{ business_id: ctx.businessId, table_id: tableId, user_id: ctx.ownerUserId, status: 'open', total: 0 }])
      .select('id,status')
      .maybeSingle();

    if (orderInsert.error || !orderInsert.data?.id) throw new Error(orderInsert.error?.message || 'insert order failed');
    orderId = String(orderInsert.data.id);
    const orderInsertAt = nowMs();

    let itemInsert = await ctx.mutationClient
      .from('order_items')
      .insert([{ order_id: orderId, product_id: productId, combo_id: null, quantity: 1, price: 2000, subtotal: 2000 }])
      .select('id,order_id,quantity')
      .maybeSingle();

    if (itemInsert.error && isCannotInsertProvidedColumnError(itemInsert.error, 'subtotal')) {
      itemInsert = await ctx.mutationClient
        .from('order_items')
        .insert([{ order_id: orderId, product_id: productId, combo_id: null, quantity: 1, price: 2000 }])
        .select('id,order_id,quantity')
        .maybeSingle();
    }

    if (itemInsert.error || !itemInsert.data?.id) throw new Error(itemInsert.error?.message || 'insert order_items failed');
    itemId = String(itemInsert.data.id);
    const itemInsertAt = nowMs();

    let itemUpdate = await ctx.mutationClient
      .from('order_items')
      .update({ quantity: 2, subtotal: 4000 })
      .eq('id', itemId)
      .select('id,quantity')
      .maybeSingle();

    if (itemUpdate.error && isCannotInsertProvidedColumnError(itemUpdate.error, 'subtotal')) {
      itemUpdate = await ctx.mutationClient
        .from('order_items')
        .update({ quantity: 2 })
        .eq('id', itemId)
        .select('id,quantity')
        .maybeSingle();
    }

    if (itemUpdate.error) throw new Error(itemUpdate.error.message || 'update order_items failed');
    const itemUpdateAt = nowMs();

    const orderUpdate = await ctx.mutationClient
      .from('orders')
      .update({ status: 'closed', total: 4000 })
      .eq('id', orderId)
      .eq('business_id', ctx.businessId)
      .select('id,status')
      .maybeSingle();

    if (orderUpdate.error) throw new Error(orderUpdate.error.message || 'update orders failed');
    const orderUpdateAt = nowMs();

    const itemDelete = await ctx.mutationClient
      .from('order_items')
      .delete()
      .eq('id', itemId);

    if (itemDelete.error) throw new Error(itemDelete.error.message || 'delete order_items failed');
    const itemDeleteAt = nowMs();

    itemId = null;

    await ctx.mutationClient
      .from('orders')
      .delete()
      .eq('id', orderId)
      .eq('business_id', ctx.businessId);

    orderId = null;

    await safeDelete(ctx.mutationClient, 'tables', tableId);
    tableId = null;

    await safeDelete(ctx.mutationClient, 'products', productId);
    productId = null;

    return {
      scenario: 'orders_and_order_items',
      expected: [
        { table: 'orders', eventType: 'INSERT', recordId: String(orderInsert.data.id), emittedAt: orderInsertAt },
        { table: 'order_items', eventType: 'INSERT', recordId: String(itemInsert.data.id), emittedAt: itemInsertAt },
        { table: 'order_items', eventType: 'UPDATE', recordId: String(itemUpdate.data?.id || itemInsert.data.id), emittedAt: itemUpdateAt },
        { table: 'orders', eventType: 'UPDATE', recordId: String(orderUpdate.data?.id || orderInsert.data.id), emittedAt: orderUpdateAt },
        { table: 'order_items', eventType: 'DELETE', recordId: String(itemInsert.data.id), emittedAt: itemDeleteAt },
      ],
      cleanup: async () => {
        if (itemId) await safeDelete(ctx.mutationClient, 'order_items', itemId);
        if (orderId) await safeDelete(ctx.mutationClient, 'orders', orderId);
        if (tableId) await safeDelete(ctx.mutationClient, 'tables', tableId);
        if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
      },
    };
  } catch (error) {
    if (itemId) await safeDelete(ctx.mutationClient, 'order_items', itemId);
    if (orderId) await safeDelete(ctx.mutationClient, 'orders', orderId);
    if (tableId) await safeDelete(ctx.mutationClient, 'tables', tableId);
    if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
    throw error;
  }
}

async function runSalesAndDetailsScenario(ctx) {
  let productId = null;
  let saleId = null;
  let detailId = null;

  try {
    const productInsert = await ctx.mutationClient
      .from('products')
      .insert([{
        business_id: ctx.businessId,
        code: `RTS-${Date.now().toString().slice(-6)}`,
        name: `Realtime Sale ${randomTag('p')}`,
        category: 'Realtime Audit',
        purchase_price: 1000,
        sale_price: 3000,
        stock: 30,
        min_stock: 1,
        unit: 'unit',
        is_active: true,
        manage_stock: true,
      }])
      .select('id')
      .maybeSingle();

    if (productInsert.error || !productInsert.data?.id) throw new Error(productInsert.error?.message || 'seed product for sales failed');
    productId = String(productInsert.data.id);

    const saleInsert = await ctx.mutationClient
      .from('sales')
      .insert([{
        business_id: ctx.businessId,
        user_id: ctx.ownerUserId,
        seller_name: ctx.ownerEmail || 'Realtime Owner',
        payment_method: 'cash',
        total: 3000,
        created_at: new Date().toISOString(),
      }])
      .select('id,total')
      .maybeSingle();

    if (saleInsert.error || !saleInsert.data?.id) throw new Error(saleInsert.error?.message || 'insert sale failed');
    saleId = String(saleInsert.data.id);
    const saleInsertAt = nowMs();

    let detailInsert = await ctx.mutationClient
      .from('sale_details')
      .insert([{ sale_id: saleId, product_id: productId, combo_id: null, quantity: 1, unit_price: 3000, subtotal: 3000 }])
      .select('id')
      .maybeSingle();

    if (detailInsert.error && isCannotInsertProvidedColumnError(detailInsert.error, 'subtotal')) {
      detailInsert = await ctx.mutationClient
        .from('sale_details')
        .insert([{ sale_id: saleId, product_id: productId, combo_id: null, quantity: 1, unit_price: 3000 }])
        .select('id')
        .maybeSingle();
    }

    if (detailInsert.error || !detailInsert.data?.id) throw new Error(detailInsert.error?.message || 'insert sale_details failed');
    detailId = String(detailInsert.data.id);
    const detailInsertAt = nowMs();

    const saleUpdate = await ctx.mutationClient
      .from('sales')
      .update({ total: 3000 })
      .eq('id', saleId)
      .eq('business_id', ctx.businessId)
      .select('id,total')
      .maybeSingle();

    if (saleUpdate.error) throw new Error(saleUpdate.error.message || 'update sale failed');
    const saleUpdateAt = nowMs();

    let detailUpdate = await ctx.mutationClient
      .from('sale_details')
      .update({ quantity: 1, subtotal: 3000 })
      .eq('id', detailId)
      .select('id,quantity')
      .maybeSingle();

    if (detailUpdate.error && isCannotInsertProvidedColumnError(detailUpdate.error, 'subtotal')) {
      detailUpdate = await ctx.mutationClient
        .from('sale_details')
        .update({ quantity: 1 })
        .eq('id', detailId)
        .select('id,quantity')
        .maybeSingle();
    }

    if (detailUpdate.error) throw new Error(detailUpdate.error.message || 'update sale_details failed');
    const detailUpdateAt = nowMs();

    await safeDelete(ctx.mutationClient, 'sale_details', detailId);
    const detailDeleteAt = nowMs();
    detailId = null;

    await safeDelete(ctx.mutationClient, 'sales', saleId);
    const saleDeleteAt = nowMs();
    saleId = null;

    await safeDelete(ctx.mutationClient, 'products', productId);
    productId = null;

    return {
      scenario: 'sales_and_sale_details',
      expected: [
        { table: 'sales', eventType: 'INSERT', recordId: String(saleInsert.data.id), emittedAt: saleInsertAt },
        { table: 'sale_details', eventType: 'INSERT', recordId: String(detailInsert.data.id), emittedAt: detailInsertAt },
        { table: 'sales', eventType: 'UPDATE', recordId: String(saleUpdate.data?.id || saleInsert.data.id), emittedAt: saleUpdateAt },
        { table: 'sale_details', eventType: 'UPDATE', recordId: String(detailUpdate.data?.id || detailInsert.data.id), emittedAt: detailUpdateAt },
        { table: 'sale_details', eventType: 'DELETE', recordId: String(detailInsert.data.id), emittedAt: detailDeleteAt },
        { table: 'sales', eventType: 'DELETE', recordId: String(saleInsert.data.id), emittedAt: saleDeleteAt },
      ],
      cleanup: async () => {
        if (detailId) await safeDelete(ctx.mutationClient, 'sale_details', detailId);
        if (saleId) await safeDelete(ctx.mutationClient, 'sales', saleId);
        if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
      },
    };
  } catch (error) {
    if (detailId) await safeDelete(ctx.mutationClient, 'sale_details', detailId);
    if (saleId) await safeDelete(ctx.mutationClient, 'sales', saleId);
    if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
    throw error;
  }
}

async function runCombosScenario(ctx) {
  let productId = null;
  let comboId = null;

  try {
    const productInsert = await ctx.mutationClient
      .from('products')
      .insert([{
        business_id: ctx.businessId,
        code: `RTC-${Date.now().toString().slice(-6)}`,
        name: `Realtime Combo Item ${randomTag('p')}`,
        category: 'Realtime Audit',
        purchase_price: 1000,
        sale_price: 2000,
        stock: 10,
        min_stock: 1,
        unit: 'unit',
        is_active: true,
        manage_stock: true,
      }])
      .select('id')
      .maybeSingle();

    if (productInsert.error || !productInsert.data?.id) throw new Error(productInsert.error?.message || 'seed product for combo failed');
    productId = String(productInsert.data.id);

    const comboInsert = await ctx.mutationClient
      .from('combos')
      .insert([{
        business_id: ctx.businessId,
        nombre: `Combo ${randomTag('x')}`,
        precio_venta: 5000,
        descripcion: 'Combo de prueba realtime',
        estado: 'active',
      }])
      .select('id,nombre')
      .maybeSingle();

    if (comboInsert.error || !comboInsert.data?.id) throw new Error(comboInsert.error?.message || 'insert combo failed');
    comboId = String(comboInsert.data.id);
    const comboInsertAt = nowMs();

    const comboItemInsert = await ctx.mutationClient
      .from('combo_items')
      .insert([{ combo_id: comboId, producto_id: productId, cantidad: 1 }]);

    if (comboItemInsert.error) throw new Error(comboItemInsert.error.message || 'insert combo_items failed');

    const comboUpdate = await ctx.mutationClient
      .from('combos')
      .update({ descripcion: 'Combo de prueba realtime (updated)' })
      .eq('id', comboId)
      .eq('business_id', ctx.businessId)
      .select('id,descripcion')
      .maybeSingle();

    if (comboUpdate.error) throw new Error(comboUpdate.error.message || 'update combo failed');
    const comboUpdateAt = nowMs();

    const comboDelete = await ctx.mutationClient
      .from('combos')
      .delete()
      .eq('id', comboId)
      .eq('business_id', ctx.businessId);

    if (comboDelete.error) throw new Error(comboDelete.error.message || 'delete combo failed');
    const comboDeleteAt = nowMs();

    comboId = null;
    await safeDelete(ctx.mutationClient, 'products', productId);
    productId = null;

    return {
      scenario: 'combos_crud',
      expected: [
        { table: 'combos', eventType: 'INSERT', recordId: String(comboInsert.data.id), emittedAt: comboInsertAt },
        { table: 'combos', eventType: 'UPDATE', recordId: String(comboUpdate.data?.id || comboInsert.data.id), emittedAt: comboUpdateAt },
        { table: 'combos', eventType: 'DELETE', recordId: String(comboInsert.data.id), emittedAt: comboDeleteAt },
      ],
      cleanup: async () => {
        if (comboId) await safeDelete(ctx.mutationClient, 'combos', comboId);
        if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
      },
    };
  } catch (error) {
    if (comboId) await safeDelete(ctx.mutationClient, 'combos', comboId);
    if (productId) await safeDelete(ctx.mutationClient, 'products', productId);
    throw error;
  }
}

async function runPurchasesScenario(ctx) {
  let supplierId = null;
  let purchaseId = null;

  try {
    const supplierInsert = await ctx.mutationClient
      .from('suppliers')
      .insert([{
        business_id: ctx.businessId,
        business_name: `Proveedor ${randomTag('rt')}`,
        contact_name: 'Realtime',
        created_at: new Date().toISOString(),
      }])
      .select('id')
      .maybeSingle();

    if (supplierInsert.error || !supplierInsert.data?.id) throw new Error(supplierInsert.error?.message || 'insert supplier failed');
    supplierId = String(supplierInsert.data.id);

    const purchaseInsert = await ctx.mutationClient
      .from('purchases')
      .insert([{
        business_id: ctx.businessId,
        user_id: ctx.ownerUserId,
        supplier_id: supplierId,
        payment_method: 'cash',
        notes: 'Realtime smoke test',
        total: 1000,
        created_at: new Date().toISOString(),
      }])
      .select('id,total')
      .maybeSingle();

    if (purchaseInsert.error || !purchaseInsert.data?.id) throw new Error(purchaseInsert.error?.message || 'insert purchase failed');
    purchaseId = String(purchaseInsert.data.id);
    const purchaseInsertAt = nowMs();

    const purchaseUpdate = await ctx.mutationClient
      .from('purchases')
      .update({ notes: 'Realtime smoke test updated' })
      .eq('id', purchaseId)
      .eq('business_id', ctx.businessId)
      .select('id')
      .maybeSingle();

    if (purchaseUpdate.error) throw new Error(purchaseUpdate.error.message || 'update purchase failed');
    const purchaseUpdateAt = nowMs();

    const purchaseDelete = await ctx.mutationClient
      .from('purchases')
      .delete()
      .eq('id', purchaseId)
      .eq('business_id', ctx.businessId);

    if (purchaseDelete.error) throw new Error(purchaseDelete.error.message || 'delete purchase failed');
    const purchaseDeleteAt = nowMs();

    purchaseId = null;
    await safeDelete(ctx.mutationClient, 'suppliers', supplierId);
    supplierId = null;

    return {
      scenario: 'purchases_crud',
      expected: [
        { table: 'purchases', eventType: 'INSERT', recordId: String(purchaseInsert.data.id), emittedAt: purchaseInsertAt },
        { table: 'purchases', eventType: 'UPDATE', recordId: String(purchaseUpdate.data?.id || purchaseInsert.data.id), emittedAt: purchaseUpdateAt },
        { table: 'purchases', eventType: 'DELETE', recordId: String(purchaseInsert.data.id), emittedAt: purchaseDeleteAt },
      ],
      cleanup: async () => {
        if (purchaseId) await safeDelete(ctx.mutationClient, 'purchases', purchaseId);
        if (supplierId) await safeDelete(ctx.mutationClient, 'suppliers', supplierId);
      },
    };
  } catch (error) {
    if (purchaseId) await safeDelete(ctx.mutationClient, 'purchases', purchaseId);
    if (supplierId) await safeDelete(ctx.mutationClient, 'suppliers', supplierId);
    throw error;
  }
}

async function runEmployeesScenario(ctx) {
  const pickEmployee = await ctx.mutationClient
    .from('employees')
    .select('id,business_id,full_name')
    .eq('business_id', ctx.businessId)
    .eq('user_id', ctx.employeeUserId)
    .maybeSingle();

  if (pickEmployee.error || !pickEmployee.data?.id) {
    return {
      scenario: 'employees_probe',
      expected: [],
      skipped: true,
      reason: pickEmployee.error?.message || 'No se encontro un empleado asociado al usuario de prueba',
      cleanup: async () => {},
    };
  }

  const rowId = String(pickEmployee.data.id);
  const update = await ctx.mutationClient
    .from('employees')
    .update({ full_name: pickEmployee.data.full_name })
    .eq('id', rowId)
    .eq('business_id', ctx.businessId)
    .select('id')
    .maybeSingle();

  if (update.error) {
    return {
      scenario: 'employees_probe',
      expected: [],
      skipped: true,
      reason: update.error.message,
      cleanup: async () => {},
    };
  }

  const emittedAt = nowMs();
  return {
    scenario: 'employees_probe',
    expected: [
      { table: 'employees', eventType: 'UPDATE', recordId: rowId, emittedAt },
    ],
    cleanup: async () => {},
  };
}

async function runScenarioAndValidate({
  scenarioRunner,
  scenarioName,
  ctx,
  collector,
  outsiderEnabled,
}) {
  const result = {
    scenario: null,
    status: 'PASS',
    failures: [],
    assertions: [],
    latencies_ms: [],
    skipped: false,
    skip_reason: null,
  };

  let scenario = null;
  try {
    scenario = await scenarioRunner(ctx);
    result.scenario = scenario?.scenario || scenarioName || scenarioRunner.name || 'unknown';

    if (scenario?.skipped) {
      result.status = 'SKIPPED';
      result.skipped = true;
      result.skip_reason = scenario.reason || 'Scenario skipped by runner';
      return result;
    }

    for (const expected of scenario.expected || []) {
      const afterMs = Math.max(0, Number(expected.emittedAt || 0) - DEFAULT_EVENT_LOOKBACK_MS);
      const [ownerEvent, employeeEvent, outsiderEvent] = await Promise.all([
        collector.waitFor({
          actor: 'owner',
          table: expected.table,
          eventType: expected.eventType,
          recordId: expected.recordId,
          afterMs,
          timeoutMs: DEFAULT_EVENT_TIMEOUT_MS,
        }),
        collector.waitFor({
          actor: 'employee',
          table: expected.table,
          eventType: expected.eventType,
          recordId: expected.recordId,
          afterMs,
          timeoutMs: DEFAULT_EVENT_TIMEOUT_MS,
        }),
        outsiderEnabled
          ? collector.waitFor({
            actor: 'outsider',
            table: expected.table,
            eventType: expected.eventType,
            recordId: expected.recordId,
            afterMs,
            timeoutMs: 2000,
          })
          : Promise.resolve(null),
      ]);

      const ownerOk = Boolean(ownerEvent);
      const employeeOk = Boolean(employeeEvent);
      const outsiderReceived = Boolean(outsiderEvent);

      const assertion = {
        table: expected.table,
        event: expected.eventType,
        record_id: expected.recordId,
        owner_ok: ownerOk,
        employee_ok: employeeOk,
        outsider_received: outsiderReceived,
      };

      if (ownerEvent) result.latencies_ms.push(ownerEvent.receivedAt - expected.emittedAt);
      if (employeeEvent) result.latencies_ms.push(employeeEvent.receivedAt - expected.emittedAt);

      if (!ownerOk || !employeeOk || outsiderReceived) {
        result.status = 'FAIL';
        const classification = classifyFailure({ ownerOk, employeeOk, outsiderReceived });
        result.failures.push({
          ...assertion,
          classification,
          message: `Evento ${expected.table}.${expected.eventType} no cumplio matriz de recepcion`,
        });
      }

      result.assertions.push(assertion);
    }

    if (!Array.isArray(scenario.expected) || scenario.expected.length === 0) {
      result.status = result.status === 'FAIL' ? 'FAIL' : 'SKIPPED';
      result.skipped = true;
      result.skip_reason = 'No se definieron eventos esperados para el escenario';
    }
  } catch (error) {
    result.status = 'FAIL';
    result.failures.push({
      table: null,
      event: null,
      classification: {
        type: 'filtro/config_roto',
        severity: 'critical',
      },
      message: error instanceof Error ? error.message : String(error || 'Error desconocido en escenario'),
    });
  } finally {
    try {
      if (scenario && typeof scenario.cleanup === 'function') {
        await scenario.cleanup();
      }
    } catch {
      // no-op
    }
  }

  return result;
}

function summarizeByTable({ scenarioResults, channelStatus }) {
  const byTable = new Map();

  CRITICAL_TABLES.forEach((table) => {
    byTable.set(table, {
      table,
      status: 'SKIPPED',
      assertions_total: 0,
      assertions_passed: 0,
      failures: [],
      latencies_ms: [],
      channels: channelStatus.filter((row) => row.table === table),
    });
  });

  for (const scenario of scenarioResults) {
    for (const assertion of scenario.assertions || []) {
      const row = byTable.get(assertion.table);
      if (!row) continue;

      row.assertions_total += 1;
      const passed = assertion.owner_ok && assertion.employee_ok && !assertion.outsider_received;
      if (passed) row.assertions_passed += 1;
    }

    for (const failure of scenario.failures || []) {
      const tables = failure.table ? [failure.table] : CRITICAL_TABLES;
      tables.forEach((table) => {
        const row = byTable.get(table);
        if (!row) return;
        row.failures.push(failure);
      });
    }

    for (const latency of scenario.latencies_ms || []) {
      if (!Number.isFinite(latency)) continue;
      const touchedTables = new Set((scenario.assertions || []).map((item) => item.table).filter(Boolean));
      touchedTables.forEach((table) => {
        const row = byTable.get(table);
        if (row) row.latencies_ms.push(latency);
      });
    }
  }

  return Array.from(byTable.values()).map((row) => {
    const hasChannelFailure = row.channels.some((channel) => !channel.subscribed);
    const hasAssertion = row.assertions_total > 0;

    let status = 'SKIPPED';
    if (row.failures.length > 0 || hasChannelFailure) status = 'FAIL';
    else if (hasAssertion && row.assertions_passed === row.assertions_total) status = 'PASS';

    return {
      table: row.table,
      status,
      assertions_total: row.assertions_total,
      assertions_passed: row.assertions_passed,
      channel_subscriptions: row.channels,
      latencies: {
        samples: row.latencies_ms.length,
        p50_ms: percentile(row.latencies_ms, 50),
        p95_ms: percentile(row.latencies_ms, 95),
      },
      failures: row.failures,
    };
  });
}

async function main() {
  const outArg = parseArg('--out', path.join('testing', 'realtime', 'results', 'realtime-smoke-report.json'));
  const outputPath = normalizePath(outArg);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const businessId = process.env.REALTIME_TEST_BUSINESS_ID || '';

  const ownerEmail = process.env.REALTIME_OWNER_EMAIL || '';
  const ownerPassword = process.env.REALTIME_OWNER_PASSWORD || '';
  const employeeEmail = process.env.REALTIME_EMPLOYEE_EMAIL || '';
  const employeePassword = process.env.REALTIME_EMPLOYEE_PASSWORD || '';
  const outsiderEmail = process.env.REALTIME_OUTSIDER_EMAIL || '';
  const outsiderPassword = process.env.REALTIME_OUTSIDER_PASSWORD || '';

  if (!supabaseUrl || !anonKey) {
    process.stderr.write('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.\n');
    process.exit(1);
  }

  if (!businessId) {
    process.stderr.write('Missing REALTIME_TEST_BUSINESS_ID.\n');
    process.exit(1);
  }

  if (!ownerEmail || !ownerPassword || !employeeEmail || !employeePassword) {
    process.stderr.write('Missing REALTIME_OWNER_* or REALTIME_EMPLOYEE_* credentials.\n');
    process.exit(1);
  }

  const ownerClient = createRealtimeClient({ url: supabaseUrl, key: anonKey });
  const employeeClient = createRealtimeClient({ url: supabaseUrl, key: anonKey });
  const outsiderEnabled = Boolean(outsiderEmail && outsiderPassword);
  const outsiderClient = outsiderEnabled ? createRealtimeClient({ url: supabaseUrl, key: anonKey }) : null;

  const mutationClient = serviceRoleKey
    ? createRealtimeClient({ url: supabaseUrl, key: serviceRoleKey })
    : ownerClient;

  const collector = new EventCollector();

  const ownerSession = await signInClient(ownerClient, { email: ownerEmail, password: ownerPassword, label: 'owner' });
  const employeeSession = await signInClient(employeeClient, { email: employeeEmail, password: employeePassword, label: 'employee' });
  if (outsiderEnabled && outsiderClient) {
    await signInClient(outsiderClient, { email: outsiderEmail, password: outsiderPassword, label: 'outsider' });
  }

  const actors = [
    { actor: 'owner', client: ownerClient },
    { actor: 'employee', client: employeeClient },
  ];

  if (outsiderEnabled && outsiderClient) {
    actors.push({ actor: 'outsider', client: outsiderClient });
  }

  const subscriptions = [];
  for (const actorEntry of actors) {
    for (const table of CRITICAL_TABLES) {
      const sub = await subscribeActorTable({
        client: actorEntry.client,
        actor: actorEntry.actor,
        table,
        businessId,
        collector,
      });
      subscriptions.push(sub);
    }
  }

  const scenarioRunners = [
    runTablesScenario,
    runProductsScenario,
    runOrdersAndItemsScenario,
    runSalesAndDetailsScenario,
    runCombosScenario,
    runPurchasesScenario,
    runEmployeesScenario,
  ];

  const context = {
    businessId,
    ownerUserId: ownerSession.userId,
    ownerEmail: ownerSession.email,
    employeeUserId: employeeSession.userId,
    mutationClient,
    ownerClient,
    employeeClient,
  };

  const scenarioResults = [];
  for (const runner of scenarioRunners) {
    const scenarioResult = await runScenarioAndValidate({
      scenarioRunner: runner,
      scenarioName: runner.name,
      ctx: context,
      collector,
      outsiderEnabled,
    });
    scenarioResults.push(scenarioResult);
  }

  await sleep(350);

  const channelStatus = subscriptions.map((sub) => ({
    actor: sub.actor,
    table: sub.table,
    subscribed: sub.subscribed,
    status: sub.status,
    error: sub.lastError,
    filter: sub.filter || null,
  }));

  for (const sub of subscriptions) {
    try {
      if (sub?.channel) {
        await sub.channel.unsubscribe();
      }
    } catch {
      // no-op
    }
  }

  for (const actorEntry of actors) {
    try {
      await actorEntry.client.removeAllChannels();
    } catch {
      // no-op
    }
    try {
      await actorEntry.client.auth.signOut();
    } catch {
      // no-op
    }
  }

  const tableMatrix = summarizeByTable({ scenarioResults, channelStatus });
  const allLatencies = scenarioResults.flatMap((row) => row.latencies_ms || []).filter((value) => Number.isFinite(value));

  const findings = [];
  tableMatrix.forEach((row) => {
    if (row.status === 'FAIL') {
      const hasChannelFailure = row.channel_subscriptions.some((sub) => !sub.subscribed);
      if (hasChannelFailure) {
        findings.push({
          type: 'filtro/config_roto',
          severity: 'critical',
          table: row.table,
          message: 'Canal realtime no logró suscribirse en al menos un actor.',
        });
      }

      row.failures.forEach((failure) => {
        findings.push({
          type: failure.classification?.type || 'realtime_roto',
          severity: failure.classification?.severity || 'high',
          table: row.table,
          message: failure.message,
          evidence: {
            event: failure.event,
            owner_ok: failure.owner_ok,
            employee_ok: failure.employee_ok,
            outsider_received: failure.outsider_received,
          },
        });
      });
    }

    if (row.status === 'PASS' && row.latencies.p95_ms !== null && row.latencies.p95_ms > 1500) {
      findings.push({
        type: 'sincronizacion_lenta_por_polling',
        severity: 'medium',
        table: row.table,
        message: `Latencia p95 alta (${row.latencies.p95_ms} ms).`,
      });
    }
  });

  const reportStatus = tableMatrix.some((row) => row.status === 'FAIL') ? 'FAIL' : 'PASS';

  const report = {
    generated_at: new Date().toISOString(),
    status: reportStatus,
    scope: 'web+mobile+db-smoke',
    assumptions: {
      business_id: businessId,
      outsider_validation_enabled: outsiderEnabled,
      mutation_client: serviceRoleKey ? 'service_role' : 'owner_session',
      note: 'Mobile usa modelo mixto (polling + locks), no solo canales realtime.',
    },
    channels: {
      total: channelStatus.length,
      subscribed: channelStatus.filter((row) => row.subscribed).length,
      failed: channelStatus.filter((row) => !row.subscribed).length,
      details: channelStatus,
    },
    latency_summary: {
      samples: allLatencies.length,
      p50_ms: percentile(allLatencies, 50),
      p95_ms: percentile(allLatencies, 95),
    },
    scenario_results: scenarioResults,
    table_matrix: tableMatrix,
    findings,
  };

  ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(`Realtime smoke report generated: ${path.relative(repoRoot, outputPath)}\n`);
  process.stdout.write(`Status: ${report.status} | Findings: ${findings.length}\n`);

  if (report.status === 'FAIL') process.exit(2);
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write(`Realtime smoke failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
