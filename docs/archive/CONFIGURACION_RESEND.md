# 🚀 Configuración de Resend - Guía Paso a Paso

## ✅ Ventajas de Resend vs EmailJS

| Característica | Resend | EmailJS |
|----------------|--------|---------|
| Emails gratis/mes | **3,000** | 200 |
| Template | En código (control total) | Dashboard web |
| Deliverability | 99.9% | ~95% |
| Analytics | Dashboard completo | Básico |
| Soporte | Email + Docs | Solo docs |

---

## 📝 Paso 1: Crear Cuenta en Resend

1. **Ir a:** https://resend.com/signup

2. **Registrarse con:**
   - Email de trabajo
   - O cuenta de GitHub (recomendado)

3. **Verificar email** (llega en 1-2 minutos)

---

## 🔑 Paso 2: Obtener API Key

1. **Ir al dashboard:** https://resend.com/api-keys

2. **Hacer clic en:** `Create API Key`

3. **Configurar:**
   - **Name:** `Stockly Production`
   - **Permission:** `Sending access`
   - **Domain:** `All domains` (por ahora)

4. **Copiar la API Key** (empieza con `re_`)
   - ⚠️ Solo se muestra UNA VEZ
   - Guardarla en un lugar seguro

---

## ⚙️ Paso 3: Configurar en Vercel

### Opción A: Desde Dashboard de Vercel (RECOMENDADO)

1. **Ir a:** https://vercel.com/dashboard

2. **Seleccionar tu proyecto:** `stockly` (o como se llame)

3. **Ir a:** Settings → Environment Variables

4. **Agregar nueva variable:**
   ```
   Key: RESEND_API_KEY
   Value: re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. **Agregar segunda variable (email remitente):**
   ```
   Key: RESEND_FROM_EMAIL
   Value: Stocky <soporte@stockypos.app>
   ```

6. **Seleccionar entornos** (para AMBAS variables):
   - ✅ Production
   - ✅ Preview
   - ✅ Development

7. **Hacer clic en:** `Save` (para cada variable)

### Opción B: Desde Terminal (Alternativa)

```bash
cd /Users/andres_plazas/Desktop/Stockly

# Instalar Vercel CLI si no la tienes
npm i -g vercel

# Login
vercel login

# Agregar variable de entorno
vercel env add RESEND_API_KEY
# Pegar tu API key cuando te lo pida
# Seleccionar: Production, Preview, Development (Spacebar para marcar)

# Agregar email remitente
vercel env add RESEND_FROM_EMAIL
# Escribir: Stocky <soporte@stockypos.app>
# Seleccionar: Production, Preview, Development
```

---

## 🔄 Paso 4: Redesplegar

### Opción A: Deploy Automático (Git)

Si tu proyecto está conectado a GitHub:

```bash
git add .
git commit -m "feat: configurar Resend para emails"
git push origin main
```

Vercel desplegará automáticamente.

### Opción B: Deploy Manual

```bash
cd /Users/andres_plazas/Desktop/Stockly

# Build local
npm run build

# Deploy a producción
vercel --prod
```

---

## ✅ Paso 5: Verificar Configuración

### 5.1 Verificar Variable de Entorno

1. **Dashboard de Vercel** → Settings → Environment Variables
2. Confirmar que **AMBAS** variables están listadas:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
3. Verificar que ambas estén en `Production`, `Preview`, `Development`

### 5.2 Verificar en la Aplicación

1. **Abrir Stockly** en producción
2. **Abrir consola del navegador** (F12)
3. **Ejecutar en la consola:**
   ```javascript
   // Esto NO mostrará la API key por seguridad (es una variable de servidor)
   // Pero verificaremos que Resend se detecte cuando envíes un email
   ```

---

## 🧪 Paso 6: Probar Envío de Email

1. **Ir a Ventas** en Stockly

2. **Seleccionar una venta existente**

3. **Hacer clic en botón de comprobante** (icono de email)

4. **Llenar datos:**
   - Nombre del cliente
   - **Email válido** (usa tu email personal)
   
5. **Enviar comprobante**

6. **Verificar:**
   - ✅ Mensaje de éxito en la app
   - ✅ Email llega en 5-10 segundos
   - ✅ **Fecha de emisión visible** (ej: "20 de enero de 2026, 10:18 a. m.")

---

## 🔍 Paso 7: Monitorear en Dashboard de Resend

1. **Ir a:** https://resend.com/emails

2. **Ver:**
   - Emails enviados
   - Estado (Delivered, Bounced, etc.)
   - Tiempo de entrega
   - Contenido del email

3. **Dashboard Analytics:**
   - Total de emails
   - Tasa de entrega
   - Tasa de apertura

---

## 🐛 Troubleshooting

### Problema: Email no llega

**Causa 1: API Key no configurada**
```bash
# Verificar en Vercel
vercel env ls

# Debe aparecer RESEND_API_KEY
```

**Causa 2: Redeploy necesario**
```bash
# Forzar nuevo deploy
vercel --prod --force
```

**Causa 3: Email bloqueado**
- Revisar Dashboard de Resend → Emails
- Ver si está en "Bounced" o "Spam"

### Problema: Error 401 (Unauthorized)

**Solución:**
1. Verificar que la API key es correcta
2. Verificar que no tiene espacios al inicio/final
3. Generar nueva API key en Resend
4. Actualizar en Vercel
5. Redesplegar

### Problema: Error 422 (Validation Error)

**Solución:**
1. Verificar que el email del destinatario es válido
2. Ver logs en consola del navegador
3. Revisar Dashboard de Resend para detalles

---

## 📊 Cómo Saber si Está Funcionando

### Señales de Éxito ✅

1. **En la consola del navegador:**
   ```
   ✅ Comprobante enviado exitosamente a email@example.com
   ```

2. **En el email recibido:**
   - Header con logo de Stocky
   - **Fecha de Emisión:** 20 de enero de 2026, 10:18 a. m. ✅
   - Número de comprobante
   - Lista de productos
   - Total con formato colombiano

3. **En Dashboard de Resend:**
   - Email aparece en la lista
   - Status: `Delivered`
   - No hay errores

### Señales de que sigue usando EmailJS ⚠️

Si el email llega pero:
- La fecha aparece vacía
- El diseño es diferente
- Llega desde `noreply@emailjs.com`

**Entonces** Resend no está configurado y sigue usando EmailJS.

---

## 🎯 Checklist Final

Antes de dar por terminada la configuración:

- [ ] Cuenta de Resend creada y verificada
- [ ] API Key generada y guardada
- [ ] Variable `RESEND_API_KEY` en Vercel (Production)
- [ ] Proyecto redesplegado en Vercel
- [ ] Email de prueba enviado desde Stockly
- [ ] Email recibido con **fecha de emisión visible**
- [ ] Dashboard de Resend muestra el email como "Delivered"

---

## 💡 Próximos Pasos (Opcional)

### Personalizar Email de Remitente

Por defecto en Stocky debe usarse: `Stocky <soporte@stockypos.app>`

Para usar tu propio dominio (ej: `ventas@stockly.com`):

1. **Agregar dominio en Resend:**
   - Dashboard → Domains → Add Domain
   
2. **Configurar DNS records:**
   - Resend te dará los registros SPF, DKIM, DMARC
   
3. **Verificar dominio:**
   - Puede tardar 24-48 horas

4. **Actualizar código:**
   ```javascript
   // En src/utils/emailServiceResend.js
   from: 'Stocky <ventas@tudominio.com>'
   ```

### Configurar Webhooks (Avanzado)

Recibir notificaciones cuando:
- Email es entregado
- Email rebota
- Usuario abre el email
- Usuario hace clic en un link

Ver: https://resend.com/docs/webhooks

---

## 📚 Recursos

- **Documentación oficial:** https://resend.com/docs
- **Status page:** https://status.resend.com
- **Pricing:** https://resend.com/pricing
- **Support:** support@resend.com

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, los emails se enviarán con:
- ✅ Fecha de emisión correctamente formateada
- ✅ Mayor deliverability (99.9%)
- ✅ 3,000 emails/mes gratis
- ✅ Template HTML profesional
- ✅ Analytics en tiempo real
