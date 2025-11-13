# ✅ Checklist Pre-Producción - Stockly

## 🔐 Seguridad

- [x] Variables de entorno configuradas (`.env.local` NO en git)
- [x] `.gitignore` actualizado con archivos sensibles
- [x] Console.logs de debug eliminados
- [ ] Row Level Security (RLS) activado en todas las tablas de Supabase
- [ ] Verificar políticas RLS correctas
- [ ] API Keys de Supabase configuradas en Vercel

## 🗄️ Base de Datos

- [ ] Ejecutar script SQL completo en Supabase: `docs/sql/supabase_functions.sql`
- [ ] Verificar que todas las tablas estén creadas
- [ ] Verificar que las funciones RPC estén creadas
- [ ] Probar generación de números de factura
- [ ] Verificar triggers de actualización de stock

## 🔗 Configuración Supabase

- [ ] Configurar URL de redirección en Authentication > URL Configuration
- [ ] Agregar dominio de producción (ejemplo.vercel.app)
- [ ] Habilitar Email Provider (Magic Link)
- [ ] Configurar Email Templates personalizados (opcional)

## 📧 EmailJS (Opcional - Para facturas)

- [ ] Crear cuenta en EmailJS
- [ ] Crear servicio de email
- [ ] Crear template de factura
- [ ] Configurar variables en `.env.local`:
  - `VITE_EMAILJS_SERVICE_ID`
  - `VITE_EMAILJS_TEMPLATE_ID`
  - `VITE_EMAILJS_PUBLIC_KEY`

## 🚀 Deploy en Vercel

1. **Preparación**
   - [x] Build local exitoso (`npm run build`)
   - [x] Archivos innecesarios eliminados
   - [x] README actualizado
   - [x] `vercel.json` configurado

2. **Deploy**
   - [ ] Conectar repositorio en Vercel
   - [ ] Configurar variables de entorno en Vercel:
     ```
     VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
     VITE_SUPABASE_ANON_KEY=tu_anon_key
     VITE_EMAILJS_SERVICE_ID=tu_service_id (opcional)
     VITE_EMAILJS_TEMPLATE_ID=tu_template_id (opcional)
     VITE_EMAILJS_PUBLIC_KEY=tu_public_key (opcional)
     ```
   - [ ] Ejecutar primer deploy
   - [ ] Verificar que la app carga correctamente

3. **Post-Deploy**
   - [ ] Agregar dominio de producción a Supabase Redirect URLs
   - [ ] Probar autenticación (Magic Link)
   - [ ] Crear primer negocio de prueba
   - [ ] Verificar que todos los módulos funcionen

## ✅ Testing de Producción

### Autenticación
- [ ] Registro de nuevo negocio funciona
- [ ] Login con Magic Link funciona
- [ ] Email de Magic Link llega correctamente
- [ ] Redirección después de login funciona

### Módulos Principales
- [ ] Dashboard carga correctamente
- [ ] Crear producto en Inventario
- [ ] Registrar una venta
- [ ] Registrar una compra
- [ ] Crear un proveedor
- [ ] Invitar un empleado
- [ ] Ver reportes

### Permisos y Seguridad
- [ ] Empleado no puede ver módulos restringidos
- [ ] RLS impide acceso a datos de otros negocios
- [ ] Logout funciona correctamente

## 🎨 UI/UX Final

- [x] Logo del negocio se puede subir
- [ ] Logo persiste después de recargar
- [ ] Todas las animaciones funcionan
- [ ] Responsive en mobile
- [ ] Sin errores en consola del navegador

## 📊 Rendimiento

- [x] Build optimizado (chunks < 600KB)
- [ ] Lighthouse Score > 90
- [ ] Tiempo de carga < 3 segundos
- [ ] Sin memory leaks

## 📝 Documentación

- [x] README actualizado
- [x] Documentación en `/docs` organizada
- [ ] Comentarios en funciones complejas
- [ ] Variables de entorno documentadas

## 🔄 Backups y Mantenimiento

- [ ] Configurar backups automáticos en Supabase
- [ ] Establecer política de retención de datos
- [ ] Configurar monitoring de errores (Sentry, opcional)
- [ ] Documentar procedimientos de rollback

## 📈 Analytics (Opcional)

- [ ] Configurar Google Analytics
- [ ] Configurar Vercel Analytics
- [ ] Tracking de eventos clave

---

## 🚨 Errores Comunes y Soluciones

### Error: "Auth session missing"
**Solución:** Verificar que el dominio esté en Supabase Redirect URLs

### Error: "Row Level Security policy violation"
**Solución:** Verificar que las políticas RLS estén correctamente configuradas

### Error: "Magic Link no llega"
**Solución:** Verificar configuración del Email Provider en Supabase

### Build falla en Vercel
**Solución:** Verificar que todas las dependencias estén en `package.json`

---

## 📞 Soporte Post-Producción

- Monitorear errores en primeras 24 horas
- Recopilar feedback de usuarios iniciales
- Hacer ajustes según necesidad
- Documentar issues encontrados

---

**Última actualización:** 12 de noviembre de 2025
**Versión:** 1.0.0
