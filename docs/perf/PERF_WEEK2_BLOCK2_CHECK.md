# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:03:50.128Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 9
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 491.1ms | 619.6ms | 619.6ms | OK (<900ms) |
| resolve_business_context_employee | 502.4ms | 658.8ms | 658.8ms | OK (<900ms) |
| mesas_initial_load | 164.3ms | 219.1ms | 219.1ms | OK (<900ms) |
| mesa_open_order_load | 178.3ms | 215.0ms | 215.0ms | OK (<900ms) |
| ventas_initial_load | 157.0ms | 163.0ms | 163.0ms | OK (<900ms) |
| compras_initial_load | 157.0ms | 191.3ms | 191.3ms | OK (<900ms) |
| inventario_initial_load | 157.1ms | 184.3ms | 184.3ms | OK (<900ms) |
| empleados_load | 157.6ms | 191.7ms | 191.7ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | resolve_business_context_employee | 658.8ms | 512.8ms |
| 2 | operation | resolve_business_context_owner | 619.6ms | 502.7ms |
| 3 | query | context.tables_count_by_business | 380.9ms | 257.9ms |
| 4 | query | context.resolve_mobile_business_context_rpc | 345.5ms | 253.6ms |
| 5 | query | mesas.tables_summary_rpc | 252.0ms | 178.0ms |
| 6 | query | compras.purchases_recent_rpc | 233.2ms | 160.8ms |
| 7 | operation | mesas_initial_load | 219.1ms | 168.7ms |
| 8 | operation | mesa_open_order_load | 215.0ms | 176.9ms |
| 9 | query | mesa_open.order_snapshot_rpc | 214.9ms | 178.1ms |
| 10 | query | inventario.products_with_supplier_rpc | 194.5ms | 161.1ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

