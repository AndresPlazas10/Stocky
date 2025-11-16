# 🧹 Instrucciones para Limpiar Caché de Vercel

## El Problema

Los errores que estás viendo son del **código anterior en caché**:
- ❌ Error 409 con parámetro `columns` (ya no existe en el código)
- ❌ ReferenceError 'Cannot access J' (del código compilado con SWC)

## Solución: Limpiar Caché en Vercel

### Opción 1: Desde el Dashboard de Vercel (Recomendado)

1. **Ir a tu proyecto en Vercel**
   - https://vercel.com/dashboard
   - Selecciona el proyecto "Stockly" o "FiertMart"

2. **Ir a Settings**
   - Click en la pestaña "Settings" arriba

3. **Data Cache**
   - En el menú lateral, busca "Data" o "Caching"
   - Click en "Clear Data Cache" o "Purge Cache"

4. **Force Redeploy**
   - Volver a la pestaña "Deployments"
   - En el último deployment, click en los 3 puntos (...)
   - Seleccionar "Redeploy"
   - ✅ Marcar la opción **"Use existing Build Cache"** en OFF (importante!)
   - Click "Redeploy"

### Opción 2: Desde la Terminal (CLI)

```bash
# 1. Asegúrate de estar en el directorio del proyecto
cd /Users/andres_plazas/Desktop/Stockly

# 2. Limpiar caché local
rm -rf .vercel dist node_modules/.vite

# 3. Rebuild
npm run build

# 4. Force redeploy sin caché
npx vercel --prod --force
```

### Opción 3: Agregar Header de Cache-Control

Si los problemas persisten, puedes forzar que los navegadores no cacheen:

**Crear/editar `vercel.json`:**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## Verificación Post-Deploy

### En el Navegador (Usuario Final)

1. **Limpiar caché del navegador**:
   - Chrome/Edge: Ctrl+Shift+Delete → Borrar caché
   - O Hard Refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

2. **Modo incógnito**:
   - Probar en ventana privada para verificar sin caché

3. **DevTools**:
   - F12 → Network tab
   - ✅ Desmarcar "Disable cache"
   - Reload
   - Verificar que los archivos `.js` tengan el hash nuevo `CXwxHOpU`

### Verificar que el Nuevo Build se Deployó

```bash
# Ver el hash del archivo en producción
curl -I https://tu-dominio.vercel.app/assets/index-*.js

# Debe incluir el nuevo hash: index-CXwxHOpU.js
```

## Cambios Técnicos Aplicados

### Antes (Problemático)
```javascript
// vite.config.js
import react from '@vitejs/plugin-react-swc'  // ❌ SWC con React 19.2
plugins: [react()],
minify: 'esbuild',  // ❌ Causaba referencias circulares
```

### Ahora (Estable)
```javascript
// vite.config.js
import react from '@vitejs/plugin-react'  // ✅ Babel estándar
plugins: [react({ babel: { plugins: [] } })],
minify: 'terser',  // ✅ Más confiable
target: 'es2020',  // ✅ Compatibilidad mejorada
```

## Troubleshooting

### Si sigue dando error después del deploy:

1. **Verificar que el deployment fue exitoso**
   ```bash
   npx vercel ls
   ```
   Debe mostrar el deployment más reciente con status "Ready"

2. **Verificar variables de entorno**
   - Vercel Dashboard → Settings → Environment Variables
   - Confirmar que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están configuradas

3. **Ver logs del deployment**
   ```bash
   npx vercel logs tu-deployment-url
   ```

4. **Redeploy forzado desde terminal**
   ```bash
   npx vercel --prod --force --no-cache
   ```

## Resumen de Comandos Rápidos

```bash
# Limpiar todo localmente
rm -rf dist node_modules/.vite .vercel

# Rebuild
npm run build

# Deploy forzado sin caché
npx vercel --prod --force

# Ver status
npx vercel ls

# Ver logs
npx vercel logs
```

---

**Última actualización**: 15 de noviembre de 2025
**Commit**: 37caa8e
**Bundle hash**: CXwxHOpU
