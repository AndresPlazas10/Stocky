-- Fase B (scaffold): esquema mínimo local-first
-- Nota: este archivo define la estructura objetivo para SQLite/PGlite.
-- Aún no reemplaza la ruta productiva actual basada en snapshots/outbox de localStorage.

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  mutation_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE,
  base_versions TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|syncing|acked|rejected
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created
  ON outbox_events(status, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_events_business_status
  ON outbox_events(business_id, status);

CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  shape_key TEXT NOT NULL,
  cursor_value TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, shape_key)
);

CREATE TABLE IF NOT EXISTS conflict_log (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  mutation_id TEXT,
  conflict_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conflict_log_business_created
  ON conflict_log(business_id, created_at);

-- Espejo mínimo (ventas) para iteración inicial de migración
CREATE TABLE IF NOT EXISTS local_sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT,
  payment_method TEXT,
  total REAL NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_sales_business_created
  ON local_sales(business_id, created_at DESC);
