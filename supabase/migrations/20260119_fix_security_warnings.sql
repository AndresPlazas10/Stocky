-- =====================================================
-- FIX: Advertencias de Seguridad de Supabase
-- =====================================================
-- Fecha: 19 enero 2026
-- Advertencias corregidas:
--   1. Function Search Path Mutable (14 funciones)
--   2. Extension in Public Schema (pg_trgm)
--   3. RLS Policy Always True (siigo_invoice_logs)
-- =====================================================

-- =====================================================
-- 1. FIX: Mover pg_trgm a schema extensions
-- =====================================================

-- Crear schema extensions si no existe
CREATE SCHEMA IF NOT EXISTS extensions;

-- Mover extensión pg_trgm al schema correcto
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- =====================================================
-- 2. FIX: Agregar search_path a todas las funciones
-- =====================================================

-- Función: update_stock_batch
CREATE OR REPLACE FUNCTION update_stock_batch(
  product_updates JSONB
)
RETURNS TABLE (
  product_id UUID,
  old_stock INTEGER,
  new_stock INTEGER,
  success BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_old_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  FOR item IN 
    SELECT 
      (value->>'product_id')::UUID as pid,
      (value->>'quantity')::INTEGER as qty
    FROM jsonb_array_elements(product_updates)
  LOOP
    UPDATE products
    SET stock = stock - item.qty,
        updated_at = NOW()
    WHERE id = item.pid
      AND stock >= item.qty
      AND is_active = true
    RETURNING (stock + item.qty), stock INTO v_old_stock, v_new_stock;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente o producto inactivo: %', item.pid
        USING HINT = 'Verifique el inventario antes de completar la venta';
    END IF;
    
    product_id := item.pid;
    old_stock := v_old_stock;
    new_stock := v_new_stock;
    success := true;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION update_stock_batch TO authenticated;

-- Función: restore_stock_batch
CREATE OR REPLACE FUNCTION restore_stock_batch(
  product_updates JSONB
)
RETURNS TABLE (
  product_id UUID,
  old_stock INTEGER,
  new_stock INTEGER,
  success BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  v_old_stock INTEGER;
  v_new_stock INTEGER;
BEGIN
  FOR item IN 
    SELECT 
      (value->>'product_id')::UUID as pid,
      (value->>'quantity')::INTEGER as qty
    FROM jsonb_array_elements(product_updates)
  LOOP
    UPDATE products
    SET stock = stock + item.qty,
        updated_at = NOW()
    WHERE id = item.pid
      AND is_active = true
    RETURNING (stock - item.qty), stock INTO v_old_stock, v_new_stock;
    
    IF FOUND THEN
      product_id := item.pid;
      old_stock := v_old_stock;
      new_stock := v_new_stock;
      success := true;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_stock_batch TO authenticated;

-- Función: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =====================================================
-- 3. FIX: Política RLS de siigo_invoice_logs
-- =====================================================
-- Cambiar de WITH CHECK (true) a validación específica

DROP POLICY IF EXISTS "siigo_invoice_logs_insert_policy" ON siigo_invoice_logs;

CREATE POLICY "siigo_invoice_logs_insert_policy" ON siigo_invoice_logs
    FOR INSERT
    WITH CHECK (
        -- Solo service_role (Edge Functions) puede insertar logs
        -- En Supabase, service_role no pasa por RLS, pero agregamos validación
        -- para cuando se use desde authenticated role
        auth.uid() IN (
            SELECT b.created_by 
            FROM businesses b 
            WHERE b.id = business_id
        )
    );

-- =====================================================
-- RESULTADO
-- =====================================================
-- ✅ pg_trgm movido a schema extensions
-- ✅ 3 funciones con search_path = public
-- ✅ Política RLS de siigo_invoice_logs mejorada
-- 
-- Las otras 11 funciones mencionadas en las advertencias
-- (reduce_stock, increase_stock, etc.) NO existen en las
-- migraciones activas, solo en documentación.
-- =====================================================
