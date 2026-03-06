# Checklist Final de Release (Migraciones al Final)

Este checklist sigue el orden acordado: **primero app/API**, **migraciones BD al final**.

## 1) Validación pre-release (local/CI)

1. `npm run lint`
2. `npm run test`
3. `npm run build`
4. Confirmar que no hay errores en logs del build.

## 2) Variables de entorno (antes de deploy)

Cliente:
- `VITE_APP_URL`
- `VITE_RESEND_FROM_EMAIL`
- `VITE_RESEND_ENABLED`

Servidor (Vercel/API):
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## 3) Deploy de app/API (sin migraciones todavía)

1. Desplegar frontend + funciones serverless.
2. Verificar endpoint `api/open-close-table` en producción con fallback activo.
3. Smoke test rápido:
   - Abrir mesa.
   - Agregar/quitar item.
   - Cerrar mesa.
   - Reabrir/operar otra mesa.

## 4) Aplicar migraciones BD (último paso)

Aplicar **en este orden exacto** (ver [FINAL_DB_MIGRATIONS_ORDER.md](/Users/pipe/Desktop/Stocky/docs/FINAL_DB_MIGRATIONS_ORDER.md)):

1. `supabase/migrations/20260306_0100_create_open_close_table_transaction_rpc.sql`

Comando recomendado (automatizado):

1. `scripts/apply-final-db-migrations.sh` (dry-run, valida orden/archivos)
2. `DATABASE_URL='postgres://...' scripts/apply-final-db-migrations.sh --apply`

## 5) Smoke test post-migración

1. Repetir flujo de mesas (abrir/agregar/cerrar).
2. Confirmar que ya se usa RPC transaccional sin errores.
3. Validar que no aparecen inconsistencias de `current_order_id` en `tables`.

## 6) Criterio de salida

Release aprobado si:
1. `lint/test/build` en verde.
2. Flujo de mesas estable antes y después de migración.
3. Envío de email funcionando con variables server-side.
