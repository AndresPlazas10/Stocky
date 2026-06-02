<div align="center">

# 🛒 Stocky

### Sistema POS Multiplataforma para Restaurantes y Retail

[![CI](https://github.com/AndresPlazas10/Stocky/workflows/CI/badge.svg)](https://github.com/AndresPlazas10/Stocky/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.0.0-blue.svg)](https://react.dev/)
[![Expo](https://img.shields.io/badge/expo-54.0.0-black.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/supabase-2.98.0-3ECF8E.svg)](https://supabase.com/)

[Web App](https://stockypos.app) • [Documentación](docs/INDEX.md) • [Reportar Bug](https://github.com/AndresPlazas10/Stocky/issues)

</div>

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Plataformas](#-plataformas)
- [Inicio Rápido](#-inicio-rápido)
- [Scripts Disponibles](#-scripts-disponibles)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Variables de Entorno](#-variables-de-entorno)
- [Testing](#-testing)
- [Despliegue](#-despliegue)
- [Contribuir](#-contribuir)
- [FAQ](#-faq)
- [Roadmap](#-roadmap)
- [Licencia](#-licencia)

---

## ✨ Características

### 🏪 Gestión de Negocio

| Módulo | Descripción |
|--------|-------------|
| 🍽️ **Mesas** | Apertura de mesas, gestión de órdenes, cierre de ventas, sincronización en tiempo real |
| 💰 **Ventas** | Registro de ventas con múltiples métodos de pago, trazabilidad completa |
| 📦 **Compras** | Registro de compras a proveedores, impacto automático en inventario |
| 📊 **Inventario** | Gestión de productos, control de stock, precios, alertas de stock bajo |
| 🎁 **Combos** | Creación y gestión de combos para POS |
| 🧾 **Facturas** | Generación de comprobantes y facturas operativas |
| 👥 **Empleados** | Gestión de empleados con roles y permisos |
| 🏢 **Proveedores** | Base de datos de proveedores |
| 📈 **Reportes** | Análisis de ventas, compras e inventario |
| ⚙️ **Configuración** | Personalización del sistema |

### 🎯 Características Técnicas

- **Multi-tenant**: Arquitectura preparada para múltiples negocios
- **Tiempo Real**: Sincronización instantánea con Supabase Realtime
- **Offline-First**: Outbox pattern para ventas sin conexión (web)
- **Impresión Bluetooth**: Soporte para impresoras térmicas vía Print Bridge
- **PWA**: Instalable como aplicación web progresiva
- **Autenticación Segura**: Supabase Auth con PKCE
- **Multiplataforma**: Web, iOS, Android, Windows, macOS

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTES                                │
├──────────────┬──────────────┬────────────────────────────────┤
│   Web App    │  Mobile App  │      Desktop App               │
│  React + Vite│  Expo + RN   │        Electron                │
│              │              │                                │
│  localhost   │  localhost   │      localhost                 │
│    :5173     │    :8081     │        :5173                   │
└──────┬───────┴──────┬───────┴──────────┬─────────────────────┘
       │              │                  │
       └──────────────┼──────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Print Bridge Apps    │
         │  (Android / Windows)   │
         │   localhost:41780      │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Impresoras Térmicas  │
         │      (Bluetooth)       │
         └────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      BACKEND                                 │
├─────────────────────────────────────────────────────────────┤
│                    Supabase Platform                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │PostgreSQL│  │   Auth   │  │ Realtime │  │   Storage  │ │
│  │  + RLS   │  │  + JWT   │  │ Channels │  │  (assets)  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend Web** | React 19, Vite 7, TypeScript, Tailwind CSS |
| **Frontend Mobile** | React Native 0.76, Expo 54, TypeScript |
| **Desktop** | Electron 37 |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| **Estado** | React Hooks + Supabase Realtime |
| **Testing** | Vitest, React Testing Library, Playwright |
| **CI/CD** | GitHub Actions, Vercel, EAS Build |

---

## 📱 Plataformas

### 🌐 Web App

Aplicación web progresiva (PWA) instalable.

```bash
# Desarrollo
npm run dev
# Abre http://localhost:5173
```

**Características:**
- ✅ Instalable como PWA
- ✅ Modo offline con outbox pattern
- ✅ Impresión vía Print Bridge
- ✅ Responsive design

### 📱 Mobile App

Aplicación nativa para iOS y Android.

```bash
# Desarrollo
cd apps/mobile
npm start
# Escanea el QR con Expo Go
```

**Características:**
- ✅ Impresión Bluetooth nativa
- ✅ Notificaciones push
- ✅ Autenticación biométrica
- ✅ Modo offline parcial

### 🖥️ Desktop App

Aplicación de escritorio para Windows y macOS.

```bash
# Desarrollo
npm run desktop:dev
# Build para producción
npm run desktop:build
```

**Características:**
- ✅ Integración nativa con SO
- ✅ Impresión directa
- ✅ Auto-actualizaciones
- ✅ Modo offline completo

### 🖨️ Print Bridge

Aplicaciones auxiliares para impresión Bluetooth.

#### Android
```bash
cd apps/print-bridge-android
./build-apk.sh
# Instala el APK en tu dispositivo Android
```

#### Windows
```bash
cd apps/print-bridge-windows
npm install
npm run build
# Ejecuta el instalador en release/
```

**Características:**
- ✅ Servidor HTTP local (puerto 41780)
- ✅ Soporte ESC/POS
- ✅ Configuración de papel (58mm, 80mm, 104mm)
- ✅ Apertura de cajón monedero

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js `>=18.0.0`
- npm `>=9.0.0`
- Cuenta de Supabase (gratuita)
- Para mobile: Expo CLI (`npm install -g expo-cli`)

### 1️⃣ Clonar e Instalar

```bash
git clone https://github.com/AndresPlazas10/Stocky.git
cd Stocky
npm install
```

### 2️⃣ Configurar Entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 3️⃣ Configurar Base de Datos

Aplica las migraciones SQL en tu proyecto Supabase:

```bash
# Funciones principales
psql -h db.tu-proyecto.supabase.co -U postgres -f docs/sql/supabase_functions.sql

# Migraciones adicionales (si aplica)
psql -h db.tu-proyecto.supabase.co -U postgres -f docs/sql/migrations/*.sql
```

### 4️⃣ Iniciar Desarrollo

#### Web App
```bash
npm run dev
# Abre http://localhost:5173
```

#### Mobile App
```bash
cd apps/mobile
npm start
# Escanea el QR con Expo Go (iOS/Android)
```

#### Desktop App
```bash
npm run desktop:dev
# Se abre la ventana de Electron
```

---

## 🛠️ Scripts Disponibles

### Desarrollo

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia servidor de desarrollo (Vite) |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | Ejecuta ESLint |
| `npm run lint:fix` | Corrige errores de lint automáticamente |

### Testing

| Script | Descripción |
|--------|-------------|
| `npm run test:unit` | Tests unitarios (Vitest) - **98 tests** |
| `npm run test:e2e` | Tests E2E (Playwright) - **5 tests** |
| `npm run test:offline` | Tests de modo offline |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:coverage` | Tests con reporte de cobertura |

### Auditoría

| Script | Descripción |
|--------|-------------|
| `npm run audit:realtime:map` | Mapea canales de Realtime |
| `npm run audit:realtime:smoke` | Test de humo de Realtime |
| `npm run audit:perf:baseline` | Genera baseline de performance |
| `npm run audit:perf:budget` | Valida budget de performance |
| `npm run audit:security` | Auditoría de seguridad |

### Mobile

| Script | Descripción |
|--------|-------------|
| `npm run mobile:start` | Inicia Expo dev server |
| `npm run mobile:android` | Ejecuta en Android |
| `npm run mobile:ios` | Ejecuta en iOS |
| `npm run mobile:typecheck` | Typecheck de TypeScript |

### Desktop

| Script | Descripción |
|--------|-------------|
| `npm run desktop:dev` | Desarrollo con Electron |
| `npm run desktop:build` | Build para producción |
| `npm run desktop:build:win` | Build para Windows |
| `npm run desktop:build:mac` | Build para macOS |

### Despliegue

| Script | Descripción |
|--------|-------------|
| `npm run predeploy` | Lint + test + build |
| `npm run deploy` | Despliega a Vercel |
| `npm run deploy:prod` | Despliega a producción |

---

## 📁 Estructura del Proyecto

```
Stocky/
├── src/                          # Aplicación web
│   ├── components/               # Componentes React
│   │   ├── Dashboard/           # Módulos principales
│   │   ├── ui/                  # Componentes UI reutilizables
│   │   └── layout/              # Layouts y navegación
│   ├── hooks/                   # Custom hooks
│   ├── services/                # Lógica de negocio
│   ├── utils/                   # Utilidades
│   ├── data/                    # Capa de datos
│   │   ├── adapters/            # Adaptadores (Supabase, local)
│   │   ├── queries/             # Consultas
│   │   └── commands/            # Mutaciones
│   ├── sync/                    # Sincronización offline
│   ├── localdb/                 # Base de datos local
│   └── supabase/                # Cliente Supabase
│
├── apps/
│   ├── mobile/                  # App móvil (Expo + React Native)
│   │   ├── src/
│   │   │   ├── features/        # Módulos por feature
│   │   │   ├── ui/              # Componentes UI
│   │   │   ├── services/        # Servicios
│   │   │   └── utils/           # Utilidades
│   │   └── app.json             # Configuración Expo
│   │
│   ├── print-bridge-android/    # Print Bridge para Android
│   └── print-bridge-windows/    # Print Bridge para Windows
│
├── electron/                    # App de escritorio
│   ├── main.cjs                # Proceso principal
│   └── preload.cjs             # Script de preload
│
├── docs/                        # Documentación
│   ├── sql/                    # Scripts SQL
│   ├── adr/                    # Decisiones de arquitectura
│   └── archive/                # Documentación histórica
│
├── testing/                     # Tests
│   ├── e2e/                    # Tests E2E (Playwright)
│   └── *.test.js               # Tests unitarios
│
├── scripts/                     # Scripts de utilidad
├── public/                      # Assets estáticos
└── dist/                        # Build de producción
```

---

## 🔐 Variables de Entorno

### Requeridas

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### Opcionales

#### Email (Cliente)
```env
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
VITE_RESEND_FROM_EMAIL=noreply@tudominio.com
VITE_RESEND_ENABLED=false
```

#### Email (Servidor - Vercel Functions)
```env
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@tudominio.com
```

#### App
```env
VITE_APP_URL=https://stockypos.app
VITE_APP_NAME=Stocky
```

#### Local-First (Experimental)
```env
VITE_LOCAL_SYNC_ENABLED=false
VITE_LOCAL_SYNC_WRITE_SALES_ENABLED=false
VITE_LOCAL_SYNC_WRITE_PURCHASES_ENABLED=false
VITE_LOCAL_SYNC_WRITE_ORDERS_ENABLED=false
```

Ver referencia completa en [`.env.example`](.env.example)

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm run test:unit
npm run test:e2e
npm run test:offline

# Con cobertura
npm run test:coverage

# En modo watch
npm run test:watch

# UI de Playwright
npm run test:e2e:ui
```

### Cobertura Actual

| Tipo | Tests | Status |
|------|-------|--------|
| **Unitarios** | 98 | ✅ Pasando |
| **E2E** | 5 | ⚠️ 3 fallando |
| **Offline** | 10 | ✅ Pasando |

### Escribir Tests

```javascript
// testing/example.test.js
import { describe, it, expect } from 'vitest';

describe('Mi Feature', () => {
  it('debería funcionar correctamente', () => {
    expect(1 + 1).toBe(2);
  });
});
```

---

## 🚢 Despliegue

### Web App (Vercel)

```bash
# Preview
npm run predeploy
vercel

# Producción
npm run deploy:prod
```

### Mobile App (EAS Build)

```bash
cd apps/mobile

# Android APK
eas build --platform android --profile preview

# iOS (requiere macOS)
eas build --platform ios --profile preview

# Producción
eas build --platform all --profile production
eas submit
```

### Desktop App

```bash
# Windows
npm run desktop:build:win

# macOS
npm run desktop:build:mac

# Linux
npm run desktop:build:linux
```

Los instaladores se generan en `release/`

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. **Fork** el repositorio
2. Crea una **rama** para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add: AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. Abre un **Pull Request**

### Guías de Código

- Usa **TypeScript** para código nuevo
- Sigue el estilo de **ESLint** configurado
- Escribe **tests** para nuevas funcionalidades
- Documenta funciones complejas con **JSDoc**
- Usa **commits convencionales** (feat, fix, docs, etc.)

### Reportar Bugs

Usa [GitHub Issues](https://github.com/AndresPlazas10/Stocky/issues) con:
- Descripción clara del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots (si aplica)
- Versión de Node, npm, SO

---

## ❓ FAQ

### ¿Puedo usar Stocky sin conexión a internet?

**Web App:** Sí, parcialmente. El modo offline permite crear ventas que se sincronizan cuando vuelve la conexión (outbox pattern).

**Mobile App:** Parcialmente. Puedes ver datos cacheados, pero las operaciones de escritura requieren conexión.

**Desktop App:** Sí, modo offline completo con sincronización automática.

### ¿Cómo configuro la impresión Bluetooth?

1. Instala el **Print Bridge** correspondiente a tu plataforma
2. Empareja tu impresora térmica por Bluetooth
3. Configura el Print Bridge (puerto 41780 por defecto)
4. La app web/desktop detectará automáticamente el bridge

### ¿Es seguro para producción?

Sí, Stocky implementa:
- **RLS (Row Level Security)** en Supabase
- **Autenticación JWT** con PKCE
- **Validación de permisos** en backend
- **HTTPS** obligatorio en producción
- **Auditoría** de operaciones críticas

### ¿Puedo personalizar el diseño?

Sí, el sistema usa **Tailwind CSS** con tema personalizable. Edita `tailwind.config.js` y `src/index.css` para cambiar colores, fuentes, etc.

### ¿Soporta múltiples idiomas?

Actualmente solo español. Para agregar i18n, recomendamos `react-i18next`.

---

## 🗺️ Roadmap

### v1.1.0 (Próximo)
- [ ] Dashboard con métricas en tiempo real
- [ ] Gráficos interactivos en reportes
- [ ] Exportación a CSV/PDF
- [ ] Modo oscuro
- [ ] Categorías dinámicas de productos

### v1.2.0
- [ ] App de clientes (pedidos online)
- [ ] Integración con pasarelas de pago
- [ ] Facturación electrónica (DIAN Colombia)
- [ ] Multi-idioma (i18n)
- [ ] API REST pública

### v2.0.0
- [ ] Marketplace de plugins
- [ ] White-label completo
- [ ] Analytics avanzado con IA
- [ ] Integración con contabilidad (Siigo, QuickBooks)

Ver [ROADMAP.md](docs/ROADMAP.md) para detalles completos.

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Ver [LICENSE](LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- [Supabase](https://supabase.com/) - Backend as a Service
- [Vercel](https://vercel.com/) - Hosting y CI/CD
- [Expo](https://expo.dev/) - Framework para React Native
- [Electron](https://www.electronjs.org/) - Framework para apps de escritorio

---

## 📞 Contacto

**Autor:** Andres Plazas  
**Email:** contacto@stockypos.app  
**GitHub:** [@AndresPlazas10](https://github.com/AndresPlazas10)

---

<div align="center">

**¿Te gusta Stocky? ¡Dale una ⭐ en GitHub!**

[⬆ Volver arriba](#-stocky)

</div>
