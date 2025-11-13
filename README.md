# 🏪 Stockly - Sistema POS & Inventario# 🏪 Stockly - Sistema POS & Facturación Electrónica# 🏪 Stockly - Sistema POS & Facturación Electrónica# Stockly - Sistema POS Multi-tenant



<div align="center">



![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)<div align="center">

![License](https://img.shields.io/badge/license-MIT-green.svg)

![React](https://img.shields.io/badge/React-19.1-61DAFB.svg)

![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E.svg)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)<div align="center">Sistema de punto de venta con gestión de inventario, ventas, compras, empleados y proveedores.

**Sistema completo de punto de venta con gestión de inventario, ventas, compras y empleados para cafeterías, bares y restaurantes.**

![License](https://img.shields.io/badge/license-MIT-green.svg)

[Características](#✨-características) • [Instalación](#⚡-instalación-rápida) • [Documentación](#📚-documentación) • [Despliegue](#🚀-despliegue)

![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)

</div>

![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E.svg)

---

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)## Características

## ✨ Características

**Sistema completo de punto de venta con facturación electrónica, gestión de inventario, ventas y empleados.**

### 🔐 Autenticación y Seguridad

- ✅ Magic Link (sin contraseñas) con Supabase Auth![License](https://img.shields.io/badge/license-MIT-green.svg)

- ✅ Sistema multi-tenant con Row Level Security (RLS)

- ✅ Roles: Administrador y Empleado con permisos granulares[Características](#características-principales) • [Instalación](#instalación-rápida) • [Documentación](#documentación) • [Despliegue](#despliegue)



### 💰 Punto de Venta (POS)![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)- ✅ Autenticación de administradores y empleados

- ✅ Carrito de compra intuitivo

- ✅ Búsqueda rápida de productos</div>

- ✅ Múltiples métodos de pago (efectivo, tarjeta, transferencia)

- ✅ Historial completo de ventas![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E.svg)- ✅ Gestión multi-tenant con RLS (Row Level Security)

- ✅ Impresión/envío de recibos

---

### 📦 Gestión de Inventario

- ✅ CRUD completo de productos- ✅ Inventario de productos

- ✅ Control de stock en tiempo real

- ✅ Alertas de stock bajo## 📚 Índice de Documentación

- ✅ Códigos SKU automáticos

- ✅ Categorización de productos**Sistema completo de punto de venta con facturación electrónica, gestión de inventario, ventas y empleados.**- ✅ Registro de ventas y compras

- ✅ Precios de compra y venta

**→ [Ver Índice Completo de Documentación](docs/INDEX.md)**

### 🛒 Gestión de Compras

- ✅ Registro de órdenes de compra- ✅ Gestión de empleados con permisos

- ✅ Vinculación con proveedores

- ✅ Actualización automática de stock**Acceso rápido:**

- ✅ Historial de compras

- 📄 [Guía de Inicio Rápido](docs/setup/QUICK_START.md) - Prueba en 2 minutos[Características](#características) • [Instalación](#instalación-rápida) • [Documentación](#documentación) • [Configuración](#configuración)- ✅ Gestión de proveedores

### 👥 Gestión de Empleados

- ✅ Invitaciones por email- 🔧 [Configurar Base de Datos](docs/setup/FACTURACION_SETUP.md) - SQL setup completo

- ✅ Aprobación de empleados

- ✅ Seguimiento de ventas por empleado- 📧 [Configurar EmailJS](docs/setup/CONFIGURAR_EMAILJS.md) - Envío de facturas- ✅ Sistema de mesas para restaurantes

- ✅ Control de acceso por rol

- 📊 [Envío de Facturas](docs/guides/ENVIO_FACTURAS.md) - Guía de uso

### 📊 Reportes y Análisis

- ✅ Dashboard con métricas clave- 🚀 [Guía de Despliegue](DEPLOY.md) - Deploy a producción</div>- ✅ Reportes y análisis

- ✅ Ventas del día/mes

- ✅ Productos más vendidos

- ✅ Reportes de inventario

- ✅ Análisis de compras---- ⏳ Facturación electrónica (requiere dominio verificado)



### 🍽️ Sistema de Mesas (Restaurantes)

- ✅ Gestión de mesas y órdenes

- ✅ Estados: Disponible, Ocupada, Reservada## 📋 Tabla de Contenidos---

- ✅ Seguimiento de órdenes activas

- ✅ Cálculo automático de totales



### 🔔 Notificaciones en Tiempo Real- [Características Principales](#características-principales)## Tecnologías

- ✅ Alertas de stock bajo

- ✅ Nuevas ventas- [Tecnologías](#tecnologías)

- ✅ Nuevas compras

- ✅ Sincronización automática- [Instalación Rápida](#instalación-rápida)## 📋 Tabla de Contenidos



---- [Configuración](#configuración)



## 🛠️ Tecnologías- [Estructura del Proyecto](#estructura-del-proyecto)- React + Vite



| Tecnología | Versión | Uso |- [Scripts Disponibles](#scripts-disponibles)

|-----------|---------|-----|

| **React** | 19.1 | Framework frontend |- [Despliegue](#despliegue)- [Características Principales](#características-principales)- Supabase (PostgreSQL + Auth + Storage)

| **Vite** | 7.1 | Build tool y dev server |

| **TailwindCSS** | 4.1 | Estilos y diseño |- [Licencia](#licencia)

| **Supabase** | 2.80 | Backend, Auth y Base de datos |

| **PostgreSQL** | - | Base de datos (vía Supabase) |- [Tecnologías](#tecnologías)- TailwindCSS

| **Framer Motion** | 12.x | Animaciones |

| **Lucide React** | 0.553 | Iconos |---

| **React Router** | 7.9 | Navegación |

- [Instalación Rápida](#instalación-rápida)- Resend API (emails)

---

## ✨ Características Principales

## ⚡ Instalación Rápida

- [Configuración](#configuración)

### Prerrequisitos

- Node.js 18+ y npm 9+### 🔐 Autenticación y Permisos

- Cuenta en [Supabase](https://supabase.com)

- ✅ Sistema multi-tenant con aislamiento de datos- [Estructura del Proyecto](#estructura-del-proyecto)## Instalación

### 1. Clonar el repositorio

```bash- ✅ Roles: Administrador y Empleado

git clone https://github.com/tu-usuario/stockly.git

cd stockly- ✅ Row Level Security (RLS) en Supabase- [Documentación](#documentación)

```

- ✅ Permisos granulares por módulo

### 2. Instalar dependencias

```bash- [Scripts Disponibles](#scripts-disponibles)```bash

npm install

```### 📦 Gestión de Inventario



### 3. Configurar variables de entorno- ✅ CRUD completo de productos- [Despliegue](#despliegue)# Instalar dependencias

```bash

cp .env.example .env.local- ✅ Categorías y códigos de barras

```

- ✅ Control de stock automático- [Licencia](#licencia)npm install

Edita `.env.local` con tus credenciales de Supabase:

```env- ✅ Alertas de stock bajo

VITE_SUPABASE_URL=https://tu-proyecto.supabase.co

VITE_SUPABASE_ANON_KEY=tu_clave_publica_aqui- ✅ Historial de movimientos

```



### 4. Configurar base de datos

Ejecuta el script SQL en tu proyecto de Supabase:### 💰 Punto de Venta (POS)---# Configurar variables de entorno

📄 **[docs/sql/supabase_functions.sql](docs/sql/supabase_functions.sql)**

- ✅ Interfaz rápida y moderna

### 5. Iniciar servidor de desarrollo

```bash- ✅ Búsqueda de productos en tiempo realcp .env.example .env.local

npm run dev

```- ✅ Múltiples métodos de pago



Abre [http://localhost:5173](http://localhost:5173) 🎉- ✅ Registro detallado de ventas## ✨ Características Principales# Editar .env.local con tus credenciales de Supabase



---- ✅ Generación de facturas desde ventas



## 📚 Documentación



### 📖 Guías de Configuración### 📄 Facturación Electrónica

- [Configuración de Facturación](docs/setup/FACTURACION_SETUP.md) - Setup completo de la base de datos

- [Configurar EmailJS](docs/setup/CONFIGURAR_EMAILJS.md) - Envío de facturas por email- ✅ Generación automática de facturas### 🔐 Autenticación y Permisos# Ejecutar en desarrollo

- [Variables de Entorno](docs/setup/ENV_SETUP.md) - Configuración detallada

- ✅ Números de factura secuenciales (FAC-XXXXXX)

### 📘 Guías de Uso

- [Envío de Facturas](docs/guides/ENVIO_FACTURAS.md) - Cómo generar y enviar facturas- ✅ Envío por email vía EmailJS- ✅ Sistema multi-tenant con aislamiento de datosnpm run dev

- [Gestión de Empleados](docs/guides/EMPLEADOS.md) - Invitar y gestionar empleados

- [Sistema de Mesas](docs/guides/MESAS.md) - Uso del módulo de restaurantes- ✅ Estados: Pendiente, Enviada, Validada, Cancelada



### 🗂️ Índice Completo- ✅ Cancelación con restauración de stock- ✅ Roles: Administrador y Empleado

**→ [Ver Documentación Completa](docs/INDEX.md)**

- ✅ Generar facturas desde módulo de ventas

---

- ✅ Envío automático opcional al crear- ✅ Row Level Security (RLS) en Supabase# Compilar para producción

## ⚙️ Configuración



### Scripts Disponibles

### 👥 Gestión de Empleados- ✅ Permisos granulares por módulonpm run build

```bash

# Desarrollo- ✅ CRUD de empleados

npm run dev          # Servidor de desarrollo (puerto 5173)

- ✅ Asignación de permisos por módulo```

# Producción

npm run build        # Build para producción- ✅ Rastreo de ventas por empleado

npm run preview      # Preview del build

- ✅ Control de accesos### 📦 Gestión de Inventario

# Calidad de código

npm run lint         # Ejecutar ESLint

```

### 🏢 Gestión de Proveedores- ✅ CRUD completo de productos## Variables de Entorno

### Estructura del Proyecto

- ✅ Base de datos de proveedores

```

stockly/- ✅ Registro de compras- ✅ Categorías y códigos de barras

├── src/

│   ├── components/- ✅ Historial de transacciones

│   │   ├── Dashboard/      # Componentes del dashboard

│   │   │   ├── Home.jsx- ✅ Información de contacto- ✅ Control de stock automático```env

│   │   │   ├── Ventas.jsx

│   │   │   ├── Compras.jsx

│   │   │   ├── Inventario.jsx

│   │   │   ├── Empleados.jsx### 📊 Reportes y Análisis- ✅ Alertas de stock bajoVITE_SUPABASE_URL=tu_url_de_supabase

│   │   │   ├── Proveedores.jsx

│   │   │   ├── Reportes.jsx- ✅ Dashboard con métricas en tiempo real

│   │   │   ├── Mesas.jsx

│   │   │   └── Configuracion.jsx- ✅ Ventas por período- ✅ Historial de movimientosVITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase

│   │   ├── layout/         # Layout components

│   │   │   ├── Navbar.jsx- ✅ Productos más vendidos

│   │   │   └── Sidebar.jsx

│   │   └── ui/             # Componentes reutilizables- ✅ Análisis de rentabilidad```

│   ├── pages/              # Páginas principales

│   │   ├── Home.jsx- ✅ Exportación de datos

│   │   ├── Login.jsx

│   │   ├── Register.jsx### 💰 Punto de Venta (POS)

│   │   ├── Dashboard.jsx

│   │   └── EmployeeDashboard.jsx---

│   ├── hooks/              # Custom hooks

│   │   └── useNotifications.js- ✅ Interfaz rápida y moderna## Funcionalidad de Facturación

│   ├── services/           # Servicios de negocio

│   ├── supabase/           # Cliente de Supabase## 🛠️ Tecnologías

│   ├── utils/              # Utilidades

│   └── App.jsx- ✅ Búsqueda de productos en tiempo real

├── docs/                   # Documentación

├── public/                 # Assets estáticos### Frontend

└── package.json

```- **React 18.3** - Biblioteca UI- ✅ Múltiples métodos de pagoLa funcionalidad de facturación electrónica está **temporalmente deshabilitada** hasta completar:



---- **Vite 7.2** - Build tool rápido



## 🚀 Despliegue- **TailwindCSS 4.1** - Framework CSS- ✅ Carrito de compras intuitivo



### Deploy en Vercel (Recomendado)- **React Router** - Navegación SPA



1. **Conectar con GitHub**- ✅ Registro de ventas automático1. Comprar y verificar un dominio en Resend (~$12/año)

   - Haz push de tu repositorio a GitHub

   - Crea cuenta en [Vercel](https://vercel.com)### Backend

   - Importa tu repositorio

- **Supabase** - Backend as a Service2. Actualizar la configuración del Edge Function `send-invoice-email`

2. **Configurar variables de entorno**

   ```  - PostgreSQL - Base de datos relacional

   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co

   VITE_SUPABASE_ANON_KEY=tu_clave_anon_key  - Authentication - Sistema de autenticación### 📄 Facturación Electrónica3. Descomentar el código relacionado con facturas en:

   ```

  - Row Level Security - Aislamiento multi-tenant

3. **Configurar dominio en Supabase**

   - Ve a Authentication > URL Configuration  - SQL Functions & Triggers - Lógica de negocio- ✅ Generación automática de facturas   - `src/pages/Dashboard.jsx` (línea del menú Facturas)

   - Agrega tu dominio de Vercel a los Redirect URLs



4. **Deploy automático** ✅

### Servicios- ✅ Números secuenciales (FAC-XXXXXX)   - `src/pages/EmployeeDashboard.jsx` (línea del menú Facturas)

### Guía Completa de Despliegue

📄 **[DEPLOY.md](DEPLOY.md)** - Instrucciones detalladas- **EmailJS** - Envío de emails (facturas)



---- **Vercel/Netlify** - Hosting recomendado- ✅ Envío por email al cliente   - `src/components/Dashboard/Ventas.jsx` (checkbox, validación, modal)



## 🎨 Paleta de Colores



```css---- ✅ Estados: Guardado, Enviada, Cancelada

/* Colores principales */

--primary: #003B46      /* Azul oscuro */

--secondary: #07575B    /* Azul medio */

--accent: #66A5AD       /* Azul claro */## 🚀 Instalación Rápida- ✅ Cancelación con restauración de stock## Licencia

--background: #C4DFE6   /* Azul muy claro */

```



---### Prerrequisitos- ✅ Generación desde ventas existentes



## 📝 Licencia- Node.js >= 18.0.0



Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.- npm o yarnPropietario



---- Cuenta de Supabase (gratis)



## 🤝 Contribuir- Cuenta de EmailJS (opcional, gratis)### 👥 Gestión de Empleados



Las contribuciones son bienvenidas. Por favor:- ✅ Registro de empleados con acceso al sistema



1. Fork el proyecto### Pasos- ✅ Asignación de permisos por módulo

2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)

3. Commit tus cambios (`git commit -m 'Add: nueva característica'`)- ✅ Rastreo de ventas por empleado

4. Push a la rama (`git push origin feature/AmazingFeature`)

5. Abre un Pull Request```bash- ✅ Gestión de salarios y comisiones



---# 1. Clonar el repositorio



## 📧 Soportegit clone https://github.com/tu-usuario/stockly.git### 🏢 Gestión de Proveedores



Si tienes preguntas o necesitas ayuda:cd stockly- ✅ Base de datos de proveedores



- 📧 Email: soporte@stockly.com- ✅ Registro de compras

- 🐛 Issues: [GitHub Issues](https://github.com/tu-usuario/stockly/issues)

- 📖 Docs: [Documentación Completa](docs/INDEX.md)# 2. Instalar dependencias- ✅ Historial de transacciones



---npm install- ✅ Control de cuentas por pagar



<div align="center">



**Hecho con ❤️ para pequeños y medianos negocios**# 3. Configurar variables de entorno### 📊 Reportes y Análisis



⭐ Si te gusta el proyecto, dale una estrella en GitHubcp .env.example .env.local- ✅ Dashboard con métricas clave



</div># Editar .env.local con tus credenciales- ✅ Reportes de ventas por período


- ✅ Productos más vendidos

# 4. Ejecutar en desarrollo- ✅ Análisis de rentabilidad

npm run dev- ✅ Exportación de datos

```

### 🍽️ Sistema de Mesas (Restaurantes)

La aplicación estará disponible en `http://localhost:5173`- ✅ Gestión de mesas y pedidos

- ✅ Estados: Disponible, Ocupada, Reservada

---- ✅ Asignación de pedidos a mesas

- ✅ Integración con POS

## ⚙️ Configuración

---

### 1. Configurar Supabase

## 🛠️ Tecnologías

1. Crear proyecto en [Supabase](https://supabase.com)

2. Copiar URL y Anon Key### Frontend

3. Ejecutar el script SQL: [`docs/sql/supabase_functions.sql`](docs/sql/supabase_functions.sql)- **React 18** - Framework principal

4. Ver guía completa: [FACTURACION_SETUP.md](docs/setup/FACTURACION_SETUP.md)- **Vite** - Build tool ultra-rápido

- **TailwindCSS** - Estilos utility-first

### 2. Configurar EmailJS (Opcional)- **React Router** - Navegación SPA



1. Crear cuenta en [EmailJS](https://www.emailjs.com)### Backend

2. Configurar servicio de email- **Supabase** - BaaS (Backend as a Service)

3. Crear template de factura  - PostgreSQL - Base de datos

4. Ver guía completa: [CONFIGURAR_EMAILJS.md](docs/setup/CONFIGURAR_EMAILJS.md)  - Authentication - Sistema de usuarios

  - Row Level Security - Seguridad de datos

### 3. Variables de Entorno  - Edge Functions - Funciones serverless



Crear `.env.local` con:### Servicios Externos

- **EmailJS** - Envío de facturas por email (200/mes gratis)

```env- **Resend** - Alternativa para emails (100/día gratis)

# Supabase (Requerido)

VITE_SUPABASE_URL=https://tu-proyecto.supabase.co---

VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui

## 🚀 Instalación Rápida

# EmailJS (Opcional - para envío de facturas)

VITE_EMAILJS_SERVICE_ID=tu_service_id### Prerrequisitos

VITE_EMAILJS_TEMPLATE_ID=tu_template_id

VITE_EMAILJS_PUBLIC_KEY=tu_public_key- Node.js 18+ instalado

- Cuenta en Supabase (gratis)

# Modo de desarrollo- Cuenta en EmailJS (gratis, opcional)

VITE_USE_DEMO_MODE=false

```### 1. Clonar el repositorio



Ver [`.env.example`](.env.example) para más detalles.```bash

git clone https://github.com/tu-usuario/stockly.git

---cd stockly

```

## 📁 Estructura del Proyecto

### 2. Instalar dependencias

```

stockly/```bash

├── src/npm install

│   ├── components/```

│   │   ├── Dashboard/        # Módulos principales

│   │   │   ├── Facturas.jsx  # Sistema de facturación### 3. Configurar variables de entorno

│   │   │   ├── Ventas.jsx    # Punto de venta

│   │   │   ├── Inventario.jsx```bash

│   │   │   ├── Empleados.jsxcp .env.example .env

│   │   │   ├── Proveedores.jsx```

│   │   │   ├── Compras.jsx

│   │   │   ├── Reportes.jsxEdita `.env` con tus credenciales:

│   │   │   └── ...

│   │   └── ui/               # Componentes reutilizables```env

│   ├── pages/                # Páginas de navegación# Supabase (Requerido)

│   │   ├── Dashboard.jsxVITE_SUPABASE_URL=https://tu-proyecto.supabase.co

│   │   ├── Login.jsxVITE_SUPABASE_ANON_KEY=tu_clave_anonima_aqui

│   │   ├── Register.jsx

│   │   └── ...# EmailJS (Opcional - para envío de facturas)

│   ├── services/             # Lógica de negocioVITE_EMAILJS_PUBLIC_KEY=tu_public_key

│   ├── supabase/             # Cliente SupabaseVITE_EMAILJS_SERVICE_ID=tu_service_id

│   ├── utils/                # UtilidadesVITE_EMAILJS_TEMPLATE_ID=tu_template_id

│   └── main.jsx              # Entrada de la app```

├── docs/                     # Documentación

│   ├── INDEX.md              # Índice completo### 4. Configurar base de datos

│   ├── setup/                # Guías de configuración

│   ├── guides/               # Guías de uso1. Ve a tu proyecto en Supabase

│   └── sql/                  # Scripts SQL2. Abre el **SQL Editor**

├── public/                   # Assets estáticos3. Ejecuta el script: `docs/sql/supabase_functions.sql`

├── README.md                 # Este archivo

├── DEPLOY.md                 # Guía de despliegue### 5. Ejecutar en desarrollo

├── CHANGELOG.md              # Historial de cambios

├── LICENSE                   # Licencia MIT```bash

└── package.json              # Dependenciasnpm run dev

``````



---Abre http://localhost:5173



## 📜 Scripts Disponibles### 6. Crear primer usuario



```bash1. Ve a la página de registro

# Desarrollo2. Crea tu cuenta de administrador

npm run dev              # Iniciar servidor de desarrollo3. Completa el perfil del negocio



# Producción---

npm run build            # Compilar para producción

npm run preview          # Vista previa de build## ⚙️ Configuración



# Calidad de código### Configuración de Supabase

npm run lint             # Ejecutar ESLint

Ver guía completa: [`docs/setup/FACTURACION_SETUP.md`](docs/setup/FACTURACION_SETUP.md)

# Verificación pre-producción

./check-production.sh    # Verificar que todo esté listo**Pasos básicos:**

```1. Crear proyecto en Supabase

2. Ejecutar script SQL (incluye funciones y triggers)

### Script de Verificación3. Configurar RLS policies

4. Obtener credenciales

Antes de desplegar, ejecuta:

### Configuración de EmailJS

```bash

chmod +x check-production.shVer guía completa: [`docs/setup/CONFIGURAR_EMAILJS.md`](docs/setup/CONFIGURAR_EMAILJS.md)

./check-production.sh

```**Pasos básicos:**

1. Crear cuenta en emailjs.com

Este script verifica:2. Conectar servicio de email (Gmail, Outlook, etc.)

- ✅ Dependencias instaladas3. Crear template de factura

- ✅ Variables de entorno configuradas4. Configurar variables en `.env`

- ✅ Archivos críticos presentes

- ✅ Build de producción exitoso---

- ✅ Git configurado correctamente

## 📁 Estructura del Proyecto

---

```

## 🌐 Desplieguestockly/

├── docs/                          # Documentación

### Opción 1: Vercel (Recomendado)│   ├── setup/                     # Guías de configuración

│   │   ├── FACTURACION_SETUP.md  # Setup de facturación

```bash│   │   ├── CONFIGURAR_EMAILJS.md # Setup de emails

npm install -g vercel│   │   └── QUICK_START.md        # Inicio rápido

vercel│   ├── guides/                    # Guías de uso

```│   │   ├── ENVIO_FACTURAS.md     # Guía de facturación

│   │   └── MEJORAS_FACTURACION.md # Changelog

### Opción 2: Netlify│   └── sql/                       # Scripts SQL

│       └── supabase_functions.sql # Funciones y triggers

```bash│

npm run build├── src/

netlify deploy --prod --dir=dist│   ├── components/

```│   │   ├── Dashboard/            # Componentes principales

│   │   │   ├── Clientes.jsx

### Opción 3: VPS Manual│   │   │   ├── Compras.jsx

│   │   │   ├── Configuracion.jsx

```bash│   │   │   ├── Empleados.jsx

npm run build│   │   │   ├── Facturas.jsx     # ⭐ Facturación

# Copiar carpeta dist/ a tu servidor│   │   │   ├── Home.jsx

# Configurar Nginx/Apache│   │   │   ├── Inventario.jsx

```│   │   │   ├── Mesas.jsx

│   │   │   ├── Proveedores.jsx

**Ver guía completa:** [DEPLOY.md](DEPLOY.md)│   │   │   ├── Reportes.jsx

│   │   │   └── Ventas.jsx       # ⭐ POS

---│   │   └── ui/                   # Componentes UI

│   │       ├── button.jsx

## 📖 Documentación Completa│   │       ├── card.jsx

│   │       ├── input.jsx

### Configuración Inicial│   │       └── label.jsx

- [Índice de Documentación](docs/INDEX.md) - Guía completa navegable│   │

- [Inicio Rápido](docs/setup/QUICK_START.md) - Prueba en 2 minutos│   ├── pages/                    # Páginas principales

- [Setup de Facturación](docs/setup/FACTURACION_SETUP.md) - Base de datos y funciones│   │   ├── Dashboard.jsx

- [Configurar EmailJS](docs/setup/CONFIGURAR_EMAILJS.md) - Envío de emails│   │   ├── EmployeeAccess.jsx

│   │   ├── EmployeeDashboard.jsx

### Guías de Uso│   │   ├── Home.jsx

- [Envío de Facturas](docs/guides/ENVIO_FACTURAS.md) - Cómo usar el módulo│   │   ├── Login.jsx

- [Mejoras de Facturación](docs/guides/MEJORAS_FACTURACION.md) - Historial de cambios│   │   └── Register.jsx

│   │

### Scripts SQL│   ├── services/                 # Servicios de negocio

- [supabase_functions.sql](docs/sql/supabase_functions.sql) - Funciones y triggers│   │   ├── businessService.jsx

│   │   └── setBusiness.jsx

---│   │

│   ├── supabase/                 # Configuración Supabase

## 🐛 Troubleshooting│   │   └── Client.jsx

│   │

### Errores Comunes│   ├── utils/                    # Utilidades

│   │   ├── emailServiceSupabase.js # ⭐ Envío emails

**Error 500 al enviar emails**│   │   └── formatters.js        # Formateo números

- Verificar configuración de EmailJS│   │

- Ver [CONFIGURAR_EMAILJS.md](docs/setup/CONFIGURAR_EMAILJS.md)│   ├── App.jsx

│   ├── main.jsx

**Stock no se restaura al cancelar factura**│   └── index.css

- Verificar que el trigger esté instalado│

- Ejecutar `docs/sql/supabase_functions.sql`├── public/                       # Archivos estáticos

├── .env.example                  # Plantilla variables entorno

**RLS policy violation**├── package.json

- Verificar que las políticas estén creadas├── vite.config.js

- Ver [FACTURACION_SETUP.md](docs/setup/FACTURACION_SETUP.md)└── tailwind.config.js

```

**Build falla en producción**

- Ejecutar `./check-production.sh`---

- Verificar variables de entorno

## 📚 Documentación

---

### Configuración Inicial

## 🤝 Contribuir- 📖 [Inicio Rápido](docs/setup/QUICK_START.md) - Prueba el sistema en 2 minutos

- 🔧 [Setup de Facturación](docs/setup/FACTURACION_SETUP.md) - Configurar sistema completo

Las contribuciones son bienvenidas. Para cambios importantes:- 📧 [Configurar EmailJS](docs/setup/CONFIGURAR_EMAILJS.md) - Envío de emails



1. Fork el repositorio### Guías de Uso

2. Crear una rama: `git checkout -b feature/nueva-funcionalidad`- 📄 [Sistema de Facturación](docs/guides/ENVIO_FACTURAS.md) - Cómo facturar

3. Commit: `git commit -m 'feat: agregar nueva funcionalidad'`- 📝 [Mejoras Implementadas](docs/guides/MEJORAS_FACTURACION.md) - Changelog

4. Push: `git push origin feature/nueva-funcionalidad`

5. Abrir Pull Request### SQL

- 🗄️ [Funciones de Supabase](docs/sql/supabase_functions.sql) - Script completo

---

---

## 📄 Licencia

## 🔨 Scripts Disponibles

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más información.

```bash

---# Desarrollo

npm run dev          # Servidor de desarrollo (http://localhost:5173)

## 📞 Soporte

# Producción

- 📚 [Documentación Completa](docs/INDEX.md)npm run build        # Compilar para producción

- 🐛 [Reportar Bug](https://github.com/tu-usuario/stockly/issues)npm run preview      # Previsualizar build de producción

- 💡 [Solicitar Feature](https://github.com/tu-usuario/stockly/issues)

- 📧 Email: soporte@stockly.com# Linting

npm run lint         # Verificar código con ESLint

---```



## 🗺️ Roadmap---



### Versión 1.1 (Próximamente)## 🚀 Despliegue

- [ ] Generación de PDF de facturas

- [ ] Notas crédito### Opción 1: Vercel (Recomendado)

- [ ] Reportes avanzados con gráficos

- [ ] App móvil (React Native)1. Push a GitHub

2. Importar en Vercel

### Versión 1.2 (Planificado)3. Configurar variables de entorno

- [ ] Múltiples sucursales4. Deploy automático

- [ ] Integración con pasarelas de pago

- [ ] Sistema de lealtad y puntos[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

- [ ] API pública

### Opción 2: Netlify

Ver [CHANGELOG.md](CHANGELOG.md) para el historial completo de cambios.

1. Conectar repositorio

---2. Build command: `npm run build`

3. Publish directory: `dist`

<div align="center">4. Configurar variables de entorno



**Hecho con ❤️ para facilitar la gestión de tu negocio**### Opción 3: Manual



⭐ Si te gusta este proyecto, dale una estrella en GitHub```bash

npm run build

</div># Subir carpeta dist/ a tu servidor

```

---

## 🔒 Seguridad

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Autenticación JWT con Supabase
- ✅ Variables de entorno para credenciales
- ✅ Validación de permisos en frontend y backend
- ✅ Políticas de acceso por negocio

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea tu rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más información.

---

## 👥 Autor

**Tu Nombre**
- GitHub: [@tu-usuario](https://github.com/tu-usuario)
- Email: tu-email@ejemplo.com

---

## 🙏 Agradecimientos

- Supabase por el excelente BaaS
- EmailJS por el servicio de emails
- Comunidad de React y Vite

---

<div align="center">

**⭐ Si te gusta el proyecto, dale una estrella en GitHub ⭐**

Hecho con ❤️ y ☕

</div>
