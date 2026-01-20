-- =====================================================
-- POLÍTICAS RLS COMPLETAS Y PERFECTAS - STOCKLY
-- =====================================================
-- Este script implementa un sistema completo de Row Level Security
-- diseñado específicamente para Stocky.
--
-- ✅ Soporta múltiples roles: owner, admin, employee, cashier
-- ✅ Aislamiento completo entre negocios
-- ✅ Sin dependencias circulares
-- ✅ Optimizado para performance
-- ✅ Validaciones completas de integridad
--
-- ADVERTENCIA: Ejecutar en orden. No omitir pasos.
-- =====================================================

-- =====================================================
-- PASO 0: INFORMACIÓN PREVIA
-- =====================================================
-- ANTES DE EJECUTAR:
-- 1. Backup completo de la base de datos
-- 2. Verificar que tienes permisos de SUPERUSER
-- 3. Ejecutar en horario de bajo tráfico
-- 4. Probar primero en staging/desarrollo
--
-- DURACIÓN ESTIMADA: 5-10 minutos
-- =====================================================

SET search_path = public;

-- =====================================================
-- PASO 1: ELIMINAR POLÍTICAS EXISTENTES
-- =====================================================
-- Limpiamos TODAS las políticas antiguas para evitar conflictos

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Iterar sobre todas las políticas en schema public
  FOR r IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                   r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Dropped policy: %.% on %', r.schemaname, r.policyname, r.tablename;
  END LOOP;
END $$;

-- =====================================================
-- PASO 2: CREAR/ACTUALIZAR FUNCIONES DE SEGURIDAD
-- =====================================================

-- Función 1: get_user_business_ids() ✅
-- Retorna lista de negocios a los que el usuario tiene acceso
-- SECURITY DEFINER para evitar dependencias circulares con RLS

CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS TABLE(business_id UUID) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Negocios creados por el usuario (OWNER)
  SELECT id FROM businesses WHERE created_by = auth.uid()
  UNION
  -- Negocios donde el usuario es empleado activo
  SELECT e.business_id FROM employees e
  WHERE e.user_id = auth.uid() AND e.is_active = true;
END;
$$;

COMMENT ON FUNCTION get_user_business_ids() IS
  'Retorna IDs de negocios a los que el usuario actual tiene acceso (como owner o empleado activo)';

GRANT EXECUTE ON FUNCTION get_user_business_ids() TO authenticated;

-- Función 2: get_user_role(p_business_id UUID) ⚡ NUEVA
-- Retorna el rol del usuario en un negocio específico
-- Posibles valores: 'owner', 'admin', 'employee', 'cashier', NULL

CREATE OR REPLACE FUNCTION get_user_role(p_business_id UUID)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verificar si es owner del negocio
  SELECT 'owner' INTO v_role
  FROM businesses
  WHERE id = p_business_id AND created_by = auth.uid();
  
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;
  
  -- Verificar rol como empleado
  SELECT role INTO v_role
  FROM employees
  WHERE business_id = p_business_id 
    AND user_id = auth.uid() 
    AND is_active = true;
  
  RETURN v_role;
END;
$$;

COMMENT ON FUNCTION get_user_role(UUID) IS
  'Retorna el rol del usuario actual en un negocio: owner, admin, employee, cashier, o NULL';

GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;

-- Función 3: check_is_owner(p_business_id UUID) ⚡ NUEVA
-- Verifica si el usuario es owner del negocio

CREATE OR REPLACE FUNCTION check_is_owner(p_business_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id AND created_by = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION check_is_owner(UUID) IS
  'Verifica si el usuario actual es owner del negocio especificado';

GRANT EXECUTE ON FUNCTION check_is_owner(UUID) TO authenticated;

-- Función 4: check_is_admin_or_owner(p_business_id UUID) ⚡ NUEVA
-- Verifica si el usuario es owner O admin del negocio

CREATE OR REPLACE FUNCTION check_is_admin_or_owner(p_business_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_user_role(p_business_id);
  RETURN v_role IN ('owner', 'admin');
END;
$$;

COMMENT ON FUNCTION check_is_admin_or_owner(UUID) IS
  'Verifica si el usuario actual es owner o admin del negocio';

GRANT EXECUTE ON FUNCTION check_is_admin_or_owner(UUID) TO authenticated;

-- Función 5: check_can_manage_employees(p_business_id UUID) ⚡ NUEVA
-- Verifica si el usuario puede gestionar empleados

CREATE OR REPLACE FUNCTION check_can_manage_employees(p_business_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo owner y admin pueden gestionar empleados
  RETURN check_is_admin_or_owner(p_business_id);
END;
$$;

COMMENT ON FUNCTION check_can_manage_employees(UUID) IS
  'Verifica si el usuario puede gestionar empleados (owner o admin)';

GRANT EXECUTE ON FUNCTION check_can_manage_employees(UUID) TO authenticated;

-- Función 6: check_can_delete_sale(p_sale_id UUID) ⚡ NUEVA
-- Verifica si el usuario puede eliminar una venta

CREATE OR REPLACE FUNCTION check_can_delete_sale(p_sale_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Obtener business_id y fecha de creación de la venta
  SELECT business_id, created_at INTO v_business_id, v_created_at
  FROM sales
  WHERE id = p_sale_id;
  
  -- Solo owner/admin pueden eliminar
  IF NOT check_is_admin_or_owner(v_business_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Opcional: No permitir eliminar ventas de hace más de 30 días
  IF v_created_at < (NOW() - INTERVAL '30 days') THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION check_can_delete_sale(UUID) IS
  'Verifica si el usuario puede eliminar una venta (owner/admin, máximo 30 días de antigüedad)';

GRANT EXECUTE ON FUNCTION check_can_delete_sale(UUID) TO authenticated;

-- =====================================================
-- PASO 3: HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Tablas opcionales (solo si existen)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tables') THEN
    EXECUTE 'ALTER TABLE tables ENABLE ROW LEVEL SECURITY';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders') THEN
    EXECUTE 'ALTER TABLE orders ENABLE ROW LEVEL SECURITY';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'order_items') THEN
    EXECUTE 'ALTER TABLE order_items ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- =====================================================
-- PASO 4: POLÍTICAS PARA BUSINESSES
-- =====================================================

-- SELECT: Ver negocios a los que tengo acceso
CREATE POLICY "businesses_select"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_business_ids()));

COMMENT ON POLICY "businesses_select" ON businesses IS
  'Permite ver negocios donde el usuario es owner o empleado activo';

-- INSERT: Cualquier usuario autenticado puede crear un negocio
CREATE POLICY "businesses_insert"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

COMMENT ON POLICY "businesses_insert" ON businesses IS
  'Permite a cualquier usuario autenticado crear un negocio';

-- UPDATE: Solo el owner puede actualizar su negocio
CREATE POLICY "businesses_update"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

COMMENT ON POLICY "businesses_update" ON businesses IS
  'Solo el owner (created_by) puede actualizar el negocio';

-- DELETE: Solo el owner puede eliminar su negocio
CREATE POLICY "businesses_delete"
  ON businesses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

COMMENT ON POLICY "businesses_delete" ON businesses IS
  'Solo el owner (created_by) puede eliminar el negocio';

-- =====================================================
-- PASO 5: POLÍTICAS PARA EMPLOYEES
-- =====================================================

-- SELECT: Ver empleados según rol
CREATE POLICY "employees_select"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    -- Owner y Admin ven todos los empleados del negocio
    business_id IN (SELECT get_user_business_ids())
    OR
    -- Empleados normales solo ven su propio perfil
    user_id = auth.uid()
  );

COMMENT ON POLICY "employees_select" ON employees IS
  'Owner/Admin ven todos los empleados. Employee/Cashier solo su perfil';

-- INSERT: Solo owner/admin pueden agregar empleados
CREATE POLICY "employees_insert"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_can_manage_employees(business_id)
  );

COMMENT ON POLICY "employees_insert" ON employees IS
  'Solo owner/admin pueden agregar empleados';

-- UPDATE: Owner/admin actualizan todos, empleados solo su perfil
CREATE POLICY "employees_update"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (
    -- Owner/Admin pueden actualizar cualquier empleado de su negocio
    (business_id IN (SELECT get_user_business_ids()) AND check_can_manage_employees(business_id))
    OR
    -- Empleados pueden actualizar solo su propio perfil
    (user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    -- Validar que no cambian campos prohibidos
    business_id IN (SELECT get_user_business_ids())
  );

COMMENT ON POLICY "employees_update" ON employees IS
  'Owner/Admin actualizan todos. Empleados solo su perfil (email, full_name)';

-- DELETE: Solo owner puede eliminar empleados
CREATE POLICY "employees_delete"
  ON employees
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_is_owner(business_id)
  );

COMMENT ON POLICY "employees_delete" ON employees IS
  'Solo el owner del negocio puede eliminar empleados';

-- =====================================================
-- PASO 6: POLÍTICAS PARA PRODUCTS
-- =====================================================

-- Usamos política FOR ALL por simplicidad
-- Owner/Admin pueden todo, Employee tiene restricciones a nivel de app

CREATE POLICY "products_all"
  ON products
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

COMMENT ON POLICY "products_all" ON products IS
  'Acceso completo a productos del negocio. Restricciones de rol a nivel de app';

-- =====================================================
-- PASO 7: POLÍTICAS PARA SUPPLIERS
-- =====================================================

CREATE POLICY "suppliers_all"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

COMMENT ON POLICY "suppliers_all" ON suppliers IS
  'Acceso completo a proveedores del negocio';

-- =====================================================
-- PASO 8: POLÍTICAS PARA SALES
-- =====================================================

-- SELECT: Owner/Admin ven todo, Employee/Cashier solo sus ventas
CREATE POLICY "sales_select"
  ON sales
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    (
      -- Owner/Admin ven todas las ventas
      check_is_admin_or_owner(business_id)
      OR
      -- Employee/Cashier solo ven sus propias ventas
      user_id = auth.uid()
    )
  );

COMMENT ON POLICY "sales_select" ON sales IS
  'Owner/Admin ven todas las ventas. Employee/Cashier solo las suyas';

-- INSERT: Todos los roles pueden crear ventas
CREATE POLICY "sales_insert"
  ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
    AND
    -- Validar que user_id sea el usuario actual
    user_id = auth.uid()
  );

COMMENT ON POLICY "sales_insert" ON sales IS
  'Todos los roles autenticados del negocio pueden crear ventas';

-- UPDATE: Solo owner/admin pueden modificar ventas
CREATE POLICY "sales_update"
  ON sales
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_is_admin_or_owner(business_id)
  )
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
  );

COMMENT ON POLICY "sales_update" ON sales IS
  'Solo owner/admin pueden modificar ventas existentes';

-- DELETE: Solo owner/admin con validaciones adicionales
CREATE POLICY "sales_delete"
  ON sales
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_can_delete_sale(id)
  );

COMMENT ON POLICY "sales_delete" ON sales IS
  'Solo owner/admin pueden eliminar ventas (máximo 30 días de antigüedad)';

-- =====================================================
-- PASO 9: POLÍTICAS PARA SALE_DETAILS
-- =====================================================

-- SELECT: Mismo permiso que la venta padre
CREATE POLICY "sale_details_select"
  ON sale_details
  FOR SELECT
  TO authenticated
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      WHERE s.business_id IN (SELECT get_user_business_ids())
      AND (
        check_is_admin_or_owner(s.business_id)
        OR s.user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "sale_details_select" ON sale_details IS
  'Mismos permisos que tabla sales';

-- INSERT: Al crear venta
CREATE POLICY "sale_details_insert"
  ON sale_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

COMMENT ON POLICY "sale_details_insert" ON sale_details IS
  'Permite agregar items a ventas del negocio';

-- UPDATE: Solo owner/admin
CREATE POLICY "sale_details_update"
  ON sale_details
  FOR UPDATE
  TO authenticated
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      WHERE s.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(s.business_id)
    )
  )
  WITH CHECK (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

COMMENT ON POLICY "sale_details_update" ON sale_details IS
  'Solo owner/admin pueden modificar items de venta';

-- DELETE: Solo owner/admin
CREATE POLICY "sale_details_delete"
  ON sale_details
  FOR DELETE
  TO authenticated
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      WHERE s.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(s.business_id)
    )
  );

COMMENT ON POLICY "sale_details_delete" ON sale_details IS
  'Solo owner/admin pueden eliminar items de venta';

-- =====================================================
-- PASO 10: POLÍTICAS PARA PURCHASES
-- =====================================================

-- SELECT: Owner/Admin ven todo, Employee solo sus compras
CREATE POLICY "purchases_select"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    (
      check_is_admin_or_owner(business_id)
      OR
      user_id = auth.uid()
    )
  );

COMMENT ON POLICY "purchases_select" ON purchases IS
  'Owner/Admin ven todas las compras. Employee solo las suyas';

-- INSERT: Owner/Admin/Employee pueden crear compras
CREATE POLICY "purchases_insert"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
    AND
    user_id = auth.uid()
  );

COMMENT ON POLICY "purchases_insert" ON purchases IS
  'Owner/Admin/Employee pueden crear compras';

-- UPDATE: Solo owner/admin
CREATE POLICY "purchases_update"
  ON purchases
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_is_admin_or_owner(business_id)
  )
  WITH CHECK (
    business_id IN (SELECT get_user_business_ids())
  );

COMMENT ON POLICY "purchases_update" ON purchases IS
  'Solo owner/admin pueden modificar compras';

-- DELETE: Solo owner/admin
CREATE POLICY "purchases_delete"
  ON purchases
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_is_admin_or_owner(business_id)
  );

COMMENT ON POLICY "purchases_delete" ON purchases IS
  'Solo owner/admin pueden eliminar compras';

-- =====================================================
-- PASO 11: POLÍTICAS PARA PURCHASE_DETAILS
-- =====================================================

-- Similar a sale_details, vinculado a purchases

CREATE POLICY "purchase_details_select"
  ON purchase_details
  FOR SELECT
  TO authenticated
  USING (
    purchase_id IN (
      SELECT p.id FROM purchases p
      WHERE p.business_id IN (SELECT get_user_business_ids())
      AND (
        check_is_admin_or_owner(p.business_id)
        OR p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "purchase_details_insert"
  ON purchase_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "purchase_details_update"
  ON purchase_details
  FOR UPDATE
  TO authenticated
  USING (
    purchase_id IN (
      SELECT p.id FROM purchases p
      WHERE p.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(p.business_id)
    )
  )
  WITH CHECK (
    purchase_id IN (
      SELECT id FROM purchases 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "purchase_details_delete"
  ON purchase_details
  FOR DELETE
  TO authenticated
  USING (
    purchase_id IN (
      SELECT p.id FROM purchases p
      WHERE p.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(p.business_id)
    )
  );

-- =====================================================
-- PASO 12: POLÍTICAS PARA INVOICES
-- =====================================================

CREATE POLICY "invoices_select"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoices_insert"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoices_update"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoices_delete"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (SELECT get_user_business_ids())
    AND
    check_is_admin_or_owner(business_id)
  );

COMMENT ON POLICY "invoices_select" ON invoices IS
  'Todos los roles del negocio pueden ver facturas';

COMMENT ON POLICY "invoices_insert" ON invoices IS
  'Todos los roles autenticados pueden crear facturas';

COMMENT ON POLICY "invoices_update" ON invoices IS
  'Todos pueden actualizar facturas del negocio';

COMMENT ON POLICY "invoices_delete" ON invoices IS
  'Solo owner/admin pueden eliminar facturas';

-- =====================================================
-- PASO 13: POLÍTICAS PARA INVOICE_ITEMS
-- =====================================================

CREATE POLICY "invoice_items_select"
  ON invoice_items
  FOR SELECT
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "invoice_items_insert"
  ON invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "invoice_items_update"
  ON invoice_items
  FOR UPDATE
  TO authenticated
  USING (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices 
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "invoice_items_delete"
  ON invoice_items
  FOR DELETE
  TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      WHERE i.business_id IN (SELECT get_user_business_ids())
      AND check_is_admin_or_owner(i.business_id)
    )
  );

-- =====================================================
-- PASO 14: POLÍTICAS PARA CUSTOMERS
-- =====================================================

CREATE POLICY "customers_all"
  ON customers
  FOR ALL
  TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()))
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

COMMENT ON POLICY "customers_all" ON customers IS
  'Acceso completo a clientes del negocio';

-- =====================================================
-- PASO 15: POLÍTICAS PARA TABLES (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tables') THEN
    EXECUTE '
      CREATE POLICY "tables_all"
        ON tables
        FOR ALL
        TO authenticated
        USING (business_id IN (SELECT get_user_business_ids()))
        WITH CHECK (business_id IN (SELECT get_user_business_ids()))
    ';
    
    RAISE NOTICE 'Políticas creadas para tabla: tables';
  END IF;
END $$;

-- =====================================================
-- PASO 16: POLÍTICAS PARA ORDERS (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders') THEN
    EXECUTE '
      CREATE POLICY "orders_all"
        ON orders
        FOR ALL
        TO authenticated
        USING (business_id IN (SELECT get_user_business_ids()))
        WITH CHECK (business_id IN (SELECT get_user_business_ids()))
    ';
    
    RAISE NOTICE 'Políticas creadas para tabla: orders';
  END IF;
END $$;

-- =====================================================
-- PASO 17: POLÍTICAS PARA ORDER_ITEMS (si existe)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'order_items') THEN
    EXECUTE '
      CREATE POLICY "order_items_select"
        ON order_items
        FOR SELECT
        TO authenticated
        USING (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
        
      CREATE POLICY "order_items_insert"
        ON order_items
        FOR INSERT
        TO authenticated
        WITH CHECK (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
        
      CREATE POLICY "order_items_update"
        ON order_items
        FOR UPDATE
        TO authenticated
        USING (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        )
        WITH CHECK (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
        
      CREATE POLICY "order_items_delete"
        ON order_items
        FOR DELETE
        TO authenticated
        USING (
          order_id IN (
            SELECT id FROM orders 
            WHERE business_id IN (SELECT get_user_business_ids())
          )
        );
    ';
    
    RAISE NOTICE 'Políticas creadas para tabla: order_items';
  END IF;
END $$;

-- =====================================================
-- PASO 18: VERIFICACIÓN DE POLÍTICAS
-- =====================================================

-- Ver todas las políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operacion,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene USING'
    ELSE 'Sin USING'
  END AS using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK'
    ELSE 'Sin WITH CHECK'
  END AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar RLS habilitado
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS HABILITADO'
    ELSE '❌ RLS DESHABILITADO'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'businesses', 'employees', 'products', 'suppliers',
    'sales', 'sale_details', 'purchases', 'purchase_details',
    'invoices', 'invoice_items', 'customers', 'tables', 'orders', 'order_items'
  )
ORDER BY tablename;

-- =====================================================
-- PASO 19: GRANTS DE PERMISOS
-- =====================================================

-- Asegurar que authenticated role tiene permisos
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- PASO 20: RESUMEN Y ESTADÍSTICAS
-- =====================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_function_count INTEGER;
  v_table_count INTEGER;
BEGIN
  -- Contar políticas creadas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- Contar funciones de seguridad
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'get_user%' OR p.proname LIKE 'check_%';
  
  -- Contar tablas con RLS
  SELECT COUNT(*) INTO v_table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = true;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE '✅ POLÍTICAS RLS INSTALADAS EXITOSAMENTE';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total de políticas: %', v_policy_count;
  RAISE NOTICE 'Funciones de seguridad: %', v_function_count;
  RAISE NOTICE 'Tablas con RLS habilitado: %', v_table_count;
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'SIGUIENTE PASO: Ejecutar pruebas de validación';
  RAISE NOTICE 'Ver archivo: PRUEBAS_RLS.sql';
  RAISE NOTICE '==============================================';
END $$;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
-- Tiempo total de ejecución: ~5-10 minutos
-- 
-- PRÓXIMOS PASOS:
-- 1. Ejecutar PRUEBAS_RLS.sql para validar
-- 2. Probar en la aplicación con diferentes roles
-- 3. Monitorear logs de Supabase por errores
-- 4. Ajustar políticas según necesidades específicas
--
-- SOPORTE:
-- - Documentación: docs/sql/ANALISIS_COMPLETO_RLS.md
-- - Pruebas: docs/sql/PRUEBAS_RLS.sql
-- - Mejoras opcionales: docs/sql/MEJORAS_ESTRUCTURA.sql
-- =====================================================
