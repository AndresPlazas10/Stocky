# Realtime Audit Runbook

## Objetivo
Ejecutar una auditoria completa de realtime en Stocky para detectar:
- canales o suscripciones rotas,
- problemas de RLS/publication/replica identity,
- diferencias entre realtime web y sincronizacion fallback en mobile.

## Artefactos generados
- `testing/realtime/results/realtime-map.json`
- `testing/realtime/results/realtime-db-check.json`
- `testing/realtime/results/realtime-smoke-report.json`
- `testing/realtime/results/realtime-audit-report.json`

## Variables de entorno requeridas

### Basicas
- `SUPABASE_URL` o `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` o `VITE_SUPABASE_ANON_KEY`
- `REALTIME_TEST_BUSINESS_ID`
- `REALTIME_OWNER_EMAIL`
- `REALTIME_OWNER_PASSWORD`
- `REALTIME_EMPLOYEE_EMAIL`
- `REALTIME_EMPLOYEE_PASSWORD`

### Recomendadas
- `SUPABASE_SERVICE_ROLE_KEY` (para mutaciones controladas en smoke)
- `SUPABASE_DB_URL` o `DATABASE_URL` (para chequeo SQL via `psql`)
- `REALTIME_OUTSIDER_EMAIL`
- `REALTIME_OUTSIDER_PASSWORD`

## Comandos

### 1) Mapa de suscripciones y fallback
```bash
npm run audit:realtime:map
```

### 2) Contrato DB (publication + RLS + replica identity)
```bash
npm run audit:realtime:db
```

### 3) Smoke multi-cliente owner/employee
```bash
npm run audit:realtime:smoke
```

### 4) Reporte final consolidado
```bash
npm run audit:realtime:report
```

### 5) Flujo completo
```bash
npm run audit:realtime
```

Opciones utiles:
```bash
npm run audit:realtime -- --skip-db
npm run audit:realtime -- --skip-smoke
```

## Interpretacion de resultados

## realtime-map.json
- `channels`: consumidores detectados por tabla/evento/filtro.
- `mobile_non_realtime_modules`: modulos mobile con polling/focus refresh en lugar de canal realtime.

## realtime-db-check.json
- `status=PASS`: contrato DB realtime consistente.
- Reglas criticas:
  - `publication_exists`
  - `required_tables_in_publication`
  - `can_access_business_function`
  - `rls_relational_tables`

## realtime-smoke-report.json
- `table_matrix`: PASS/FAIL/SKIPPED por tabla critica.
- `channels.failed`: canales que no llegaron a `SUBSCRIBED`.
- `latency_summary`: p50/p95 de latencia evento->listener.

## realtime-audit-report.json
- `release_gate.status=PASS`: apto para release en realtime.
- `findings`: lista priorizada con severidad y tipo.
- Nota de cobertura relacional:
  - Si una tabla relacional (ej: `sale_details`) no tiene consumidor realtime directo, puede quedar en `low` cuando su sincronizacion se resuelve de forma indirecta via tabla padre (ej: `sales`) + lectura bajo demanda.

## Tipos de hallazgo y accion recomendada
- `realtime_roto`
  - Revisar filtros, RLS de tabla relacional, session role y estado del canal.
  - Validar que el consumidor no descarte eventos por estado local stale.
- `filtro/config_roto`
  - Revisar publication `supabase_realtime` y filtros `business_id`.
  - Confirmar que no haya leak cross-business.
- `sincronizacion_lenta_por_polling`
  - Ajustar intervalos de polling/focus refresh.
  - Agregar cache local con invalidacion segura si aplica.

## Release gate (bloqueante)
No desplegar si se cumple cualquiera:
1. `realtime-db-check.json.status != PASS`
2. `realtime-smoke-report.json.status != PASS`
3. Hay hallazgos `critical` en `realtime-audit-report.json`

## Verificacion funcional manual
Ejecutar checklist:
- `testing/realtime/MANUAL_UI_CHECKLIST.md`

## Notas
- Mobile se audita como arquitectura mixta: realtime + polling/locks/focus refresh.
- Si no existe `psql`, el check DB SQL no se ejecuta hasta instalar cliente PostgreSQL.
