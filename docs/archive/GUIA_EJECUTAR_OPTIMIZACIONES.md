# 🚀 EJECUTAR OPTIMIZACIONES EN SUPABASE

## 📋 Guía paso a paso (5 minutos)

### ✅ PASO 1: Accede a Supabase SQL Editor

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto Stocky
3. Click en **SQL Editor** (lado izquierdo)
4. Click en **New Query**

---

### ✅ PASO 2: Crear la función RPC

**Copia TODO esto en el SQL Editor:**

```sql
CREATE OR REPLACE FUNCTION public.create_sale_complete(
  p_business_id uuid,
  p_user_id uuid,
  p_seller_name text,
  p_payment_method text,
  p_items jsonb
)
RETURNS TABLE (
  sale_id uuid,
  total_amount numeric,
  items_count integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_current_stock numeric;
  v_item_count integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un producto';
  END IF;

  INSERT INTO public.sales (
    business_id,
    user_id,
    seller_name,
    payment_method,
    total,
    created_at
  ) VALUES (
    p_business_id,
    p_user_id,
    p_seller_name,
    COALESCE(p_payment_method, 'cash'),
    0,
    timezone('utc', now())
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser mayor a 0';
    END IF;

    SELECT current_stock INTO v_current_stock
    FROM public.products
    WHERE id = v_product_id
      AND business_id = p_business_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado o no activo', v_product_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, solicitado: %',
        v_product_id, v_current_stock, v_quantity;
    END IF;

    INSERT INTO public.sale_details (
      sale_id,
      product_id,
      quantity,
      unit_price,
      created_at
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      timezone('utc', now())
    );

    UPDATE public.products
    SET current_stock = current_stock - v_quantity,
        updated_at = timezone('utc', now())
    WHERE id = v_product_id;

    v_total := v_total + (v_quantity * v_unit_price);
    v_item_count := v_item_count + 1;
  END LOOP;

  UPDATE public.sales
  SET total = v_total,
      updated_at = timezone('utc', now())
  WHERE id = v_sale_id;

  RETURN QUERY SELECT
    v_sale_id,
    v_total,
    v_item_count,
    'success'::text;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al crear venta: %', SQLERRM;
END;
$$;
```

**Click en "Run"** (botón azul arriba a la derecha) → Espera a que diga **✅ Success**

---

### ✅ PASO 3: Crear índices

**Nueva Query - Copia esto:**

```sql
CREATE INDEX IF NOT EXISTS idx_products_id_business_stock 
  ON public.products (id, business_id, current_stock);

CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id 
  ON public.sale_details (sale_id);

CREATE INDEX IF NOT EXISTS idx_sales_business_created 
  ON public.sales (business_id, created_at DESC);
```

**Click en "Run"** → Espera **✅ Success**

---

### ✅ PASO 4: Asignar permisos

**Nueva Query - Copia esto (UNO POR UNO):**

Primero:
```sql
ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  OWNER TO postgres;
```
**Run** → ✅ Success

Luego:
```sql
ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  SET search_path = public;
```
**Run** → ✅ Success

Finalmente:
```sql
GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  TO authenticated;
```
**Run** → ✅ Success

---

### ✅ PASO 5: Fix de fechas en sales

**Nueva Query - Copia esto:**

```sql
ALTER TABLE public.sales
ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.sales 
SET created_at = COALESCE(created_at, NOW() - INTERVAL '1 day')
WHERE created_at IS NULL;

ALTER TABLE public.sales
ALTER COLUMN created_at SET NOT NULL;
```

**Run** → ✅ Success

---

### ✅ PASO 6: Verificar que todo está correcto (OPCIONAL)

```sql
-- Ver si la función existe
SELECT proname, pg_get_userbyid(proowner) as owner
FROM pg_proc 
WHERE proname = 'create_sale_complete';

-- Ver últimas ventas (deberían tener created_at)
SELECT id, created_at, total FROM public.sales 
ORDER BY created_at DESC LIMIT 5;
```

**Run** → Deberías ver la función y las ventas con fechas

---

## ✨ Listo!

Ahora:
1. ✅ Abre la app en http://localhost:5173
2. ✅ Ve a **Ventas**
3. ✅ Crea una nueva venta
4. ✅ **Deberías ver `✅ Venta registrada en ~120ms`** (antes era 1000ms)
5. ✅ Las fechas deberían aparecer en el listado

---

## 🆘 Si algo falla

### Error: "Function already exists"
→ Normal, significa que ya la tenías. Click en "Replace" si aparece el diálogo.

### Error: "permission denied"
→ Asegúrate de estar conectado como superusuario. En Supabase Dashboard:
- Click en **Settings** → **Database** → Copia la `Connection string (Postgres)`
- Si la string tiene `:password@` y no `:postgres@`, usa esa.

### La función no aparece en el listado
→ Espera 30 segundos y recarga la página. A veces Supabase demora en sincronizar.

---

## 📊 Cómo verificar latencia

Después de crear una venta:

1. Abre DevTools (F12)
2. Click en **Console**
3. Copia-pega esto:
```javascript
import { getSaleCreationMetrics } from './src/services/salesServiceOptimized.js';
console.log(getSaleCreationMetrics());
```

Deberías ver algo como:
```
{ avg: 125, min: 95, max: 200, count: 5 }
```

Eso significa: promedio 125ms, mínimo 95ms, máximo 200ms

---

## ✅ Checklist final

- [ ] Función `create_sale_complete` creada en Supabase
- [ ] Índices creados
- [ ] Permisos asignados (3 commands)
- [ ] Fix de fechas ejecutado
- [ ] App iniciada (`npm run dev`)
- [ ] Venta creada en ~100-150ms
- [ ] Fecha visible en listado de ventas

¡Listo! 🚀
