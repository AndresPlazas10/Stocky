# Local Sync Dev Checklist (Fase B)

Guía corta para validar la infraestructura local-first en desarrollo, sin cambiar el write path productivo.

## 1) Activar flags
En `.env.local`:

```env
VITE_LOCAL_SYNC_ENABLED=true
VITE_LOCAL_SYNC_PREFER_PGLITE=true
VITE_LOCAL_SYNC_SHADOW_WRITES_ENABLED=true
VITE_LOCAL_SYNC_OUTBOX_REMOTE_VERIFY_ENABLED=true
VITE_LOCAL_SYNC_OUTBOX_POLL_MS=4000
VITE_LOCAL_SYNC_OUTBOX_BATCH_SIZE=20
VITE_LOCAL_SYNC_OUTBOX_MAX_RETRIES=5
VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_SIZE=100
VITE_LOCAL_SYNC_OUTBOX_RATE_WINDOW_MINUTES=15
VITE_LOCAL_SYNC_ELECTRIC_PULL_ENABLED=true
VITE_LOCAL_SYNC_READ_CACHE_TTL_MS=30000
VITE_LOCAL_SYNC_CRITICAL_ALERT_CONSECUTIVE_THRESHOLD=3
VITE_LOCAL_SYNC_CRITICAL_ALERT_COOLDOWN_MINUTES=15
VITE_LOCAL_SYNC_WRITE_ALL_LOCAL_FIRST=false
VITE_LOCAL_SYNC_WRITE_SALES_ENABLED=true
VITE_LOCAL_SYNC_WRITE_SALES_LOCAL_FIRST=true
VITE_LOCAL_SYNC_WRITE_PURCHASES_ENABLED=true
VITE_LOCAL_SYNC_WRITE_PURCHASES_LOCAL_FIRST=true
VITE_LOCAL_SYNC_WRITE_ORDERS_ENABLED=true
VITE_LOCAL_SYNC_WRITE_ORDERS_LOCAL_FIRST=true
VITE_LOCAL_SYNC_WRITE_TABLES_ENABLED=true
VITE_LOCAL_SYNC_WRITE_TABLES_LOCAL_FIRST=true
VITE_LOCAL_SYNC_WRITE_PRODUCTS_ENABLED=true
VITE_LOCAL_SYNC_WRITE_PRODUCTS_LOCAL_FIRST=true
VITE_LOCAL_SYNC_WRITE_SUPPLIERS_ENABLED=true
VITE_LOCAL_SYNC_WRITE_SUPPLIERS_LOCAL_FIRST=true
VITE_LOCAL_SYNC_WRITE_INVOICES_ENABLED=true
VITE_LOCAL_SYNC_WRITE_INVOICES_LOCAL_FIRST=true
VITE_LOCAL_SYNC_READ_PRODUCTS_ENABLED=true
VITE_LOCAL_SYNC_READ_SALES_ENABLED=true
VITE_LOCAL_SYNC_READ_PURCHASES_ENABLED=true
VITE_LOCAL_SYNC_READ_ORDERS_ENABLED=true
VITE_LOCAL_SYNC_READ_INVENTORY_ENABLED=true
VITE_LOCAL_SYNC_READ_INVOICES_ENABLED=true
```

### Perfil canary mínimo (recomendado inicio)

```env
VITE_LOCAL_SYNC_ENABLED=true
VITE_LOCAL_SYNC_ELECTRIC_PULL_ENABLED=true
VITE_LOCAL_SYNC_READ_PRODUCTS_ENABLED=true
VITE_LOCAL_SYNC_READ_ORDERS_ENABLED=true
VITE_LOCAL_SYNC_SHADOW_WRITES_ENABLED=true

# Writes local-first aún desactivados en canary inicial
VITE_LOCAL_SYNC_WRITE_ALL_LOCAL_FIRST=false
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

Con `VITE_LOCAL_SYNC_OUTBOX_REMOTE_VERIFY_ENABLED=true`, los handlers intentan hacer `push + verify` remoto antes de `acked`.

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
