-- Stocky local-first schema bootstrap (Fase B)
-- Nota: este esquema inicia por tablas de sync/control.

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  mutation_type TEXT NOT NULL,
  mutation_id TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  base_versions TEXT,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  ack_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created
ON outbox_events(status, created_at);

CREATE TABLE IF NOT EXISTS sync_state (
  shape_key TEXT PRIMARY KEY,
  cursor TEXT,
  lsn TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conflict_log (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  mutation_type TEXT,
  mutation_id TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,
  event_id TEXT,
  mutation_type TEXT,
  duration_ms REAL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_type_created
ON sync_metrics(metric_type, created_at DESC);
