# Performance Baseline - Semana 1

Fecha: 2026-03-09T19:26:43.272Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 9
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 467.4ms | 776.8ms | 776.8ms | OK (<900ms) |
| resolve_business_context_employee | 411.0ms | 704.1ms | 704.1ms | OK (<900ms) |
| mesas_initial_load | 162.0ms | 191.5ms | 191.5ms | OK (<900ms) |
| mesa_open_order_load | 157.0ms | 189.4ms | 189.4ms | OK (<900ms) |
| ventas_initial_load | 155.1ms | 220.5ms | 220.5ms | OK (<900ms) |
| compras_initial_load | 163.1ms | 211.1ms | 211.1ms | OK (<900ms) |
| inventario_initial_load | 163.8ms | 218.0ms | 218.0ms | OK (<900ms) |
| empleados_load | 154.2ms | 206.6ms | 206.6ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | resolve_business_context_owner | 776.8ms | 511.2ms |
| 2 | operation | resolve_business_context_employee | 704.1ms | 433.8ms |
| 3 | query | context.tables_count_by_business | 506.0ms | 287.8ms |
| 4 | query | context.resolve_mobile_business_context_rpc | 488.0ms | 201.3ms |
| 5 | query | mesas.tables_summary_rpc | 258.4ms | 170.9ms |
| 6 | operation | ventas_initial_load | 220.5ms | 159.9ms |
| 7 | query | ventas.sales_recent_with_cash_meta | 220.4ms | 161.6ms |
| 8 | operation | inventario_initial_load | 218.0ms | 173.6ms |
| 9 | query | inventario.products_full | 217.9ms | 172.4ms |
| 10 | operation | compras_initial_load | 211.1ms | 164.6ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Reducir joins/mapeos N+1 en compras/inventario consolidando proveedores en RPC enriquecido por pantalla.
2. Precalcular datos de mesa abierta (total, unidades) en una vista/RPC para evitar queries múltiples al abrir mesa.
3. Separar carga inicial de ventas en “first paint” (sales list) y “background” (catalogo/first day) para bajar TTI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

