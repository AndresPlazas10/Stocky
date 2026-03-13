# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:24:19.496Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 155.4ms | 239.7ms | 239.7ms | OK (<900ms) |
| resolve_business_context_employee | 163.9ms | 221.1ms | 221.1ms | OK (<900ms) |
| mesas_initial_load | 153.7ms | 493.1ms | 493.1ms | OK (<900ms) |
| mesa_open_order_load | 142.8ms | 433.2ms | 433.2ms | OK (<900ms) |
| ventas_initial_load | 147.9ms | 193.0ms | 193.0ms | OK (<900ms) |
| compras_initial_load | 158.4ms | 455.6ms | 455.6ms | OK (<900ms) |
| inventario_initial_load | 150.6ms | 196.6ms | 196.6ms | OK (<900ms) |
| empleados_load | 167.0ms | 224.7ms | 224.7ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | mesas_initial_load | 493.1ms | 182.2ms |
| 2 | query | mesas.tables_summary_rpc | 493.1ms | 182.5ms |
| 3 | operation | compras_initial_load | 455.6ms | 177.8ms |
| 4 | query | compras.purchases_recent_rpc | 455.6ms | 181.6ms |
| 5 | operation | mesa_open_order_load | 433.2ms | 164.9ms |
| 6 | query | mesa_open.order_snapshot_rpc | 433.1ms | 163.5ms |
| 7 | operation | resolve_business_context_owner | 239.7ms | 164.7ms |
| 8 | operation | empleados_load | 224.7ms | 169.3ms |
| 9 | query | empleados.list_management | 224.6ms | 166.4ms |
| 10 | operation | resolve_business_context_employee | 221.1ms | 168.1ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

