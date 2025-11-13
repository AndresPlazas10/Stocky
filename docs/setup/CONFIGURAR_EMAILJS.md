# 📧 Guía Rápida: Configurar EmailJS para Envío de Facturas

## ⚡ Solución Inmediata

El sistema ahora usa **EmailJS** para enviar facturas por email, funcionando tanto para administradores como empleados.

## 🔧 Configuración en 5 Minutos

### Paso 1: Crear cuenta en EmailJS (GRATIS)
1. Ve a: https://www.emailjs.com
2. Crea una cuenta gratuita
3. Verifica tu email

### Paso 2: Configurar Servicio de Email
1. En EmailJS dashboard, ve a **Email Services**
2. Clic en **Add New Service**
3. Selecciona tu proveedor (Gmail, Outlook, etc.)
4. Conecta tu cuenta de email
5. Copia el **Service ID** (ejemplo: `service_abc123`)

### Paso 3: Crear Template
1. Ve a **Email Templates**
2. Clic en **Create New Template**
3. Usa este template:

```
Asunto: Factura {{invoice_number}} - {{business_name}}

Hola {{customer_name}},

Te enviamos tu factura {{invoice_number}}.

{{message}}

Detalles de la Compra:
{{items_list}}

Total: {{total}}

Gracias por tu compra.

Saludos,
{{business_name}}
```

4. Variables que usa el sistema:
   - `{{to_email}}` - Email del destinatario
   - `{{customer_name}}` - Nombre del cliente
   - `{{invoice_number}}` - Número de factura
   - `{{total}}` - Total formateado
   - `{{items_list}}` - Lista de productos
   - `{{message}}` - Mensaje personalizado
   - `{{business_name}}` - Nombre del negocio

5. Guarda y copia el **Template ID** (ejemplo: `template_xyz789`)

### Paso 4: Obtener Public Key
1. En el dashboard, ve a **Account** → **General**
2. Copia tu **Public Key** (ejemplo: `AbCdEf123456`)

### Paso 5: Configurar Variables de Entorno
1. Crea un archivo `.env` en la raíz del proyecto (si no existe)
2. Agrega estas líneas:

```bash
# Supabase (ya configurado)
VITE_SUPABASE_URL=tu_url_actual
VITE_SUPABASE_ANON_KEY=tu_key_actual

# EmailJS (NUEVAS)
VITE_EMAILJS_PUBLIC_KEY=AbCdEf123456
VITE_EMAILJS_SERVICE_ID=service_abc123
VITE_EMAILJS_TEMPLATE_ID=template_xyz789
```

3. Reemplaza con tus valores reales de EmailJS

### Paso 6: Reiniciar Servidor
```bash
# Detener el servidor (Ctrl+C)
npm run dev
```

## ✅ Verificar que Funciona

1. **Crear una factura** con email de cliente
2. Sistema debería mostrar: `✅ Factura FAC-000001 enviada a cliente@email.com`
3. **Revisar** el email del cliente

## 🎯 Plan Gratuito de EmailJS

- ✅ 200 emails/mes gratis
- ✅ Sin tarjeta de crédito
- ✅ Sin expiración
- ✅ Perfecto para empezar

## 🔍 Troubleshooting

### ❌ Error: "EmailJS no configurado"
**Solución:** 
- Verifica que las 3 variables estén en `.env`
- Reinicia el servidor (`npm run dev`)

### ❌ Error: "Failed to send email"
**Solución:**
- Verifica que el **Service** esté conectado en EmailJS
- Verifica que el **Template** tenga todas las variables
- Revisa la consola de EmailJS para más detalles

### ❌ Emails no llegan
**Solución:**
- Revisa carpeta de **Spam**
- Verifica que el servicio de email esté activo en EmailJS
- Prueba con otro email

## 📊 Modo Demo vs Modo Real

### Modo Demo (sin configuración):
```
⚠️ Email NO enviado (configura EmailJS)
```
- La factura SE CREA correctamente
- Solo el email NO se envía
- Todo lo demás funciona normal

### Modo Real (con EmailJS configurado):
```
✅ Factura FAC-000001 enviada a cliente@email.com
```
- La factura se crea
- El email SE ENVÍA al cliente
- Sistema 100% funcional

## 🚀 Beneficios de Esta Solución

✅ **Funciona para todos**: Admin y empleados  
✅ **Gratis**: 200 emails/mes sin costo  
✅ **Sin Edge Functions**: No depende de Supabase Functions  
✅ **Fácil de configurar**: 5 minutos  
✅ **Modo demo**: Funciona aunque no esté configurado  
✅ **Compatible**: Con Gmail, Outlook, cualquier email  

## 📝 Configuración Avanzada (Opcional)

### Personalizar el Template

Puedes agregar:
- Logo de tu empresa
- Colores personalizados
- Pie de página con datos de contacto
- Links a redes sociales

### Cambiar el Remitente

En EmailJS, puedes configurar:
- Nombre del remitente: "Stockly - Facturación"
- Email de respuesta personalizado
- Email "Reply-to" diferente

## 🎓 Video Tutorial

EmailJS tiene tutoriales en: https://www.emailjs.com/docs/

## ⚡ Resumen de 30 Segundos

```bash
1. Crear cuenta en emailjs.com (gratis)
2. Conectar tu Gmail u otro email
3. Crear template con las variables
4. Copiar: Service ID, Template ID, Public Key
5. Agregar al .env
6. Reiniciar servidor
7. ¡Listo! 🎉
```

---

**Nota:** Si prefieres otra solución como Resend o SendGrid, puedo adaptarlo, pero EmailJS es la más rápida y fácil de configurar.
