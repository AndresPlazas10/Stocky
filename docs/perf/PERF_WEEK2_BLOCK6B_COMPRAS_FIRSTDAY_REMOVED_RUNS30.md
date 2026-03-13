# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:28:04.696Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 30 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 163.2ms | 438.3ms | 448.1ms | OK (<900ms) |
| resolve_business_context_employee | 161.4ms | 188.5ms | 191.3ms | OK (<900ms) |
| mesas_initial_load | 165.4ms | 459.6ms | 493.4ms | OK (<900ms) |
| mesa_open_order_load | 161.5ms | 439.4ms | 542.3ms | OK (<900ms) |
| ventas_initial_load | 156.7ms | 337.6ms | 458.3ms | OK (<900ms) |
| compras_initial_load | 153.9ms | 183.4ms | 193.4ms | OK (<900ms) |
| inventario_initial_load | 154.5ms | 192.5ms | 454.0ms | OK (<900ms) |
| empleados_load | 157.1ms | 189.0ms | 193.7ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | query | mesas.tables_summary_rpc | 493.3ms | 200.3ms |
| 2 | operation | mesas_initial_load | 459.6ms | 188.5ms |
| 3 | operation | mesa_open_order_load | 439.4ms | 187.7ms |
| 4 | query | mesa_open.order_snapshot_rpc | 439.4ms | 185.6ms |
| 5 | operation | resolve_business_context_owner | 438.3ms | 185.0ms |
| 6 | operation | ventas_initial_load | 337.6ms | 180.2ms |
| 7 | query | ventas.sales_recent_rpc | 337.5ms | 180.2ms |
| 8 | query | context.resolve_mobile_business_context_rpc | 206.1ms | 174.0ms |
| 9 | operation | inventario_initial_load | 192.5ms | 167.7ms |
| 10 | query | inventario.products_with_supplier_rpc | 192.5ms | 166.5ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

