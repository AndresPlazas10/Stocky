# Migraciones BD para Aplicar al Final

Este archivo lista las migraciones de base de datos pendientes de este plan, en el orden exacto en que deben aplicarse al cierre.

## Orden

1. `20260306_0100_create_open_close_table_transaction_rpc.sql`

## Nota

- No aplicar estas migraciones durante pruebas intermedias si queremos mantener compatibilidad con el fallback del API.
- Aplicarlas justo antes del cierre final a producción.
