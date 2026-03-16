# Seguridad Stocky - Runbook Operativo

## Supabase Auth (manual)
- Revisar politicas de password en Supabase Auth.
- Verificar expiracion de refresh tokens.
- Habilitar MFA para administradores si aplica.
- Confirmar que "Confirm email" esta alineado con el flujo de alta.

## RLS (verificacion periodica)
- Confirmar que todas las tablas productivas tienen RLS activado.
- Validar que no existan policies con `USING true`.
- Probar acceso cruzado entre negocios (debe fallar).
- Ejecutar `psql "$DB_URL" -v ON_ERROR_STOP=1 -X -f scripts/security/rls_audit.sql`.

## Logs de seguridad
- Tabla: `security_audit_logs`.
- Revisar eventos recientes:
  - `SELECT * FROM security_audit_logs ORDER BY created_at DESC LIMIT 200;`
- Filtrar por negocio:
  - `SELECT * FROM security_audit_logs WHERE business_id = '<business_id>' ORDER BY created_at DESC;`
- Reporte completo:
  - `psql "$DB_URL" -v ON_ERROR_STOP=1 -X -f scripts/security/security_audit_report.sql`

## Incidentes
- Registrar incidentes criticos (acceso cruzado, fuga de datos).
- Revocar sesiones en Supabase.
- Forzar rotacion de llaves anon y service role si aplica.

## Rotacion de secretos
- Revisar .env y variables de entorno cada trimestre.
- Cambiar keys en Supabase si hay sospecha de filtracion.

## Supply chain (dependencias)
- Revisar PRs de Dependabot semanalmente.
- Priorizar actualizaciones criticas y high.
- Ejecutar `npm run audit:security` antes de releases.
