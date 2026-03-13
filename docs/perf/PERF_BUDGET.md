# Performance Budget Gate

Este gate bloquea regresiones de latencia p95 por operación respecto al baseline de la semana 1.

## Archivos

- Budget: `testing/perf/perf-budget.json`
- Baseline histórico: `testing/perf/perf-baseline.json`
- Reporte actual (CI/local): `testing/perf/perf-current.json`

## Comandos

Generar baseline:

```bash
npm run audit:perf:baseline
```

Validar budget sobre una corrida ya generada:

```bash
npm run audit:perf:budget -- --current testing/perf/perf-current.json
```

Flujo completo para CI:

```bash
npm run audit:perf:ci
```

## Regla de bloqueo

- Por defecto, cada operación permite hasta `+20%` de regresión sobre su `baseline_p95_ms`.
- Si una operación supera su límite, el script termina con exit code `2`.
- El baseline actual está calibrado para tiempos de **first paint mobile** (catálogos y datos secundarios se miden fuera del camino crítico).
- `resolve_business_context_*` mide solo la resolución de contexto (sin conteos secundarios de mesas en el mismo paso).
- `compras_initial_load` mide solo el historial reciente (priorizando `list_recent_purchases_fast` sin join a proveedores); `first_purchase_day` se carga en background.
- `inventario_initial_load` prioriza `list_inventory_products_fast` sin join de proveedores en la ruta crítica; proveedores se hidratan fuera del first paint.
- `mesas_initial_load` prioriza `list_tables_with_order_summary_fast` sin agregado de `order_units` en la consulta principal; unidades se hidratan en background.

## Workflow CI

Archivo: `.github/workflows/perf-budget.yml`

En eventos `pull_request`, el workflow publica/actualiza un comentario con el diff p95 before/after usando el marcador `perf-budget-diff-comment`.

Secrets requeridos en GitHub Actions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `REALTIME_TEST_BUSINESS_ID`
- `REALTIME_OWNER_EMAIL`
- `REALTIME_OWNER_PASSWORD`
- `REALTIME_EMPLOYEE_EMAIL`
- `REALTIME_EMPLOYEE_PASSWORD`
