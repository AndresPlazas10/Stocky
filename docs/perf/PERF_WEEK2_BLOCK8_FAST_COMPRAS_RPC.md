# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:47:17.301Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 7
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 293.9ms | 317.6ms | 317.6ms | OK (<900ms) |
| resolve_business_context_employee | 318.8ms | 514.2ms | 514.2ms | OK (<900ms) |
| mesas_initial_load | 307.5ms | 540.7ms | 540.7ms | OK (<900ms) |
| mesa_open_order_load | 307.9ms | 351.5ms | 351.5ms | OK (<900ms) |
| ventas_initial_load | 317.1ms | 455.8ms | 455.8ms | OK (<900ms) |
| compras_initial_load | 305.3ms | 409.7ms | 409.7ms | OK (<900ms) |
| inventario_initial_load | 311.9ms | 698.4ms | 698.4ms | OK (<900ms) |
| empleados_load | 323.0ms | 410.3ms | 410.3ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | inventario_initial_load | 698.4ms | 342.0ms |
| 2 | query | inventario.products_with_supplier_rpc | 698.3ms | 344.3ms |
| 3 | operation | mesas_initial_load | 540.7ms | 334.2ms |
| 4 | query | mesas.tables_summary_fast_rpc | 540.6ms | 336.9ms |
| 5 | operation | resolve_business_context_employee | 514.2ms | 344.0ms |
| 6 | query | context.resolve_mobile_business_context_rpc | 514.2ms | 326.2ms |
| 7 | operation | ventas_initial_load | 455.8ms | 340.3ms |
| 8 | query | ventas.sales_recent_rpc | 455.7ms | 337.1ms |
| 9 | operation | empleados_load | 410.3ms | 333.4ms |
| 10 | query | empleados.list_management | 410.2ms | 341.7ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Aplicar presupuesto de performance por operación (p95) y bloquear regresiones >20% en CI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

