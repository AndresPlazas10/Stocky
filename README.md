# Stocky

Sistema POS multi-tenant con inventario, ventas, compras, mesas, proveedores, empleados, reportes y facturacion operativa para negocios de retail/restaurante.

## Estado actual

- Frontend: React 19 + Vite 7.
- Backend: Supabase (PostgreSQL + Auth + Realtime).
- Arquitectura operativa: 100% online (sin persistencia local-first/outbox).
- Flujo de facturacion/comprobantes activo en app.
- Integracion Siigo interna removida de runtime (modo sunset documentado por ADR).

## Modulos principales

- `Home/Mesas`: apertura de mesa, ordenes, cierre de venta, sincronizacion offline/online.
- `Home/Mesas`: apertura de mesa, ordenes y cierre de venta online.
- `Ventas`: registro de ventas y trazabilidad.
- `Compras`: registro de compras e impacto en stock.
- `Inventario`: productos, stock, precios.
- `Combos`: gestion de combos para POS.
- `Facturas`: gestion de comprobantes/facturas operativas.
- `Proveedores`, `Empleados`, `Clientes`, `Reportes`, `Configuracion`.

## Requisitos

- Node.js `>=18`
- npm `>=9`
- Proyecto Supabase activo

## Inicio rapido

1. Instalar dependencias:

```bash
npm install
```

2. Crear entorno local:

```bash
cp .env.example .env.local
```

3. Configurar al menos en `.env.local`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

4. Aplicar SQL base en Supabase:

- Script principal: `docs/sql/supabase_functions.sql`

5. Levantar entorno de desarrollo:

```bash
npm run dev
```

6. Abrir `http://localhost:5173`

## Scripts

- `npm run dev`: servidor de desarrollo.
- `npm run build`: build de produccion.
- `npm run preview`: servir build local.
- `npm run lint`: validacion ESLint.
- `npm run test`: pruebas (`node --test testing/**/*.test.js`).
- `npm run check`: lint + build.
- `npm run predeploy`: lint + test + build.

## Variables de entorno

Referencia completa en `.env.example`.

Minimo requerido para arrancar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Opcionales comunes:

- Email: `VITE_EMAILJS_*`, `VITE_RESEND_*`, `VITE_TEST_EMAIL`
- App URL: `VITE_APP_URL`
- Flags `VITE_LOCAL_SYNC_*` y `VITE_FF_LOCAL_*` se mantienen por compatibilidad, pero en runtime están desactivadas por rollback online-only.

## Estado online-only

Stocky opera en modo online-only:

- No guarda datos offline para sincronizar después.
- Si no hay conexión, muestra: `Perdiste la conexión, intentando reconectar...`.
- Al reconectar, reanuda operaciones directas contra Supabase.

SQL recomendado de rollback/aseguramiento:

- `scripts/ROLLBACK_ONLINE_ONLY.sql`

Documentación histórica (no vigente en runtime):

- `docs/ARQUITECTURA_LOCAL_FIRST_ELECTRICSQL.md`
- `docs/LOCAL_SYNC_DEV_CHECKLIST.md`

## Calidad y pruebas

Comandos recomendados antes de merge:

```bash
npm run lint
npm run test -- --run
npm run build
```

## Despliegue

- Guia principal: `docs/DEPLOY.md`
- Comandos utiles: `docs/COMANDOS_DEPLOY.md`
- Checklist: `docs/DEPLOYMENT_CHECKLIST.md`

## Documentacion

Indice actualizado:

- `docs/INDEX.md`

## Notas tecnicas

- El proveedor de email unificado usa autodeteccion real (Resend con fallback a EmailJS).
- La integracion Siigo interna en runtime fue removida; ver `docs/adr/ADR-0001-siigo-legacy-strategy.md`.
- Framer Motion se ejecuta de forma nativa (se removio shim/CSS global que anulaba animaciones).

## Licencia

MIT. Ver `LICENSE`.
