# Performance Baseline - Semana 1

Fecha: 2026-03-09T19:17:48.123Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 19
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 402.8ms | 471.4ms | 471.4ms | OK (<900ms) |
| resolve_business_context_employee | 405.1ms | 445.3ms | 445.3ms | OK (<900ms) |
| mesas_initial_load | 485.0ms | 503.3ms | 503.3ms | OK (<900ms) |
| mesa_open_order_load | 329.6ms | 453.6ms | 453.6ms | OK (<900ms) |
| ventas_initial_load | 523.4ms | 810.4ms | 810.4ms | OK (<900ms) |
| compras_initial_load | 492.4ms | 1008.3ms | 1008.3ms | DEGRADADO |
| inventario_initial_load | 310.5ms | 498.2ms | 498.2ms | OK (<900ms) |
| empleados_load | 157.3ms | 203.3ms | 203.3ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | compras_initial_load | 1008.3ms | 569.0ms |
| 2 | operation | ventas_initial_load | 810.4ms | 553.4ms |
| 3 | query | ventas.sales_recent_with_cash_meta | 623.8ms | 219.1ms |
| 4 | query | compras.suppliers_all | 512.8ms | 185.4ms |
| 5 | operation | mesas_initial_load | 503.3ms | 480.5ms |
| 6 | operation | inventario_initial_load | 498.2ms | 323.0ms |
| 7 | operation | resolve_business_context_owner | 471.4ms | 415.3ms |
| 8 | query | compras.suppliers_by_ids | 460.9ms | 194.4ms |
| 9 | operation | mesa_open_order_load | 453.6ms | 341.0ms |
| 10 | operation | resolve_business_context_employee | 445.3ms | 405.4ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Reducir joins/mapeos N+1 en compras/inventario consolidando proveedores en RPC enriquecido por pantalla.
2. Separar carga inicial de ventas en “first paint” (sales list) y “background” (catalogo/first day) para bajar TTI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

