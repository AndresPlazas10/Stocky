# Documentacion Stocky

Indice principal de documentacion tecnica y operativa.

## Estado de referencia (Febrero 2026)

- Stack actual: React 19, Vite 7, Supabase JS 2.x.
- Sincronizacion local-first habilitable por flags.
- Facturacion operativa activa en app.
- Integracion Siigo interna removida de runtime (estado sunset documentado).

## 1. Inicio y setup

- `../README.md`: arranque del proyecto, scripts y entorno.
- `setup/QUICK_START.md`: guia rapida.
- `setup/FACTURACION_SETUP.md`: setup funcional de facturacion/BD.
- `sql/supabase_functions.sql`: script base de funciones y estructura.

## 2. Email y comprobantes

- `setup/CONFIGURAR_EMAILJS.md`: configuracion EmailJS.
- `setup/RESEND_SETUP.md`: configuracion Resend.
- `setup/EMAIL_CONFIGURATION.md`: referencia de configuracion de correo.
- `guides/ENVIO_FACTURAS.md`: flujo funcional de envio.

## 3. Sincronizacion local-first

- `ARQUITECTURA_LOCAL_FIRST_ELECTRICSQL.md`: arquitectura general.
- `LOCAL_SYNC_DEV_CHECKLIST.md`: checklist para pruebas y diagnostico.
- `GUIA_TECNICA_REALTIME.md`: detalles de realtime y consistencia.

## 4. Despliegue

- `DEPLOY.md`: guia principal de despliegue.
- `DEPLOY_GUIDE.md`: guia extendida.
- `DEPLOYMENT_CHECKLIST.md`: checklist de produccion.
- `COMANDOS_DEPLOY.md`: comandos operativos.

## 5. Seguridad y RLS

- `AUDITORIA_SEGURIDAD.md`: auditoria y hallazgos.
- `GUIA_RLS.md`: conceptos y operacion.
- `sql/README_RLS.md`: scripts y notas RLS.

## 6. Facturacion legacy (Siigo)

Documentacion historica y de referencia:

- `INTEGRACION_SIIGO.md`
- `FACTURACION_OPCIONAL.md`
- `adr/ADR-0001-siigo-legacy-strategy.md` (decision oficial)

Codigo relacionado (para consolidacion/migracion):

- Runtime legacy removido en PR-4 (hooks/services/context/componentes Siigo).
- Edge Function `siigo-invoice` removida del repositorio activo.
- Referencia de decision: `adr/ADR-0001-siigo-legacy-strategy.md`.

Estado esperado:

- Integracion Siigo interna en modo sunset.
- Stocky runtime no debe exponer generacion de factura electronica Siigo.

## 7. Pruebas

- Carpeta: `../testing/`
- Comando: `npm run test -- --run`

Nota: la cobertura actual es limitada frente al dominio. Priorizar tests de Mesas, sync offline/online, facturacion y email.

## 8. Diagnosticos y reportes tecnicos

La carpeta `docs/` incluye multiples analisis historicos (`ANALISIS_*`, `SOLUCION_*`, `RESUMEN_*`).
Usarlos como contexto, no como fuente unica de verdad de arquitectura actual.

## Convenciones

- Si hay conflicto entre documentos, manda el codigo fuente en `src/`.
- Actualizar este indice cuando se agreguen o retiren guias.
