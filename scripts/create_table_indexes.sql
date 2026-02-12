-- scripts/create_table_indexes.sql
-- Índices recomendados para operaciones rápidas de abrir/cerrar mesa

-- Índice compuesto para búsquedas por tenant y id (rápido lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tables_tenant_id_id ON tables (tenant_id, id);

-- Índice parcial para mesas abiertas (si 'open' es un estado frecuente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tables_open_partial ON tables (tenant_id) WHERE status = 'open';

-- Índice para queries ordenadas por updated_at (si se usa lista ordenada)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tables_updated_at ON tables (tenant_id, updated_at);

-- Recomendación: ejecutar ANALYZE después de crear índices
-- ANALYZE tables;
