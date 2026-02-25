# Local Sync Dev Checklist (Fase B)

Guía corta para validar la infraestructura local-first en desarrollo, sin cambiar el write path productivo.

## 1) Activar flags
En `.env.local`:

```env
VITE_LOCAL_SYNC_ENABLED=true
VITE_LOCAL_SYNC_PREFER_PGLITE=true
VITE_LOCAL_SYNC_SHADOW_WRITES=true
VITE_LOCAL_SYNC_VERIFY_REMOTE=true
VITE_LOCAL_SYNC_OUTBOX_POLL_MS=4000
VITE_LOCAL_SYNC_OUTBOX_BATCH_SIZE=20
VITE_LOCAL_SYNC_OUTBOX_MAX_RETRIES=5
VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_SIZE=100
VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_MINUTES=15
VITE_ELECTRIC_PULL_ENABLED=false
VITE_LOCAL_SYNC_READ_CACHE_TTL_MS=30000
VITE_FF_LOCAL_WRITE_SALES=true
VITE_FF_LOCAL_FIRST_SALES=true
VITE_FF_LOCAL_WRITE_PURCHASES=true
VITE_FF_LOCAL_FIRST_PURCHASES=true
VITE_FF_LOCAL_WRITE_ORDERS=true
VITE_FF_LOCAL_FIRST_ORDERS=true
VITE_FF_LOCAL_WRITE_TABLES=true
VITE_FF_LOCAL_FIRST_TABLES=true
VITE_FF_LOCAL_FIRST_ALL=true
VITE_FF_LOCAL_WRITE_PRODUCTS=true
VITE_FF_LOCAL_FIRST_PRODUCTS=true
VITE_FF_LOCAL_WRITE_SUPPLIERS=true
VITE_FF_LOCAL_FIRST_SUPPLIERS=true
VITE_FF_LOCAL_WRITE_INVOICES=true
VITE_FF_LOCAL_FIRST_INVOICES=true
VITE_FF_LOCAL_READ_PRODUCTS=true
VITE_FF_LOCAL_READ_SALES=true
VITE_FF_LOCAL_READ_PURCHASES=true
VITE_FF_LOCAL_READ_ORDERS=true
VITE_FF_LOCAL_READ_INVENTORY=true
VITE_FF_LOCAL_READ_INVOICES=true
```

Reiniciar `npm run dev`.

## 2) Verificar health
Abrir consola del navegador:

```js
await window.stockyLocalSync.health()
```

Esperado:
- `enabled: true`
- `initialized: true`
- `adapter: "pglite"` o `"localstorage"`
- `convergence.sampleSize` creciendo después de `acked`
- `outboxRates.ackRate` / `outboxRates.rejectRate` con valores > 0 cuando hay eventos terminales
- `outboxRates.windowSize` y `outboxRates.windowMinutes` según tus flags

## 3) Generar eventos de outbox
Opciones:
- Crear/eliminar compras (módulo Compras).
- Eliminar ventas (módulo Ventas).
- O prueba directa:

```js
await window.stockyLocalSync.outbox.enqueueDebug({ from: 'manual-check' })
await window.stockyLocalSync.outbox.pending()
```

## 4) Forzar ciclo de procesamiento
```js
await window.stockyLocalSync.tick()
await window.stockyLocalSync.outbox.acked()
await window.stockyLocalSync.outbox.rejected()
await window.stockyLocalSync.convergence.list()
```

Con `VITE_LOCAL_SYNC_VERIFY_REMOTE=true`, los handlers intentan hacer `push + verify` remoto antes de `acked`.

## 5) Revisar conflictos
```js
await window.stockyLocalSync.conflicts()
```

## 6) Limpiar outbox (si necesitas reset)
```js
await window.stockyLocalSync.outbox.clear()
await window.stockyLocalSync.cache.clear()
await window.stockyLocalSync.convergence.clear()
```
