# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:38:18.168Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 153.6ms | 180.7ms | 180.7ms | OK (<900ms) |
| resolve_business_context_employee | 145.7ms | 157.0ms | 157.0ms | OK (<900ms) |
| mesas_initial_load | 157.0ms | 200.6ms | 200.6ms | OK (<900ms) |
| mesa_open_order_load | 154.8ms | 163.2ms | 163.2ms | OK (<900ms) |
| ventas_initial_load | 157.7ms | 190.0ms | 190.0ms | OK (<900ms) |
| compras_initial_load | 166.6ms | 456.6ms | 456.6ms | OK (<900ms) |
| inventario_initial_load | 162.2ms | 183.1ms | 183.1ms | OK (<900ms) |
| empleados_load | 151.1ms | 172.4ms | 172.4ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | compras_initial_load | 456.6ms | 185.2ms |
| 2 | query | compras.purchases_recent_rpc | 456.5ms | 181.7ms |
| 3 | query | mesas.tables_summary_fast_rpc | 443.0ms | 179.5ms |
| 4 | operation | mesas_initial_load | 200.6ms | 163.7ms |
| 5 | query | inventario.products_with_supplier_rpc | 198.0ms | 164.7ms |
| 6 | operation | ventas_initial_load | 190.0ms | 159.4ms |
| 7 | query | ventas.sales_recent_rpc | 189.9ms | 159.5ms |
| 8 | operation | inventario_initial_load | 183.1ms | 163.3ms |
| 9 | operation | resolve_business_context_owner | 180.7ms | 157.7ms |
| 10 | query | context.resolve_mobile_business_context_rpc | 180.7ms | 158.6ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

