# Instrucciones para agentes de IA (Copilot)

Propósito: ayudar a agentes de IA a ser productivos rápidamente en este repositorio Stocky.

- **Resumen arquitectural (rápido):** front-end React + Vite en `src/`, backend ligero en Supabase (Postgres + Auth) con funciones SQL y RLS en `docs/sql` / `verify_table_structure.sql`. Pequeñas funciones serverless/API en `api/` (por ejemplo `api/send-email.js`) usadas para envíos de email y lógica que no corre en el cliente.

- **Comandos esenciales:**
  - Desarrollo: `npm run dev` (Vite)
  - Build producción: `npm run build`
  - Preview producción: `npm run preview`
  - Lint: `npm run lint`
  - Reinstalar/depth-clean: `npm run reinstall`
  - Ver requisitos Node: `node >= 18` (ver `package.json`)

- **Variables de entorno / Setup local:** copia `.env.example` a `.env.local` y coloca las claves de Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Para detalles ver `docs/setup/ENV_SETUP.md` y `docs/setup/FACTURACION_SETUP.md`.

- **Patrones y convenciones del proyecto:**
  - Multi-tenant y seguridad mediante Row Level Security (RLS). Cualquier cambio en consultas/roles deberá validar RLS en `docs/` y con los SQL de setup.
  - Autenticación: Magic Link con Supabase Auth (cliente). Evitar crear flujos de contraseña ad-hoc.
  - Emails: integración con `resend` y `@emailjs/browser`; revisar `api/send-email.js` y plantilla `PLANTILLA_EMAIL_MODERNA.html` para ejemplos.
  - Idempotencia / anti-duplicados: hay documentación y ejemplos en `docs/IDEMPOTENCY_ARCHITECTURE.md` y `docs/IMPLEMENTACION_ANTI_DUPLICADOS.md`. Preferir esos patrones para endpoints que crean recursos (facturas, ventas).

- **Estructura importante (rápida):**
  - `src/` : UI React, rutas y componentes.
  - `api/` : funciones node serverless (Vercel) y endpoints auxiliares.
  - `supabase/` : helpers y scripts relacionados con Supabase (si existen implementaciones client-side aquí).
  - `docs/` : guías técnicas (RLS, facturación, SQL setup, deploy). Leer antes de tocar bases de datos o seguridad.
  - `scripts/` : utilidades y SQL de verificación como `scripts/check-functions.sql`.

- **Flujo de datos típico:** UI (`src/`) usa `@supabase/supabase-js` para lectura/escritura; operaciones críticas (facturación, generación de números de factura) se soportan con SQL en `docs/` y funciones server-side para garantizar atomicidad e idempotencia.

- **Despliegue:** proyecto preparado para Vercel (`vercel.json`) — las funciones en `api/` se despliegan como lambdas/servicios serverless. Revisar `vercel.json` y `package.json` scripts antes de ajustar pipeline.

- **Dónde buscar ejemplos concretos:**
  - Test/manual de creación de venta: `test-sale-creation.js` (ejemplo de uso / scripts de prueba).
  - Validación de estructura DB: `verify_table_structure.sql` y `docs/sql`.
  - Email & plantilla: `api/send-email.js` y `PLANTILLA_EMAIL_MODERNA.html`.

- **Qué evitar / notas de seguridad:**
  - No exponer claves de servicio en el cliente; usar funciones serverless para operaciones sensibles.
  - Respetar las reglas RLS: cualquier cambio que altere esquema/roles requiere revisar `docs/` y la guía de facturación (`docs/setup/FACTURACION_SETUP.md`).

- **Si no sabes dónde empezar:**
  1. Leer `docs/INDEX.md` → guías rápidas.
 2. Levantar local con `npm install && npm run dev` y abrir `http://localhost:5173`.
 3. Revisar `test-sale-creation.js` para flujo de ventas de ejemplo.

Si algo no está claro, dime qué sección prefieres que amplíe o muestra ejemplos concretos (endpoints, componentes o SQL) y lo desarrollo.
