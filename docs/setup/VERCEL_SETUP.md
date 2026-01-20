# 🚀 Configuración de Variables de Entorno en Vercel

Esta guía te ayudará a configurar las variables de entorno necesarias para que Resend funcione en producción.

## 📋 Checklist Rápido

- [ ] Tener proyecto desplegado en Vercel
- [ ] Tener API Key de Resend (`re_RBm8gZw1_Lspv5VqCYzFNGkANzmnTfz9f`)
- [ ] Acceso al dashboard de Vercel
- [ ] 5 minutos de tiempo

---

## 🔧 Paso 1: Acceder a la Configuración (30 segundos)

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto **Stocky** (o como lo hayas nombrado)
3. Click en **Settings** (arriba a la derecha)
4. En el menú lateral izquierdo, click en **Environment Variables**

---

## 🔑 Paso 2: Agregar Variables de Resend (2 minutos)

### Variable 1: API Key de Resend

1. En el campo **Name**, escribe:
   ```
   VITE_RESEND_API_KEY
   ```

2. En el campo **Value**, pega tu API key:
   ```
   re_RBm8gZw1_Lspv5VqCYzFNGkANzmnTfz9f
   ```

3. Selecciona los ambientes donde aplicará:
   - ✅ **Production** (obligatorio)
   - ✅ **Preview** (recomendado para testing)
   - ⬜ **Development** (no necesario, usas `.env.local`)

4. Click en **Add**

### Variable 2: Email remitente

1. En el campo **Name**, escribe:
   ```
   VITE_RESEND_FROM_EMAIL
   ```

2. En el campo **Value**, escribe:
   ```
   noreply@stocky.com
   ```
   
   **⚠️ NOTA:** Si aún no has verificado el dominio `stocky.com` en Resend, usa temporalmente:
   ```
   onboarding@resend.dev
   ```

3. Selecciona los ambientes:
   - ✅ **Production**
   - ✅ **Preview**

4. Click en **Add**

---

## 📧 Paso 3: Agregar Variable de Email de Pruebas (Opcional, 1 min)

Si quieres que los deploys de **Preview** también usen email de testing:

1. **Name:**
   ```
   VITE_TEST_EMAIL
   ```

2. **Value:**
   ```
   andres.plazas@example.com
   ```

3. Selecciona **SOLO**:
   - ⬜ Production (NO)
   - ✅ **Preview** (SÍ)

4. Click en **Add**

Esto hará que los branches de preview envíen emails al email de prueba, no a clientes reales.

---

## 🔄 Paso 4: Re-desplegar la Aplicación (1 minuto)

Después de agregar las variables, debes redesplegar para que tomen efecto:

### Opción A: Desde Vercel Dashboard

1. Ve a la pestaña **Deployments**
2. Encuentra el último deployment exitoso
3. Click en los **3 puntos** (⋯) a la derecha
4. Selecciona **Redeploy**
5. En el modal, deja marcado **Use existing Build Cache**
6. Click en **Redeploy**

### Opción B: Desde Git (recomendado)

Haz un commit vacío para forzar redespliegue:

```bash
cd /Users/andres_plazas/Desktop/Stocky
git commit --allow-empty -m "chore: trigger redeploy for Resend config"
git push origin main
```

Vercel detectará el push y redesplegarà automáticamente.

---

## ✅ Paso 5: Verificar la Configuración (1 minuto)

### 5.1 Verificar variables agregadas

En **Settings** → **Environment Variables** deberías ver:

```
VITE_RESEND_API_KEY          Production, Preview    •••••••z9f
VITE_RESEND_FROM_EMAIL       Production, Preview    noreply@stocky.com
VITE_TEST_EMAIL             Preview                andres.plazas@example.com (opcional)
```

### 5.2 Verificar build exitoso

1. Ve a la pestaña **Deployments**
2. Espera a que el nuevo deployment muestre **Ready** (1-2 minutos)
3. Click en el deployment
4. Verifica que no haya errores en los logs

### 5.3 Probar envío de email en producción

1. Visita tu URL de producción (ej: `stockly.vercel.app`)
2. Ve a **Ventas** → Crea una venta
3. Genera una factura e ingresa un email REAL
4. Verifica que el email llegue al destinatario

**📊 Monitoreo:**
- Ve a https://resend.com/emails para ver el status del email
- Deberías ver: `Delivered` (✅) en lugar de `Bounced` (❌)

---

## 🌐 Variables de Entorno Completas para Vercel

Aquí está la lista completa de variables que deberías tener configuradas:

### Variables de Supabase (si no las tienes):

```
VITE_SUPABASE_URL=https://wngjyrkqxblnhxliakqj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ2p5cmtxeGJsbmh4bGlha3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MjQ3NDEsImV4cCI6MjA3ODMwMDc0MX0.u8ZcugaNYFnl_j0Acex8GQTFoDcUeRJibiL0aOe7yW0
```

### Variables de EmailJS (fallback, opcional):

```
VITE_EMAILJS_PUBLIC_KEY=6RrzlGmb6SzFtpcOM
VITE_EMAILJS_SERVICE_ID=service_62fvrkd
VITE_EMAILJS_TEMPLATE_ID=template_mkz4rb4
```

### Variables de Resend (nuevas):

```
VITE_RESEND_API_KEY=re_RBm8gZw1_Lspv5VqCYzFNGkANzmnTfz9f
VITE_RESEND_FROM_EMAIL=noreply@stocky.com
```

---

## 🐛 Troubleshooting

### ❌ Error: "Missing API key"

**Causa:** Variable `VITE_RESEND_API_KEY` no configurada o mal escrita

**Solución:**
1. Verifica el nombre exacto: `VITE_RESEND_API_KEY` (con guiones bajos)
2. Verifica que esté en el ambiente **Production**
3. Redesplega después de agregarla

### ❌ Error: "Invalid from address"

**Causa:** Dominio `stocky.com` no verificado en Resend

**Solución:**
Temporalmente usa `onboarding@resend.dev`:
1. Ve a Settings → Environment Variables
2. Edita `VITE_RESEND_FROM_EMAIL`
3. Cambia a: `onboarding@resend.dev`
4. Redesplega

### ❌ Emails no llegan en producción

**Diagnóstico:**
1. Ve a https://resend.com/emails
2. Busca el email enviado
3. Revisa el status:
   - **Delivered**: ✅ Todo bien
   - **Bounced**: ❌ Email inválido
   - **Pending**: ⏳ Espera unos segundos

**Solución común:**
- Verifica que el email del cliente sea válido
- Revisa los logs de Vercel para errores
- Asegúrate de que el dominio esté verificado (si usas stocky.com)

### ❌ Variables no toman efecto

**Causa:** No redespleaste después de agregarlas

**Solución:**
```bash
git commit --allow-empty -m "chore: redeploy"
git push origin main
```

---

## 📊 Monitoreo Post-Deploy

### Dashboard de Resend
- URL: https://resend.com/emails
- Métricas: Delivered, Bounced, Opened
- Objetivo: >99% delivery rate

### Logs de Vercel
- Ve a **Deployments** → Click en deployment → **Function Logs**
- Busca: `✅ Email enviado con Resend`
- Si ves errores, revisa las variables

### Console del navegador (producción)
- Abre DevTools en tu sitio de producción
- Ve a Console
- Deberías ver: `📧 Usando Resend`

---

## 🎯 Próximos Pasos (Opcional)

### 1. Verificar dominio stocky.com

Para usar `noreply@stocky.com` necesitas:

1. Ve a https://resend.com/domains
2. Click en **Add Domain**
3. Ingresa: `stocky.com`
4. Resend te dará registros DNS:

```dns
TXT @ "v=spf1 include:_spf.resend.com ~all"
TXT resend._domainkey [valor único que te den]
TXT _dmarc "v=DMARC1; p=none"
```

5. Agrega estos registros en tu proveedor de DNS (GoDaddy, Namecheap, Cloudflare, etc.)
6. Espera 5-10 minutos
7. En Resend, click en **Verify Domain**

### 2. Configurar límites de rate

Si tienes mucho tráfico, considera:
- **Plan Free**: 3,000 emails/mes (100/día)
- **Plan Pro**: $20/mes → 50,000 emails/mes

### 3. Analytics de emails

Activa tracking en Resend:
```javascript
// En emailServiceResend.js, agrega:
tags: [
  { name: 'category', value: 'invoice' },
  { name: 'environment', value: 'production' }
]
```

---

## ✅ Checklist Final

Antes de considerar completo:

- [ ] Variables agregadas en Vercel (VITE_RESEND_API_KEY, VITE_RESEND_FROM_EMAIL)
- [ ] Redespliegue exitoso (sin errores)
- [ ] Email de prueba enviado y recibido en producción
- [ ] Dashboard de Resend muestra "Delivered"
- [ ] Logs de Vercel muestran "✅ Email enviado con Resend"
- [ ] (Opcional) Dominio stocky.com verificado
- [ ] (Opcional) Variables de entorno documentadas en README

---

## 📚 Recursos

- **Vercel Docs**: https://vercel.com/docs/projects/environment-variables
- **Resend Docs**: https://resend.com/docs/send-with-nextjs
- **Guía de DNS**: RESEND_SETUP.md (en este repo)
- **Troubleshooting**: EMAIL_CONFIGURATION.md

---

**⏱️ Tiempo total estimado: 5-10 minutos**

¿Necesitas ayuda? Revisa los logs de Vercel o el dashboard de Resend para diagnóstico.
