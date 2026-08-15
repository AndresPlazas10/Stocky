# Seguridad Stocky - Baseline

## Clasificacion de datos
- PII: nombres, correos, telefonos de empleados y clientes.
- Financieros: ventas, compras, pagos, comprobantes.
- Operacionales: inventario, mesas, ordenes, horarios de uso.
- Tokens y credenciales: sesiones, refresh tokens, anon keys.

## Flujos criticos
- Autenticacion (web y movil).
- Operaciones de ventas y cierre de ordenes.
- Acceso a negocios y empleados (RLS).
- Realtime para mesas y ordenes.
- Cambios administrativos (empleados, combos, inventario).

## Superficie de ataque
- Web: navegacion, rutas protegidas, supabase client, realtime, storage local.
- Movil: storage local, caches offline, sesiones, notificaciones.
- Supabase: RLS, funciones SQL, publicaciones realtime, storage.

## Matriz de riesgos (prioridad)
| Riesgo | Impacto | Probabilidad | Prioridad |
| --- | --- | --- | --- |
| Sesion expuesta en storage local | Alto | Media | Alta |
| Policy RLS permisiva o missing | Alto | Media | Alta |
| Realtime sin filtro de negocio | Alto | Baja | Alta |
| Dependencia vulnerable critica | Alto | Media | Alta |
| XSS con tokens accesibles | Alto | Media | Alta |
| Caches offline con negocio inactivo | Medio | Media | Media |

## Controles existentes relevantes
- PKCE habilitado en web.
- RLS con can_access_business en migraciones.
- Logs internos de errores.
- Funciones SECURITY DEFINER con search_path = public (proteccion contra search path injection).
- Acceso anon revocado en RPCs sensibles (solo create_business_for_current_user accesible por anon para flujo de registro).
- Rate limiting en Vercel Functions (auth, email, push, tables).

## Configuracion pendiente en Supabase Dashboard
- **Leaked Password Protection**: Ir a Authentication > Settings > Password Strength y habilitar "Leaked password protection". Previene el uso de contraseñas comprometidas verificando contra HaveIBeenPwned. Aplica para nuevos registros e inicios de sesion.

## Validacion rapida (operacional)
- RLS/Policies: `psql "$DB_URL" -v ON_ERROR_STOP=1 -X -f scripts/security/rls_audit.sql`
- Realtime (filtros web): `node scripts/security/realtime_filter_audit.mjs`
- Realtime (smoke/contract): `node scripts/realtime-audit/run-all.mjs`
- Reporte de seguridad: `psql "$DB_URL" -v ON_ERROR_STOP=1 -X -f scripts/security/security_audit_report.sql`
- Auditoria de Database Linter: revisar Supabase Dashboard > Database > Linter para nuevos warnings
