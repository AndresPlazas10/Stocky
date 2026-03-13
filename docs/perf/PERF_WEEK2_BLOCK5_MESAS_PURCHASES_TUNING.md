# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:16:28.694Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 8
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 173.3ms | 365.2ms | 365.2ms | OK (<900ms) |
| resolve_business_context_employee | 157.5ms | 205.9ms | 205.9ms | OK (<900ms) |
| mesas_initial_load | 154.1ms | 194.9ms | 194.9ms | OK (<900ms) |
| mesa_open_order_load | 157.1ms | 193.4ms | 193.4ms | OK (<900ms) |
| ventas_initial_load | 151.9ms | 166.2ms | 166.2ms | OK (<900ms) |
| compras_initial_load | 151.4ms | 171.0ms | 171.0ms | OK (<900ms) |
| inventario_initial_load | 163.5ms | 195.1ms | 195.1ms | OK (<900ms) |
| empleados_load | 159.2ms | 185.6ms | 185.6ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | query | mesas.tables_summary_rpc | 516.8ms | 181.8ms |
| 2 | query | compras.first_purchase_day | 452.6ms | 170.1ms |
| 3 | operation | resolve_business_context_owner | 365.2ms | 190.5ms |
| 4 | query | compras.purchases_recent_rpc | 296.4ms | 159.5ms |
| 5 | query | inventario.products_with_supplier_rpc | 235.3ms | 167.7ms |
| 6 | query | context.resolve_mobile_business_context_rpc | 226.5ms | 177.5ms |
| 7 | operation | resolve_business_context_employee | 205.9ms | 160.9ms |
| 8 | operation | inventario_initial_load | 195.1ms | 164.3ms |
| 9 | operation | mesas_initial_load | 194.9ms | 157.7ms |
| 10 | operation | mesa_open_order_load | 193.4ms | 160.7ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

