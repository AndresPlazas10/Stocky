# 🎯 Guía para Verificar Template de EmailJS

## ⚠️ PROBLEMA
La fecha de emisión aparece vacía en los emails de comprobantes.

## 🔍 DIAGNÓSTICO
El código **SÍ** está pasando la fecha correctamente, pero el **template de EmailJS** podría no estar configurado para mostrar la variable `{{issued_at}}`.

---

## 📝 PASO A PASO: Verificar Template de EmailJS

### 1️⃣ Abrir Dashboard de EmailJS

1. Ir a: **https://dashboard.emailjs.com/admin/templates**
2. Iniciar sesión con tu cuenta de EmailJS

### 2️⃣ Identificar el Template Correcto

En el archivo `.env` o en Vercel, buscar:
```
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
```

Buscar ese template en el dashboard.

### 3️⃣ Editar el Template

Hacer clic en **Edit** en el template correspondiente.

### 4️⃣ Verificar Variables Disponibles

El template debe incluir estas variables (marcadas con `{{variable}}`):

**✅ Variables que SÍ se están pasando desde el código:**
- `{{to_email}}` - Email del destinatario
- `{{customer_name}}` - Nombre del cliente
- `{{invoice_number}}` - Número de comprobante
- `{{issued_at}}` - ⚠️ **FECHA DE EMISIÓN** (esta es la que falta)
- `{{total}}` - Total de la venta
- `{{items_list}}` - Lista de productos
- `{{business_name}}` - Nombre del negocio (Stocky)
- `{{message}}` - Mensaje completo formateado

### 5️⃣ Template Recomendado (HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Venta</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  
  <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #edb886; margin: 0;">{{business_name}}</h1>
      <p style="color: #666; margin: 5px 0 0 0;">Comprobante de Venta</p>
    </div>

    <!-- Customer Info -->
    <p style="color: #333; font-size: 16px;">Hola <strong>{{customer_name}}</strong>,</p>
    <p style="color: #666;">Gracias por tu compra. Aquí están los detalles de tu comprobante:</p>

    <!-- Invoice Details -->
    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Número de Comprobante:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">{{invoice_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Fecha de Emisión:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #333;">{{issued_at}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Total:</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #edb886; font-size: 20px; font-weight: bold;">{{total}}</td>
        </tr>
      </table>
    </div>

    <!-- Products -->
    <h3 style="color: #edb886; margin: 25px 0 15px 0;">Productos Comprados:</h3>
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px;">
      <pre style="margin: 0; font-family: 'Courier New', monospace; font-size: 13px; color: #333; white-space: pre-wrap;">{{items_list}}</pre>
    </div>

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
      <p>Este es un comprobante informativo, no tiene validez fiscal.</p>
      <p>Gracias por preferirnos.</p>
    </div>

  </div>

</body>
</html>
```

### 6️⃣ Guardar y Probar

1. **Guardar** el template
2. En Stockly, intentar enviar un comprobante de venta
3. Verificar la consola del navegador (F12 → Console) para ver los logs de debugging:
   - `📧 DEBUG Email Data` - Ver si `created_at` tiene valor
   - `📅 DEBUG Fecha Emisión` - Ver si `formattedDate` está correcto

---

## 🔍 Cómo Verificar si el Template Está Bien

### ✅ Template Correcto
```html
<p>Fecha de Emisión: {{issued_at}}</p>
```
**Resultado en email:** `Fecha de Emisión: 21 de enero de 2026, 10:30`

### ❌ Template Incorrecto (sin variable)
```html
<p>Fecha de Emisión: </p>
```
**Resultado en email:** `Fecha de Emisión: ` (vacío)

### ❌ Template Incorrecto (nombre equivocado)
```html
<p>Fecha de Emisión: {{issue_date}}</p>
```
**Resultado en email:** `Fecha de Emisión: ` (vacío, variable no existe)

---

## 🧪 Testing Rápido

### Método 1: EmailJS Test (Desde Dashboard)

1. En el dashboard de EmailJS, ir a **Email Services**
2. Seleccionar tu servicio
3. Hacer clic en **Send Test Email**
4. Llenar las variables manualmente:
```json
{
  "to_email": "tu-email@ejemplo.com",
  "customer_name": "Juan Pérez",
  "invoice_number": "COMP-001",
  "issued_at": "21 de enero de 2026, 10:30",
  "total": "$50,000",
  "items_list": "- Producto A x 2 = $30,000\n- Producto B x 1 = $20,000",
  "business_name": "Stocky"
}
```
5. Verificar que el email llega con la fecha visible

### Método 2: Desde Stockly (Debugging Real)

1. Abrir Stockly en el navegador
2. Presionar **F12** para abrir DevTools
3. Ir a la pestaña **Console**
4. Crear o seleccionar una venta
5. Intentar enviar comprobante por email
6. Verificar los logs:
```javascript
📧 DEBUG Email Data: {
  selectedSale_created_at: "2026-01-21T15:30:00.000Z", // ✅ Debe tener valor
  selectedSale_keys: ["id", "created_at", "total", ...],
  comprobanteNumber: "COMP-000123",
  email: "cliente@ejemplo.com"
}

📅 DEBUG Fecha Emisión: {
  issuedAtOriginal: "2026-01-21T15:30:00.000Z",
  issuedAtType: "string",
  issuedAtIsValid: true,
  formattedDate: "21 de enero de 2026, 3:30 PM", // ✅ Debe estar formateada
  invoiceNumber: "COMP-000123"
}
```

**Si `created_at` es `undefined` o `null`:**
- Problema está en la carga de datos desde Supabase
- Verificar que la tabla `sales` tenga el campo `created_at`

**Si `formattedDate` está correcto pero el email llega vacío:**
- Problema está en el template de EmailJS
- Seguir los pasos anteriores para agregar `{{issued_at}}`

---

## 🎯 Solución Alternativa: Usar Resend

Si EmailJS sigue dando problemas o no quieres modificar el template manualmente:

### 1. Crear cuenta en Resend
- Ir a: https://resend.com/signup
- Plan gratuito: 3,000 emails/mes (vs 200 de EmailJS)

### 2. Obtener API Key
1. Dashboard → API Keys
2. Create API Key
3. Copiar el valor (empieza con `re_`)

### 3. Configurar en Vercel
```bash
# Vercel Dashboard → Settings → Environment Variables
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
```

### 4. Redesplegar
```bash
npm run build
vercel --prod
```

**Ventaja de Resend:**
- ✅ El template HTML está en el código (línea 140 de `src/utils/emailServiceResend.js`)
- ✅ La fecha **YA** está correctamente implementada
- ✅ Mayor límite de emails (3,000 vs 200)
- ✅ Mejor deliverability

---

## 📊 Resumen de Opciones

| Opción | Pros | Contras | Tiempo |
|--------|------|---------|--------|
| **Verificar EmailJS** | Gratis, ya configurado | Requiere editar template web | 5 min |
| **Migrar a Resend** | Mejor, más control, más emails | Requiere API key y redesploy | 10 min |

---

## 📌 Checklist Final

- [ ] Abrir dashboard de EmailJS
- [ ] Verificar que template tiene variable `{{issued_at}}`
- [ ] Si no la tiene, agregar según template recomendado
- [ ] Guardar cambios en EmailJS
- [ ] Probar envío de comprobante desde Stockly
- [ ] Verificar console.log en navegador (F12)
- [ ] Verificar email recibido en bandeja de entrada
- [ ] Si sigue fallando, considerar migrar a Resend

