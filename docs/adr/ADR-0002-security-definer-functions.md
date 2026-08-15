# ADR-0002 - Uso extensivo de SECURITY DEFINER en RPCs

- Status: Accepted
- Date: 2026-07-18
- Owner: Engineering

## Context

El proyecto Stocky tiene ~75 funciones `SECURITY DEFINER` en el schema `public` llamadas via RPC desde el frontend (web y mobile). Supabase Database Linter genera warnings de tipo `authenticated_security_definer_function_executable` (0029) y `anon_security_definer_function_executable` (0028) para estas funciones.

El pattern de usar RPCs con `SECURITY DEFINER` en Supabase es objeto de debate en la comunidad. Las alternativas serian:

- `SECURITY INVOKER`: la funcion se ejecuta con los privilegios del usuario que la invoca. Requiere que las tablas tengan RLS correctamente configurado y cada operacion sea autorizada por politicas.
- Mover la logica al frontend: hacer multiples llamadas a la API REST de Supabase con las politicas RLS adecuadas.

## Decision

**Mantenemos `SECURITY DEFINER` para las RPCs existentes** con las siguientes mitigaciones obligatorias para cada funcion:

### Mitigaciones aplicadas

1. **`SET search_path = public`** en toda funcion `SECURITY DEFINER`. Previene search path injection attacks. Aplicado via migracion `20260718_0100`.

2. **`can_access_business()` en cada funcion**. Toda RPC que accede a datos de un negocio valida que `auth.uid()` tenga acceso al `business_id` correspondiente.

3. **Revocar `EXECUTE` a `anon`** en funciones que requieren autenticacion. Solo `create_business_for_current_user` mantiene acceso `anon` (necesario para el flujo de registro). Aplicado via migracion `20260718_0200`.

4. **`GRANT EXECUTE TO authenticated`** para cada funcion. Los usuarios no autenticados no pueden ejecutar las RPCs.

### Razones para mantener SECURITY DEFINER

| Razon | Descripcion |
|---|---|
| **Transacciones multi-tabla** | Operaciones como `create_sale_complete` necesitan actualizar sales, sale_details, products en una sola transaccion atomica |
| **Bypass controlado de RLS** | Las politicas RLS recursivas en consultas multi-tabla generan problemas de rendimiento y loops. `SECURITY DEFINER` con validacion explicita (`can_access_business`) es mas predecible |
| **Logica de negocio en DB** | Funciones como `persist_order_snapshot` implementan logica compleja de merge que no tiene equivalente en REST |
| **Idempotencia** | `create_sale_complete_idempotent` requiere consultar una tabla de idempotencia en la misma transaccion |
| **Performance** | Una RPC hace 1 round-trip vs N+1 llamadas REST. Critico en mobile con latencia variable |
| **Compatibilidad mobile/offline** | La app mobile y el modo offline dependen de RPCs para operaciones batch |

### Riesgo aceptado

El riesgo principal es que si una funcion `SECURITY DEFINER` tiene un bug de validacion de autorizacion, un usuario autenticado podria acceder a datos de otro negocio. Esto se mitiga con:
- `can_access_business()` como guard en cada funcion
- Auditoria periodica del codigo (ver `scripts/security/`)
- Tests E2E que verifican aislamiento entre negocios

## Alternativas descartadas

- **`SECURITY INVOKER` + RLS**: No viable para operaciones que requieren multiples tablas en una transaccion, porque cada tabla tendria que aplicar RLS independientemente, pudiendo generar estados inconsistentes.
- **Mover logica al frontend**: Aumentaria latencia y complejidad del codigo cliente, especialmente en mobile. Perderiamos atomicidad en operaciones criticas.
- **Mover funciones a un schema no expuesto**: Supabase REST API solo expone funciones del schema `public`. Moverlas a otro schema las haria inaccesibles desde el cliente.

## Consecuencias

- Database Linter seguira mostrando warnings 0029 para cada funcion. Estos warnings son **aceptados** con las mitigaciones documentadas aqui.
- Cada nueva funcion `SECURITY DEFINER` debe incluir `SET search_path = public`, validacion `can_access_business()`, y grants correctos (`REVOKE FROM PUBLIC/anon`, `GRANT TO authenticated`).
- Se requiere mantener la migracion dinamica de search_path (`20260718_0100`) como red de seguridad para funciones nuevas que no cumplan el estandar.
