# 🎯 LISTA DE ACCIONES ESPECÍFICAS PARA PRODUCCIÓN

## ⚡ CRÍTICAS - EJECUTAR HOY (2-3 horas)

### 1. Eliminar Console Logs (AUTOMATIZADO)
```bash
cd /Users/andres_plazas/Desktop/Stockly

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
# Stockly POS System

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
        name: 'Stockly POS',
        short_name: 'Stockly',
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

**Última actualización**: 24 Nov 2025
**Próxima revisión**: Después del deploy a producción
