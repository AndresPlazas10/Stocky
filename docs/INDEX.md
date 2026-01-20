# 📚 Índice de Documentación - Stocky

Bienvenido a la documentación completa de Stocky. Aquí encontrarás todo lo necesario para configurar, usar y desplegar el sistema.

---

## 🚀 Inicio Rápido

¿Primera vez usando Stocky? Empieza aquí:

1. **[Guía de Inicio Rápido](setup/QUICK_START.md)** - Prueba el sistema en 2 minutos
2. **[Instalación](../README.md#instalación-rápida)** - Setup completo paso a paso
3. **[Configuración de Base de Datos](setup/FACTURACION_SETUP.md)** - Ejecutar scripts SQL

---

## ⚙️ Configuración Inicial

### Base de Datos
- 📄 **[Script SQL Completo](sql/supabase_functions.sql)** - Todas las funciones y triggers
- 🔧 **[Setup de Facturación](setup/FACTURACION_SETUP.md)** - Configurar sistema completo
  - Funciones RPC
  - Triggers automáticos
  - Tabla de clientes
  - Row Level Security

### Servicios Externos
- 📧 **[Configurar EmailJS](setup/CONFIGURAR_EMAILJS.md)** - Envío de facturas por email
  - Crear cuenta (gratis)
  - Configurar servicio de email
  - Crear template
  - Variables de entorno

---

## 📖 Guías de Uso

### Sistema de Facturación
- 📄 **[Envío de Facturas](guides/ENVIO_FACTURAS.md)** - Guía completa de facturación
  - Crear facturas
  - Enviar por email
  - Cancelar y restaurar stock
  - Generar desde ventas

### Mejoras y Changelog
- 📝 **[Mejoras de Facturación](guides/MEJORAS_FACTURACION.md)** - Historial de cambios
  - Validaciones implementadas
  - Gestión de stock
  - Experiencia de usuario
  - Base de datos

---

## 🚀 Despliegue

- 🌐 **[Guía de Despliegue](../DEPLOY.md)** - Deploy a producción
  - Checklist pre-despliegue
  - Vercel (recomendado)
  - Netlify
  - VPS manual
  - Troubleshooting
  - Monitoreo

---

## 📋 Referencia Técnica

### Estructura del Proyecto
```
stockly/
├── src/
│   ├── components/Dashboard/   # Módulos principales
│   ├── pages/                   # Páginas de navegación
│   ├── services/                # Lógica de negocio
│   ├── supabase/                # Cliente Supabase
│   └── utils/                   # Utilidades
├── docs/                        # Documentación
└── public/                      # Assets estáticos
```

### Tecnologías
- **Frontend:** React 18 + Vite + TailwindCSS
- **Backend:** Supabase (PostgreSQL + Auth)
- **Email:** EmailJS
- **Hosting:** Vercel / Netlify

---

## 🔍 Troubleshooting

### Problemas Comunes

#### Error 500 al enviar emails
**Solución:** [Ver guía de EmailJS](setup/CONFIGURAR_EMAILJS.md)

#### Stock no se restaura
**Solución:** [Ver setup de facturación](setup/FACTURACION_SETUP.md#verificar-triggers)

#### RLS policy violation
**Solución:** [Ejecutar script SQL](sql/supabase_functions.sql)

#### Emails no llegan
**Solución:** [Verificar configuración EmailJS](setup/CONFIGURAR_EMAILJS.md#troubleshooting)

---

## 📊 Funcionalidades por Módulo

### 🏪 Inventario
- CRUD de productos
- Control de stock automático
- Categorías
- Códigos de barras
- Alertas de stock bajo

### 💰 Punto de Venta
- Interfaz POS rápida
- Búsqueda de productos
- Carrito de compras
- Múltiples métodos de pago
- Registro de ventas

### 📄 Facturación
- Generación automática
- Números secuenciales
- Envío por email
- Cancelación con restauración de stock
- Generación desde ventas

### 👥 Empleados
- Gestión de usuarios
- Permisos por módulo
- Rastreo de ventas
- Comisiones

### 🏢 Proveedores
- Base de datos de proveedores
- Registro de compras
- Historial de transacciones

### 📊 Reportes
- Dashboard con métricas
- Ventas por período
- Productos más vendidos
- Análisis de rentabilidad

---

## 🔒 Seguridad

### Row Level Security (RLS)
- Todas las tablas tienen RLS habilitado
- Políticas de aislamiento por negocio
- Validación de permisos en cada consulta

### Autenticación
- JWT tokens con Supabase
- Roles: Admin y Empleado
- Sesiones seguras

### Variables de Entorno
- API keys no expuestas en código
- Configuración por ambiente
- Rotación periódica de keys

---

## 🎓 Tutoriales Paso a Paso

### 1. Configurar desde Cero
1. [Crear proyecto Supabase](setup/FACTURACION_SETUP.md#paso-1)
2. [Ejecutar scripts SQL](sql/supabase_functions.sql)
3. [Configurar EmailJS](setup/CONFIGURAR_EMAILJS.md)
4. [Variables de entorno](../README.md#configuración)
5. [Ejecutar aplicación](setup/QUICK_START.md)

### 2. Primera Venta y Factura
1. Crear productos en Inventario
2. Ir a Punto de Venta
3. Agregar productos al carrito
4. Completar venta
5. Generar factura desde Ventas

### 3. Gestión de Empleados
1. Crear empleado en módulo Empleados
2. Asignar permisos
3. Empleado puede hacer login
4. Verificar acceso a módulos permitidos

---

## 📞 Soporte y Ayuda

### ¿Tienes dudas?

1. **Busca en la documentación** - Usa Ctrl+F en cada archivo
2. **Revisa el troubleshooting** - Problemas comunes resueltos
3. **Consulta los logs** - Consola del navegador (F12)
4. **Verifica Supabase** - Dashboard → Logs

### Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de EmailJS](https://www.emailjs.com/docs/)
- [Documentación de React](https://react.dev)
- [Documentación de Vite](https://vitejs.dev)

---

## 📅 Mantenimiento

### Actualizaciones Regulares
- Dependencias: `npm update`
- Supabase: Revisar dashboard
- EmailJS: Verificar cuota

### Backups
- Base de datos: Semanal
- Código: Git automático
- Configuración: Documentada

---

## 🗺️ Roadmap

### Versión 1.1 (Próximamente)
- [ ] Generación de PDF de facturas
- [ ] Notas crédito
- [ ] Reportes avanzados
- [ ] App móvil

### Versión 1.2 (Planificado)
- [ ] Múltiples sucursales
- [ ] Integración con pasarelas de pago
- [ ] Sistema de lealtad

Ver [CHANGELOG](../CHANGELOG.md) para historial completo.

---

## 🤝 Contribuir

¿Quieres mejorar Stocky?

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/mejora`
3. Haz tus cambios
4. Commit: `git commit -m 'feat: nueva funcionalidad'`
5. Push: `git push origin feature/mejora`
6. Abre un Pull Request

---

## 📜 Licencia

Stocky está bajo la Licencia MIT. Ver [LICENSE](../LICENSE) para más información.

---

<div align="center">

**¿Necesitas ayuda adicional?** Abre un issue en GitHub o consulta el [README principal](../README.md)

Hecho con ❤️ para facilitar la gestión de tu negocio

</div>
