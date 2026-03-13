# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:13:29.242Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 8
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 150.4ms | 201.4ms | 201.4ms | OK (<900ms) |
| resolve_business_context_employee | 153.0ms | 215.9ms | 215.9ms | OK (<900ms) |
| mesas_initial_load | 147.9ms | 181.4ms | 181.4ms | OK (<900ms) |
| mesa_open_order_load | 145.9ms | 181.8ms | 181.8ms | OK (<900ms) |
| ventas_initial_load | 153.1ms | 175.3ms | 175.3ms | OK (<900ms) |
| compras_initial_load | 172.6ms | 208.2ms | 208.2ms | OK (<900ms) |
| inventario_initial_load | 153.2ms | 177.7ms | 177.7ms | OK (<900ms) |
| empleados_load | 156.5ms | 185.0ms | 185.0ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | query | mesa_open.order_snapshot_rpc | 297.1ms | 157.8ms |
| 2 | query | compras.purchases_recent_rpc | 272.1ms | 180.4ms |
| 3 | operation | resolve_business_context_employee | 215.9ms | 157.2ms |
| 4 | query | context.resolve_mobile_business_context_rpc | 215.8ms | 164.5ms |
| 5 | operation | compras_initial_load | 208.2ms | 170.8ms |
| 6 | operation | resolve_business_context_owner | 201.4ms | 160.1ms |
| 7 | query | empleados.list_management | 196.7ms | 161.5ms |
| 8 | query | mesas.tables_summary_rpc | 186.8ms | 153.2ms |
| 9 | query | compras.first_purchase_day | 186.4ms | 156.4ms |
| 10 | operation | empleados_load | 185.0ms | 157.7ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

