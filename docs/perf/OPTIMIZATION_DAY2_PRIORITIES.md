# Dia 2 - Prioridades de Optimizacion (P0/P1)

Fuente: `docs/perf/PERF_BASELINE.md` generado el `2026-03-25T01:24:23.731Z`.

## Top cuellos de botella observados (p95)
1. `compras_initial_load` -> 1080.2ms
2. `compras.purchases_recent_fast_rpc` -> 1080.1ms
3. `inventario_initial_load` -> 983.8ms
4. `inventario.products_fast_rpc` -> 983.7ms
5. `resolve_business_context_employee` -> 792.9ms
6. `bootstrap.businesses_by_owner` -> 676.6ms
7. `mesas_initial_load` -> 548.2ms
8. `mesas.tables_summary_fast_rpc` -> 548.2ms
9. `context.resolve_mobile_business_context_rpc` -> 534.1ms
10. `ventas_initial_load` -> 466.5ms

## Priorizacion P0 (esta semana)

### P0.1 - Estabilizar `compras_initial_load` (1080.2ms p95)
- Confirmar índice compuesto con orden real de consulta (`business_id, created_at desc, id desc`).
- Verificar plan de ejecución del RPC `list_recent_purchases_fast`.
- Accion:
  - ejecutar `EXPLAIN (ANALYZE, BUFFERS)` sobre `list_recent_purchases_fast`.
  - validar reducción del sort y heap fetch con índice covering.
- Criterio de exito:
  - bajar p95 de compras por debajo de 450ms en rerun de baseline.

### P0.2 - Estabilizar `inventario_initial_load` (983.8ms p95)
- Confirmar índice compuesto con orden real de `list_inventory_products_fast`.
- Revisar cardinalidad por negocio y payload inicial.
- Criterio de exito:
  - bajar p95 de inventario por debajo de 450ms.

### P0.3 - Cubrir caso faltante `mesa_open_order_load` (SKIPPED)
- Preparar datos de prueba en staging: al menos 1 mesa ocupada con orden abierta.
- Reejecutar baseline para tener medicion real del flujo.
- Criterio de exito:
  - tener p95/p99 medidos en ese flujo y no SKIPPED.

## Priorizacion P1 (siguiente bloque)

### P1.1 - Reducir costo de `context.resolve_mobile_business_context_rpc` (534.1ms p95)
- Auditar joins/funciones internas de contexto.
- Evitar lecturas repetidas en primer render (cache local por sesion, invalidacion puntual).

### P1.2 - Optimizar `mesas.tables_summary_fast_rpc` (548.2ms p95)
- Verificar columnas calculadas costosas.
- Evaluar snapshot/materializado ligero para valores agregados.

### P1.3 - Optimizar `ventas.sales_recent_rpc` (466.5ms p95)
- Limitar columnas en listado.
- Confirmar paginacion efectiva en consumo movil/web.

## Ejecucion recomendada (orden)
1. P0.1 compras
2. P0.2 contexto movil
3. P0.3 mesa abierta
4. P1.1 mesas summary
5. P1.2 ventas recent
6. P1.3 inventario
