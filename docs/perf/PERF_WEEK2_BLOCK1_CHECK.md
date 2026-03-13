# Performance Baseline - Semana 1

Fecha: 2026-03-09T19:52:41.694Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 9
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 478.4ms | 666.1ms | 666.1ms | OK (<900ms) |
| resolve_business_context_employee | 477.1ms | 563.1ms | 563.1ms | OK (<900ms) |
| mesas_initial_load | 163.1ms | 210.1ms | 210.1ms | OK (<900ms) |
| mesa_open_order_load | 162.0ms | 196.0ms | 196.0ms | OK (<900ms) |
| ventas_initial_load | 166.5ms | 202.8ms | 202.8ms | OK (<900ms) |
| compras_initial_load | 163.5ms | 210.5ms | 210.5ms | OK (<900ms) |
| inventario_initial_load | 158.1ms | 181.4ms | 181.4ms | OK (<900ms) |
| empleados_load | 161.0ms | 192.3ms | 192.3ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | resolve_business_context_owner | 666.1ms | 499.5ms |
| 2 | query | mesas.tables_summary_rpc | 583.2ms | 206.0ms |
| 3 | operation | resolve_business_context_employee | 563.1ms | 486.7ms |
| 4 | query | ventas.sales_recent_with_cash_meta | 387.5ms | 185.2ms |
| 5 | query | compras.purchases_recent_with_supplier | 312.4ms | 177.6ms |
| 6 | query | context.resolve_mobile_business_context_rpc | 303.8ms | 237.8ms |
| 7 | query | context.tables_count_by_business | 294.5ms | 249.2ms |
| 8 | query | inventario.products_full | 257.5ms | 168.8ms |
| 9 | operation | compras_initial_load | 210.5ms | 170.1ms |
| 10 | query | compras.first_purchase_day | 210.3ms | 160.8ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Reducir joins/mapeos N+1 en compras/inventario consolidando proveedores en RPC enriquecido por pantalla.
2. Separar carga inicial de ventas en “first paint” (sales list) y “background” (catalogo/first day) para bajar TTI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

