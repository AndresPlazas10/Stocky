# Arquitectura Local-First + Electric para Stocky

## 0. Objetivo y alcance
Este documento define un blueprint implementable para migrar Stocky desde un modelo 100% online (Supabase directo) a un modelo **local-first + sync cloud**.

Objetivos operativos:
- Confirmar ventas/compras en local con latencia p95 < 200ms.
- Permitir operación offline real en caja.
- Sincronizar en segundo plano con Supabase.
- Mantener consistencia eventual y control de conflictos.

## 1. Estado actual (en el repo)
Acoplamiento principal:
- Cliente Supabase global en [src/supabase/Client.jsx](../src/supabase/Client.jsx)
- Lógica de ventas en [src/services/salesService.js](../src/services/salesService.js)
- Lógica de órdenes/mesas en [src/services/ordersService.js](../src/services/ordersService.js)
- Lógica de compras en [src/components/Dashboard/Compras.jsx](../src/components/Dashboard/Compras.jsx)
- Lectura tiempo real por Supabase en [src/hooks/useRealtime.js](../src/hooks/useRealtime.js)

Back-end SQL ya robusto (base útil para sync):
- RPC venta transaccional: `create_sale_complete`
- RPC compra transaccional: `create_purchase_complete`
- Idempotencia: `create_sale_complete_idempotent`
- Control inventario opcional (`manage_stock=true/false`)

## 2. Arquitectura objetivo
```
UI React
  -> Command API local (write path)
  -> Query API local (read path)

Local Postgres (PGlite recomendado)
  -> Tablas de negocio (subset/shape)
  -> outbox_events
  -> sync_state
  -> conflict_log

Sync Worker (background)
  -> PUSH: outbox -> Supabase RPC/API idempotente
  -> PULL: Electric Shapes -> local DB
  -> Reconciliación (ack/reject/compensación)

Supabase Postgres (canónico)
  -> RPCs transaccionales + RLS
  -> Electric sync service
```

Decisión clave:
- **Inventario se reconcilia por movimientos**, no por sobrescritura de `products.stock`.
- `products.stock` se mantiene como proyección/materialización.

## 3. Principios de diseño
1. UI nunca llama Supabase directo para operaciones de negocio críticas.
2. Toda mutación genera evento en `outbox_events`.
3. Toda mutación tiene `mutation_id` (UUID) idempotente.
4. Soft delete (`deleted_at`) en tablas sync; no hard delete inmediato.
5. Conflictos explícitos (registrados), no silenciosos.

## 4. Modelo de datos recomendado

### 4.1 Campos obligatorios en tablas sincronizadas
Agregar (si faltan):
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`
- `row_version bigint not null default 1`
- `origin_device_id text null`
- `origin_mutation_id uuid null`

Índices:
- `(business_id, updated_at desc)`
- `(business_id, deleted_at)` parcial `where deleted_at is null`
- unique parcial para `origin_mutation_id` cuando no es null

### 4.2 Tablas nuevas
`outbox_events` (local):
- `id uuid pk`
- `business_id uuid not null`
- `mutation_type text not null` (`sale.create`, `purchase.create`, `stock.adjust`, etc.)
- `payload jsonb not null`
- `mutation_id uuid not null unique`
- `base_versions jsonb null`
- `status text not null` (`pending`, `syncing`, `acked`, `rejected`)
- `retry_count int not null default 0`
- `last_error text null`
- `created_at`, `updated_at`

`sync_state` (local):
- cursor/offset por shape y tenant.

`inventory_movements` (local + cloud):
- `id uuid pk`
- `business_id uuid`
- `product_id uuid`
- `source_type text` (`sale`, `purchase`, `manual_adjust`, `void`)
- `source_id uuid`
- `delta numeric(12,2)` (+/-)
- `mutation_id uuid`
- `created_at`

`conflict_log` (local):
- guarda rechazos y compensaciones aplicadas.

## 5. Estrategia de conflictos

### 5.1 Catálogo (products, suppliers, customers)
- Política: `row_version` check (optimistic concurrency).
- Si version mismatch: rechazar y pedir refresh local.

### 5.2 Inventario
- Política: validación servidor al aplicar movimiento.
- Si stock insuficiente en cloud:
  - evento `rejected`
  - crear compensación local automática (`delta` inverso)
  - alertar en UI: "Venta requiere regularización"

### 5.3 Deletes
- Sólo soft delete en primera etapa.
- Compactación (hard delete) por job server-side con retención.

## 6. Flujo de venta offline (target)
1. Usuario confirma venta.
2. Transacción local:
   - insert `sales` (estado `pending_sync`)
   - insert `sale_details`
   - insert `inventory_movements` negativos
   - insert `outbox_events`
3. UI responde éxito inmediato.
4. Sync worker detecta red y envía mutación idempotente.
5. Cloud responde:
   - `acked`: marcar venta sincronizada
   - `rejected`: compensar inventario y marcar conflicto
6. Electric pull actualiza snapshots locales.

## 7. Estrategia multi-tenant
- Toda tabla sincronizable debe portar `business_id`.
- Shapes Electric por tenant y, cuando aplique, por ventana temporal:
  - `sales/purchases`: últimos N días + registros abiertos
  - `products/customers/suppliers`: dataset completo del tenant
- Validar aislamiento en gatekeeper/tokens.

## 8. Plan de implementación por código (repo actual)

### 8.1 Fase A - Anti-acoplamiento (sin cambiar UX)
Crear capa de acceso:
- `src/data/commands/*`
- `src/data/queries/*`
- `src/data/adapters/supabaseAdapter.js` (temporal)
- `src/data/adapters/localAdapter.js` (nuevo)

Reemplazar gradualmente imports de `supabase` en:
- [src/components/Dashboard/Ventas.jsx](../src/components/Dashboard/Ventas.jsx)
- [src/components/Dashboard/Compras.jsx](../src/components/Dashboard/Compras.jsx)
- [src/components/Dashboard/Mesas.jsx](../src/components/Dashboard/Mesas.jsx)
- [src/components/Dashboard/Inventario.jsx](../src/components/Dashboard/Inventario.jsx)
- [src/components/Dashboard/Facturas.jsx](../src/components/Dashboard/Facturas.jsx)

### 8.2 Fase B - Local DB + outbox
Implementar:
- `src/localdb/schema.sql` (espejo mínimo + outbox/sync_state/conflict_log)
- `src/localdb/client.js`
- `src/sync/outboxProcessor.js`
- `src/sync/reconciler.js`

### 8.3 Fase C - Integrar Electric pull
Implementar:
- `src/sync/electricSubscriber.js`
- `src/sync/shapeRegistry.js`
- `src/sync/syncBootstrap.js`

### 8.4 Fase D - Migrar writes críticos
Orden recomendado:
1. ventas
2. compras
3. mesas/orders
4. inventario manual y anulaciones

## 9. Feature flags recomendadas
- `FF_LOCAL_READ_PRODUCTS`
- `FF_LOCAL_WRITE_SALES`
- `FF_LOCAL_WRITE_PURCHASES`
- `FF_LOCAL_WRITE_ORDERS`
- `FF_ELECTRIC_PULL_ENABLED`
- `FF_CONFLICT_AUTO_COMPENSATION`

Rollout:
1. interno (1 negocio)
2. canary (5-10%)
3. gradual (25/50/100)

## 10. Observabilidad mínima obligatoria
Métricas:
- `local_command_latency_ms` (p50/p95/p99)
- `outbox_pending_count`
- `outbox_oldest_pending_seconds`
- `sync_ack_rate`
- `sync_reject_rate`
- `inventory_divergence_count`
- `time_to_convergence_seconds`

Alertas:
- `outbox_oldest_pending_seconds > 300`
- `sync_reject_rate > 2%` por 15 minutos
- divergencia de inventario por tenant > umbral

## 11. Riesgos y mitigaciones
1. Riesgo: doble fuente de verdad durante transición.
- Mitigación: feature flags + ownership claro (write path único por módulo).

2. Riesgo: conflictos de stock en alta concurrencia offline.
- Mitigación: ledger + compensación + cola de regularización.

3. Riesgo: fuga multi-tenant en sync.
- Mitigación: filtros shape estrictos + pruebas automáticas de aislamiento.

4. Riesgo: crecimiento de datos locales.
- Mitigación: políticas de TTL por tabla histórica + snapshotting.

## 12. Criterios de éxito (DoD arquitectura)
1. Venta offline confirmada localmente p95 < 200ms en hardware objetivo.
2. Operación continua sin internet durante al menos 8 horas.
3. Reconexión y convergencia automática < 5 minutos con backlog normal.
4. Rechazos de sync detectados y visibles en UI sin pérdida silenciosa.
5. Cero acceso directo a Supabase desde UI en módulos migrados.

## 13. Primera entrega técnica (sprint sugerido)
Semana 1:
- capa `commands/queries` + adapter Supabase temporal.
- remover accesos directos de `Ventas.jsx`.

Semana 2:
- local DB + outbox para ventas.
- métricas base de latencia local.

Semana 3:
- push idempotente ventas + reconciliación de rechazos.

Semana 4:
- activar piloto con `FF_LOCAL_WRITE_SALES`.

