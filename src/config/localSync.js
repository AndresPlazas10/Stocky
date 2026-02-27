// Rollback definitivo a modo online-only.
// Mantener la forma del objeto evita romper imports existentes.
export const LOCAL_SYNC_CONFIG = {
  enabled: false,
  devtoolsEnabled: false,
  preferPGlite: false,
  electricPullEnabled: false,
  shadowWritesEnabled: false,
  outboxRemoteVerifyEnabled: false,
  outboxPollMs: 1500,
  outboxBatchSize: 20,
  outboxMaxEventsPerTick: 200,
  outboxMaxRetries: 5,
  outboxRateWindowSize: 100,
  outboxRateWindowMinutes: 15,
  localReadCacheTtlMs: 30000,
  localWrites: {
    allLocalFirst: false,
    sales: false,
    salesLocalFirst: false,
    purchases: false,
    purchasesLocalFirst: false,
    orders: false,
    ordersLocalFirst: false,
    tables: false,
    tablesLocalFirst: false,
    products: false,
    productsLocalFirst: false,
    suppliers: false,
    suppliersLocalFirst: false,
    invoices: false,
    invoicesLocalFirst: false
  },
  localReads: {
    products: false,
    sales: false,
    purchases: false,
    orders: false,
    inventory: false,
    invoices: false
  }
};

export default LOCAL_SYNC_CONFIG;
