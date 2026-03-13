# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:57:35.123Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 168.7ms | 233.6ms | 233.6ms | OK (<900ms) |
| resolve_business_context_employee | 158.5ms | 221.5ms | 221.5ms | OK (<900ms) |
| mesas_initial_load | 167.4ms | 177.5ms | 177.5ms | OK (<900ms) |
| mesa_open_order_load | 152.3ms | 187.6ms | 187.6ms | OK (<900ms) |
| ventas_initial_load | 161.9ms | 191.9ms | 191.9ms | OK (<900ms) |
| compras_initial_load | 156.6ms | 173.3ms | 173.3ms | OK (<900ms) |
| inventario_initial_load | 163.6ms | 183.6ms | 183.6ms | OK (<900ms) |
| empleados_load | 153.6ms | 171.4ms | 171.4ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | resolve_business_context_owner | 233.6ms | 174.5ms |
| 2 | query | context.resolve_mobile_business_context_rpc | 233.6ms | 173.4ms |
| 3 | operation | resolve_business_context_employee | 221.5ms | 163.4ms |
| 4 | query | mesas.tables_summary_fast_rpc | 205.9ms | 167.4ms |
| 5 | operation | ventas_initial_load | 191.9ms | 164.4ms |
| 6 | query | ventas.sales_recent_rpc | 191.8ms | 164.9ms |
| 7 | operation | mesa_open_order_load | 187.6ms | 161.4ms |
| 8 | query | mesa_open.order_snapshot_fast_rpc | 187.6ms | 163.6ms |
| 9 | operation | inventario_initial_load | 183.6ms | 163.1ms |
| 10 | query | inventario.products_fast_rpc | 183.5ms | 161.5ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

