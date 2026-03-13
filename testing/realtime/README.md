# Realtime Testing Toolkit

Este directorio contiene los artefactos de auditoria realtime.

## Estructura
- `sql/db_contract_snapshot.sql`: snapshot SQL de publication + RLS + policies + replica identity.
- `results/`: salidas JSON de cada paso de auditoria.
- `MANUAL_UI_CHECKLIST.md`: validacion funcional multi-sesion (web + mobile).

## Ejecucion recomendada
Desde la raiz del repo:

```bash
npm run audit:realtime
```

Comandos individuales:

```bash
npm run audit:realtime:map
npm run audit:realtime:db
npm run audit:realtime:smoke
npm run audit:realtime:report
```
