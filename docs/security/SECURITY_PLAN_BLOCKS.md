# Plan de Seguridad de la App (Bloques)

Fecha: 2026-03-09  
Scope: `apps/mobile`, `src` (web), `api`, `supabase` (RLS/RPC/functions), CI/CD.

## Objetivo

Reducir riesgo de fuga de datos multi-tenant, abuso de privilegios y exposición de secretos, dejando un gate mínimo de seguridad para cada release.

## KPIs de salida

- 0 tablas multi-tenant críticas sin RLS efectiva.
- 0 funciones RPC críticas ejecutables por `PUBLIC`/`anon`.
- 0 secretos reales en repo ni en logs de CI.
- 100% de endpoints backend con auth/tenant-check explícito.
- Pipeline con checks de seguridad bloqueantes en PR.

## Bloque 1: Inventario y Baseline de Seguridad

Objetivo: saber exactamente qué tenemos expuesto hoy.

Tareas:
- Inventario de superficie: tablas, RPCs, Edge functions, endpoints `api/*`.
- Matriz de datos sensibles (PII, credenciales, pagos, auditoría).
- Estado actual de grants (`PUBLIC`, `anon`, `authenticated`, `service_role`).
- Reporte inicial de dependencias vulnerables (`npm audit`).

Entregables:
- `docs/security/SECURITY_BASELINE.md`
- `docs/security/SECURITY_ASSET_INVENTORY.md`

Criterio de cierre:
- Inventario completo y priorización P0/P1/P2 con dueño por bloque.

## Bloque 2: Secrets y Configuración Segura

Objetivo: eliminar exposición de credenciales y endurecer config.

Tareas:
- Rotar credenciales usadas en pruebas/manuales.
- Estandarizar `.env.example` sin secretos reales.
- Definir checklist de secretos por entorno (local/staging/prod).
- Agregar escaneo de secretos en CI (git-secrets/gitleaks o equivalente).

Entregables:
- `docs/security/SECRETS_POLICY.md`
- Workflow CI de secret scanning.

Criterio de cierre:
- Ningún secreto real en git history nueva ni en artefactos de CI.

## Bloque 3: Auth y Sesión (Mobile/Web)

Objetivo: evitar uso indebido de sesión y spoofing de identidad.

Tareas:
- Revisar flujos de `auth.getSession/getUser` y reautenticación.
- Forzar uso de `auth.uid()` en backend/RPC para identidad real.
- Validar expiración/refresh y manejo de logout forzado.
- Endurecer manejo de errores para no filtrar detalles internos.

Entregables:
- `docs/security/AUTH_SESSION_HARDENING.md`
- Checklist de pruebas de sesión.

Criterio de cierre:
- Ningún flujo crítico confía solo en `userId` enviado por cliente.

## Bloque 4: RLS y Aislamiento Multi-tenant (P0)

Objetivo: asegurar aislamiento de datos por negocio.

Tareas:
- Auditoría tabla por tabla de RLS en entidades críticas:
  `businesses`, `employees`, `tables`, `orders`, `order_items`, `sales`,
  `sale_details`, `products`, `purchases`, `purchase_details`, `suppliers`.
- Verificar policies `USING` + `WITH CHECK` coherentes.
- Eliminar policies permisivas/legacy y scripts de bypass peligrosos del flujo operativo.
- Añadir tests SQL de aislamiento (owner/employee/no miembro).

Entregables:
- `docs/security/RLS_AUDIT_REPORT.md`
- migraciones de hardening RLS.

Criterio de cierre:
- Acceso cross-business bloqueado en pruebas automáticas.

## Bloque 5: RPC y Privilegios SQL (P0)

Objetivo: cerrar escaladas por funciones con privilegios.

Tareas:
- Auditoría de RPC `SECURITY DEFINER`: validar `auth.uid()` + `can_access_business`.
- Revocar `EXECUTE` a `PUBLIC/anon` en funciones sensibles.
- Revisar `search_path` fijo en todas las funciones definers.
- Revisar que inputs `p_user_id` no permitan impersonation.

Entregables:
- `docs/security/RPC_PRIVILEGE_AUDIT.md`
- migraciones de revoke/grant/hardening.

Criterio de cierre:
- Todas las RPC críticas pasan checklist de 6 controles (auth, tenant, grants, search_path, errores, logging).

## Bloque 6: API/Edge Functions Hardening

Objetivo: proteger integraciones backend y correo.

Tareas:
- Middleware de auth obligatorio en `api/*` y Edge Functions.
- Rate limiting por IP/usuario en endpoints sensibles.
- Validación estricta de payload (schema validation).
- CORS restrictivo por entorno.
- Sanitización de logs (sin tokens, emails completos, passwords).

Entregables:
- `docs/security/API_EDGE_HARDENING.md`
- tests de autorización en endpoints.

Criterio de cierre:
- Ningún endpoint sensible responde sin token válido y tenant válido.

## Bloque 7: Dependencias, SAST y CI Gate

Objetivo: prevención continua, no auditoría puntual.

Tareas:
- `npm audit` en CI con umbral bloqueante (al menos `high/critical`).
- ESLint/security rules y revisión de patrones inseguros.
- PR template con checklist de seguridad.
- Workflow único de `security-gate.yml` (secret scan + deps + tests auth).

Entregables:
- `.github/workflows/security-gate.yml`
- `docs/security/SECURITY_RELEASE_GATE.md`

Criterio de cierre:
- PR no mergeable si falla gate de seguridad.

## Bloque 8: Observabilidad, Respuesta e Incidentes

Objetivo: detectar y responder rápido.

Tareas:
- Estandarizar eventos de seguridad (auth fail, forbidden, rate-limit, acciones admin).
- Alertas mínimas (picos de 401/403, intentos repetidos, errores RPC críticos).
- Runbook de incidentes (contención, rotación de llaves, comunicación, postmortem).
- Simulación tabletop trimestral.

Entregables:
- `docs/security/SECURITY_RUNBOOK.md`
- `docs/security/INCIDENT_RESPONSE_PLAYBOOK.md`

Criterio de cierre:
- MTTR objetivo definido y proceso probado al menos una vez.

## Orden recomendado de ejecución

1. Bloque 1 (baseline)
2. Bloque 4 (RLS)
3. Bloque 5 (RPC/grants)
4. Bloque 2 (secrets)
5. Bloque 6 (API/Edge)
6. Bloque 7 (CI gate)
7. Bloque 3 (auth/session refinamiento)
8. Bloque 8 (observabilidad/IR)

## Ventana sugerida (4 semanas)

- Semana 1: Bloques 1 + 4
- Semana 2: Bloques 5 + 2
- Semana 3: Bloques 6 + 7
- Semana 4: Bloques 3 + 8 + cierre ejecutivo

## Definition of Done (global)

- Evidencia de tests de seguridad en CI.
- Documentación actualizada de controles.
- Riesgos residuales explícitos y aceptados.
- Checklist de release de seguridad firmado por responsable técnico.
