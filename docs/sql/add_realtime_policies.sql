-- ==============================================================================
-- PARCHE: Agregar RLS a order_items y sale_details para Sincronización en Tiempo Real
-- ==============================================================================
-- Este script agrega las políticas faltantes para habilitar Realtime en tablas relacionales
-- Ejecutar en: Supabase SQL Editor

-- 1. ORDER_ITEMS - Limpiar políticas existentes
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'order_items') 
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON order_items';
  END LOOP;
END $$;

-- 2. ORDER_ITEMS - Habilitar RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 3. ORDER_ITEMS - Crear política basada en business_id de la orden relacionada
CREATE POLICY "Enable all for business members via orders"
ON order_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.business_id IN (SELECT get_my_business_ids())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.business_id IN (SELECT get_my_business_ids())
  )
);

-- 4. SALE_DETAILS - Limpiar políticas existentes
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'sale_details') 
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON sale_details';
  END LOOP;
END $$;

-- 5. SALE_DETAILS - Habilitar RLS
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;

-- 6. SALE_DETAILS - Crear política basada en business_id de la venta relacionada
CREATE POLICY "Enable all for business members via sales"
ON sale_details FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sales 
    WHERE sales.id = sale_details.sale_id 
    AND sales.business_id IN (SELECT get_my_business_ids())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales 
    WHERE sales.id = sale_details.sale_id 
    AND sales.business_id IN (SELECT get_my_business_ids())
  )
);

-- 7. Otorgar permisos necesarios
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sale_details TO authenticated;

-- 8. Habilitar Realtime para las tablas
-- Nota: Esto requiere permisos de superusuario. Si falla, habilita manualmente en:
-- Supabase Dashboard → Database → Replication
DO $$
BEGIN
  -- Verificar si la publicación realtime existe
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Agregar order_items a la publicación de realtime
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE order_items';
    RAISE NOTICE '✅ order_items agregado a Realtime';
  ELSE
    RAISE NOTICE '⚠️ Publicación supabase_realtime no encontrada. Habilita Realtime manualmente en Database → Replication';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '✅ order_items ya está en Realtime';
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permisos insuficientes. Habilita Realtime manualmente en Database → Replication';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Agregar sale_details a la publicación de realtime
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE sale_details';
    RAISE NOTICE '✅ sale_details agregado a Realtime';
  ELSE
    RAISE NOTICE '⚠️ Publicación supabase_realtime no encontrada. Habilita Realtime manualmente en Database → Replication';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '✅ sale_details ya está en Realtime';
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permisos insuficientes. Habilita Realtime manualmente en Database → Replication';
END $$;

-- ==============================================================================
-- VERIFICACIÓN
-- ==============================================================================

-- Verificar que RLS está habilitado
SELECT 
    tablename as "Tabla",
    CASE 
        WHEN rowsecurity THEN '✅ HABILITADO'
        ELSE '❌ DESHABILITADO'
    END as "Estado RLS"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('order_items', 'sale_details')
ORDER BY tablename;

-- Verificar políticas creadas
SELECT 
    tablename as "Tabla",
    policyname as "Política",
    cmd as "Operación"
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('order_items', 'sale_details')
ORDER BY tablename, cmd;

-- Verificar permisos
SELECT 
    table_name as "Tabla",
    string_agg(privilege_type, ', ') as "Permisos"
FROM information_schema.table_privileges 
WHERE table_schema = 'public'
AND table_name IN ('order_items', 'sale_details')
AND grantee = 'authenticated'
GROUP BY table_name
ORDER BY table_name;

-- Verificar que Realtime está habilitado
SELECT 
    schemaname as "Schema",
    tablename as "Tabla",
    CASE 
        WHEN tablename = ANY(
            SELECT tablename 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime'
        ) THEN '✅ HABILITADO'
        ELSE '❌ DESHABILITADO'
    END as "Realtime"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('order_items', 'sale_details', 'orders', 'tables')
ORDER BY tablename;

-- ==============================================================================
-- RESULTADO ESPERADO
-- ==============================================================================
-- 
-- Estado RLS:
--   order_items   ✅ HABILITADO
--   sale_details  ✅ HABILITADO
--
-- Políticas (2 total):
--   order_items   Enable all for business members via orders   ALL
--   sale_details  Enable all for business members via sales    ALL
--
-- Permisos:
--   order_items   SELECT, INSERT, UPDATE, DELETE
--   sale_details  SELECT, INSERT, UPDATE, DELETE
--
-- Realtime:
--   order_items   ✅ HABILITADO
--   sale_details  ✅ HABILITADO
--   orders        ✅ HABILITADO
--   tables        ✅ HABILITADO
--
-- NOTA: Si Realtime muestra ❌ DESHABILITADO, habilítalo manualmente en:
-- Supabase Dashboard → Database → Replication → Toggle ON para cada tabla
-- ==============================================================================
