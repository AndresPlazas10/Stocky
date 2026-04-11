# 🚀 Guía Rápida: Setup de Resend

## ✅ Paso 1: Crear Cuenta (2 minutos)

1. Ve a https://resend.com
2. Haz clic en **Sign Up**
3. Regístrate con tu email o GitHub
4. Verifica tu email

---

## 🔑 Paso 2: Obtener API Key (1 minuto)

1. En el dashboard de Resend, ve a **API Keys**
2. Haz clic en **Create API Key**
3. Nombre: `Stocky Production` (o el que prefieras)
4. Permiso: **Sending access** (es el predeterminado)
5. Haz clic en **Add**
6. **COPIA la API Key** (empieza con `re_`)

⚠️ **IMPORTANTE**: Solo se muestra una vez. Guárdala bien.

---

## 📝 Paso 3: Configurar .env.local (30 segundos)

Abre `/Users/andres_plazas/Desktop/Stocky/.env.local` y pega tu API Key:

```env
# Pega tu API Key aquí (la que copiaste arriba)
RESEND_API_KEY=re_tu_api_key_aqui

# Remitente oficial de Stocky
RESEND_FROM_EMAIL=Stocky <soporte@stockypos.app>
VITE_RESEND_FROM_EMAIL=soporte@stockypos.app
```

**Ejemplo:**
```env
RESEND_API_KEY=re_123abc456def789ghi
RESEND_FROM_EMAIL=Stocky <soporte@stockypos.app>
VITE_RESEND_FROM_EMAIL=soporte@stockypos.app
```

---

## 🧪 Paso 4: Testing Local (1 minuto)

1. **Reinicia el servidor** (si está corriendo):
   ```bash
   # Ctrl+C para detener, luego:
   npm run dev
   ```

2. **Abre la aplicación**: http://localhost:5173

3. **Prueba enviar una factura**:
   - Ve a Ventas
   - Crea una venta
   - Marca "Generar factura"
   - Ingresa un email válido
   - Haz clic en "Finalizar venta"

4. **Verifica**:
   - El email debería enviarse a `VITE_TEST_EMAIL` (tu email de prueba)
   - Revisa tu bandeja de entrada
   - El asunto será: `[TEST MODE] Factura XXXX`

---

## 🌍 Paso 5: Configurar para Producción en Vercel (2 minutos)

1. Ve a tu proyecto en Vercel: https://vercel.com
2. **Settings** → **Environment Variables**
3. Añade estas variables:

   | Key | Value | Environment |
   |-----|-------|-------------|
   | `RESEND_API_KEY` | `re_tu_api_key_aqui` | Production |
   | `RESEND_FROM_EMAIL` | `Stocky <soporte@stockypos.app>` | Production |

4. **Redeploy** (opcional):
   ```bash
   git push origin main
   ```
   O en Vercel Dashboard → Deployments → Redeploy

---

## 🎯 Paso 6 (Opcional): Usar Tu Propio Dominio

Si quieres que los emails vengan de `noreply@tudominio.com`:

### 6.1. Añadir Dominio en Resend

1. En Resend → **Domains** → **Add Domain**
2. Ingresa tu dominio (ej: `stockly.app`)
3. Copia los DNS records que te muestran

### 6.2. Configurar DNS

En tu proveedor DNS (Vercel, Cloudflare, GoDaddy, etc.), añade:

**SPF Record:**
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

**DKIM Record:**
```
Type: TXT
Name: resend._domainkey
Value: [el valor que te dió Resend]
```

**DMARC Record (opcional pero recomendado):**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:tu-email@gmail.com
```

### 6.3. Verificar Dominio

1. Vuelve a Resend → **Domains**
2. Haz clic en **Verify** (puede tardar 1-5 minutos)
3. Una vez verificado, actualiza `.env.local`:
   ```env
   RESEND_FROM_EMAIL=Stocky <soporte@stockypos.app>
   VITE_RESEND_FROM_EMAIL=soporte@stockypos.app
   ```

---

## ✅ Checklist de Verificación

- [ ] Cuenta de Resend creada
- [ ] API Key copiada y guardada
- [ ] `RESEND_API_KEY` configurada en `.env.local`
- [ ] `RESEND_FROM_EMAIL` configurada
- [ ] Servidor reiniciado (`npm run dev`)
- [ ] Email de prueba enviado y recibido
- [ ] Variables configuradas en Vercel (producción)
- [ ] (Opcional) Dominio verificado

---

## 🐛 Troubleshooting

### Error: "Missing API Key"

**Solución:**
1. Verifica que `RESEND_API_KEY` esté en `.env.local`
2. Reinicia el servidor: `npm run dev`
3. La API Key debe empezar con `re_`

### Error: "Invalid API Key"

**Solución:**
1. Verifica que copiaste la API Key completa
2. No debe tener espacios al inicio/final
3. Crea una nueva API Key si es necesario

### Los emails no llegan

**Solución:**
1. Revisa la carpeta de spam
2. Verifica el email de destino en consola del navegador:
   ```js
   import { getEmailStats } from './src/utils/emailValidation';
   console.table(getEmailStats());
   ```
3. Revisa logs de Resend: https://resend.com/logs

### Error: "Domain not verified"

**Solución:**
- Verifica que `stockypos.app` esté correctamente verificado en Resend
- Asegura que `RESEND_FROM_EMAIL` sea `Stocky <soporte@stockypos.app>`

---

## 📊 Monitorear Emails

### En Resend Dashboard

1. Ve a https://resend.com/emails
2. Verás todos los emails enviados
3. Estado: Sent, Delivered, Bounced, etc.
4. Clic en un email para ver detalles

### En tu Aplicación

Abre consola del navegador:
```js
import { getEmailStats } from './src/utils/emailValidation';
console.table(getEmailStats());
```

Verás:
```
total: 10
success: 9
failed: 1
skipped: 0
```

---

## 💡 Tips

1. **Desarrollo**: Usa `VITE_TEST_EMAIL` para que todos los emails vayan a tu email de prueba
2. **Producción**: Los emails van al cliente real (validados automáticamente)
3. **Plan gratis**: 3,000 emails/mes es suficiente para la mayoría de pequeños negocios
4. **Upgrade**: Si necesitas más, plan Pro ($20/mes) da 50,000 emails/mes

---

## 📞 Soporte

- **Resend Docs**: https://resend.com/docs
- **Resend Discord**: https://resend.com/discord
- **Email Configuration**: Ver `EMAIL_CONFIGURATION.md`

---

## 🎉 ¡Listo!

Ahora tienes un sistema de email profesional con:
- ✅ 99.9% deliverability
- ✅ Validación automática de emails
- ✅ Modo testing para desarrollo
- ✅ Dashboard con analytics
- ✅ Sin riesgo de bounced emails
