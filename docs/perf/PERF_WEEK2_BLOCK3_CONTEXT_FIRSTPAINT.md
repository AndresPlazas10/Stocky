# Performance Baseline - Semana 1

Fecha: 2026-03-09T20:07:58.261Z
Business ID: 2d29e1c7-0532-4694-9b4e-995545f25725
Runs por operación: 15 (warmup 2)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 8
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 155.0ms | 208.2ms | 208.2ms | OK (<900ms) |
| resolve_business_context_employee | 159.1ms | 192.0ms | 192.0ms | OK (<900ms) |
| mesas_initial_load | 154.7ms | 201.7ms | 201.7ms | OK (<900ms) |
| mesa_open_order_load | 152.6ms | 181.0ms | 181.0ms | OK (<900ms) |
| ventas_initial_load | 173.1ms | 214.4ms | 214.4ms | OK (<900ms) |
| compras_initial_load | 160.3ms | 185.6ms | 185.6ms | OK (<900ms) |
| inventario_initial_load | 154.3ms | 215.4ms | 215.4ms | OK (<900ms) |
| empleados_load | 153.6ms | 227.2ms | 227.2ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | operation | empleados_load | 227.2ms | 166.4ms |
| 2 | query | empleados.list_management | 227.1ms | 166.2ms |
| 3 | query | compras.purchases_recent_rpc | 223.0ms | 155.5ms |
| 4 | operation | inventario_initial_load | 215.4ms | 162.2ms |
| 5 | query | inventario.products_with_supplier_rpc | 215.3ms | 162.8ms |
| 6 | operation | ventas_initial_load | 214.4ms | 178.3ms |
| 7 | query | ventas.sales_recent_with_cash_meta | 214.3ms | 177.9ms |
| 8 | query | compras.first_purchase_day | 209.4ms | 166.7ms |
| 9 | operation | resolve_business_context_owner | 208.2ms | 157.1ms |
| 10 | operation | mesas_initial_load | 201.7ms | 161.7ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Separar carga inicial de ventas en “first paint” (sales list) y “background” (catalogo/first day) para bajar TTI.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

