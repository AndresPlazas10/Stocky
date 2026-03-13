## Performance p95 Diff

- Status: **PASS**
- Baseline (before): `testing/perf/perf-budget.json`
- Current (after): `testing/perf/perf-post-frontend-firstpaint-optimizations.json`
- Generated at: 2026-03-09T19:32:13.101Z

- Totals: 8 pass, 0 fail, 0 skipped

| Operation | Before p95 | After p95 | Delta | Max allowed | Gate |
|---|---:|---:|---:|---:|---|
| resolve_business_context_owner | 776.8ms | 776.8ms | +0.0% | 932.2ms | PASS |
| resolve_business_context_employee | 704.1ms | 704.1ms | +0.0% | 844.9ms | PASS |
| mesas_initial_load | 191.5ms | 191.5ms | +0.0% | 229.8ms | PASS |
| mesa_open_order_load | 189.4ms | 189.4ms | +0.0% | 227.3ms | PASS |
| ventas_initial_load | 220.5ms | 220.5ms | +0.0% | 264.6ms | PASS |
| compras_initial_load | 211.1ms | 211.1ms | +0.0% | 253.3ms | PASS |
| inventario_initial_load | 218.0ms | 218.0ms | +0.0% | 261.5ms | PASS |
| empleados_load | 206.6ms | 206.6ms | +0.0% | 248.0ms | PASS |

