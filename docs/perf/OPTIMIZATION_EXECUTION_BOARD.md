# Tablero de Ejecucion - Optimizacion Stocky

Fecha de inicio: 2026-03-24  
Estado general: En progreso

## Objetivos (KPI)
- p95 panel principal web < 1.5s
- p95 panel principal movil < 2.0s
- apertura de modal < 120ms
- error rate frontend < 1%
- fallos en operaciones criticas < 0.3%

## Estado de arranque (Dia 1)
- [x] Tablero operativo creado
- [x] Plantilla de captura creada
- [x] Baseline nuevo ejecutado
- [ ] 10 corridas por flujo en movil fisico
- [ ] 10 corridas por flujo en web

Notas:
- Baseline ejecutado: `2026-03-25T01:24:23.731Z` (15 corridas, warmup 2)
- Business resuelto por owner: `eae98029-91f4-403d-8b6c-5c5f34f71655`
- Cuello de botella actual (p95): `compras_initial_load = 1080.2ms`
- `mesa_open_order_load` quedo `SKIPPED` porque no habia mesas ocupadas con orden abierta en staging.

## Plan diario (14 dias)

### Dia 1 - Baseline inicial
- [x] Definir KPI y flujos
- [x] Definir plantilla de captura
- [ ] Medir login (10 corridas)
- [ ] Medir abrir mesas (10 corridas)
- [ ] Medir abrir ventas (10 corridas)
- [ ] Medir guardar orden (10 corridas)
- [ ] Medir crear compra/producto/combo (10 corridas)

### Dia 2 - Cuellos de botella
- [x] Extraer top 10 consultas lentas
- [x] Priorizar quick wins
- [x] Definir lista P0/P1

Evidencia:
- `docs/perf/OPTIMIZATION_DAY2_PRIORITIES.md`

### Dia 3 - Payload y paginacion
- [ ] Revisar RPC/listados (inventario, ventas, compras)
- [ ] Asegurar select minimo
- [ ] Validar paginacion activa

### Dia 4 - Indices y DB tuning
- [ ] Revisar indices en filtros clave
- [ ] Ajustar indices faltantes
- [ ] Rerun de comparacion

### Dia 5 - Realtime y rerenders
- [ ] Reducir invalidaciones redundantes
- [ ] Verificar actualizacion UI inmediata
- [ ] Validar cache por sesion con invalidacion puntual

### Dia 6 - Modales y scroll
- [ ] Normalizar comportamiento de modales
- [ ] Corregir scroll en modales largos
- [ ] Unificar espaciado/tamano

### Dia 7 - Toasts y feedback
- [ ] Unificar tipo de toast
- [ ] Corregir barra de progreso constante
- [ ] Eliminar loaders duplicados

### Dia 8 - Regresion funcional
- [ ] Pruebas completas por modulo
- [ ] Pruebas con datos altos
- [ ] Captura de defects

### Dia 9 - Correccion critica
- [ ] Resolver defects P0
- [ ] Rerun en movil fisico + web
- [ ] Cerrar bloqueantes

### Dia 10 - Build/repo hygiene
- [ ] Limpiar artefactos no versionables
- [ ] Validar `.gitignore` (.apk/.aab/temp)
- [ ] Medir build limpio

### Dia 11 - Release readiness
- [ ] Checklist release interno
- [ ] Validar legal/update/delete-account
- [ ] Generar APK de prueba

### Dia 12 - Hardening
- [ ] Security pass rapido
- [ ] Permisos minimos Android
- [ ] Validar bloqueo negocio inactivo

### Dia 13 - End-to-end
- [ ] E2E owner
- [ ] E2E empleado
- [ ] Go/No-Go

### Dia 14 - Cierre
- [ ] Congelar cambios
- [ ] Build final APK/AAB
- [ ] Preparar salida a pista cerrada/produccion

## Comandos utiles
```bash
# baseline (requiere credenciales validas en env)
npm run audit:perf:baseline

# budget check
npm run audit:perf:budget

# baseline + budget en CI local
npm run audit:perf:ci
```

## Evidencias requeridas
- `testing/perf/perf-baseline.json`
- `docs/perf/PERF_BASELINE.md`
- `docs/perf/BASELINE_CAPTURE_TEMPLATE.csv` (llenado con corridas manuales)
