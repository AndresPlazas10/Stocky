# 🚀 Guía de Despliegue a Producción

Esta guía te ayudará a desplegar Stocky en producción de manera segura y eficiente.

## 📋 Checklist Pre-Despliegue

### ✅ Base de Datos

- [ ] Ejecutar `docs/sql/supabase_functions.sql` en producción
- [ ] Verificar que todas las tablas existen
- [ ] Verificar que RLS está habilitado en todas las tablas
- [ ] Verificar que todas las políticas están creadas
- [ ] Verificar que todos los triggers funcionan
- [ ] Crear backup de la base de datos

### ✅ Variables de Entorno

- [ ] Configurar `VITE_SUPABASE_URL` (producción)
- [ ] Configurar `VITE_SUPABASE_ANON_KEY` (producción)
- [ ] Configurar EmailJS (opcional pero recomendado):
  - [ ] `VITE_EMAILJS_PUBLIC_KEY`
  - [ ] `VITE_EMAILJS_SERVICE_ID`
  - [ ] `VITE_EMAILJS_TEMPLATE_ID`

### ✅ Código

- [ ] Ejecutar `npm run build` sin errores
- [ ] Probar build localmente con `npm run preview`
- [ ] Verificar que no hay console.logs innecesarios
- [ ] Verificar que todas las rutas funcionan
- [ ] Verificar que los assets se cargan correctamente

### ✅ Funcionalidades

- [ ] Login de administrador funciona
- [ ] Login de empleado funciona
- [ ] Creación de productos funciona
- [ ] POS funciona correctamente
- [ ] Facturación funciona
- [ ] Envío de emails funciona (si está configurado)
- [ ] Cancelación de facturas restaura stock
- [ ] Reportes se generan correctamente

### ✅ Seguridad

- [ ] No exponer API keys en el código
- [ ] Verificar RLS en Supabase
- [ ] Cambiar URLs de desarrollo
- [ ] Verificar CORS en Supabase
- [ ] Habilitar autenticación de dos factores en Supabase

---

## 🔧 Métodos de Despliegue

### Opción 1: Vercel (Recomendado) ⭐

**Ventajas:**
- Deploy automático desde GitHub
- HTTPS gratis
- CDN global
- Configuración simple

**Pasos:**

1. **Preparar el repositorio**
```bash
git add .
git commit -m "Preparar para producción"
git push origin main
```

2. **Importar en Vercel**
   - Ve a https://vercel.com
   - Click en "New Project"
   - Importa tu repositorio de GitHub
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Configurar Variables de Entorno**
   - En Vercel Dashboard → Settings → Environment Variables
   - Agregar todas las variables del archivo `.env`

4. **Deploy**
   - Click en "Deploy"
   - Esperar a que termine
   - Tu app estará en: `https://tu-proyecto.vercel.app`

5. **Configurar Dominio Personalizado (Opcional)**
   - Settings → Domains
   - Agregar tu dominio
   - Configurar DNS según instrucciones

---

### Opción 2: Netlify

**Pasos:**

1. **Build el proyecto**
```bash
npm run build
```

2. **Deploy en Netlify**
   - Ve a https://netlify.com
   - Arrastra la carpeta `dist/` al dashboard
   - O conecta tu repositorio de GitHub

3. **Configurar Variables**
   - Site Settings → Build & Deploy → Environment
   - Agregar variables de `.env`

4. **Deploy Continuo**
   - Build command: `npm run build`
   - Publish directory: `dist`

---

### Opción 3: VPS (DigitalOcean, AWS, etc.)

**Para usuarios avanzados**

1. **Compilar**
```bash
npm run build
```

2. **Subir dist/ al servidor**
```bash
scp -r dist/* usuario@servidor:/var/www/stockly/
```

3. **Configurar Nginx**
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    root /var/www/stockly;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

4. **Instalar certificado SSL**
```bash
sudo certbot --nginx -d tu-dominio.com
```

---

## 🔍 Verificación Post-Despliegue

### Tests Funcionales

```bash
# Checklist de pruebas en producción

1. Abrir la URL de producción
   ✅ La página carga correctamente
   
2. Crear una cuenta de prueba
   ✅ Registro funciona
   ✅ Email de bienvenida llega (si está configurado)
   
3. Login como administrador
   ✅ Login exitoso
   ✅ Dashboard carga
   
4. Crear producto de prueba
   ✅ Producto se crea
   ✅ Aparece en inventario
   
5. Hacer venta de prueba
   ✅ POS funciona
   ✅ Stock se reduce
   
6. Generar factura
   ✅ Factura se crea
   ✅ Email se envía (verificar en bandeja)
   
7. Cancelar factura
   ✅ Estado cambia a cancelada
   ✅ Stock se restaura
   
8. Crear empleado
   ✅ Empleado se crea
   ✅ Puede hacer login
   ✅ Permisos funcionan
```

### Monitoreo

```bash
# Verificar en consola del navegador (F12)
✅ No hay errores críticos
✅ Assets se cargan desde CDN
✅ Tiempos de carga < 3 segundos
```

---

## 🐛 Troubleshooting Común

### Problema: "Cannot read properties of undefined"

**Causa:** Variables de entorno no configuradas

**Solución:**
1. Verificar que todas las variables estén en el dashboard de Vercel/Netlify
2. Hacer redeploy

### Problema: "Failed to fetch"

**Causa:** URL de Supabase incorrecta o CORS

**Solución:**
1. Verificar `VITE_SUPABASE_URL` en variables de entorno
2. En Supabase: Settings → API → Site URL
3. Agregar tu dominio de producción

### Problema: "RLS policy violation"

**Causa:** Políticas de seguridad no configuradas

**Solución:**
1. Ejecutar `docs/sql/supabase_functions.sql` en producción
2. Verificar que RLS está habilitado
3. Verificar políticas en Supabase Dashboard

### Problema: Emails no se envían

**Causa:** EmailJS no configurado

**Solución:**
1. Configurar las 3 variables de EmailJS
2. Verificar que el template existe
3. Verificar cuota de emails en EmailJS

---

## 📊 Monitoreo de Producción

### Supabase Dashboard
- Monitorear uso de base de datos
- Verificar logs de errores
- Revisar uso de API

### Vercel/Netlify Analytics
- Visitas por página
- Tiempos de carga
- Errores de runtime

### EmailJS Dashboard
- Emails enviados
- Tasa de éxito
- Cuota restante

---

## 🔄 Actualizaciones

### Deploy de Nuevas Versiones

```bash
# 1. Desarrollar feature en rama
git checkout -b feature/nueva-funcionalidad

# 2. Hacer commit
git add .
git commit -m "feat: nueva funcionalidad"

# 3. Merge a main
git checkout main
git merge feature/nueva-funcionalidad

# 4. Push (deploy automático)
git push origin main
```

### Rollback

```bash
# En Vercel/Netlify
1. Ve a Deployments
2. Encuentra el deploy anterior
3. Click en "Rollback to this deployment"
```

---

## 📞 Soporte

Si encuentras problemas durante el despliegue:

1. Revisa los logs en tu plataforma de hosting
2. Verifica la consola del navegador (F12)
3. Revisa los logs de Supabase
4. Consulta la documentación en `docs/`

---

## ✅ Checklist Final

```bash
✅ Build exitoso sin errores
✅ Variables de entorno configuradas
✅ Base de datos configurada en producción
✅ RLS habilitado y funcionando
✅ Funciones SQL ejecutadas
✅ EmailJS configurado (opcional)
✅ Tests funcionales pasados
✅ Sin errores en consola
✅ HTTPS habilitado
✅ Dominio configurado (opcional)
✅ Monitoreo activado
✅ Backup de base de datos realizado
```

---

## 🎉 ¡Listo para Producción!

Una vez completado este checklist, tu aplicación estará lista para recibir usuarios reales.

**Recuerda:**
- Hacer backups regulares de la base de datos
- Monitorear el uso y rendimiento
- Actualizar dependencias regularmente
- Mantener la documentación actualizada

¡Feliz deploy! 🚀
