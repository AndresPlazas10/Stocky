# 🚀 Checklist de Deployment - Producción

## 📋 Pre-Deployment (CRÍTICO)

### 1. Backup de Base de Datos ⚠️
```bash
# En Supabase Dashboard:
# 1. Ir a Database → Backups
# 2. Crear backup manual: "Pre-RLS-deployment-2024-12-12"
# 3. Verificar que se completó exitosamente
```

**Status:** ⬜ Pendiente  
**Tiempo:** 5 minutos  
**Obligatorio:** ✅ SÍ

---

### 2. Verificar Variables de Entorno
```bash
# Verificar en Vercel Dashboard:
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Verificar en local (.env):
✅ Archivo .env existe
✅ Variables correctas
✅ No commiteado a Git
```

**Status:** ⬜ Pendiente  
**Tiempo:** 2 minutos  
**Obligatorio:** ✅ SÍ

---

## 🗄️ Deployment de Base de Datos

### 3. Ejecutar Políticas RLS (Staging Primero)

#### 3A. En Staging/Desarrollo
```bash
# Supabase SQL Editor (proyecto de staging):
# 1. Abrir: docs/sql/POLITICAS_RLS_COMPLETAS_V2.sql
# 2. Copiar TODO el contenido
# 3. Ejecutar en SQL Editor
# 4. Verificar mensajes de éxito (sin errores rojos)

# Resultado esperado:
✅ 42 políticas creadas
✅ 6 funciones creadas
✅ 11 tablas con RLS habilitado
```

**Status:** ⬜ Pendiente  
**Tiempo:** 10 minutos  
**Obligatorio:** ✅ SÍ (antes de producción)

#### 3B. Pruebas en Staging
```bash
# Ejecutar: docs/sql/PRUEBAS_RLS.sql
# Crear usuarios de prueba:
- owner1@test.com (password: test123)
- admin1@test.com (password: test123)
- employee1@test.com (password: test123)

# Verificar:
✅ Owner ve su negocio
✅ Admin puede gestionar empleados
✅ Employee solo ve su perfil
✅ Aislamiento entre negocios funciona
```

**Status:** ⬜ Pendiente  
**Tiempo:** 30 minutos  
**Obligatorio:** ✅ SÍ

#### 3C. En Producción
```bash
# Solo después de verificar en staging:
# 1. Supabase Dashboard (PRODUCCIÓN) → SQL Editor
# 2. Ejecutar: docs/sql/POLITICAS_RLS_COMPLETAS_V2.sql
# 3. Verificar logs (sin errores)
# 4. Probar con usuario real de prueba
```

**Status:** ⬜ Pendiente  
**Tiempo:** 10 minutos  
**Obligatorio:** ✅ SÍ

---

### 4. Corregir Códigos de Productos

```sql
-- Supabase SQL Editor (PRODUCCIÓN):
-- 1. Ejecutar PASO 1 de: docs/sql/fix_product_codes.sql
-- 2. Verificar si hay códigos con timestamp (PRD-897571)
-- 3. Si existe, ejecutar SOLUCIÓN 2
-- 4. Copiar y ejecutar el UPDATE generado
-- 5. Verificar con PASO 4
```

**Status:** ⬜ Pendiente  
**Tiempo:** 10 minutos  
**Obligatorio:** 🟡 Recomendado

---

### 5. Crear Función generate_product_code (Opcional)

```sql
-- Al final de: docs/sql/fix_product_codes.sql
-- Ejecutar sección: "MEJORA PREVENTIVA"
CREATE OR REPLACE FUNCTION generate_product_code(p_business_id UUID)...
```

**Status:** ⬜ Pendiente  
**Tiempo:** 2 minutos  
**Obligatorio:** ⚪ Opcional

---

## 🌐 Deployment de Frontend

### 6. Build Local (Verificación)

```bash
cd /Users/andres_plazas/Desktop/Stocky
npm run build

# Verificar:
✅ Build completado sin errores
✅ No warnings críticos
✅ Tamaño de bundle razonable (<500KB)
```

**Status:** ⬜ Pendiente  
**Tiempo:** 3 minutos  
**Obligatorio:** ✅ SÍ

---

### 7. Deploy a Vercel

```bash
# Automático (ya configurado):
git push origin main

# O manual:
npm run deploy

# Verificar en Vercel Dashboard:
✅ Build exitoso
✅ Sin errores de deployment
✅ Preview URL funcionando
```

**Status:** ⬜ Pendiente  
**Tiempo:** 5 minutos  
**Obligatorio:** ✅ SÍ

---

## 🧪 Testing Post-Deployment

### 8. Pruebas Funcionales en Producción

#### Login y Autenticación
- ⬜ Login con usuario existente
- ⬜ Logout y re-login
- ⬜ Sesión persiste al recargar

#### Gestión de Productos
- ⬜ Crear producto (verificar código PRD-0001, PRD-0002, etc.)
- ⬜ Editar producto existente
- ⬜ Ver lista de productos (solo del negocio propio)
- ⬜ Buscar producto por código/nombre

#### Gestión de Empleados
- ⬜ Crear empleado (solo owner/admin)
- ⬜ Ver lista de empleados
- ⬜ Employee solo ve su perfil
- ⬜ Desactivar empleado

#### Ventas
- ⬜ Crear venta
- ⬜ Ver detalle de venta
- ⬜ Employee ve solo sus ventas
- ⬜ Owner/Admin ve todas las ventas

#### Compras
- ⬜ Registrar compra
- ⬜ Stock se actualiza correctamente
- ⬜ Ver historial de compras

#### Facturas
- ⬜ Generar factura (número consecutivo FAC-000001)
- ⬜ Ver lista de facturas
- ⬜ Stock se reduce al facturar
- ⬜ Cancelar factura (restaura stock)

#### Seguridad RLS
- ⬜ Usuario A no ve datos de Usuario B (diferentes negocios)
- ⬜ Employee no puede eliminar ventas
- ⬜ Employee no puede gestionar otros empleados
- ⬜ Solo owner puede eliminar el negocio

**Status:** ⬜ Pendiente  
**Tiempo:** 45 minutos  
**Obligatorio:** ✅ SÍ

---

### 9. Pruebas de Performance

```bash
# En Chrome DevTools:
# 1. Lighthouse audit
# 2. Verificar métricas:
✅ Performance > 80
✅ Accessibility > 90
✅ Best Practices > 90
✅ SEO > 80

# Verificar tiempos de carga:
✅ First Contentful Paint < 2s
✅ Time to Interactive < 3s
✅ Query de productos < 500ms
```

**Status:** ⬜ Pendiente  
**Tiempo:** 15 minutos  
**Obligatorio:** 🟡 Recomendado

---

## 📊 Monitoreo Post-Deployment

### 10. Configurar Alertas (48 horas)

```bash
# Supabase Dashboard → Logs:
- Activar alertas de errores
- Monitorear queries lentas
- Verificar uso de RLS (sin bypasses)

# Vercel Dashboard → Analytics:
- Monitorear errores 500/400
- Verificar tiempos de respuesta
- Alertas de downtime
```

**Status:** ⬜ Pendiente  
**Tiempo:** 10 minutos  
**Obligatorio:** 🟡 Recomendado

---

## 🔄 Rollback Plan (Si algo falla)

### Plan A: Rollback de Base de Datos
```sql
-- Si RLS causa problemas:
-- 1. Deshabilitar RLS temporalmente
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
-- (repetir para todas las tablas)

-- 2. Restaurar backup:
-- Supabase Dashboard → Database → Backups → Restore
```

### Plan B: Rollback de Frontend
```bash
# Vercel Dashboard:
# 1. Deployments → Ver deployment anterior
# 2. Click en "..." → "Promote to Production"

# O con Git:
git revert HEAD
git push origin main
```

### Plan C: Rollback Completo
```bash
# 1. Restaurar backup de BD
# 2. Revertir deployment de Vercel
# 3. Investigar logs y errores
# 4. Fix y re-deploy
```

---

## ✅ Checklist Final

### Pre-Deploy
- ⬜ Backup de BD realizado
- ⬜ Variables de entorno verificadas
- ⬜ Build local exitoso

### Database Deploy
- ⬜ RLS ejecutado en staging
- ⬜ Pruebas en staging OK
- ⬜ RLS ejecutado en producción
- ⬜ Códigos de productos corregidos

### Frontend Deploy
- ⬜ Push a GitHub exitoso
- ⬜ Build en Vercel exitoso
- ⬜ Preview URL funcionando

### Post-Deploy Testing
- ⬜ Login/Logout OK
- ⬜ CRUD de productos OK
- ⬜ Gestión de empleados OK
- ⬜ Ventas y compras OK
- ⬜ Facturas OK
- ⬜ Seguridad RLS verificada
- ⬜ Performance aceptable

### Monitoring
- ⬜ Logs monitoreados (24h)
- ⬜ No errores críticos
- ⬜ Performance estable

---

## 📞 Contacto de Emergencia

**Si hay problemas críticos:**
1. Ejecutar Rollback Plan
2. Revisar logs en Supabase y Vercel
3. Verificar ACTION_ITEMS.md
4. Consultar docs/sql/README_RLS.md

**Archivos de Referencia:**
- `ACTION_ITEMS.md` - Tareas pendientes
- `docs/sql/README_RLS.md` - Guía RLS completa
- `docs/sql/PRUEBAS_RLS.sql` - Scripts de testing
- `docs/sql/POLITICAS_RLS_COMPLETAS_V2.sql` - Script principal

---

**Última actualización:** 12 de diciembre de 2025  
**Versión:** 1.0.0  
**Status:** 🟡 Pendiente de deployment
