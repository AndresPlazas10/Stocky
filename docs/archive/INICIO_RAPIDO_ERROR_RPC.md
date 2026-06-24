# 🚀 INICIO RÁPIDO: Solución Error 400 RPC

## ⚡ 3 Pasos Simples

### PASO 1: Verificar en Supabase (2 minutos)

1. Abre [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. **Copia y pega** el archivo: `docs/sql/verificar_rpc_facturacion.sql`
4. Haz clic en **RUN**

**¿Qué verás?**

```
✅ VERIFICACIÓN 1: Función existe → SÍ EXISTE
✅ VERIFICACIÓN 2: Permisos otorgados → PERMISOS OK
✅ VERIFICACIÓN 3: Security mode → SECURITY DEFINER
✅ VERIFICACIÓN 4: Tabla invoices existe → TABLA EXISTE
✅ VERIFICACIÓN 5: Business disponible → HAY BUSINESSES
✅ VERIFICACIÓN 6: Función ejecutada exitosamente!
   Número generado: FAC-000001
```

**Si TODO está en ✅:**
- ✅ Ve directo al PASO 3 (testear en la app)

**Si HAY algún ❌:**
- ❌ Continúa con el PASO 2

---

### PASO 2: Corregir en Supabase (3 minutos)

**SOLO si el PASO 1 mostró errores (❌)**

1. En el mismo **SQL Editor** de Supabase
2. **Copia y pega** el archivo: `docs/sql/fix_generate_invoice_number_rpc.sql`
3. Haz clic en **RUN**
4. Espera 10-20 segundos

**¿Qué verás?**

```
✅ Función recreada con SECURITY DEFINER
✅ Permisos otorgados a authenticated y anon
✅ Test ejecutado exitosamente!
   Business ID: 3f2b775e-a4dd-432a-9913-b73d50238975
   Número generado: FAC-000001
```

5. **Vuelve a ejecutar** el script de verificación (PASO 1) para confirmar

---

### PASO 3: Testear en la Aplicación (1 minuto)

1. **Inicia la app:**
   ```bash
   npm run dev
   ```

2. **Abre DevTools:**
   - Presiona `F12` (Windows/Linux)
   - Presiona `Cmd+Option+I` (Mac)

3. **Ve a la pestaña Console**

4. **Crea una factura:**
   - Opción A: **Ventas** → Selecciona venta → "Generar Factura"
   - Opción B: **Facturas** → "Nueva Factura"

5. **Revisa los logs:**

**✅ Si TODO está OK:**
```
🔍 [Facturas] Generando número de factura...
   businessId: 3f2b775e-a4dd-432a-9913-b73d50238975
   businessId válido: true
📊 [Facturas] RPC Response: { invoiceNumber: "FAC-000001" }
✅ Factura FAC-000001 creada exitosamente
```

**❌ Si HAY error:**
```
❌ [Facturas] Error RPC completo: {
  message: "function does not exist",
  code: "42883"
}
```

→ Ve a `docs/GUIA_RAPIDA_ERROR_RPC.md` PASO 4 para interpretar el error

---

## 📂 Archivos de Referencia

| Archivo | Propósito | Cuándo Usarlo |
|---------|-----------|---------------|
| `docs/sql/verificar_rpc_facturacion.sql` | Diagnóstico rápido (79 líneas) | **SIEMPRE PRIMERO** |
| `docs/sql/fix_generate_invoice_number_rpc.sql` | Corrección completa (379 líneas) | Si verificación falla |
| `docs/GUIA_RAPIDA_ERROR_RPC.md` | Guía paso a paso detallada | Para seguir paso a paso |
| `docs/SOLUCION_ERROR_400_RPC_FACTURACION.md` | Análisis técnico completo | Para entender el problema |
| `docs/RESUMEN_CAMBIOS_RPC_FACTURACION.md` | Resumen ejecutivo | Para ver qué se cambió |

---

## 🎯 Checklist Ultra-Rápido

```
[ ] Ejecutar verificar_rpc_facturacion.sql en Supabase
[ ] Si hay ❌, ejecutar fix_generate_invoice_number_rpc.sql
[ ] npm run dev
[ ] Abrir DevTools (F12) → Console
[ ] Crear factura en la app
[ ] Verificar logs: ✅ Factura FAC-000001 creada
```

---

## 🆘 Errores Comunes

### Error: "function does not exist"

**Solución rápida:**
```sql
-- Ejecutar en Supabase SQL Editor
CREATE OR REPLACE FUNCTION generate_invoice_number(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0)
  INTO last_number
  FROM invoices
  WHERE business_id = p_business_id;
  
  new_number := 'FAC-' || LPAD((last_number + 1)::TEXT, 6, '0');
  RETURN new_number;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO anon;
```

### Error: "permission denied"

**Solución rápida:**
```sql
-- Ejecutar en Supabase SQL Editor
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO anon;
```

### Error: "businessId: null" en logs

**Causa:** Usuario no tiene business asignado

**Solución:**
1. Ve a **Empleados** en la app
2. Registra al usuario como empleado activo
3. O ejecuta en SQL:
```sql
INSERT INTO employees (user_id, business_id, role, is_active)
VALUES (
  'TU_USER_ID'::UUID,
  'TU_BUSINESS_ID'::UUID,
  'admin',
  true
);
```

---

## ✅ Resultado Esperado Final

**En Supabase SQL Editor:**
```sql
SELECT generate_invoice_number('3f2b775e-a4dd-432a-9913-b73d50238975'::UUID);
-- Resultado: FAC-000001 ✅
```

**En la Aplicación (Console):**
```
🔍 [Facturas] Generando número de factura...
   businessId: 3f2b775e-a4dd-432a-9913-b73d50238975
   businessId válido: true
📊 [Facturas] RPC Response: { invoiceNumber: "FAC-000001", hasError: false }
✅ Factura FAC-000001 creada exitosamente
```

**En Supabase Table Editor → invoices:**
```
| id  | invoice_number | customer_name     | total    | status  |
|-----|----------------|-------------------|----------|---------|
| 1   | FAC-000001     | Consumidor Final  | 50000.00 | pending |
```

---

## 📞 ¿Necesitas Ayuda?

Si después de seguir los 3 pasos el error persiste:

1. **Captura de pantalla de:**
   - Console de DevTools (con los logs completos)
   - Network tab → RPC call → Response

2. **Copia el resultado de:**
   ```sql
   SELECT * FROM information_schema.routines 
   WHERE routine_name = 'generate_invoice_number';
   ```

3. **Consulta:**
   - `docs/GUIA_RAPIDA_ERROR_RPC.md` → PASO 4-6 (troubleshooting detallado)

---

**Tiempo total estimado:** 5-10 minutos  
**Dificultad:** ⭐ Fácil (solo copiar y pegar)  
**Última actualización:** 12 de diciembre de 2025
