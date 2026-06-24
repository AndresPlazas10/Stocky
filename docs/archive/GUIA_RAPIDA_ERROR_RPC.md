# 🚀 Guía de Solución: Error 400 en generate_invoice_number

## 📌 Pasos a Seguir (EN ORDEN)

### PASO 1: Verificar el Estado Actual en Supabase ⚡

1. **Abre tu proyecto en Supabase:**
   - Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Selecciona tu proyecto de Stocky

2. **Ve a SQL Editor** (menú lateral izquierdo)

3. **Ejecuta el script de verificación:**
   - Abre el archivo: `docs/sql/verificar_rpc_facturacion.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en **RUN** (o presiona Cmd/Ctrl + Enter)

4. **Lee los resultados:**

   ```
   ✅ VERIFICACIÓN 1: Función existe → SÍ EXISTE
   ✅ VERIFICACIÓN 2: Permisos otorgados → PERMISOS OK
   ✅ VERIFICACIÓN 3: Security mode → SECURITY DEFINER
   ✅ VERIFICACIÓN 4: Tabla invoices existe → TABLA EXISTE
   ✅ VERIFICACIÓN 5: Business disponible → HAY BUSINESSES
   ✅ VERIFICACIÓN 6: Función ejecutada exitosamente!
      Business ID usado: 3f2b775e-a4dd-432a-9913-b73d50238975
      Número generado: FAC-000001
   ```

**Si TODAS las verificaciones están en ✅:**
- El problema NO está en Supabase
- Ve directo al **PASO 3** (debugging React)

**Si HAY algún ❌:**
- Continúa con el **PASO 2** (corrección en Supabase)

---

### PASO 2: Corregir Problemas en Supabase 🔧

**SOLO si el PASO 1 mostró errores (❌)**

1. **Abre SQL Editor en Supabase** (igual que el PASO 1)

2. **Ejecuta el script de corrección completo:**
   - Abre el archivo: `docs/sql/fix_generate_invoice_number_rpc.sql`
   - Copia TODO el contenido (379 líneas)
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en **RUN**

3. **Espera a que termine** (puede tomar 10-20 segundos)

4. **Verifica los mensajes:**
   - Deberías ver múltiples líneas con ✅
   - El PASO 8 debe mostrar: `✅ Función ejecutada exitosamente!`

5. **Vuelve a ejecutar** el script de verificación (PASO 1) para confirmar que todo está OK

**Resultado esperado:**
```
✅ Todas las verificaciones pasaron
```

---

### PASO 3: Debugging en la Aplicación React 🐛

**Ya agregué logs de debugging en el código. Ahora vamos a verlos:**

1. **Abre la aplicación en desarrollo:**
   ```bash
   npm run dev
   ```

2. **Abre DevTools en el navegador:**
   - Chrome/Edge: Presiona `F12` o `Cmd+Option+I` (Mac)
   - Firefox: Presiona `F12` o `Cmd+Shift+K` (Mac)

3. **Ve a la pestaña Console**

4. **Intenta crear una factura:**
   - Opción A: Ve a **Ventas** → Selecciona una venta → "Generar Factura"
   - Opción B: Ve a **Facturas** → "Nueva Factura"

5. **Revisa los logs en Console:**

**Si TODO está OK, verás:**
```
🔍 [Facturas] Generando número de factura...
   businessId: 3f2b775e-a4dd-432a-9913-b73d50238975
   businessId type: string
   businessId válido: true
📊 [Facturas] RPC Response: { 
  invoiceNumber: "FAC-000001", 
  hasError: false,
  errorMessage: undefined 
}
✅ Factura FAC-000001 creada exitosamente
```

**Si HAY error, verás:**
```
🔍 [Facturas] Generando número de factura...
   businessId: 3f2b775e-a4dd-432a-9913-b73d50238975
   businessId type: string
   businessId válido: true
❌ [Facturas] Error RPC completo: {
  message: "...",
  details: "...",
  hint: "...",
  code: "...",
  statusCode: 400
}
```

---

### PASO 4: Interpretar Errores Específicos 🔍

#### Error: `"function generate_invoice_number(uuid) does not exist"`

**Causa:** La función no existe en Supabase

**Solución:**
1. Vuelve al **PASO 2**
2. Ejecuta `fix_generate_invoice_number_rpc.sql` COMPLETO
3. Verifica que el PASO 8 del script se ejecutó sin errores

---

#### Error: `"permission denied for function generate_invoice_number"`

**Causa:** Faltan permisos GRANT EXECUTE

**Solución:**

Ejecuta en SQL Editor de Supabase:

```sql
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO anon;
```

---

#### Error: `"businessId: null"` en los logs

**Causa:** El usuario no tiene un business asociado en la tabla `employees`

**Solución:**

1. Verifica en Supabase SQL Editor:

```sql
-- Reemplaza este UUID con el user_id de tu sesión
SELECT 
  e.id as employee_id,
  e.business_id,
  e.is_active,
  b.business_name
FROM employees e
JOIN businesses b ON b.id = e.business_id
WHERE e.user_id = '3382bbb1-0477-4950-bec0-6fccb74c111c'::UUID;
```

2. Si NO hay resultados, el usuario no está registrado como empleado

3. **Solución:**
   - Ve a **Empleados** en la app
   - Registra al usuario como empleado activo
   - O ejecuta en SQL:

```sql
INSERT INTO employees (user_id, business_id, role, is_active)
VALUES (
  '3382bbb1-0477-4950-bec0-6fccb74c111c'::UUID, -- Tu user_id
  '3f2b775e-a4dd-432a-9913-b73d50238975'::UUID, -- Tu business_id
  'admin',
  true
);
```

---

#### Error: `"businessId válido: false"` en los logs

**Causa:** El `businessId` no es un UUID de 36 caracteres

**Solución:**

Verifica en los logs:
```
businessId: undefined  ← ERROR
businessId: ""         ← ERROR
businessId: 123        ← ERROR
businessId: 3f2b775e-a4dd-432a-9913-b73d50238975  ← CORRECTO
```

---

### PASO 5: Verificar Network Tab (Avanzado) 🌐

Si los logs no muestran el error completo:

1. **Abre DevTools → Network tab**

2. **Filtra por:** `generate_invoice_number`

3. **Intenta crear una factura nuevamente**

4. **Busca la petición:** `POST /rest/v1/rpc/generate_invoice_number`

5. **Haz clic en ella** → Ve a la pestaña **Response**

**Respuesta exitosa:**
```json
"FAC-000001"
```

**Respuesta con error:**
```json
{
  "code": "42883",
  "details": null,
  "hint": "No function matches the given name and argument types...",
  "message": "function generate_invoice_number(uuid) does not exist"
}
```

6. **Ve también a Headers → Request Payload:**

```json
{
  "p_business_id": "3f2b775e-a4dd-432a-9913-b73d50238975"
}
```

**Verifica:**
- ✅ El parámetro se llama `p_business_id` (con prefijo `p_`)
- ✅ El valor es un UUID válido (36 caracteres)
- ✅ No es NULL, undefined, o string vacío

---

### PASO 6: Logs de Supabase (Última Opción) 📊

Si TODO lo anterior no funciona:

1. **Ve a Supabase Dashboard** → **Logs** (menú lateral)

2. **Filtra por:** `API` o `Postgres`

3. **Busca peticiones con error 400**

4. **Revisa el mensaje de error completo**

**Ejemplo de log útil:**
```
[ERROR] RPC call failed: generate_invoice_number
Error: permission denied for function generate_invoice_number
User: 3382bbb1-0477-4950-bec0-6fccb74c111c
```

---

## ✅ Checklist Final

Marca cada punto al completarlo:

### En Supabase:
- [ ] Ejecuté `verificar_rpc_facturacion.sql` (PASO 1)
- [ ] Todas las verificaciones pasaron (✅ x6)
- [ ] Si hubo errores, ejecuté `fix_generate_invoice_number_rpc.sql` (PASO 2)
- [ ] Re-ejecuté verificación y TODO está en ✅

### En la Aplicación:
- [ ] Abrí DevTools → Console
- [ ] Intenté crear una factura
- [ ] Revisé los logs: `🔍 [Facturas] Generando número de factura...`
- [ ] Verifiqué que `businessId` NO es NULL
- [ ] Verifiqué que `businessId válido: true`
- [ ] Verifiqué el RPC Response

### Testing:
- [ ] Test en SQL Editor: `SELECT generate_invoice_number('...')` → OK
- [ ] Test en la app: Crear factura → ✅ Factura FAC-000001 creada
- [ ] Verificar en tabla: `SELECT * FROM invoices` → Factura aparece

---

## 🎯 Resultado Esperado

**Después de seguir TODOS los pasos:**

1. **En SQL Editor de Supabase:**
   ```sql
   SELECT generate_invoice_number('3f2b775e-a4dd-432a-9913-b73d50238975'::UUID);
   ```
   **Resultado:** `FAC-000001` ✅

2. **En la aplicación (Console):**
   ```
   🔍 [Facturas] Generando número de factura...
      businessId: 3f2b775e-a4dd-432a-9913-b73d50238975
      businessId válido: true
   📊 [Facturas] RPC Response: { invoiceNumber: "FAC-000001", hasError: false }
   ✅ Factura FAC-000001 creada exitosamente
   ```

3. **En Supabase → Table Editor → invoices:**
   - Debe aparecer una nueva fila con `invoice_number = 'FAC-000001'`

---

## 📞 Si Aún No Funciona

**Proporciona esta información para debugging avanzado:**

1. **Captura de pantalla de:**
   - Console de DevTools (con los logs `🔍 [Facturas]...`)
   - Network tab → RPC call → Response
   - Supabase Logs (Dashboard → Logs)

2. **Ejecuta y copia resultados:**
   ```sql
   -- En Supabase SQL Editor
   SELECT version(); -- Versión de PostgreSQL
   
   SELECT * FROM information_schema.routines 
   WHERE routine_name = 'generate_invoice_number';
   
   SELECT * FROM information_schema.routine_privileges 
   WHERE routine_name = 'generate_invoice_number';
   ```

3. **Verifica versión de Supabase client:**
   ```bash
   cat package.json | grep supabase
   ```

---

**Archivos de referencia:**
- 📄 `docs/sql/verificar_rpc_facturacion.sql` - Verificación rápida
- 📄 `docs/sql/fix_generate_invoice_number_rpc.sql` - Corrección completa (379 líneas)
- 📄 `docs/SOLUCION_ERROR_400_RPC_FACTURACION.md` - Análisis detallado

**Última actualización:** 12 de diciembre de 2025
