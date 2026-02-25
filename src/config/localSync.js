function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseNumberEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const localSyncEnabled = parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_ENABLED, true);
const localWritesDefaultEnabled = localSyncEnabled;

export const LOCAL_SYNC_CONFIG = {
  enabled: localSyncEnabled,
  devtoolsEnabled: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_DEVTOOLS, false),
  preferPGlite: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_PREFER_PGLITE, true),
  electricPullEnabled: parseBooleanEnv(import.meta.env.VITE_ELECTRIC_PULL_ENABLED, false),
  shadowWritesEnabled: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_SHADOW_WRITES, true),
  outboxRemoteVerifyEnabled: parseBooleanEnv(import.meta.env.VITE_LOCAL_SYNC_VERIFY_REMOTE, false),
  outboxPollMs: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_POLL_MS, 4000),
  outboxBatchSize: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_BATCH_SIZE, 20),
  outboxMaxRetries: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_MAX_RETRIES, 5),
  outboxRateWindowSize: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_SIZE, 100),
  outboxRateWindowMinutes: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_MINUTES, 15),
  localReadCacheTtlMs: parseNumberEnv(import.meta.env.VITE_LOCAL_SYNC_READ_CACHE_TTL_MS, 30000),
  localWrites: {
    allLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_ALL, false),
    sales: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_SALES, localWritesDefaultEnabled),
    salesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_SALES, localWritesDefaultEnabled),
    purchases: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_PURCHASES, localWritesDefaultEnabled),
    purchasesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_PURCHASES, localWritesDefaultEnabled),
    orders: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_ORDERS, localWritesDefaultEnabled),
    ordersLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_ORDERS, localWritesDefaultEnabled),
    tables: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_TABLES, localWritesDefaultEnabled),
    tablesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_TABLES, localWritesDefaultEnabled),
    products: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_PRODUCTS, localWritesDefaultEnabled),
    productsLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_PRODUCTS, localWritesDefaultEnabled),
    suppliers: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_SUPPLIERS, localWritesDefaultEnabled),
    suppliersLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_SUPPLIERS, localWritesDefaultEnabled),
    invoices: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_WRITE_INVOICES, localWritesDefaultEnabled),
    invoicesLocalFirst: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_FIRST_INVOICES, localWritesDefaultEnabled)
  },
  localReads: {
    // Si local-sync está activo y una flag específica no existe en el entorno,
    // habilitamos lectura local por defecto para evitar UI vacía en offline.
    products: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_PRODUCTS, localSyncEnabled),
    sales: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_SALES, localSyncEnabled),
    purchases: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_PURCHASES, localSyncEnabled),
    orders: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_ORDERS, localSyncEnabled),
    inventory: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_INVENTORY, localSyncEnabled),
    invoices: parseBooleanEnv(import.meta.env.VITE_FF_LOCAL_READ_INVOICES, localSyncEnabled)
  }
};

export default LOCAL_SYNC_CONFIG;
