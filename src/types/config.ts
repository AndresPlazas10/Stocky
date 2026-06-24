export interface LocalWritesConfig {
  allLocalFirst: boolean;
  sales: boolean;
  salesLocalFirst: boolean;
  purchases: boolean;
  purchasesLocalFirst: boolean;
  orders: boolean;
  ordersLocalFirst: boolean;
  tables: boolean;
  tablesLocalFirst: boolean;
  products: boolean;
  productsLocalFirst: boolean;
  suppliers: boolean;
  suppliersLocalFirst: boolean;
  invoices: boolean;
  invoicesLocalFirst: boolean;
}

export interface LocalReadsConfig {
  products: boolean;
  sales: boolean;
  purchases: boolean;
  orders: boolean;
  inventory: boolean;
  invoices: boolean;
}

export interface LocalSyncConfig {
  enabled: boolean;
  devtoolsEnabled: boolean;
  preferPGlite: boolean;
  electricPullEnabled: boolean;
  shadowWritesEnabled: boolean;
  outboxRemoteVerifyEnabled: boolean;
  outboxPollMs: number;
  outboxBatchSize: number;
  outboxMaxEventsPerTick: number;
  outboxMaxRetries: number;
  outboxRateWindowSize: number;
  outboxRateWindowMinutes: number;
  criticalAlertConsecutiveThreshold: number;
  criticalAlertCooldownMinutes: number;
  catalogCacheEnabled: boolean;
  localReadCacheTtlMs: number;
  localWrites: LocalWritesConfig;
  localReads: LocalReadsConfig;
}
