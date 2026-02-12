-- ============================================================
-- SCRIPT COMPLETO PARA EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================
-- 
-- INSTRUCCIONES:
-- 1. Abre Supabase Dashboard → SQL Editor
-- 2. Copia CADA SECCIÓN por separado
-- 3. Ejecuta como superusuario
-- 4. Espera a que termine antes de pasar a la siguiente
--
-- ============================================================

-- ============================================================
-- PASO 1: CREAR FUNCIÓN RPC create_sale_complete
-- ============================================================
-- Copia TODO desde "CREATE OR REPLACE FUNCTION" hasta el último "$$;"
-- Este es el contenido completo de supabase/functions/create_sale_complete.sql

CREATE OR REPLACE FUNCTION public.create_sale_complete(
  p_business_id uuid,
  p_user_id uuid,
  p_seller_name text,
  p_payment_method text,
  p_items jsonb,
  p_order_id uuid DEFAULT NULL,
  p_table_id uuid DEFAULT NULL
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

    SELECT stock INTO v_current_stock
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
      unit_price
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_quantity,
      v_unit_price
    );

    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product_id;

    v_total := v_total + (v_quantity * v_unit_price);
    v_item_count := v_item_count + 1;
  END LOOP;

  UPDATE public.sales
  SET total = v_total
  WHERE id = v_sale_id;

  -- Cerrar orden y liberar mesa si aplica
  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'closed', closed_at = timezone('utc', now())
    WHERE id = p_order_id;
  END IF;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables
    SET current_order_id = NULL, status = 'available'
    WHERE id = p_table_id;
  END IF;

  RETURN QUERY SELECT
    v_sale_id,
    v_total,
    v_item_count,
    'success'::text;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al crear venta: %', SQLERRM;
END;
$$;

-- ============================================================
-- PASO 2: CREAR ÍNDICES DE OPTIMIZACIÓN
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_id_business_stock 
  ON public.products (id, business_id, stock);

CREATE INDEX IF NOT EXISTS idx_sale_details_sale_id 
  ON public.sale_details (sale_id);

CREATE INDEX IF NOT EXISTS idx_sales_business_created 
  ON public.sales (business_id, created_at DESC);

-- ============================================================
-- PASO 3: ASIGNAR PERMISOS Y CONFIGURACIÓN
-- ============================================================
-- Ejecuta estos 3 comandos UNO por UNO

ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  OWNER TO postgres;

ALTER FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_sale_complete(uuid, uuid, text, text, jsonb) 
  TO authenticated;

-- ============================================================
-- PASO 4: FIX DE FECHAS EN SALES
-- ============================================================
-- Asegurar que created_at siempre tiene valor

ALTER TABLE public.sales
ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.sales 
SET created_at = COALESCE(created_at, NOW() - INTERVAL '1 day')
WHERE created_at IS NULL;

ALTER TABLE public.sales
ALTER COLUMN created_at SET NOT NULL;

-- ============================================================
-- PASO 5: VERIFICACIÓN (OPCIONAL)
-- ============================================================
-- Ejecuta esto para verificar que todo está correcto

-- Ver si la función existe
SELECT 
  proname,
  pg_get_userbyid(proowner) as owner
FROM pg_proc 
WHERE proname = 'create_sale_complete';

-- Ver últimas ventas y sus fechas
SELECT 
  id,
  created_at,
  total,
  business_id
FROM public.sales 
ORDER BY created_at DESC 
LIMIT 5;

-- Ver índices creados
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes 
WHERE tablename IN ('products', 'sale_details', 'sales')
  AND indexname LIKE 'idx_%';

-- ============================================================
-- LISTO!
-- ============================================================
-- Ahora puedes:
-- 1. Crear una venta desde la app
-- 2. Ver que aparece en ~100-150ms (antes era ~1000ms)
-- 3. Verificar que la fecha (created_at) aparece en el listado
