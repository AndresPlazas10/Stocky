# Scripts de seguridad

## Auditoria rapida de RLS
Requiere `psql` disponible en PATH y `DB_URL` definido.

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -f scripts/security/rls_audit.sql
```

## Auditoria de filtros realtime (web)
Valida que los hooks `useRealtimeSubscription` incluyan `business_id` en el bloque cercano.

```bash
node scripts/security/realtime_filter_audit.mjs
```

## Auditoria realtime completa
Usa los scripts avanzados de `scripts/realtime-audit`.

```bash
node scripts/realtime-audit/run-all.mjs
```

## Reporte operativo de seguridad
Ejecuta el reporte manual de eventos y alertas basicas.

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -f scripts/security/security_audit_report.sql
```
