# Performance Baseline - Semana 1

Fecha: 2026-03-09T19:13:49.947Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 19
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 477.7ms | 1029.4ms | 1029.4ms | DEGRADADO |
| resolve_business_context_employee | 491.9ms | 1009.8ms | 1009.8ms | DEGRADADO |
| mesas_initial_load | 508.1ms | 559.7ms | 559.7ms | OK (<900ms) |
| mesa_open_order_load | 317.5ms | 402.3ms | 402.3ms | OK (<900ms) |
| ventas_initial_load | 480.0ms | 780.5ms | 780.5ms | OK (<900ms) |
| compras_initial_load | 494.2ms | 840.1ms | 840.1ms | OK (<900ms) |
| inventario_initial_load | 327.1ms | 594.1ms | 594.1ms | OK (<900ms) |
| empleados_load | 148.3ms | 193.3ms | 193.3ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | resolve_business_context_owner | 1029.4ms | 515.1ms |
| 2 | operation | resolve_business_context_employee | 1009.8ms | 550.1ms |
| 3 | operation | compras_initial_load | 840.1ms | 538.6ms |
| 4 | operation | ventas_initial_load | 780.5ms | 514.1ms |
| 5 | query | context.tables_count_by_business | 619.5ms | 269.6ms |
| 6 | operation | inventario_initial_load | 594.1ms | 348.6ms |
| 7 | operation | mesas_initial_load | 559.7ms | 503.3ms |
| 8 | query | compras.purchases_recent | 503.1ms | 193.9ms |
| 9 | query | ventas.catalog_products | 467.0ms | 185.4ms |
| 10 | query | ventas.catalog_combos | 451.4ms | 175.3ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Reducir joins/mapeos N+1 en compras/inventario consolidando proveedores en RPC enriquecido por pantalla.
2. Separar carga inicial de ventas en “first paint” (sales list) y “background” (catalogo/first day) para bajar TTI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

