# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:26:37.729Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 150.9ms | 179.8ms | 179.8ms | OK (<900ms) |
| resolve_business_context_employee | 151.8ms | 181.7ms | 181.7ms | OK (<900ms) |
| mesas_initial_load | 154.6ms | 459.2ms | 459.2ms | OK (<900ms) |
| mesa_open_order_load | 157.5ms | 179.1ms | 179.1ms | OK (<900ms) |
| ventas_initial_load | 161.4ms | 295.0ms | 295.0ms | OK (<900ms) |
| compras_initial_load | 156.1ms | 460.8ms | 460.8ms | OK (<900ms) |
| inventario_initial_load | 158.9ms | 707.3ms | 707.3ms | OK (<900ms) |
| empleados_load | 154.4ms | 169.4ms | 169.4ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | inventario_initial_load | 707.3ms | 215.0ms |
| 2 | query | inventario.products_with_supplier_rpc | 707.2ms | 206.8ms |
| 3 | operation | compras_initial_load | 460.8ms | 179.7ms |
| 4 | query | compras.purchases_recent_rpc | 460.8ms | 178.1ms |
| 5 | operation | mesas_initial_load | 459.2ms | 177.3ms |
| 6 | query | mesas.tables_summary_rpc | 459.2ms | 174.9ms |
| 7 | operation | ventas_initial_load | 295.0ms | 171.5ms |
| 8 | query | ventas.sales_recent_rpc | 295.0ms | 168.8ms |
| 9 | operation | resolve_business_context_employee | 181.7ms | 152.3ms |
| 10 | query | empleados.list_management | 181.3ms | 156.9ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

