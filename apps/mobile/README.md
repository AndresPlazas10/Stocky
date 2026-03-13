# Stocky Mobile (Expo)

## Requisitos

- Node 18+
- Expo CLI (vía `npx expo`)

## Inicio rápido

1. Instalar dependencias:

```bash
npm install
```

2. Crear entorno local:

```bash
cp .env.example .env
```

3. Iniciar app:

```bash
npm run start
```

## Variables

- `EXPO_PUBLIC_API_BASE_URL`: URL base de backend (ejemplo: `https://www.stockypos.app`)
- `EXPO_PUBLIC_MOBILE_VERSION`: valor para header `X-Stocky-Client-Version`
- `EXPO_PUBLIC_EAS_PROJECT_ID`: Project ID de EAS (requerido para token Expo Push)
- `EXPO_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: anon key de Supabase para login del cliente móvil

## Notificaciones push (inicio)

- Se registra token push al iniciar sesión (si el usuario concede permisos).
- El token se sincroniza en `public.mobile_push_tokens` en Supabase por `user_id + installation_id`.
- Requiere dispositivo físico para obtener token push.
- En Android SDK 53+, Expo Go no soporta push remoto: usar dev build (`eas build --profile development`).

## Dev Build (push Android)

1. Instalar dependencias del proyecto y login en EAS:

```bash
npm install
eas login
eas project:init
```

2. Configurar credenciales Android (FCM V1):

```bash
eas credentials -p android
```

3. Generar build de desarrollo:

```bash
eas build -p android --profile development
```

4. Ejecutar bundler para dev client:

```bash
npm run start -- --dev-client
```

## Comportamiento inicial

Flujo base:

- `AuthScreen`: login/signup con Supabase Auth (sesión persistente en AsyncStorage)
- `DashboardApp`: navegación drawer (`Header + Drawer + Content`) con `SectionId` unificado
- `HomeSection`: sesión activa + smoke checks contra backend versionado + panel real de Mesas

Checks iniciales:

- `POST /api/v2/open-close-table`
- `POST /api/v2/send-email`

Siempre envía:

- `X-Stocky-Client: mobile`
- `X-Stocky-Client-Version: <EXPO_PUBLIC_MOBILE_VERSION>`

## Mesas (v2)

- Carga negocio por usuario autenticado (owner o employee activo).
- Lista mesas desde Supabase (`tables` + `orders!current_order_id`).
- Ejecuta abrir/cerrar por API:
  - `POST /api/v2/open-close-table`
  - con Bearer token de sesión Supabase.

## Feature flags por sección

Variables soportadas:

- `EXPO_PUBLIC_FEATURE_HOME`
- `EXPO_PUBLIC_FEATURE_VENTAS`
- `EXPO_PUBLIC_FEATURE_COMPRAS`
- `EXPO_PUBLIC_FEATURE_INVENTARIO`
- `EXPO_PUBLIC_FEATURE_COMBOS`
- `EXPO_PUBLIC_FEATURE_PROVEEDORES`
- `EXPO_PUBLIC_FEATURE_EMPLEADOS`
- `EXPO_PUBLIC_FEATURE_REPORTES`
- `EXPO_PUBLIC_FEATURE_CONFIGURACION`

Comportamiento:

- Si la sección está `false`, sigue visible en drawer pero muestra fallback `Próximamente`.
- `home` se considera habilitada por defecto.
- En `apps/mobile/.env.example`, `reportes` y `configuración` vienen habilitadas (`true`).
