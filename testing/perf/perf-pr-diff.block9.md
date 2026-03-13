## Performance p95 Diff

- Status: **FAIL**
- Baseline (before): `testing/perf/perf-budget.json`
- Current (after): `testing/perf/perf-week2-block9-fast-inventario-rpc.json`
- Generated at: 2026-03-09T20:52:49.874Z

- Totals: 7 pass, 1 fail, 0 skipped

| Operation | Before p95 | After p95 | Delta | Max allowed | Gate |
|---|---:|---:|---:|---:|---|
| resolve_business_context_owner | 776.8ms | 189.6ms | -75.6% | 932.2ms | PASS |
| resolve_business_context_employee | 704.1ms | 173.6ms | -75.3% | 844.9ms | PASS |
| mesas_initial_load | 191.5ms | 443.3ms | +131.5% | 229.8ms | FAIL |
| mesa_open_order_load | 189.4ms | 175.9ms | -7.2% | 227.3ms | PASS |
| ventas_initial_load | 220.5ms | 163.4ms | -25.9% | 264.6ms | PASS |
| compras_initial_load | 211.1ms | 157.2ms | -25.5% | 253.3ms | PASS |
| inventario_initial_load | 218.0ms | 250.7ms | +15.0% | 261.5ms | PASS |
| empleados_load | 206.6ms | 200.6ms | -2.9% | 248.0ms | PASS |

### Failing Operations

- mesas_initial_load: 443.3ms > 229.8ms (+131.5%)

