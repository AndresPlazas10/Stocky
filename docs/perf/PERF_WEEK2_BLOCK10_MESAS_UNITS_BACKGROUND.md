# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:56:07.344Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 165.0ms | 472.9ms | 472.9ms | OK (<900ms) |
| resolve_business_context_employee | 157.9ms | 189.9ms | 189.9ms | OK (<900ms) |
| mesas_initial_load | 156.6ms | 501.0ms | 501.0ms | OK (<900ms) |
| mesa_open_order_load | 147.9ms | 176.7ms | 176.7ms | OK (<900ms) |
| ventas_initial_load | 154.2ms | 180.2ms | 180.2ms | OK (<900ms) |
| compras_initial_load | 166.6ms | 208.9ms | 208.9ms | OK (<900ms) |
| inventario_initial_load | 160.3ms | 216.3ms | 216.3ms | OK (<900ms) |
| empleados_load | 155.8ms | 191.2ms | 191.2ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | mesas_initial_load | 501.0ms | 201.3ms |
| 2 | query | mesas.tables_summary_fast_rpc | 500.9ms | 198.5ms |
| 3 | operation | resolve_business_context_owner | 472.9ms | 183.2ms |
| 4 | query | context.resolve_mobile_business_context_rpc | 223.7ms | 171.0ms |
| 5 | operation | inventario_initial_load | 216.3ms | 163.9ms |
| 6 | query | inventario.products_fast_rpc | 216.2ms | 163.6ms |
| 7 | operation | compras_initial_load | 208.9ms | 169.7ms |
| 8 | query | compras.purchases_recent_fast_rpc | 208.9ms | 168.2ms |
| 9 | operation | empleados_load | 191.2ms | 164.0ms |
| 10 | query | empleados.list_management | 191.1ms | 162.1ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

