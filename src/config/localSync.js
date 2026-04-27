function resolveEnv() {
  if (typeof import.meta !== 'undefined' && import.meta?.env) {
    return import.meta.env;
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env;
  }
  return {};
}

function envBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function envNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const ENV = resolveEnv();

// Modo seguro por defecto: online-only.
// Se activa progresivamente por variables VITE_LOCAL_SYNC_*.
export const LOCAL_SYNC_CONFIG = {
  enabled: envBoolean(ENV.VITE_LOCAL_SYNC_ENABLED, false),
  devtoolsEnabled: envBoolean(ENV.VITE_LOCAL_SYNC_DEVTOOLS_ENABLED, false),
  preferPGlite: envBoolean(ENV.VITE_LOCAL_SYNC_PREFER_PGLITE, false),
  electricPullEnabled: envBoolean(ENV.VITE_LOCAL_SYNC_ELECTRIC_PULL_ENABLED, false),
  shadowWritesEnabled: envBoolean(ENV.VITE_LOCAL_SYNC_SHADOW_WRITES_ENABLED, false),
  outboxRemoteVerifyEnabled: envBoolean(ENV.VITE_LOCAL_SYNC_OUTBOX_REMOTE_VERIFY_ENABLED, false),
  outboxPollMs: envNumber(ENV.VITE_LOCAL_SYNC_OUTBOX_POLL_MS, 1500),
  outboxBatchSize: envNumber(ENV.VITE_LOCAL_SYNC_OUTBOX_BATCH_SIZE, 20),
  outboxMaxEventsPerTick: envNumber(ENV.VITE_LOCAL_SYNC_OUTBOX_MAX_EVENTS_PER_TICK, 200),
  outboxMaxRetries: envNumber(ENV.VITE_LOCAL_SYNC_OUTBOX_MAX_RETRIES, 5),
  outboxRateWindowSize: envNumber(ENV.VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_SIZE, 100),
  outboxRateWindowMinutes: envNumber(ENV.VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_MINUTES, 15),
  criticalAlertConsecutiveThreshold: Math.max(1, Math.round(envNumber(ENV.VITE_LOCAL_SYNC_CRITICAL_ALERT_CONSECUTIVE_THRESHOLD, 3))),
  criticalAlertCooldownMinutes: Math.max(0, envNumber(ENV.VITE_LOCAL_SYNC_CRITICAL_ALERT_COOLDOWN_MINUTES, 15)),
  catalogCacheEnabled: envBoolean(ENV.VITE_LOCAL_SYNC_CATALOG_CACHE_ENABLED, true),
  localReadCacheTtlMs: envNumber(ENV.VITE_LOCAL_SYNC_READ_CACHE_TTL_MS, 30000),
  localWrites: {
    allLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_ALL_LOCAL_FIRST, false),
    sales: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_SALES_ENABLED, false),
    salesLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_SALES_LOCAL_FIRST, false),
    purchases: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_PURCHASES_ENABLED, false),
    purchasesLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_PURCHASES_LOCAL_FIRST, false),
    orders: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_ORDERS_ENABLED, false),
    ordersLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_ORDERS_LOCAL_FIRST, false),
    tables: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_TABLES_ENABLED, false),
    tablesLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_TABLES_LOCAL_FIRST, false),
    products: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_PRODUCTS_ENABLED, false),
    productsLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_PRODUCTS_LOCAL_FIRST, false),
    suppliers: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_SUPPLIERS_ENABLED, false),
    suppliersLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_SUPPLIERS_LOCAL_FIRST, false),
    invoices: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_INVOICES_ENABLED, false),
    invoicesLocalFirst: envBoolean(ENV.VITE_LOCAL_SYNC_WRITE_INVOICES_LOCAL_FIRST, false)
  },
  localReads: {
    products: envBoolean(ENV.VITE_LOCAL_SYNC_READ_PRODUCTS_ENABLED, false),
    sales: envBoolean(ENV.VITE_LOCAL_SYNC_READ_SALES_ENABLED, false),
    purchases: envBoolean(ENV.VITE_LOCAL_SYNC_READ_PURCHASES_ENABLED, false),
    orders: envBoolean(ENV.VITE_LOCAL_SYNC_READ_ORDERS_ENABLED, false),
    inventory: envBoolean(ENV.VITE_LOCAL_SYNC_READ_INVENTORY_ENABLED, false),
    invoices: envBoolean(ENV.VITE_LOCAL_SYNC_READ_INVOICES_ENABLED, false)
  }
};

export default LOCAL_SYNC_CONFIG;
