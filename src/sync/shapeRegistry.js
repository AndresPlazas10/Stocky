import { LOCAL_SYNC_CONFIG } from '../config/localSync.js';

function resolveSyncWindowDays() {
  const fallbackDays = 30;
  const raw =
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_LOCAL_SYNC_SHAPE_WINDOW_DAYS)
    || (typeof process !== 'undefined' && process?.env?.VITE_LOCAL_SYNC_SHAPE_WINDOW_DAYS)
    || fallbackDays;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackDays;
}

export function buildShapeRegistry({ businessId } = {}) {
  const normalizedBusinessId = String(businessId || '').trim();
  const windowDays = resolveSyncWindowDays();

  if (!normalizedBusinessId) return [];

  return [
    {
      key: 'products',
      table: 'products',
      businessId: normalizedBusinessId,
      mode: 'full',
      enabled: true
    },
    {
      key: 'combos',
      table: 'combos',
      businessId: normalizedBusinessId,
      mode: 'full',
      enabled: true
    },
    {
      key: 'customers',
      table: 'customers',
      businessId: normalizedBusinessId,
      mode: 'full',
      enabled: true
    },
    {
      key: 'suppliers',
      table: 'suppliers',
      businessId: normalizedBusinessId,
      mode: 'full',
      enabled: true
    },
    {
      key: 'orders',
      table: 'orders',
      businessId: normalizedBusinessId,
      mode: 'window',
      windowDays,
      enabled: true
    },
    {
      key: 'order_items',
      table: 'order_items',
      businessId: normalizedBusinessId,
      mode: 'window',
      windowDays,
      cursorColumn: 'created_at',
      enabled: true
    },
    {
      key: 'tables',
      table: 'tables',
      businessId: normalizedBusinessId,
      mode: 'full',
      enabled: true
    },
    {
      key: 'sales',
      table: 'sales',
      businessId: normalizedBusinessId,
      mode: 'window',
      windowDays,
      enabled: true
    },
    {
      key: 'purchases',
      table: 'purchases',
      businessId: normalizedBusinessId,
      mode: 'window',
      windowDays,
      enabled: true
    },
    {
      key: 'invoices',
      table: 'invoices',
      businessId: normalizedBusinessId,
      mode: 'window',
      windowDays,
      enabled: true
    }
  ];
}

export function listEnabledShapes({ businessId } = {}) {
  if (!LOCAL_SYNC_CONFIG.electricPullEnabled) return [];
  return buildShapeRegistry({ businessId }).filter((shape) => shape.enabled !== false);
}

export default {
  buildShapeRegistry,
  listEnabledShapes
};
