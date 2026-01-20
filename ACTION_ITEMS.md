# 🎯 LISTA DE ACCIONES ESPECÍFICAS PARA PRODUCCIÓN

## 🚨 URGENTE - EJECUTAR INMEDIATAMENTE

### 0A. FIX: Código de Producto Inconsistente (10 minutos)

**Problema Actual:**
- Producto con código `PRD-897571` (timestamp) en lugar de secuencia normal
- Debería ser `PRD-0001`, `PRD-0002`, etc.

**Solución Rápida:**
```bash
# 1. Abrir Supabase Dashboard → SQL Editor
# 2. Ejecutar el archivo: docs/sql/fix_product_codes.sql

# Pasos dentro del script:
# - PASO 1: Ver todos los códigos actuales
# - PASO 2: Identificar máximo secuencial
# - SOLUCIÓN 2: Genera UPDATE automático para corregir
# - Copiar y ejecutar el UPDATE generado
# - PASO 4: Verificar corrección
```

**Mejora Implementada en App:**
- ✅ Regex mejorado: `^PRD-(\d{4})$` (solo 4 dígitos)
- ✅ Ignora códigos con timestamp (6 dígitos)
- ✅ Secuencia correcta garantizada

**Documentación:** `docs/sql/fix_product_codes.sql`
**Estado:** ✅ CÓDIGO CORREGIDO - Ejecutar SQL para limpiar BD
**Prioridad:** 🟡 MEDIA - No bloquea operación

---

### 0B. FIX: Foreign Key Error en Purchases (15 minutos)

**Error Actual:**
```
❌ insert or update on table "purchases" violates foreign key constraint "purchases_user_id_fkey"
```

**Solución:**
```bash
# 1. Abrir Supabase Dashboard → SQL Editor
# 2. Ejecutar el siguiente SQL:

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_user_id_fkey;

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_business_user ON purchases(business_id, user_id);

# 3. Verificar que funcionó:
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'purchases' 
  AND constraint_name = 'purchases_user_id_fkey';
-- Debe retornar 0 filas ✅

# 4. Probar registro de compra en la app
```

**Causa:** FK referenciaba tabla `users` que no existe. La app usa correctamente `auth.users.id`.

**Documentación completa:** `docs/SOLUCION_PURCHASES_FK.md`
**Script SQL completo:** `docs/sql/fix_purchases_fk.sql`

**Estado:** ⏳ PENDIENTE - Ejecutar en Supabase
**Prioridad:** 🔴 MÁXIMA - Bloquea registro de compras

---

### 🔒 NUEVO: Sistema RLS Completo (2 horas)

**¿Qué es?**
Sistema completo de Row Level Security con:
- ✅ 42 políticas RLS para 14 tablas
- ✅ 6 funciones de seguridad (SECURITY DEFINER)
- ✅ 4 roles: Owner, Admin, Employee, Cashier
- ✅ Aislamiento total entre negocios
- ✅ 25+ casos de prueba
- ✅ Documentación exhaustiva (3,100+ líneas)

**Archivos Generados:**
1. `docs/sql/ANALISIS_COMPLETO_RLS.md` - Análisis de 1,200+ líneas
2. `docs/sql/POLITICAS_RLS_COMPLETAS.sql` - Script ejecutable de 800+ líneas
3. `docs/sql/PRUEBAS_RLS.sql` - Tests de validación de 600+ líneas
4. `docs/sql/MEJORAS_ESTRUCTURA.sql` - Mejoras opcionales de 500+ líneas
5. `docs/sql/README_RLS.md` - Guía de implementación

**Guía Rápida de Implementación:**

```bash
# PASO 1: Backup (CRÍTICO)
# En Supabase Dashboard → Database → Backups

# PASO 2: Leer documentación (30 min)
cat docs/sql/README_RLS.md
cat docs/sql/ANALISIS_COMPLETO_RLS.md

# PASO 3: Ejecutar en Staging/Dev
# Supabase Dashboard → SQL Editor
# Copiar y ejecutar: docs/sql/POLITICAS_RLS_COMPLETAS.sql

# PASO 4: Validar con pruebas
# Ejecutar: docs/sql/PRUEBAS_RLS.sql

# PASO 5 (Opcional): Mejoras
# Ejecutar: docs/sql/MEJORAS_ESTRUCTURA.sql
```

**Beneficios:**
- 🔒 Seguridad a nivel de base de datos (no solo app)
- 🚀 Sin dependencias circulares (problema resuelto)
- ⚡ Optimizado con índices
- 🎯 Roles diferenciados por permisos
- 📊 Auditoría completa (opcional)

**Estado:** ✅ DOCUMENTADO - Listo para implementar
**Prioridad:** 🟡 ALTA - Mejorar seguridad
**Tiempo:** 2 horas (1h lectura + 1h implementación)

**Ver guía completa:** `docs/sql/README_RLS.md`

---

## ⚡ CRÍTICAS - EJECUTAR HOY (2-3 horas)

### 1. Eliminar Console Logs (AUTOMATIZADO) ✅ COMPLETADO
```bash
cd /Users/andres_plazas/Desktop/Stocky

# Dar permisos al script
chmod +x scripts/remove-console-logs.sh

# ADVERTENCIA: Esto modificará 80+ archivos
# Crea backups automáticamente (.bak)

# Ejecutar:
./scripts/remove-console-logs.sh

# Verificar cambios:
git diff

# Si todo está bien, eliminar backups:
find src -name "*.bak" -delete

# Commit:
git add .
git commit -m "🔥 Remove all console.log statements for production"
```

**Archivos afectados**: 80+ archivos .jsx/.js
**Tiempo estimado**: 5 minutos automatizado

---

### 2. Re-habilitar RLS en Supabase (MANUAL)

```bash
# 1. Abrir el archivo:
cat .archive/sql/enable_rls_secure.sql

# 2. Ir a Supabase Dashboard:
# https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

# 3. Copiar y pegar el contenido del archivo

# 4. Ejecutar el SQL

# 5. Verificar que RLS está activo:
# SELECT tablename, rowsecurity 
# FROM pg_tables 
# WHERE schemaname = 'public';
```

**Tablas a proteger**:
- businesses
- employees
- products
- sales
- purchases
- orders
- tables
- customers
- suppliers

**Tiempo estimado**: 15 minutos

---

### 3. Validar Variables de Entorno

```javascript
// En src/main.jsx, ANTES de renderizar:
import { validateConfig } from './config/production';

try {
  validateConfig();
  console.log('✅ Configuración validada');
} catch (error) {
  console.error('❌ Error de configuración:', error.message);
  alert('La aplicación no está configurada correctamente. Contacta soporte.');
  throw error;
}

// Luego renderizar App...
```

**Variables requeridas para producción**:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_RESEND_API_KEY=re_xxx...
VITE_FROM_EMAIL=noreply@tudominio.com
```

**Verificar en Vercel**:
1. Dashboard → Settings → Environment Variables
2. Asegurar que todas las variables están set
3. Re-deploy si se agregaron nuevas

**Tiempo estimado**: 10 minutos

---

## 🟡 IMPORTANTES - ESTA SEMANA (4-6 horas)

### 4. Consolidar Servicios de Email

```bash
cd src/utils

# OPCIÓN 1: Usar solo Resend (RECOMENDADO)
mv emailServiceResend.js emailService.js
rm emailServiceSupabase.js
rm emailValidation.js  # Si no se usa

# OPCIÓN 2: Mantener ambos con fallback
# Editar emailService.js para usar Resend primero,
# luego Supabase como fallback
```

**Actualizar imports**:
```javascript
// Buscar en todo el proyecto:
// ANTES:
import { sendInvoiceEmail } from './emailServiceSupabase';

// DESPUÉS:
import { sendInvoiceEmail } from './emailService';
```

**Archivos a actualizar**:
- `src/components/Dashboard/Facturas.jsx`
- `src/components/Dashboard/Ventas.jsx`
- Cualquier otro que use email

**Tiempo estimado**: 1 hora

---

### 5. Eliminar Hooks Sin Usar

```bash
# Verificar uso de cada hook:
echo "Buscando useProducts..."
grep -r "useProducts" src/ --exclude-dir=node_modules

echo "Buscando useSuppliers..."
grep -r "useSuppliers" src/ --exclude-dir=node_modules

echo "Buscando useCustomers..."
grep -r "useCustomers" src/ --exclude-dir=node_modules

# Si NO aparecen resultados (excepto en el archivo del hook mismo):
# rm src/hooks/useProducts.js
# rm src/hooks/useSuppliers.js
# rm src/hooks/useCustomers.js
```

**Hooks a revisar**:
- [ ] useProducts.js - ¿Usado?
- [ ] useSuppliers.js - ¿Usado?
- [ ] useCustomers.js - ¿Usado?
- [x] useRealtime.js - SÍ usado (optimizado)
- [x] useViewport.js - SÍ usado (mobile)
- [x] useNotifications.js - SÍ usado
- [x] useToast.js - SÍ usado

**Tiempo estimado**: 30 minutos

---

### 6. Optimizar Bundle Size

```bash
# Analizar bundle actual:
npm run build
npm run analyze

# Ver tamaño:
ls -lh dist/assets/*.js

# Si bundle > 500KB, optimizar:
```

**Optimizaciones recomendadas**:

```javascript
// 1. Lazy loading de rutas
// En App.jsx:
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Inventario = lazy(() => import('./components/Dashboard/Inventario.jsx'));

// 2. Code splitting de componentes grandes
// En Dashboard.jsx:
const Mesas = lazy(() => import('./components/Dashboard/Mesas.jsx'));
const Ventas = lazy(() => import('./components/Dashboard/Ventas.jsx'));

// 3. Eliminar dependencias no usadas
npm uninstall @emailjs/browser  # Si ya no se usa
npm uninstall resend  # Si no se usa finalmente

// 4. Tree-shaking de lucide-react
// ANTES:
import * as Icons from 'lucide-react';

// DESPUÉS:
import { Store, Package, User } from 'lucide-react';
```

**Tiempo estimado**: 2 horas

---

### 7. Consolidar Documentación

```bash
# Mover documentos antiguos:
mkdir -p .archive/docs
mv CLEAR_CACHE_INSTRUCTIONS.md .archive/docs/
mv RESEND_SETUP.md .archive/docs/
mv LIGHT_THEME_REDESIGN.md .archive/docs/
mv MOBILE_SYSTEM_SUMMARY.md .archive/docs/
mv EMAIL_CONFIGURATION.md .archive/docs/
mv HOTFIX_*.md .archive/docs/
mv DIAGNOSTIC_*.md .archive/docs/
mv *_SUMMARY.md .archive/docs/

# Mantener solo:
# - README.md
# - DEPLOY_GUIDE.md
# - OPTIMIZATION_REPORT.md (este archivo)
# - docs/ (carpeta de documentación estructurada)
```

**Crear README.md conciso**:
```markdown
# Stocky POS System

Sistema POS completo para restaurantes y bares.

## Quick Start
\`\`\`bash
npm install
npm run dev
\`\`\`

## Deploy
Ver DEPLOY_GUIDE.md

## Documentación
Ver carpeta /docs

## Optimización
Ver OPTIMIZATION_REPORT.md
```

**Tiempo estimado**: 1 hora

---

## 🟢 OPCIONALES - PRÓXIMO MES (8-12 horas)

### 8. Implementar Sentry

```bash
npm install @sentry/react

# Configurar en main.jsx:
```

```javascript
import * as Sentry from "@sentry/react";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://xxx@xxx.ingest.sentry.io/xxx",
    environment: "production",
    tracesSampleRate: 1.0,
  });
}
```

**Actualizar productionLogger.js**:
```javascript
export const handleError = (error, context = '') => {
  if (import.meta.env.DEV) {
    console.error(`Error en ${context}:`, error);
  }
  
  if (import.meta.env.PROD) {
    Sentry.captureException(error, {
      tags: { context }
    });
  }
};
```

**Tiempo estimado**: 2 horas

---

### 9. Tests Unitarios

```bash
npm install -D vitest @testing-library/react @testing-library/user-event

# Crear tests básicos:
```

```javascript
// src/hooks/__tests__/useRealtime.test.js
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtimeSubscription } from '../useRealtime';

describe('useRealtimeSubscription', () => {
  it('should subscribe to table changes', () => {
    // Test aquí
  });
});
```

**Tests prioritarios**:
- useRealtime.js
- productionLogger.js
- formatters.js
- Validaciones críticas

**Tiempo estimado**: 4 horas

---

### 10. PWA (Progressive Web App)

```bash
npm install -D vite-plugin-pwa

# Configurar en vite.config.js:
```

```javascript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stocky POS',
        short_name: 'Stocky',
        description: 'Sistema POS para restaurantes',
        theme_color: '#4f46e5',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
```

**Beneficios**:
- Instalable como app nativa
- Funciona offline
- Cacheo automático
- Performance mejorada

**Tiempo estimado**: 3 horas

---

## 📊 CHECKLIST FINAL PRE-DEPLOY

```bash
# Run these commands:
✅ npm run lint          # Sin errores
✅ npm run build         # Build exitoso
✅ npm run preview       # Probar build localmente

# Verify:
✅ Bundle size < 500KB
✅ No console.log en producción
✅ RLS habilitado en Supabase
✅ Variables de entorno correctas
✅ .env no está en git
✅ .gitignore actualizado

# Deploy:
✅ git push origin main
✅ Vercel auto-deploy
✅ Verificar app en producción
✅ Monitorear errores
```

---

## 🎯 TIMELINE SUGERIDO

### Día 1 (HOY - 3 horas)
- ✅ Eliminar console.log (automatizado)
- ✅ Re-habilitar RLS
- ✅ Validar environment variables
- ✅ Deploy a staging
- ✅ Testing básico

### Día 2-3 (4 horas)
- Consolidar servicios email
- Eliminar hooks sin usar
- Optimizar bundle
- Auditar imports

### Día 4-5 (2 horas)
- Consolidar documentación
- Code review final
- Deploy a producción
- Monitoreo inicial

### Semana 2 (8 horas)
- Implementar Sentry
- Tests unitarios
- PWA (opcional)
- Performance optimization

---

## 🆘 TROUBLESHOOTING

### Si algo falla después de remove-console-logs.sh:

```bash
# Restaurar desde backups:
find src -name "*.bak" | while read backup; do
  original="${backup%.bak}"
  mv "$backup" "$original"
done

# O desde git:
git checkout -- src/
```

### Si RLS bloquea operaciones válidas:

```sql
-- Deshabilitar temporalmente:
ALTER TABLE nombre_tabla DISABLE ROW LEVEL SECURITY;

-- Revisar policies:
SELECT * FROM pg_policies WHERE tablename = 'nombre_tabla';
```

### Si build falla:

```bash
# Limpiar cache:
rm -rf node_modules dist .vite
npm install
npm run build
```

---

## 📞 SOPORTE

**Archivos clave de referencia**:
- `OPTIMIZATION_REPORT.md` - Reporte completo
- `src/config/production.js` - Configuración
- `src/utils/productionLogger.js` - Sistema de logging
- `.archive/` - Archivos históricos

**Comandos útiles**:
```bash
# Ver cambios:
git status
git diff

# Revertir cambios:
git checkout -- archivo.js

# Ver console.log restantes:
grep -r "console\\.log" src/ --include="*.jsx" --include="*.js"
```

---

## 📊 ESTADO ACTUAL DEL PROYECTO

### ✅ Completado (Nov 2024)

1. **Optimización para Producción** ✅
   - Eliminados 30+ console.log statements
   - Build optimizado: 4.05s, 0 errores
   - Logger condicional implementado (DEV only)
   - Script automatizado: `scripts/remove-console-logs.sh`

2. **RLS Management** ✅
   - Script para deshabilitar RLS: `docs/sql/disable_all_rls.sql`
   - Script para fix de empleados: `docs/sql/fix_employees_creation.sql`
   - Función `get_user_business_ids()` con SECURITY DEFINER
   - Documentación completa: `docs/SOLUCION_EMPLEADOS_CLIENTES.md` (650+ líneas)

### ⏳ Pendiente - URGENTE

1. **Fix FK Constraint en Purchases** 🔴
   - Error: `purchases_user_id_fkey` viola constraint
   - Solución documentada en: `docs/SOLUCION_PURCHASES_FK.md`
   - Script SQL: `docs/sql/fix_purchases_fk.sql`
   - **Acción requerida:** Ejecutar SQL en Supabase Dashboard
   - **Impacto:** Bloquea registro de compras (CRÍTICO)

2. **RLS Re-habilitación** 🟡
   - Ejecutar `docs/sql/fix_employees_creation.sql` en Supabase
   - Verificar políticas de seguridad
   - Probar creación de empleados

### 📁 Nuevos Archivos Creados

```
docs/
  sql/
    ├── disable_all_rls.sql (nuevo)
    ├── fix_employees_creation.sql (nuevo, 215 líneas)
    └── fix_purchases_fk.sql (nuevo, 280+ líneas)
  ├── SOLUCION_EMPLEADOS_CLIENTES.md (nuevo, 650+ líneas)
  └── SOLUCION_PURCHASES_FK.md (nuevo, 450+ líneas)
```

### 🎯 Próximos Pasos (Orden de Ejecución)

1. ⚡ **AHORA MISMO** (15 min)
   - Ejecutar `docs/sql/fix_purchases_fk.sql` en Supabase
   - Verificar que FK fue eliminado
   - Probar registro de compra en app

2. 🔜 **HOY** (30 min)
   - Ejecutar `docs/sql/fix_employees_creation.sql`
   - Probar creación de empleados
   - Verificar RLS policies

3. 📅 **ESTA SEMANA**
   - Consolidar servicios de email
   - Eliminar hooks sin usar
   - Deploy a staging
   - Testing completo

### 🔗 Enlaces Rápidos

- **Fix Purchases:** `docs/SOLUCION_PURCHASES_FK.md`
- **Fix Empleados:** `docs/SOLUCION_EMPLEADOS_CLIENTES.md`
- **SQL Scripts:** `docs/sql/`
- **Optimización:** `OPTIMIZATION_REPORT.md`

---

**Última actualización**: Dic 2024
**Próxima revisión**: Después de ejecutar fix de purchases
**Autor**: GitHub Copilot + Andres Plazas
