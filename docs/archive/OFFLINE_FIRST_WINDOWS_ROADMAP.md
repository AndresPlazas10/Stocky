# Plan de ejecución — Windows Offline-First (MVP Ventas)

## Objetivo
Entregar un MVP instalable para Windows 10/11 que permita operar `Ventas` sin internet, imprimir comprobante inmediatamente y sincronizar automáticamente al recuperar conexión.

## Decisiones cerradas (definidas)
- Plataforma inicial: **Windows 10/11**.
- Alcance MVP: **Ventas**.
- Tenancy: **1 cuenta = 1 negocio** (sin multisucrusal).
- Conflictos: **first-write**.
- Operación offline: **permitida indefinidamente**.
- Inventario: **bloquear venta si stock llega a 0**.
- Impresión: **permitida offline**, sincronización posterior.
- Enfoque de entrega: **MVP primero**, hardening después.

## Estado actual
- [x] Shell desktop con Electron listo.
- [x] Primer instalable `.exe` generado.
- [x] Outbox inicial para ventas (enqueue + flush por reconexión).
- [x] Snapshot local reactivado en runtime desktop.
- [x] Impresión de ventas offline en flujo de venta.

---

## Fase A — MVP funcional de Ventas (en curso)

### A1. Persistencia local y outbox
- [x] Estructura de evento `sale.create` con `idempotency_key`.
- [x] Estados base de outbox: `pending`, `processing`, `error`.
- [x] Auto-sync en reconexión + poll periódico.
- [x] Agregar `next_retry_at` con backoff exponencial.
- [x] Evitar reintentos agresivos ante errores permanentes.

### A2. UX de operación offline
- [x] Venta offline encola y devuelve éxito local.
- [x] Impresión de comprobante offline.
- [x] Descuento de stock local al vender offline.
- [x] Badge visible por venta: `Pendiente sync` / `Error sync` / `Sincronizada`.
- [x] Panel pequeño de estado de cola (`pendientes`, `errores`, último sync).

### A3. Reglas de negocio críticas
- [x] Bloqueo de venta por stock insuficiente.
- [x] Validar bloqueo con escenarios mixtos (productos + combos) totalmente offline.
- [x] Garantizar que no exista stock negativo local tras múltiples ventas consecutivas.

### A4. Sincronización y consistencia
- [x] Resolver mapeo de IDs temporales -> IDs remotos en UI/histórico.
- [x] Marcar venta local como sincronizada en snapshot una vez confirmada.
- [x] Manejar conflictos de first-write con mensaje accionable al usuario.

---

## Fase B — Validación de MVP (QA guiado)

### Checklist mínimo de aceptación
1. Crear venta online y verificar registro remoto.
2. Cortar internet y crear 3 ventas consecutivas.
3. Ver comprobantes impresos de esas 3 ventas.
4. Ver stock local actualizado y bloqueo en stock 0.
5. Reconectar internet.
6. Confirmar sincronización automática de las 3 ventas.
7. Confirmar que no se duplique ninguna venta (idempotencia).
8. Confirmar estado final de cola en 0 pendientes.

### Criterios de aceptación MVP
- Operación sin internet sin bloquear caja.
- Sincronización automática sin duplicados al reconectar.
- Impresión funcional offline.
- Bloqueo por stock 0 respetado offline.

---

## Fase C — Empaquetado y distribución controlada
- [x] Build local de instalador/portable.
- [x] Generar build **x64** además de arm64.
- [x] Definir canal beta (grupo piloto) y proceso de actualización.
- [x] Preparar pipeline de firma (scripts signed + guía operativa).
- [ ] Firma de binarios (cuando pase validación MVP).

---

## Comandos operativos
- Desktop dev: `npm run desktop:dev`
- Build Windows: `npm run desktop:build`
- Build Windows x64: `npm run desktop:build:x64`
- Build Windows arm64: `npm run desktop:build:arm64`
- Build Windows all: `npm run desktop:build:all`

## Entregables
- Instalador NSIS: `release/Stocky Setup *.exe`
- Portable: `release/Stocky *.exe`

## Siguiente paso inmediato
Ejecutar validación E2E de la Fase B (QA guiado) con foco en: reconexión sin duplicados, cierre offline de mesas, y consistencia de stock en escenarios mixtos (productos + combos).

Checklist operativo sugerido: `docs/OFFLINE_WINDOWS_QA_CHECKLIST.md`

Proceso beta sugerido: `docs/WINDOWS_BETA_CHANNEL.md`
Guía de firma: `docs/WINDOWS_CODE_SIGNING.md`
