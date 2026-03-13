# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:52:32.786Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 157.5ms | 189.6ms | 189.6ms | OK (<900ms) |
| resolve_business_context_employee | 154.0ms | 173.6ms | 173.6ms | OK (<900ms) |
| mesas_initial_load | 153.3ms | 443.3ms | 443.3ms | OK (<900ms) |
| mesa_open_order_load | 147.4ms | 175.9ms | 175.9ms | OK (<900ms) |
| ventas_initial_load | 150.4ms | 163.4ms | 163.4ms | OK (<900ms) |
| compras_initial_load | 145.9ms | 157.2ms | 157.2ms | OK (<900ms) |
| inventario_initial_load | 149.1ms | 250.7ms | 250.7ms | OK (<900ms) |
| empleados_load | 154.8ms | 200.6ms | 200.6ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | mesas_initial_load | 443.3ms | 177.1ms |
| 2 | query | mesas.tables_summary_fast_rpc | 443.2ms | 176.0ms |
| 3 | operation | inventario_initial_load | 250.7ms | 154.8ms |
| 4 | query | inventario.products_fast_rpc | 250.6ms | 153.8ms |
| 5 | query | mesa_open.order_snapshot_fast_rpc | 204.7ms | 156.6ms |
| 6 | operation | empleados_load | 200.6ms | 159.6ms |
| 7 | query | empleados.list_management | 200.5ms | 159.6ms |
| 8 | operation | resolve_business_context_owner | 189.6ms | 157.5ms |
| 9 | query | context.resolve_mobile_business_context_rpc | 189.5ms | 162.4ms |
| 10 | query | ventas.sales_recent_rpc | 181.3ms | 152.2ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

