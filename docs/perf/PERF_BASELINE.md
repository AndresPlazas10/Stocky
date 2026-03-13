# Performance Baseline - Semana 1

Fecha: 2026-03-09T21:38:04.330Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 7 (warmup 1)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 222.0ms | 243.2ms | 243.2ms | OK (<900ms) |
| resolve_business_context_employee | 209.2ms | 226.1ms | 226.1ms | OK (<900ms) |
| mesas_initial_load | 183.7ms | 228.5ms | 228.5ms | OK (<900ms) |
| mesa_open_order_load | 165.5ms | 527.3ms | 527.3ms | OK (<900ms) |
| ventas_initial_load | 203.6ms | 244.7ms | 244.7ms | OK (<900ms) |
| compras_initial_load | 167.3ms | 173.8ms | 173.8ms | OK (<900ms) |
| inventario_initial_load | 164.7ms | 183.5ms | 183.5ms | OK (<900ms) |
| empleados_load | 154.5ms | 170.5ms | 170.5ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | mesa_open_order_load | 527.3ms | 217.0ms |
| 2 | query | mesa_open.order_snapshot_fast_rpc | 527.2ms | 240.3ms |
| 3 | query | context.resolve_mobile_business_context_rpc | 401.9ms | 225.6ms |
| 4 | query | ventas.sales_recent_rpc | 396.5ms | 224.8ms |
| 5 | operation | ventas_initial_load | 244.7ms | 200.3ms |
| 6 | operation | resolve_business_context_owner | 243.2ms | 218.8ms |
| 7 | operation | mesas_initial_load | 228.5ms | 190.0ms |
| 8 | query | mesas.tables_summary_fast_rpc | 228.4ms | 189.5ms |
| 9 | operation | resolve_business_context_employee | 226.1ms | 207.9ms |
| 10 | query | compras.purchases_recent_fast_rpc | 205.1ms | 168.9ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

