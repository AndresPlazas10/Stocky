function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseNumberEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const LOCAL_SYNC_CONFIG = {
  enabled: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, false),
  devtoolsEnabled: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_DEVTOOLS, false),
  preferPGlite: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_PREFER_PGLITE, true),
  electricPullEnabled: parseBooleanEnv(import.meta.env.VITE_ELECTRIC_PULL_ENABLED, false),
  shadowWritesEnabled: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_SHADOW_WRITES, true),
  outboxRemoteVerifyEnabled: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_VERIFY_REMOTE, false),
  outboxPollMs: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_POLL_MS, 1500),
  outboxBatchSize: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_BATCH_SIZE, 20),
  outboxMaxEventsPerTick: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_MAX_EVENTS_PER_TICK, 200),
  outboxMaxRetries: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_MAX_RETRIES, 5),
  outboxRateWindowSize: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_SIZE, 100),
  outboxRateWindowMinutes: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_MINUTES, 15),
  localReadCacheTtlMs: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_READ_CACHE_TTL_MS, 30000),
  localWrites: {
    allLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_ALL, false),
    sales: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_SALES, false),
    salesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_SALES, false),
    purchases: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_PURCHASES, false),
    purchasesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_PURCHASES, false),
    orders: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_ORDERS, false),
    ordersLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_ORDERS, false),
    tables: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_TABLES, false),
    tablesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_TABLES, false),
    products: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_PRODUCTS, false),
    productsLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_PRODUCTS, false),
    suppliers: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_SUPPLIERS, false),
    suppliersLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_SUPPLIERS, false),
    invoices: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_INVOICES, false),
    invoicesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_INVOICES, false)
  },
  localReads: {
    // Si local-sync está activo y una flag específica no existe en el entorno,
    // habilitamos lectura local por defecto para evitar UI vacía en offline.
    products: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_PRODUCTS, parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, false)),
    sales: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_SALES, parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, false)),
    purchases: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_PURCHASES, parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, false)),
    orders: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_ORDERS, parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, false)),
    inventory: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_INVENTORY, parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, false)),
    invoices: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_INVOICES, parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, false))
  }
};

export default LOCAL_SYNC_CONFIG;
