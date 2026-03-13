## Performance p95 Diff

- Status: **PASS**
- Baseline (before): `testing/perf/perf-budget.json`
- Current (after): `testing/perf/perf-week2-block10b-mesas-units-background.json`
- Generated at: 2026-03-09T20:57:44.096Z

- Totals: 8 pass, 0 fail, 0 skipped

| Operation | Before p95 | After p95 | Delta | Max allowed | Gate |
|---|---:|---:|---:|---:|---|
| resolve_business_context_owner | 776.8ms | 233.6ms | -69.9% | 932.2ms | PASS |
| resolve_business_context_employee | 704.1ms | 221.5ms | -68.5% | 844.9ms | PASS |
| mesas_initial_load | 191.5ms | 177.5ms | -7.3% | 229.8ms | PASS |
| mesa_open_order_load | 189.4ms | 187.6ms | -0.9% | 227.3ms | PASS |
| ventas_initial_load | 220.5ms | 191.9ms | -12.9% | 264.6ms | PASS |
| compras_initial_load | 211.1ms | 173.3ms | -17.9% | 253.3ms | PASS |
| inventario_initial_load | 218.0ms | 183.6ms | -15.8% | 261.5ms | PASS |
| empleados_load | 206.6ms | 171.4ms | -17.1% | 248.0ms | PASS |

