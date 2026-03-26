# Performance Baseline - Semana 1

Fecha: 2026-03-25T02:07:40.887Z
Business ID: eae98029-91f4-403d-8b6c-5c5f34f71655
Runs por operación: 30 (warmup 3)

## Resumen Ejecutivo

- Operaciones medidas: 8
- Queries medidas: 8
- Bottlenecks top: 10

## SLA Tracking Inicial

| Operación | p50 | p95 | p99 | Estado objetivo |
|---|---:|---:|---:|---|
| resolve_business_context_owner | 192.6ms | 547.9ms | 599.7ms | OK (<900ms) |
| resolve_business_context_employee | 173.1ms | 236.7ms | 501.4ms | OK (<900ms) |
| mesas_initial_load | 180.3ms | 424.4ms | 473.2ms | OK (<900ms) |
| mesa_open_order_load | - | - | - | SKIPPED |
| ventas_initial_load | 184.4ms | 234.9ms | 237.5ms | OK (<900ms) |
| compras_initial_load | 195.8ms | 569.7ms | 841.3ms | OK (<900ms) |
| inventario_initial_load | 190.9ms | 588.0ms | 637.0ms | OK (<900ms) |
| empleados_load | 195.8ms | 614.1ms | 614.4ms | OK (<900ms) |

## Top Bottlenecks (p95)

| # | Tipo | Nombre | p95 | promedio |
|---:|---|---|---:|---:|
| 1 | query | bootstrap.businesses_by_owner | 615.2ms | 615.2ms |
| 2 | operation | empleados_load | 614.1ms | 251.4ms |
| 3 | query | empleados.list_management | 614.1ms | 247.8ms |
| 4 | operation | inventario_initial_load | 588.0ms | 237.5ms |
| 5 | query | inventario.products_fast_rpc | 588.0ms | 233.6ms |
| 6 | operation | compras_initial_load | 569.7ms | 275.4ms |
| 7 | query | compras.purchases_recent_fast_rpc | 569.6ms | 267.3ms |
| 8 | operation | resolve_business_context_owner | 547.9ms | 220.7ms |
| 9 | operation | mesas_initial_load | 424.4ms | 201.8ms |
| 10 | query | mesas.tables_summary_fast_rpc | 424.4ms | 207.1ms |

## Recomendaciones P0 (Siguiente Iteración)

1. Precalcular datos de mesa abierta (total, unidades) en una vista/RPC para evitar queries múltiples al abrir mesa.

## Archivos de evidencia

- `testing/perf/perf-baseline.json`

