# Migraciones BD para Aplicar al Final

Este archivo lista las migraciones de base de datos pendientes de este plan, en el orden exacto en que deben aplicarse al cierre.

## Orden

1. `20260306_0100_create_open_close_table_transaction_rpc.sql`
2. `20260309_2355_add_context_and_tables_performance_indexes.sql`
3. `20260310_0010_create_list_open_order_snapshot_rpc.sql`
4. `20260310_0040_create_inventory_and_purchases_snapshot_rpcs.sql`
5. `20260310_0100_create_list_recent_sales_mobile_rpc.sql`
6. `20260310_0135_optimize_mesas_and_purchases_rpcs.sql`
7. `20260310_0200_add_fast_mesas_snapshot_rpcs.sql`
8. `20260310_0215_add_fast_recent_purchases_rpc.sql`
9. `20260310_0225_add_fast_inventory_products_rpc.sql`
10. `20260310_0235_optimize_fast_mesas_summary_without_units.sql`
11. `20260310_0245_optimize_open_close_table_transaction_latency.sql`
12. `20260310_0310_create_mobile_push_tokens_table.sql`

## Nota

- No aplicar estas migraciones durante pruebas intermedias si queremos mantener compatibilidad con el fallback del API.
- Aplicarlas justo antes del cierre final a producción.
