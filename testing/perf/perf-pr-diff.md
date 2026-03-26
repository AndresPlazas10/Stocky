## Performance p95 Diff

- Status: **FAIL**
- Baseline (before): `testing/perf/perf-budget.json`
- Current (after): `testing/perf/perf-baseline.json`
- Generated at: 2026-03-25T02:03:06.308Z

- Totals: 2 pass, 5 fail, 1 skipped

| Operation | Before p95 | After p95 | Delta | Max allowed | Gate |
|---|---:|---:|---:|---:|---|
| resolve_business_context_owner | 776.8ms | 1022.8ms | +31.7% | 932.2ms | FAIL |
| resolve_business_context_employee | 704.1ms | 718.1ms | +2.0% | 844.9ms | PASS |
| mesas_initial_load | 191.5ms | 508.1ms | +165.3% | 229.8ms | FAIL |
| mesa_open_order_load | 189.4ms | 0.0ms | +0.0% | 227.3ms | SKIPPED |
| ventas_initial_load | 220.5ms | 627.1ms | +184.5% | 264.6ms | FAIL |
| compras_initial_load | 211.1ms | 417.4ms | +97.8% | 253.3ms | FAIL |
| inventario_initial_load | 218.0ms | 523.7ms | +140.3% | 261.5ms | FAIL |
| empleados_load | 206.6ms | 206.7ms | +0.0% | 248.0ms | PASS |

### Failing Operations

- resolve_business_context_owner: 1022.8ms > 932.2ms (+31.7%)
- mesas_initial_load: 508.1ms > 229.8ms (+165.3%)
- ventas_initial_load: 627.1ms > 264.6ms (+184.5%)
- compras_initial_load: 417.4ms > 253.3ms (+97.8%)
- inventario_initial_load: 523.7ms > 261.5ms (+140.3%)

