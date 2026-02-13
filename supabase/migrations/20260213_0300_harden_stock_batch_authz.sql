-- ============================================================
-- HARDENING P0 - Step 3
-- Fecha: 2026-02-13
-- Objetivo: endurecer RPCs de stock batch con autorización
-- explícita por caller y negocio del producto.
-- ============================================================

-- -----------------------------------------------------------------
-- update_stock_batch(product_updates jsonb)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_stock_batch(
  product_updates jsonb
)
RETURNS TABLE (
  product_id uuid,
  old_stock integer,
  new_stock integer,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  v_auth_uid uuid;
  v_product_business_id uuid;
  v_current_stock integer;
  v_new_stock integer;
BEGIN
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF product_updates IS NULL OR jsonb_typeof(product_updates) <> 'array' OR jsonb_array_length(product_updates) = 0 THEN
    RAISE EXCEPTION 'product_updates debe ser un arreglo JSON no vacío';
  END IF;

  FOR item IN
    SELECT
      (value->>'product_id')::uuid AS pid,
      (value->>'quantity')::integer AS qty
    FROM jsonb_array_elements(product_updates)
  LOOP
    IF item.pid IS NULL OR item.qty IS NULL OR item.qty <= 0 THEN
      RAISE EXCEPTION 'Payload inválido en product_updates';
    END IF;

    -- Lock del producto para consistencia concurrente.
    SELECT p.business_id, p.stock
    INTO v_product_business_id, v_current_stock
    FROM public.products p
    WHERE p.id = item.pid
      AND p.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado o inactivo', item.pid;
    END IF;

    IF NOT public.can_access_business(v_product_business_id) THEN
      RAISE EXCEPTION 'No autorizado para operar producto % en negocio %', item.pid, v_product_business_id;
    END IF;

    IF v_current_stock < item.qty THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %, solicitado: %',
        item.pid, v_current_stock, item.qty;
    END IF;

    UPDATE public.products
    SET stock = stock - item.qty,
        updated_at = now()
    WHERE id = item.pid
      AND business_id = v_product_business_id
    RETURNING stock INTO v_new_stock;

    product_id := item.pid;
    old_stock := v_current_stock;
    new_stock := v_new_stock;
    success := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.update_stock_batch(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_stock_batch(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_stock_batch(jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_stock_batch(jsonb)
IS 'Descuenta stock en lote con validación de auth.uid() y acceso al negocio del producto.';

-- -----------------------------------------------------------------
-- restore_stock_batch(product_updates jsonb)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_stock_batch(
  product_updates jsonb
)
RETURNS TABLE (
  product_id uuid,
  old_stock integer,
  new_stock integer,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  v_auth_uid uuid;
  v_product_business_id uuid;
  v_current_stock integer;
  v_new_stock integer;
BEGIN
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida: auth.uid() es NULL';
  END IF;

  IF product_updates IS NULL OR jsonb_typeof(product_updates) <> 'array' OR jsonb_array_length(product_updates) = 0 THEN
    RAISE EXCEPTION 'product_updates debe ser un arreglo JSON no vacío';
  END IF;

  FOR item IN
    SELECT
      (value->>'product_id')::uuid AS pid,
      (value->>'quantity')::integer AS qty
    FROM jsonb_array_elements(product_updates)
  LOOP
    IF item.pid IS NULL OR item.qty IS NULL OR item.qty <= 0 THEN
      RAISE EXCEPTION 'Payload inválido en product_updates';
    END IF;

    SELECT p.business_id, p.stock
    INTO v_product_business_id, v_current_stock
    FROM public.products p
    WHERE p.id = item.pid
      AND p.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado o inactivo', item.pid;
    END IF;

    IF NOT public.can_access_business(v_product_business_id) THEN
      RAISE EXCEPTION 'No autorizado para restaurar producto % en negocio %', item.pid, v_product_business_id;
    END IF;

    UPDATE public.products
    SET stock = stock + item.qty,
        updated_at = now()
    WHERE id = item.pid
      AND business_id = v_product_business_id
    RETURNING stock INTO v_new_stock;

    product_id := item.pid;
    old_stock := v_current_stock;
    new_stock := v_new_stock;
    success := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_stock_batch(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_stock_batch(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_stock_batch(jsonb) TO authenticated;

COMMENT ON FUNCTION public.restore_stock_batch(jsonb)
IS 'Restaura stock en lote con validación de auth.uid() y acceso al negocio del producto.';
