## Performance p95 Diff

- Status: **FAIL**
- Baseline (before): `testing/perf/perf-budget.json`
- Current (after): `testing/perf/perf-week2-block8-fast-compras-rpc.json`
- Generated at: 2026-03-09T20:47:42.441Z

- Totals: 2 pass, 6 fail, 0 skipped

| Operation | Before p95 | After p95 | Delta | Max allowed | Gate |
|---|---:|---:|---:|---:|---|
| resolve_business_context_owner | 776.8ms | 317.6ms | -59.1% | 932.2ms | PASS |
| resolve_business_context_employee | 704.1ms | 514.2ms | -27.0% | 844.9ms | PASS |
| mesas_initial_load | 191.5ms | 540.7ms | +182.4% | 229.8ms | FAIL |
| mesa_open_order_load | 189.4ms | 351.5ms | +85.6% | 227.3ms | FAIL |
| ventas_initial_load | 220.5ms | 455.8ms | +106.7% | 264.6ms | FAIL |
| compras_initial_load | 211.1ms | 409.7ms | +94.1% | 253.3ms | FAIL |
| inventario_initial_load | 218.0ms | 698.4ms | +220.4% | 261.5ms | FAIL |
| empleados_load | 206.6ms | 410.3ms | +98.6% | 248.0ms | FAIL |

### Failing Operations

- mesas_initial_load: 540.7ms > 229.8ms (+182.4%)
- mesa_open_order_load: 351.5ms > 227.3ms (+85.6%)
- ventas_initial_load: 455.8ms > 264.6ms (+106.7%)
- compras_initial_load: 409.7ms > 253.3ms (+94.1%)
- inventario_initial_load: 698.4ms > 261.5ms (+220.4%)
- empleados_load: 410.3ms > 248.0ms (+98.6%)

