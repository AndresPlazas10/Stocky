# 🔧 SOLUCIÓN RÁPIDA: Error "generate_invoice_number not found"

## ❌ Error Actual
```
Could not find the function public.generate_invoice_number(p_business_id) in the schema cache
```

## ✅ Solución (3 minutos)

### Opción A: Aplicar SQL en Supabase (RECOMENDADO)

1. **Ve a Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Selecciona tu proyecto: `wngjyrkqxblnhxliakqj`

2. **Abre el SQL Editor:**
   - Menú lateral → **SQL Editor**
   - Click en **New query**

3. **Copia y pega este SQL:**

```sql
-- Eliminar funciones antiguas si existen
DROP FUNCTION IF EXISTS generate_invoice_number(UUID);
DROP FUNCTION IF EXISTS generate_invoice_number(TEXT);
DROP FUNCTION IF EXISTS generate_invoice_number();

-- Crear función correcta
CREATE OR REPLACE FUNCTION generate_invoice_number(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_number INTEGER;
  v_new_number TEXT;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id no puede ser NULL';
  END IF;

  SELECT 
    COALESCE(
      MAX(
        CASE 
          WHEN i.invoice_number ~ '^FAC-[0-9]+$' 
          THEN CAST(SUBSTRING(i.invoice_number FROM 5) AS INTEGER)
          ELSE 0
        END
      ), 
      0
    )
  INTO v_last_number
  FROM invoices AS i
  WHERE i.business_id = p_business_id;
  
  v_new_number := 'FAC-' || LPAD((v_last_number + 1)::TEXT, 6, '0');
  
  RETURN v_new_number;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID) TO anon;
```

4. **Click en "RUN"** (o presiona `Ctrl + Enter`)

5. **Deberías ver:** ✅ Success. No rows returned

---

### Opción B: Usar archivo de migración

```bash
# El archivo ya está creado en:
supabase/migrations/20260120_create_generate_invoice_number.sql

# Para aplicarlo en Supabase local (si usas Supabase CLI):
supabase db push
```

---

## 🧪 Verificar que Funciona

1. En el mismo SQL Editor de Supabase, ejecuta:

```sql
-- Probar la función (debería retornar FAC-000001)
SELECT generate_invoice_number('00000000-0000-0000-0000-000000000000'::UUID);
```

2. **Resultado esperado:**
```
generate_invoice_number
-----------------------
FAC-000001
```

---

## 🎯 ¿Qué hace esta función?

Genera números consecutivos de factura por negocio:
- Primera factura: `FAC-000001`
- Segunda factura: `FAC-000002`
- Tercera factura: `FAC-000003`
- ...

**IMPORTANTE:** Estos son comprobantes informativos, **NO facturas electrónicas válidas ante DIAN**.

---

## 🔍 ¿Por qué faltaba esta función?

La función debió haberse creado en migraciones anteriores, pero probablemente:
- No se aplicó correctamente
- Se eliminó accidentalmente
- Es un proyecto nuevo sin las migraciones base

---

## ✅ Después de Aplicar

1. ✅ El error desaparecerá
2. ✅ Podrás enviar comprobantes por email
3. ✅ Los números de factura se generarán automáticamente

**¿Listo?** Después de aplicar el SQL, intenta enviar un comprobante nuevamente.
