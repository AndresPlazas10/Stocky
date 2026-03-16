-- Reporte operativo de seguridad (manual)
-- Ejecutar con rol de servicio usando DB_URL

\echo '== Eventos recientes (200) =='
SELECT id, business_id, user_id, action, created_at
FROM public.security_audit_logs
ORDER BY created_at DESC
LIMIT 200;

\echo ''
\echo '== Conteo por accion (ultimos 7 dias) =='
SELECT action, COUNT(*) AS total
FROM public.security_audit_logs
WHERE created_at >= now() - interval '7 days'
GROUP BY action
ORDER BY total DESC, action;

\echo ''
\echo '== Eventos fuera de horario (Bogota, ultimos 7 dias) =='
SELECT id, business_id, user_id, action, created_at
FROM public.security_audit_logs
WHERE created_at >= now() - interval '7 days'
  AND (
    EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Bogota') < 6
    OR EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Bogota') >= 23
  )
ORDER BY created_at DESC
LIMIT 200;

\echo ''
\echo '== Bloqueos por negocio inactivo (ultimos 30 dias) =='
SELECT business_id, COUNT(*) AS total, MAX(created_at) AS last_seen
FROM public.security_audit_logs
WHERE action = 'business_inactive_blocked'
  AND created_at >= now() - interval '30 days'
GROUP BY business_id
ORDER BY total DESC;
