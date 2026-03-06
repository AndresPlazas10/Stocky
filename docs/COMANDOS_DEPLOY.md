# 🚀 Comandos de Deploy - Guía Rápida

## Pre-Deploy Checklist

```bash
# 1. Verificar que no hay errores
npm run lint

# 2. Hacer build de prueba
npm run build

# 3. Preview del build localmente
npm run preview

# 4. Verificar archivos que se van a subir
git status

# 5. Asegurarse de que .env.local NO está en staging
git ls-files | grep .env
# Debe estar vacío (no debe aparecer .env ni .env.local)
```

---

## Deploy a GitHub

### Primera vez
```bash
# Inicializar Git (si no está inicializado)
git init

# Agregar remote
git remote add origin https://github.com/TU_USUARIO/stockly.git

# Agregar archivos
git add .

# Commit
git commit -m "🚀 Initial commit - Stocky POS System

✅ Sistema completo de punto de venta
✅ Gestión de inventario
✅ Ventas y compras
✅ Facturación electrónica
✅ Gestión de empleados
✅ Reportes y análisis

Optimizaciones:
- Corregido error 409 en productos
- Corregido total 0 en compras
- Eliminadas referencias employee_invitations
- Limpiado console.logs para producción
- 0 errores de compilación"

# Push
git push -u origin main
```

### Actualizaciones
```bash
# Ver cambios
git status

# Agregar cambios
git add .

# Commit con mensaje descriptivo
git commit -m "🔧 Descripción del cambio

- Cambio 1
- Cambio 2
- Cambio 3"

# Push
git push origin main
```

---

## Deploy en Vercel

### Opción 1: Desde Vercel Dashboard (Recomendado)

1. Ve a https://vercel.com
2. Click "Add New" → "Project"
3. Importa tu repositorio de GitHub
4. Configura:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. Agrega Variables de Entorno:
   ```
   VITE_SUPABASE_URL = tu_url_supabase
   VITE_SUPABASE_ANON_KEY = tu_anon_key
   RESEND_API_KEY = tu_resend_key (opcional)
   VITE_APP_URL = https://tu-app.vercel.app
   ```

6. Click "Deploy"

### Opción 2: Desde CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (primera vez)
vercel

# Deploy a producción
vercel --prod

# Ver logs en tiempo real
vercel logs --follow
```

---

## Comandos Git Útiles

```bash
# Ver estado actual
git status

# Ver diferencias
git diff

# Ver historial de commits
git log --oneline

# Deshacer cambios no guardados
git checkout -- .

# Deshacer último commit (mantiene cambios)
git reset --soft HEAD~1

# Ver archivos ignorados
git ls-files --others --ignored --exclude-standard

# Limpiar archivos no rastreados
git clean -fd

# Ver ramas
git branch -a

# Crear nueva rama
git checkout -b feature/nueva-funcionalidad

# Cambiar de rama
git checkout main

# Merge de rama
git merge feature/nueva-funcionalidad

# Eliminar rama
git branch -d feature/nueva-funcionalidad
```

---

## Troubleshooting

### Error: "Module not found"
```bash
# Limpiar node_modules
rm -rf node_modules package-lock.json

# Reinstalar dependencias
npm install

# Limpiar cache de Vite
rm -rf .vite
```

### Error: "Build failed"
```bash
# Ver errores detallados
npm run build --verbose

# Verificar sintaxis
npm run lint

# Limpiar y rebuild
npm run clean && npm run build
```

### Error: Variables de entorno no funcionan
```bash
# En Vercel Dashboard:
# 1. Settings → Environment Variables
# 2. Asegurarse de que están en "Production"
# 3. Redeploy después de agregar variables

# Verificar localmente
echo $VITE_SUPABASE_URL

# O en Node
node -e "console.log(process.env.VITE_SUPABASE_URL)"
```

### Deploy se cuelga en Vercel
```bash
# 1. Cancel deploy actual
# 2. Verifica que build funciona localmente:
npm run build

# 3. Si funciona local, redeploy en Vercel
vercel --prod --force
```

---

## Scripts NPM

```bash
# Desarrollo
npm run dev              # Servidor local puerto 5173

# Build
npm run build            # Compilar para producción
npm run preview          # Preview del build

# Calidad de código
npm run lint             # ESLint
npm run lint:fix         # Auto-fix de ESLint

# Limpieza
npm run clean            # Limpiar archivos generados
rm -rf dist node_modules # Limpieza completa
```

---

## Verificación Post-Deploy

### 1. Verificar que el sitio carga
```bash
# Abrir sitio en navegador
open https://tu-app.vercel.app

# O con curl
curl -I https://tu-app.vercel.app
```

### 2. Verificar variables de entorno
```javascript
// En consola del navegador (F12)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
// Debe mostrar tu URL de Supabase
```

### 3. Verificar funcionalidad
- [ ] Registro de usuario funciona
- [ ] Login funciona
- [ ] Dashboard carga
- [ ] Crear producto funciona (sin error 409)
- [ ] Crear compra funciona (total != 0)
- [ ] Crear venta funciona

### 4. Verificar errores en consola
```javascript
// No debe haber:
// ❌ Error 409 al crear productos
// ❌ Error 404 a employee_invitations
// ❌ Errores de CORS
// ❌ Console.logs de desarrollo
```

---

## Rollback en caso de Problemas

### En Vercel Dashboard
1. Deployments → Click en deployment anterior que funcionaba
2. Click en "..." → "Promote to Production"

### Desde CLI
```bash
# Ver deployments
vercel ls

# Promover deployment anterior
vercel promote [deployment-url]
```

### En Git
```bash
# Ver commits
git log --oneline

# Revertir a commit anterior
git reset --hard [commit-hash]

# Force push (cuidado!)
git push --force origin main
```

---

## Monitoreo

### Logs en Vercel
```bash
# Ver logs en tiempo real
vercel logs --follow

# Ver últimos logs
vercel logs

# Filtrar por tipo
vercel logs --output=raw
```

### Métricas en Vercel Dashboard
- Analytics → Ver tráfico, errores, performance
- Deployments → Ver estado de cada deploy
- Settings → Ver configuración

---

## Consejos de Producción

### ✅ Hacer ANTES de cada deploy
- Probar localmente con `npm run build && npm run preview`
- Verificar que no hay console.logs de debug
- Revisar que .env.local no está en Git
- Hacer commit descriptivo

### ❌ NO hacer en producción
- NO usar console.log() para debugging
- NO hacer console.error() innecesarios
- NO subir archivos .env a GitHub
- NO hacer push directo sin probar local
- NO hardcodear credenciales

### 🔐 Seguridad
- Siempre usar variables de entorno
- Nunca exponer claves privadas
- Usar HTTPS siempre
- Verificar políticas RLS en Supabase

---

## Comandos de Emergencia

### Sitio caído
```bash
# 1. Verificar logs
vercel logs --follow

# 2. Rollback a versión anterior
vercel promote [url-deploy-anterior]

# 3. Si es problema de BD, verificar Supabase
# Dashboard Supabase → Logs
```

### Error masivo en BD
```sql
-- Hacer backup ANTES de cualquier cambio crítico
-- En Supabase SQL Editor:

-- Backup de tabla
CREATE TABLE products_backup AS SELECT * FROM products;

-- Restaurar si algo sale mal
DELETE FROM products;
INSERT INTO products SELECT * FROM products_backup;
```

### Deshacer deploy malo
```bash
# Opción 1: Rollback en Vercel (recomendado)
vercel promote [deployment-anterior]

# Opción 2: Revertir código y redeploy
git revert HEAD
git push origin main
```

---

## Variables de Entorno por Ambiente

### Desarrollo (.env.local)
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_TEST_EMAIL=tu-email-pruebas@gmail.com
```

### Producción (Vercel)
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_produccion
VITE_APP_URL=https://tu-app.vercel.app
RESEND_API_KEY=re_tu_api_key
```

**⚠️ NUNCA** incluir:
- `VITE_TEST_EMAIL` en producción
- Claves privadas o service role keys
- Datos sensibles

---

## Contactos de Soporte

- **Vercel**: https://vercel.com/support
- **Supabase**: https://supabase.com/support
- **GitHub**: https://support.github.com

---

## Checklist Final de Deploy

```
Pre-Deploy:
├── ✅ npm run build funciona
├── ✅ npm run preview funciona
├── ✅ No hay console.logs
├── ✅ No hay errores de compilación
├── ✅ .env.local no está en Git
└── ✅ Tests básicos pasan

Deploy:
├── ✅ git push origin main
├── ✅ Variables configuradas en Vercel
├── ✅ Build exitoso en Vercel
└── ✅ Deploy completado

Post-Deploy:
├── ✅ Sitio carga correctamente
├── ✅ Login funciona
├── ✅ Dashboard funciona
├── ✅ No hay errores en consola
└── ✅ Funcionalidad crítica verificada
```

🎉 **¡Listo para producción!**
