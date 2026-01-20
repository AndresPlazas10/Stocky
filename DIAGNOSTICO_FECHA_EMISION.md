# 🔍 Diagnóstico Completo: Fecha de Emisión Vacía en Emails

## 📊 Análisis del Flujo de Datos

### 1️⃣ Origen de los Datos (Base de Datos)
```javascript
// src/services/salesService.js - Línea 126
let query = supabase
  .from('sales')
  .select('*', { count: 'exact' }) // ✅ Selecciona TODOS los campos incluyendo created_at
  .eq('business_id', businessId)
```

**✅ STATUS:** El campo `created_at` SÍ se está seleccionando de la base de datos.

---

### 2️⃣ Construcción del Objeto selectedSale
```javascript
// src/components/Dashboard/Ventas.jsx - Línea 808
setSelectedSale({ ...venta, sale_details: saleDetails || [] });
```

**✅ STATUS:** El objeto `venta` incluye `created_at` porque viene de `getFilteredSales()`.

---

### 3️⃣ Paso del Parámetro issuedAt
```javascript
// src/components/Dashboard/Ventas.jsx - Línea 865
const emailResult = await sendInvoiceEmail({
  email: invoiceCustomerEmail,
  invoiceNumber: comprobanteNumber,
  customerName: invoiceCustomerName,
  total: total,
  items: emailItems,
  businessName: businessData?.name || 'Stockly',
  issuedAt: selectedSale.created_at // ✅ Se pasa correctamente
});
```

**✅ STATUS:** El parámetro `issuedAt` se pasa con el valor de `selectedSale.created_at`.

---

### 4️⃣ Formateo de la Fecha (EmailJS)
```javascript
// src/utils/emailServiceSupabase.js - Líneas 104-112
const formattedDate = issuedAt 
  ? new Date(issuedAt).toLocaleDateString('es-CO', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  : new Date().toLocaleDateString('es-CO');
```

**✅ STATUS:** La fecha se formatea correctamente en español.

---

### 5️⃣ Template Params para EmailJS
```javascript
// src/utils/emailServiceSupabase.js - Línea 117
const templateParams = {
  to_email: targetEmail,
  customer_name: customerName,
  invoice_number: invoiceNumber,
  issued_at: formattedDate, // ✅ Se pasa la fecha formateada
  total: `$${total.toLocaleString('es-CO')}`,
  items_list: itemsText || 'Ver factura adjunta',
  business_name: 'Stocky',
  message: // ...
};
```

**✅ STATUS:** El parámetro `issued_at` contiene la fecha formateada.

---

## 🎯 PROBLEMA IDENTIFICADO

### ❌ El Template de EmailJS NO está Configurado Correctamente

El código pasa correctamente la variable `issued_at` a EmailJS, pero el **template HTML en el dashboard de EmailJS debe incluir la variable `{{issued_at}}`** para que se renderice.

---

## 🛠️ SOLUCIÓN

### Opción 1: Verificar Template de EmailJS (RECOMENDADO)

1. **Ir al Dashboard de EmailJS:**
   - https://dashboard.emailjs.com/admin/templates

2. **Editar el Template:**
   - Buscar el template ID configurado en `VITE_EMAILJS_TEMPLATE_ID`
   - Verificar que contenga la variable `{{issued_at}}`

3. **Formato Correcto del Template:**
```html
<h2>Comprobante de Venta</h2>
<p><strong>Número:</strong> {{invoice_number}}</p>
<p><strong>Fecha de Emisión:</strong> {{issued_at}}</p>
<p><strong>Cliente:</strong> {{customer_name}}</p>
<p><strong>Total:</strong> {{total}}</p>

<h3>Productos:</h3>
<pre>{{items_list}}</pre>

<p>{{message}}</p>
```

---

### Opción 2: Usar Resend en Lugar de EmailJS

Si el template de EmailJS no se puede modificar fácilmente, configurar Resend que tiene el template HTML embebido en el código:

1. **Crear cuenta en Resend:**
   - https://resend.com/signup

2. **Obtener API Key:**
   - Dashboard → API Keys → Create API Key

3. **Configurar en Vercel:**
```bash
# En Vercel Dashboard → Settings → Environment Variables
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

4. **Ventajas de Resend:**
   - ✅ Template HTML en código (línea 140 de emailServiceResend.js)
   - ✅ 3,000 emails/mes gratis (vs 200 de EmailJS)
   - ✅ Mejor deliverability
   - ✅ La fecha YA está correctamente implementada

---

## 🧪 Testing y Verificación

### 1. Agregar Console Logs (Temporal)

```javascript
// src/utils/emailServiceSupabase.js - Después de línea 112
console.log('📅 Debugging fecha emisión:', {
  issuedAtOriginal: issuedAt,
  issuedAtType: typeof issuedAt,
  formattedDate: formattedDate,
  templateParams: templateParams
});
```

### 2. Verificar en el Email Recibido

- Revisar el email en la bandeja de entrada
- Si `{{issued_at}}` aparece literalmente → Template de EmailJS no configurado
- Si aparece vacío → `issuedAt` es undefined (verificar console.log)
- Si aparece correctamente → Problema solucionado ✅

---

## 📌 Checklist de Verificación

- [ ] Verificar que `created_at` existe en tabla `sales` (Supabase Dashboard)
- [ ] Verificar console.log en navegador con datos de `issuedAt`
- [ ] Verificar template de EmailJS tiene variable `{{issued_at}}`
- [ ] Considerar migrar a Resend para mejor control del template

---

## 🎓 Lecciones Aprendidas

1. **EmailJS requiere configuración manual del template:** Las variables deben agregarse en el dashboard web, no en el código.

2. **Resend ofrece más control:** El template HTML está completamente en el código.

3. **Supabase `.select('*')` es confiable:** Sí selecciona todos los campos incluyendo `created_at`.

4. **Console.logs son esenciales:** Para debugging de valores que no se ven en la UI.

---

## 🚀 Próximos Pasos

### INMEDIATO:
1. Agregar console.log para verificar valor de `issuedAt`
2. Abrir dashboard de EmailJS y verificar template

### RECOMENDADO:
1. Migrar a Resend para mejor control y mayor límite de emails
2. Documentar estructura exacta del template en el código

